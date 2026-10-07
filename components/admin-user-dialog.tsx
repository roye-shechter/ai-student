"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertCircle, Cpu, Activity, GraduationCap } from "lucide-react"
import { AdminModal } from "@/components/admin-modal"
import { readJson } from "@/lib/http"
import { formatIls, formatSeconds } from "@/lib/admin-time"
import type { RecordKind, RecordFilters } from "@/components/admin-records-dialog"

type UserDetail = {
  user: {
    id: string
    username: string
    fullName: string | null
    email: string
    institution: string | null
    degree: string | null
    studyYear: string | null
    age: number | null
    role: string
    createdAt: string
    lastLoginAt: string | null
  }
  totals: {
    modelCalls: number
    costUsd: number
    activityEvents: number
    learningSessions: number
    learningSeconds: number
    chatRequests: number
    uploadRequests: number
    quizRequests: number
    enrolledCourses: number
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "מעולם לא"
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
}

/**
 * Everything the admin knows about one user: profile, lifetime totals, and
 * links into their raw records (each opens the records dialog for that user).
 */
export function AdminUserDialog({
  userId,
  onClose,
  onOpenRecords,
}: {
  userId: string
  onClose: () => void
  onOpenRecords: (kind: RecordKind, filters: RecordFilters, title: string) => void
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/users/${encodeURIComponent(userId)}`)
      .then((res) => readJson<UserDetail & { error?: string }>(res).then((body) => ({ res, body })))
      .then(({ res, body }) => {
        if (cancelled) return
        if (!res.ok || !body) throw new Error(body?.error || "טעינת פרטי המשתמש נכשלה")
        setDetail(body)
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
  }, [userId])

  const displayName = detail ? (detail.user.fullName ?? detail.user.username) : "משתמש"

  return (
    <AdminModal title={displayName} subtitle={detail?.user.email} onClose={onClose}>
      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-neutral-400">
          <Loader2 className="animate-spin text-[#ff7a3d]" size={18} /> טוען...
        </div>
      ) : error || !detail ? (
        <div className="py-6 flex items-center gap-2 text-red-300">
          <AlertCircle size={18} /> {error}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Field label="מוסד" value={detail.user.institution} />
            <Field label="תואר" value={detail.user.degree} />
            <Field label="שנה / גיל" value={`${detail.user.studyYear ?? "—"} · ${detail.user.age ?? "—"}`} />
            <Field label="תפקיד" value={detail.user.role} />
            <Field label="הצטרף" value={formatDate(detail.user.createdAt)} />
            <Field label="כניסה אחרונה" value={formatDate(detail.user.lastLoginAt)} />
            <Field label="קורסים רשום" value={detail.totals.enrolledCourses.toLocaleString()} />
            <Field label="שם משתמש" value={detail.user.username} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="קריאות למודלים" value={detail.totals.modelCalls.toLocaleString()} />
            <Stat label="עלות מוערכת" value={formatIls(detail.totals.costUsd)} />
            <Stat label="אירועי פעילות" value={detail.totals.activityEvents.toLocaleString()} />
            <Stat label="סשנים של למידה" value={detail.totals.learningSessions.toLocaleString()} />
            <Stat label="זמן למידה" value={formatSeconds(detail.totals.learningSeconds)} />
            <Stat label="שאלות בצ׳אט" value={detail.totals.chatRequests.toLocaleString()} />
            <Stat label="העלאות" value={detail.totals.uploadRequests.toLocaleString()} />
            <Stat label="מבחנים" value={detail.totals.quizRequests.toLocaleString()} />
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <LinkButton icon={Cpu} onClick={() => onOpenRecords("calls", { userId }, `קריאות למודלים — ${displayName}`)}>
              כל הקריאות למודלים
            </LinkButton>
            <LinkButton icon={Activity} onClick={() => onOpenRecords("activity", { userId }, `פעילות — ${displayName}`)}>
              כל הפעילות
            </LinkButton>
            <LinkButton icon={GraduationCap} onClick={() => onOpenRecords("learning", { userId }, `סשנים של למידה — ${displayName}`)}>
              כל סשנים הלמידה
            </LinkButton>
          </div>
        </div>
      )}
    </AdminModal>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="text-neutral-200">{value ?? "—"}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-[#242b3a] bg-[#161b26] p-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="text-lg text-[#ffb066] tabular-nums">{value}</div>
    </div>
  )
}

function LinkButton({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof Cpu
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 p-3 rounded-sm border border-[#242b3a] bg-[#161b26] text-sm text-neutral-200 hover:border-[#ff7a3d]/60 transition-colors"
    >
      <Icon size={16} className="text-[#ffb066]" /> {children}
    </button>
  )
}
