"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { upload } from "@vercel/blob/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { readJson } from "@/lib/http"
import { MarkdownMessage } from "@/components/markdown-message"
import { SourceCitations, type SourceChunk } from "@/components/chat/source-citations"
import { gsap, useGSAP } from "@/lib/gsap"
import {
  UploadCloud, FileText, FileAudio, ArrowRight, Send, Bot, User, Loader2, CheckCircle2, AlertCircle, Clock, Square, RotateCcw, GraduationCap,
} from "lucide-react"

type CourseInfo = {
  id: string
  courseCode: string
  courseName: string
  description: string | null
}

type CourseDocument = {
  id: string
  title: string
  fileType: string | null
  chunkCount: number
  status: string
  createdAt: string
}

type ChatMessage = { role: string; text: string; chunks?: SourceChunk[] }

type ChatStreamEvent =
  | { type: "sources"; chunks: SourceChunk[]; sessionId: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]
function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || AUDIO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  indexed: { label: "מאונדקס", className: "text-emerald-400" },
  processing: { label: "מעבד", className: "text-[#ffb066]" },
  pending: { label: "ממתין", className: "text-neutral-400" },
  failed: { label: "נכשל", className: "text-red-400" },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "text-neutral-400" }
  const Icon =
    status === "indexed" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? Loader2 : Clock
  return (
    <span className={`flex items-center gap-1 text-[10px] shrink-0 ${meta.className}`}>
      <Icon size={12} className={status === "processing" ? "animate-spin" : ""} />
      {meta.label}
    </span>
  )
}

/** The tutor's "thinking" state — a three-dot wave rather than a bare
 * spinner, so waiting for the AI reads as a distinct, branded moment. */
function ThinkingIndicator() {
  return (
    <div className="flex gap-3 ml-auto items-center text-neutral-400 text-sm">
      <div className="p-2 rounded-lg flex h-8 w-8 items-center justify-center shrink-0 bg-[#161b26] text-[#ffb066]">
        <Bot size={16} />
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl rounded-tr-none bg-[#161b26]">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#ff7a3d]" style={{ animationDelay: "0ms" }} />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#ffb066]" style={{ animationDelay: "150ms" }} />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#ffb066]" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  )
}

export default function CoursePage() {
  // courseCode is read dynamically from the URL segment (no hardcoded constant).
  const params = useParams<{ courseCode: string }>()
  const courseCode = params.courseCode

  const [course, setCourse] = useState<CourseInfo | null>(null)
  const [documents, setDocuments] = useState<CourseDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [docsError, setDocsError] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "שלום! אני המורה הפרטי שלך לקורס זה. העלה חומרי לימוד, ואשמח ללמד אותך, להסביר ולענות על כל שאלה — מבוסס מדויק על החומר שהעלית." },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [streamStarted, setStreamStarted] = useState(false)
  const [chatError, setChatError] = useState<{ message: string; retryText: string } | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(".course-header", { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5 })
        .fromTo(".course-info-card", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.2")
        .fromTo(".course-docs-card", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.3")
        .fromTo(".course-chat-card", { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.5 }, "-=0.4")
    },
    { scope: rootRef }
  )

  // Load the course's display info + this user's previously uploaded documents.
  const loadDocuments = useCallback(async () => {
    if (!courseCode) return
    try {
      const res = await fetch(`/api/documents?courseCode=${encodeURIComponent(courseCode)}`)
      // Guard against non-JSON (HTML error page) responses so a server crash
      // surfaces a clean message instead of throwing "Unexpected token '<'".
      const data = await readJson<{ course?: CourseInfo; documents?: CourseDocument[]; error?: string }>(res)
      if (!res.ok || !data) {
        throw new Error(data?.error || `טעינת המסמכים נכשלה (קוד ${res.status})`)
      }
      setCourse(data.course ?? null)
      setDocuments(data.documents ?? [])
      setDocsError(null)
    } catch (error) {
      setDocsError(error instanceof Error ? error.message : "אירעה שגיאה")
    } finally {
      setDocsLoading(false)
    }
  }, [courseCode])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // While any document is still being processed in the background (see
  // app/api/upload/finalize/route.ts's after()), keep refreshing the list so
  // the existing StatusBadge moves from "ממתין"/"מעבד" to "מאונדקס"/"נכשל"
  // on its own, without a manual reload.
  useEffect(() => {
    const hasPending = documents.some((d) => d.status === "pending" || d.status === "processing")
    if (!hasPending) return
    const interval = setInterval(loadDocuments, 3000)
    return () => clearInterval(interval)
  }, [documents, loadDocuments])

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setUploadStatus(
      isAudioFile(file)
        ? `מעלה את ההקלטה "${file.name}"...`
        : `מעלה את "${file.name}"...`
    )
    try {
      // The browser PUTs the file straight to Vercel Blob storage — it never
      // passes through our own server, so there's no platform request-body
      // size limit to worry about.
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/upload/token",
      })

      setUploadStatus(`מטמיע את "${file.name}" ברקע...`)

      const response = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, fileName: file.name, courseCode }),
      })

      // The server can fail before our JSON handler runs and return an HTML
      // error page. readJson() returns null for non-JSON, so we surface the
      // backend's error message (or a status-based one) instead of crashing.
      const data = await readJson<{ error?: string; title?: string }>(response)
      if (!response.ok || !data) {
        throw new Error(
          data?.error || `השרת נתקל בשגיאה (קוד ${response.status}). נסה שוב מאוחר יותר.`
        )
      }

      setUploadStatus(null)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `המסמך "${data.title}" התקבל ומוטמע ברקע — הוא יופיע כזמין ברשימת החומרים תוך רגעים, ואז אפשר לשאול עליו.` },
      ])
      await loadDocuments() // refresh the persistent list from the DB (shows "ממתין"/"מעבד" immediately)
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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return
      setChatError(null)
      setMessages((prev) => [...prev, { role: "user", text }])
      setIsLoading(true)
      setStreamStarted(false)

      const controller = new AbortController()
      abortControllerRef.current = controller

      // Tracks whether we've already pushed the assistant bubble for this
      // turn (created lazily on the first "sources" event, since sources
      // arrive before the first token — see app/api/chat/route.ts).
      let assistantMessagePushed = false

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ message: text, courseCode, sessionId }),
        })

        if (!response.ok || !response.body) {
          // Failures before the stream starts (auth, rate limit, validation)
          // come back as plain JSON, not NDJSON.
          const data = await readJson<{ error?: string }>(response)
          throw new Error(
            data?.error || `השרת נתקל בשגיאה (קוד ${response.status}). נסה שוב מאוחר יותר.`
          )
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.trim()) continue
            const event = JSON.parse(line) as ChatStreamEvent

            if (event.type === "sources") {
              setSessionId(event.sessionId)
              assistantMessagePushed = true
              setMessages((prev) => [...prev, { role: "assistant", text: "", chunks: event.chunks }])
            } else if (event.type === "delta") {
              setStreamStarted(true)
              setMessages((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                next[next.length - 1] = { ...last, text: last.text + event.text }
                return next
              })
            } else if (event.type === "error") {
              throw new Error(event.message)
            }
            // "done" needs no action — isLoading is cleared in `finally`.
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          // User pressed "stop" — keep whatever partial answer streamed in.
        } else {
          const message = error instanceof Error ? error.message : "מתקשה להתחבר לשרת ה-AI."
          if (assistantMessagePushed) {
            // Drop the empty/partial bubble only if it never received any text.
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              return last?.role === "assistant" && last.text === "" ? prev.slice(0, -1) : prev
            })
          }
          setChatError({ message, retryText: text })
        }
      } finally {
        setIsLoading(false)
        setStreamStarted(false)
        abortControllerRef.current = null
      }
    },
    [isLoading, courseCode, sessionId]
  )

  const handleSendMessage = () => {
    if (!input.trim() || isLoading) return
    const text = input
    setInput("")
    sendMessage(text)
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
  }

  const handleRetry = () => {
    if (!chatError) return
    const { retryText } = chatError
    setChatError(null)
    sendMessage(retryText)
  }

  const courseTitle = course?.courseName ?? courseCode

  return (
    <div ref={rootRef} className="relative z-10 min-h-screen text-white flex flex-col" dir="rtl">
      <div className="course-header border-b border-[#242b3a] glass-panel p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-neutral-400 hover:text-[#ffb066] transition-colors text-sm">
            <ArrowRight size={16} />
            חזרה לדשבורד הראשי
          </Link>
          <span className="text-xs bg-[#2a2015] text-[#ffb066] border border-[#ff7a3d]/40 px-2 py-1 rounded">סביבת לימוד מבוססת AI</span>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">

        {/* חלק ימין: חומרי לימוד */}
        <div className="space-y-6 flex flex-col">
          <div className="course-info-card glass-panel border border-[#242b3a] rounded-sm p-6 space-y-3">
            <h1 className="font-serif gold-text text-3xl">{courseTitle}</h1>
            {course?.description && <p className="text-neutral-400 text-sm">{course.description}</p>}
            <Link href={`/dashboard/${courseCode}/quiz`} className="block">
              <Button className="w-full bg-[#2a2015] hover:bg-[#342a17] text-[#ffb066] border border-[#ff7a3d]/40 rounded-sm flex items-center gap-2 transition-all duration-300">
                <GraduationCap size={16} />
                התחל מבחן תרגול
              </Button>
            </Link>
          </div>

          <Card className="course-docs-card glass-panel border-[#242b3a] text-white flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg text-[#ffb066] flex items-center gap-2">
                <UploadCloud size={20} />
                חומרי קורס זה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 overflow-y-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,application/pdf,text/plain,audio/*,video/mp4,video/webm"
                onChange={onFileSelected}
                className="hidden"
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border-2 border-dashed border-[#242b3a] rounded-sm p-6 text-center bg-[#0a0e14]/40 transition-all duration-300 hover:border-[#ff7a3d]/60 hover:bg-[#0a0e14]/70 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 size={28} className="mx-auto text-[#ff7a3d] mb-2 animate-spin" />
                ) : (
                  <UploadCloud size={28} className="mx-auto text-neutral-500 mb-2" />
                )}
                <span className="text-xs text-neutral-300 block">
                  {isUploading ? uploadStatus ?? "מעלה..." : "עכשיו אתה יכול להעלות חומרים"}
                </span>
                <span className="text-[10px] text-neutral-500 block mt-1">
                  PDF / TXT — ייחתך ויוטמע · הקלטת הרצאה (MP3/WAV/M4A/MP4) — תתומלל אוטומטית ותוטמע
                </span>
              </button>

              {uploadStatus && !isUploading && (
                <p className="text-xs text-red-400 text-center">{uploadStatus}</p>
              )}

              <div className="space-y-2">
                {docsLoading ? (
                  <p className="text-[11px] text-neutral-500 text-center flex items-center justify-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> טוען חומרים שהועלו...
                  </p>
                ) : docsError ? (
                  <p className="text-[11px] text-red-400 text-center">{docsError}</p>
                ) : documents.length === 0 ? (
                  <p className="text-[11px] text-neutral-500 text-center">עדיין לא הועלו חומרים לקורס זה.</p>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 p-2 bg-[#0a0e14] border border-[#242b3a] rounded text-xs text-neutral-300"
                    >
                      {doc.fileType === "audio" ? (
                        <FileAudio size={14} className="text-[#ffb066] shrink-0" />
                      ) : (
                        <FileText size={14} className="text-[#ffb066] shrink-0" />
                      )}
                      <span className="truncate flex-1">{doc.title}</span>
                      <span className="text-[10px] text-neutral-500 shrink-0">{doc.chunkCount} קטעים</span>
                      <StatusBadge status={doc.status} />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* חלק שמאל: הצ'אט האמיתי */}
        <Card className="course-chat-card glass-panel border-[#242b3a] text-white lg:col-span-2 flex flex-col h-[calc(100vh-140px)] shadow-2xl shadow-black/30">
          <CardHeader className="border-b border-[#242b3a] pb-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Bot className="text-[#ff7a3d]" size={22} />
              המורה הפרטי שלך לקורס
            </CardTitle>
            <CardDescription className="text-neutral-400 text-xs">שאל כל שאלה על החומר — המורה הפרטי מלמד ומסביר בהתבסס אך ורק על מסמכי הקורס שהעלית.</CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
            {messages.map((msg, index) => {
              const isStreamingThisMessage = isLoading && streamStarted && index === messages.length - 1 && msg.role === "assistant"
              return (
                <div key={index} className={`msg-in flex gap-3 max-w-[85%] ${msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"}`}>
                  <div className={`p-2 rounded-full flex h-8 w-8 items-center justify-center shrink-0 ${msg.role === "user" ? "bg-[#ff7a3d] text-[#12161f]" : "bg-[#161b26] text-[#ffb066]"}`}>
                    {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`p-3 rounded-full text-sm leading-relaxed ${msg.role === "user" ? "bg-[#ff7a3d] text-[#12161f] text-left" : "bg-[#161b26] text-neutral-100"}`}>
                    {msg.role === "user" ? (
                      msg.text
                    ) : (
                      <>
                        <MarkdownMessage content={msg.text} />
                        {isStreamingThisMessage && (
                          <span className="inline-block w-1.5 h-4 bg-[#ffb066] animate-pulse align-middle ml-1" />
                        )}
                        {msg.chunks && <SourceCitations chunks={msg.chunks} />}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {isLoading && !streamStarted && <ThinkingIndicator />}
            {chatError && (
              <div className="flex gap-3 ml-auto max-w-[85%] items-start">
                <div className="p-2 rounded-lg flex h-8 w-8 items-center justify-center shrink-0 bg-[#2a1414] text-red-400">
                  <AlertCircle size={16} />
                </div>
                <div className="p-3 rounded-xl rounded-tr-none text-sm leading-relaxed bg-[#2a1414] text-red-300 border border-red-900/50 flex flex-col gap-2">
                  <span>{chatError.message}</span>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="self-start flex items-center gap-1 text-xs text-red-200 hover:text-white bg-red-900/40 hover:bg-red-900/70 border border-red-800 rounded px-2 py-1 transition-colors"
                  >
                    <RotateCcw size={12} />
                    נסה שוב
                  </button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-[#242b3a] p-4 bg-[#0a0e14]/20">
            <div className="flex w-full gap-2 items-center">
              <Input
                type="text"
                placeholder={`שאל אותי על חומר הלימוד של ${courseTitle}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="bg-[#161b26] border-[#242b3a] text-white focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d] h-12 flex-1 transition-shadow duration-300 focus-visible:shadow-[0_0_16px_-2px_rgba(124,92,255,0.4)]"
                disabled={isLoading}
              />
              {isLoading ? (
                <Button onClick={handleStop} className="bg-[#242b3a] hover:bg-red-900/50 text-white h-12 px-4 transition-all duration-300">
                  <Square size={16} />
                </Button>
              ) : (
                <Button onClick={handleSendMessage} className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] h-12 px-4 rounded-full transition-all duration-300 active:scale-95">
                  <Send size={18} className="rotate-180" />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

      </div>
    </div>
  )
}
