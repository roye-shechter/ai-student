import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const CHART_DAYS = 14
const TOP_USER_ROWS = 200

/**
 * Per-model LLM usage and cost for the admin dashboard. Aggregates in the
 * database (groupBy) rather than loading every row, so it stays cheap as the
 * ModelUsageEvent table grows.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const chartSince = new Date(Date.now() - CHART_DAYS * 24 * 60 * 60 * 1000)

  const [byModel, failuresByModel, fallbacksByModel, byRoute, perUser, recentDaily] = await Promise.all([
    prisma.modelUsageEvent.groupBy({
      by: ["provider", "model"],
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, costUsd: true },
      _avg: { latencyMs: true },
      orderBy: { _sum: { costUsd: "desc" } },
    }),
    prisma.modelUsageEvent.groupBy({
      by: ["model"],
      where: { ok: false },
      _count: { _all: true },
    }),
    prisma.modelUsageEvent.groupBy({
      by: ["model"],
      where: { fallbackFrom: { not: null } },
      _count: { _all: true },
    }),
    prisma.modelUsageEvent.groupBy({
      by: ["route"],
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    prisma.modelUsageEvent.groupBy({
      by: ["userId", "model"],
      _count: { _all: true },
      _sum: { costUsd: true },
      orderBy: { _sum: { costUsd: "desc" } },
      take: TOP_USER_ROWS,
    }),
    prisma.modelUsageEvent.findMany({
      where: { createdAt: { gte: chartSince } },
      select: { createdAt: true, costUsd: true },
    }),
  ])

  const failureMap = new Map(failuresByModel.map((f) => [f.model, f._count._all]))
  const fallbackMap = new Map(fallbacksByModel.map((f) => [f.model, f._count._all]))

  const userIds = [...new Set(perUser.map((u) => u.userId))]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, fullName: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const dayBuckets = new Map<string, { costUsd: number; calls: number }>()
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    dayBuckets.set(d.toISOString().slice(0, 10), { costUsd: 0, calls: 0 })
  }
  for (const event of recentDaily) {
    const bucket = dayBuckets.get(event.createdAt.toISOString().slice(0, 10))
    if (bucket) {
      bucket.calls += 1
      bucket.costUsd += event.costUsd ?? 0
    }
  }

  const modelRows = byModel.map((m) => ({
    provider: m.provider,
    model: m.model,
    calls: m._count._all,
    inputTokens: m._sum.inputTokens ?? 0,
    outputTokens: m._sum.outputTokens ?? 0,
    cacheReadTokens: m._sum.cacheReadTokens ?? 0,
    costUsd: m._sum.costUsd ?? 0,
    avgLatencyMs: Math.round(m._avg.latencyMs ?? 0),
    failures: failureMap.get(m.model) ?? 0,
    fallbacks: fallbackMap.get(m.model) ?? 0,
  }))

  return NextResponse.json({
    totals: {
      calls: modelRows.reduce((sum, m) => sum + m.calls, 0),
      costUsd: modelRows.reduce((sum, m) => sum + m.costUsd, 0),
    },
    byModel: modelRows,
    byRoute: byRoute.map((r) => ({ route: r.route, calls: r._count._all, costUsd: r._sum.costUsd ?? 0 })),
    perUser: perUser.map((row) => ({
      userId: row.userId,
      username: userMap.get(row.userId)?.username ?? "—",
      fullName: userMap.get(row.userId)?.fullName ?? null,
      model: row.model,
      calls: row._count._all,
      costUsd: row._sum.costUsd ?? 0,
    })),
    dailyCost: [...dayBuckets.entries()].map(([date, v]) => ({ date, ...v })),
  })
}
