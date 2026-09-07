"use client"

import { useMemo, useRef } from "react"
import katex from "katex"
import { gsap, useGSAP } from "@/lib/gsap"

/**
 * The product's signature visual motif: real, subject-accurate math and EE
 * notation drifting faintly behind every screen — not a generic gradient
 * blob, but the actual language of what this tutor teaches. Fixed behind
 * all page content (z-0, pointer-events-none); each page leaves its own
 * background transparent so this shows through.
 *
 * Positions/formulas are a deterministic table (not Math.random()) so
 * server and client render identically — no hydration mismatch.
 */
const FORMULAS: Array<{ tex: string; top: string; left: string; size: string; hue: "violet" | "cyan" }> = [
  { tex: "\\frac{d}{dx}\\left[x^n\\right] = nx^{n-1}", top: "8%", left: "6%", size: "1.4rem", hue: "violet" },
  { tex: "\\int_0^\\infty e^{-x^2}dx = \\frac{\\sqrt{\\pi}}{2}", top: "16%", left: "78%", size: "1.2rem", hue: "cyan" },
  { tex: "V = IR", top: "38%", left: "4%", size: "1.6rem", hue: "cyan" },
  { tex: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1", top: "62%", left: "82%", size: "1.3rem", hue: "violet" },
  { tex: "e^{i\\pi} + 1 = 0", top: "80%", left: "10%", size: "1.5rem", hue: "violet" },
  { tex: "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}", top: "28%", left: "58%", size: "1.1rem", hue: "cyan" },
  { tex: "P = \\frac{V^2}{R}", top: "50%", left: "42%", size: "1.2rem", hue: "cyan" },
  { tex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}", top: "88%", left: "56%", size: "1rem", hue: "violet" },
]

export function MathBackdrop() {
  const containerRef = useRef<HTMLDivElement>(null)

  const rendered = useMemo(
    () =>
      FORMULAS.map((f) => ({
        ...f,
        html: katex.renderToString(f.tex, { throwOnError: false, displayMode: false }),
      })),
    []
  )

  useGSAP(
    () => {
      const nodes = containerRef.current?.querySelectorAll<HTMLElement>("[data-formula]")
      if (!nodes || nodes.length === 0) return

      nodes.forEach((node, i) => {
        // Slow independent drift + breathing opacity per formula, offset so
        // the whole backdrop never moves in visible unison.
        gsap.to(node, {
          y: i % 2 === 0 ? -22 : 22,
          x: i % 3 === 0 ? 10 : -10,
          duration: 10 + (i % 4) * 2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: i * 0.4,
        })
        gsap.fromTo(
          node,
          { opacity: 0 },
          {
            opacity: node.dataset.hue === "cyan" ? 0.16 : 0.14,
            duration: 2,
            delay: 0.3 + i * 0.15,
            ease: "power1.out",
          }
        )
      })
    },
    { scope: containerRef }
  )

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(124,92,255,0.14),transparent_60%),radial-gradient(ellipse_60%_45%_at_100%_100%,rgba(52,228,234,0.08),transparent_60%)]" />
      {rendered.map((f, i) => (
        <span
          key={i}
          data-formula
          data-hue={f.hue}
          className={f.hue === "cyan" ? "text-[#34e4ea]" : "text-[#9b82ff]"}
          style={{
            position: "absolute",
            top: f.top,
            left: f.left,
            fontSize: f.size,
            opacity: 0,
          }}
          dangerouslySetInnerHTML={{ __html: f.html }}
        />
      ))}
    </div>
  )
}
