import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"

export async function GET() {
  try {
    const admin = await requireAdmin()
    return NextResponse.json({ admin: admin ? { id: admin.id, name: admin.name } : null })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/admin/session failed:", error)
    return NextResponse.json({ error: "אירעה שגיאה. נסה שוב מאוחר יותר." }, { status: 500 })
  }
}
