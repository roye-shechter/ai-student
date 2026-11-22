/**
 * Atmospheric backdrop for the "AI Platform" identity: a deep navy canvas
 * lit by one warm amber glow, sitting behind every page instead of only a
 * marketing hero. Earlier revisions of this file were explicitly "abstract,
 * not anatomical" (an orbit ring + star-field, per a past request to move
 * away from anything brain-shaped) — the user has since asked for the
 * opposite: a brain silhouette here too, echoing the sister "mentality"
 * site, but reworked for this role rather than copied. That hero treatment
 * is bold, central, green, and interactive; this one sits behind real
 * content on every page, so it stays amber, faint, and static — a shape
 * you'd only consciously notice if you looked for it: two hemisphere
 * outlines, a central fissure, a small stem, and a handful of "neuron"
 * nodes confined to that silhouette (no dense node/edge mesh — that's
 * still the generic "AI network" cliché this file has always avoided).
 * No entrance animation, since that would replay on every navigation, and
 * no pointer interactivity, since this renders on every page and a mouse
 * listener here is pure overhead for a background element. Geometry is
 * computed once at module load with a seeded RNG — cheap, deterministic,
 * no client JS required. Server component: the animation is pure CSS, so
 * this still costs nothing at runtime.
 *
 * The three glow blur() radii below were trimmed down (was 110/60/55px) —
 * large stacked CSS blurs are GPU/memory-heavy on iOS Safari specifically,
 * a documented WebKit crash class (bugs.webkit.org/show_bug.cgi?id=231607)
 * that gets worse the more blurred layers are on screen at once — this
 * renders on every page, under every .glass-panel's own backdrop-filter on
 * top, so it's the single biggest lever here. See globals.css for the
 * matching `pointer: coarse` rule that stops the continuous SVG animations
 * below on touch devices (same mechanism as prefers-reduced-motion).
 */

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BRAIN_CENTER_X = 450
const LEFT_LOBE = { cx: 390, cy: 215, rx: 150, ry: 165 }
const RIGHT_LOBE = { cx: 510, cy: 215, rx: 150, ry: 165 }
const STEM_TOP = 365
const STEM_BOTTOM = 455
const STEM_TOP_HALF_WIDTH = 30
const STEM_BOTTOM_HALF_WIDTH = 12
const FISSURE_HALF_WIDTH = 11

function inEllipse(x: number, y: number, e: { cx: number; cy: number; rx: number; ry: number }) {
  const dx = (x - e.cx) / e.rx
  const dy = (y - e.cy) / e.ry
  return dx * dx + dy * dy <= 1
}

function inStem(x: number, y: number) {
  if (y < STEM_TOP || y > STEM_BOTTOM) return false
  const t = (y - STEM_TOP) / (STEM_BOTTOM - STEM_TOP)
  const halfWidth = STEM_TOP_HALF_WIDTH + (STEM_BOTTOM_HALF_WIDTH - STEM_TOP_HALF_WIDTH) * t
  return Math.abs(x - BRAIN_CENTER_X) <= halfWidth
}

function inBrain(x: number, y: number) {
  if (inStem(x, y)) return true
  const left = inEllipse(x, y, LEFT_LOBE)
  const right = inEllipse(x, y, RIGHT_LOBE)
  if (!left && !right) return false
  if (y < STEM_TOP && Math.abs(x - BRAIN_CENTER_X) < FISSURE_HALF_WIDTH) return false
  return true
}

type Lobe = { cx: number; cy: number; rx: number; ry: number }

function wavePoint(lobe: Lobe, a: number, inset: number, freq: number, amp: number, phase: number) {
  const r = 1 + Math.sin(a * freq + phase) * amp
  return [lobe.cx + Math.cos(a) * lobe.rx * inset * r, lobe.cy + Math.sin(a) * lobe.ry * inset * r] as const
}

function arcPath(lobe: Lobe, inset: number, freq: number, amp: number, phase: number, startA: number, endA: number, steps = 56) {
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const a = startA + ((endA - startA) * i) / steps
    const [x, y] = wavePoint(lobe, a, inset, freq, amp, phase)
    d += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)} ` : `L${x.toFixed(1)},${y.toFixed(1)} `
  }
  return d
}

/**
 * An outer contour plus a couple of inner fold arcs — a bare outline of two
 * overlapping ellipses reads as two moons, not a brain; a few cortical
 * folds (same idea as the "mentality" hero, much fainter) are what actually
 * sells the shape at a glance.
 */
function foldLines(lobe: Lobe, seed: number) {
  const rand = mulberry32(seed)
  const lines: { path: string; opacity: number; width: number }[] = []

  lines.push({ path: arcPath(lobe, 1, 3, 0.02, rand() * Math.PI * 2, 0, Math.PI * 2) + 'Z', opacity: 0.36, width: 1.1 })

  const upperArcs = [
    { inset: 0.82, range: 0.9 },
    { inset: 0.6, range: 0.76 },
  ]
  for (const { inset, range } of upperArcs) {
    const freq = 3 + Math.floor(rand() * 2)
    const amp = 0.05 + rand() * 0.04
    const phase = rand() * Math.PI * 2
    lines.push({
      path: arcPath(lobe, inset, freq, amp, phase, -Math.PI * range, -Math.PI * (1 - range)),
      opacity: 0.22,
      width: 0.9,
    })
  }

  lines.push({
    path: arcPath(lobe, 0.55, 2, 0.08, rand() * Math.PI * 2, Math.PI * 0.1, Math.PI * 0.5),
    opacity: 0.24,
    width: 0.9,
  })

  return lines
}

function stemPath() {
  const midY = (STEM_TOP + STEM_BOTTOM) / 2
  return [
    `M ${BRAIN_CENTER_X - STEM_TOP_HALF_WIDTH} ${STEM_TOP}`,
    `Q ${BRAIN_CENTER_X - STEM_TOP_HALF_WIDTH * 0.8} ${midY} ${BRAIN_CENTER_X - STEM_BOTTOM_HALF_WIDTH} ${STEM_BOTTOM}`,
    `L ${BRAIN_CENTER_X + STEM_BOTTOM_HALF_WIDTH} ${STEM_BOTTOM}`,
    `Q ${BRAIN_CENTER_X + STEM_TOP_HALF_WIDTH * 0.8} ${midY} ${BRAIN_CENTER_X + STEM_TOP_HALF_WIDTH} ${STEM_TOP}`,
  ].join(' ')
}

function fissurePath() {
  const top = LEFT_LOBE.cy - LEFT_LOBE.ry
  return `M ${BRAIN_CENTER_X} ${top + 6} Q ${BRAIN_CENTER_X - 6} ${LEFT_LOBE.cy} ${BRAIN_CENTER_X} ${STEM_TOP - 2}`
}

const LEFT_FOLDS = foldLines(LEFT_LOBE, 7001)
const RIGHT_FOLDS = foldLines(RIGHT_LOBE, 7002)
const STEM_PATH = stemPath()
const FISSURE_PATH = fissurePath()

// A handful of "neuron" nodes, confined to the brain's own silhouette
// instead of scattered freely — a seeded RNG, computed once at module load.
function generateNeurons(seed: number, count: number) {
  const rand = mulberry32(seed)
  const nodes: { x: number; y: number; r: number; o: number; d: number; dl: number }[] = []
  let attempts = 0
  while (nodes.length < count && attempts < count * 60) {
    attempts++
    const x = 240 + rand() * 420
    const y = 50 + rand() * 410
    if (!inBrain(x, y)) continue
    nodes.push({ x, y, r: 1.2 + rand() * 1.6, o: 0.25 + rand() * 0.35, d: 4 + rand() * 2.5, dl: rand() * 5 })
  }
  return nodes
}

const NEURONS = generateNeurons(7003, 16)

// Two or three quiet connections among nearby neurons — enough to read as
// "signal", never enough to read as a circuit diagram.
function generateSynapses(nodes: typeof NEURONS, maxCount: number, maxDist: number) {
  const edges: { x1: number; y1: number; x2: number; y2: number; d: number; dl: number }[] = []
  const rand = mulberry32(7004)
  for (let i = 0; i < nodes.length && edges.length < maxCount; i++) {
    for (let j = i + 1; j < nodes.length && edges.length < maxCount; j++) {
      const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      if (dist > 0 && dist <= maxDist) {
        edges.push({ x1: nodes[i].x, y1: nodes[i].y, x2: nodes[j].x, y2: nodes[j].y, d: 5 + rand() * 2, dl: rand() * 4 })
      }
    }
  }
  return edges
}

const SYNAPSES = generateSynapses(NEURONS, 3, 90)

// prettier-ignore
const RISING_STREAKS = [
  { x: 387.3, y: 399.7, rise: 150, d: 7.29, dl: 5.56, o: 0.59 }, { x: 358.8, y: 420, rise: 146, d: 6.42, dl: 3.28, o: 0.49 },
  { x: 427.5, y: 389.9, rise: 128, d: 5.47, dl: 3.53, o: 0.43 }, { x: 459.2, y: 409.3, rise: 158, d: 6.4, dl: 0.94, o: 0.35 },
  { x: 344.5, y: 444.9, rise: 108, d: 7.79, dl: 3.01, o: 0.5 }, { x: 329.6, y: 434, rise: 106, d: 6.19, dl: 1.61, o: 0.56 },
] as const

export function AmbientTexture() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Base vignette: cool navy corners framing the canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_90%_at_50%_-20%,rgba(20,26,38,0.9),transparent_65%),radial-gradient(ellipse_100%_70%_at_50%_115%,rgba(0,0,0,0.55),transparent_60%)]" />

      {/* A small dim, cool-toned "moon" off to one side — a quiet depth
          cue so the canvas doesn't read as one flat plane. */}
      <div
        className="absolute left-[8%] top-[9%] h-[150px] w-[150px] rounded-full opacity-[0.3] blur-[40px]"
        style={{ background: "radial-gradient(circle, rgba(64,76,102,0.55), transparent 70%)" }}
      />

      {/* Two giant, page-scale arcs centered off opposite corners — only a
          thin sliver of each huge circle crosses the canvas, pure depth
          texture, unrelated to the brain silhouette below. */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx={160} cy={-180} r={950} fill="none" stroke="#ffb066" strokeWidth={1} strokeOpacity={0.1} />
        <circle cx={1480} cy={1120} r={820} fill="none" stroke="#ffb066" strokeWidth={1} strokeOpacity={0.08} />
      </svg>

      {/* The glow: a soft amber light source — the visual anchor that
          keeps a dark page from reading as flat or empty. */}
      <div
        className="absolute left-1/2 top-[-18%] h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.35] blur-[80px]"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 50%, #ff8a3d, #e0561a 45%, transparent 75%)",
        }}
      />
      <div
        className="absolute left-1/2 top-[-6%] h-[220px] w-[420px] -translate-x-1/2 rounded-full opacity-[0.4] blur-[45px]"
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

      {/* The brain: two faint hemisphere outlines, a central fissure, a
          small stem, and a sparse handful of neurons inside that shape —
          static and quiet, a texture inside the glow rather than a hero. */}
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

        <g className="ambient-brain" fill="none" stroke="#ffb066" strokeLinejoin="round">
          {LEFT_FOLDS.map((line, i) => (
            <path key={`l${i}`} d={line.path} strokeWidth={line.width} strokeOpacity={line.opacity} />
          ))}
          {RIGHT_FOLDS.map((line, i) => (
            <path key={`r${i}`} d={line.path} strokeWidth={line.width} strokeOpacity={line.opacity} />
          ))}
          <path d={STEM_PATH} strokeWidth={1} strokeOpacity={0.24} />
          <path d={FISSURE_PATH} strokeWidth={1.2} strokeOpacity={0.36} strokeLinecap="round" />
        </g>

        <g stroke="#ffb066" strokeLinecap="round">
          {SYNAPSES.map((e, i) => (
            <line
              key={i}
              className="ambient-signal"
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              strokeWidth={0.6}
              strokeOpacity={0.18}
              strokeDasharray="3 10"
              style={{ animationDuration: `${e.d}s`, animationDelay: `${e.dl}s` }}
            />
          ))}
        </g>

        <g>
          {NEURONS.map((n, i) => (
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
