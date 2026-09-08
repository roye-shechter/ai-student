"use client"

import { useEffect, useState } from "react"
import { Loader2, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { readJson } from "@/lib/http"

const STUDY_YEARS = ["שנה א'", "שנה ב'", "שנה ג'", "שנה ד'", "תואר שני", "תואר שלישי"]

type Profile = {
  institution: string | null
  degree: string | null
  studyYear: string | null
  age: number | null
}

/**
 * Lets the user view/edit the profile fields collected during onboarding
 * (OnboardingModal) at any later point — the "הגדרות פרופיל" button on the
 * dashboard, which previously did nothing. Loads the current values from
 * /api/me on open, saves via PATCH /api/me.
 */
export function ProfileSettingsDialog({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [institution, setInstitution] = useState("")
  const [degree, setDegree] = useState("")
  const [studyYear, setStudyYear] = useState("")
  const [age, setAge] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/me")
        const data = await readJson<Profile & { error?: string }>(res)
        if (!res.ok || !data) throw new Error(data?.error || `טעינת הפרופיל נכשלה (קוד ${res.status})`)
        setInstitution(data.institution ?? "")
        setDegree(data.degree ?? "")
        setStudyYear(data.studyYear ?? "")
        setAge(data.age != null ? String(data.age) : "")
      } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה שגיאה בטעינת הפרופיל")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const canSubmit =
    institution.trim().length > 0 && degree.trim().length > 0 && studyYear.trim().length > 0 && age.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution: institution.trim(),
          degree: degree.trim(),
          studyYear: studyYear.trim(),
          age: Number(age),
        }),
      })
      const data = await readJson<{ error?: string }>(res)
      if (!res.ok || !data) throw new Error(data?.error || `השמירה נכשלה (קוד ${res.status})`)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בשמירת הפרופיל")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#12161f] border border-[#242b3a] rounded-sm shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#242b3a]">
          <h2 className="font-serif text-xl gold-text flex items-center gap-2">
            <UserCog className="text-[#ff7a3d]" size={22} />
            הגדרות פרופיל
          </h2>
          <p className="text-neutral-400 text-sm mt-1">הפרטים שסיפקת בהרשמה — אפשר לעדכן אותם בכל שלב.</p>
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-neutral-400 py-4">
              <Loader2 className="animate-spin text-[#ff7a3d]" size={18} />
              טוען...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="profileInstitution" className="text-neutral-200">המוסד האקדמי</Label>
                <Input
                  id="profileInstitution"
                  placeholder="לדוגמה: הטכניון, אוניברסיטת תל אביב..."
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="bg-[#161b26] border-[#242b3a] text-white focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileDegree" className="text-neutral-200">תואר / תחום לימוד</Label>
                <Input
                  id="profileDegree"
                  placeholder="לדוגמה: מדעי המחשב, הנדסת חשמל..."
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="bg-[#161b26] border-[#242b3a] text-white focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileStudyYear" className="text-neutral-200">שנת לימוד</Label>
                <select
                  id="profileStudyYear"
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

              <div className="space-y-2">
                <Label htmlFor="profileAge" className="text-neutral-200">גיל</Label>
                <Input
                  id="profileAge"
                  type="number"
                  min={14}
                  max={120}
                  placeholder="לדוגמה: 23"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="bg-[#161b26] border-[#242b3a] text-white focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              {saved && !error && <p className="text-sm text-emerald-400">הפרטים נשמרו בהצלחה.</p>}
            </>
          )}
        </div>

        <div className="p-6 border-t border-[#242b3a] flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-[#242b3a] text-neutral-300 hover:bg-[#161b26] hover:text-white rounded-sm"
          >
            סגור
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> שומר...
              </span>
            ) : (
              "שמור שינויים"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
