"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ShieldCheck, Loader2, Users, BookOpen, FileText, Activity, LogOut,
  LogIn, BookPlus, FileUp, GraduationCap, AlertCircle,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { readJson } from "@/lib/http"

type AdminIdentity = { id: string; name: string }

type AdminUserRow = {
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
  isActive7d: boolean
  totalRequests: number
  requestBreakdown: { chat: number; upload: number; quiz: number }
  totalLearningMinutes: number
  lastIp: string | null
  lastUserAgent: string | null
}

type Overview = {
  totals: { userCount: number; courseCount: number; documentCount: number; activeUsers7d: number }
  users: AdminUserRow[]
  dailyActivity: { date: string; count: number }[]
}

type ActivityEventRow = {
  id: string
  type: string
  ip: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  user: { username: string; fullName: string | null }
}

const ACTIVITY_META: Record<string, { label: string; icon: typeof LogIn }> = {
  login: { label: "התחברות", icon: LogIn },
  course_created: { label: "יצירת קורס", icon: BookPlus },
  document_uploaded: { label: "העלאת מסמך", icon: FileUp },
  quiz_completed: { label: "השלמת מבחן תרגול", icon: GraduationCap },
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return "עכשיו"
  if (min < 60) return `לפני ${min} דק'`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `לפני ${hr} שע'`
  const day = Math.floor(hr / 24)
  if (day < 30) return `לפני ${day} ימים`
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })
}

/** Name+passcode gate, separate from the app's real login — see lib/admin-auth.ts. */
function AdminGate({ onAuthenticated }: { onAuthenticated: (admin: AdminIdentity) => void }) {
  const [profiles] = useState([
    { id: "roye", name: "רועי שכטר" },
    { id: "yerahmiel", name: "ירחמיאל ליפשיץ" },
  ])
  const [selected, setSelected] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!selected || !password) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: selected, password }),
      })
      const data = await readJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || "כניסה נכשלה")
      const chosen = profiles.find((p) => p.id === selected)!
      onAuthenticated(chosen)
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm glass-panel border border-[#242b3a] rounded-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <ShieldCheck className="mx-auto text-[#ff7a3d]" size={32} />
          <h1 className="font-serif text-xl gold-text">פאנל ניהול</h1>
        </div>

        {!selected ? (
          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className="w-full p-3 rounded-sm border border-[#242b3a] bg-[#161b26] text-white text-sm hover:border-[#ff7a3d]/60 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-400 text-center">
              מחובר כ-<span className="text-[#ffb066]">{profiles.find((p) => p.id === selected)?.name}</span>
            </p>
            <Input
              type="password"
              autoFocus
              placeholder="סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="bg-[#161b26] border-[#242b3a] text-white text-center focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
            />
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setSelected(null); setPassword(""); setError(null) }}
                className="flex-1 bg-transparent border-[#242b3a] text-neutral-300 hover:bg-[#161b26] hover:text-white rounded-sm"
              >
                חזרה
              </Button>
              <Button
                onClick={submit}
                disabled={!password || submitting}
                className="flex-1 bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "כניסה"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <Card className="glass-panel border-[#242b3a] text-white">
      <CardContent className="p-5 flex items-center gap-3">
        <div className="p-2.5 rounded-full bg-[#161b26] text-[#ffb066]"><Icon size={18} /></div>
        <div>
          <p className="text-2xl font-serif text-white">{value}</p>
          <p className="text-xs text-neutral-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AdminDashboard({ admin, onLogout }: { admin: AdminIdentity; onLogout: () => void }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [events, setEvents] = useState<ActivityEventRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [ovRes, actRes] = await Promise.all([fetch("/api/admin/overview"), fetch("/api/admin/activity")])
      const ovData = await readJson<Overview & { error?: string }>(ovRes)
      if (!ovRes.ok || !ovData) throw new Error(ovData?.error || "טעינת הנתונים נכשלה")
      setOverview(ovData)
      const actData = await readJson<{ events: ActivityEventRow[]; nextCursor: string | null }>(actRes)
      if (actRes.ok && actData) {
        setEvents(actData.events)
        setNextCursor(actData.nextCursor)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/admin/activity?cursor=${nextCursor}`)
      const data = await readJson<{ events: ActivityEventRow[]; nextCursor: string | null }>(res)
      if (res.ok && data) {
        setEvents((prev) => [...prev, ...data.events])
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    onLogout()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-neutral-400">
        <Loader2 className="animate-spin text-[#ff7a3d]" size={20} />
        טוען...
      </div>
    )
  }

  if (error || !overview) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-red-300 p-6" dir="rtl">
        <AlertCircle size={18} /> {error}
      </div>
    )
  }

  const maxCount = Math.max(1, ...overview.dailyActivity.map((d) => d.count))

  return (
    <div className="min-h-screen text-white p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-[#242b3a] pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-[#ff7a3d]" size={22} />
            <h1 className="font-serif text-2xl gold-text">פאנל ניהול</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-400">מחובר כ-<span className="text-[#ffb066]">{admin.name}</span></span>
            <Button
              onClick={logout}
              variant="outline"
              className="bg-transparent border-[#242b3a] text-neutral-300 hover:bg-[#161b26] hover:text-white rounded-sm flex items-center gap-1.5"
            >
              <LogOut size={14} /> יציאה
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="סה״כ משתמשים" value={overview.totals.userCount} />
          <StatCard icon={Activity} label="פעילים השבוע" value={overview.totals.activeUsers7d} />
          <StatCard icon={BookOpen} label="סה״כ קורסים" value={overview.totals.courseCount} />
          <StatCard icon={FileText} label="סה״כ מסמכים" value={overview.totals.documentCount} />
        </div>

        <Card className="glass-panel border-[#242b3a] text-white">
          <CardHeader>
            <CardTitle className="text-[#ffb066] flex items-center gap-2 font-sans text-sm font-medium">
              <Activity size={16} /> פעילות יומית (14 הימים האחרונים)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242b3a" />
                <XAxis
                  dataKey="date"
                  stroke="#8b93a3"
                  tickFormatter={(d: string) => new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                />
                <YAxis stroke="#8b93a3" allowDecimals={false} domain={[0, maxCount]} />
                <Tooltip contentStyle={{ backgroundColor: "#12161f", borderColor: "#ff7a3d", color: "#fff" }} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="count" fill="#ff7a3d" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-panel border-[#242b3a] text-white">
          <CardHeader>
            <CardTitle className="text-[#ffb066] flex items-center gap-2 font-sans text-sm font-medium">
              <Users size={16} /> משתמשים
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm text-right whitespace-nowrap">
              <thead>
                <tr className="text-neutral-500 text-xs border-b border-[#242b3a]">
                  <th className="py-2 pl-4 font-medium">שם</th>
                  <th className="py-2 pl-4 font-medium">מוסד / תואר</th>
                  <th className="py-2 pl-4 font-medium">שנה / גיל</th>
                  <th className="py-2 pl-4 font-medium">כניסה אחרונה</th>
                  <th className="py-2 pl-4 font-medium">IP אחרון</th>
                  <th className="py-2 pl-4 font-medium">בקשות</th>
                  <th className="py-2 pl-4 font-medium">דק׳ למידה</th>
                  <th className="py-2 font-medium">פעיל</th>
                </tr>
              </thead>
              <tbody>
                {overview.users.map((u) => (
                  <tr key={u.id} className="border-b border-[#161b26] text-neutral-300">
                    <td className="py-2.5 pl-4">
                      <div className="text-white">{u.fullName ?? u.username}</div>
                      <div className="text-[11px] text-neutral-500">{u.email}</div>
                    </td>
                    <td className="py-2.5 pl-4 text-xs">
                      <div>{u.institution ?? "—"}</div>
                      <div className="text-neutral-500">{u.degree ?? "—"}</div>
                    </td>
                    <td className="py-2.5 pl-4 text-xs">{u.studyYear ?? "—"} · {u.age ?? "—"}</td>
                    <td className="py-2.5 pl-4 text-xs">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : "מעולם לא"}</td>
                    <td className="py-2.5 pl-4 text-xs font-mono">{u.lastIp ?? "—"}</td>
                    <td className="py-2.5 pl-4 text-xs" title={`צ׳אט ${u.requestBreakdown.chat} · העלאות ${u.requestBreakdown.upload} · מבחנים ${u.requestBreakdown.quiz}`}>
                      {u.totalRequests}
                    </td>
                    <td className="py-2.5 pl-4 text-xs">{u.totalLearningMinutes}</td>
                    <td className="py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.isActive7d ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50" : "bg-[#161b26] text-neutral-500 border border-[#242b3a]"}`}>
                        {u.isActive7d ? "פעיל" : "לא פעיל"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="glass-panel border-[#242b3a] text-white">
          <CardHeader>
            <CardTitle className="text-[#ffb066] flex items-center gap-2 font-sans text-sm font-medium">
              <Activity size={16} /> פעילות אחרונה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {events.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">אין פעילות עדיין.</p>
            ) : (
              events.map((e) => {
                const meta = ACTIVITY_META[e.type] ?? { label: e.type, icon: Activity }
                const Icon = meta.icon
                return (
                  <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-[#161b26] last:border-0 text-sm">
                    <div className="p-1.5 rounded-full bg-[#161b26] text-[#ffb066] shrink-0"><Icon size={14} /></div>
                    <div className="flex-1 min-w-0">
                      <span className="text-white">{e.user.fullName ?? e.user.username}</span>
                      <span className="text-neutral-500"> — {meta.label}</span>
                    </div>
                    <span className="text-[11px] text-neutral-600 font-mono shrink-0">{e.ip ?? ""}</span>
                    <span className="text-[11px] text-neutral-500 shrink-0">{formatRelative(e.createdAt)}</span>
                  </div>
                )
              })
            )}
            {nextCursor && (
              <div className="pt-3 text-center">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="bg-transparent border-[#242b3a] text-neutral-300 hover:bg-[#161b26] hover:text-white rounded-sm text-xs"
                >
                  {loadingMore ? <Loader2 size={14} className="animate-spin" /> : "טען עוד"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true)
  const [admin, setAdmin] = useState<AdminIdentity | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/admin/session")
        const data = await readJson<{ admin: AdminIdentity | null }>(res)
        setAdmin(data?.admin ?? null)
      } finally {
        setChecking(false)
      }
    })()
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-400">
        <Loader2 className="animate-spin text-[#ff7a3d]" size={20} />
      </div>
    )
  }

  if (!admin) return <AdminGate onAuthenticated={setAdmin} />

  return <AdminDashboard admin={admin} onLogout={() => setAdmin(null)} />
}
