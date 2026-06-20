"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { BookOpen, PlayCircle, Loader2, Sparkles } from "lucide-react"
import { OnboardingModal } from "@/components/onboarding-modal"

const barData = [
  { name: "שבוע 1", hours: 12 },
  { name: "שבוע 2", hours: 19 },
  { name: "שבוע 3", hours: 15 },
  { name: "שבוע 4", hours: 22 },
  { name: "שבוע 5", hours: 28 },
]

const pieData = [
  { name: "נלמד", value: 70, color: "#d4af37" },
  { name: "נותר ללמוד", value: 30, color: "#2a2a2a" },
]

type Me = { onboardingCompleted: boolean; institution: string | null }

type Enrollment = {
  completionPercentage: number
  course: { id: string; courseCode: string; courseName: string; description: string | null }
}

export default function Dashboard() {
  const { data: session } = useSession()
  const displayName = session?.user?.fullName || session?.user?.username || "אורח"

  const [me, setMe] = useState<Me | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [meRes, enrRes] = await Promise.all([fetch("/api/me"), fetch("/api/enrollments")])
      if (meRes.ok) setMe(await meRes.json())
      if (enrRes.ok) {
        const data = await enrRes.json()
        setEnrollments(data.enrollments ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOnboardingCompleted = () => {
    setMe((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev))
    loadData() // refresh enrollments now that the user picked courses
  }

  const showOnboarding = !loading && me !== null && !me.onboardingCompleted

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 p-8" dir="rtl">
      {showOnboarding && <OnboardingModal onCompleted={handleOnboardingCompleted} />}

      <div className="max-w-6xl mx-auto space-y-8">

        {/* כותרת הדשבורד */}
        <header className="border-b border-[#2a2a2a] pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#FFD700]">
              AI Student | אזור אישי
            </h1>
            <p className="text-neutral-300 text-lg mt-2">
              ברוך הבא, <span className="font-semibold text-[#FFD700]">{displayName}</span>. הנה סיכום מצב הלמידה שלך.
            </p>
          </div>
          <Button variant="outline" className="bg-[#141414] border-[#d4af37]/40 text-[#d4af37] hover:bg-[#1f1f1f] hover:text-[#FFD700] hover:border-[#d4af37]">
            הגדרות פרופיל
          </Button>
        </header>

        {/* אזור הקורסים שלי */}
        <section>
          <h2 className="text-2xl font-semibold text-neutral-200 mb-4 flex items-center gap-2">
            <BookOpen className="text-[#d4af37]" size={24} />
            הקורסים שלי
          </h2>

          {loading ? (
            <div className="flex items-center gap-2 text-neutral-400 py-8">
              <Loader2 className="animate-spin text-[#d4af37]" size={20} />
              טוען את הקורסים שלך...
            </div>
          ) : enrollments.length === 0 ? (
            <Card className="bg-[#141414] border-[#2a2a2a] border-dashed">
              <CardContent className="py-10 text-center text-neutral-400">
                <Sparkles className="mx-auto text-[#d4af37] mb-3" size={28} />
                עדיין לא נרשמת לקורסים. השלם את ההרשמה כדי לפתוח את סביבת הלמידה.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enrollments.map(({ course, completionPercentage }) => (
                <Card key={course.id} className="bg-[#141414] border-[#2a2a2a] hover:border-[#d4af37]/60 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">{course.courseName}</CardTitle>
                    {course.description && (
                      <CardDescription className="text-neutral-400 mt-1">{course.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="w-full bg-[#1f1f1f] rounded-full h-2.5 mt-2">
                      <div
                        className="bg-gradient-to-r from-[#d4af37] to-[#FFD700] h-2.5 rounded-full"
                        style={{ width: `${Math.round(completionPercentage)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-neutral-500 mt-2 mb-4">הושלמו {Math.round(completionPercentage)}% ממטלות הקורס</p>
                    <div className="pt-4 border-t border-[#2a2a2a]">
                      <Link href={`/dashboard/${course.courseCode}`}>
                        <Button className="w-full bg-[#1f1f1f] hover:bg-[#d4af37] text-[#d4af37] hover:text-black border border-[#d4af37]/40 hover:border-[#d4af37] transition-colors flex items-center gap-2">
                          <PlayCircle size={18} />
                          היכנס ללמידה
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* אזור הגרפים */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#2a2a2a]">
          <Card className="bg-[#141414] border-[#2a2a2a] text-white shadow-xl shadow-[#d4af37]/10">
            <CardHeader>
              <CardTitle className="text-[#d4af37]">שעות למידה שבועיות</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="name" stroke="#a3a3a3" />
                  <YAxis stroke="#a3a3a3" />
                  <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#d4af37', color: '#fff' }} cursor={{ fill: '#ffffff10' }} />
                  <Bar dataKey="hours" fill="#d4af37" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2a2a2a] text-white shadow-xl shadow-[#d4af37]/10">
            <CardHeader>
              <CardTitle className="text-[#d4af37]">התקדמות כללית</CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#141414', borderColor: '#d4af37', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  )
}
