import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const onboardingSchema = z.object({
  institution: z.string().trim().min(1, "Institution is required"),
  studyYear: z.string().trim().min(1, "Study year is required"),
})

/**
 * Complete user onboarding: save the institution + year of study and flip
 * onboardingCompleted to true. Courses are no longer chosen here — users
 * create their own custom courses from the dashboard after onboarding.
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

    const { institution, studyYear } = parsed

    await prisma.user.update({
      where: { id: userId },
      data: { institution, studyYear, onboardingCompleted: true },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/onboarding failed:", error)
    const message =
      error instanceof Error ? error.message : "Failed to complete onboarding"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
