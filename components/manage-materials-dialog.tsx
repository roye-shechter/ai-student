"use client"

import { useState } from "react"
import { FileText, FileAudio, X, Pencil, Trash2, Check, Loader2, UploadCloud } from "lucide-react"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/document-status-badge"
import { readJson } from "@/lib/http"

export type CourseDocument = {
  id: string
  title: string
  fileType: string | null
  chunkCount: number
  status: string
  createdAt: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

/**
 * Full management view for everything uploaded to this course — replaces
 * the old unbounded inline list in the course page's sidebar card. Reuses
 * the parent's already-loaded `documents` state (no duplicate fetching);
 * every mutation (rename/delete) calls the new app/api/documents/[id]
 * route and then `onChanged()` so the parent re-fetches once, staying the
 * single source of truth.
 */
export function ManageMaterialsDialog({
  documents,
  isUploading,
  uploadStatus,
  onRequestUpload,
  onClose,
  onChanged,
}: {
  documents: CourseDocument[]
  /** True while a file is being uploaded/ingested — see the page's handleUpload(). */
  isUploading: boolean
  /** Live progress text ("מעלה את...", "מטמיע ברקע..."), or an error message once done. */
  uploadStatus: string | null
  /** Opens the naming dialog + hidden file input, both still owned by the page. */
  onRequestUpload: () => void
  onClose: () => void
  onChanged: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startEdit = (doc: CourseDocument) => {
    setEditingId(doc.id)
    setEditValue(doc.title)
    setConfirmDeleteId(null)
    setError(null)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditValue("")
  }

  const saveEdit = async (id: string) => {
    const title = editValue.trim()
    if (!title) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      const data = await readJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || `השינוי נכשל (קוד ${res.status})`)
      setEditingId(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בשינוי השם")
    } finally {
      setBusyId(null)
    }
  }

  const runDelete = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" })
      const data = await readJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || `המחיקה נכשלה (קוד ${res.status})`)
      setConfirmDeleteId(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה במחיקה")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-[#12161f] border border-[#242b3a] rounded-sm shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#242b3a] flex items-center justify-between shrink-0">
          <h2 className="font-serif text-xl gold-text">כל החומרים בקורס זה</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <p className="mx-6 mt-4 text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-sm px-3 py-2">
            {error}
          </p>
        )}

        <div className="px-6 pt-6 shrink-0">
          <button
            type="button"
            onClick={onRequestUpload}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#242b3a] rounded-sm text-sm text-neutral-300 transition-all duration-300 hover:border-[#ff7a3d]/60 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUploading ? <Loader2 size={18} className="animate-spin text-[#ff7a3d]" /> : <UploadCloud size={18} className="text-[#ffb066]" />}
            {isUploading ? uploadStatus ?? "מעלה..." : "העלה חומר חדש"}
          </button>
          {uploadStatus && !isUploading ? (
            <p className="text-xs text-red-400 text-center mt-2">{uploadStatus}</p>
          ) : (
            <p className="text-[11px] text-neutral-500 text-center mt-2">PDF, TXT או הקלטת שיעור</p>
          )}
        </div>

        <div className="p-6 space-y-2 overflow-y-auto flex-1">
          {documents.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">עדיין לא הועלו חומרים לקורס זה.</p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-[#0a0e14] border border-[#242b3a] rounded-sm text-sm text-neutral-300"
              >
                {doc.fileType === "audio" ? (
                  <FileAudio size={18} className="text-[#ffb066] shrink-0" />
                ) : (
                  <FileText size={18} className="text-[#ffb066] shrink-0" />
                )}

                {editingId === doc.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(doc.id)}
                      className="bg-[#161b26] border-[#242b3a] text-white h-8 text-sm focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d]"
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(doc.id)}
                      disabled={busyId === doc.id || !editValue.trim()}
                      className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 shrink-0"
                      aria-label="שמור"
                    >
                      {busyId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-neutral-500 hover:text-neutral-300 shrink-0"
                      aria-label="ביטול"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{doc.title}</p>
                      <p className="text-[11px] text-neutral-500">
                        {doc.chunkCount} קטעים · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} className="text-xs" />

                    {confirmDeleteId === doc.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-red-400">למחוק?</span>
                        <button
                          type="button"
                          onClick={() => runDelete(doc.id)}
                          disabled={busyId === doc.id}
                          className="text-xs bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900/60 rounded px-2 py-1 disabled:opacity-50"
                        >
                          {busyId === doc.id ? <Loader2 size={12} className="animate-spin" /> : "כן, מחק"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-neutral-400 hover:text-neutral-200 px-1"
                        >
                          ביטול
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(doc)}
                          className="text-neutral-500 hover:text-[#ffb066] transition-colors"
                          aria-label="שנה שם"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteId(doc.id)
                            setEditingId(null)
                          }}
                          className="text-neutral-500 hover:text-red-400 transition-colors"
                          aria-label="מחק"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
