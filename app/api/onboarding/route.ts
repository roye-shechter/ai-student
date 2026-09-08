import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const onboardingSchema = z.object({
  institution: z.string().trim().min(1, "Institution is required"),
  degree: z.string().trim().min(1, "Degree is required"),
  studyYear: z.string().trim().min(1, "Study year is required"),
  age: z.coerce.number().int().min(14, "Age must be at least 14").max(120, "Invalid age"),
})

/**
 * Complete user onboarding: save the institution, degree, year of study and
 * age, then flip onboardingCompleted to true. Courses are no longer chosen
 * here — users create their own custom courses from the dashboard after
 * onboarding.
 */
export async function POST(req: Request) {
  try {
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

    const { institution, degree, studyYear, age } = parsed

    await prisma.user.update({
      where: { id: userId },
      data: { institution, degree, studyYear, age, onboardingCompleted: true },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/onboarding failed:", error)
    const message =
      error instanceof Error ? error.message : "Failed to complete onboarding"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
