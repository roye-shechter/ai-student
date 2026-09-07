"use client"

import { useEffect, useRef, useState } from "react"
import { gsap, useGSAP } from "@/lib/gsap"

const SPLASH_KEY = "ai-student:justLoggedIn"

/** Called by the login form right before navigating to /dashboard. */
export function markJustLoggedIn() {
  try {
    sessionStorage.setItem(SPLASH_KEY, "1")
  } catch {
    // sessionStorage unavailable (private mode, etc.) — splash just won't show
  }
}

function Chars({ text, className }: { text: string; className: string }) {
  return (
    <>
      {Array.from(text).map((c, i) => (
        <span key={i} className={`${className} inline-block`} style={c === " " ? { whiteSpace: "pre" } : undefined}>
          {c}
        </span>
      ))}
    </>
  )
}

// Splitting mixed-direction text (Hebrew + an embedded "AI Student") into
// per-character inline-blocks breaks the browser's bidi reordering — each
// isolated span becomes its own bidi run, so the Latin word comes out
// reversed ("tnedutS IA"). Animating whole words instead keeps every word's
// internal character order intact while still staggering in.
function Words({ text, className }: { text: string; className: string }) {
  const words = text.split(" ")
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className={`${className} inline-block`}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  )
}

/**
 * One-time welcome moment shown right after signing in — not on every
 * dashboard visit. The login form flags sessionStorage; this component
 * consumes that flag on mount (so a refresh never replays it) and plays a
 * single letter-by-letter reveal over the same amber glow used everywhere
 * else, then dismisses itself (or on a tap, for anyone who doesn't want to
 * wait it out).
 */
export function WelcomeSplash({ name }: { name: string }) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY) === "1") {
        sessionStorage.removeItem(SPLASH_KEY)
        setVisible(true)
      }
    } catch {
      // ignore
    }
  }, [])

  const dismiss = () => {
    if (closing) return
    setClosing(true)
  }

  useGSAP(
    () => {
      if (!visible) return
      gsap
        .timeline()
        .fromTo(".splash-glow", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 1.1, ease: "power2.out" })
        .fromTo(
          ".splash-line1 .splash-char",
          { opacity: 0, y: 16, filter: "blur(6px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, stagger: 0.026, ease: "power2.out" },
          "-=0.75"
        )
        .fromTo(
          ".splash-line2 .splash-char",
          { opacity: 0, y: 20, filter: "blur(8px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, stagger: 0.035, ease: "power2.out" },
          "-=0.25"
        )
        .fromTo(".splash-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power1.inOut" }, "-=0.25")
        .call(() => {
          gsap.delayedCall(2.2, dismiss)
        })
    },
    { scope: rootRef, dependencies: [visible] }
  )

  useGSAP(
    () => {
      if (!closing) return
      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 0.55,
        ease: "power1.inOut",
        onComplete: () => setVisible(false),
      })
    },
    { scope: rootRef, dependencies: [closing] }
  )

  if (!visible) return null

  return (
    <div
      ref={rootRef}
      onClick={dismiss}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0e14] cursor-pointer overflow-hidden"
      dir="rtl"
    >
      <div
        className="splash-glow absolute left-1/2 top-1/2 h-[560px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 50%, #ff8a3d, #e0561a 45%, transparent 75%)" }}
      />
      <div className="relative text-center px-6">
        <p className="splash-line1 font-serif text-2xl md:text-3xl text-[#f5f6f8] mb-3 tracking-tight" dir="rtl">
          <Words text="ברוך הבא ל-AI Student" className="splash-char" />
        </p>
        <p className="splash-line2 font-serif text-4xl md:text-6xl gold-text font-bold mb-6">
          <Chars text={name} className="splash-char" />
        </p>
        <div className="splash-rule h-px w-40 bg-[#ff7a3d] mx-auto origin-center" />
      </div>
    </div>
  )
}
