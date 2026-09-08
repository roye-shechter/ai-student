import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { ADMIN_COOKIE_NAME, COOKIE_MAX_AGE_SECONDS, isAdminId, checkAdminPasscode, signAdminCookie } from "@/lib/admin-auth"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { adminId?: unknown; password?: unknown } | null

  if (!isAdminId(body?.adminId)) {
    return NextResponse.json({ error: "Unknown admin" }, { status: 400 })
  }
  const password = typeof body?.password === "string" ? body.password : ""
  if (!checkAdminPasscode(password)) {
    return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE_NAME, signAdminCookie(body.adminId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })

  return NextResponse.json({ ok: true })
}
