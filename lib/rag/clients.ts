import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone"

/**
 * Shared clients and constants for the RAG pipeline.
 *
 * Architecture (decoupled):
 *   - PostgreSQL/Neon (via Prisma) owns relational data: Users, Courses,
 *     Documents, ChatSession/ChatMessage history.
 *   - Pinecone owns the document-chunk embeddings (the vector search layer).
 *
 * Clients are created lazily (on first use) so that importing this module
 * never throws when env vars are absent — important for `next build`, which
 * imports modules without runtime secrets.
 */

/** OpenAI embedding model. text-embedding-3-small returns 1536-dim vectors. */
export const EMBEDDING_MODEL = "text-embedding-3-small"
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Anthropic chat model. claude-sonnet-4-6 is the current best speed/intelligence
 * balance and the documented replacement for the retired claude-3-5-sonnet — fast
 * enough for an interactive tutor while following the system prompt closely.
 */
export const CHAT_MODEL = "claude-sonnet-4-6"

/**
 * Metadata stored on every Pinecone vector. `userId` + `courseId` are the
 * strict multi-tenancy keys: every vector carries them and every query filters
 * on them (see chat.ts) to prevent cross-tenant data leakage.
 *
 * Declared as a `type` (not `interface`) so it is assignable to Pinecone's
 * `RecordMetadata` (Record<string, string | number | boolean | string[]>).
 */
export type ChunkMetadata = {
  userId: string
  courseId: string
  documentId: string
  chunkIndex: number
  text: string
  /** Original upload filename, so the AI can answer "based on the file X" queries. */
  fileName: string
  /** Upload time as epoch milliseconds, so the AI can reason about upload order. */
  uploadTimestamp: number
}

let _openai: OpenAI | null = null
export function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set")
    _openai = new OpenAI({ apiKey })
  }
  return _openai
}

let _anthropic: Anthropic | null = null
export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set")
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

let _pinecone: Pinecone | null = null
export function getPinecone(): Pinecone {
  if (!_pinecone) {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error("PINECONE_API_KEY is not set")
    _pinecone = new Pinecone({ apiKey })
  }
  return _pinecone
}

/** The Pinecone index, typed with our chunk metadata. */
export function getIndex() {
  const indexName = process.env.PINECONE_INDEX
  if (!indexName) throw new Error("PINECONE_INDEX is not set")
  return getPinecone().index<ChunkMetadata>(indexName)
}

/**
 * Pinecone namespace for a course. Namespacing by course partitions vectors at
 * scale; userId+courseId metadata filtering (below) is what enforces tenancy.
 */
export function namespaceForCourse(courseId: string): string {
  return `course-${courseId}`
}

/** Strict metadata filter enforcing per-user, per-course isolation. */
export function tenantFilter(userId: string, courseId: string) {
  return { userId: { $eq: userId }, courseId: { $eq: courseId } }
}

// =====================================================
// Environment validation
// =====================================================

/**
 * Return the value of a required environment variable, or throw a clear,
 * catchable error naming exactly which key is missing. Treats empty/whitespace
 * values as missing.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Validate every key needed for embedding + vector storage (OpenAI + Pinecone).
 * Call at the start of any ingestion/retrieval path so a missing key fails
 * fast with a precise message instead of an opaque downstream error.
 */
export function assertEmbeddingEnv(): void {
  requireEnv("OPENAI_API_KEY")
  requireEnv("PINECONE_API_KEY")
  requireEnv("PINECONE_INDEX")
}

/** Validate the key needed for the chat LLM (Anthropic Claude). */
export function assertLlmEnv(): void {
  requireEnv("ANTHROPIC_API_KEY")
}
