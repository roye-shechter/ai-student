"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UploadCloud, FileText, ArrowRight, Send, Bot, User, Loader2 } from "lucide-react"

// טקסט לדוגמה שמדמה חומר לימוד שהועלה (לצורך בדיקת ה-AI)
const mockCourseContext = `
קורס מתפ 1 - סיכום הרצאה 1:
בדיון על מודלים של רשתות נוירונים, פונקציית העלות (Loss Function) שנבחרה לאופטימיזציה היא MSE (Mean Squared Error).
קצב הלמידה (Learning Rate) שנקבע כברירת מחדל לפרויקט הוא 0.001. 
משקולות הרשת מאותחלות בצורה אקראית לפי הפצת גאוסיאן עם ממוצע 0 וסטיית תקן 0.01.
אין להשתמש בפונקציית אקטיבציה מסוג Sigmoid בשכבות החבויות בשל בעיית התפוגגות הגרדיאנט (Vanishing Gradient).
`;

export default function CoursePage() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "שלום! אני עוזר המחקר שלך לקורס מתפ 1. העלה חומרי לימוד, ואשמח לענות לך על כל שאלה במדויק מתוך החומר בלבד." }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { role: "user", text: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // קריאת ה-API האמיתית לשרת של ג'מיני שיצרנו
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          context: mockCourseContext // שולחים את חומר הלימוד המדומה
        }),
      })

      const data = await response.json()

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.text || "לא התקבלה תשובה תקינה." }
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "מתקשה להתחבר לשרת ה-AI. ודא שהגדרת את המפתח נכון בקובץ .env.local" }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col" dir="rtl">
      <div className="border-b border-[#2a2a2a] bg-[#141414]/50 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-neutral-400 hover:text-[#d4af37] transition-colors text-sm">
            <ArrowRight size={16} />
            חזרה לדשבורד הראשי
          </Link>
          <span className="text-xs bg-[#2a2410] text-[#FFD700] border border-[#d4af37]/40 px-2 py-1 rounded">סביבת לימוד מבוססת AI</span>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">

        {/* חלק ימין: חומרי לימוד */}
        <div className="space-y-6 flex flex-col">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#FFD700]">מתפ 1</h1>
            <p className="text-neutral-400 text-sm mt-1">מבוא ללמידה וניתוח אלגוריתמים</p>
          </div>

          <Card className="bg-[#141414] border-[#2a2a2a] text-white flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg text-[#d4af37] flex items-center gap-2">
                <UploadCloud size={20} />
                חומרי קורס זה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 overflow-y-auto">
              <div className="border-2 border-dashed border-[#2a2a2a] rounded-lg p-4 text-center bg-[#0a0a0a]/40">
                <UploadCloud size={28} className="mx-auto text-neutral-500 mb-2" />
                <span className="text-xs text-neutral-300 block">הוראה 1 (נטען אוטומטית כבסיס ידע לטסט)</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-xs text-neutral-300">
                  <FileText size={14} className="text-[#d4af37]" />
                  <span className="truncate">הרצאה_1_מבוא_ומודלים.pdf</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* חלק שמאל: הצ'אט האמיתי */}
        <Card className="bg-[#141414] border-[#2a2a2a] text-white lg:col-span-2 flex flex-col h-[calc(100vh-140px)] shadow-2xl shadow-[#d4af37]/10">
          <CardHeader className="border-b border-[#2a2a2a] pb-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Bot className="text-[#d4af37]" size={22} />
              עוזר למידה אישי מבוסס מסמכים
            </CardTitle>
            <CardDescription className="text-neutral-400 text-xs">שאל כל דבר על החומר; ה-AI מונחה להשיב אך ורק מתוך מסמכי הקורס שהועלו.</CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"}`}>
                <div className={`p-2 rounded-lg flex h-8 w-8 items-center justify-center shrink-0 ${msg.role === "user" ? "bg-[#d4af37] text-black" : "bg-[#1f1f1f] text-[#d4af37]"}`}>
                  {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-xl text-sm leading-relaxed ${msg.role === "user" ? "bg-[#d4af37] text-black rounded-tl-none text-left" : "bg-[#1f1f1f] text-neutral-100 rounded-tr-none"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 ml-auto items-center text-neutral-400 text-sm">
                <Loader2 className="animate-spin text-[#d4af37]" size={18} />
                ג'מיני חושב ומנתח את חומרי הלימוד...
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-[#2a2a2a] p-4 bg-[#0a0a0a]/20">
            <div className="flex w-full gap-2 items-center">
              <Input
                type="text"
                placeholder="שאל אותי על חומר הלימוד של מתפ 1..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="bg-[#1f1f1f] border-[#2a2a2a] text-white focus-visible:ring-[#d4af37] focus-visible:border-[#d4af37] h-12 flex-1"
                disabled={isLoading}
              />
              <Button onClick={handleSendMessage} disabled={isLoading} className="bg-[#d4af37] hover:bg-[#FFD700] text-black h-12 px-4 transition-colors">
                <Send size={18} className="rotate-180" />
              </Button>
            </div>
          </CardFooter>
        </Card>

      </div>
    </div>
  )
}