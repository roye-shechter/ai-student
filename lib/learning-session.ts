import { prisma } from "@/lib/prisma"

/**
 * Writes real learning-activity time so the dashboard's "weekly hours"
 * chart reflects actual usage instead of the placeholder data it shipped
 * with. Upsert pattern: extend an already-open session for this
 * (userId, courseId, activityType) if the student is still in the middle
 * of one, otherwise start a new one — mirrors the daily-counter upsert in
 * lib/rate-limit.ts.
 *
 * There's no client heartbeat while a student is reading/thinking, so true
 * wall-clock duration between the first and last ping isn't measurable —
 * a single isolated chat message would otherwise log 0 minutes forever.
 * Instead each activity call adds a fixed estimated-engagement increment
 * (a chat turn implies a few minutes of reading the material + the reply;
 * a quiz implies more), accumulated for activity within the same
 * 30-minute window. Coarse by design, same philosophy as the daily rate
 * limiter: good enough to show "did you study this week", not a stopwatch.
 */

const OPEN_SESSION_WINDOW_MINUTES = 30
const ACTIVITY_MINUTES: Record<ActivityType, number> = {
  chat: 3,
  quiz: 10,
}

export type ActivityType = "chat" | "quiz"

export async function recordActivity(
  userId: string,
  courseId: string,
  activityType: ActivityType
): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - OPEN_SESSION_WINDOW_MINUTES * 60_000)
  const increment = ACTIVITY_MINUTES[activityType]

  const openSession = await prisma.learningSession.findFirst({
    where: { userId, courseId, activityType, sessionEnd: { gte: windowStart } },
    orderBy: { sessionEnd: "desc" },
  })

  if (openSession) {
    await prisma.learningSession.update({
      where: { id: openSession.id },
      data: { sessionEnd: now, durationMinutes: { increment } },
    })
  } else {
    await prisma.learningSession.create({
      data: { userId, courseId, activityType, sessionStart: now, sessionEnd: now, durationMinutes: increment },
    })
  }
}
