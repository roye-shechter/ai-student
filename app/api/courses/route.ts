import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** All active courses available to enroll in (for the onboarding picker). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const courses = await prisma.course.findMany({
    where: { isActive: true },
    orderBy: { courseCode: "asc" },
    select: {
      id: true,
      courseCode: true,
      courseName: true,
      description: true,
      instructorName: true,
    },
  })

  return NextResponse.json({ courses })
}
