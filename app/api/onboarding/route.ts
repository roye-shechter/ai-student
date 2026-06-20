import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const onboardingSchema = z.object({
  institution: z.string().trim().min(1, "Institution is required"),
  courseIds: z.array(z.string()).min(1, "Select at least one course"),
})

/**
 * Complete user onboarding: save the institution, enroll the user in the
 * selected courses, and flip onboardingCompleted to true — all in one
 * transaction so the user is never left half-onboarded.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parsed: z.infer<typeof onboardingSchema>
  try {
    parsed = onboardingSchema.parse(await req.json())
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0].message : "Invalid request body"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { institution, courseIds } = parsed

  // Only enroll into courses that actually exist and are active.
  const validCourses = await prisma.course.findMany({
    where: { id: { in: courseIds }, isActive: true },
    select: { id: true },
  })

  if (validCourses.length === 0) {
    return NextResponse.json({ error: "No valid courses selected" }, { status: 400 })
  }

  await prisma.$transaction([
    ...validCourses.map((course) =>
      prisma.enrollment.upsert({
        where: { userId_courseId: { userId, courseId: course.id } },
        update: { isActive: true },
        create: { userId, courseId: course.id, isActive: true },
      })
    ),
    prisma.user.update({
      where: { id: userId },
      data: { institution, onboardingCompleted: true },
    }),
  ])

  return NextResponse.json({ ok: true, enrolled: validCourses.length })
}
