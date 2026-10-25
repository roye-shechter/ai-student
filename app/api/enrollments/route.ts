import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** The active user's enrolled courses (drives the dynamic dashboard grid). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { userId, isActive: true },
      orderBy: { enrolledAt: "asc" },
      select: {
        completionPercentage: true,
        course: {
          select: {
            id: true,
            courseCode: true,
            courseName: true,
            description: true,
            credits: true,
          },
        },
      },
    })

    return NextResponse.json({ enrollments })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/enrollments failed:", error)
    return NextResponse.json({ error: "אירעה שגיאה בטעינת הקורסים. נסה שוב מאוחר יותר." }, { status: 500 })
  }
}
