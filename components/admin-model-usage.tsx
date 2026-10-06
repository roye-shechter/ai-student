"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertCircle, Cpu } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { readJson } from "@/lib/http"

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

type ModelUsageData = {
  totals: { calls: number; costUsd: number }
  byModel: ModelRow[]
  byRoute: { route: string; calls: number; costUsd: number }[]
  perUser: { userId: string; username: string; fullName: string | null; model: string; calls: number; costUsd: number }[]
  dailyCost: { date: string; costUsd: number; calls: number }[]
}

const ROUTE_LABELS: Record<string, string> = {
  standard: "שיחה רגילה",
  hard: "מתמטיקה / הנדסה קשה",
  visual: "שאלה עם תמונה",
  quick: "שאלה קצרה",
  verify: "בדיקה נוספת",
  quiz: "מבחנים",
}

function formatUsd(value: number): string {
  if (value === 0) return "$0"
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`
}

function formatTokens(value: number): string {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value)
}

export function AdminModelUsage() {
  const [data, setData] = useState<ModelUsageData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/models")
      .then((res) => readJson<ModelUsageData & { error?: string }>(res).then((body) => ({ res, body })))
      .then(({ res, body }) => {
        if (!res.ok || !body) throw new Error(body?.error || "טעינת נתוני המודלים נכשלה")
        setData(body)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "אירעה שגיאה"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="glass-panel border-[#242b3a] text-white">
        <CardContent className="p-5 flex items-center gap-2 text-neutral-400">
          <Loader2 className="animate-spin text-[#ff7a3d]" size={18} /> טוען נתוני מודלים...
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="glass-panel border-[#242b3a] text-white">
        <CardContent className="p-5 flex items-center gap-2 text-red-300">
          <AlertCircle size={18} /> {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="glass-panel border-[#242b3a] text-white">
          <CardContent className="p-5">
            <div className="text-xs text-neutral-400">סה״כ קריאות למודלים</div>
            <div className="text-2xl font-semibold text-[#ffb066] tabular-nums">{data.totals.calls.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-[#242b3a] text-white">
          <CardContent className="p-5">
            <div className="text-xs text-neutral-400">סה״כ עלות מוערכת</div>
            <div className="text-2xl font-semibold text-[#ffb066] tabular-nums">{formatUsd(data.totals.costUsd)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel border-[#242b3a] text-white">
        <CardHeader>
          <CardTitle className="text-[#ffb066] flex items-center gap-2 font-sans text-sm font-medium">
            <Cpu size={16} /> עלות יומית לפי ימים (14 הימים האחרונים)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.dailyCost}>
              <CartesianGrid strokeDasharray="3 3" stroke="#242b3a" />
              <XAxis dataKey="date" tick={{ fill: "#8b93a3", fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fill: "#8b93a3", fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: "#12161f", border: "1px solid #242b3a", color: "#f5f6f8" }}
                formatter={(value) => formatUsd(Number(value))}
              />
              <Bar dataKey="costUsd" fill="#ff7a3d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
                <th className="text-right py-2 font-normal">עלות</th>
                <th className="text-right py-2 font-normal">זמן תגובה ממוצע</th>
                <th className="text-right py-2 font-normal">כשלים / גיבוי</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.map((m) => (
                <tr key={`${m.provider}:${m.model}`} className="border-b border-[#242b3a]/50">
                  <td className="py-2 font-mono text-xs text-[#ffb066]">{m.model}</td>
                  <td className="py-2 text-neutral-300">{m.provider}</td>
                  <td className="py-2 tabular-nums">{m.calls.toLocaleString()}</td>
                  <td className="py-2 tabular-nums">{formatTokens(m.inputTokens)}</td>
                  <td className="py-2 tabular-nums">{formatTokens(m.outputTokens)}</td>
                  <td className="py-2 tabular-nums">{formatUsd(m.costUsd)}</td>
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
          <CardTitle className="text-[#ffb066] font-sans text-sm font-medium">שימוש לפי סוג שאלה (ניתוב)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-neutral-400 text-xs">
              <tr className="border-b border-[#242b3a]">
                <th className="text-right py-2 font-normal">סוג</th>
                <th className="text-right py-2 font-normal">קריאות</th>
                <th className="text-right py-2 font-normal">עלות</th>
              </tr>
            </thead>
            <tbody>
              {data.byRoute.map((r) => (
                <tr key={r.route} className="border-b border-[#242b3a]/50">
                  <td className="py-2">{ROUTE_LABELS[r.route] ?? r.route}</td>
                  <td className="py-2 tabular-nums">{r.calls.toLocaleString()}</td>
                  <td className="py-2 tabular-nums">{formatUsd(r.costUsd)}</td>
                </tr>
              ))}
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
                <th className="text-right py-2 font-normal">עלות</th>
              </tr>
            </thead>
            <tbody>
              {data.perUser.map((row) => (
                <tr key={`${row.userId}:${row.model}`} className="border-b border-[#242b3a]/50">
                  <td className="py-2">{row.fullName ?? row.username}</td>
                  <td className="py-2 font-mono text-xs text-neutral-300">{row.model}</td>
                  <td className="py-2 tabular-nums">{row.calls.toLocaleString()}</td>
                  <td className="py-2 tabular-nums">{formatUsd(row.costUsd)}</td>
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
    </div>
  )
}
