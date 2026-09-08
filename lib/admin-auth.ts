import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

/**
 * A deliberately simple, separate gate for the personal admin dashboard
 * (app/admin) — NOT tied to the app's real user accounts/NextAuth session.
 * Pick a name, enter the shared passcode; the two are the site owner and
 * their one collaborator, not a general role system. The cookie is HMAC-
 * signed (using NEXTAUTH_SECRET, already present in every environment) so
 * it can't be forged by just setting a cookie value by hand, but this is
 * intentionally not bank-grade auth — it's a lightweight lock on a
 * low-stakes internal tool.
 */

export const ADMIN_PROFILES = [
  { id: "roye", name: "רועי שכטר" },
  { id: "yerahmiel", name: "ירחמיאל ליפשיץ" },
] as const

export type AdminId = (typeof ADMIN_PROFILES)[number]["id"]

export const ADMIN_COOKIE_NAME = "admin_auth"
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set")
  return secret
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex")
}

export function isAdminId(value: unknown): value is AdminId {
  return typeof value === "string" && ADMIN_PROFILES.some((p) => p.id === value)
}

export function checkAdminPasscode(input: string): boolean {
  const expected = process.env.ADMIN_PASSCODE || "777"
  // Constant-time-ish comparison for a short shared code; the real
  // protection here is just "don't leak the passcode", not entropy.
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function signAdminCookie(adminId: AdminId): string {
  const payload = `${adminId}.${Date.now()}`
  return `${payload}.${sign(payload)}`
}

/** Returns the admin profile the cookie authenticates as, or null if missing/invalid/expired. */
export function verifyAdminCookie(cookieValue: string | undefined): (typeof ADMIN_PROFILES)[number] | null {
  if (!cookieValue) return null
  const parts = cookieValue.split(".")
  if (parts.length !== 3) return null
  const [adminId, ts, signature] = parts
  const payload = `${adminId}.${ts}`
  if (sign(payload) !== signature) return null
  const issuedAt = Number(ts)
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > COOKIE_MAX_AGE_SECONDS * 1000) return null
  return ADMIN_PROFILES.find((p) => p.id === adminId) ?? null
}

export { COOKIE_MAX_AGE_SECONDS }

/** Reads+verifies the admin cookie for the current request. For use in admin API routes. */
export async function requireAdmin(): Promise<(typeof ADMIN_PROFILES)[number] | null> {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE_NAME)?.value)
}
