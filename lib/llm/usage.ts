import { prisma } from "@/lib/prisma"
import { computeCostUsd, type TokenUsage } from "./pricing"
import type { Route } from "./route"

export type UsageRecord = {
  userId: string
  courseId?: string
  provider: string
  model: string
  route: Route | "verify" | "quiz"
  feature: "chat" | "verify" | "quiz_generate" | "quiz_grade"
  usage: TokenUsage | null
  latencyMs: number
  ok: boolean
  fallbackFrom?: string
}

/**
 * Persists one row per model call for the admin cost analytics. Never throws:
 * a logging failure must not break the student's answer.
 */
export async function logModelUsage(record: UsageRecord): Promise<void> {
  try {
    await prisma.modelUsageEvent.create({
      data: {
        userId: record.userId,
        courseId: record.courseId ?? null,
        provider: record.provider,
        model: record.model,
        route: record.route,
        feature: record.feature,
        inputTokens: record.usage?.inputTokens ?? 0,
        outputTokens: record.usage?.outputTokens ?? 0,
        cacheReadTokens: record.usage?.cacheReadTokens ?? 0,
        cacheWriteTokens: record.usage?.cacheWriteTokens ?? 0,
        costUsd: record.usage ? computeCostUsd(record.model, record.usage) : null,
        latencyMs: record.latencyMs,
        ok: record.ok,
        fallbackFrom: record.fallbackFrom ?? null,
      },
    })
  } catch (error) {
    console.error("[non-fatal] logModelUsage failed:", error)
  }
}
