"use client"

import { useCallback, useRef, useState } from "react"
import { readJson } from "@/lib/http"
import { prepareChatImage, type ChatImage } from "@/lib/chat-image"
import type { SourceChunk } from "@/components/chat/source-citations"

/**
 * The chat stream itself — messages, in-flight state, the NDJSON reader —
 * extracted from app/dashboard/[courseCode]/page.tsx. Pure behavior-
 * preserving extraction: same fetch, same streaming parse, same abort
 * handling. Documents/exam-dates live in use-course-documents.ts instead;
 * the two hooks don't share state.
 */

export type ChatMessage = { role: string; text: string; chunks?: SourceChunk[]; imagePreview?: string }

type ChatStreamEvent =
  | { type: "sources"; chunks: SourceChunk[]; sessionId: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

export function useChatSession(courseCode: string | undefined) {
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

  return {
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
  }
}
