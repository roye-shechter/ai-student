import { prisma } from "@/lib/prisma"
import {
  assertEmbeddingEnv,
  assertLlmEnv,
  CHAT_MODEL,
  EMBEDDING_MODEL,
  GEMINI_VERIFIER_MODEL,
  getOpenAI,
  toVectorSql,
} from "./clients"
import type { TokenUsage } from "@/lib/llm/pricing"
import {
  chooseRoute,
  FIRST_TOKEN_TIMEOUT_MS,
  ROUTE_FALLBACKS,
  ROUTE_LIMITS,
  ROUTE_TARGETS,
  type ModelTarget,
  type Route,
} from "@/lib/llm/route"
import { streamModel, type ImageInput } from "@/lib/llm/stream"
import { buildTutorSystem } from "@/lib/llm/tutor-prompt"
import { verifyAnswer, type Verdict } from "@/lib/llm/verify"
import { logModelUsage } from "@/lib/llm/usage"

/**
 * Retrieval + routed answer pipeline.
 *
 * 1. Embed the user query (OpenAI).
 * 2. Query document_chunks (pgvector) via cosine-distance ORDER BY, filtered strictly by
 *    { userId, courseId } so a tenant only ever sees their own chunks.
 * 3. Load recent ChatMessage history from Postgres (conversational memory).
 * 4. Pick the model for this turn (lib/llm/route.ts) and stream its answer.
 * 5. On hard/visual turns, a second model reviews the answer; a specific error
 *    is appended to the reply as a visible note.
 * 6. Persist the user + assistant turns and log per-model usage.
 */

const DEFAULT_TOP_K = 5
// Cap conversational memory at the last 15 turns: enough for the model to
// "remember" the immediate past and pick up where the student left off,
// without overflowing the context window with the entire session history.
const DEFAULT_HISTORY_LIMIT = 15
const MAX_OUTPUT_TOKENS_STANDARD = 4096
const MAX_OUTPUT_TOKENS_HARD = 8192

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

type ChunkRow = {
  documentId: string
  chunkIndex: number
  text: string
  fileName: string
  uploadedAt: Date
  score: number
}

/**
 * Retrieve the most relevant chunks for a query, rigidly scoped to the
 * tenant. `WHERE "userId" = ? AND "courseId" = ?` is the hard isolation
 * boundary (every DocumentChunk row carries both directly, see
 * prisma/schema.prisma) — an ANN search (pgvector HNSW index, cosine
 * distance) then ranks within that already-filtered set.
 */
export async function retrieveContext(args: {
  userId: string
  courseId: string
  query: string
  topK?: number
}): Promise<RetrievedChunk[]> {
  const { userId, courseId, query, topK = DEFAULT_TOP_K } = args
  const vector = await embedQuery(query)
  const vectorSql = toVectorSql(vector)

  const rows = await prisma.$queryRaw<ChunkRow[]>`
    SELECT "documentId", "chunkIndex", text, "fileName", "uploadedAt",
           1 - (embedding <=> ${vectorSql}::vector) AS score
    FROM document_chunks
    WHERE "userId" = ${userId} AND "courseId" = ${courseId}
    ORDER BY embedding <=> ${vectorSql}::vector
    LIMIT ${topK}
  `

  return rows.map((row) => ({
    text: row.text,
    score: row.score,
    documentId: row.documentId,
    chunkIndex: row.chunkIndex,
    fileName: row.fileName,
    uploadTimestamp: row.uploadedAt.getTime(),
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
  image?: ImageInput
  topK?: number
  historyLimit?: number
  /** Aborts the in-flight model call when the client disconnects (see chatStream). */
  signal?: AbortSignal
}

export type ChatStreamEvent =
  | { type: "sources"; chunks: RetrievedChunk[]; route: Route; model: string }
  | { type: "delta"; text: string }
  | { type: "done" }

/**
 * Full RAG turn, streamed: retrieve + route + answer + verify + persist,
 * yielding the answer token-by-token. `sessionId` must reference a ChatSession
 * that belongs to (userId, courseId).
 *
 * The user's turn is persisted immediately (before the model call), so history
 * survives even if the stream fails mid-flight. The assistant's turn is
 * persisted from whatever text accumulated by the time the loop exits,
 * successful or not — a partial answer beats a silently dropped one.
 */
export async function* chatStream(params: ChatParams): AsyncGenerator<ChatStreamEvent> {
  assertEmbeddingEnv()
  assertLlmEnv()

  const { userId, userName, courseId, sessionId, message, image, topK, historyLimit, signal } = params

  const route = chooseRoute(message, { hasImage: !!image })
  const limits = ROUTE_LIMITS[route]
  const [chunks, history, weakTopics] = await Promise.all([
    retrieveContext({ userId, courseId, query: message, topK: limits?.topK ?? topK }),
    getRecentHistory(sessionId, limits?.historyLimit ?? historyLimit),
    getWeakTopics(userId, courseId),
  ])

  const persistedMessage = image ? `${message}\n\n[צורפה תמונה]` : message
  await prisma.chatMessage.create({ data: { sessionId, role: "user", content: persistedMessage } })

  const target = ROUTE_TARGETS[route]
  yield { type: "sources", chunks, route, model: target.model }

  const system = buildTutorSystem(userName)
  const prompt = buildPrompt({ chunks, history, weakTopics, query: message })

  let answer = ""
  try {
    answer = yield* answerWithFallback({
      userId,
      courseId,
      route,
      target,
      system,
      prompt,
      image,
      signal,
    })

    if ((route === "hard" || route === "visual") && answer && !signal?.aborted) {
      const reviewer: ModelTarget =
        route === "hard" ? { provider: "gemini", model: GEMINI_VERIFIER_MODEL } : { provider: "anthropic", model: CHAT_MODEL }
      const started = Date.now()
      let verdict: Verdict | null = null
      try {
        const review = await verifyAnswer({
          target: reviewer,
          question: message,
          answer,
          context: chunks.map((c) => c.text).join("\n\n"),
          image: route === "visual" ? image : undefined,
          signal,
        })
        verdict = review.verdict
        await logModelUsage({
          userId,
          courseId,
          provider: reviewer.provider,
          model: reviewer.model,
          route: "verify",
          feature: "verify",
          usage: review.usage,
          latencyMs: Date.now() - started,
          ok: verdict !== null,
        })
      } catch (error) {
        console.error("[non-fatal] verifier failed; answer delivered unreviewed:", error)
        await logModelUsage({
          userId,
          courseId,
          provider: reviewer.provider,
          model: reviewer.model,
          route: "verify",
          feature: "verify",
          usage: null,
          latencyMs: Date.now() - started,
          ok: false,
        })
      }
      if (verdict && !verdict.ok) {
        const note = `\n\n---\n**נקודה לבדיקה נוספת:** ${verdict.issues}`
        answer += note
        yield { type: "delta", text: note }
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

/**
 * Streams the routed model's answer. If a provider fails before producing any
 * text (missing key, rate limit, outage, or no first token in time), the turn
 * moves to the next model in the chain: route fallbacks, then the standard
 * Claude path. Every attempt is logged; the original model is kept in
 * `fallbackFrom`. A failure after text has reached the student is not retried.
 */
async function* answerWithFallback(args: {
  userId: string
  courseId: string
  route: Route
  target: ModelTarget
  system: ReturnType<typeof buildTutorSystem>
  prompt: string
  image?: ImageInput
  signal?: AbortSignal
}): AsyncGenerator<ChatStreamEvent, string> {
  const { userId, courseId, route, system, prompt, image, signal } = args
  const chain = [args.target, ...ROUTE_FALLBACKS[route], ROUTE_TARGETS.standard].filter(
    (target, index, all) => all.findIndex((t) => t.model === target.model) === index
  )
  const primaryModel = args.target.model
  let text = ""

  for (const target of chain) {
    const fallbackFrom = target.model === primaryModel ? undefined : primaryModel
    const started = Date.now()
    let usage: TokenUsage | null = null
    const attempt = new AbortController()
    const onCallerAbort = () => attempt.abort()
    signal?.addEventListener("abort", onCallerAbort)
    const firstTokenTimeout = FIRST_TOKEN_TIMEOUT_MS[route]
    let timer: ReturnType<typeof setTimeout> | undefined
    const armTimer = () => {
      if (firstTokenTimeout !== undefined) {
        timer = setTimeout(() => attempt.abort(new Error("no first token in time")), firstTokenTimeout)
      }
    }
    armTimer()

    try {
      const verifiedMath = route === "hard" && target.provider === "anthropic"
      for await (const part of streamModel({
        target,
        system,
        userPrompt: prompt,
        image: target.provider === "groq" ? undefined : image,
        verifiedMath,
        maxOutputTokens: ROUTE_LIMITS[route]?.maxOutputTokens ?? (verifiedMath ? MAX_OUTPUT_TOKENS_HARD : MAX_OUTPUT_TOKENS_STANDARD),
        signal: attempt.signal,
      })) {
        if (part.type === "delta") {
          if (timer) clearTimeout(timer)
          text += part.text
          yield { type: "delta", text: part.text }
        } else {
          usage = part.usage
        }
      }
      await logModelUsage({
        userId,
        courseId,
        provider: target.provider,
        model: target.model,
        route,
        feature: "chat",
        usage,
        latencyMs: Date.now() - started,
        ok: true,
        fallbackFrom,
      })
      return text
    } catch (error) {
      await logModelUsage({
        userId,
        courseId,
        provider: target.provider,
        model: target.model,
        route,
        feature: "chat",
        usage,
        latencyMs: Date.now() - started,
        ok: false,
        fallbackFrom,
      })
      if (signal?.aborted || text.length > 0 || target === chain[chain.length - 1]) throw error
      console.error(`[routing] ${target.model} failed, trying next model:`, error instanceof Error ? error.message : error)
    } finally {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener("abort", onCallerAbort)
    }
  }
  return text
}
