/** Shared vocabulary for the three exam-date slots a course can have. */
export const EXAM_DATE_TYPES = ["midterm", "final_a", "final_b"] as const
export type ExamDateType = (typeof EXAM_DATE_TYPES)[number]

export const EXAM_DATE_LABELS: Record<ExamDateType, string> = {
  midterm: "בוחן אמצע",
  final_a: "מועד א",
  final_b: "מועד ב",
}

export function isExamDateType(value: unknown): value is ExamDateType {
  return typeof value === "string" && (EXAM_DATE_TYPES as readonly string[]).includes(value)
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateOnlyString(value: unknown): value is string {
  return typeof value === "string" && DATE_ONLY_RE.test(value)
}

/**
 * Exam dates are plain calendar dates, not moments in time — every
 * conversion below anchors to UTC midnight and reads back with UTC
 * getters, so the same "YYYY-MM-DD" the user picked is what every viewer
 * sees again, regardless of their own timezone offset.
 */
export function dateOnlyToUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
]

export function formatDateOnlyHebrew(date: Date): string {
  return `${date.getUTCDate()} ב${HEBREW_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}
