"use client"

import { useState } from "react"
import { ChevronRight, ChevronLeft } from "lucide-react"

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
]
const HEBREW_WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"]

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function toDateOnly(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

/**
 * Self-contained month-grid date picker (no external calendar library),
 * matching the app's own navy/amber visual language. Works entirely in
 * "YYYY-MM-DD" strings, not Date objects with real time-of-day, so there's
 * no timezone conversion to get wrong — see lib/exam-dates.ts.
 */
export function Calendar({
  value,
  onChange,
  minValue,
}: {
  value: string | null
  onChange: (dateStr: string) => void
  /** Inclusive lower bound, also "YYYY-MM-DD". */
  minValue?: string
}) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const leadingBlanks = new Date(viewYear, viewMonth, 1).getDay() // Sunday = 0

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

  const today = toDateOnly(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  return (
    <div className="select-none" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goPrevMonth}
          className="p-1.5 rounded-sm text-neutral-400 hover:text-[#ffb066] hover:bg-[#161b26] transition-colors"
          aria-label="החודש הקודם"
        >
          <ChevronRight size={16} />
        </button>
        <span className="text-sm font-medium text-white">
          {HEBREW_MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          className="p-1.5 rounded-sm text-neutral-400 hover:text-[#ffb066] hover:bg-[#161b26] transition-colors"
          aria-label="החודש הבא"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {HEBREW_WEEKDAYS.map((d) => (
          <span key={d} className="text-[11px] text-neutral-500 text-center py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={i} />
          const cellValue = toDateOnly(viewYear, viewMonth, day)
          const isSelected = value === cellValue
          const isToday = today === cellValue
          const isDisabled = minValue ? cellValue < minValue : false
          return (
            <button
              key={i}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(cellValue)}
              className={`h-8 rounded-sm text-sm transition-colors ${
                isSelected
                  ? "bg-[#ff7a3d] text-[#12161f] font-semibold"
                  : isToday
                    ? "text-[#ffb066] border border-[#ff7a3d]/40"
                    : "text-neutral-300 hover:bg-[#161b26] hover:text-white"
              } ${isDisabled ? "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-neutral-300" : ""}`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
