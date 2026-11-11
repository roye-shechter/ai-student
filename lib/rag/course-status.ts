import { prisma } from "@/lib/prisma"
import { ADMIN_TIME_ZONE, israelDayKey } from "@/lib/admin-time"
import {
  EXAM_DATE_LABELS,
  dateOnlyToUTC,
  formatDateOnlyHebrew,
  isExamDateType,
  type ExamDateType,
} from "@/lib/exam-dates"

const DAY_MS = 24 * 60 * 60 * 1000
const APPROACHING_DAYS = 14
const RECENT_ATTEMPTS_LIMIT = 3
const NO_QUIZ_NUDGE_AFTER_DAYS = 10
const LOW_SCORE_THRESHOLD = 70

/**
 * One block of plain-Hebrew text describing where the student actually
 * stands in this course right now — today's date, this course's exam dates
 * (lib/exam-dates.ts), and recent practice-quiz history (QuizAttempt) — so
 * the tutor can act on real state ("exam in 5 days", "never took a quiz",
 * "last quiz was 61%") instead of only ever reacting to the message in
 * front of it. Two small indexed queries (ExamDate has at most 3 rows per
 * course; QuizAttempt is capped to the last few) — negligible next to the
 * embedding + vector retrieval already done on every turn.
 *
 * Skipped entirely on the "quick" route (see lib/llm/route.ts) — that route
 * exists specifically to stay under Groq's free-tier tokens-per-minute cap
 * for short definitional questions, and course status is both token cost
 * and context the model doesn't need to answer "what's Ohm's law".
 */
export async function getCourseStatusBlock(
  userId: string,
  courseId: string,
  now: Date = new Date()
): Promise<string> {
  const todayUTC = dateOnlyToUTC(israelDayKey(now))
  const todayLabel = new Intl.DateTimeFormat("he-IL", {
    timeZone: ADMIN_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now)

  const [examDates, recentAttempts] = await Promise.all([
    prisma.examDate.findMany({ where: { courseId }, orderBy: { date: "asc" } }),
    prisma.quizAttempt.findMany({
      where: { userId, courseId },
      orderBy: { attemptedAt: "desc" },
      take: RECENT_ATTEMPTS_LIMIT,
      select: { quizTitle: true, scorePercentage: true, attemptedAt: true },
    }),
  ])

  const lines: string[] = ["", "סטטוס הסטודנט בקורס הנוכחי (עדכני לרגע זה):", `- היום: ${todayLabel}.`]

  const upcoming = examDates
    .filter((e) => isExamDateType(e.type))
    .map((e) => ({
      label: EXAM_DATE_LABELS[e.type as ExamDateType],
      date: e.date,
      diffDays: Math.round((e.date.getTime() - todayUTC.getTime()) / DAY_MS),
    }))

  if (upcoming.length === 0) {
    lines.push("- לא הוזנו עדיין מועדי בחינה לקורס זה.")
  } else {
    for (const exam of upcoming) {
      const dateLabel = formatDateOnlyHebrew(exam.date)
      if (exam.diffDays > 0) lines.push(`- ${exam.label}: ${dateLabel} (בעוד ${exam.diffDays} ימים).`)
      else if (exam.diffDays === 0) lines.push(`- ${exam.label}: ${dateLabel} — היום!`)
      else lines.push(`- ${exam.label}: ${dateLabel} (עבר).`)
    }
    const closest = upcoming.find((e) => e.diffDays >= 0)
    if (closest && closest.diffDays <= APPROACHING_DAYS) {
      lines.push(
        `- שים לב: ${closest.label} מתקרב (בעוד ${closest.diffDays} ימים) — אם זה טבעי בהקשר השיחה, הזכר זאת לסטודנט ועודד תרגול פעיל וחיזוק נושאים חלשים, לא רק הסברים תאורטיים.`
      )
    }
  }

  if (recentAttempts.length === 0) {
    lines.push(
      "- הסטודנט עדיין לא ביצע אף מבחן תרגול בקורס הזה. אם מזדמן טבעי, הצע לו לבצע מבחן תרגול — זו הדרך האמינה ביותר לבדוק הבנה אמיתית, לא רק לקרוא הסברים."
    )
  } else {
    const [last, ...earlier] = recentAttempts
    const daysSinceLast = Math.round((now.getTime() - last.attemptedAt.getTime()) / DAY_MS)
    const scoreLabel = last.scorePercentage !== null ? `${Math.round(last.scorePercentage)}%` : "—"
    lines.push(`- מבחן התרגול האחרון: "${last.quizTitle}", לפני ${daysSinceLast} ימים, ציון ${scoreLabel}.`)
    if (last.scorePercentage !== null && last.scorePercentage < LOW_SCORE_THRESHOLD) {
      lines.push("- הציון האחרון נמוך יחסית — ייתכן שזה נושא שכדאי להתמקד בחיזוקו ביוזמתך.")
    }
    if (daysSinceLast >= NO_QUIZ_NUDGE_AFTER_DAYS) {
      lines.push(
        `- עברו ${daysSinceLast} ימים מאז מבחן התרגול האחרון — אם זה טבעי בהקשר השיחה, הצע לסטודנט לבצע מבחן תרגול נוסף.`
      )
    }
    if (earlier.length) {
      lines.push(
        "- מבחנים קודמים: " +
          earlier
            .map((a) => `"${a.quizTitle}" (${a.scorePercentage !== null ? Math.round(a.scorePercentage) + "%" : "—"})`)
            .join(", ") +
          "."
      )
    }
  }

  return lines.join("\n")
}
