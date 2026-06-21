import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

// Validation schema
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().optional(),
})

/**
 * Duck-typed detector for a Prisma unique-constraint violation (P2002).
 * Checked by `code` rather than `instanceof` so it works regardless of how the
 * generated client re-exports its error classes. `meta.target` names the
 * field(s) that collided (e.g. ["email"]).
 */
function isUniqueConstraintError(
  error: unknown
): error is { code: "P2002"; meta?: { target?: string[] | string } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate input
    const validatedData = registerSchema.parse(body)
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username }
        ]
      }
    })
    
    if (existingUser) {
      if (existingUser.email === validatedData.email) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 400 }
        )
      }
      if (existingUser.username === validatedData.username) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 400 }
        )
      }
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 10)
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        username: validatedData.username,
        passwordHash: passwordHash,
        fullName: validatedData.fullName || null,
        role: "student",
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
      }
    })
    
    return NextResponse.json(
      { 
        message: "User registered successfully",
        user: user
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error("[CRITICAL_ERROR] Registration failed:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    // Unique-constraint race: the pre-check above passed but a concurrent
    // request inserted the same email/username first. Return the exact field
    // that collided instead of a generic message.
    if (isUniqueConstraintError(error)) {
      const target = error.meta?.target
      const fields = Array.isArray(target) ? target.join(",") : String(target ?? "")
      if (fields.includes("email")) {
        return NextResponse.json({ error: "Email already registered" }, { status: 400 })
      }
      if (fields.includes("username")) {
        return NextResponse.json({ error: "Username already taken" }, { status: 400 })
      }
      return NextResponse.json(
        { error: "An account with these details already exists" },
        { status: 400 }
      )
    }

    // Surface the actual error message rather than an opaque generic string.
    const message =
      error instanceof Error ? error.message : "Failed to register user"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
