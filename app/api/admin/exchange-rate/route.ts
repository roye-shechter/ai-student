import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getUsdToIlsRate } from "@/lib/exchange-rate"

/** The current USD→ILS rate the admin panel's cost figures are converted
 * at — see lib/exchange-rate.ts for the source and caching. */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const usdToIls = await getUsdToIlsRate()
    return NextResponse.json({ usdToIls })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/admin/exchange-rate failed:", error)
    return NextResponse.json({ error: "אירעה שגיאה. נסה שוב מאוחר יותר." }, { status: 500 })
  }
}
