import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { israelDayKey, recentDayKeys } from "@/lib/admin-time"

const ACTIVE_WINDOW_DAYS = 7
const CHART_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Everything the admin dashboard's main view needs in one call: account
 * totals, a per-user table (profile fields + aggregated usage, not raw
 * per-request logs — see ActivityEvent's doc comment), and a daily activity
 * chart for the last two weeks.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  // One extra day of margin so the first Israel-time bucket is fully covered.
  const chartSince = new Date(Date.now() - (CHART_DAYS + 1) * DAY_MS)

  const [users, courseCount, documentCount, activeEventUserIds, activeUsageUserIds, usageByUser, learningByUser, lastLogins, recentEvents] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          institution: true,
          degree: true,
          studyYear: true,
          age: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.course.count(),
      prisma.document.count(),
      prisma.activityEvent.findMany({
        where: { createdAt: { gte: activeSince } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      // Login/upload/course/quiz events cover the "did something notable"
      // signal; chat itself is only ever aggregated (UsageCounter), so a
      // user who only chatted this week wouldn't show up in ActivityEvent
      // at all — check that too so "active" isn't undercounted.
      prisma.usageCounter.findMany({
        where: { day: { gte: activeSince } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.usageCounter.groupBy({
        by: ["userId"],
        _sum: { chatCount: true, uploadCount: true, quizCount: true },
      }),
      prisma.learningSession.groupBy({
        by: ["userId"],
        _sum: { durationMinutes: true },
      }),
      // One row per user: their most recent login event (for the "last IP" column).
      prisma.activityEvent.findMany({
        where: { type: "login" },
        orderBy: { createdAt: "desc" },
        distinct: ["userId"],
        select: { userId: true, ip: true, userAgent: true, createdAt: true },
      }),
      prisma.activityEvent.findMany({
        where: { createdAt: { gte: chartSince } },
        select: { type: true, createdAt: true },
      }),
    ])

  const usageMap = new Map(usageByUser.map((u) => [u.userId, u._sum]))
  const learningMap = new Map(learningByUser.map((l) => [l.userId, l._sum.durationMinutes ?? 0]))
  const lastLoginMap = new Map(lastLogins.map((l) => [l.userId, l]))
  const activeSet = new Set([...activeEventUserIds.map((a) => a.userId), ...activeUsageUserIds.map((a) => a.userId)])

  const usersTable = users.map((u) => {
    const usage = usageMap.get(u.id)
    const lastLogin = lastLoginMap.get(u.id)
    return {
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      institution: u.institution,
      degree: u.degree,
      studyYear: u.studyYear,
      age: u.age,
      role: u.role,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      isActive7d: activeSet.has(u.id),
      totalRequests: (usage?.chatCount ?? 0) + (usage?.uploadCount ?? 0) + (usage?.quizCount ?? 0),
      requestBreakdown: { chat: usage?.chatCount ?? 0, upload: usage?.uploadCount ?? 0, quiz: usage?.quizCount ?? 0 },
      // LearningSession stores minutes; the admin table shows seconds.
      totalLearningSeconds: Math.round((learningMap.get(u.id) ?? 0) * 60),
      lastIp: lastLogin?.ip ?? null,
      lastUserAgent: lastLogin?.userAgent ?? null,
    }
  })

  // Bucket the last 14 days of events into per-day counts for the chart —
  // done in JS rather than a DB-side date_trunc so this stays portable. Days
  // are Israel calendar days (see lib/admin-time.ts), not UTC.
  const dayKeys = recentDayKeys(CHART_DAYS)
  const dayBuckets = new Map(dayKeys.map((key) => [key, 0]))
  for (const event of recentEvents) {
    const key = israelDayKey(event.createdAt)
    if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1)
  }
  const dailyActivity = [...dayBuckets.entries()].map(([date, count]) => ({ date, count }))

  return NextResponse.json({
    totals: {
      userCount: users.length,
      courseCount,
      documentCount,
      activeUsers7d: activeSet.size,
    },
    users: usersTable,
    dailyActivity,
  })
}
