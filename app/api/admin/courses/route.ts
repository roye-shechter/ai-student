import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

/**
 * Every course in the catalog, with enrollment/document counts — the admin
 * dashboard previously had no way to see the course list at all, only
 * individual students' enrollments one at a time via the user dialog.
 */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        courseCode: true,
        courseName: true,
        description: true,
        isActive: true,
        createdAt: true,
        creator: { select: { username: true, fullName: true } },
        _count: { select: { enrollments: true, documents: true } },
      },
    })

    return NextResponse.json({
      courses: courses.map((c) => ({
        id: c.id,
        courseCode: c.courseCode,
        courseName: c.courseName,
        description: c.description,
        isActive: c.isActive,
        createdAt: c.createdAt,
        creatorName: c.creator?.fullName ?? c.creator?.username ?? null,
        enrollmentCount: c._count.enrollments,
        documentCount: c._count.documents,
      })),
    })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/admin/courses failed:", error)
    return NextResponse.json({ error: "אירעה שגיאה בטעינת הקורסים. נסה שוב מאוחר יותר." }, { status: 500 })
  }
}
