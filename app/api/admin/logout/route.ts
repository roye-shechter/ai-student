import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth"

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(ADMIN_COOKIE_NAME)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/admin/logout failed:", error)
    return NextResponse.json({ error: "אירעה שגיאה. נסה שוב מאוחר יותר." }, { status: 500 })
  }
}
