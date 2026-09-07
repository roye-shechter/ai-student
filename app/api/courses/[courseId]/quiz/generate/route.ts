import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateQuiz } from "@/lib/rag/quiz"
import { assertEmbeddingEnv, assertLlmEnv } from "@/lib/rag/clients"
import { assertUnderDailyLimit, RateLimitExceededError } from "@/lib/rate-limit"

/**
 * Quiz generation endpoint — same shape as /api/upload and /api/chat: auth →
 * rate-limit → delegate to lib/rag/quiz.ts. Builds a quiz grounded in the
 * course's ingested material (retrieval scoped to the authenticated user +
 * course, same tenant isolation as the chat pipeline) and persists it as a
 * QuizAttempt + QuizQuestion rows. `correctAnswer` is withheld from the
 * response — the client only learns it via the submit endpoint's grading.
 */

export const runtime = "nodejs"

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ courseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
      await assertUnderDailyLimit(userId, "quiz")
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        return NextResponse.json(
          { error: "הגעת למכסת המבחנים היומית שלך. נסה שוב מחר." },
          { status: 429 }
        )
      }
      throw error
    }

    assertEmbeddingEnv()
    assertLlmEnv()

    const { courseId } = await ctx.params
    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) {
      return NextResponse.json({ error: "Unknown course" }, { status: 400 })
    }

    const questions = await generateQuiz({
      userId,
      courseId: course.id,
      courseName: course.courseName,
    })

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        courseId: course.id,
        quizTitle: `מבחן תרגול - ${course.courseName}`,
        totalQuestions: questions.length,
      },
    })

    const createdQuestions = await prisma.quizQuestion.createManyAndReturn({
      data: questions.map((q, i) => ({
        quizAttemptId: attempt.id,
        order: i,
        type: q.type,
        questionText: q.questionText,
        choices: q.choices,
        correctAnswer: q.correctAnswer,
        topic: q.topic,
      })),
    })

    // Never send correctAnswer to the client before grading.
    return NextResponse.json({
      quizAttemptId: attempt.id,
      quizTitle: attempt.quizTitle,
      questions: createdQuestions
        .sort((a, b) => a.order - b.order)
        .map((q) => ({
          id: q.id,
          order: q.order,
          type: q.type,
          questionText: q.questionText,
          choices: q.choices,
        })),
    })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/courses/[courseId]/quiz/generate failed:", error)
    const message =
      error instanceof Error ? error.message : "Unexpected server error during quiz generation"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
