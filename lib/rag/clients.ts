import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { toSql } from "pgvector"

/**
 * Shared clients and constants for the RAG pipeline.
 *
 * Architecture (decoupled):
 *   - PostgreSQL/Neon (via Prisma) owns relational data: Users, Courses,
 *     Documents, ChatSession/ChatMessage history — AND the chunk embeddings
 *     themselves, via the pgvector extension (see DocumentChunk in
 *     prisma/schema.prisma, and lib/rag/ingest.ts / lib/rag/chat.ts for the
 *     raw SQL insert/query, since Prisma Client can't touch an
 *     Unsupported("vector(1536)") column directly).
 *
 * Clients are created lazily (on first use) so that importing this module
 * never throws when env vars are absent — important for `next build`, which
 * imports modules without runtime secrets.
 */

/** OpenAI embedding model. text-embedding-3-small returns 1536-dim vectors. */
export const EMBEDDING_MODEL = "text-embedding-3-small"
export const EMBEDDING_DIMENSIONS = 1536

/**
 * OpenAI speech-to-text model for lecture recording ingestion (see
 * lib/rag/transcribe.ts). Reuses the OpenAI client already wired in for
 * embeddings — no new vendor needed.
 */
export const TRANSCRIPTION_MODEL = "gpt-4o-transcribe"

/**
 * Anthropic chat model. claude-sonnet-4-6 is the current best speed/intelligence
 * balance and the documented replacement for the retired claude-3-5-sonnet — fast
 * enough for an interactive tutor while following the system prompt closely.
 */
export const CHAT_MODEL = "claude-sonnet-4-6"

/**
 * Escalation model for the "hard" path (see classifyComplexity in
 * lib/rag/chat.ts): adaptive thinking + code execution already buy most of
 * the accuracy improvement on hard math/EE/CS problems, but Opus is a
 * materially stronger reasoner than Sonnet on the genuinely hardest
 * problems. Only ever used on the low-volume hard path, so the extra cost
 * is bounded to exactly the turns that need it.
 */
export const HARD_CHAT_MODEL = "claude-opus-4-6"

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

/**
 * Format a raw embedding array as a Postgres `vector` literal for use in a
 * $queryRaw/$executeRaw parameter cast to `::vector` — e.g.
 * `sql\`... embedding <=> ${toVectorSql(v)}::vector ...\``. Tenant isolation
 * for every read/write is a plain `WHERE "userId" = ? AND "courseId" = ?` —
 * see retrieveContext() in chat.ts and ingestDocument() in ingest.ts.
 */
export function toVectorSql(embedding: number[]): string {
  return toSql(embedding) as string
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
 * Validate every key needed for embedding + vector storage. DATABASE_URL is
 * already required for Prisma to function at all (see lib/prisma.ts), so the
 * only RAG-specific key left to check here is the embedding API key.
 */
export function assertEmbeddingEnv(): void {
  requireEnv("OPENAI_API_KEY")
}

/** Validate the key needed for the chat LLM (Anthropic Claude). */
export function assertLlmEnv(): void {
  requireEnv("ANTHROPIC_API_KEY")
}
