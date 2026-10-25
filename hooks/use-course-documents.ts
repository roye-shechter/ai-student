"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { readJson } from "@/lib/http"
import type { ExamDateEntry } from "@/components/exam-dates-card"

/**
 * Course info, uploaded materials, and exam dates for the course page —
 * extracted from app/dashboard/[courseCode]/page.tsx (was ~670 lines doing
 * this, chat, and the board/fullscreen UI all in one component). Pure
 * behavior-preserving extraction: same requests, same state shape, same
 * polling. Chat lives in use-chat-session.ts instead — the two don't share
 * state, so splitting them doesn't need prop-drilling between the hooks.
 */

export type CourseInfo = {
  id: string
  courseCode: string
  courseName: string
  description: string | null
}

export type CourseDocument = {
  id: string
  title: string
  fileType: string | null
  chunkCount: number
  status: string
  createdAt: string
}

const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]
function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || AUDIO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
}

export function useCourseDocuments(courseCode: string | undefined) {
  const [course, setCourse] = useState<CourseInfo | null>(null)
  const [documents, setDocuments] = useState<CourseDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [examDates, setExamDates] = useState<ExamDateEntry[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

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

  // Fetch-on-mount via a reusable, re-callable loader (also passed as
  // onChanged to child dialogs to trigger a refresh after upload) is the
  // correct shape here; the rule below can't tell "sets state after an
  // awaited fetch" apart from a literal synchronous setState call.
  // Pre-existing pattern elsewhere in the codebase too (app/admin/page.tsx),
  // not something this hook introduced.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDocuments()
  }, [loadDocuments])

  // Depends on the `course` object itself (not a derived `course?.id`
  // expression) on purpose — a dependency array entry computed via optional
  // chaining is a known mismatch for the React Compiler's own dependency
  // inference, which was causing it to bail on optimizing this component
  // entirely (confirmed via `npm run lint`'s
  // react-hooks/preserve-manual-memoization warning before this fix).
  const loadExamDates = useCallback(async () => {
    const courseId = course?.id
    if (!courseId) return
    try {
      const res = await fetch(`/api/courses/${courseId}/exam-dates`)
      const data = await readJson<{ examDates?: ExamDateEntry[] }>(res)
      if (res.ok && data) setExamDates(data.examDates ?? [])
    } catch {
      // Non-critical — the card just shows every slot as unset.
    }
  }, [course])

  // Same reasoning as loadDocuments's effect above.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return {
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
  }
}
