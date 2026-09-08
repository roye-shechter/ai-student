"use client"

import { useState } from "react"
import { CalendarDays, Pencil, Plus, X, Loader2 } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import {
  EXAM_DATE_TYPES,
  EXAM_DATE_LABELS,
  type ExamDateType,
  formatDateOnly,
  formatDateOnlyHebrew,
} from "@/lib/exam-dates"
import { readJson } from "@/lib/http"

export type ExamDateEntry = { id: string; type: string; date: string }

function EditExamDateDialog({
  courseId,
  type,
  initialValue,
  onClose,
  onSaved,
}: {
  courseId: string
  type: ExamDateType
  initialValue: string | null
  onClose: () => void
  onSaved: (dateStr: string | null) => void
}) {
  const [value, setValue] = useState<string | null>(initialValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (dateStr: string | null) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/exam-dates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, date: dateStr }),
      })
      const data = await readJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || `השמירה נכשלה (קוד ${res.status})`)
      onSaved(dateStr)
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בשמירת התאריך")
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#12161f] border border-[#242b3a] rounded-sm shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#242b3a] flex items-center justify-between">
          <h2 className="font-serif text-xl gold-text flex items-center gap-2">
            <CalendarDays className="text-[#ff7a3d]" size={22} />
            {EXAM_DATE_LABELS[type]}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white transition-colors" aria-label="סגור">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <Calendar value={value} onChange={setValue} />
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </div>

        <div className="p-6 border-t border-[#242b3a] flex items-center justify-between gap-2">
          {initialValue ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => save(null)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              נקה תאריך
            </button>
          ) : (
            <span />
          )}
          <Button
            onClick={() => value && save(value)}
            disabled={!value || saving}
            className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : "שמור"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Course page's exam-schedule card — three equal-width slots (בוחן אמצע /
 * מועד א / מועד ב), each either showing its saved date or an "add" prompt.
 * Always shows all three (even an unset midterm) so a student who skipped
 * it during course creation can still add it here.
 */
export function ExamDatesCard({
  courseId,
  examDates,
  onChanged,
}: {
  courseId: string
  examDates: ExamDateEntry[]
  onChanged: () => void
}) {
  const [editingType, setEditingType] = useState<ExamDateType | null>(null)
  const byType = new Map(examDates.map((e) => [e.type, e]))

  return (
    <div className="course-info-card glass-panel border border-[#242b3a] rounded-sm p-6">
      <h2 className="text-sm font-medium text-[#ffb066] flex items-center gap-2 mb-4">
        <CalendarDays size={16} />
        מועדי בחינות
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {EXAM_DATE_TYPES.map((type) => {
          const entry = byType.get(type)
          const dateObj = entry ? new Date(entry.date) : null
          return (
            <button
              key={type}
              type="button"
              onClick={() => setEditingType(type)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-sm border border-[#242b3a] bg-[#0a0e14] hover:border-[#ff7a3d]/60 transition-colors text-center"
            >
              <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                {EXAM_DATE_LABELS[type]}
                {dateObj ? <Pencil size={10} className="text-neutral-600" /> : <Plus size={10} className="text-neutral-600" />}
              </span>
              {dateObj ? (
                <span className="text-sm text-white font-medium">{formatDateOnlyHebrew(dateObj)}</span>
              ) : (
                <span className="text-xs text-neutral-600">לא נקבע</span>
              )}
            </button>
          )
        })}
      </div>

      {editingType && (
        <EditExamDateDialog
          courseId={courseId}
          type={editingType}
          initialValue={byType.get(editingType) ? formatDateOnly(new Date(byType.get(editingType)!.date)) : null}
          onClose={() => setEditingType(null)}
          onSaved={() => {
            setEditingType(null)
            onChanged()
          }}
        />
      )}
    </div>
  )
}
