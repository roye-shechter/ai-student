"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { TrendingUp, Target, Sparkles, Loader2 } from "lucide-react"
import { readJson } from "@/lib/http"

type ProgressSummary = {
  weeklyHours: { name: string; hours: number }[]
  averageScore: number | null
  attemptCount: number
  weakTopics: { topic: string; count: number }[]
}

/**
 * The course page's own compact progress readout — shown immediately on the
 * page itself (not only after navigating to /progress), per the request
 * that course info "לא יהיה בעמוד נפרד". /progress still exists for the
 * full charts; this is the at-a-glance version: this week's hours, average
 * quiz score, and the top weak topics, with a link onward for more detail.
 */
export function CourseProgressSnapshot({ courseId, courseCode }: { courseId: string; courseCode: string }) {
  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/courses/${courseId}/progress`)
      .then((res) => readJson<ProgressSummary>(res).then((body) => ({ res, body })))
      .then(({ res, body }) => {
        if (!cancelled && res.ok && body) setProgress(body)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  if (loading) {
    return (
      <div className="course-info-card glass-panel border border-[#242b3a] rounded-sm p-6 flex items-center gap-2 text-neutral-400 text-sm">
        <Loader2 className="animate-spin text-[#ff7a3d]" size={16} />
        טוען התקדמות...
      </div>
    )
  }

  const thisWeekHours = progress?.weeklyHours.at(-1)?.hours ?? 0
  const hasScore = (progress?.attemptCount ?? 0) > 0
  const avgScore = Math.round(progress?.averageScore ?? 0)
  const topWeakTopics = progress?.weakTopics.slice(0, 3) ?? []

  return (
    <div className="course-info-card glass-panel border border-[#242b3a] rounded-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[#ffb066] flex items-center gap-2">
          <TrendingUp size={16} />
          ההתקדמות שלך בקורס
        </h2>
        <Link href={`/dashboard/${courseCode}/progress`} className="text-[11px] text-neutral-500 hover:text-[#ffb066] transition-colors">
          כל הפרטים
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-sm border border-[#242b3a] bg-[#161b26] p-3">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} />
            שעות למידה השבוע
          </div>
          <div className="text-lg text-white tabular-nums">{thisWeekHours.toFixed(1)}</div>
        </div>
        <div className="rounded-sm border border-[#242b3a] bg-[#161b26] p-3">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mb-1">
            <Target size={12} />
            רמת הבנה ממוצעת
          </div>
          <div className="text-lg text-white tabular-nums">{hasScore ? `${avgScore}%` : "—"}</div>
        </div>
      </div>

      {topWeakTopics.length > 0 && (
        <div>
          <h3 className="text-[11px] text-neutral-500 flex items-center gap-1.5 mb-2">
            <Sparkles size={12} />
            נושאים לחיזוק
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {topWeakTopics.map(({ topic, count }) => (
              <span
                key={topic}
                className="text-[11px] bg-[#161b26] text-[#c9c9d1] border border-[#242b3a] px-2 py-1 rounded-sm flex items-center gap-1"
              >
                {topic}
                <span className="text-[#ffb066] font-semibold">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
