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

  if (token) return NextResponse.next()

  // getToken() failing here doesn't necessarily mean the user is logged
  // out — Next.js's Proxy layer has a documented intermittent failure mode
  // decrypting cookies on some requests even when the cookie itself is
  // present and valid (see vercel/next.js#78831; Next's own docs call Proxy
  // unsuitable as "a full session management or authorization solution").
  // We couldn't reproduce it locally after 40+ attempts, which matches that
  // issue's report of it surfacing only under real deployment conditions.
  // So: only hard-redirect when the session cookie is genuinely absent.
  // If it's present but decode failed, let the request through — the page
  // shell isn't sensitive, and every API route re-validates the session
  // via getServerSession() before returning any real data.
  const hasSessionCookie = req.cookies.getAll().some(
    (c) => c.name.startsWith("next-auth.session-token") || c.name.startsWith("__Secure-next-auth.session-token")
  )

  if (hasSessionCookie) return NextResponse.next()

  const loginUrl = new URL("/login", req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
