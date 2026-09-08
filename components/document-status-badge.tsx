import { CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react"

const STATUS_META: Record<string, { label: string; className: string }> = {
  indexed: { label: "מאונדקס", className: "text-emerald-400" },
  processing: { label: "מעבד", className: "text-[#ffb066]" },
  pending: { label: "ממתין", className: "text-neutral-400" },
  failed: { label: "נכשל", className: "text-red-400" },
}

/** Shared status pill for a Document's ingestion state — used by both the
 * course page's compact summary and the full materials management dialog. */
export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "text-neutral-400" }
  const Icon =
    status === "indexed" ? CheckCircle2 : status === "failed" ? AlertCircle : status === "processing" ? Loader2 : Clock
  return (
    <span className={`flex items-center gap-1 shrink-0 ${meta.className} ${className}`}>
      <Icon size={12} className={status === "processing" ? "animate-spin" : ""} />
      {meta.label}
    </span>
  )
}
