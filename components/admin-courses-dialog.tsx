"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { AdminModal } from "@/components/admin-modal"
import { readJson } from "@/lib/http"

type CourseRow = {
  id: string
  courseCode: string
  courseName: string
  description: string | null
  isActive: boolean
  createdAt: string
  creatorName: string | null
  enrollmentCount: number
  documentCount: number
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso))
}

/** Full course catalog — opened from the "סה״כ קורסים" stat card on the main admin page. */
export function AdminCoursesDialog({ onClose }: { onClose: () => void }) {
  const [courses, setCourses] = useState<CourseRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/courses")
      .then((res) => readJson<{ courses: CourseRow[]; error?: string }>(res).then((body) => ({ res, body })))
      .then(({ res, body }) => {
        if (cancelled) return
        if (!res.ok || !body) throw new Error(body?.error || "טעינת הקורסים נכשלה")
        setCourses(body.courses)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "אירעה שגיאה")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AdminModal title="כל הקורסים" subtitle={courses ? `${courses.length} קורסים בסך הכול` : undefined} onClose={onClose}>
      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-neutral-400">
          <Loader2 className="animate-spin text-[#ff7a3d]" size={18} /> טוען...
        </div>
      ) : error || !courses ? (
        <div className="py-6 flex items-center gap-2 text-red-300">
          <AlertCircle size={18} /> {error}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-neutral-400 text-xs sticky top-0 bg-[#12161f]">
              <tr className="border-b border-[#242b3a]">
                <th className="text-right py-2 pl-4 font-normal">קוד</th>
                <th className="text-right py-2 pl-4 font-normal">שם הקורס</th>
                <th className="text-right py-2 pl-4 font-normal">יוצר</th>
                <th className="text-right py-2 pl-4 font-normal">נרשמים</th>
                <th className="text-right py-2 pl-4 font-normal">מסמכים</th>
                <th className="text-right py-2 pl-4 font-normal">נוצר</th>
                <th className="text-right py-2 font-normal">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-b border-[#242b3a]/50">
                  <td className="py-2 pl-4 font-mono text-xs text-[#ffb066]">{c.courseCode}</td>
                  <td className="py-2 pl-4">
                    <div className="text-white">{c.courseName}</div>
                    {c.description && (
                      <div className="text-[11px] text-neutral-500 max-w-xs truncate" title={c.description}>
                        {c.description}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pl-4 text-neutral-300">{c.creatorName ?? "—"}</td>
                  <td className="py-2 pl-4 tabular-nums">{c.enrollmentCount.toLocaleString("he-IL")}</td>
                  <td className="py-2 pl-4 tabular-nums">{c.documentCount.toLocaleString("he-IL")}</td>
                  <td className="py-2 pl-4 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="py-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        c.isActive
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50"
                          : "bg-[#161b26] text-neutral-500 border border-[#242b3a]"
                      }`}
                    >
                      {c.isActive ? "פעיל" : "לא פעיל"}
                    </span>
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-neutral-500">אין קורסים עדיין</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminModal>
  )
}
