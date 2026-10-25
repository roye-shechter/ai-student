"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MarkdownMessage } from "@/components/markdown-message"
import { SourceCitations } from "@/components/chat/source-citations"
import { NameDocumentDialog } from "@/components/name-document-dialog"
import { ManageMaterialsDialog } from "@/components/manage-materials-dialog"
import { ExamDatesCard } from "@/components/exam-dates-card"
import { TutorAvatar } from "@/components/tutor-avatar"
import { CourseProgressSnapshot } from "@/components/course-progress-snapshot"
import { TutorBoard, extractBoardItems, stripBoardBlocks } from "@/components/tutor-board"
import { gsap, useGSAP } from "@/lib/gsap"
import { useChatSession } from "@/hooks/use-chat-session"
import { useCourseDocuments } from "@/hooks/use-course-documents"
import {
  FolderOpen, ArrowRight, ArrowLeft, Send, User, AlertCircle, Square, RotateCcw, GraduationCap,
  ImagePlus, X, Maximize2, Minimize2, PenLine,
} from "lucide-react"

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

  const {
    course,
    documents,
    docsLoading,
    docsError,
    loadDocuments,
    examDates,
    loadExamDates,
    fileInputRef,
    isUploading,
    uploadStatus,
    pendingFile,
    onFileSelected,
    handleNameConfirm,
    handleNameCancel,
  } = useCourseDocuments(courseCode)

  const {
    messages,
    input,
    setInput,
    isLoading,
    streamStarted,
    chatError,
    pendingImage,
    setPendingImage,
    imageInputRef,
    handleSendMessage,
    handlePickImage,
    handleStop,
    handleRetry,
  } = useChatSession(courseCode)

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
              accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,application/pdf,text/plain,image/jpeg,image/png,image/webp,audio/*,video/mp4,video/webm"
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
