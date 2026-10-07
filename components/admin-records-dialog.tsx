"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { AdminModal } from "@/components/admin-modal"
import { readJson } from "@/lib/http"
import {
  ACTIVITY_LABELS,
  ROUTE_LABELS,
  formatDateTimeSeconds,
  formatIls,
  formatSeconds,
  formatTokens,
} from "@/lib/admin-time"
import { useUsdToIlsRate } from "@/lib/use-exchange-rate"

export type RecordKind = "calls" | "activity" | "learning"
export type RecordFilters = { userId?: string; model?: string; route?: string }

type CallRow = {
  id: string
  at: string
  user: string
  provider: string
  model: string
  route: string
  feature: string
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  latencyMs: number
  ok: boolean
  fallbackFrom: string | null
}

type ActivityRow = { id: string; at: string; user: string; type: string; ip: string | null; userAgent: string | null }

type LearningRow = {
  id: string
  at: string
  user: string
  course: string
  durationSeconds: number | null
  activityType: string | null
}

type RecordRow = CallRow | ActivityRow | LearningRow

/** Only the last week is shown until the admin asks for everything. */
const RECENT_DAYS = 7

const KIND_TITLES: Record<RecordKind, string> = {
  calls: "קריאות למודלים",
  activity: "פעילות במערכת",
  learning: "סשנים של למידה",
}

export function AdminRecordsDialog({
  kind,
  filters = {},
  title,
  subtitle,
  onClose,
}: {
  kind: RecordKind
  filters?: RecordFilters
  title?: string
  subtitle?: string
  onClose: () => void
}) {
  const [allTime, setAllTime] = useState(false)
  const [rows, setRows] = useState<RecordRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rate = useUsdToIlsRate()

  const { userId, model, route } = filters

  // Fetch the first page whenever the scope (recent / all time) or the filters change.
  useEffect(() => {
    let cancelled = false
    const qs = new URLSearchParams({ kind })
    if (userId) qs.set("userId", userId)
    if (model) qs.set("model", model)
    if (route) qs.set("route", route)
    if (!allTime) qs.set("days", String(RECENT_DAYS))
    fetch(`/api/admin/records?${qs}`)
      .then((res) => readJson<{ rows: RecordRow[]; nextCursor: string | null; error?: string }>(res).then((body) => ({ res, body })))
      .then(({ res, body }) => {
        if (cancelled) return
        if (!res.ok || !body) throw new Error(body?.error || "טעינת הרשומות נכשלה")
        setRows(body.rows)
        setNextCursor(body.nextCursor)
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
  }, [kind, userId, model, route, allTime])

  const loadMore = async () => {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const qs = new URLSearchParams({ kind, cursor: nextCursor })
      if (userId) qs.set("userId", userId)
      if (model) qs.set("model", model)
      if (route) qs.set("route", route)
      if (!allTime) qs.set("days", String(RECENT_DAYS))
      const res = await fetch(`/api/admin/records?${qs}`)
      const body = await readJson<{ rows: RecordRow[]; nextCursor: string | null }>(res)
      if (res.ok && body) {
        setRows((prev) => [...prev, ...body.rows])
        setNextCursor(body.nextCursor)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const chooseScope = (all: boolean) => {
    setLoading(true)
    setError(null)
    setAllTime(all)
  }

  const scopeButton = (active: boolean) =>
    `text-xs px-3 py-1 rounded-sm border transition-colors ${
      active ? "border-[#ff7a3d] bg-[#ff7a3d]/15 text-[#ffb066]" : "border-[#242b3a] text-neutral-400 hover:text-white"
    }`

  return (
    <AdminModal title={title ?? KIND_TITLES[kind]} subtitle={subtitle} onClose={onClose}>
      <div className="flex gap-2 mb-4" role="group" aria-label="טווח זמן">
        <button type="button" onClick={() => chooseScope(false)} aria-pressed={!allTime} className={scopeButton(!allTime)}>
          {RECENT_DAYS} הימים האחרונים
        </button>
        <button type="button" onClick={() => chooseScope(true)} aria-pressed={allTime} className={scopeButton(allTime)}>
          כל ההיסטוריה
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-neutral-400">
          <Loader2 className="animate-spin text-[#ff7a3d]" size={18} /> טוען...
        </div>
      ) : error ? (
        <div className="py-6 flex items-center gap-2 text-red-300">
          <AlertCircle size={18} /> {error}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-neutral-400 text-xs sticky top-0 bg-[#12161f]">
              <tr className="border-b border-[#242b3a]">
                <th className="text-right py-2 pl-4 font-normal">זמן</th>
                {kind === "calls" && (
                  <>
                    <th className="text-right py-2 pl-4 font-normal">משתמש</th>
                    <th className="text-right py-2 pl-4 font-normal">מודל</th>
                    <th className="text-right py-2 pl-4 font-normal">סוג</th>
                    <th className="text-right py-2 pl-4 font-normal">טוקנים (קלט / פלט)</th>
                    <th className="text-right py-2 pl-4 font-normal">עלות מוערכת</th>
                    <th className="text-right py-2 pl-4 font-normal">זמן תגובה</th>
                    <th className="text-right py-2 font-normal">תוצאה</th>
                  </>
                )}
                {kind === "activity" && (
                  <>
                    <th className="text-right py-2 pl-4 font-normal">משתמש</th>
                    <th className="text-right py-2 pl-4 font-normal">פעולה</th>
                    <th className="text-right py-2 pl-4 font-normal">IP</th>
                    <th className="text-right py-2 font-normal">דפדפן</th>
                  </>
                )}
                {kind === "learning" && (
                  <>
                    <th className="text-right py-2 pl-4 font-normal">משתמש</th>
                    <th className="text-right py-2 pl-4 font-normal">קורס</th>
                    <th className="text-right py-2 pl-4 font-normal">משך</th>
                    <th className="text-right py-2 font-normal">סוג פעילות</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#242b3a]/50">
                  <td className="py-2 pl-4 tabular-nums font-mono text-xs">{formatDateTimeSeconds(row.at)}</td>
                  {kind === "calls" && "model" in row && (
                    <>
                      <td className="py-2 pl-4">{row.user}</td>
                      <td className="py-2 pl-4 font-mono text-xs text-[#ffb066]">{row.model}</td>
                      <td className="py-2 pl-4 text-neutral-300">{ROUTE_LABELS[row.route] ?? row.route}</td>
                      <td className="py-2 pl-4 tabular-nums">{formatTokens(row.inputTokens)} / {formatTokens(row.outputTokens)}</td>
                      <td className="py-2 pl-4 tabular-nums">{formatIls(row.costUsd, rate)}</td>
                      <td className="py-2 pl-4 tabular-nums">{row.latencyMs.toLocaleString()} ms</td>
                      <td className="py-2 text-xs">
                        {row.ok ? <span className="text-emerald-400">הצליח</span> : <span className="text-red-400">נכשל</span>}
                        {row.fallbackFrom && <span className="text-neutral-500"> · גיבוי</span>}
                      </td>
                    </>
                  )}
                  {kind === "activity" && "type" in row && (
                    <>
                      <td className="py-2 pl-4">{row.user}</td>
                      <td className="py-2 pl-4">{ACTIVITY_LABELS[row.type] ?? row.type}</td>
                      <td className="py-2 pl-4 font-mono text-xs">{row.ip ?? "—"}</td>
                      <td className="py-2 text-xs text-neutral-500 max-w-xs truncate" title={row.userAgent ?? ""}>{row.userAgent ?? "—"}</td>
                    </>
                  )}
                  {kind === "learning" && "course" in row && (
                    <>
                      <td className="py-2 pl-4">{row.user}</td>
                      <td className="py-2 pl-4">{row.course}</td>
                      <td className="py-2 pl-4 tabular-nums">{formatSeconds(row.durationSeconds)}</td>
                      <td className="py-2 text-neutral-300">{row.activityType ?? "—"}</td>
                    </>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-neutral-500">
                    {allTime ? "אין רשומות" : `אין רשומות ב-${RECENT_DAYS} הימים האחרונים`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {nextCursor && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-xs px-4 py-1.5 rounded-sm border border-[#242b3a] text-neutral-300 hover:text-white disabled:opacity-50"
              >
                {loadingMore ? <Loader2 size={14} className="animate-spin inline" /> : "טען עוד"}
              </button>
            </div>
          )}
        </div>
      )}
    </AdminModal>
  )
}
