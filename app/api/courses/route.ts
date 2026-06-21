import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { randomUUID } from "crypto"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// crypto.randomUUID needs the Node.js runtime (not edge).
export const runtime = "nodejs"

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
      credits: true,
      instructorName: true,
    },
  })

  return NextResponse.json({ courses })
}

const createCourseSchema = z.object({
  courseName: z.string().trim().min(1, "Course name is required").max(120),
  credits: z.coerce.number().min(0, "Credits cannot be negative").max(100).default(0),
})

/**
 * Slugify a (possibly Hebrew) course name into an ASCII-safe base for the
 * unique courseCode. Latin letters/digits are kept; everything else (Hebrew,
 * spaces, punctuation) becomes a hyphen. A short random suffix guarantees
 * uniqueness even when the slug base is empty (e.g. a purely Hebrew name).
 */
function buildCourseCode(courseName: string): string {
  const base = courseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
  const suffix = randomUUID().slice(0, 8)
  return base ? `${base}-${suffix}` : `course-${suffix}`
}

/**
 * Create a user-generated course and immediately enroll its creator.
 *
 * Wrapped in one try/catch so any failure (DB down, slug collision, etc.) is
 * returned as JSON rather than Next's default HTML error page.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let parsed: z.infer<typeof createCourseSchema>
    try {
      parsed = createCourseSchema.parse(await req.json())
    } catch (error) {
      const message =
        error instanceof z.ZodError ? error.issues[0].message : "Invalid request body"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { courseName, credits } = parsed

    // Sequential writes instead of an interactive ($transaction) transaction.
    // On a Neon serverless cold start the DB can take several seconds to wake
    // up, which blows past Prisma's transaction-start window and surfaces as
    // "Unable to start a transaction in the given time". Strict ACID isn't
    // critical for this flow, so we create the course then the enrollment as
    // independent calls. If the enrollment fails we best-effort delete the
    // course so we never leave an orphaned, un-enrolled row.
    const course = await prisma.course.create({
      data: {
        courseCode: buildCourseCode(courseName),
        courseName,
        credits,
        creatorId: userId,
        isActive: true,
      },
      select: {
        id: true,
        courseCode: true,
        courseName: true,
        description: true,
        credits: true,
      },
    })

    try {
      await prisma.enrollment.create({
        data: { userId, courseId: course.id, isActive: true },
      })
    } catch (enrollError) {
      console.error("[CRITICAL_ERROR] Enrollment after course creation failed:", enrollError)
      // Roll back the orphaned course (best effort — don't mask the real error).
      await prisma.course.delete({ where: { id: course.id } }).catch(() => {})
      throw enrollError
    }

    return NextResponse.json({ course }, { status: 201 })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/courses (POST) failed:", error)
    const message =
      error instanceof Error ? error.message : "Failed to create course"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
