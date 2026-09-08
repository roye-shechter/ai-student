"use client"

import { useState } from "react"
import { FileText, FileAudio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]
function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || AUDIO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
}

function nameWithoutExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

/**
 * Required naming step between picking a file and actually uploading it.
 * The chosen name becomes Document.title and every DocumentChunk.fileName
 * (see app/api/upload/finalize/route.ts) — it's what the AI cites in chat
 * ("[Source File: ...]", lib/rag/chat.ts buildPrompt()), so a real name
 * here is what lets the student and the tutor both refer to the material
 * the same way, instead of a raw OS filename like "scan001.pdf".
 */
export function NameDocumentDialog({
  file,
  onCancel,
  onConfirm,
}: {
  file: File
  onCancel: () => void
  onConfirm: (title: string) => void
}) {
  const [title, setTitle] = useState(nameWithoutExtension(file.name))
  const canSubmit = title.trim().length > 0

  const submit = () => {
    if (!canSubmit) return
    onConfirm(title.trim())
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-[#12161f] border border-[#242b3a] rounded-sm shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#242b3a]">
          <h2 className="font-serif text-xl gold-text flex items-center gap-2">
            {isAudioFile(file) ? (
              <FileAudio className="text-[#ff7a3d]" size={22} />
            ) : (
              <FileText className="text-[#ff7a3d]" size={22} />
            )}
            תן שם למסמך
          </h2>
          <p className="text-neutral-400 text-sm mt-1 truncate">
            הקובץ: {file.name}
          </p>
        </div>

        <div className="p-6 space-y-2">
          <Label htmlFor="documentTitle" className="text-neutral-200">
            שם המסמך
          </Label>
          <Input
            id="documentTitle"
            autoFocus
            placeholder="לדוגמה: סיכום הרצאה 5, תרגיל בית 3..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="bg-[#161b26] border-[#242b3a] text-white focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
          />
          <p className="text-xs text-neutral-500">
            השם הזה יופיע ברשימת החומרים, והמורה הפרטי ישתמש בו כשהוא מצטט את המסמך בצ&apos;אט.
          </p>
        </div>

        <div className="p-6 border-t border-[#242b3a] flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="bg-transparent border-[#242b3a] text-neutral-300 hover:bg-[#161b26] hover:text-white rounded-sm"
          >
            ביטול
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-[#ff7a3d] hover:bg-[#ffb066] text-[#12161f] font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            העלה מסמך
          </Button>
        </div>
      </div>
    </div>
  )
}
