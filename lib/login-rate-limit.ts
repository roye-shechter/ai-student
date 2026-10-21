import { prisma } from "@/lib/prisma"

/**
 * Brute-force protection for the credentials login form. No existing
 * mechanism covered this: UsageCounter (lib/rate-limit.ts) only guards paid
 * endpoints and needs a known userId, which a guessing attack by definition
 * doesn't have. Keyed by client IP rather than the attempted username, since
 * a real attacker enumerates usernames from one IP — blocking by username
 * alone would do nothing.
 */

const WINDOW_MINUTES = 15
const MAX_FAILED_ATTEMPTS = 10
// Retention only needs to outlive the window; prune probabilistically on
// write so this stays bounded without a cron job (same pattern as
// lib/activity-log.ts).
const RETENTION_MINUTES = 60
const PRUNE_PROBABILITY = 0.05

/**
 * True if this IP has too many recent failed attempts to allow another try.
 * Fails open (never blocks) on a DB error — a bug or outage in the rate
 * limiter itself must never become a way to lock every student out of the
 * app; the worst case is simply no brute-force protection until it recovers.
 */
export async function isLoginBlocked(ip: string): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000)
    const count = await prisma.loginAttempt.count({
      where: { ip, createdAt: { gte: windowStart } },
    })
    return count >= MAX_FAILED_ATTEMPTS
  } catch (error) {
    console.error("[login-rate-limit] failed to check attempts (failing open):", error)
    return false
  }
}

/** Record one failed login attempt. Call only after a real credential check fails. */
export async function recordFailedLogin(ip: string): Promise<void> {
  try {
    await prisma.loginAttempt.create({ data: { ip } })
    if (Math.random() < PRUNE_PROBABILITY) {
      const cutoff = new Date(Date.now() - RETENTION_MINUTES * 60_000)
      await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
    }
  } catch (error) {
    // Never let rate-limit bookkeeping break the login flow itself.
    console.error("[login-rate-limit] failed to record attempt:", error)
  }
}
