import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { israelDayKey, recentDayKeys } from "@/lib/admin-time"

const DAY_RANGES = [7, 14, 30] as const
const DEFAULT_DAY_RANGE = 14
const DAY_MS = 24 * 60 * 60 * 1000
const TOP_USER_ROWS = 200
const RECENT_CALL_ROWS = 100
const SESSION_ROWS = 100

// recordActivity() (lib/learning-session.ts) stamps sessionEnd at the START
// of a chat turn, before the model call runs — so the ModelUsageEvent it
// produces (logged only once the call finishes, often 10-40s later) lands
// slightly AFTER sessionEnd, not inside [sessionStart, sessionEnd]. There's
// no direct FK between the two tables, so matching is done here by
// userId+courseId+time with a grace window either side — an estimate, same
// "coarse by design" spirit as LearningSession itself, not an exact ledger.
const SESSION_MATCH_BEFORE_MS = 60_000
const SESSION_MATCH_AFTER_MS = 5 * 60_000

/**
 * Per-model LLM usage and cost for the admin dashboard. Aggregates in the
 * database (groupBy) rather than loading every row, so it stays cheap as the
 * ModelUsageEvent table grows. `?days=7|14|30` picks the daily-cost range.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const requestedDays = Number(new URL(req.url).searchParams.get("days"))
  const days = (DAY_RANGES as readonly number[]).includes(requestedDays) ? requestedDays : DEFAULT_DAY_RANGE

  // One extra day of margin so the first Israel-time bucket is fully covered.
  const rangeSince = new Date(Date.now() - (days + 1) * DAY_MS)

  const [byModel, failuresByModel, fallbacksByModel, byRoute, perUser, rangeEvents, recentCalls, rangeSessions] = await Promise.all([
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
      where: { createdAt: { gte: rangeSince } },
      select: { userId: true, courseId: true, createdAt: true, costUsd: true },
    }),
    prisma.modelUsageEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_CALL_ROWS,
      select: {
        id: true,
        createdAt: true,
        provider: true,
        model: true,
        route: true,
        feature: true,
        inputTokens: true,
        outputTokens: true,
        costUsd: true,
        latencyMs: true,
        ok: true,
        fallbackFrom: true,
        user: { select: { username: true, fullName: true } },
      },
    }),
    prisma.learningSession.findMany({
      where: { sessionStart: { gte: rangeSince } },
      orderBy: { sessionStart: "desc" },
      take: SESSION_ROWS,
      select: {
        id: true,
        userId: true,
        courseId: true,
        sessionStart: true,
        sessionEnd: true,
        durationMinutes: true,
        activityType: true,
        course: { select: { courseCode: true, courseName: true } },
      },
    }),
  ])

  const failureMap = new Map(failuresByModel.map((f) => [f.model, f._count._all]))
  const fallbackMap = new Map(fallbacksByModel.map((f) => [f.model, f._count._all]))

  const userIds = [...new Set([...perUser.map((u) => u.userId), ...rangeSessions.map((s) => s.userId)])]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, fullName: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  // Day buckets are Israel calendar days, matching what the admin sees on the clock.
  const dayKeys = recentDayKeys(days)
  const dayBuckets = new Map(dayKeys.map((key) => [key, { costUsd: 0, calls: 0 }]))
  for (const event of rangeEvents) {
    const bucket = dayBuckets.get(israelDayKey(event.createdAt))
    if (bucket) {
      bucket.calls += 1
      bucket.costUsd += event.costUsd ?? 0
    }
  }

  // One session can span several chat turns (recordActivity merges activity
  // within a 30-minute window into the same row), so this approximates
  // "how much did this whole study session cost" — what the admin actually
  // asked to see, alongside the existing per-call and per-route totals.
  const sessionRows = rangeSessions.map((s) => {
    const start = s.sessionStart.getTime()
    const end = (s.sessionEnd ?? s.sessionStart).getTime()
    const matched = rangeEvents.filter(
      (e) =>
        e.userId === s.userId &&
        e.courseId === s.courseId &&
        e.createdAt.getTime() >= start - SESSION_MATCH_BEFORE_MS &&
        e.createdAt.getTime() <= end + SESSION_MATCH_AFTER_MS
    )
    return {
      id: s.id,
      userId: s.userId,
      username: userMap.get(s.userId)?.username ?? "—",
      fullName: userMap.get(s.userId)?.fullName ?? null,
      courseCode: s.course.courseCode,
      courseName: s.course.courseName,
      activityType: s.activityType,
      sessionStart: s.sessionStart.toISOString(),
      sessionEnd: (s.sessionEnd ?? s.sessionStart).toISOString(),
      durationMinutes: s.durationMinutes ?? 0,
      calls: matched.length,
      costUsd: matched.reduce((sum, e) => sum + (e.costUsd ?? 0), 0),
    }
  })

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
    days,
    totals: {
      calls: modelRows.reduce((sum, m) => sum + m.calls, 0),
      costUsd: modelRows.reduce((sum, m) => sum + m.costUsd, 0),
    },
    byModel: modelRows,
    byRoute: byRoute.map((r) => {
      const calls = r._count._all
      const costUsd = r._sum.costUsd ?? 0
      return { route: r.route, calls, costUsd, avgCostUsd: calls > 0 ? costUsd / calls : 0 }
    }),
    bySession: sessionRows,
    perUser: perUser.map((row) => ({
      userId: row.userId,
      username: userMap.get(row.userId)?.username ?? "—",
      fullName: userMap.get(row.userId)?.fullName ?? null,
      model: row.model,
      calls: row._count._all,
      costUsd: row._sum.costUsd ?? 0,
    })),
    dailyCost: [...dayBuckets.entries()].map(([date, v]) => ({ date, ...v })),
    recentCalls: recentCalls.map((c) => ({
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      user: c.user.fullName ?? c.user.username,
      provider: c.provider,
      model: c.model,
      route: c.route,
      feature: c.feature,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      costUsd: c.costUsd,
      latencyMs: c.latencyMs,
      ok: c.ok,
      fallbackFrom: c.fallbackFrom,
    })),
  })
}
