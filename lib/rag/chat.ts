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
const DEFAULT_HISTORY_LIMIT = 10
const MAX_OUTPUT_TOKENS = 4096

/**
 * Build the Claude system instruction. Establishes a warm "private tutor"
 * persona (greeting the student by name), enforces strict Markdown formatting
 * so answers never come back as one unreadable wall of text, teaches the model
 * to use the per-chunk source metadata (file name + upload time) so it can
 * answer file-specific or chronological-order questions, and — critically —
 * preserves the hard RAG grounding rule: only answer from the supplied course
 * material, never from outside knowledge.
 */
function buildSystemInstruction(userName: string): string {
  return [
    `אתה מורה פרטי אוניברסיטאי מומחה, סבלני ומעודד. שם הסטודנט הוא ${userName}.`,
    `בתחילת השיחה (כאשר עדיין אין היסטוריית שיחה) פתח תמיד בברכה אישית — לדוגמה: "שלום ${userName}," — ורק לאחר מכן ענה לגופו של עניין.`,
    "",
    "כללי בסיס (קפדניים — אסור לחרוג מהם):",
    "- ענה אך ורק על בסיס קטעי חומרי הלימוד (Context) והיסטוריית השיחה המצורפים. אל תמציא עובדות ואל תשתמש בידע חיצוני.",
    "- אם התשובה אינה מופיעה במפורש או אינה נובעת ישירות מהחומר המצורף, ענה במילים האלו בדיוק: 'המידע אינו מופיע בחומרי הלימוד של הקורס'.",
    "- ענה תמיד בעברית.",
    "",
    "מטא-דאטה של מקורות (חשוב):",
    "- כל קטע בהקשר (Context) מסומן בשורת מקור בפורמט [Source File: שם הקובץ, Uploaded At: זמן ההעלאה] ואחריה הטקסט עצמו.",
    "- הסטודנט עשוי לשאול שאלות על קובץ מסוים (לדוגמה: \"על בסיס הקובץ 'math_summary.pdf'...\") או לבקש לעבור על החומר לפי סדר ההעלאה הכרונולוגי.",
    "- השתמש בשדות [Source File] ו-[Uploaded At] כדי לענות על בקשות כאלה בדייקנות, ולפי סדר זמני העלאה כשמתבקש. ציין את שם הקובץ בתשובה כאשר הדבר מסייע.",
    "",
    "כללי עיצוב (חובה):",
    "- לעולם אל תחזיר 'קיר טקסט' ארוך ורציף.",
    "- חובה להשתמש בעיצוב Markdown עשיר: חלק את התשובה לפסקאות קצרות, השתמש ברשימות תבליטים (bullet points) לרשימות, הדגש מונחים ומושגי מפתח ב-**הדגשה**, והשתמש בכותרות היררכיות ברורות (## / ###).",
    "- ארגן תשובות ארוכות בסעיפים עם כותרות, כך שיהיה קל לקרוא ולסרוק אותן.",
    "- שמור על טון מעודד, ידידותי וברור, כיאה למורה פרטי תומך.",
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
