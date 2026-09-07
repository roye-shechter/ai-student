import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Real progress analytics for the main dashboard — replaces the hardcoded
 * `barData`/`pieData` placeholders that shipped with the original chart
 * cards. Two pieces, both derived from data the app already writes:
 *   - weeklyHours: from LearningSession (see lib/learning-session.ts),
 *     summed per week for the last 5 weeks.
 *   - averageScore / attemptCount: from QuizAttempt.scorePercentage —
 *     the "understanding" proxy for the donut chart.
 * Both come back possibly empty (a brand-new account has neither) — the
 * client is expected to render an honest empty state rather than a fake
 * chart when attemptCount/total hours are zero.
 */

const WEEKS_BACK = 5
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const weekRanges = Array.from({ length: WEEKS_BACK }, (_, i) => {
      const weeksAgo = WEEKS_BACK - 1 - i
      const end = new Date(now.getTime() - weeksAgo * MS_PER_WEEK)
      const start = new Date(end.getTime() - MS_PER_WEEK)
      return { label: `שבוע ${i + 1}`, start, end }
    })

    const weeklyHours = await Promise.all(
      weekRanges.map(async ({ label, start, end }) => {
        const sessions = await prisma.learningSession.findMany({
          where: { userId, sessionStart: { gte: start, lt: end } },
          select: { durationMinutes: true },
        })
        const minutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)
        return { name: label, hours: Math.round((minutes / 60) * 10) / 10 }
      })
    )

    const scoreAgg = await prisma.quizAttempt.aggregate({
      where: { userId, scorePercentage: { not: null } },
      _avg: { scorePercentage: true },
      _count: { scorePercentage: true },
    })

    const weakTopicRows = await prisma.quizQuestion.findMany({
      where: { isCorrect: false, quizAttempt: { userId } },
      select: { topic: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    const topicCounts = new Map<string, number>()
    for (const row of weakTopicRows) {
      if (!row.topic) continue
      topicCounts.set(row.topic, (topicCounts.get(row.topic) ?? 0) + 1)
    }
    const weakTopics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }))

    return NextResponse.json({
      weeklyHours,
      averageScore: scoreAgg._avg.scorePercentage,
      attemptCount: scoreAgg._count.scorePercentage,
      weakTopics,
    })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/progress/summary failed:", error)
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
