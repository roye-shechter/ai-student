"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { ArrowLeft, Loader2, Sparkles, Plus, TrendingUp, Target } from "lucide-react"
import { OnboardingModal } from "@/components/onboarding-modal"
import { CreateCourseDialog } from "@/components/create-course-dialog"
import { readJson } from "@/lib/http"
import { gsap, useGSAP } from "@/lib/gsap"

type Me = { onboardingCompleted: boolean; institution: string | null }

type Enrollment = {
  completionPercentage: number
  course: { id: string; courseCode: string; courseName: string; description: string | null; credits: number }
}

type ProgressSummary = {
  weeklyHours: { name: string; hours: number }[]
  averageScore: number | null
  attemptCount: number
  weakTopics: { topic: string; count: number }[]
}

// A gallery grid needs visual variety the way a photographer's portfolio
// gets it from the photos themselves — since there are no real course
// covers, these are hand-tuned muted gold/charcoal gradients standing in
// for that variety, picked deterministically by position, not randomly.
const COVER_VARIANTS = [
  "bg-[radial-gradient(ellipse_120%_100%_at_20%_0%,#3a2f1c,#17140f_70%)]",
  "bg-[linear-gradient(135deg,#211d16,#0d0c0a_60%,#332a18_130%)]",
  "bg-[radial-gradient(ellipse_100%_80%_at_80%_100%,#2a2214,#0d0c0a_70%)]",
  "bg-[linear-gradient(200deg,#1a1712,#332b1f_50%,#0d0c0a_100%)]",
]

export default function Dashboard() {
  const { data: session } = useSession()
  const displayName = session?.user?.fullName || session?.user?.username || "אורח"

  const [me, setMe] = useState<Me | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateCourse, setShowCreateCourse] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    try {
      const [meRes, enrRes, progRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/enrollments"),
        fetch("/api/progress/summary"),
      ])
      const meData = await readJson<Me>(meRes)
      if (meRes.ok && meData) setMe(meData)
      const enrData = await readJson<{ enrollments?: Enrollment[] }>(enrRes)
      if (enrRes.ok && enrData) setEnrollments(enrData.enrollments ?? [])
      const progData = await readJson<ProgressSummary>(progRes)
      if (progRes.ok && progData) setProgress(progData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // One quiet entrance once real data has arrived — header settles, the
  // library grid follows in reading order, then the analytics row. Each
  // course's progress bar/percentage counts up to its real value since
  // that number is the one worth a moment of attention.
  useGSAP(
    () => {
      if (loading) return
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } })
      tl.fromTo(".dash-header", { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.7 })
        .fromTo(
          ".dash-course-card",
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.09 },
          "-=0.3"
        )
        .fromTo(".dash-chart-card", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }, "-=0.35")

      document.querySelectorAll<HTMLElement>(".dash-progress-fill").forEach((el) => {
        const target = Number(el.dataset.value ?? 0)
        tl.fromTo(el, { width: "0%" }, { width: `${target}%`, duration: 0.9, ease: "power1.out" }, "-=0.4")
      })
      document.querySelectorAll<HTMLElement>(".dash-progress-number").forEach((el) => {
        const target = Number(el.dataset.value ?? 0)
        const counter = { value: 0 }
        tl.to(
          counter,
          {
            value: target,
            duration: 0.9,
            ease: "power1.out",
            onUpdate: () => {
              el.textContent = `${Math.round(counter.value)}%`
            },
          },
          "<"
        )
      })
    },
    { scope: rootRef, dependencies: [loading, enrollments.length] }
  )

  const handleOnboardingCompleted = () => {
    setMe((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev))
    loadData()
  }

  const handleCourseCreated = () => {
    setShowCreateCourse(false)
    loadData() // refresh the active enrollments list with the new course
  }

  const showOnboarding = !loading && me !== null && !me.onboardingCompleted

  const totalHours = progress?.weeklyHours.reduce((sum, w) => sum + w.hours, 0) ?? 0
  const hasHoursData = totalHours > 0
  const hasScoreData = (progress?.attemptCount ?? 0) > 0
  const avgScore = Math.round(progress?.averageScore ?? 0)
  const scorePieData = [
    { name: "רמת הבנה", value: avgScore, color: "#b08d57" },
    { name: "נותר לחזק", value: 100 - avgScore, color: "#332b1f" },
  ]

  return (
    <div ref={rootRef} className="relative z-10 min-h-screen text-[#f0ece2] p-8" dir="rtl">
      {showOnboarding && <OnboardingModal onCompleted={handleOnboardingCompleted} />}
      {showCreateCourse && (
        <CreateCourseDialog onClose={() => setShowCreateCourse(false)} onCreated={handleCourseCreated} />
      )}

      <div className="max-w-6xl mx-auto space-y-10">

        {/* כותרת הדשבורד */}
        <header className="dash-header border-b border-[#332b1f] pb-6 flex justify-between items-end">
          <div>
            <h1 className="font-serif text-4xl gold-text">
              האזור האישי שלי
            </h1>
            <p className="text-[#a89a82] text-base mt-2">
              ברוך הבא, <span className="text-[#d4b483]">{displayName}</span>. הנה סיכום מצב הלמידה שלך.
            </p>
          </div>
          <Button variant="outline" className="bg-transparent border-[#332b1f] text-[#a89a82] hover:bg-[#211d16] hover:text-[#d4b483] hover:border-[#b08d57]/50 rounded-sm transition-all duration-300">
            הגדרות פרופיל
          </Button>
        </header>

        {/* הספרייה שלי — גלריית הקורסים */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl text-[#f0ece2]">
              הספרייה שלי
            </h2>
            <Button
              onClick={() => setShowCreateCourse(true)}
              variant="outline"
              className="bg-transparent border-[#332b1f] text-[#a89a82] hover:text-[#d4b483] hover:border-[#b08d57]/50 rounded-sm flex items-center gap-2 transition-all duration-300"
            >
              <Plus size={16} />
              הוסף קורס חדש
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-[#a89a82] py-8">
              <Loader2 className="animate-spin text-[#b08d57]" size={20} />
              טוען את הקורסים שלך...
            </div>
          ) : enrollments.length === 0 ? (
            <Card className="bg-[#17140f] border-[#332b1f] border-dashed rounded-sm">
              <CardContent className="py-10 text-center text-[#a89a82]">
                <Sparkles className="mx-auto text-[#b08d57] mb-3" size={26} />
                <p className="mb-4">עדיין אין לך קורסים. צור את הקורס הראשון שלך כדי לפתוח את סביבת הלמידה.</p>
                <Button
                  onClick={() => setShowCreateCourse(true)}
                  className="bg-[#b08d57] hover:bg-[#d4b483] text-[#17140f] font-semibold rounded-sm inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  הוסף קורס חדש
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {enrollments.map(({ course, completionPercentage }, i) => (
                <Link key={course.id} href={`/dashboard/${course.courseCode}`} className="dash-course-card group block">
                  <article>
                    <div className={`relative aspect-[4/3] rounded-sm overflow-hidden ${COVER_VARIANTS[i % COVER_VARIANTS.length]} transition-transform duration-500 group-hover:scale-[1.02]`}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <span className="absolute top-4 right-4 text-[10px] tracking-[0.15em] uppercase text-[#d4b483] bg-black/40 border border-[#b08d57]/30 px-2 py-1 rounded-sm">
                        {course.credits} נ&quot;ז
                      </span>
                      <h3 className="absolute bottom-4 right-4 left-4 font-serif text-2xl text-[#f0ece2] leading-tight">
                        {course.courseName}
                      </h3>
                    </div>

                    <div className="pt-3">
                      {course.description && (
                        <p className="text-xs text-[#a89a82] line-clamp-1 mb-2">{course.description}</p>
                      )}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-full max-w-[70%] bg-[#211d16] rounded-full h-[3px] overflow-hidden">
                          <div
                            className="dash-progress-fill bg-[#b08d57] h-full"
                            data-value={Math.round(completionPercentage)}
                            style={{ width: "0%" }}
                          />
                        </div>
                        <span
                          className="dash-progress-number text-[11px] text-[#a89a82] tabular-nums"
                          data-value={Math.round(completionPercentage)}
                        >
                          0%
                        </span>
                      </div>
                      <span className="text-sm text-[#d4b483] group-hover:text-[#f0ece2] transition-colors flex items-center gap-1.5">
                        היכנס ללמידה
                        <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-1" />
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* אזור האנליטיקה */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[#332b1f]">
          <Card className="dash-chart-card bg-[#17140f] border-[#332b1f] rounded-sm text-white">
            <CardHeader>
              <CardTitle className="text-[#d4b483] flex items-center gap-2 font-sans text-sm font-medium">
                <TrendingUp size={16} />
                שעות למידה שבועיות
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {!loading && !hasHoursData ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#a89a82] text-sm gap-2">
                  <TrendingUp size={22} className="text-[#b08d57]/50" />
                  עדיין אין נתוני זמן למידה. שיחה או מבחן תרגול ראשונים יופיעו כאן.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progress?.weeklyHours ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#332b1f" />
                    <XAxis dataKey="name" stroke="#a89a82" />
                    <YAxis stroke="#a89a82" />
                    <Tooltip contentStyle={{ backgroundColor: '#17140f', borderColor: '#b08d57', color: '#fff' }} cursor={{ fill: '#ffffff08' }} />
                    <Bar dataKey="hours" fill="#b08d57" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="dash-chart-card bg-[#17140f] border-[#332b1f] rounded-sm text-white">
            <CardHeader>
              <CardTitle className="text-[#d4b483] flex items-center gap-2 font-sans text-sm font-medium">
                <Target size={16} />
                רמת הבנה ממוצעת (לפי מבחני תרגול)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center">
              {!loading && !hasScoreData ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#a89a82] text-sm gap-2 px-4">
                  <Target size={22} className="text-[#b08d57]/50" />
                  עדיין לא ביצעת מבחן תרגול. נסה אחד בעמוד של קורס כדי לראות כאן את רמת ההבנה שלך.
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
                      <Tooltip contentStyle={{ backgroundColor: '#17140f', borderColor: '#b08d57', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="font-serif text-2xl text-white">{avgScore}%</span>
                    <span className="text-[10px] text-[#a89a82]">{progress?.attemptCount} מבחנים</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {progress && progress.weakTopics.length > 0 && (
          <section className="dash-chart-card border border-[#332b1f] rounded-sm p-6">
            <h2 className="text-sm font-medium text-[#d4b483] flex items-center gap-2 mb-4">
              <Sparkles size={16} />
              נושאים לחיזוק
            </h2>
            <div className="flex flex-wrap gap-2">
              {progress.weakTopics.map(({ topic, count }) => (
                <span
                  key={topic}
                  className="text-xs bg-[#211d16] text-[#c9bfa8] border border-[#332b1f] px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                >
                  {topic}
                  <span className="text-[#d4b483] font-semibold">×{count}</span>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-[#a89a82] mt-3">
              נושאים אלו הוזנו אוטומטית למורה הפרטי — הוא יתייחס אליהם ביוזמתו בפעם הבאה שתשוחח איתו.
            </p>
          </section>
        )}

      </div>
    </div>
  )
}
