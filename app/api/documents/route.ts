import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Historical uploads for the logged-in user in a given course, plus the
 * course's display metadata. Strictly scoped to { userId, courseId } so a
 * user only ever sees their own documents.
 *
 * Query: /api/documents?courseCode=matap1  (or ?courseId=...)
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const courseCode = searchParams.get("courseCode") ?? undefined
  const courseId = searchParams.get("courseId") ?? undefined

  const course = courseId
    ? await prisma.course.findUnique({ where: { id: courseId } })
    : courseCode
      ? await prisma.course.findUnique({ where: { courseCode } })
      : null

  if (!course) {
    return NextResponse.json({ error: "Unknown course" }, { status: 404 })
  }

  const documents = await prisma.document.findMany({
    where: { userId, courseId: course.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileType: true,
      chunkCount: true,
      status: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    course: {
      id: course.id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      description: course.description,
    },
    documents,
  })
}
