import { GraduationCap } from "lucide-react"

/**
 * The tutor's identity mark — replaces the generic `Bot` icon everywhere the
 * AI "speaks" (chat header, message bubbles, the thinking indicator).
 * Built from GraduationCap, the icon this app already uses for "learning"
 * elsewhere (the quiz button) — the tutor's identity is drawn from the
 * product's own vocabulary rather than a new arbitrary symbol, and reads as
 * a teacher rather than a robot. The slow breathing pulse is the "alive,
 * attentive" cue the size/context alone can't carry; prefers-reduced-motion
 * freezes it to a static glow.
 */
export function TutorAvatar({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`tutor-avatar relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <span className="tutor-avatar-ring absolute inset-[-4px] rounded-full bg-[#ff7a3d]/25 blur-[6px]" aria-hidden="true" />
      <GraduationCap size={size} className="relative" strokeWidth={2.25} />
    </span>
  )
}
