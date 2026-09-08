import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Per-course progress analytics — same shape/logic as the old
 * app/api/progress/summary/route.ts (now removed), just every query scoped
 * by courseId too, so a student sees one course's learning data at a time
 * instead of an account-wide rollup. Both pieces come from data the app
 * already writes:
 *   - weeklyHours: from LearningSession (lib/learning-session.ts), summed
 *     per week for the last 5 weeks, filtered to this course.
 *   - averageScore / attemptCount: from QuizAttempt.scorePercentage for
 *     this course — the "understanding" proxy for the donut chart.
 * Both come back possibly empty (no data yet for this course) — the client
 * renders an honest empty state rather than a fake chart.
 */

const WEEKS_BACK = 5
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export async function GET(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = await ctx.params
    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) {
      return NextResponse.json({ error: "Unknown course" }, { status: 404 })
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
          where: { userId, courseId, sessionStart: { gte: start, lt: end } },
          select: { durationMinutes: true },
        })
        const minutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)
        return { name: label, hours: Math.round((minutes / 60) * 10) / 10 }
      })
    )

    const scoreAgg = await prisma.quizAttempt.aggregate({
      where: { userId, courseId, scorePercentage: { not: null } },
      _avg: { scorePercentage: true },
      _count: { scorePercentage: true },
    })

    const weakTopicRows = await prisma.quizQuestion.findMany({
      where: { isCorrect: false, quizAttempt: { userId, courseId } },
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
      courseName: course.courseName,
      weeklyHours,
      averageScore: scoreAgg._avg.scorePercentage,
      attemptCount: scoreAgg._count.scorePercentage,
      weakTopics,
    })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/courses/[courseId]/progress failed:", error)
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
