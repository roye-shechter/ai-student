"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Sparkles, Plus } from "lucide-react"
import { OnboardingModal } from "@/components/onboarding-modal"
import { CreateCourseDialog } from "@/components/create-course-dialog"
import { CourseIllustration } from "@/components/course-illustration"
import { DashboardExamCalendar } from "@/components/dashboard-exam-calendar"
import { readJson } from "@/lib/http"
import { gsap, useGSAP } from "@/lib/gsap"

type Me = { onboardingCompleted: boolean; institution: string | null }

type Enrollment = {
  completionPercentage: number
  course: { id: string; courseCode: string; courseName: string; description: string | null; credits: number }
}

// A gallery grid needs visual variety the way a photographer's portfolio
// gets it from the photos themselves — since there are no real course
// covers, these are hand-tuned navy/amber gradients standing in for that
// variety, picked deterministically by position, not randomly.
const COVER_VARIANTS = [
  "bg-[radial-gradient(ellipse_120%_100%_at_20%_0%,#3a2210,#12161f_70%)]",
  "bg-[linear-gradient(135deg,#161b26,#0a0e14_60%,#2a2015_130%)]",
  "bg-[radial-gradient(ellipse_100%_80%_at_80%_100%,#2a2015,#0a0e14_70%)]",
  "bg-[linear-gradient(200deg,#12151d,#242b3a_50%,#0a0e14_100%)]",
]

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

  // One quiet entrance once real data has arrived — header settles, the
  // library grid follows in reading order. Each course's progress
  // bar/percentage counts up to its real value since that number is the
  // one worth a moment of attention.
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

  return (
    <div ref={rootRef} className="relative z-10 min-h-screen text-[#f5f6f8] p-8" dir="rtl">
      {showOnboarding && <OnboardingModal onCompleted={handleOnboardingCompleted} />}
      {showCreateCourse && (
        <CreateCourseDialog onClose={() => setShowCreateCourse(false)} onCreated={handleCourseCreated} />
      )}

      <div className="max-w-6xl mx-auto space-y-10">

        {/* כותרת הדשבורד */}
        <header className="dash-header border-b border-[#242b3a] pb-6 flex justify-between items-end">
          <div>
            <h1 className="font-serif text-4xl gold-text">
              האזור האישי שלי
            </h1>
            <p className="text-[#8b93a3] text-base mt-2">
              ברוך הבא, <span className="text-[#ffb066]">{displayName}</span>. הנה סיכום מצב הלמידה שלך.
            </p>
          </div>
          <Button variant="outline" className="bg-transparent border-[#242b3a] text-[#8b93a3] hover:bg-[#161b26] hover:text-[#ffb066] hover:border-[#ff7a3d]/50 rounded-sm transition-all duration-300">
            הגדרות פרופיל
          </Button>
        </header>

        {!loading && <DashboardExamCalendar />}

        {/* הספרייה שלי — גלריית הקורסים */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl text-[#f5f6f8]">
              הספרייה שלי
            </h2>
            <Button
              onClick={() => setShowCreateCourse(true)}
              variant="outline"
              className="bg-transparent border-[#242b3a] text-[#8b93a3] hover:text-[#ffb066] hover:border-[#ff7a3d]/50 rounded-sm flex items-center gap-2 transition-all duration-300"
            >
              <Plus size={16} />
              הוסף קורס חדש
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-[#8b93a3] py-8">
              <Loader2 className="animate-spin text-[#ff7a3d]" size={20} />
              טוען את הקורסים שלך...
            </div>
          ) : enrollments.length === 0 ? (
            <Card className="bg-[#12161f] border-[#242b3a] border-dashed rounded-sm">
              <CardContent className="py-10 text-center text-[#8b93a3]">
                <Sparkles className="mx-auto text-[#ff7a3d] mb-3" size={26} />
                <p className="mb-4">עדיין אין לך קורסים. צור את הקורס הראשון שלך כדי לפתוח את סביבת הלמידה.</p>
                <Button
                  onClick={() => setShowCreateCourse(true)}
                  className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  הוסף קורס חדש
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {enrollments.map(({ course, completionPercentage }, i) => (
                <Link key={course.id} href={`/dashboard/${course.courseCode}`} className="dash-course-card group group/tech block">
                  <article>
                    <div
                      className={`tech-glow-border relative aspect-[4/3] rounded-sm overflow-hidden border border-transparent ${COVER_VARIANTS[i % COVER_VARIANTS.length]} transition-transform duration-500 group-hover:scale-[1.02]`}
                    >
                      <CourseIllustration courseName={course.courseName} description={course.description} seed={course.courseCode} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="tech-scan" />
                      <span className="tech-corner tech-corner-tl" />
                      <span className="tech-corner tech-corner-tr" />
                      <span className="tech-corner tech-corner-bl" />
                      <span className="tech-corner tech-corner-br" />
                      <span className="absolute top-4 right-4 text-[10px] tracking-[0.15em] uppercase text-[#ffb066] bg-black/40 border border-[#ff7a3d]/30 px-2 py-1 rounded-sm font-tech">
                        {course.credits} נ&quot;ז
                      </span>
                      <h3 className="absolute bottom-4 right-4 left-4 font-serif text-2xl text-[#f5f6f8] leading-tight">
                        {course.courseName}
                      </h3>
                    </div>

                    <div className="pt-3">
                      {course.description && (
                        <p className="text-xs text-[#8b93a3] line-clamp-1 mb-2">{course.description}</p>
                      )}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-full max-w-[70%] bg-[#161b26] rounded-full h-[3px] overflow-hidden">
                          <div
                            className="dash-progress-fill bg-[#ff7a3d] h-full"
                            data-value={Math.round(completionPercentage)}
                            style={{ width: "0%" }}
                          />
                        </div>
                        <span
                          className="dash-progress-number text-[11px] text-[#8b93a3] tabular-nums"
                          data-value={Math.round(completionPercentage)}
                        >
                          0%
                        </span>
                      </div>
                      <span className="text-sm text-[#ffb066] group-hover:text-[#ffcc99] transition-colors duration-300 flex items-center gap-1.5">
                        היכנס ללמידה
                        <ArrowLeft size={13} className="transition-transform duration-300 group-hover:-translate-x-1.5" />
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
