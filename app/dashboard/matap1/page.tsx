"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UploadCloud, FileText, ArrowRight, Send, Bot, User, Loader2, CheckCircle2 } from "lucide-react"

// קוד הקורס מזהה את הקורס בצד השרת (מפת ל-courseId דרך Prisma)
const COURSE_CODE = "matap1"

type UploadedDoc = { title: string; chunkCount: number }

export default function CoursePage() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "שלום! אני עוזר המחקר שלך לקורס מתפ 1. העלה חומרי לימוד, ואשמח לענות לך על כל שאלה במדויק מתוך החומר בלבד." }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Document ingestion state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setUploadStatus(`מעלה ומטמיע את "${file.name}"...`)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("courseCode", COURSE_CODE)

      const response = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "ההעלאה נכשלה")
      }

      setUploadedDocs((prev) => [...prev, { title: data.title, chunkCount: data.chunkCount }])
      setUploadStatus(null)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `המסמך "${data.title}" נטען ונוסף לבסיס הידע (${data.chunkCount} קטעים). עכשיו אפשר לשאול עליו שאלות.`,
        },
      ])
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "אירעה שגיאה בהעלאת המסמך")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { role: "user", text: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // קריאת ה-API האמיתית — מנוע ה-RAG (Pinecone + Gemini) בצד השרת
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          courseCode: COURSE_CODE,
          sessionId, // שומר על רצף השיחה (conversational memory)
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Request failed")
      }

      if (data.sessionId) setSessionId(data.sessionId)

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
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={onFileSelected}
                className="hidden"
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border-2 border-dashed border-[#2a2a2a] rounded-lg p-6 text-center bg-[#0a0a0a]/40 transition-colors hover:border-[#d4af37]/50 hover:bg-[#0a0a0a]/70 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 size={28} className="mx-auto text-[#d4af37] mb-2 animate-spin" />
                ) : (
                  <UploadCloud size={28} className="mx-auto text-neutral-500 mb-2" />
                )}
                <span className="text-xs text-neutral-300 block">
                  {isUploading ? "מעבד ומטמיע את המסמך..." : "לחץ להעלאת קובץ (PDF / TXT)"}
                </span>
                <span className="text-[10px] text-neutral-500 block mt-1">
                  הקובץ ייחתך, יוטמע (Embeddings) ויאוחסן ב-Pinecone
                </span>
              </button>

              {uploadStatus && !isUploading && (
                <p className="text-xs text-red-400 text-center">{uploadStatus}</p>
              )}

              <div className="space-y-2">
                {uploadedDocs.length === 0 && !isUploading && (
                  <p className="text-[11px] text-neutral-500 text-center">עדיין לא הועלו חומרים לקורס זה.</p>
                )}
                {uploadedDocs.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-xs text-neutral-300"
                  >
                    <FileText size={14} className="text-[#d4af37] shrink-0" />
                    <span className="truncate flex-1">{doc.title}</span>
                    <span className="flex items-center gap-1 text-[10px] text-green-400 shrink-0">
                      <CheckCircle2 size={12} />
                      {doc.chunkCount} קטעים
                    </span>
                  </div>
                ))}
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