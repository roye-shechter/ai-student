import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Every exam date across every course the current user is enrolled in —
 * powers the main dashboard's calendar (app/dashboard/page.tsx). Scoped by
 * Enrollment, not by ExamDate ownership (there isn't any — exam dates are
 * course-level, see app/api/courses/[courseId]/exam-dates/route.ts), so a
 * student only sees dates for courses they've actually joined.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { userId, isActive: true },
      select: {
        course: {
          select: {
            id: true,
            courseCode: true,
            courseName: true,
            examDates: { select: { id: true, type: true, date: true } },
          },
        },
      },
    })

    const examDates = enrollments
      .flatMap(({ course }) =>
        course.examDates.map((ed) => ({
          id: ed.id,
          type: ed.type,
          date: ed.date,
          course: { id: course.id, courseCode: course.courseCode, courseName: course.courseName },
        }))
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    return NextResponse.json({ examDates })
  } catch (error) {
    console.error("[CRITICAL_ERROR] GET /api/exam-dates failed:", error)
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
