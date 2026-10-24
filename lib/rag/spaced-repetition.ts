import { prisma } from "@/lib/prisma"

/**
 * Minimal spaced-repetition scheduling for weak topics (TopicReview in
 * prisma/schema.prisma). A topic the student got wrong is due again
 * tomorrow; each time they get it right afterward the interval doubles (1 ->
 * 2 -> 4 -> 8 ... capped at MAX_INTERVAL_DAYS), same shape as classic
 * spaced-repetition schedulers (Anki's SM-2 etc.) without reimplementing the
 * full algorithm — ease factors and per-answer-quality grading aren't worth
 * the complexity here, "wrong resets to tomorrow, right pushes it out
 * further" already captures the useful behavior: review what's still shaky,
 * leave alone what's sticking.
 *
 * Fed by two event sources (QuizQuestion.isCorrect from quiz grading, and
 * the chat confusion-signal marker in lib/rag/chat.ts) but this module
 * doesn't care which — it's just "topic got weak" / "topic got mastered".
 * getDueTopics() is what lib/rag/chat.ts's getWeakTopics() now reads from,
 * replacing the old "5 most recent" with "5 most overdue".
 */

const INITIAL_INTERVAL_DAYS = 1
const MAX_INTERVAL_DAYS = 30

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

/**
 * The student got this topic wrong — reset the schedule to "due tomorrow",
 * whether or not it was already being tracked. Never throws; a scheduling
 * hiccup must not break the quiz/chat turn that triggered it.
 */
export async function recordWeakTopic(userId: string, courseId: string, topic: string): Promise<void> {
  try {
    const nextReviewAt = addDays(new Date(), INITIAL_INTERVAL_DAYS)
    await prisma.topicReview.upsert({
      where: { userId_courseId_topic: { userId, courseId, topic } },
      create: { userId, courseId, topic, intervalDays: INITIAL_INTERVAL_DAYS, nextReviewAt, lastResult: "weak" },
      update: { intervalDays: INITIAL_INTERVAL_DAYS, nextReviewAt, lastResult: "weak" },
    })
  } catch (error) {
    console.error("[non-fatal] failed to record weak topic:", error)
  }
}

/**
 * The student got this topic right. Only meaningful for a topic already
 * being tracked as weak — doubles its interval and pushes nextReviewAt out
 * further. A topic that was never flagged weak has nothing to "master" here,
 * so this is a no-op for it rather than creating a row for every correct
 * answer a student has ever given.
 */
export async function recordMasteredTopic(userId: string, courseId: string, topic: string): Promise<void> {
  try {
    const existing = await prisma.topicReview.findUnique({
      where: { userId_courseId_topic: { userId, courseId, topic } },
    })
    if (!existing) return
    const intervalDays = Math.min(existing.intervalDays * 2, MAX_INTERVAL_DAYS)
    await prisma.topicReview.update({
      where: { id: existing.id },
      data: { intervalDays, nextReviewAt: addDays(new Date(), intervalDays), lastResult: "mastered" },
    })
  } catch (error) {
    console.error("[non-fatal] failed to record mastered topic:", error)
  }
}

/** Topics due for proactive review right now, most overdue first. */
export async function getDueTopics(userId: string, courseId: string, limit = 5): Promise<string[]> {
  const rows = await prisma.topicReview.findMany({
    where: { userId, courseId, nextReviewAt: { lte: new Date() } },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
    select: { topic: true },
  })
  return rows.map((r) => r.topic)
}
