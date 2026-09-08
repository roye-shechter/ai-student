/**
 * Atmospheric backdrop for the "AI Platform" identity: a deep navy canvas
 * with one warm amber glow — the same move dark AI-product hero sections
 * lean on (a soft radial light source standing in for a photograph, not a
 * flat color block) — sitting behind every page instead of only a marketing
 * hero. The glow itself is positioned, not animated; a thin animated
 * "neural thread" layer (see NODES/THREADS below) is the one deliberate
 * motion cue, kept low-opacity so it never competes with foreground
 * content. Server component: the animation is pure CSS, so this still
 * costs nothing at runtime.
 */

// Fixed node positions (percent of viewport), reused for both the dot
// markers and the SVG thread endpoints below — not randomized, so the
// page never shifts between loads.
const NODES = [
  { top: 8, left: 12, size: 3 },
  { top: 14, left: 82, size: 2 },
  { top: 26, left: 68, size: 2 },
  { top: 5, left: 40, size: 2 },
  { top: 22, left: 22, size: 3 },
] as const

// Index pairs into NODES — deliberately not fully connected (a sparse
// graph reads as a network; a complete one just reads as clutter).
const THREADS: [number, number][] = [
  [0, 3],
  [3, 1],
  [3, 2],
  [0, 4],
  [4, 2],
]

export function AmbientTexture() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Base vignette: cool navy corners framing the canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_90%_at_50%_-20%,rgba(20,26,38,0.9),transparent_65%),radial-gradient(ellipse_100%_70%_at_50%_115%,rgba(0,0,0,0.55),transparent_60%)]" />

      {/* The glow: a large soft amber light source, blurred to a haze —
          the visual anchor the REDSUN/BioForge-style references use to
          keep a dark page from reading as flat or empty. */}
      <div
        className="absolute left-1/2 top-[-18%] h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.35] blur-[110px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, #ff8a3d, #e0561a 45%, transparent 75%)",
        }}
      />
      <div
        className="absolute left-1/2 top-[-6%] h-[220px] w-[420px] -translate-x-1/2 rounded-full opacity-[0.4] blur-[60px]"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 50%, #ffb066, transparent 70%)",
        }}
      />

      {/* Thin ring arcs echoing the "eclipse" outline from the reference —
          geometry standing in for the halo a real light source would cast,
          not a decorative sticker. */}
      <div className="absolute left-1/2 top-[-2%] h-[640px] w-[640px] -translate-x-1/2 rounded-full border border-[#ff8a3d]/[0.12]" />
      <div className="absolute left-1/2 top-[6%] h-[420px] w-[420px] -translate-x-1/2 rounded-full border border-[#ffb066]/[0.1]" />

      {/* Faint dot-grid — a data/instrument-panel cue used at very low
          opacity so it reads as texture, not pattern. */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,176,102,0.14) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent 70%)",
        }}
      />

      {/* A few scattered nodes, like distant instrument-panel indicators —
          fixed positions, not randomized, so the page never shifts. */}
      {NODES.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-[#ffb066]"
          style={{ top: `${d.top}%`, left: `${d.left}%`, width: d.size, height: d.size, opacity: 0.35 }}
        />
      ))}

      {/* Thin lines wiring the nodes together, with a slow traveling-dash
          pulse — the same node field, now read as a synapse/network
          diagram instead of just floating instrument dots: a quiet nod to
          "this is a learning brain," not a literal illustration of one. */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {THREADS.map(([a, b], i) => (
          <line
            key={i}
            className="ambient-thread"
            x1={NODES[a].left}
            y1={NODES[a].top}
            x2={NODES[b].left}
            y2={NODES[b].top}
            stroke="#ffb066"
            strokeWidth="0.12"
            strokeOpacity="0.22"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}
