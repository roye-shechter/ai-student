"use client"

import { useState } from "react"
import { Loader2, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { readJson } from "@/lib/http"

// Common Israeli academic study-year options.
const STUDY_YEARS = ["שנה א'", "שנה ב'", "שנה ג'", "שנה ד'", "תואר שני", "תואר שלישי"]

/**
 * Forced onboarding modal. Rendered (and held open) by the dashboard whenever
 * the user's onboardingCompleted flag is false. Collects the academic
 * institution and the year of study, then persists both via /api/onboarding.
 * Courses are no longer picked here — users create their own from the dashboard.
 */
export function OnboardingModal({ onCompleted }: { onCompleted: () => void }) {
  const [institution, setInstitution] = useState("")
  const [studyYear, setStudyYear] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = institution.trim().length > 0 && studyYear.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution: institution.trim(), studyYear: studyYear.trim() }),
      })
      const data = await readJson<{ error?: string }>(res)
      if (!res.ok || !data) {
        throw new Error(data?.error || `שמירת הפרטים נכשלה (קוד ${res.status})`)
      }
      onCompleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה")
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" dir="rtl">
      <div className="w-full max-w-lg bg-[#14131f] border border-[#7c5cff]/40 rounded-2xl shadow-2xl shadow-[#7c5cff]/10 overflow-hidden">
        <div className="p-6 border-b border-[#29253f]">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#7c5cff] to-[#34e4ea] flex items-center gap-2">
            <GraduationCap className="text-[#7c5cff]" size={26} />
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
              className="bg-[#1c1a2b] border-[#29253f] text-white focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="studyYear" className="text-neutral-200">שנת לימוד</Label>
            <select
              id="studyYear"
              value={studyYear}
              onChange={(e) => setStudyYear(e.target.value)}
              className="w-full h-10 rounded-md bg-[#1c1a2b] border border-[#29253f] text-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff]"
            >
              <option value="" disabled>בחר את שנת הלימוד שלך</option>
              {STUDY_YEARS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="p-6 border-t border-[#29253f] flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-gradient-to-l from-[#7c5cff] to-[#5a3fd6] hover:from-[#8f70ff] hover:to-[#6b4ee8] text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-[#7c5cff]/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
