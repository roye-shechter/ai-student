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
      <div className="w-full max-w-lg bg-[#12161f] border border-[#242b3a] rounded-sm shadow-2xl shadow-black/40 overflow-hidden">
        <div className="p-6 border-b border-[#242b3a]">
          <h2 className="font-serif text-2xl gold-text flex items-center gap-2">
            <GraduationCap className="text-[#ff7a3d]" size={26} />
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
              className="bg-[#161b26] border-[#242b3a] text-white focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="studyYear" className="text-neutral-200">שנת לימוד</Label>
            <select
              id="studyYear"
              value={studyYear}
              onChange={(e) => setStudyYear(e.target.value)}
              className="w-full h-10 rounded-md bg-[#161b26] border border-[#242b3a] text-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
            >
              <option value="" disabled>בחר את שנת הלימוד שלך</option>
              {STUDY_YEARS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="p-6 border-t border-[#242b3a] flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
