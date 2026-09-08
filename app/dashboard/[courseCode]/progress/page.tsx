"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { readJson } from "@/lib/http"
import { gsap, useGSAP } from "@/lib/gsap"
import { ArrowRight, TrendingUp, Target, Sparkles, Loader2, AlertCircle } from "lucide-react"

type CourseInfo = { id: string; courseCode: string; courseName: string }

type ProgressSummary = {
  weeklyHours: { name: string; hours: number }[]
  averageScore: number | null
  attemptCount: number
  weakTopics: { topic: string; count: number }[]
}

/**
 * This course's own learning analytics — same charts that used to live on
 * the main dashboard as an account-wide rollup (app/api/progress/summary,
 * now removed), now scoped to one course via
 * app/api/courses/[courseId]/progress and given its own page, matching the
 * quiz page's header/navigation pattern.
 */
export default function CourseProgressPage() {
  const params = useParams<{ courseCode: string }>()
  const courseCode = params.courseCode

  const [course, setCourse] = useState<CourseInfo | null>(null)
  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (loading) return
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(".progress-header", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5 })
        .fromTo(".progress-card", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, "-=0.2")
    },
    { scope: rootRef, dependencies: [loading] }
  )

  useEffect(() => {
    if (!courseCode) return
    ;(async () => {
      try {
        const courseRes = await fetch(`/api/documents?courseCode=${encodeURIComponent(courseCode)}`)
        const courseData = await readJson<{ course?: CourseInfo; error?: string }>(courseRes)
        if (!courseRes.ok || !courseData?.course) {
          throw new Error(courseData?.error || `טעינת הקורס נכשלה (קוד ${courseRes.status})`)
        }
        setCourse(courseData.course)

        const progRes = await fetch(`/api/courses/${courseData.course.id}/progress`)
        const progData = await readJson<ProgressSummary & { error?: string }>(progRes)
        if (!progRes.ok || !progData) {
          throw new Error(progData?.error || `טעינת נתוני ההתקדמות נכשלה (קוד ${progRes.status})`)
        }
        setProgress(progData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה שגיאה בטעינת ההתקדמות")
      } finally {
        setLoading(false)
      }
    })()
  }, [courseCode])

  const hasHoursData = (progress?.weeklyHours.reduce((sum, w) => sum + w.hours, 0) ?? 0) > 0
  const hasScoreData = (progress?.attemptCount ?? 0) > 0
  const avgScore = Math.round(progress?.averageScore ?? 0)
  const scorePieData = [
    { name: "רמת הבנה", value: avgScore, color: "#ff7a3d" },
    { name: "נותר לחזק", value: 100 - avgScore, color: "#242b3a" },
  ]
  const courseTitle = course?.courseName ?? courseCode

  return (
    <div ref={rootRef} className="relative z-10 min-h-screen text-white flex flex-col" dir="rtl">
      <div className="progress-header border-b border-[#242b3a] glass-panel p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/dashboard/${courseCode}`}
            className="flex items-center gap-2 text-neutral-400 hover:text-[#ffb066] transition-colors text-sm"
          >
            <ArrowRight size={16} />
            חזרה לצ&apos;אט הקורס
          </Link>
          <span className="text-xs bg-[#2a2015] text-[#ffb066] border border-[#ff7a3d]/40 px-2 py-1 rounded">
            התקדמות בקורס
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        <div>
          <h1 className="font-serif gold-text text-3xl">{courseTitle}</h1>
          <p className="text-neutral-400 text-sm mt-1">
            שעות למידה ורמת ההבנה שלך בקורס הזה, לפי הצ&apos;אט ומבחני התרגול.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-neutral-400 py-8">
            <Loader2 className="animate-spin text-[#ff7a3d]" size={20} />
            טוען נתונים...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#2a1414] border border-red-900/50 text-red-300 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="progress-card glass-panel border-[#242b3a] text-white">
                <CardHeader>
                  <CardTitle className="text-[#ffb066] flex items-center gap-2 font-sans text-sm font-medium">
                    <TrendingUp size={16} />
                    שעות למידה שבועיות
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  {!hasHoursData ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 text-sm gap-2">
                      <TrendingUp size={22} className="text-[#ff7a3d]/50" />
                      עדיין אין נתוני זמן למידה בקורס זה. שיחה או מבחן תרגול ראשונים יופיעו כאן.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={progress?.weeklyHours ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#242b3a" />
                        <XAxis dataKey="name" stroke="#8b93a3" />
                        <YAxis stroke="#8b93a3" />
                        <Tooltip contentStyle={{ backgroundColor: "#12161f", borderColor: "#ff7a3d", color: "#fff" }} cursor={{ fill: "#ffffff08" }} />
                        <Bar dataKey="hours" fill="#ff7a3d" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="progress-card glass-panel border-[#242b3a] text-white">
                <CardHeader>
                  <CardTitle className="text-[#ffb066] flex items-center gap-2 font-sans text-sm font-medium">
                    <Target size={16} />
                    רמת הבנה ממוצעת (לפי מבחני תרגול)
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-64 flex items-center justify-center">
                  {!hasScoreData ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 text-sm gap-2 px-4">
                      <Target size={22} className="text-[#ff7a3d]/50" />
                      עדיין לא ביצעת מבחן תרגול בקורס זה. נסה אחד כדי לראות כאן את רמת ההבנה שלך.
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={scorePieData} innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                            {scorePieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#12161f", borderColor: "#ff7a3d", color: "#fff" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="font-serif text-2xl text-white">{avgScore}%</span>
                        <span className="text-[10px] text-neutral-400">{progress?.attemptCount} מבחנים</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {progress && progress.weakTopics.length > 0 && (
              <div className="progress-card glass-panel border border-[#242b3a] rounded-sm p-6">
                <h2 className="text-sm font-medium text-[#ffb066] flex items-center gap-2 mb-4">
                  <Sparkles size={16} />
                  נושאים לחיזוק בקורס זה
                </h2>
                <div className="flex flex-wrap gap-2">
                  {progress.weakTopics.map(({ topic, count }) => (
                    <span
                      key={topic}
                      className="text-xs bg-[#161b26] text-[#c9c9d1] border border-[#242b3a] px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                    >
                      {topic}
                      <span className="text-[#ffb066] font-semibold">×{count}</span>
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-neutral-500 mt-3">
                  נושאים אלו הוזנו אוטומטית למורה הפרטי — הוא יתייחס אליהם ביוזמתו בפעם הבאה שתשוחח איתו.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
