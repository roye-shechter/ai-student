"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { BookOpen, PlayCircle, Loader2, Sparkles, Plus, Award } from "lucide-react"
import { OnboardingModal } from "@/components/onboarding-modal"
import { CreateCourseDialog } from "@/components/create-course-dialog"
import { readJson } from "@/lib/http"
import { gsap, useGSAP } from "@/lib/gsap"

const barData = [
  { name: "שבוע 1", hours: 12 },
  { name: "שבוע 2", hours: 19 },
  { name: "שבוע 3", hours: 15 },
  { name: "שבוע 4", hours: 22 },
  { name: "שבוע 5", hours: 28 },
]

const pieData = [
  { name: "נלמד", value: 70, color: "#7c5cff" },
  { name: "נותר ללמוד", value: 30, color: "#29253f" },
]

type Me = { onboardingCompleted: boolean; institution: string | null }

type Enrollment = {
  completionPercentage: number
  course: { id: string; courseCode: string; courseName: string; description: string | null; credits: number }
}

export default function Dashboard() {
  const { data: session } = useSession()
  const displayName = session?.user?.fullName || session?.user?.username || "אורח"

  const [me, setMe] = useState<Me | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateCourse, setShowCreateCourse] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    try {
      const [meRes, enrRes] = await Promise.all([fetch("/api/me"), fetch("/api/enrollments")])
      const meData = await readJson<Me>(meRes)
      if (meRes.ok && meData) setMe(meData)
      const enrData = await readJson<{ enrollments?: Enrollment[] }>(enrRes)
      if (enrRes.ok && enrData) setEnrollments(enrData.enrollments ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // One orchestrated entrance once the real data has arrived: header, then
  // the course grid staggered in reading order, then the analytics row —
  // and each course's progress bar/percentage counts up to its real value
  // instead of just appearing, since that number is the thing worth
  // drawing a moment of attention to.
  useGSAP(
    () => {
      if (loading) return
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(".dash-header", { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.6 })
        .fromTo(
          ".dash-course-card",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 },
          "-=0.25"
        )
        .fromTo(".dash-chart-card", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.12 }, "-=0.3")

      document.querySelectorAll<HTMLElement>(".dash-progress-fill").forEach((el) => {
        const target = Number(el.dataset.value ?? 0)
        tl.fromTo(el, { width: "0%" }, { width: `${target}%`, duration: 0.8, ease: "power2.out" }, "-=0.4")
      })
      document.querySelectorAll<HTMLElement>(".dash-progress-number").forEach((el) => {
        const target = Number(el.dataset.value ?? 0)
        const counter = { value: 0 }
        tl.to(
          counter,
          {
            value: target,
            duration: 0.8,
            ease: "power2.out",
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

  return (
    <div ref={rootRef} className="relative z-10 min-h-screen text-[#f3f1fa] p-8" dir="rtl">
      {showOnboarding && <OnboardingModal onCompleted={handleOnboardingCompleted} />}
      {showCreateCourse && (
        <CreateCourseDialog onClose={() => setShowCreateCourse(false)} onCreated={handleCourseCreated} />
      )}

      <div className="max-w-6xl mx-auto space-y-8">

        {/* כותרת הדשבורד */}
        <header className="dash-header glass-panel rounded-2xl border border-[#29253f] px-6 py-6 flex justify-between items-end relative overflow-hidden">
          <div className="absolute top-0 right-0 h-[2px] w-40 bg-gradient-to-l from-[#7c5cff] via-[#34e4ea] to-transparent" />
          <div>
            <h1 className="gradient-text text-4xl font-black">
              AI Student | אזור אישי
            </h1>
            <p className="text-[#c9c5e0] text-lg mt-2">
              ברוך הבא, <span className="font-semibold text-[#34e4ea]">{displayName}</span>. הנה סיכום מצב הלמידה שלך.
            </p>
          </div>
          <Button variant="outline" className="bg-[#14131f]/60 border-[#7c5cff]/40 text-[#9b82ff] hover:bg-[#1c1a2b] hover:text-[#34e4ea] hover:border-[#7c5cff] transition-all duration-300">
            הגדרות פרופיל
          </Button>
        </header>

        {/* אזור הקורסים שלי */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-[#e5e2f5] flex items-center gap-2">
              <BookOpen className="text-[#7c5cff]" size={24} />
              הקורסים שלי
            </h2>
            <Button
              onClick={() => setShowCreateCourse(true)}
              className="bg-gradient-to-l from-[#7c5cff] to-[#5a3fd6] hover:from-[#8f70ff] hover:to-[#6b4ee8] text-white font-semibold flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-[#7c5cff]/30"
            >
              <Plus size={18} />
              הוסף קורס חדש
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-[#8d89ac] py-8">
              <Loader2 className="animate-spin text-[#7c5cff]" size={20} />
              טוען את הקורסים שלך...
            </div>
          ) : enrollments.length === 0 ? (
            <Card className="bg-[#14131f] border-[#29253f] border-dashed">
              <CardContent className="py-10 text-center text-[#8d89ac]">
                <Sparkles className="mx-auto text-[#7c5cff] mb-3" size={28} />
                <p className="mb-4">עדיין אין לך קורסים. צור את הקורס הראשון שלך כדי לפתוח את סביבת הלמידה.</p>
                <Button
                  onClick={() => setShowCreateCourse(true)}
                  className="bg-gradient-to-l from-[#7c5cff] to-[#5a3fd6] text-white font-semibold inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  הוסף קורס חדש
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enrollments.map(({ course, completionPercentage }) => (
                <Card
                  key={course.id}
                  className="dash-course-card glass-panel border-[#29253f] transition-all duration-300 hover:border-[#7c5cff]/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#7c5cff]/15"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl text-white">{course.courseName}</CardTitle>
                      <span className="flex items-center gap-1 text-xs text-[#34e4ea] bg-[#132022] border border-[#34e4ea]/30 px-2 py-1 rounded shrink-0">
                        <Award size={12} />
                        {course.credits} נ&quot;ז
                      </span>
                    </div>
                    {course.description && (
                      <CardDescription className="text-[#8d89ac] mt-1">{course.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#8d89ac]">התקדמות</span>
                      <span
                        className="dash-progress-number text-xs font-semibold text-[#9b82ff] tabular-nums"
                        data-value={Math.round(completionPercentage)}
                      >
                        0%
                      </span>
                    </div>
                    <div className="w-full bg-[#1c1a2b] rounded-full h-2 overflow-hidden">
                      <div
                        className="dash-progress-fill bg-gradient-to-l from-[#7c5cff] to-[#34e4ea] h-2 rounded-full"
                        data-value={Math.round(completionPercentage)}
                        style={{ width: "0%" }}
                      ></div>
                    </div>
                    <div className="pt-4 mt-4 border-t border-[#29253f]">
                      <Link href={`/dashboard/${course.courseCode}`}>
                        <Button className="w-full bg-[#1c1a2b] hover:bg-[#7c5cff] text-[#9b82ff] hover:text-white border border-[#7c5cff]/40 hover:border-[#7c5cff] transition-all duration-300 hover:shadow-lg hover:shadow-[#7c5cff]/20 flex items-center gap-2">
                          <PlayCircle size={18} />
                          היכנס ללמידה
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* אזור הגרפים */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#29253f]">
          <Card className="dash-chart-card glass-panel border-[#29253f] text-white shadow-xl shadow-black/20">
            <CardHeader>
              <CardTitle className="text-[#9b82ff]">שעות למידה שבועיות</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#29253f" />
                  <XAxis dataKey="name" stroke="#8d89ac" />
                  <YAxis stroke="#8d89ac" />
                  <Tooltip contentStyle={{ backgroundColor: '#14131f', borderColor: '#7c5cff', color: '#fff' }} cursor={{ fill: '#ffffff10' }} />
                  <Bar dataKey="hours" fill="#7c5cff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="dash-chart-card glass-panel border-[#29253f] text-white shadow-xl shadow-black/20">
            <CardHeader>
              <CardTitle className="text-[#9b82ff]">התקדמות כללית</CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#14131f', borderColor: '#7c5cff', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  )
}
