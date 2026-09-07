import type Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import {
  assertEmbeddingEnv,
  assertLlmEnv,
  CHAT_MODEL,
  EMBEDDING_MODEL,
  getAnthropic,
  getIndex,
  getOpenAI,
  HARD_CHAT_MODEL,
  namespaceForCourse,
  tenantFilter,
} from "./clients"

/**
 * Retrieval + chat pipeline.
 *
 * 1. Embed the user query (OpenAI).
 * 2. Query Pinecone for the course namespace, filtered strictly by
 *    { userId, courseId } so a tenant only ever sees their own chunks.
 * 3. Load recent ChatMessage history from Postgres (conversational memory).
 * 4. Assemble a structured prompt and answer with the LLM (Anthropic Claude).
 * 5. Persist the user + assistant turns back to Postgres.
 */

const DEFAULT_TOP_K = 5
// Cap conversational memory at the last 15 turns: enough for the model to
// "remember" the immediate past and pick up where the student left off,
// without overflowing the context window with the entire session history.
const DEFAULT_HISTORY_LIMIT = 15
// The "hard" path spends extra tokens on thinking + code-execution tool
// turns before it ever writes the answer, so it gets a larger cap than the
// fast conversational path.
const MAX_OUTPUT_TOKENS_SIMPLE = 4096
const MAX_OUTPUT_TOKENS_HARD = 8192

/**
 * Cheap, local heuristic that decides whether a message needs the "hard"
 * path (extended thinking + a code-execution tool for verified math) or the
 * fast conversational path. Intentionally NOT an extra LLM call — that would
 * add exactly the latency this is meant to avoid. Biased towards "simple":
 * a false negative just means a slightly less rigorous answer, a false
 * positive costs latency, so ambiguous cases default to fast.
 */
const HARD_MATH_SYMBOLS = /[∫∑∂√≈±×÷]|\\frac|\\int|\\sum|\\sqrt|\bd\/dx\b/i
const HARD_TASK_VERBS =
  /(חשב|פתור|הוכח|גזור|נגזרת|אינטגרל|מטריצ|משוואה|אופטימיזצי|מעגל חשמלי|נוסחה)/
const OPERATOR_CHARS = /[+\-*/=^]/g
const DIGIT_CHARS = /[0-9]/g

export function classifyComplexity(message: string): "simple" | "hard" {
  if (HARD_MATH_SYMBOLS.test(message) || HARD_TASK_VERBS.test(message)) {
    return "hard"
  }
  const digitCount = (message.match(DIGIT_CHARS) ?? []).length
  const operatorCount = (message.match(OPERATOR_CHARS) ?? []).length
  const density = message.length > 0 ? (digitCount + operatorCount) / message.length : 0
  if (digitCount >= 3 && density > 0.15) {
    return "hard"
  }
  return "simple"
}

/**
 * Build the Claude system instruction for a persistent, active-learning
 * academic tutor, split into two blocks so the (large, per-user-identical)
 * policy text can be prompt-cached across every user and every turn:
 *
 *   1. A static block — the persona and policies A-D below — marked with an
 *      ephemeral cache breakpoint. Byte-identical for every request, so it
 *      must never have the student's name (or anything else request-specific)
 *      interpolated into it; that would break the cache-prefix match.
 *   2. A small dynamic block with just the student's name.
 *
 * Policies:
 *   A. Persistent memory  — treat the supplied history as the tutor's memory,
 *      never ask the student to repeat, pick up where the last turn left off.
 *   B. Knowledge policy    — prioritise the uploaded course material and cite
 *      filenames, but allow external knowledge for analogies, simpler
 *      explanations, and worked examples of hard EE/CS concepts; verify any
 *      numeric/symbolic computation with the code-execution tool when one is
 *      available, instead of computing "by hand".
 *   C. Smart-quiz policy   — don't quiz on every turn; only offer a mini-quiz
 *      after a complex topic is fully explained, on a topic transition, or on
 *      explicit request.
 *   D. Format & tone       — supportive academic tutor, rich structured
 *      Markdown, always answer in Hebrew, emit clean UTF-8 (no corrupted
 *      unicode) to avoid gibberish output.
 */
function buildSystemInstruction(userName: string): Anthropic.TextBlockParam[] {
  const staticPolicy = [
    "אתה מורה פרטי אוניברסיטאי מומחה ללימודי הנדסת חשמל ומדעי המחשב (EE/CS), סבלני, מעודד ופעיל.",
    "",
    "א. זיכרון מתמשך (Persistent Memory):",
    "- התייחס להיסטוריית השיחה המצורפת כאל הזיכרון שלך. אל תבקש מהסטודנט לחזור על דברים שכבר נאמרו.",
    "- הכר בהתקדמות הקודמת של הסטודנט והמשך בדיוק מהנקודה שבה הסתיימה ההודעה האחרונה.",
    "",
    "ב. מדיניות ידע (Knowledge Policy):",
    "- תן עדיפות עליונה לחומרי הלימוד שהועלו (Context). כאשר אתה מסתמך על חומר כזה — ציין את שם הקובץ.",
    "- מותר לך להשתמש בידע חיצוני שלך כדי לספק אנלוגיות, הסברים פשוטים יותר ודוגמאות למושגים מורכבים ב-EE/CS, גם אם אינם מופיעים בחומר.",
    "- כשאתה משלים מהידע הכללי שלך מעבר לחומר הקורס, ציין זאת בעדינות (לדוגמה: \"בנוסף לחומר, אפשר לחשוב על זה כך...\").",
    "- כאשר עומד לרשותך כלי הרצת קוד (code execution) — השתמש בו כדי לאמת כל חישוב מספרי או סימבולי (חשבון, אלגברה, אינטגרלים, נגזרות, מטריצות וכו') במקום לחשב \"בעל פה\". אל תציג תוצאת חישוב מדויקת מבלי לוודא אותה דרך הכלי כשהוא זמין.",
    "",
    "מטא-דאטה של מקורות (חשוב):",
    "- כל קטע בהקשר (Context) מסומן בשורת מקור בפורמט [Source File: שם הקובץ, Uploaded At: זמן ההעלאה] ואחריה הטקסט עצמו.",
    "- הסטודנט עשוי לשאול שאלות על קובץ מסוים (לדוגמה: \"על בסיס הקובץ 'math_summary.pdf'...\") או לבקש לעבור על החומר לפי סדר ההעלאה הכרונולוגי.",
    "- השתמש בשדות [Source File] ו-[Uploaded At] כדי לענות על בקשות כאלה בדייקנות, ולפי סדר זמני העלאה כשמתבקש. ציין את שם הקובץ בתשובה כאשר הדבר מסייע.",
    "",
    "ג. מדיניות תרגול חכמה (Smart Quiz):",
    "- אל תבחן את הסטודנט בכל הודעה.",
    "- הצע שאלת תרגול קצרה (mini-quiz) או אתגר רק כאשר נושא מורכב הוסבר במלואו, בעת מעבר לנושא חדש, או כאשר הסטודנט מבקש זאת במפורש.",
    "",
    "ד. עיצוב, טון וקידוד (חובה):",
    "- טון של מורה פרטי תומך ואקדמי: מעודד, ידידותי וברור.",
    "- לעולם אל תחזיר 'קיר טקסט' ארוך ורציף. חובה להשתמש בעיצוב Markdown עשיר: פסקאות קצרות, רשימות תבליטים (bullet points), הדגשת מונחי מפתח ב-**הדגשה**, וכותרות היררכיות ברורות (## / ###).",
    "- ארגן תשובות ארוכות בסעיפים עם כותרות, כך שיהיה קל לקרוא ולסרוק אותן.",
    "- ענה אך ורק בעברית.",
    "- ודא שהפלט שלך משתמש בתווי עברית תקניים ב-UTF-8 ובסימנים מתמטיים סטנדרטיים. הימנע מפורמט יוניקוד פגום או מתווים משובשים.",
  ].join("\n")

  const personalGreeting = [
    `שם הסטודנט הוא ${userName}.`,
    `בתחילת השיחה (כאשר עדיין אין היסטוריית שיחה) פתח תמיד בברכה אישית — לדוגמה: "שלום ${userName}," — ורק לאחר מכן ענה לגופו של עניין.`,
  ].join("\n")

  return [
    { type: "text", text: staticPolicy, cache_control: { type: "ephemeral" } },
    { type: "text", text: personalGreeting },
  ]
}

export type RetrievedChunk = {
  text: string
  score: number
  documentId: string
  chunkIndex: number
  fileName: string
  uploadTimestamp: number
}

export type ChatTurn = {
  role: string
  content: string
}

/** Embed a single query string. */
async function embedQuery(query: string): Promise<number[]> {
  const openai = getOpenAI()
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: query })
  return res.data[0].embedding
}

/**
 * Retrieve the most relevant chunks for a query, rigidly scoped to the tenant.
 * The course namespace partitions the data; the metadata filter is the hard
 * isolation boundary.
 */
export async function retrieveContext(args: {
  userId: string
  courseId: string
  query: string
  topK?: number
}): Promise<RetrievedChunk[]> {
  const { userId, courseId, query, topK = DEFAULT_TOP_K } = args
  const vector = await embedQuery(query)

  const index = getIndex().namespace(namespaceForCourse(courseId))
  const result = await index.query({
    topK,
    vector,
    includeMetadata: true,
    filter: tenantFilter(userId, courseId),
  })

  return result.matches.map((match) => ({
    text: match.metadata?.text ?? "",
    score: match.score ?? 0,
    documentId: match.metadata?.documentId ?? "",
    chunkIndex: match.metadata?.chunkIndex ?? 0,
    fileName: match.metadata?.fileName ?? "",
    uploadTimestamp: match.metadata?.uploadTimestamp ?? 0,
  }))
}

/** Recent conversational history for a chat session, oldest-first. */
export async function getRecentHistory(
  sessionId: string,
  limit = DEFAULT_HISTORY_LIMIT
): Promise<ChatTurn[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { role: true, content: true },
  })
  return messages.reverse()
}

const WEAK_TOPICS_LIMIT = 5

/**
 * Topics the student has gotten wrong in past quiz attempts on this course
 * (see lib/rag/quiz.ts) — this is the whole "understanding verification"
 * feedback loop: no separate recommendation engine, just surfacing quiz
 * misses back into the tutor's context so it can proactively revisit them.
 */
async function getWeakTopics(userId: string, courseId: string): Promise<string[]> {
  const rows = await prisma.quizQuestion.findMany({
    where: { isCorrect: false, quizAttempt: { userId, courseId } },
    select: { topic: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  const topics = rows.map((r) => r.topic).filter((t): t is string => !!t && t.trim() !== "")
  return Array.from(new Set(topics)).slice(0, WEAK_TOPICS_LIMIT)
}

/** Assemble retrieved context + history + weak topics + the new question into one prompt. */
export function buildPrompt(args: {
  chunks: RetrievedChunk[]
  history: ChatTurn[]
  weakTopics?: string[]
  query: string
}): string {
  const { chunks, history, weakTopics = [], query } = args

  // Prefix every chunk with its source metadata so the model can answer
  // file-specific questions and reason about chronological upload order.
  const contextBlock = chunks.length
    ? chunks
        .map((c, i) => {
          const fileName = c.fileName || "unknown"
          const uploadedAt = c.uploadTimestamp
            ? new Date(c.uploadTimestamp).toISOString()
            : "unknown"
          return `[${i + 1}] [Source File: ${fileName}, Uploaded At: ${uploadedAt}]\nText: ${c.text}`
        })
        .join("\n\n")
    : "(לא נמצאו קטעים רלוונטיים)"

  const historyBlock = history.length
    ? history.map((m) => `${m.role === "assistant" ? "עוזר" : "סטודנט"}: ${m.content}`).join("\n")
    : "(אין היסטוריית שיחה)"

  const weakTopicsBlock = weakTopics.length
    ? [
        "",
        "נושאים חלשים שזוהו במבחני תרגול קודמים של הסטודנט בקורס זה:",
        weakTopics.map((t) => `- ${t}`).join("\n"),
        "אם רלוונטי לשאלה הנוכחית, התייחס אליהם ביוזמתך (למשל בהערה קצרה או בדוגמה נוספת) — אך אל תסטה מנושא השאלה.",
      ].join("\n")
    : ""

  return [
    "חומרי הלימוד הרלוונטיים (Context):",
    contextBlock,
    "",
    "היסטוריית השיחה האחרונה:",
    historyBlock,
    weakTopicsBlock,
    "",
    "שאלת הסטודנט הנוכחית:",
    query,
  ].join("\n")
}

export type ChatParams = {
  userId: string
  userName: string
  courseId: string
  sessionId: string
  message: string
  topK?: number
  historyLimit?: number
  /** Aborts the in-flight Anthropic call when the client disconnects (see chatStream). */
  signal?: AbortSignal
}

export type ChatStreamEvent =
  | { type: "sources"; chunks: RetrievedChunk[] }
  | { type: "delta"; text: string }
  | { type: "done" }

/**
 * Full RAG turn, streamed: retrieve + remember + answer + persist, yielding
 * the answer token-by-token instead of waiting for the full response —
 * important for long, richly-formatted Hebrew answers. `sessionId` must
 * reference a ChatSession that belongs to (userId, courseId).
 *
 * The user's turn is persisted immediately (before the LLM call), so history
 * survives even if the stream fails mid-flight. The assistant's turn is
 * persisted from whatever text accumulated by the time the loop exits,
 * successful or not — a partial answer beats a silently dropped one.
 */
export async function* chatStream(params: ChatParams): AsyncGenerator<ChatStreamEvent> {
  assertEmbeddingEnv()
  assertLlmEnv()

  const { userId, userName, courseId, sessionId, message, topK, historyLimit, signal } = params

  const [chunks, history, weakTopics] = await Promise.all([
    retrieveContext({ userId, courseId, query: message, topK }),
    getRecentHistory(sessionId, historyLimit),
    getWeakTopics(userId, courseId),
  ])

  await prisma.chatMessage.create({ data: { sessionId, role: "user", content: message } })

  yield { type: "sources", chunks }

  const prompt = buildPrompt({ chunks, history, weakTopics, query: message })
  const anthropic = getAnthropic()

  // Route by complexity: the fast path is the current default (no thinking,
  // no tools), the hard path spends extra latency on adaptive extended
  // thinking + a hosted code-execution tool so numeric/symbolic answers are
  // verified rather than guessed. See classifyComplexity() above.
  const isHard = classifyComplexity(message) === "hard"

  const stream = anthropic.messages.stream(
    {
      model: isHard ? HARD_CHAT_MODEL : CHAT_MODEL,
      max_tokens: isHard ? MAX_OUTPUT_TOKENS_HARD : MAX_OUTPUT_TOKENS_SIMPLE,
      system: buildSystemInstruction(userName),
      messages: [{ role: "user", content: prompt }],
      ...(isHard
        ? {
            thinking: { type: "adaptive" as const },
            output_config: { effort: "high" as const },
            tools: [{ type: "code_execution_20260521" as const, name: "code_execution" as const }],
          }
        : {}),
    },
    { signal }
  )

  let answer = ""
  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        answer += event.delta.text
        yield { type: "delta", text: event.delta.text }
      }
    }
  } finally {
    // Persist whatever accumulated even on abort (signal fired) or error — a
    // partial answer beats a silently dropped one.
    if (answer) {
      await prisma.chatMessage.create({ data: { sessionId, role: "assistant", content: answer } })
    }
  }

  yield { type: "done" }
}
