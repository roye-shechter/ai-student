import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

/**
 * Server-side auth gate for /dashboard. Complements (does not replace) the
 * client-side useSession() check in app/dashboard/layout.tsx, which only
 * prevents a UI "flash" — this is the actual security boundary, since without
 * it an unauthenticated request could still receive the dashboard page shell.
 * API routes already check getServerSession individually, so data access was
 * never at risk; this closes the page-route gap.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy` — this file
 * intentionally uses the current convention rather than the deprecated one.
 */
export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    const loginUrl = new URL("/login", req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
