"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertCircle, Cpu } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { readJson } from "@/lib/http"
import { formatDayLabel, formatDayLong, formatDateTimeSeconds, formatIls, formatTokens, ROUTE_LABELS } from "@/lib/admin-time"
import { useUsdToIlsRate } from "@/lib/use-exchange-rate"
import { AdminRecordsDialog, type RecordFilters, type RecordKind } from "@/components/admin-records-dialog"

type Drill = { kind: RecordKind; filters: RecordFilters; title: string }

type ModelRow = {
  provider: string
  model: string
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  costUsd: number
  avgLatencyMs: number
  failures: number
  fallbacks: number
}

type RecentCall = {
  id: string
  createdAt: string
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

type DayRange = 7 | 14 | 30

type SessionRow = {
  id: string
  userId: string
  username: string
  fullName: string | null
  courseCode: string
  courseName: string
  activityType: string | null
  sessionStart: string
  sessionEnd: string
  durationMinutes: number
  calls: number
  costUsd: number
}

type ModelUsageData = {
  days: DayRange
  totals: { calls: number; costUsd: number }
  byModel: ModelRow[]
  byRoute: { route: string; calls: number; costUsd: number; avgCostUsd: number }[]
  perUser: { userId: string; username: string; fullName: string | null; model: string; calls: number; costUsd: number }[]
  dailyCost: { date: string; costUsd: number; calls: number }[]
  recentCalls: RecentCall[]
  bySession: SessionRow[]
}

const ACTIVITY_LABELS: Record<string, string> = { chat: "צ׳אט", quiz: "מבחן תרגול" }

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} דק׳`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} ש׳ ${rest} דק׳` : `${hours} ש׳`
}

const DAY_RANGES: DayRange[] = [7, 14, 30]

export function AdminModelUsage() {
  const [data, setData] = useState<ModelUsageData | null>(null)
  const [days, setDays] = useState<DayRange>(14)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [drill, setDrill] = useState<Drill | null>(null)
  const rate = useUsdToIlsRate()

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/models?days=${days}`)
      .then((res) => readJson<ModelUsageData & { error?: string }>(res).then((body) => ({ res, body })))
      .then(({ res, body }) => {
        if (cancelled) return
        if (!res.ok || !body) throw new Error(body?.error || "טעינת נתוני המודלים נכשלה")
        setData(body)
        setError(null)
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
  }, [days])

  if (loading && !data) {
    return (
      <Card className="glass-panel border-[#242b3a] text-white">
        <CardContent className="p-5 flex items-center gap-2 text-neutral-400">
          <Loader2 className="animate-spin text-[#ff7a3d]" size={18} /> טוען נתוני מודלים...
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="glass-panel border-[#242b3a] text-white">
        <CardContent className="p-5 flex items-center gap-2 text-red-300">
          <AlertCircle size={18} /> {error}
        </CardContent>
      </Card>
    )
  }

  const rangeCost = data.dailyCost.reduce((sum, d) => sum + d.costUsd, 0)
  const rangeCalls = data.dailyCost.reduce((sum, d) => sum + d.calls, 0)
  const newestFirst = [...data.dailyCost].reverse()

  return (
    <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-2 gap-4">
        <Card
          className="glass-panel border-[#242b3a] text-white cursor-pointer hover:border-[#ff7a3d]/60 transition-colors"
          onClick={() => setDrill({ kind: "calls", filters: {}, title: "כל הקריאות למודלים" })}
        >
          <CardContent className="p-5">
            <div className="text-xs text-neutral-400">סה״כ קריאות למודלים</div>
            <div className="text-2xl font-semibold text-[#ffb066] tabular-nums">{data.totals.calls.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card
          className="glass-panel border-[#242b3a] text-white cursor-pointer hover:border-[#ff7a3d]/60 transition-colors"
          onClick={() => setDrill({ kind: "calls", filters: {}, title: "כל הקריאות למודלים" })}
        >
          <CardContent className="p-5">
            <div className="text-xs text-neutral-400">סה״כ עלות מוערכת</div>
            <div className="text-2xl font-semibold text-[#ffb066] tabular-nums">{formatIls(data.totals.costUsd, rate)}</div>
            <div className="text-[11px] text-neutral-500 mt-1">
              מחושבת מספירת טוקנים לפי מחירון הספקים (בדולרים), והומרה לשקלים לפי שער חליפין עדכני (₪{rate.toFixed(3)} לדולר, מתעדכן מדי כמה שעות). הספקים לא מחזירים עלות דרך ה-API, לכן זו הערכה ולא חשבונית.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel border-[#242b3a] text-white">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-[#ffb066] flex items-center gap-2 font-sans text-sm font-medium">
            <Cpu size={16} /> עלות יומית (ימים לפי שעון ישראל)
          </CardTitle>
          <div className="flex items-center gap-1" role="group" aria-label="טווח ימים">
            <button
              type="button"
              onClick={() => setDrill({ kind: "calls", filters: {}, title: "כל הקריאות למודלים" })}
              className="text-xs text-neutral-400 hover:text-white underline underline-offset-4 ml-2"
            >
              כל הקריאות
            </button>
            {DAY_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDays(range)}
                aria-pressed={days === range}
                className={`text-xs px-3 py-1 rounded-sm border transition-colors ${
                  days === range
                    ? "border-[#ff7a3d] bg-[#ff7a3d]/15 text-[#ffb066]"
                    : "border-[#242b3a] text-neutral-400 hover:text-white"
                }`}
              >
                {range} ימים
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyCost}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242b3a" />
                <XAxis dataKey="date" tick={{ fill: "#8b93a3", fontSize: 11 }} tickFormatter={formatDayLabel} minTickGap={12} />
                <YAxis tick={{ fill: "#8b93a3", fontSize: 11 }} tickFormatter={(v: number) => `₪${(v * rate).toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ background: "#12161f", border: "1px solid #242b3a", color: "#f5f6f8" }}
                  labelFormatter={(d) => formatDayLong(String(d))}
                  formatter={(value) => formatIls(Number(value), rate)}
                />
                <Bar dataKey="costUsd" fill="#ff7a3d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="max-h-72 overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-neutral-400 text-xs sticky top-0 bg-[#12161f]">
                <tr className="border-b border-[#242b3a]">
                  <th className="text-right py-2 font-normal">יום</th>
                  <th className="text-right py-2 font-normal">קריאות</th>
                  <th className="text-right py-2 font-normal">עלות מוערכת</th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((d) => (
                  <tr key={d.date} className="border-b border-[#242b3a]/50">
                    <td className="py-2">{formatDayLong(d.date)}</td>
                    <td className="py-2 tabular-nums">{d.calls.toLocaleString()}</td>
                    <td className="py-2 tabular-nums">{formatIls(d.costUsd, rate)}</td>
                  </tr>
                ))}
                <tr className="text-[#ffb066]">
                  <td className="py-2 font-medium">סה״כ {days} ימים</td>
                  <td className="py-2 tabular-nums font-medium">{rangeCalls.toLocaleString()}</td>
                  <td className="py-2 tabular-nums font-medium">{formatIls(rangeCost, rate)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-[#242b3a] text-white">
        <CardHeader>
          <CardTitle className="text-[#ffb066] font-sans text-sm font-medium">שימוש לפי מודל</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-neutral-400 text-xs">
              <tr className="border-b border-[#242b3a]">
                <th className="text-right py-2 font-normal">מודל</th>
                <th className="text-right py-2 font-normal">ספק</th>
                <th className="text-right py-2 font-normal">קריאות</th>
                <th className="text-right py-2 font-normal">טוקני קלט</th>
                <th className="text-right py-2 font-normal">טוקני פלט</th>
                <th className="text-right py-2 font-normal">עלות מוערכת</th>
                <th className="text-right py-2 font-normal">זמן תגובה ממוצע</th>
                <th className="text-right py-2 font-normal">כשלים / גיבוי</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.map((m) => (
                <tr
                  key={`${m.provider}:${m.model}`}
                  onClick={() => setDrill({ kind: "calls", filters: { model: m.model }, title: `קריאות — ${m.model}` })}
                  className="border-b border-[#242b3a]/50 cursor-pointer hover:bg-[#161b26]/60"
                >
                  <td className="py-2 font-mono text-xs text-[#ffb066]">{m.model}</td>
                  <td className="py-2 text-neutral-300">{m.provider}</td>
                  <td className="py-2 tabular-nums">{m.calls.toLocaleString()}</td>
                  <td className="py-2 tabular-nums">{formatTokens(m.inputTokens)}</td>
                  <td className="py-2 tabular-nums">{formatTokens(m.outputTokens)}</td>
                  <td className="py-2 tabular-nums">{formatIls(m.costUsd, rate)}</td>
                  <td className="py-2 tabular-nums">{m.avgLatencyMs.toLocaleString()} ms</td>
                  <td className="py-2 tabular-nums">{m.failures} / {m.fallbacks}</td>
                </tr>
              ))}
              {data.byModel.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-neutral-500">עדיין אין קריאות מתועדות</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="glass-panel border-[#242b3a] text-white">
        <CardHeader>
          <CardTitle className="text-[#ffb066] flex items-center gap-2 font-sans text-sm font-medium">
            קריאות אחרונות (100 האחרונות, עם שעה ושנייה)
            <button
              type="button"
              onClick={() => setDrill({ kind: "calls", filters: {}, title: "כל הקריאות למודלים" })}
              className="mr-auto text-xs text-neutral-400 hover:text-white underline underline-offset-4"
            >
              כל הקריאות
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-neutral-400 text-xs sticky top-0 bg-[#12161f]">
              <tr className="border-b border-[#242b3a]">
                <th className="text-right py-2 pl-4 font-normal">זמן הקריאה</th>
                <th className="text-right py-2 pl-4 font-normal">משתמש</th>
                <th className="text-right py-2 pl-4 font-normal">מודל</th>
                <th className="text-right py-2 pl-4 font-normal">סוג</th>
                <th className="text-right py-2 pl-4 font-normal">טוקנים (קלט / פלט)</th>
                <th className="text-right py-2 pl-4 font-normal">עלות מוערכת</th>
                <th className="text-right py-2 pl-4 font-normal">זמן תגובה</th>
                <th className="text-right py-2 font-normal">תוצאה</th>
              </tr>
            </thead>
            <tbody>
              {data.recentCalls.map((c) => (
                <tr key={c.id} className="border-b border-[#242b3a]/50">
                  <td className="py-2 pl-4 tabular-nums font-mono text-xs">{formatDateTimeSeconds(c.createdAt)}</td>
                  <td className="py-2 pl-4">{c.user}</td>
                  <td className="py-2 pl-4 font-mono text-xs text-[#ffb066]">{c.model}</td>
                  <td className="py-2 pl-4 text-neutral-300">{ROUTE_LABELS[c.route] ?? c.route}</td>
                  <td className="py-2 pl-4 tabular-nums">{formatTokens(c.inputTokens)} / {formatTokens(c.outputTokens)}</td>
                  <td className="py-2 pl-4 tabular-nums">{formatIls(c.costUsd, rate)}</td>
                  <td className="py-2 pl-4 tabular-nums">{c.latencyMs.toLocaleString()} ms</td>
                  <td className="py-2 text-xs">
                    {c.ok ? (
                      <span className="text-emerald-400">הצליח</span>
                    ) : (
                      <span className="text-red-400">נכשל</span>
                    )}
                    {c.fallbackFrom && <span className="text-neutral-500"> · גיבוי ל-{c.model}</span>}
                  </td>
                </tr>
              ))}
              {data.recentCalls.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-neutral-500">עדיין אין קריאות מתועדות</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="glass-panel border-[#242b3a] text-white">
        <CardHeader>
          <CardTitle className="text-[#ffb066] font-sans text-sm font-medium">שימוש לפי סוג שאלה (ניתוב)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <p className="text-[11px] text-neutral-500 mb-2">
            העמודה ״סה״כ עלות״ היא סכום כל הקריאות מהסוג הזה בטווח שנבחר — לא המחיר של שאלה אחת. לעלות שאלה בודדת ראה את העמודה ״ממוצע לשאלה״.
          </p>
          <table className="w-full text-sm">
            <thead className="text-neutral-400 text-xs">
              <tr className="border-b border-[#242b3a]">
                <th className="text-right py-2 font-normal">סוג</th>
                <th className="text-right py-2 font-normal">קריאות</th>
                <th className="text-right py-2 font-normal">סה״כ עלות</th>
                <th className="text-right py-2 font-normal">ממוצע לשאלה</th>
              </tr>
            </thead>
            <tbody>
              {data.byRoute.map((r) => (
                <tr
                  key={r.route}
                  onClick={() => setDrill({ kind: "calls", filters: { route: r.route }, title: `קריאות — ${ROUTE_LABELS[r.route] ?? r.route}` })}
                  className="border-b border-[#242b3a]/50 cursor-pointer hover:bg-[#161b26]/60"
                >
                  <td className="py-2">{ROUTE_LABELS[r.route] ?? r.route}</td>
                  <td className="py-2 tabular-nums">{r.calls.toLocaleString()}</td>
                  <td className="py-2 tabular-nums">{formatIls(r.costUsd, rate)}</td>
                  <td className="py-2 tabular-nums text-[#ffb066]">{formatIls(r.avgCostUsd, rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="glass-panel border-[#242b3a] text-white">
        <CardHeader>
          <CardTitle className="text-[#ffb066] font-sans text-sm font-medium">עלות משוערת לפי סשן למידה</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto max-h-96 overflow-y-auto">
          <p className="text-[11px] text-neutral-500 mb-2">
            סשן = רצף פעילות רצוף של אותו סטודנט באותו קורס (עד 30 דקות הפסקה ביניהן נחשבות אותו סשן). העלות היא הערכה — כל קריאת מודל בטווח הזמן של הסשן, לא חיוב מדויק.
          </p>
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-neutral-400 text-xs sticky top-0 bg-[#12161f]">
              <tr className="border-b border-[#242b3a]">
                <th className="text-right py-2 pl-4 font-normal">התחלה</th>
                <th className="text-right py-2 pl-4 font-normal">משתמש</th>
                <th className="text-right py-2 pl-4 font-normal">קורס</th>
                <th className="text-right py-2 pl-4 font-normal">סוג</th>
                <th className="text-right py-2 pl-4 font-normal">משך</th>
                <th className="text-right py-2 pl-4 font-normal">קריאות</th>
                <th className="text-right py-2 font-normal">עלות משוערת</th>
              </tr>
            </thead>
            <tbody>
              {data.bySession.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setDrill({ kind: "calls", filters: { userId: s.userId }, title: `קריאות — ${s.fullName ?? s.username} · ${s.courseCode}` })}
                  className="border-b border-[#242b3a]/50 cursor-pointer hover:bg-[#161b26]/60"
                >
                  <td className="py-2 pl-4 tabular-nums font-mono text-xs">{formatDateTimeSeconds(s.sessionStart)}</td>
                  <td className="py-2 pl-4">{s.fullName ?? s.username}</td>
                  <td className="py-2 pl-4 text-neutral-300">{s.courseCode}</td>
                  <td className="py-2 pl-4 text-neutral-300">{ACTIVITY_LABELS[s.activityType ?? ""] ?? s.activityType ?? "—"}</td>
                  <td className="py-2 pl-4 tabular-nums">{formatDurationMinutes(s.durationMinutes)}</td>
                  <td className="py-2 pl-4 tabular-nums">{s.calls.toLocaleString()}</td>
                  <td className="py-2 tabular-nums text-[#ffb066]">{formatIls(s.costUsd, rate)}</td>
                </tr>
              ))}
              {data.bySession.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-neutral-500">עדיין אין סשנים מתועדים בטווח הזה</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="glass-panel border-[#242b3a] text-white">
        <CardHeader>
          <CardTitle className="text-[#ffb066] font-sans text-sm font-medium">שימוש לפי משתמש ומודל</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-neutral-400 text-xs sticky top-0 bg-[#12161f]">
              <tr className="border-b border-[#242b3a]">
                <th className="text-right py-2 font-normal">משתמש</th>
                <th className="text-right py-2 font-normal">מודל</th>
                <th className="text-right py-2 font-normal">קריאות</th>
                <th className="text-right py-2 font-normal">עלות מוערכת</th>
              </tr>
            </thead>
            <tbody>
              {data.perUser.map((row) => (
                <tr
                  key={`${row.userId}:${row.model}`}
                  onClick={() => setDrill({ kind: "calls", filters: { userId: row.userId, model: row.model }, title: `קריאות — ${row.fullName ?? row.username} · ${row.model}` })}
                  className="border-b border-[#242b3a]/50 cursor-pointer hover:bg-[#161b26]/60"
                >
                  <td className="py-2">{row.fullName ?? row.username}</td>
                  <td className="py-2 font-mono text-xs text-neutral-300">{row.model}</td>
                  <td className="py-2 tabular-nums">{row.calls.toLocaleString()}</td>
                  <td className="py-2 tabular-nums">{formatIls(row.costUsd, rate)}</td>
                </tr>
              ))}
              {data.perUser.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-neutral-500">עדיין אין קריאות מתועדות</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {drill && (
        <AdminRecordsDialog
          kind={drill.kind}
          filters={drill.filters}
          title={drill.title}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  )
}
