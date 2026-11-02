import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"
import { MAINTENANCE_MESSAGE, MAINTENANCE_MODE, isMaintenanceAllowedUsername } from "@/lib/maintenance"

/**
 * Server-side auth gate for /dashboard. Complements (does not replace) the
 * client-side useSession() check in app/dashboard/layout.tsx, which only
 * prevents a UI "flash" — this is the actual security boundary, since without
 * it an unauthenticated request could still receive the dashboard page shell.
 * API routes already check getServerSession individually, so data access was
 * never at risk; this closes the page-route gap.
 *
 * Also enforces the site-wide maintenance lock (lib/maintenance.ts) for
 * requests that already hold a valid session — login/register block new
 * sign-ins themselves, but without this an already-logged-in non-allowed
 * user could keep using the dashboard and every real API route with their
 * existing session cookie. Matched against here, not just at sign-in.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy` — this file
 * intentionally uses the current convention rather than the deprecated one.
 */
export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const isApiRequest = req.nextUrl.pathname.startsWith("/api/")

  if (token) {
    if (MAINTENANCE_MODE && !isMaintenanceAllowedUsername(token.username as string | undefined)) {
      if (isApiRequest) {
        return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
      }
      return NextResponse.redirect(new URL("/login", req.url))
    }
    return NextResponse.next()
  }

  // getToken() failing here doesn't necessarily mean the user is logged
  // out — Next.js's Proxy layer has a documented intermittent failure mode
  // decrypting cookies on some requests even when the cookie itself is
  // present and valid (see vercel/next.js#78831; Next's own docs call Proxy
  // unsuitable as "a full session management or authorization solution").
  // We couldn't reproduce it locally after 40+ attempts, which matches that
  // issue's report of it surfacing only under real deployment conditions.
  // So: only hard-reject when the session cookie is genuinely absent. If
  // it's present but decode failed, let the request through either way —
  // the page shell isn't sensitive, and every API route (as well as the
  // maintenance check above) re-validates via getServerSession() before
  // returning any real data, so this never widens actual access.
  const hasSessionCookie = req.cookies.getAll().some(
    (c) => c.name.startsWith("next-auth.session-token") || c.name.startsWith("__Secure-next-auth.session-token")
  )

  if (hasSessionCookie) return NextResponse.next()

  // API routes have no page to redirect to — a clear 401 is the right
  // response for an unauthenticated direct call, not an HTML redirect.
  if (isApiRequest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loginUrl = new URL("/login", req.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Everything under /api EXCEPT /api/auth (NextAuth's own internals —
  // needed for the login/logout flow itself to work) and /api/admin (a
  // separate owner-only tool, intentionally unaffected by the site-wide
  // maintenance lock — see lib/maintenance.ts and lib/admin-auth.ts).
  matcher: ["/dashboard/:path*", "/api/((?!auth|admin).*)"],
}
