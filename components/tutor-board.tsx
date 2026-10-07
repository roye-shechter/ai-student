"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import katex from "katex"
import { PenLine, X } from "lucide-react"
import { TutorAvatar } from "@/components/tutor-avatar"

type BoardItem = { id: string; kind: "formula" | "diagram"; source: string }

/**
 * Pulls every complete display-math block ($$...$$) and every ```mermaid```
 * fence out of the tutor's current message. Only *closed* blocks are
 * returned, so a block being streamed in mid-token simply isn't shown yet
 * instead of flashing broken partial markup — it appears the instant the
 * closing $$ or ``` arrives, which is what reads as "live" rather than
 * glitchy. Order matches how the tutor wrote them.
 */
function extractBoardItems(markdown: string): BoardItem[] {
  const items: BoardItem[] = []
  let order = 0

  const formulaRe = /\$\$([\s\S]+?)\$\$/g
  for (const m of markdown.matchAll(formulaRe)) {
    const body = m[1].trim()
    if (body) items.push({ id: `f${order++}`, kind: "formula", source: body })
  }

  const diagramRe = /```mermaid\s*\n([\s\S]+?)```/g
  for (const m of markdown.matchAll(diagramRe)) {
    const body = m[1].trim()
    if (body) items.push({ id: `d${order++}`, kind: "diagram", source: body })
  }

  return items
}

let mermaidReady: Promise<typeof import("mermaid").default> | null = null
function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          darkMode: true,
          background: "#12161f",
          primaryColor: "#2a2015",
          primaryBorderColor: "#ff7a3d",
          primaryTextColor: "#f5f6f8",
          lineColor: "#ff7a3d",
          secondaryColor: "#161b26",
          tertiaryColor: "#161b26",
          fontFamily: "inherit",
        },
        securityLevel: "strict",
      })
      return mermaid
    })
  }
  return mermaidReady
}

function FormulaBlock({ source }: { source: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(source, { displayMode: true, throwOnError: false })
    } catch {
      return null
    }
  }, [source])

  if (!html) return null
  return (
    <div className="board-item rounded-sm border border-[#242b3a] bg-[#0a0e14] p-4 overflow-x-auto text-[#f5f6f8]" dir="ltr" dangerouslySetInnerHTML={{ __html: html }} />
  )
}

function DiagramBlock({ source }: { source: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "")
  const idRef = useRef(`tutor-board-diagram-${reactId}`)

  useEffect(() => {
    let cancelled = false
    loadMermaid()
      .then((mermaid) => mermaid.render(idRef.current, source))
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [source])

  if (failed) return null
  return (
    <div className="board-item rounded-sm border border-[#242b3a] bg-[#0a0e14] p-4 overflow-x-auto" dir="ltr">
      {svg ? (
        <div className="[&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="text-xs text-neutral-500">מצייר את התרשים...</div>
      )}
    </div>
  )
}

/**
 * The "live board" next to the chat: every display formula and Mermaid
 * diagram the tutor writes gets pulled out of the cramped chat bubble and
 * re-rendered here, big and clean, in the order it was written — like the
 * tutor is sketching on a whiteboard while explaining out loud. Purely a
 * read-only mirror of what the tutor already wrote (see tutor-prompt.ts);
 * nothing here is interactive or sent back to the model.
 */
export function TutorBoard({ content, onClose }: { content: string; onClose: () => void }) {
  const items = useMemo(() => extractBoardItems(content), [content])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [items.length])

  return (
    <div className="tutor-board glass-panel border border-[#242b3a] rounded-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#242b3a] shrink-0">
        <span className="flex items-center gap-2 text-sm text-[#ffb066]">
          <PenLine size={15} />
          הלוח החי
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור את הלוח"
          className="text-neutral-500 hover:text-white p-1 rounded-sm transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-neutral-500 text-xs px-4">
            <TutorAvatar size={20} className="text-[#ff7a3d]/60" />
            כאן יופיעו נוסחאות ותרשימים שהמורה משרבט בזמן ההסבר.
          </div>
        ) : (
          items.map((item) =>
            item.kind === "formula" ? (
              <FormulaBlock key={item.id} source={item.source} />
            ) : (
              <DiagramBlock key={item.id} source={item.source} />
            )
          )
        )}
      </div>
    </div>
  )
}

export { extractBoardItems }
