/**
 * Time helpers for the admin panel. Every day bucket and timestamp the admin
 * sees is in Israel time: a call at 01:30 on the 7th belongs to the 7th here,
 * not the 6th as it would when bucketed by UTC. Pure functions, so both the
 * API routes and the client components can import them.
 */
export const ADMIN_TIME_ZONE = "Asia/Jerusalem"

const DAY_MS = 24 * 60 * 60 * 1000

/** "YYYY-MM-DD" for the calendar day (Israel time) that contains `date`. */
export function israelDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Day keys for the last `days` calendar days (Israel time), oldest first, ending today. */
export function recentDayKeys(days: number, now: Date = new Date()): string[] {
  return Array.from({ length: days }, (_, i) => israelDayKey(new Date(now.getTime() - (days - 1 - i) * DAY_MS)))
}

/** Short day label for chart axes, e.g. "7 באוק׳". */
export function formatDayLabel(dayKey: string): string {
  // Noon UTC is the same calendar day in Israel, so the key can't slip a day.
  return new Intl.DateTimeFormat("he-IL", { timeZone: ADMIN_TIME_ZONE, day: "numeric", month: "short" }).format(
    new Date(`${dayKey}T12:00:00Z`)
  )
}

/** Full day label for tables, e.g. "7 באוקטובר 2026". */
export function formatDayLong(dayKey: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: ADMIN_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dayKey}T12:00:00Z`))
}

/**
 * Dollar-to-shekel rate for the cost figures. Providers bill in USD, so the
 * panel converts at this fixed rate. Update it when the shekel moves enough
 * to matter; the cost numbers are estimates either way.
 */
export const USD_TO_ILS = 3.7

/** Cost in shekels, e.g. "₪0.55". Pass null when the call had no token usage. */
export function formatIls(usd: number | null): string {
  if (usd === null) return "—"
  const ils = usd * USD_TO_ILS
  if (ils === 0) return "₪0"
  return ils < 0.01 ? `₪${ils.toFixed(4)}` : `₪${ils.toFixed(2)}`
}

/** Exact timestamp down to the second, e.g. "7 באוק׳ 2026, 14:03:27". */
export function formatDateTimeSeconds(value: Date | string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: ADMIN_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

export const ROUTE_LABELS: Record<string, string> = {
  standard: "שיחה רגילה",
  hard: "מתמטיקה / הנדסה קשה",
  visual: "שאלה עם תמונה",
  quick: "שאלה קצרה",
  verify: "בדיקה נוספת",
  quiz: "מבחנים",
}

export const ACTIVITY_LABELS: Record<string, string> = {
  login: "התחברות",
  course_created: "יצירת קורס",
  document_uploaded: "העלאת מסמך",
  quiz_completed: "השלמת מבחן תרגול",
}

/** Token counts in K/M, e.g. "12.5K". */
export function formatTokens(value: number): string {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value)
}

/** Duration in seconds, e.g. "95 שניות". */
export function formatSeconds(value: number | null): string {
  if (value === null) return "—"
  return `${value.toLocaleString("he-IL")} שניות`
}
