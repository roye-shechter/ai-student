/**
 * Temporary site-wide lock while actively working on the app — only this one
 * account can sign in or use the site; everyone else (new registrations
 * included) sees a "site under construction" message instead of reaching
 * the login/register form or the dashboard. Flip MAINTENANCE_MODE to false
 * to reopen the site to everyone again.
 *
 * Deliberately a plain, dependency-free module (no Prisma, no Node built-ins)
 * so it's safe to import from both server code (lib/auth.ts, proxy.ts) and
 * client components (the login/register pages) — the allowed username isn't
 * a secret, so there's no harm in it being visible client-side.
 */

export const MAINTENANCE_MODE = true
export const MAINTENANCE_ALLOWED_USERNAME = "yerahmiel"

/** True if this username may use the site right now (always true when maintenance mode is off). */
export function isMaintenanceAllowedUsername(username: string | null | undefined): boolean {
  if (!MAINTENANCE_MODE) return true
  return (username ?? "").trim().toLowerCase() === MAINTENANCE_ALLOWED_USERNAME.toLowerCase()
}

export const MAINTENANCE_MESSAGE =
  "האתר נמצא כרגע בעבודות תחזוקה ושדרוג. אנחנו עובדים על שיפורים ונחזור לפעילות מלאה בקרוב — תודה על הסבלנות."
