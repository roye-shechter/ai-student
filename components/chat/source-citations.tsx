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
              className="flex items-center gap-1 text-[10px] bg-[#211d16] border border-[#332b1f] text-neutral-300 hover:border-[#b08d57]/50 rounded-sm px-2 py-1 transition-colors"
            >
              <FileText size={10} className="text-[#d4b483]" />
              {fileName}
              {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {isOpen && (
              <div className="mt-1 space-y-1">
                {fileChunks.map((chunk) => (
                  <p
                    key={`${chunk.documentId}-${chunk.chunkIndex}`}
                    className="text-[11px] text-neutral-400 bg-[#0d0c0a] border border-[#332b1f] rounded-sm p-2 leading-relaxed"
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
