"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { BookOpen, UploadCloud, FileText, PlayCircle } from "lucide-react"

const barData = [
  { name: "שבוע 1", hours: 12 },
  { name: "שבוע 2", hours: 19 },
  { name: "שבוע 3", hours: 15 },
  { name: "שבוע 4", hours: 22 },
  { name: "שבוע 5", hours: 28 },
]

const pieData = [
  { name: "נלמד", value: 70, color: "#d4af37" },
  { name: "נותר ללמוד", value: 30, color: "#2a2a2a" }
]

const recentFiles = [
  { name: "סיכום_MIPS_וקונבנציות.pdf", size: "2.4 MB", date: "היום" },
  { name: "מצגת_C_Pointers.pdf", size: "1.1 MB", date: "אתמול" },
]

export default function Dashboard() {
  const { data: session } = useSession()
  const displayName = session?.user?.fullName || session?.user?.username || "אורח"

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 p-8" dir="rtl">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* קורס 1: מתפ 1 */}
            <Card className="bg-[#141414] border-[#2a2a2a] hover:border-[#d4af37]/60 transition-colors">
              <CardHeader>
                <CardTitle className="text-xl text-white">מתפ 1</CardTitle>
                <CardDescription className="text-neutral-400 mt-1">מבוא ללמידה וניתוח אלגוריתמים</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-[#1f1f1f] rounded-full h-2.5 mt-2">
                  <div className="bg-gradient-to-r from-[#d4af37] to-[#FFD700] h-2.5 rounded-full" style={{ width: '80%' }}></div>
                </div>
                <p className="text-xs text-neutral-500 mt-2 mb-4">הושלמו 80% ממטלות הקורס</p>
                <div className="pt-4 border-t border-[#2a2a2a]">
                  <Link href="/dashboard/matap1">
                    <Button className="w-full bg-[#1f1f1f] hover:bg-[#d4af37] text-[#d4af37] hover:text-black border border-[#d4af37]/40 hover:border-[#d4af37] transition-colors flex items-center gap-2">
                      <PlayCircle size={18} />
                      היכנס ללמידה
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* קורס 2: מתפ 2 */}
            <Card className="bg-[#141414] border-[#2a2a2a] hover:border-[#d4af37]/60 transition-colors">
              <CardHeader>
                <CardTitle className="text-xl text-white">מתפ 2</CardTitle>
                <CardDescription className="text-neutral-400 mt-1">מערכות לומדות ורשתות נוירונים</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-[#1f1f1f] rounded-full h-2.5 mt-2">
                  <div className="bg-gradient-to-r from-[#d4af37] to-[#FFD700] h-2.5 rounded-full" style={{ width: '35%' }}></div>
                </div>
                <p className="text-xs text-neutral-500 mt-2 mb-4">הושלמו 35% ממטלות הקורס</p>
                <div className="pt-4 border-t border-[#2a2a2a]">
                  <Link href="/dashboard/matap2">
                    <Button className="w-full bg-[#1f1f1f] hover:bg-[#d4af37] text-[#d4af37] hover:text-black border border-[#d4af37]/40 hover:border-[#d4af37] transition-colors flex items-center gap-2">
                      <PlayCircle size={18} />
                      היכנס ללמידה
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

          </div>
        </section>

        {/* אזור חומרי למידה והעלאה */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold text-neutral-200 mb-4 flex items-center gap-2">
              <UploadCloud className="text-[#d4af37]" size={24} />
              העלאת חומרי למידה כלליים
            </h2>
            <div className="bg-[#141414]/60 border-2 border-dashed border-[#2a2a2a] hover:border-[#d4af37]/50 transition-colors rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer h-48">
              <UploadCloud className="text-neutral-500 mb-4" size={40} />
              <p className="text-neutral-300 font-medium">גרור קבצי PDF, מצגות או סיכומים לכאן</p>
              <p className="text-neutral-500 text-sm mt-2 mb-4">או לחץ כדי לבחור קבצים מהמחשב</p>
              <Button className="bg-[#d4af37] hover:bg-[#FFD700] text-black font-semibold">
                בחר קבצים
              </Button>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-neutral-200 mb-4 flex items-center gap-2">
              <FileText className="text-[#d4af37]" size={24} />
              חומרים שעובדו
            </h2>
            <Card className="bg-[#141414] border-[#2a2a2a] h-48 overflow-y-auto">
              <CardContent className="p-4 space-y-4">
                {recentFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] hover:border-[#d4af37]/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="text-[#d4af37]" size={20} />
                      <div>
                        <p className="text-sm font-medium text-neutral-200">{file.name}</p>
                        <p className="text-xs text-neutral-500">{file.size} • נסרק {file.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
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
