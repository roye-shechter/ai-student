import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** Current user's profile + onboarding status (read live from Postgres). */
export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      institution: true,
      degree: true,
      studyYear: true,
      age: true,
      onboardingCompleted: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(user)
}

const updateProfileSchema = z.object({
  institution: z.string().trim().min(1, "Institution is required"),
  degree: z.string().trim().min(1, "Degree is required"),
  studyYear: z.string().trim().min(1, "Study year is required"),
  age: z.coerce.number().int().min(14, "Age must be at least 14").max(120, "Invalid age"),
})

/** Edit the profile fields collected during onboarding — the "הגדרות פרופיל" dialog. */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let parsed: z.infer<typeof updateProfileSchema>
    try {
      parsed = updateProfileSchema.parse(await req.json())
    } catch (error) {
      const message =
        error instanceof z.ZodError ? error.issues[0].message : "Invalid request body"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: parsed,
      select: {
        id: true,
        username: true,
        fullName: true,
        institution: true,
        degree: true,
        studyYear: true,
        age: true,
        onboardingCompleted: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("[CRITICAL_ERROR] PATCH /api/me failed:", error)
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
