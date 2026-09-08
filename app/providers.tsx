"use client"

import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  // refetchOnWindowFocus (NextAuth's default) re-checks /api/auth/session on
  // every tab focus. If that refetch is ever interrupted (dev-server route
  // recompilation, a flaky connection) next-auth's client updates `status`
  // straight from "authenticated" to "unauthenticated" — and
  // DashboardLayout redirects to /login on the spot, even though the
  // session cookie itself is still perfectly valid server-side. Disabling
  // it removes that entire class of spurious bounce; session state still
  // refreshes on normal navigation.
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>
}
