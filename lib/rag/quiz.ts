import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { assertEmbeddingEnv, assertLlmEnv, CHAT_MODEL, getAnthropic, HARD_CHAT_MODEL } from "./clients"
import { classifyComplexity, retrieveContext, type RetrievedChunk } from "./chat"

/**
 * Quiz generation + grading, built on top of the same retrieval (Pinecone,
 * tenant-scoped) and Claude client already used by the chat pipeline. Two
 * structured-output calls:
 *   - generateQuiz(): builds N questions grounded in the course material.
 *   - gradeShortAnswers(): grades open-ended answers with specific feedback,
 *     escalating to the "hard path" (thinking + code execution) when any
 *     question looks computation-heavy — mirrors chat.ts's routing so a
 *     math-heavy quiz question gets the same verified-computation treatment
 *     a math-heavy chat question does.
 */

const QUESTIONS_PER_QUIZ = 5
// Broader than the chat default (5): a quiz should draw on a representative
// spread of the course material, not just the chunks closest to one query.
const GENERATION_TOP_K = 12
const GENERATION_MAX_TOKENS = 4096
const GRADING_MAX_TOKENS_SIMPLE = 4096
const GRADING_MAX_TOKENS_HARD = 8192

const QuizQuestionSchema = z.object({
  type: z.enum(["mcq", "short"]),
  questionText: z.string(),
  // Exactly 4 options for "mcq", empty for "short".
  choices: z.array(z.string()),
  correctAnswer: z.string(),
  // Short tag (2-4 words) powering the weak-topic feedback loop into chat.
  topic: z.string(),
})
const QuizGenerationSchema = z.object({
  questions: z.array(QuizQuestionSchema).length(QUESTIONS_PER_QUIZ),
})

export type GeneratedQuizQuestion = z.infer<typeof QuizQuestionSchema>

function buildGenerationPrompt(chunks: RetrievedChunk[], courseName: string): string {
  const contextBlock = chunks.length
    ? chunks
        .map((c, i) => `[${i + 1}] [Source File: ${c.fileName || "unknown"}]\nText: ${c.text}`)
        .join("\n\n")
    : "(אין חומר קורס זמין — בנה שאלות כלליות זהירות בנושא הקורס בלבד)"

  return [
    `אתה בונה מבחן תרגול קצר לקורס "${courseName}", מבוסס אך ורק על חומר הקורס המצורף למטה.`,
    `בנה בדיוק ${QUESTIONS_PER_QUIZ} שאלות: שילוב של שאלות אמריקאיות (type: "mcq", 4 אפשרויות בדיוק ב-choices, correctAnswer הוא הטקסט המדויק של האפשרות הנכונה) ושאלות פתוחות קצרות (type: "short", choices ריק, correctAnswer הוא תשובת הייחוס לבדיקה).`,
    "כל שאלה חייבת להיות מעוגנת בחומר שסופק — אל תמציא עובדות שאינן בחומר.",
    "לכל שאלה ציין topic קצר (2-4 מילים) המתאר את הנושא הספציפי שלה, לשימוש במעקב נושאים חלשים.",
    "",
    "חומר הקורס:",
    contextBlock,
  ].join("\n")
}

/** Generate a quiz grounded in the course's ingested material. */
export async function generateQuiz(args: {
  userId: string
  courseId: string
  courseName: string
}): Promise<GeneratedQuizQuestion[]> {
  assertEmbeddingEnv()
  assertLlmEnv()

  const { userId, courseId, courseName } = args
  const chunks = await retrieveContext({
    userId,
    courseId,
    query: courseName,
    topK: GENERATION_TOP_K,
  })

  const anthropic = getAnthropic()
  const message = await anthropic.messages.parse({
    model: CHAT_MODEL,
    max_tokens: GENERATION_MAX_TOKENS,
    messages: [{ role: "user", content: buildGenerationPrompt(chunks, courseName) }],
    output_config: { format: zodOutputFormat(QuizGenerationSchema) },
  })

  if (!message.parsed_output) {
    throw new Error("Quiz generation returned no parsed output")
  }
  return message.parsed_output.questions
}

const GradedAnswerSchema = z.object({
  questionId: z.string(),
  isCorrect: z.boolean(),
  score: z.number().min(0).max(1),
  feedback: z.string(),
})
const GradingResultSchema = z.object({ results: z.array(GradedAnswerSchema) })

export type GradedAnswer = z.infer<typeof GradedAnswerSchema>

export type ShortAnswerToGrade = {
  questionId: string
  questionText: string
  /** Reference answer from generation; not shown to the student. */
  referenceAnswer: string
  studentAnswer: string
}

function buildGradingPrompt(questions: ShortAnswerToGrade[]): string {
  const items = questions
    .map(
      (q, i) =>
        `שאלה ${i + 1} (questionId: "${q.questionId}"):\nשאלה: ${q.questionText}\nתשובת ייחוס: ${q.referenceAnswer}\nתשובת הסטודנט: ${q.studentAnswer || "(לא נענה)"}`
    )
    .join("\n\n")

  return [
    "אתה בודק תשובות פתוחות של סטודנט במבחן תרגול, מול תשובת הייחוס והחומר.",
    "לכל שאלה קבע: isCorrect (בוליאני), score בין 0 ל-1 (ציון חלקי — תשובה חלקית נכונה מקבלת ציון חלקי, לא 0 או 1 בלבד), ו-feedback קצר וממוקד המסביר מה חסר או מה לשפר — לא רק 'נכון'/'לא נכון'. אם התשובה כוללת חישוב מספרי, ודא את הדיוק שלו.",
    "החזר תוצאה לכל שאלה עם questionId התואם בדיוק למזהה שסופק.",
    "",
    items,
  ].join("\n")
}

/**
 * Grade a batch of short-answer questions in ONE Claude call (not one call
 * per question). Escalates to the hard path (adaptive thinking + hosted
 * code-execution tool) when any question looks computation-heavy, so a
 * numeric answer is verified rather than eyeballed.
 */
export async function gradeShortAnswers(
  questions: ShortAnswerToGrade[]
): Promise<GradedAnswer[]> {
  if (questions.length === 0) return []
  assertLlmEnv()

  const isHard = questions.some((q) => classifyComplexity(q.questionText) === "hard")
  const anthropic = getAnthropic()

  const message = await anthropic.messages.parse({
    model: isHard ? HARD_CHAT_MODEL : CHAT_MODEL,
    max_tokens: isHard ? GRADING_MAX_TOKENS_HARD : GRADING_MAX_TOKENS_SIMPLE,
    messages: [{ role: "user", content: buildGradingPrompt(questions) }],
    output_config: {
      format: zodOutputFormat(GradingResultSchema),
      ...(isHard ? { effort: "high" as const } : {}),
    },
    ...(isHard
      ? {
          thinking: { type: "adaptive" as const },
          tools: [{ type: "code_execution_20260521" as const, name: "code_execution" as const }],
        }
      : {}),
  })

  if (!message.parsed_output) {
    throw new Error("Grading returned no parsed output")
  }
  return message.parsed_output.results
}
