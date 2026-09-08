import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { dateOnlyToUTC, isExamDateType, isDateOnlyString } from "@/lib/exam-dates"

/**
 * Exam dates are course-level facts (מועד א / מועד ב / בוחן אמצע), shared by
 * every enrolled student — not per-user — matching how /api/courses/[courseId]/progress
 * treats "the course exists" as the only ownership check, since this app's
 * course catalog is shared rather than private per creator.
 */

export async function GET(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = await ctx.params
    const examDates = await prisma.examDate.findMany({
      where: { courseId },
      select: { id: true, type: true, date: true },
    })

    return NextResponse.json({ examDates })
  } catch (error) {
    console.error("[CRITICAL_ERROR] GET /api/courses/[courseId]/exam-dates failed:", error)
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Upsert a single slot ({type, date}). Pass date: null to clear it. */
export async function PUT(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { courseId } = await ctx.params
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } })
    if (!course) {
      return NextResponse.json({ error: "Unknown course" }, { status: 404 })
    }

    const body = (await req.json().catch(() => null)) as { type?: unknown; date?: unknown } | null
    if (!isExamDateType(body?.type)) {
      return NextResponse.json({ error: "Invalid exam type" }, { status: 400 })
    }
    const { type } = body

    if (body?.date === null) {
      await prisma.examDate.deleteMany({ where: { courseId, type } })
      return NextResponse.json({ type, date: null })
    }

    if (!isDateOnlyString(body?.date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }

    const examDate = await prisma.examDate.upsert({
      where: { courseId_type: { courseId, type } },
      update: { date: dateOnlyToUTC(body.date) },
      create: { courseId, type, date: dateOnlyToUTC(body.date) },
      select: { id: true, type: true, date: true },
    })

    return NextResponse.json({ examDate })
  } catch (error) {
    console.error("[CRITICAL_ERROR] PUT /api/courses/[courseId]/exam-dates failed:", error)
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
