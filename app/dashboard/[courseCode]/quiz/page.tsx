"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { readJson } from "@/lib/http"
import { MarkdownMessage } from "@/components/markdown-message"
import { gsap, useGSAP } from "@/lib/gsap"
import {
  ArrowRight, GraduationCap, Loader2, AlertCircle, CheckCircle2, XCircle, RotateCcw,
} from "lucide-react"

type CourseInfo = { id: string; courseCode: string; courseName: string }

type QuizQuestion = {
  id: string
  order: number
  type: "mcq" | "short"
  questionText: string
  choices: string[] | null
}

type GeneratedQuiz = {
  quizAttemptId: string
  quizTitle: string
  questions: QuizQuestion[]
}

type QuizResult = {
  questionId: string
  isCorrect: boolean
  score: number
  feedback: string
  correctAnswer: string | null
}

type SubmitResponse = {
  quizAttemptId: string
  scorePercentage: number
  correctAnswers: number
  totalQuestions: number
  results: QuizResult[]
}

type Stage = "idle" | "generating" | "taking" | "grading" | "graded"

export default function QuizPage() {
  const params = useParams<{ courseCode: string }>()
  const courseCode = params.courseCode

  const [course, setCourse] = useState<CourseInfo | null>(null)
  const [stage, setStage] = useState<Stage>("idle")
  const [error, setError] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SubmitResponse | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.fromTo(".quiz-header", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" })
    },
    { scope: rootRef }
  )

  // A dedicated entrance whenever the question set actually appears (fresh
  // quiz, or landing back on "taking" after a failed submit) — one
  // orchestrated stagger, not a per-render replay.
  useGSAP(
    () => {
      if (stage !== "taking" || !quiz) return
      gsap.fromTo(
        ".quiz-question-card",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power3.out" }
      )
    },
    { scope: rootRef, dependencies: [quiz?.quizAttemptId] }
  )

  // The graded moment gets its own small reveal: the score card scales in,
  // then per-question verdict icons pop in reading order.
  useGSAP(
    () => {
      if (stage !== "graded") return
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(".quiz-score-card", { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.45 })
        .fromTo(
          ".quiz-verdict-icon",
          { opacity: 0, scale: 0 },
          { opacity: 1, scale: 1, duration: 0.4, stagger: 0.06, ease: "power2.out" },
          "-=0.15"
        )
    },
    { scope: rootRef, dependencies: [stage] }
  )

  useEffect(() => {
    if (!courseCode) return
    ;(async () => {
      try {
        const res = await fetch(`/api/documents?courseCode=${encodeURIComponent(courseCode)}`)
        const data = await readJson<{ course?: CourseInfo; error?: string }>(res)
        if (!res.ok || !data?.course) {
          throw new Error(data?.error || `טעינת הקורס נכשלה (קוד ${res.status})`)
        }
        setCourse(data.course)
      } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה שגיאה בטעינת הקורס")
      }
    })()
  }, [courseCode])

  const startQuiz = useCallback(async () => {
    if (!course) return
    setStage("generating")
    setError(null)
    try {
      const res = await fetch(`/api/courses/${course.id}/quiz/generate`, { method: "POST" })
      const data = await readJson<GeneratedQuiz & { error?: string }>(res)
      if (!res.ok || !data) {
        throw new Error(data?.error || `יצירת המבחן נכשלה (קוד ${res.status})`)
      }
      setQuiz(data)
      setAnswers({})
      setResult(null)
      setStage("taking")
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה ביצירת המבחן")
      setStage("idle")
    }
  }, [course])

  const submitQuiz = useCallback(async () => {
    if (!quiz) return
    setStage("grading")
    setError(null)
    try {
      const res = await fetch(`/api/quiz-attempts/${quiz.quizAttemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        }),
      })
      const data = await readJson<SubmitResponse & { error?: string }>(res)
      if (!res.ok || !data) {
        throw new Error(data?.error || `בדיקת המבחן נכשלה (קוד ${res.status})`)
      }
      setResult(data)
      setStage("graded")
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בבדיקת המבחן")
      setStage("taking")
    }
  }, [quiz, answers])

  const resultByQuestionId = new Map((result?.results ?? []).map((r) => [r.questionId, r]))
  const answeredCount = quiz ? quiz.questions.filter((q) => (answers[q.id] ?? "").trim()).length : 0

  return (
    <div ref={rootRef} className="relative z-10 min-h-screen text-white flex flex-col" dir="rtl">
      <div className="quiz-header border-b border-[#332b1f] glass-panel p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/dashboard/${courseCode}`}
            className="flex items-center gap-2 text-neutral-400 hover:text-[#d4b483] transition-colors text-sm"
          >
            <ArrowRight size={16} />
            חזרה לצ&apos;אט הקורס
          </Link>
          <span className="text-xs bg-[#2a2214] text-[#d4b483] border border-[#b08d57]/40 px-2 py-1 rounded">
            מבחן תרגול מבוסס AI
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        <div className="quiz-header glass-panel border border-[#332b1f] rounded-sm p-6">
          <h1 className="font-serif gold-text text-2xl">
            {quiz?.quizTitle ?? (course ? `מבחן תרגול - ${course.courseName}` : "מבחן תרגול")}
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            שאלות שנבנו אוטומטית מתוך חומר הקורס שהעלית. תשובות שגויות מוזנות חזרה למורה הפרטי כדי שיתמקד בהן בפעם הבאה.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#2a1414] border border-red-900/50 text-red-300 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {stage === "idle" && (
          <Card className="quiz-header glass-panel border-[#332b1f] text-white">
            <CardContent className="p-10 text-center space-y-4">
              <GraduationCap size={40} className="mx-auto text-[#b08d57]" />
              <p className="text-neutral-300 text-sm">
                מוכן לבדוק כמה מהחומר נטמע? המורה הפרטי יבנה מבחן קצר מותאם אישית.
              </p>
              <Button
                onClick={startQuiz}
                disabled={!course}
                className="bg-[#b08d57] hover:bg-[#d4b483] text-[#17140f] rounded-sm transition-all duration-300 active:scale-[0.98]"
              >
                התחל מבחן תרגול
              </Button>
            </CardContent>
          </Card>
        )}

        {stage === "generating" && (
          <div className="flex flex-col items-center gap-3 text-neutral-400 text-sm py-16">
            <Loader2 className="animate-spin text-[#b08d57]" size={28} />
            המורה הפרטי בונה עבורך מבחן מותאם אישית מתוך חומר הקורס...
          </div>
        )}

        {quiz && (stage === "taking" || stage === "grading" || stage === "graded") && (
          <>
            <div className="flex items-center gap-3">
              <Progress value={(answeredCount / quiz.questions.length) * 100} className="flex-1" />
              <span className="text-xs text-neutral-400 shrink-0">
                {answeredCount}/{quiz.questions.length} נענו
              </span>
            </div>

            {stage === "graded" && result && (
              <Card className="quiz-score-card glass-panel border-[#b08d57]/40 text-white shadow-xl shadow-black/30">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-400">תוצאה סופית</p>
                    <p className="font-serif gold-text text-3xl">
                      {Math.round(result.scorePercentage)}%
                    </p>
                  </div>
                  <p className="text-sm text-neutral-300">
                    {result.correctAnswers} מתוך {result.totalQuestions} נכונות
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {quiz.questions.map((q, i) => {
                const graded = resultByQuestionId.get(q.id)
                const disabled = stage !== "taking"
                return (
                  <Card
                    key={q.id}
                    className="quiz-question-card glass-panel border-[#332b1f] text-white"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-start gap-2">
                        <span className="text-[#b08d57] shrink-0">שאלה {i + 1}.</span>
                        <span className="font-normal text-neutral-100 flex-1">
                          <MarkdownMessage content={q.questionText} />
                        </span>
                        {graded && (
                          <span className="quiz-verdict-icon shrink-0 mr-auto">
                            {graded.isCorrect ? (
                              <CheckCircle2 size={18} className="text-emerald-400" />
                            ) : (
                              <XCircle size={18} className="text-red-400" />
                            )}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {q.type === "mcq" && q.choices ? (
                        <RadioGroup
                          value={answers[q.id] ?? ""}
                          onValueChange={(value) =>
                            setAnswers((prev) => ({ ...prev, [q.id]: String(value) }))
                          }
                          disabled={disabled}
                        >
                          {q.choices.map((choice) => (
                            <label
                              key={choice}
                              className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer rounded-md px-2 py-1.5 -mx-2 transition-colors duration-200 hover:bg-white/5 hover:text-white"
                            >
                              <RadioGroupItem value={choice} />
                              {choice}
                            </label>
                          ))}
                        </RadioGroup>
                      ) : (
                        <Textarea
                          value={answers[q.id] ?? ""}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          disabled={disabled}
                          placeholder="כתוב את תשובתך כאן..."
                          className="bg-[#211d16] border-[#332b1f] text-white focus-visible:ring-[#b08d57] focus-visible:border-[#b08d57]"
                        />
                      )}

                      {graded && (
                        <div
                          className={`text-xs p-2 rounded border ${
                            graded.isCorrect
                              ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-300"
                              : "border-red-900/50 bg-red-950/30 text-red-300"
                          }`}
                        >
                          {graded.feedback}
                          {!graded.isCorrect && graded.correctAnswer && (
                            <p className="mt-1 text-neutral-400">
                              תשובה נכונה: {graded.correctAnswer}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <CardFooter className="px-0 flex justify-end gap-2">
              {stage === "taking" && (
                <Button
                  onClick={submitQuiz}
                  disabled={answeredCount === 0}
                  className="bg-[#b08d57] hover:bg-[#d4b483] text-[#17140f] rounded-sm transition-all duration-300 active:scale-[0.98]"
                >
                  הגש מבחן לבדיקה
                </Button>
              )}
              {stage === "grading" && (
                <Button disabled className="bg-[#332b1f] text-neutral-400">
                  <Loader2 className="animate-spin ml-2" size={16} />
                  בודק תשובות...
                </Button>
              )}
              {stage === "graded" && (
                <Button
                  onClick={startQuiz}
                  className="bg-[#211d16] hover:bg-[#332b1f] text-white border border-[#332b1f] flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-[#b08d57]/10"
                >
                  <RotateCcw size={14} />
                  מבחן תרגול נוסף
                </Button>
              )}
            </CardFooter>
          </>
        )}
      </div>
    </div>
  )
}
