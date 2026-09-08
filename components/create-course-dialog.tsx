"use client"

import { useState } from "react"
import { Loader2, BookPlus, CalendarDays, CalendarCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { formatDateOnlyHebrew, dateOnlyToUTC } from "@/lib/exam-dates"
import { readJson } from "@/lib/http"

type CreatedCourse = {
  id: string
  courseCode: string
  courseName: string
  description: string | null
  credits: number
}

type Step = "details" | "midterm-ask" | "midterm-date" | "final-a" | "final-b"

/**
 * Modal dialog for creating a user-generated course. A short wizard: name +
 * credits, then (per the product spec) whether there's a midterm and its
 * date, then the two mandatory final-exam sittings (מועד א / מועד ב) — each
 * picked from the shared Calendar component. Posts everything in one
 * request to /api/courses, which creates the course, enrolls the user, and
 * writes any exam dates given.
 */
export function CreateCourseDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (course: CreatedCourse) => void
}) {
  const [step, setStep] = useState<Step>("details")
  const [courseName, setCourseName] = useState("")
  const [credits, setCredits] = useState("")
  const [hasMidterm, setHasMidterm] = useState<boolean | null>(null)
  const [midtermDate, setMidtermDate] = useState<string | null>(null)
  const [finalADate, setFinalADate] = useState<string | null>(null)
  const [finalBDate, setFinalBDate] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmitDetails = courseName.trim().length > 0

  const submit = async (skipRemainingDates: boolean) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: courseName.trim(),
          credits: credits.trim() === "" ? 0 : Number(credits),
          examDates: skipRemainingDates
            ? undefined
            : {
                midterm: hasMidterm && midtermDate ? midtermDate : undefined,
                finalA: finalADate ?? undefined,
                finalB: finalBDate ?? undefined,
              },
        }),
      })
      const data = await readJson<{ course?: CreatedCourse; error?: string }>(res)
      if (!res.ok || !data?.course) {
        throw new Error(data?.error || `יצירת הקורס נכשלה (קוד ${res.status})`)
      }
      onCreated(data.course)
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה ביצירת הקורס")
      setSubmitting(false)
    }
  }

  const header = {
    details: { icon: <BookPlus className="text-[#ff7a3d]" size={22} />, title: "הוספת קורס חדש", subtitle: "צור קורס משלך והעלה אליו חומרי לימוד." },
    "midterm-ask": { icon: <CalendarDays className="text-[#ff7a3d]" size={22} />, title: "בוחן אמצע", subtitle: "האם יש בקורס הזה בוחן אמצע?" },
    "midterm-date": { icon: <CalendarDays className="text-[#ff7a3d]" size={22} />, title: "תאריך בוחן האמצע", subtitle: "בחר את התאריך מהלוח שנה." },
    "final-a": { icon: <CalendarCheck className="text-[#ff7a3d]" size={22} />, title: "מועד א", subtitle: "מתי מתקיים מועד א של הבחינה הסופית?" },
    "final-b": { icon: <CalendarCheck className="text-[#ff7a3d]" size={22} />, title: "מועד ב", subtitle: "ומתי מועד ב?" },
  }[step]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#12161f] border border-[#242b3a] rounded-sm shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#242b3a]">
          <h2 className="font-serif text-xl gold-text flex items-center gap-2">
            {header.icon}
            {header.title}
          </h2>
          <p className="text-neutral-400 text-sm mt-1">{header.subtitle}</p>
        </div>

        <div className="p-6 space-y-5">
          {step === "details" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="courseName" className="text-neutral-200">שם הקורס</Label>
                <Input
                  id="courseName"
                  autoFocus
                  placeholder="לדוגמה: מבוא לכלכלה, אלגברה לינארית..."
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSubmitDetails && setStep("midterm-ask")}
                  className="bg-[#161b26] border-[#242b3a] text-white focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credits" className="text-neutral-200">נקודות זכות (נ&quot;ז)</Label>
                <Input
                  id="credits"
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="לדוגמה: 3"
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSubmitDetails && setStep("midterm-ask")}
                  className="bg-[#161b26] border-[#242b3a] text-white focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
                />
              </div>
            </>
          )}

          {step === "midterm-ask" && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setHasMidterm(true)
                  setStep("midterm-date")
                }}
                className="flex-1 p-4 rounded-sm border border-[#242b3a] bg-[#161b26] text-white text-sm hover:border-[#ff7a3d]/60 transition-colors"
              >
                כן, יש בוחן אמצע
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasMidterm(false)
                  setMidtermDate(null)
                  setStep("final-a")
                }}
                className="flex-1 p-4 rounded-sm border border-[#242b3a] bg-[#161b26] text-white text-sm hover:border-[#ff7a3d]/60 transition-colors"
              >
                לא, אין בוחן אמצע
              </button>
            </div>
          )}

          {step === "midterm-date" && (
            <div>
              <Calendar value={midtermDate} onChange={setMidtermDate} />
              {midtermDate && (
                <p className="text-xs text-neutral-500 mt-3 text-center">
                  נבחר: {formatDateOnlyHebrew(dateOnlyToUTC(midtermDate))}
                </p>
              )}
            </div>
          )}

          {step === "final-a" && (
            <div>
              <Calendar value={finalADate} onChange={setFinalADate} />
              {finalADate && (
                <p className="text-xs text-neutral-500 mt-3 text-center">
                  נבחר: {formatDateOnlyHebrew(dateOnlyToUTC(finalADate))}
                </p>
              )}
            </div>
          )}

          {step === "final-b" && (
            <div>
              <Calendar value={finalBDate} onChange={setFinalBDate} minValue={finalADate ?? undefined} />
              {finalBDate && (
                <p className="text-xs text-neutral-500 mt-3 text-center">
                  נבחר: {formatDateOnlyHebrew(dateOnlyToUTC(finalBDate))}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="p-6 border-t border-[#242b3a] flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (step === "details") onClose()
              else if (step === "midterm-ask") setStep("details")
              else if (step === "midterm-date") setStep("midterm-ask")
              else if (step === "final-a") setStep(hasMidterm ? "midterm-date" : "midterm-ask")
              else setStep("final-a")
            }}
            disabled={submitting}
            className="bg-transparent border-[#242b3a] text-neutral-300 hover:bg-[#161b26] hover:text-white rounded-sm"
          >
            {step === "details" ? "ביטול" : "חזרה"}
          </Button>

          <div className="flex items-center gap-2">
            {step !== "details" && step !== "final-b" && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => submit(true)}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-2 disabled:opacity-50"
              >
                דלג, אמלא אחר כך
              </button>
            )}

            {step === "details" && (
              <Button
                onClick={() => setStep("midterm-ask")}
                disabled={!canSubmitDetails}
                className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                המשך
              </Button>
            )}
            {step === "midterm-date" && (
              <Button
                onClick={() => setStep("final-a")}
                disabled={!midtermDate}
                className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                המשך
              </Button>
            )}
            {step === "final-a" && (
              <Button
                onClick={() => setStep("final-b")}
                disabled={!finalADate}
                className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                המשך
              </Button>
            )}
            {step === "final-b" && (
              <Button
                onClick={() => submit(false)}
                disabled={!finalBDate || submitting}
                className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> יוצר...
                  </span>
                ) : (
                  "צור קורס"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
