import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const ACTIVITY_TYPES = ["login", "course_created", "document_uploaded", "quiz_completed"] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

// Keeps the table bounded on a free-tier DB instead of growing forever —
// see the ActivityEvent model's doc comment in prisma/schema.prisma.
const RETENTION_DAYS = 90
// Don't run a DELETE on every single insert — only occasionally, so the
// extra round trip stays rare while still keeping the table pruned.
const PRUNE_PROBABILITY = 0.05

/**
 * Log one coarse activity milestone (never per-chat-message — see
 * ACTIVITY_TYPES) for the admin dashboard (app/admin). Best-effort: a
 * logging failure must never break the request that triggered it.
 */
export async function logActivity(params: {
  userId: string
  type: ActivityType
  ip?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        userId: params.userId,
        type: params.type,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    })

    if (Math.random() < PRUNE_PROBABILITY) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
      await prisma.activityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
    }
  } catch (error) {
    console.error("[activity-log] failed to record event:", error)
  }
}

/** Extracts the client IP from a Vercel/Node request's headers, if present. */
export function extractIp(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined
    const v = headers[name] ?? headers[name.toLowerCase()]
    return Array.isArray(v) ? v[0] : v
  }
  const forwardedFor = get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return get("x-real-ip") ?? null
}

export function extractUserAgent(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  if (headers instanceof Headers) return headers.get("user-agent")
  const v = headers["user-agent"] ?? headers["User-Agent"]
  return (Array.isArray(v) ? v[0] : v) ?? null
}
