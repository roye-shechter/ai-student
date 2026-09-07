"use client"

import { useState } from "react"
import { FileText, ChevronDown, ChevronUp } from "lucide-react"

export type SourceChunk = {
  text: string
  score: number
  documentId: string
  chunkIndex: number
  fileName: string
  uploadTimestamp: number
}

/**
 * Small expandable chips under an assistant reply showing which uploaded
 * files it drew on. The API already returns these chunks (RetrievedChunk in
 * lib/rag/chat.ts) — this surfaces data the UI previously discarded.
 */
export function SourceCitations({ chunks }: { chunks: SourceChunk[] }) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  if (!chunks.length) return null

  const byFile = new Map<string, SourceChunk[]>()
  for (const chunk of chunks) {
    const key = chunk.fileName || "מקור לא ידוע"
    byFile.set(key, [...(byFile.get(key) ?? []), chunk])
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {[...byFile.entries()].map(([fileName, fileChunks]) => {
        const isOpen = expandedFile === fileName
        return (
          <div key={fileName}>
            <button
              type="button"
              onClick={() => setExpandedFile(isOpen ? null : fileName)}
              className="flex items-center gap-1 text-[10px] bg-[#1c1a2b] border border-[#29253f] text-neutral-300 hover:border-[#7c5cff]/50 rounded-full px-2 py-1 transition-colors"
            >
              <FileText size={10} className="text-[#9b82ff]" />
              {fileName}
              {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {isOpen && (
              <div className="mt-1 space-y-1">
                {fileChunks.map((chunk) => (
                  <p
                    key={`${chunk.documentId}-${chunk.chunkIndex}`}
                    className="text-[11px] text-neutral-400 bg-[#0a0a12] border border-[#29253f] rounded p-2 leading-relaxed"
                  >
                    {chunk.text.slice(0, 400)}
                    {chunk.text.length > 400 ? "…" : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
