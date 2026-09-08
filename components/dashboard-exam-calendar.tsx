"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, ChevronRight, ChevronLeft, Loader2 } from "lucide-react"
import { EXAM_DATE_LABELS, isExamDateType, formatDateOnlyHebrew } from "@/lib/exam-dates"
import { readJson } from "@/lib/http"

type ExamDateApiEntry = {
  id: string
  type: string
  date: string
  course: { id: string; courseCode: string; courseName: string }
}

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
]
const HEBREW_WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"]

/**
 * Main-dashboard exam calendar: a display-only month grid marking every day
 * that has an exam (across all of the user's enrolled courses, from
 * /api/exam-dates), plus an agenda list of the closest upcoming ones —
 * dots alone aren't informative enough on their own to tell what's coming.
 */
export function DashboardExamCalendar() {
  const [entries, setEntries] = useState<ExamDateApiEntry[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/exam-dates")
        const data = await readJson<{ examDates?: ExamDateApiEntry[] }>(res)
        if (res.ok && data) setEntries(data.examDates ?? [])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const byDay = useMemo(() => {
    const map = new Map<string, ExamDateApiEntry[]>()
    for (const entry of entries) {
      const d = new Date(entry.date)
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
      map.set(key, [...(map.get(key) ?? []), entry])
    }
    return map
  }, [entries])

  const upcoming = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return entries.filter((e) => new Date(e.date) >= today).slice(0, 5)
  }, [entries])

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const leadingBlanks = new Date(viewYear, viewMonth, 1).getDay()
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else setViewMonth((m) => m - 1)
  }
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else setViewMonth((m) => m + 1)
  }

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#8b93a3] py-8">
        <Loader2 className="animate-spin text-[#ff7a3d]" size={20} />
        טוען את מועדי הבחינות...
      </div>
    )
  }

  if (entries.length === 0) return null

  return (
    <section className="dash-course-card grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 glass-panel border border-[#242b3a] rounded-sm p-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={goPrevMonth} className="p-1.5 rounded-sm text-neutral-400 hover:text-[#ffb066] hover:bg-[#161b26] transition-colors" aria-label="החודש הקודם">
            <ChevronRight size={16} />
          </button>
          <span className="text-sm font-medium text-white">
            {HEBREW_MONTHS[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={goNextMonth} className="p-1.5 rounded-sm text-neutral-400 hover:text-[#ffb066] hover:bg-[#161b26] transition-colors" aria-label="החודש הבא">
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {HEBREW_WEEKDAYS.map((d) => (
            <span key={d} className="text-[11px] text-neutral-500 text-center py-1">{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <span key={i} />
            const key = `${viewYear}-${viewMonth}-${day}`
            const dayEntries = byDay.get(key) ?? []
            const isToday = key === todayKey
            return (
              <div
                key={i}
                title={dayEntries.map((e) => `${EXAM_DATE_LABELS[isExamDateType(e.type) ? e.type : "final_a"]} · ${e.course.courseName}`).join(", ")}
                className={`h-9 rounded-sm text-sm flex flex-col items-center justify-center gap-0.5 ${
                  isToday ? "border border-[#ff7a3d]/40 text-[#ffb066]" : "text-neutral-300"
                }`}
              >
                {day}
                {dayEntries.length > 0 && <span className="h-1 w-1 rounded-full bg-[#ff7a3d]" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="md:w-64 md:border-r md:border-[#242b3a] md:pr-6 space-y-3">
        <h3 className="text-sm font-medium text-[#ffb066] flex items-center gap-2">
          <CalendarDays size={16} />
          הבחינות הקרובות שלך
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-xs text-neutral-500">אין בחינות קרובות מתוזמנות.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/dashboard/${e.course.courseCode}`}
                  className="flex flex-col gap-0.5 text-xs group hover:text-[#ffb066] transition-colors"
                >
                  <span className="text-neutral-500 group-hover:text-[#ffb066]">
                    {EXAM_DATE_LABELS[isExamDateType(e.type) ? e.type : "final_a"]} · {e.course.courseName}
                  </span>
                  <span className="text-white">{formatDateOnlyHebrew(new Date(e.date))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
