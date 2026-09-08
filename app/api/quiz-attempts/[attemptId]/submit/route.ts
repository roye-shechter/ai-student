import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { gradeShortAnswers, type ShortAnswerToGrade } from "@/lib/rag/quiz"
import { assertLlmEnv } from "@/lib/rag/clients"
import { logActivity } from "@/lib/activity-log"

/**
 * Quiz grading endpoint. MCQ questions are graded deterministically in
 * process (no LLM call). Short-answer questions are graded in ONE batched
 * Claude call (lib/rag/quiz.ts's gradeShortAnswers), not one call per
 * question. Updates each QuizQuestion row plus the aggregate QuizAttempt.
 */

export const runtime = "nodejs"

const SubmitBodySchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), answer: z.string() })),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    assertLlmEnv()

    const { attemptId } = await ctx.params
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { questions: true },
    })
    if (!attempt || attempt.userId !== userId) {
      return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 })
    }
    if (attempt.scorePercentage !== null) {
      return NextResponse.json({ error: "Quiz attempt already submitted" }, { status: 409 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const parsed = SubmitBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const answerByQuestionId = new Map(
      parsed.data.answers.map((a) => [a.questionId, a.answer])
    )

    const mcqQuestions = attempt.questions.filter((q) => q.type === "mcq")
    const shortQuestions = attempt.questions.filter((q) => q.type === "short")

    const mcqResults = mcqQuestions.map((q) => {
      const studentAnswer = answerByQuestionId.get(q.id) ?? ""
      const isCorrect = studentAnswer.trim() === (q.correctAnswer ?? "").trim()
      return {
        questionId: q.id,
        order: q.order,
        studentAnswer,
        isCorrect,
        score: isCorrect ? 1 : 0,
        feedback: isCorrect ? "תשובה נכונה!" : `התשובה הנכונה היא: "${q.correctAnswer}"`,
        correctAnswer: q.correctAnswer,
      }
    })

    const toGrade: ShortAnswerToGrade[] = shortQuestions.map((q) => ({
      questionId: q.id,
      questionText: q.questionText,
      referenceAnswer: q.correctAnswer ?? "",
      studentAnswer: answerByQuestionId.get(q.id) ?? "",
    }))
    const gradedShort = await gradeShortAnswers(toGrade)
    const gradedById = new Map(gradedShort.map((g) => [g.questionId, g]))

    const shortResults = shortQuestions.map((q) => {
      const graded = gradedById.get(q.id)
      return {
        questionId: q.id,
        order: q.order,
        studentAnswer: answerByQuestionId.get(q.id) ?? "",
        isCorrect: graded?.isCorrect ?? false,
        score: graded?.score ?? 0,
        feedback: graded?.feedback ?? "לא ניתן היה לבדוק תשובה זו.",
        correctAnswer: q.correctAnswer,
      }
    })

    const allResults = [...mcqResults, ...shortResults].sort((a, b) => a.order - b.order)

    // The grading call above (gradeShortAnswers) can take 30-50s on the hard
    // path (thinking + code execution), which is long enough for a pooled
    // Neon connection to go idle. Prisma's default $transaction maxWait
    // (2s)/timeout (5s) are tuned for quick queries, not "acquire a
    // connection right after a long-running LLM call" — give it real room
    // rather than racing a cold/contended pool.
    await prisma.$transaction(
      allResults.map((r) =>
        prisma.quizQuestion.update({
          where: { id: r.questionId },
          data: {
            studentAnswer: r.studentAnswer,
            isCorrect: r.isCorrect,
            score: r.score,
            feedback: r.feedback,
          },
        })
      ),
      { maxWait: 10_000, timeout: 30_000 }
    )

    const totalQuestions = allResults.length
    const correctAnswers = allResults.filter((r) => r.isCorrect).length
    const scorePercentage =
      totalQuestions > 0
        ? (allResults.reduce((sum, r) => sum + r.score, 0) / totalQuestions) * 100
        : 0
    const timeSpentSeconds = Math.max(
      0,
      Math.round((Date.now() - attempt.attemptedAt.getTime()) / 1000)
    )

    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { scorePercentage, correctAnswers, totalQuestions, timeSpentSeconds },
    })

    await logActivity({
      userId,
      type: "quiz_completed",
      metadata: { attemptId: attempt.id, courseId: attempt.courseId, scorePercentage },
    })

    return NextResponse.json({
      quizAttemptId: attempt.id,
      scorePercentage,
      correctAnswers,
      totalQuestions,
      timeSpentSeconds,
      results: allResults.map((r) => ({
        questionId: r.questionId,
        isCorrect: r.isCorrect,
        score: r.score,
        feedback: r.feedback,
        correctAnswer: r.correctAnswer,
      })),
    })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/quiz-attempts/[attemptId]/submit failed:", error)
    const message =
      error instanceof Error ? error.message : "Unexpected server error during quiz grading"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
