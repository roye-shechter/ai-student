/**
 * Atmospheric backdrop for the "AI Platform" identity: a deep navy canvas
 * with one warm amber glow — the same move dark AI-product hero sections
 * lean on (a soft radial light source standing in for a photograph, not a
 * flat color block) — sitting behind every page instead of only a marketing
 * hero. The glow itself is positioned, not animated; a dense particle
 * network (see BRAIN_NODES/BRAIN_EDGES below), sharing the glow's exact
 * bounding box, is the one deliberate motion cue. It's built from two
 * overlapping density clusters (left/right "hemispheres") plus a smaller
 * lower one — an organic node density that *suggests* a brain through
 * where the particles cluster, deliberately with no drawn outline/contour
 * around it, matching the app's restrained-not-literal visual language.
 * Points/edges are pre-generated offline with a seeded RNG (not computed
 * at runtime) so they're fixed and never shift between loads. Server
 * component: the animation is pure CSS, so this still costs nothing at
 * runtime.
 */

// prettier-ignore
const BRAIN_NODES = [
  { x: 611.2, y: 283.6, size: 1.4 }, { x: 428.2, y: 206.3, size: 2 }, { x: 366.7, y: 291.3, size: 1.4 },
  { x: 341.7, y: 226.9, size: 1.4 }, { x: 405, y: 341.6, size: 1.4 }, { x: 311.9, y: 227.3, size: 1.4 },
  { x: 772, y: 176.7, size: 1.4 }, { x: 390.7, y: 240.9, size: 2 }, { x: 466.5, y: 380.2, size: 1.4 },
  { x: 331, y: 313.5, size: 1.4 }, { x: 338.3, y: 268.5, size: 2 }, { x: 190.8, y: 173.9, size: 2 },
  { x: 433.1, y: 397, size: 1.4 }, { x: 361.1, y: 287.5, size: 1.4 }, { x: 492.8, y: 346.8, size: 1.4 },
  { x: 324.7, y: 231.6, size: 1.4 }, { x: 519, y: 257, size: 3 }, { x: 507.8, y: 191.9, size: 2 },
  { x: 423.2, y: 72.6, size: 1.4 }, { x: 729.6, y: 211.4, size: 2 }, { x: 395.7, y: 161.5, size: 1.4 },
  { x: 250.2, y: 231.3, size: 1.4 }, { x: 627.2, y: 219.5, size: 1.4 }, { x: 318.4, y: 285.6, size: 2 },
  { x: 271.6, y: 395.1, size: 1.4 }, { x: 517.4, y: 181.4, size: 2 }, { x: 535.1, y: 336.9, size: 1.4 },
  { x: 200.2, y: 148, size: 2 }, { x: 488.4, y: 192.4, size: 1.4 }, { x: 386.3, y: 355.5, size: 1.4 },
  { x: 463.3, y: 195, size: 1.4 }, { x: 619.2, y: 222.4, size: 1.4 }, { x: 509.4, y: 272.7, size: 2 },
  { x: 506.4, y: 263.3, size: 1.4 }, { x: 663.4, y: 300.3, size: 1.4 }, { x: 485.6, y: 416.2, size: 1.4 },
  { x: 241.3, y: 235.4, size: 1.4 }, { x: 451, y: 502.5, size: 1.4 }, { x: 318.1, y: 310.9, size: 1.4 },
  { x: 586, y: 212.3, size: 1.4 }, { x: 456.2, y: 207.8, size: 2 }, { x: 431.6, y: 415.7, size: 1.4 },
  { x: 599.3, y: 238.6, size: 2 }, { x: 430.2, y: 423.8, size: 1.4 }, { x: 550.6, y: 129.2, size: 2 },
  { x: 559.3, y: 269.1, size: 1.4 }, { x: 434.4, y: 151.8, size: 1.4 }, { x: 487.4, y: 88.7, size: 1.4 },
  { x: 264.5, y: 179, size: 2 }, { x: 560, y: 275.6, size: 1.4 }, { x: 394.9, y: 443.8, size: 1.4 },
  { x: 385.2, y: 186.2, size: 1.4 }, { x: 368, y: 271.6, size: 3 }, { x: 475.5, y: 385.5, size: 2 },
  { x: 349.7, y: 213.9, size: 1.4 }, { x: 558.7, y: 191.2, size: 1.4 }, { x: 311.4, y: 388, size: 1.4 },
  { x: 380.9, y: 423.6, size: 1.4 }, { x: 575.6, y: 124.2, size: 1.4 }, { x: 497.6, y: 164.1, size: 2 },
  { x: 452.8, y: 351.4, size: 1.4 }, { x: 498.7, y: 232.8, size: 1.4 }, { x: 420.8, y: 427.2, size: 1.4 },
  { x: 519.6, y: 213.3, size: 1.4 }, { x: 443.8, y: 406, size: 3 }, { x: 568.9, y: 288.9, size: 1.4 },
  { x: 644, y: 326.1, size: 2 }, { x: 419.5, y: 233.4, size: 1.4 }, { x: 657.4, y: 378.9, size: 2 },
  { x: 399, y: 312, size: 1.4 }, { x: 319.9, y: 332.6, size: 1.4 }, { x: 570.1, y: 347.5, size: 1.4 },
] as const

// prettier-ignore
const BRAIN_EDGES: [number, number][] = [
  [0, 65], [0, 42], [1, 40], [1, 67], [2, 13], [2, 52], [3, 54], [3, 15], [4, 29], [4, 69], [5, 15], [5, 3],
  [6, 19], [6, 22], [7, 67], [7, 52], [8, 53], [8, 60], [9, 38], [9, 70], [9, 23], [10, 23], [10, 13], [11, 27],
  [11, 48], [12, 64], [12, 41], [13, 52], [14, 60], [14, 53], [14, 8], [15, 54], [16, 33], [16, 32], [17, 25],
  [17, 28], [18, 47], [18, 46], [19, 22], [20, 51], [20, 46], [21, 36], [21, 48], [22, 31], [22, 42], [23, 38],
  [24, 56], [24, 70], [24, 38], [25, 59], [26, 71], [26, 14], [27, 48], [28, 30], [28, 59], [29, 69], [30, 40],
  [31, 42], [31, 39], [32, 33], [32, 61], [34, 66], [34, 0], [35, 53], [35, 8], [36, 48], [37, 62], [37, 50],
  [38, 70], [39, 42], [39, 55], [40, 28], [41, 43], [41, 64], [43, 62], [43, 64], [44, 58], [44, 25], [45, 49],
  [45, 65], [46, 30], [46, 1], [47, 44], [49, 65], [50, 57], [50, 62], [50, 43], [51, 54], [54, 5], [55, 25],
  [56, 70], [57, 62], [58, 55], [58, 25], [59, 17], [61, 63], [61, 33], [62, 41], [63, 17], [66, 0], [68, 66],
  [68, 34], [68, 71], [69, 2], [70, 23], [71, 65], [71, 49],
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

      {/* The brain-suggestive particle network — same bounding box as the
          glow above it (w-[900px] h-[560px], same position), so it reads
          as "what the light is coming from" rather than a separate layer.
          Edges first (so node dots sit visually on top of their own
          connections), each with a staggered dash-travel delay so the
          mesh fires asynchronously instead of in lockstep. */}
      <svg
        className="absolute left-1/2 top-[-18%] h-[560px] w-[900px] -translate-x-1/2 overflow-visible"
        viewBox="0 0 900 560"
        aria-hidden="true"
      >
        {BRAIN_EDGES.map(([a, b], i) => (
          <line
            key={i}
            className="ambient-thread"
            x1={BRAIN_NODES[a].x}
            y1={BRAIN_NODES[a].y}
            x2={BRAIN_NODES[b].x}
            y2={BRAIN_NODES[b].y}
            stroke="#ffb066"
            strokeWidth="1"
            strokeOpacity="0.22"
            style={{ animationDelay: `${((i % 9) * -0.6).toFixed(2)}s` }}
          />
        ))}
        {BRAIN_NODES.map((d, i) => (
          <circle
            key={i}
            className="ambient-node"
            cx={d.x}
            cy={d.y}
            r={d.size}
            fill="#ffb066"
            opacity={d.size >= 3 ? 0.65 : 0.4}
            style={{ animationDelay: `${((i % 11) * -0.4).toFixed(2)}s` }}
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
