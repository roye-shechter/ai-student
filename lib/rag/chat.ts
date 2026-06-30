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
const MAX_OUTPUT_TOKENS = 4096

/**
 * Build the Claude system instruction for a persistent, active-learning
 * academic tutor. Establishes a warm "private tutor" persona (greeting the
 * student by name), and lays out four explicit policies:
 *
 *   A. Persistent memory  — treat the supplied history as the tutor's memory,
 *      never ask the student to repeat, pick up where the last turn left off.
 *   B. Knowledge policy    — prioritise the uploaded course material and cite
 *      filenames, but allow external knowledge for analogies, simpler
 *      explanations, and worked examples of hard EE/CS concepts.
 *   C. Smart-quiz policy   — don't quiz on every turn; only offer a mini-quiz
 *      after a complex topic is fully explained, on a topic transition, or on
 *      explicit request.
 *   D. Format & tone       — supportive academic tutor, rich structured
 *      Markdown, always answer in Hebrew, emit clean UTF-8 (no corrupted
 *      unicode) to avoid gibberish output.
 */
function buildSystemInstruction(userName: string): string {
  return [
    `אתה מורה פרטי אוניברסיטאי מומחה ללימודי הנדסת חשמל ומדעי המחשב (EE/CS), סבלני, מעודד ופעיל. שם הסטודנט הוא ${userName}.`,
    `בתחילת השיחה (כאשר עדיין אין היסטוריית שיחה) פתח תמיד בברכה אישית — לדוגמה: "שלום ${userName}," — ורק לאחר מכן ענה לגופו של עניין.`,
    "",
    "א. זיכרון מתמשך (Persistent Memory):",
    "- התייחס להיסטוריית השיחה המצורפת כאל הזיכרון שלך. אל תבקש מהסטודנט לחזור על דברים שכבר נאמרו.",
    "- הכר בהתקדמות הקודמת של הסטודנט והמשך בדיוק מהנקודה שבה הסתיימה ההודעה האחרונה.",
    "",
    "ב. מדיניות ידע (Knowledge Policy):",
    "- תן עדיפות עליונה לחומרי הלימוד שהועלו (Context). כאשר אתה מסתמך על חומר כזה — ציין את שם הקובץ.",
    "- מותר לך להשתמש בידע חיצוני שלך כדי לספק אנלוגיות, הסברים פשוטים יותר ודוגמאות למושגים מורכבים ב-EE/CS, גם אם אינם מופיעים בחומר.",
    "- כשאתה משלים מהידע הכללי שלך מעבר לחומר הקורס, ציין זאת בעדינות (לדוגמה: \"בנוסף לחומר, אפשר לחשוב על זה כך...\").",
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

/** Assemble retrieved context + history + the new question into one prompt. */
export function buildPrompt(args: {
  chunks: RetrievedChunk[]
  history: ChatTurn[]
  query: string
}): string {
  const { chunks, history, query } = args

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

  return [
    "חומרי הלימוד הרלוונטיים (Context):",
    contextBlock,
    "",
    "היסטוריית השיחה האחרונה:",
    historyBlock,
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
}

export type ChatReply = {
  answer: string
  chunks: RetrievedChunk[]
}

/**
 * Full RAG turn: retrieve + remember + answer + persist.
 * `sessionId` must reference a ChatSession that belongs to (userId, courseId).
 */
export async function chat(params: ChatParams): Promise<ChatReply> {
  // Fail fast with a precise message if any required key is missing
  // (OpenAI + Pinecone for retrieval, Anthropic for the answer).
  assertEmbeddingEnv()
  assertLlmEnv()

  const { userId, userName, courseId, sessionId, message, topK, historyLimit } = params

  const [chunks, history] = await Promise.all([
    retrieveContext({ userId, courseId, query: message, topK }),
    getRecentHistory(sessionId, historyLimit),
  ])

  // The retrieved context and recent history are folded into a single user
  // turn; the persona/grounding rules ride on the Claude system prompt.
  const prompt = buildPrompt({ chunks, history, query: message })

  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: buildSystemInstruction(userName),
    messages: [{ role: "user", content: prompt }],
  })

  const answer = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")

  await prisma.chatMessage.createMany({
    data: [
      { sessionId, role: "user", content: message },
      { sessionId, role: "assistant", content: answer },
    ],
  })

  return { answer, chunks }
}
