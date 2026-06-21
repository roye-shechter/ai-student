"use client"

import { useState } from "react"
import { Loader2, BookPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { readJson } from "@/lib/http"

type CreatedCourse = {
  id: string
  courseCode: string
  courseName: string
  description: string | null
  credits: number
}

/**
 * Modal dialog for creating a user-generated course. Collects a course name
 * and credit points (נ"ז), posts to /api/courses (which creates the course and
 * enrolls the user), then notifies the parent to refresh the enrollment list.
 */
export function CreateCourseDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (course: CreatedCourse) => void
}) {
  const [courseName, setCourseName] = useState("")
  const [credits, setCredits] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = courseName.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: courseName.trim(),
          credits: credits.trim() === "" ? 0 : Number(credits),
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#141414] border border-[#d4af37]/40 rounded-2xl shadow-2xl shadow-[#d4af37]/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#2a2a2a]">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#FFD700] flex items-center gap-2">
            <BookPlus className="text-[#d4af37]" size={22} />
            הוספת קורס חדש
          </h2>
          <p className="text-neutral-400 text-sm mt-1">צור קורס משלך והעלה אליו חומרי לימוד.</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="courseName" className="text-neutral-200">שם הקורס</Label>
            <Input
              id="courseName"
              autoFocus
              placeholder="לדוגמה: מבוא לכלכלה, אלגברה לינארית..."
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="bg-[#1f1f1f] border-[#2a2a2a] text-white focus-visible:ring-[#d4af37] focus-visible:border-[#d4af37]"
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
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="bg-[#1f1f1f] border-[#2a2a2a] text-white focus-visible:ring-[#d4af37] focus-visible:border-[#d4af37]"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="p-6 border-t border-[#2a2a2a] flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="bg-[#141414] border-[#2a2a2a] text-neutral-300 hover:bg-[#1f1f1f] hover:text-white"
          >
            ביטול
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-[#d4af37] hover:bg-[#FFD700] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> יוצר...
              </span>
            ) : (
              "צור קורס"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
