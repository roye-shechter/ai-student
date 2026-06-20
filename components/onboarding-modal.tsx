"use client"

import { useEffect, useState } from "react"
import { Loader2, GraduationCap, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Course = {
  id: string
  courseCode: string
  courseName: string
  description: string | null
}

/**
 * Forced onboarding modal. Rendered (and held open) by the dashboard whenever
 * the user's onboardingCompleted flag is false. Collects the academic
 * institution and the courses to unlock, then persists both via /api/onboarding.
 */
export function OnboardingModal({ onCompleted }: { onCompleted: () => void }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [institution, setInstitution] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => {
        if (active) setCourses(data.courses ?? [])
      })
      .catch(() => {
        if (active) setError("טעינת רשימת הקורסים נכשלה")
      })
      .finally(() => {
        if (active) setCoursesLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const toggleCourse = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canSubmit = institution.trim().length > 0 && selected.size > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution: institution.trim(), courseIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "שמירת הפרטים נכשלה")
      onCompleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה")
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" dir="rtl">
      <div className="w-full max-w-lg bg-[#141414] border border-[#d4af37]/40 rounded-2xl shadow-2xl shadow-[#d4af37]/10 overflow-hidden">
        <div className="p-6 border-b border-[#2a2a2a]">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#FFD700] flex items-center gap-2">
            <GraduationCap className="text-[#d4af37]" size={26} />
            ברוך הבא! בוא נשלים את הפרופיל
          </h2>
          <p className="text-neutral-400 text-sm mt-1">כמה פרטים אחרונים כדי להתאים לך את סביבת הלמידה.</p>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="institution" className="text-neutral-200">המוסד האקדמי</Label>
            <Input
              id="institution"
              placeholder="לדוגמה: הטכניון, אוניברסיטת תל אביב..."
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="bg-[#1f1f1f] border-[#2a2a2a] text-white focus-visible:ring-[#d4af37] focus-visible:border-[#d4af37]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-neutral-200">בחר את הקורסים שלך</Label>
            {coursesLoading ? (
              <p className="text-sm text-neutral-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> טוען קורסים זמינים...
              </p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-neutral-500">לא נמצאו קורסים זמינים.</p>
            ) : (
              <div className="space-y-2">
                {courses.map((course) => {
                  const isChecked = selected.has(course.id)
                  return (
                    <label
                      key={course.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? "border-[#d4af37] bg-[#2a2410]/40"
                          : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#d4af37]/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCourse(course.id)}
                        className="mt-1 h-4 w-4 accent-[#d4af37]"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-neutral-100">{course.courseName}</span>
                        {course.description && (
                          <span className="block text-xs text-neutral-500 mt-0.5">{course.description}</span>
                        )}
                      </span>
                      {isChecked && <CheckCircle2 size={16} className="text-[#d4af37] shrink-0 mt-0.5" />}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="p-6 border-t border-[#2a2a2a] flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-[#d4af37] hover:bg-[#FFD700] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> שומר...
              </span>
            ) : (
              "סיום והתחלת למידה"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
