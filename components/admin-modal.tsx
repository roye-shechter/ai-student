"use client"

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

/**
 * Minimal modal for the admin panel: dark backdrop, closes on Escape, the
 * backdrop, or the X button. Kept local so the admin panel doesn't pull in
 * another UI dependency.
 */
export function AdminModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir="rtl"
        className="glass-panel border border-[#242b3a] rounded-sm w-full max-w-5xl max-h-[85vh] flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[#242b3a]">
          <div>
            <h2 className="text-[#ffb066] font-sans text-base font-medium">{title}</h2>
            {subtitle && <p className="text-xs text-neutral-400 mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="text-neutral-400 hover:text-white p-1 rounded-sm"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
