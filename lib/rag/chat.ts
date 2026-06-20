import { GoogleGenerativeAI } from "@google/generative-ai"
import { prisma } from "@/lib/prisma"
import {
  assertEmbeddingEnv,
  assertLlmEnv,
  EMBEDDING_MODEL,
  getIndex,
  getOpenAI,
  namespaceForCourse,
  requireEnv,
  tenantFilter,
} from "./clients"

/**
 * Retrieval + chat pipeline.
 *
 * 1. Embed the user query (OpenAI).
 * 2. Query Pinecone for the course namespace, filtered strictly by
 *    { userId, courseId } so a tenant only ever sees their own chunks.
 * 3. Load recent ChatMessage history from Postgres (conversational memory).
 * 4. Assemble a structured prompt and answer with the LLM (Gemini).
 * 5. Persist the user + assistant turns back to Postgres.
 */

const DEFAULT_TOP_K = 5
const DEFAULT_HISTORY_LIMIT = 10
const LLM_MODEL = "gemini-2.5-flash"

const SYSTEM_INSTRUCTION =
  "אתה עוזר הוראה אקדמי קפדן ודייקן. ענה על שאלת הסטודנט אך ורק על בסיס קטעי " +
  "חומרי הלימוד (Context) והיסטוריית השיחה המצורפים. אם התשובה אינה נמצאת באופן " +
  "מפורש או משתמע ישירות מהחומר המצורף, ענה במילים האלו בדיוק: " +
  "'המידע אינו מופיע בחומרי הלימוד של הקורס'. אל תמציא עובדות ואל תשתמש בידע חיצוני."

export type RetrievedChunk = {
  text: string
  score: number
  documentId: string
  chunkIndex: number
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

  const contextBlock = chunks.length
    ? chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n")
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
  // (OpenAI + Pinecone for retrieval, Gemini for the answer).
  assertEmbeddingEnv()
  assertLlmEnv()

  const { userId, courseId, sessionId, message, topK, historyLimit } = params

  const [chunks, history] = await Promise.all([
    retrieveContext({ userId, courseId, query: message, topK }),
    getRecentHistory(sessionId, historyLimit),
  ])

  const prompt = buildPrompt({ chunks, history, query: message })

  const genAI = new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"))
  const model = genAI.getGenerativeModel({
    model: LLM_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  })
  const result = await model.generateContent(prompt)
  const answer = result.response.text()

  await prisma.chatMessage.createMany({
    data: [
      { sessionId, role: "user", content: message },
      { sessionId, role: "assistant", content: answer },
    ],
  })

  return { answer, chunks }
}
