import { prisma } from "@/lib/prisma"

/**
 * Coarse per-user daily quotas on the LLM/embedding-backed endpoints
 * (/api/chat, /api/upload). Without this, one user's script loop (or a
 * malicious actor) has unbounded spend exposure against the owner's
 * OpenAI/Anthropic API keys — see UsageCounter in schema.prisma.
 *
 * This is intentionally coarse (daily granularity via a single upsert+increment,
 * not a sliding window) — sufficient to bound worst-case cost for a solo dev
 * without new infra. If sub-day burst abuse becomes a real problem, that's the
 * signal to introduce a proper rate limiter (e.g. Upstash Redis).
 */

export type UsageKind = "chat" | "upload" | "quiz"

export class RateLimitExceededError extends Error {
  constructor(public readonly kind: UsageKind, public readonly limit: number) {
    super(`Daily ${kind} limit reached (${limit}/day). Try again tomorrow.`)
    this.name = "RateLimitExceededError"
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const COUNTER_FIELD: Record<UsageKind, "chatCount" | "uploadCount" | "quizCount"> = {
  chat: "chatCount",
  upload: "uploadCount",
  quiz: "quizCount",
}
const ENV_KEY: Record<UsageKind, string> = {
  chat: "DAILY_CHAT_LIMIT",
  upload: "DAILY_UPLOAD_LIMIT",
  quiz: "DAILY_QUIZ_LIMIT",
}
const DEFAULT_LIMIT: Record<UsageKind, number> = {
  chat: 50,
  upload: 10,
  quiz: 10,
}

function limitFor(kind: UsageKind): number {
  const raw = process.env[ENV_KEY[kind]]
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT[kind]
}

/**
 * Atomically increments today's counter for `kind` and throws
 * RateLimitExceededError if that pushes the user over their daily cap.
 * Call this after authentication, before doing any paid API call.
 */
export async function assertUnderDailyLimit(userId: string, kind: UsageKind): Promise<void> {
  const limit = limitFor(kind)
  const day = startOfUtcDay(new Date())
  const field = COUNTER_FIELD[kind]

  const counter = await prisma.usageCounter.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, [field]: 1 },
    update: { [field]: { increment: 1 } },
  })

  if (counter[field] > limit) {
    throw new RateLimitExceededError(kind, limit)
  }
}
