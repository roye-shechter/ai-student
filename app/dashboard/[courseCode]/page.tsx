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
import { NameDocumentDialog } from "@/components/name-document-dialog"
import { ManageMaterialsDialog } from "@/components/manage-materials-dialog"
import { ExamDatesCard, type ExamDateEntry } from "@/components/exam-dates-card"
import { TutorAvatar } from "@/components/tutor-avatar"
import { CourseProgressSnapshot } from "@/components/course-progress-snapshot"
import { TutorBoard, extractBoardItems, stripBoardBlocks } from "@/components/tutor-board"
import { gsap, useGSAP } from "@/lib/gsap"
import { prepareChatImage, type ChatImage } from "@/lib/chat-image"
import {
  FolderOpen, ArrowRight, ArrowLeft, Send, User, AlertCircle, Square, RotateCcw, GraduationCap,
  ImagePlus, X, Maximize2, Minimize2, PenLine,
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

type ChatMessage = { role: string; text: string; chunks?: SourceChunk[]; imagePreview?: string }

type ChatStreamEvent =
  | { type: "sources"; chunks: SourceChunk[]; sessionId: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]
function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || AUDIO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
}

/** The tutor's "thinking" state — a three-dot wave rather than a bare
 * spinner, so waiting for the AI reads as a distinct, branded moment. */
function ThinkingIndicator() {
  return (
    <div className="flex gap-3 ml-auto items-center text-neutral-400 text-sm">
      <div className="p-2 rounded-lg flex h-8 w-8 items-center justify-center shrink-0 bg-[#161b26] text-[#ffb066]">
        <TutorAvatar size={16} />
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
  const [examDates, setExamDates] = useState<ExamDateEntry[]>([])

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "שלום! אני המורה הפרטי שלך לקורס זה. העלה חומרי לימוד, ואשמח ללמד אותך, להסביר ולענות על כל שאלה — מבוסס מדויק על החומר שהעלית." },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [streamStarted, setStreamStarted] = useState(false)
  const [chatError, setChatError] = useState<{ message: string; retryText: string; image?: ChatImage } | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [pendingImage, setPendingImage] = useState<ChatImage | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showManageDialog, setShowManageDialog] = useState(false)

  // Fullscreen hides the materials/exam/progress sidebar entirely so the
  // chat gets the extra width — "שכל המסך כולו יהיה צ'אט". The live board
  // stays available and toggleable in fullscreen too, sitting beside the
  // widened chat instead of disappearing with the sidebar.
  const [fullscreen, setFullscreen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const boardAutoOpenedRef = useRef(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const boardPanelRef = useRef<HTMLDivElement>(null)

  // The board is a running transcript of every formula/diagram the tutor has
  // written so far this session, not just the latest turn — once drawn, it
  // stays on the board.
  const assistantTranscript = messages
    .filter((m) => m.role === "assistant")
    .map((m) => m.text)
    .join("\n\n")
  const boardItemCount = extractBoardItems(assistantTranscript).length

  // Open the board automatically the first time the tutor actually draws
  // something — the student shouldn't have to know the button exists to
  // benefit from it. Only fires once; closing it manually afterwards sticks.
  useEffect(() => {
    if (boardItemCount > 0 && !boardAutoOpenedRef.current) {
      boardAutoOpenedRef.current = true
      setBoardOpen(true)
    }
  }, [boardItemCount])

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

  // The board "jumping" open nicely when the tutor starts drawing — a quick
  // slide+scale+fade from the chat's edge, instead of the panel just
  // appearing instantly when boardOpen flips true (auto-open or manual).
  useGSAP(
    () => {
      if (boardOpen && boardPanelRef.current) {
        gsap.fromTo(
          boardPanelRef.current,
          { opacity: 0, x: 28, scale: 0.96 },
          { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: "power3.out" }
        )
      }
    },
    { dependencies: [boardOpen], scope: rootRef }
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

  const loadExamDates = useCallback(async () => {
    if (!course?.id) return
    try {
      const res = await fetch(`/api/courses/${course.id}/exam-dates`)
      const data = await readJson<{ examDates?: ExamDateEntry[] }>(res)
      if (res.ok && data) setExamDates(data.examDates ?? [])
    } catch {
      // Non-critical — the card just shows every slot as unset.
    }
  }, [course?.id])

  useEffect(() => {
    loadExamDates()
  }, [loadExamDates])

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

  const handleUpload = async (file: File, title: string) => {
    setIsUploading(true)
    setUploadStatus(
      isAudioFile(file)
        ? `מעלה את ההקלטה "${title}"...`
        : `מעלה את "${title}"...`
    )
    try {
      // The browser PUTs the file straight to Vercel Blob storage — it never
      // passes through our own server, so there's no platform request-body
      // size limit to worry about.
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/upload/token",
      })

      setUploadStatus(`מטמיע את "${title}" ברקע...`)

      const response = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, fileName: file.name, title, courseCode }),
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
      await loadDocuments() // refresh the persistent list from the DB (shows "ממתין"/"מעבד" immediately)
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "אירעה שגיאה בהעלאת המסמך")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Picking a file doesn't upload it immediately — it opens NameDocumentDialog
  // first (required naming step). Only handleNameConfirm actually starts the
  // upload, once a name is given.
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPendingFile(file)
  }

  const handleNameConfirm = (title: string) => {
    const file = pendingFile
    setPendingFile(null)
    if (file) handleUpload(file, title)
  }

  const handleNameCancel = () => {
    setPendingFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const sendMessage = useCallback(
    async (text: string, image?: ChatImage) => {
      if (!text.trim() || isLoading) return
      setChatError(null)
      setMessages((prev) => [...prev, { role: "user", text, imagePreview: image?.previewUrl }])
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
          body: JSON.stringify({
            message: text,
            courseCode,
            sessionId,
            image: image ? { mimeType: image.mimeType, base64: image.base64 } : undefined,
          }),
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
          setChatError({ message, retryText: text, image })
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
    const image = pendingImage ?? undefined
    setInput("")
    setPendingImage(null)
    sendMessage(text, image)
  }

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      setPendingImage(await prepareChatImage(file))
    } catch (error) {
      setChatError({ message: error instanceof Error ? error.message : "לא ניתן לעבד את התמונה", retryText: "" })
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
  }

  const handleRetry = () => {
    if (!chatError || !chatError.retryText) return
    const { retryText, image } = chatError
    setChatError(null)
    sendMessage(retryText, image)
  }

  const courseTitle = course?.courseName ?? courseCode

  return (
    <div ref={rootRef} className="relative z-10 min-h-screen lg:h-screen lg:overflow-hidden text-white flex flex-col" dir="rtl">
      <div className="course-header border-b border-[#242b3a] glass-panel p-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-neutral-400 hover:text-[#ffb066] transition-colors text-sm">
            <ArrowRight size={16} />
            חזרה לדשבורד הראשי
          </Link>
          <span className="text-xs bg-[#2a2015] text-[#ffb066] border border-[#ff7a3d]/40 px-2 py-1 rounded">סביבת לימוד מבוססת AI</span>
        </div>
      </div>

      {/* lg:min-h-0 lets this row actually shrink to fit inside the h-screen
          root above instead of growing past it — without it, flexbox's
          default min-height:auto keeps the row (and everything below the
          fold, like the chat input) exactly as tall as its content wants,
          which is what was clipping the bottom of the chat card off-screen
          with no way to scroll to it. Mobile keeps natural page scroll
          (no lg:h-screen on the root), so this only changes desktop. */}
      <div className={`flex-1 lg:min-h-0 w-full mx-auto flex flex-col lg:flex-row gap-6 p-6 ${fullscreen ? "max-w-none" : "max-w-7xl"}`}>

        {/* חלק ימין: חומרי לימוד, מועדי בחינות, התקדמות — מועלם במסך מלא.
            lg:h-full + lg:overflow-y-auto give this column its own scroll
            inside the fixed-height row above — without it, content taller
            than the viewport (exam dates + progress snapshot + weak topics)
            was simply clipped by the root's lg:overflow-hidden with no way
            to reach it, which read as "the weak-topics section is empty"
            when it was actually just cut off below the fold. */}
        {!fullscreen && (
          <div className="space-y-6 flex flex-col w-full lg:w-[320px] shrink-0 lg:h-full lg:overflow-y-auto lg:pl-1 scroll-smooth">
            {/* The hidden file input has to live somewhere in the DOM — it's
                triggered from inside ManageMaterialsDialog now (onRequestUpload),
                not from a dropzone on the page itself. */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,application/pdf,text/plain,audio/*,video/mp4,video/webm"
              onChange={onFileSelected}
              className="hidden"
              disabled={isUploading}
            />

            <div className="course-info-card glass-panel border border-[#242b3a] rounded-sm p-6 space-y-1">
              <h1 className="font-serif gold-text text-3xl">{courseTitle}</h1>
              {course?.description && <p className="text-neutral-400 text-sm">{course.description}</p>}
            </div>

            {course?.id && (
              <ExamDatesCard courseId={course.id} examDates={examDates} onChanged={loadExamDates} />
            )}

            {/* התקדמות גלויה מיד בעמוד הקורס עצמו — לא רק אחרי מעבר לעמוד נפרד. */}
            {course?.id && <CourseProgressSnapshot courseId={course.id} courseCode={courseCode} />}

            {/* Two matching entry points — one clean job each, same visual
                weight, instead of the old dropzone-plus-list mix. */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowManageDialog(true)}
                className="group/tech relative w-full flex items-center justify-between gap-3 p-4 glass-panel tech-glow-border overflow-hidden border border-[#242b3a] rounded-sm text-sm transition-all duration-300"
              >
                <span className="tech-scan" />
                <span className="tech-corner tech-corner-tl" />
                <span className="tech-corner tech-corner-tr" />
                <span className="tech-corner tech-corner-bl" />
                <span className="tech-corner tech-corner-br" />
                <span className="relative flex items-center gap-3">
                  <FolderOpen size={18} className="text-[#ffb066]" />
                  <span className="flex flex-col items-start text-right">
                    <span className="text-white">חומרי הקורס</span>
                    <span className="text-[11px] text-neutral-500">
                      {docsLoading
                        ? "טוען..."
                        : docsError
                          ? docsError
                          : documents.length === 0
                            ? "העלה חומרי למידה"
                            : `${documents.length} חומרים`}
                    </span>
                  </span>
                </span>
                <ArrowLeft size={14} className="relative text-[#ffb066] shrink-0" />
              </button>

              <Link
                href={`/dashboard/${courseCode}/quiz`}
                className="group/tech relative w-full flex items-center justify-between gap-3 p-4 glass-panel tech-glow-border overflow-hidden border border-[#242b3a] rounded-sm text-sm transition-all duration-300"
              >
                <span className="tech-scan" />
                <span className="tech-corner tech-corner-tl" />
                <span className="tech-corner tech-corner-tr" />
                <span className="tech-corner tech-corner-bl" />
                <span className="tech-corner tech-corner-br" />
                <span className="relative flex items-center gap-3">
                  <GraduationCap size={18} className="text-[#ffb066]" />
                  <span className="text-white">התחל מבחן תרגול</span>
                </span>
                <ArrowLeft size={14} className="relative text-[#ffb066] shrink-0" />
              </Link>
            </div>
          </div>
        )}

        {/* חלק שמאל: הצ'אט האמיתי */}
        <Card className="course-chat-card glass-panel border-[#242b3a] text-white flex-1 min-w-0 flex flex-col h-[calc(100dvh-140px)] lg:h-full shadow-2xl shadow-black/30">
          <CardHeader className="border-b border-[#242b3a] pb-4 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <TutorAvatar className="text-[#ff7a3d]" size={22} />
                המורה הפרטי שלך לקורס
              </CardTitle>
              <CardDescription className="text-neutral-400 text-xs mt-1">שאל כל שאלה על החומר — המורה הפרטי מלמד ומסביר בהתבסס אך ורק על מסמכי הקורס שהעלית.</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setBoardOpen((v) => !v)}
                aria-label={boardOpen ? "סגור את הלוח החי" : "פתח את הלוח החי"}
                title="הלוח החי — נוסחאות ותרשימים"
                className={`p-2 rounded-sm border transition-colors ${boardOpen ? "border-[#ff7a3d]/50 bg-[#ff7a3d]/15 text-[#ffb066]" : "border-[#242b3a] text-neutral-400 hover:text-white"}`}
              >
                <PenLine size={15} />
              </button>
              <button
                type="button"
                onClick={() => setFullscreen((v) => !v)}
                aria-label={fullscreen ? "צא ממסך מלא" : "עבור למסך מלא"}
                title={fullscreen ? "צא ממסך מלא" : "עבור למסך מלא"}
                className="p-2 rounded-sm border border-[#242b3a] text-neutral-400 hover:text-white transition-colors"
              >
                {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto scroll-smooth p-4 space-y-4 min-h-[300px]">
            {messages.map((msg, index) => {
              const isStreamingThisMessage = isLoading && streamStarted && index === messages.length - 1 && msg.role === "assistant"
              return (
                <div key={index} className={`msg-in flex gap-3 max-w-[85%] ${msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"}`}>
                  <div className={`p-2 rounded-full flex h-8 w-8 items-center justify-center shrink-0 ${msg.role === "user" ? "bg-[#ff7a3d] text-[#12161f]" : "bg-[#161b26] text-[#ffb066]"}`}>
                    {msg.role === "user" ? <User size={16} /> : <TutorAvatar size={16} />}
                  </div>
                  <div className={`p-3 text-sm leading-relaxed break-words ${msg.role === "user" ? "rounded-xl rounded-tl-none bg-[#ff7a3d] text-[#12161f] text-left" : "rounded-xl rounded-tr-none bg-[#161b26] text-neutral-100"}`}>
                    {msg.role === "user" ? (
                      <div className="flex flex-col gap-2">
                        {msg.imagePreview && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.imagePreview} alt="תמונה שצורפה לשאלה" className="rounded-lg max-h-48 object-contain" />
                        )}
                        <span>{msg.text}</span>
                      </div>
                    ) : (
                      <>
                        <MarkdownMessage content={stripBoardBlocks(msg.text)} />
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
                  {chatError.retryText && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="self-start flex items-center gap-1 text-xs text-red-200 hover:text-white bg-red-900/40 hover:bg-red-900/70 border border-red-800 rounded px-2 py-1 transition-colors"
                    >
                      <RotateCcw size={12} />
                      נסה שוב
                    </button>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-[#242b3a] p-4 bg-[#0a0e14]/20 flex-col items-stretch gap-2">
            {pendingImage && (
              <div className="flex items-center gap-2 self-start bg-[#161b26] border border-[#242b3a] rounded-lg p-1.5 pr-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage.previewUrl} alt="התמונה שתצורף" className="h-12 w-12 rounded object-cover" />
                <span className="text-xs text-[#8b93a3]">התמונה תצורף לשאלה</span>
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="text-[#8b93a3] hover:text-white p-1"
                  aria-label="הסר תמונה"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex w-full gap-2 items-center">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePickImage}
              />
              <Button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isLoading}
                aria-label="צרף תמונה"
                className="bg-[#161b26] hover:bg-[#242b3a] text-[#8b93a3] hover:text-[#ffb066] border border-[#242b3a] h-12 px-3 rounded-full transition-all duration-300"
              >
                <ImagePlus size={18} />
              </Button>
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

        {/* הלוח החי: נוסחאות ותרשימים שהמורה "משרבט" בזמן ההסבר — נשאר
            זמין גם במסך הרחב, מוצג לצד הצ'אט המורחב במקום להיעלם איתו. */}
        {boardOpen && (
          <div
            ref={boardPanelRef}
            className={`w-full shrink-0 h-[420px] lg:h-full ${fullscreen ? "lg:w-[420px]" : "lg:w-[360px]"}`}
          >
            <TutorBoard content={assistantTranscript} onClose={() => setBoardOpen(false)} />
          </div>
        )}

      </div>

      {pendingFile && (
        <NameDocumentDialog file={pendingFile} onCancel={handleNameCancel} onConfirm={handleNameConfirm} />
      )}
      {showManageDialog && (
        <ManageMaterialsDialog
          documents={documents}
          isUploading={isUploading}
          uploadStatus={uploadStatus}
          onRequestUpload={() => fileInputRef.current?.click()}
          onClose={() => setShowManageDialog(false)}
          onChanged={loadDocuments}
        />
      )}
    </div>
  )
}
