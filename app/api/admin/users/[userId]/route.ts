import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

/** Profile plus lifetime totals for one user, shown in the admin user dialog. */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { userId } = await ctx.params
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
      createdAt: true,
      lastLoginAt: true,
    },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const [calls, costAgg, activityCount, learningAgg, usage, enrollmentCount] = await Promise.all([
    prisma.modelUsageEvent.count({ where: { userId } }),
    prisma.modelUsageEvent.aggregate({ where: { userId }, _sum: { costUsd: true } }),
    prisma.activityEvent.count({ where: { userId } }),
    prisma.learningSession.aggregate({ where: { userId }, _sum: { durationMinutes: true }, _count: { _all: true } }),
    prisma.usageCounter.aggregate({ where: { userId }, _sum: { chatCount: true, uploadCount: true, quizCount: true } }),
    prisma.enrollment.count({ where: { userId } }),
  ])

  return NextResponse.json({
    user,
    totals: {
      modelCalls: calls,
      costUsd: costAgg._sum.costUsd ?? 0,
      activityEvents: activityCount,
      learningSessions: learningAgg._count._all,
      learningSeconds: (learningAgg._sum.durationMinutes ?? 0) * 60,
      chatRequests: usage._sum.chatCount ?? 0,
      uploadRequests: usage._sum.uploadCount ?? 0,
      quizRequests: usage._sum.quizCount ?? 0,
      enrolledCourses: enrollmentCount,
    },
  })
}
