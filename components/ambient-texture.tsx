/**
 * Atmospheric backdrop for the "AI Platform" identity: a deep navy canvas
 * lit by one warm amber glow, sitting behind every page instead of only a
 * marketing hero. Abstract and orbital, not anatomical: a slow-turning halo
 * ring around the glow, two faint page-scale arcs for depth, a sparse
 * star-field constellation (a scattered few dozen nodes with a handful of
 * long connecting lines, each playing a travelling "signal"), and a few
 * thin light streaks drifting upward out of the glow and fading. Data is
 * pre-generated offline with a seeded RNG (not computed at runtime) so it's
 * fixed and never shifts between loads. Server component: the animation is
 * pure CSS, so this still costs nothing at runtime.
 */

// prettier-ignore
const CONSTELLATION_NODES = [
  { x: 264.4, y: 163.3, r: 2.55, o: 0.52, d: 3.61, dl: 2.63 }, { x: 412.8, y: 410.4, r: 2.57, o: 0.44, d: 3.87, dl: 4.41 }, { x: 444.5, y: 119.4, r: 1.44, o: 0.45, d: 5.4, dl: 3.05 },
  { x: 684, y: 253.6, r: 2.52, o: 0.27, d: 5.07, dl: 0.16 }, { x: 434.9, y: 339.5, r: 1.42, o: 0.56, d: 4.86, dl: 0.14 }, { x: 581.5, y: 408.5, r: 1.93, o: 0.57, d: 4.12, dl: 2.25 },
  { x: 583.8, y: 270.3, r: 2.05, o: 0.49, d: 3.86, dl: 3.23 }, { x: 501.8, y: 376.1, r: 2.36, o: 0.59, d: 4.78, dl: 1.02 }, { x: 406.6, y: 376, r: 1.23, o: 0.51, d: 5.38, dl: 3.47 },
  { x: 586.9, y: 207.8, r: 2.7, o: 0.42, d: 6.3, dl: 0.69 }, { x: 539.3, y: 297.3, r: 1.71, o: 0.44, d: 5.14, dl: 4.5 }, { x: 686.9, y: 329.5, r: 2.69, o: 0.36, d: 5.47, dl: 0.9 },
  { x: 171.9, y: 227.4, r: 1.31, o: 0.65, d: 4.97, dl: 4.58 }, { x: 221.5, y: 313.7, r: 1.67, o: 0.49, d: 4.13, dl: 3.65 }, { x: 385.3, y: 390.3, r: 2.53, o: 0.53, d: 6.48, dl: 4.45 },
  { x: 227, y: 314.4, r: 1.6, o: 0.29, d: 5.44, dl: 1.57 }, { x: 514.9, y: 71.2, r: 1.26, o: 0.44, d: 5.88, dl: 0.65 }, { x: 626.1, y: 230.7, r: 2.31, o: 0.53, d: 3.78, dl: 2.06 },
  { x: 584.5, y: 390.9, r: 1.67, o: 0.33, d: 5.2, dl: 4.43 }, { x: 322.1, y: 405.6, r: 1.77, o: 0.3, d: 6.02, dl: 1.85 }, { x: 719.8, y: 260.2, r: 2.18, o: 0.6, d: 6.18, dl: 1.04 },
  { x: 261.9, y: 158.8, r: 1.41, o: 0.27, d: 5.47, dl: 3.54 }, { x: 398.4, y: 372.5, r: 1.67, o: 0.26, d: 3.77, dl: 4.97 }, { x: 181.6, y: 166.9, r: 1.38, o: 0.32, d: 4.96, dl: 1.46 },
  { x: 269.8, y: 338.9, r: 1.81, o: 0.52, d: 4.39, dl: 1.68 }, { x: 616.6, y: 168.9, r: 1.94, o: 0.49, d: 4.91, dl: 2.95 }, { x: 469.2, y: 382.3, r: 1.61, o: 0.38, d: 5.34, dl: 1.1 },
  { x: 578.7, y: 396.8, r: 1.63, o: 0.3, d: 4.1, dl: 0.21 }, { x: 285.9, y: 194.9, r: 1.92, o: 0.4, d: 5.49, dl: 4.56 }, { x: 536.6, y: 115.6, r: 1.36, o: 0.6, d: 4.84, dl: 4.2 },
  { x: 632, y: 160, r: 1.35, o: 0.5, d: 5.83, dl: 1.04 }, { x: 261.5, y: 349.2, r: 2.77, o: 0.45, d: 6.01, dl: 4.22 }, { x: 444.4, y: 162.3, r: 1.22, o: 0.32, d: 4.77, dl: 3.38 },
  { x: 470.3, y: 61, r: 2.49, o: 0.5, d: 5.93, dl: 4.26 },
] as const

// prettier-ignore
const CONSTELLATION_EDGES = [
  { x1: 264.4, y1: 163.3, x2: 261.9, y2: 158.8, d: 5.5, dl: 1.76 }, { x1: 684, y1: 253.6, x2: 719.8, y2: 260.2, d: 5.12, dl: 4.39 },
  { x1: 583.8, y1: 270.3, x2: 539.3, y2: 297.3, d: 5.7, dl: 1.75 }, { x1: 586.9, y1: 207.8, x2: 626.1, y2: 230.7, d: 6.34, dl: 3.13 },
  { x1: 171.9, y1: 227.4, x2: 181.6, y2: 166.9, d: 4.82, dl: 4.22 }, { x1: 227, y1: 314.4, x2: 221.5, y2: 313.7, d: 4.38, dl: 1.83 },
  { x1: 584.5, y1: 390.9, x2: 578.7, y2: 396.8, d: 4.05, dl: 0.43 }, { x1: 261.9, y1: 158.8, x2: 264.4, y2: 163.3, d: 5.62, dl: 3.63 },
  { x1: 269.8, y1: 338.9, x2: 261.5, y2: 349.2, d: 6.39, dl: 4.4 }, { x1: 578.7, y1: 396.8, x2: 584.5, y2: 390.9, d: 5.17, dl: 3.54 },
  { x1: 632, y1: 160, x2: 616.6, y2: 168.9, d: 4.36, dl: 1.37 }, { x1: 470.3, y1: 61, x2: 514.9, y2: 71.2, d: 4.35, dl: 0.24 },
] as const

// prettier-ignore
const RISING_STREAKS = [
  { x: 387.3, y: 399.7, rise: 150, d: 7.29, dl: 5.56, o: 0.59 }, { x: 358.8, y: 420, rise: 146, d: 6.42, dl: 3.28, o: 0.49 },
  { x: 427.5, y: 389.9, rise: 128, d: 5.47, dl: 3.53, o: 0.43 }, { x: 459.2, y: 409.3, rise: 158, d: 6.4, dl: 0.94, o: 0.35 },
  { x: 344.5, y: 444.9, rise: 108, d: 7.79, dl: 3.01, o: 0.5 }, { x: 329.6, y: 434, rise: 106, d: 6.19, dl: 1.61, o: 0.56 },
  { x: 469.2, y: 368.5, rise: 186, d: 7.4, dl: 4.63, o: 0.59 }, { x: 464.6, y: 432.4, rise: 148, d: 5.57, dl: 0.55, o: 0.38 },
  { x: 317.9, y: 383.6, rise: 160, d: 7.14, dl: 3.93, o: 0.64 }, { x: 306.6, y: 395.7, rise: 130, d: 5.91, dl: 5.83, o: 0.51 },
  { x: 361.5, y: 445, rise: 185, d: 5.85, dl: 3.63, o: 0.61 },
] as const

export function AmbientTexture() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Base vignette: cool navy corners framing the canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_90%_at_50%_-20%,rgba(20,26,38,0.9),transparent_65%),radial-gradient(ellipse_100%_70%_at_50%_115%,rgba(0,0,0,0.55),transparent_60%)]" />

      {/* A small dim, cool-toned "moon" off to one side — a quiet depth
          cue so the canvas doesn't read as one flat plane. */}
      <div
        className="absolute left-[8%] top-[9%] h-[150px] w-[150px] rounded-full opacity-[0.3] blur-[55px]"
        style={{ background: "radial-gradient(circle, rgba(64,76,102,0.55), transparent 70%)" }}
      />

      {/* Two giant, page-scale arcs centered off opposite corners — only a
          thin sliver of each huge circle crosses the canvas, echoing a
          pair of orbit paths without ever closing into a literal ring. */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx={160} cy={-180} r={950} fill="none" stroke="#ffb066" strokeWidth={1} strokeOpacity={0.1} />
        <circle cx={1480} cy={1120} r={820} fill="none" stroke="#ffb066" strokeWidth={1} strokeOpacity={0.08} />
      </svg>

      {/* The glow: a soft amber light source — the visual anchor that
          keeps a dark page from reading as flat or empty. */}
      <div
        className="absolute left-1/2 top-[-18%] h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.35] blur-[110px]"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 50%, #ff8a3d, #e0561a 45%, transparent 75%)",
        }}
      />
      <div
        className="absolute left-1/2 top-[-6%] h-[220px] w-[420px] -translate-x-1/2 rounded-full opacity-[0.4] blur-[60px]"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 50%, #ffb066, transparent 70%)",
        }}
      />

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

      {/* The orbital core: a tilted halo ring turning slowly around the
          glow, a sparse constellation of nodes threaded by a handful of
          long signal-carrying lines, and a few light streaks rising out
          of the glow and fading near the top. */}
      <svg
        className="absolute left-1/2 top-[-18%] h-[560px] w-[900px] -translate-x-1/2 overflow-visible"
        viewBox="0 0 900 560"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ambient-streak-fade" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffb066" stopOpacity={0} />
            <stop offset="35%" stopColor="#ffb066" stopOpacity={1} />
            <stop offset="100%" stopColor="#ffb066" stopOpacity={0} />
          </linearGradient>
        </defs>

        <ellipse
          className="ambient-ring"
          cx={450}
          cy={250}
          rx={320}
          ry={112}
          fill="none"
          stroke="#ffb066"
          strokeWidth={1}
          strokeOpacity={0.24}
          transform="rotate(-10 450 250)"
        />

        <g stroke="#ffb066" strokeLinecap="round">
          {CONSTELLATION_EDGES.map((e, i) => (
            <line
              key={i}
              className="ambient-signal"
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              strokeWidth={0.75}
              strokeOpacity={0.22}
              strokeDasharray="3 10"
              style={{ animationDuration: `${e.d}s`, animationDelay: `${e.dl}s` }}
            />
          ))}
        </g>

        <g>
          {CONSTELLATION_NODES.map((n, i) => (
            <circle
              key={i}
              className="ambient-node"
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="#ffb066"
              opacity={n.o}
              style={{ animationDuration: `${n.d}s`, animationDelay: `${n.dl}s` }}
            />
          ))}
        </g>

        <g>
          {RISING_STREAKS.map((s, i) => (
            <line
              key={i}
              className="ambient-streak"
              x1={s.x}
              y1={s.y}
              x2={s.x}
              y2={s.y - 46}
              stroke="url(#ambient-streak-fade)"
              strokeWidth={1.2}
              strokeLinecap="round"
              style={
                {
                  animationDuration: `${s.d}s`,
                  animationDelay: `${s.dl}s`,
                  "--ambient-rise": `-${s.rise}px`,
                  "--ambient-streak-o": s.o,
                } as React.CSSProperties
              }
            />
          ))}
        </g>
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
