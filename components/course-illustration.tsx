// Generative, subject-aware cover art for a course. There is no real course
// photography, so each card earns its visual identity from a deterministic
// vector motif keyed off the course name — an integral/graph line for math,
// an orbit for physics, a molecule ring for chemistry, and so on — rendered
// in the app's navy/amber duotone rather than a stock icon. Deterministic
// per course (seeded by courseCode), not random per render, so a course's
// cover stays stable.

type Category =
  | "math"
  | "physics"
  | "chemistry"
  | "biology"
  | "cs"
  | "business"
  | "law"
  | "engineering"
  | "humanities"
  | "abstract"

const KEYWORDS: Record<Exclude<Category, "abstract">, string[]> = {
  // Hebrew stems are deliberately short and avoid word-final letter forms
  // (ם/ן/ץ/ף/ך) at the end of a stem — "אלגוריתם" would fail to match its
  // own plural "אלגוריתמים" because the internal letter changes shape
  // (ם -> מ) once it's no longer word-final, so we match on "אלגורית" instead.
  math: ["מתמט", "אינפי", "אלגברה", "גיאומטר", "סטטיסטיק", "הסתברות", "אנליזה", "טופולוג", "calculus", "algebra", "math", "geometry", "statistics"],
  physics: ["פיזיקה", "מכניקה", "קוונט", "תרמודינמ", "אלקטרומגנט", "אופטיקה", "גרעי", "physics", "quantum", "mechanics", "thermodynamic"],
  chemistry: ["כימיה", "אורגנית", "אנאורגנית", "ביוכימיה", "פולימר", "chemistry", "chem", "biochemistry"],
  biology: ["ביולוגיה", "רפואה", "אנטומיה", "גנטיקה", "מיקרוביולוגיה", "פיזיולוגיה", "אקולוגיה", "biology", "medic", "anatomy", "genetics"],
  cs: ["מדעי המחשב", "תכנות", "אלגורית", "מבני נתונים", "רשתות תקשורת", "מסדי נתונים", "בינה מלאכותית", "הנדסת תוכנה", "programming", "computer", "algorithm", "software", "data structures"],
  business: ["כלכלה", "חשבונאות", "מנהל עסקים", "מימו", "שיווק", "מיקרו", "מאקרו", "economics", "finance", "accounting", "business", "marketing"],
  law: ["משפט", "דיני", "חוקתי", "law", "legal"],
  engineering: ["הנדסה", "מכונות", "חשמל", "בקרה", "מכניקת", "engineering", "mechanical", "electrical", "control systems"],
  humanities: ["ספרות", "היסטוריה", "פילוסופיה", "לשו", "שפה", "תרבות", "אנגלית", "history", "literature", "philosophy", "language"],
}

function classify(courseName: string, description?: string | null): Category {
  const name = courseName.toLowerCase()
  for (const [cat, words] of Object.entries(KEYWORDS) as [Exclude<Category, "abstract">, string[]][]) {
    if (words.some((w) => name.includes(w.toLowerCase()))) return cat
  }
  // The course name alone (often a short local label) may not carry the
  // subject; fall back to the description before giving up on a motif.
  if (description) {
    const desc = description.toLowerCase()
    for (const [cat, words] of Object.entries(KEYWORDS) as [Exclude<Category, "abstract">, string[]][]) {
      if (words.some((w) => desc.includes(w.toLowerCase()))) return cat
    }
  }
  return "abstract"
}

// Small deterministic PRNG (mulberry32) seeded from the course code, so a
// given course always renders the same illustration but siblings in the
// same category still look distinct from one another.
function rngFrom(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const ACCENT = "#ffb066"
const DIM = "#5a6070"
const ACCENT_ALT = "#ff7a3d"

function Motif({ category, rand }: { category: Category; rand: () => number }) {
  const jitter = (range: number) => (rand() - 0.5) * range

  switch (category) {
    case "math": {
      const cx = 70 + jitter(20)
      const cy = 90 + jitter(10)
      return (
        <>
          <path d={`M20,120 L20,20 M20,120 L185,120`} stroke={DIM} strokeWidth="1" opacity="0.5" />
          <path
            d={`M25,${cy + 25} C ${cx},${cy - 60} ${cx + 40},${cy + 60} 170,${cy - 40}`}
            fill="none"
            stroke={ACCENT_ALT}
            strokeWidth="1.4"
            opacity="0.75"
          />
          <circle cx={cx + 40} cy={cy + 60 - 90} r="2.5" fill={ACCENT_ALT} opacity="0.9" />
          <text x="118" y="45" fontFamily="Georgia, serif" fontSize="26" fill={ACCENT}>∫</text>
          <text x="150" y="95" fontFamily="Georgia, serif" fontSize="20" fill={ACCENT} opacity="0.8">∑</text>
          <text x="35" y="70" fontFamily="Georgia, serif" fontSize="17" fill={DIM}>π</text>
        </>
      )
    }
    case "physics": {
      const r1 = 68 + jitter(8)
      const rot = jitter(60)
      return (
        <>
          <circle cx="100" cy="78" r="5" fill={ACCENT} />
          <ellipse cx="100" cy="78" rx={r1} ry="22" fill="none" stroke={DIM} strokeWidth="1" transform={`rotate(${rot} 100 78)`} />
          <ellipse cx="100" cy="78" rx="46" ry="46" fill="none" stroke={ACCENT_ALT} strokeWidth="1" opacity="0.6" transform={`rotate(${rot + 55} 100 78)`} />
          <circle cx={100 + r1 * Math.cos((rot * Math.PI) / 180)} cy={78 + 22 * Math.sin((rot * Math.PI) / 180)} r="2.5" fill={ACCENT_ALT} />
          <path d="M15,135 Q35,115 55,135 T95,135 T135,135 T175,135" fill="none" stroke={DIM} strokeWidth="1" opacity="0.5" />
        </>
      )
    }
    case "chemistry": {
      const cx = 95 + jitter(15)
      const cy = 78 + jitter(10)
      const R = 34
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6
        return [cx + R * Math.cos(a), cy + R * Math.sin(a)]
      })
      const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z"
      return (
        <>
          <path d={path} fill="none" stroke={ACCENT} strokeWidth="1.2" opacity="0.75" />
          {pts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={i % 2 === 0 ? ACCENT_ALT : DIM} />
          ))}
          <line x1="150" y1="30" x2="170" y2="16" stroke={DIM} strokeWidth="1" opacity="0.6" />
          <circle cx="150" cy="30" r="2.5" fill={DIM} />
          <circle cx="170" cy="16" r="2.5" fill={ACCENT_ALT} />
        </>
      )
    }
    case "biology": {
      const amp = 20 + jitter(6)
      const path1 = `M25,20 C ${25 + amp},45 ${25 - amp},70 25,95 C ${25 + amp},120 ${25 - amp},135 25,150`
      const path2 = `M55,20 C ${55 - amp},45 ${55 + amp},70 55,95 C ${55 - amp},120 ${55 + amp},135 55,150`
      const rungs = [30, 55, 80, 105, 130]
      return (
        <g transform="translate(50 0)">
          <path d={path1} fill="none" stroke={ACCENT} strokeWidth="1.3" opacity="0.75" />
          <path d={path2} fill="none" stroke={ACCENT_ALT} strokeWidth="1.3" opacity="0.7" />
          {rungs.map((y, i) => (
            <line key={i} x1="25" y1={y} x2="55" y2={y} stroke={DIM} strokeWidth="0.8" opacity="0.5" />
          ))}
        </g>
      )
    }
    case "cs": {
      const nodes = [
        [30, 30], [100 + jitter(20), 30], [170, 30 + jitter(10)],
        [30, 90], [100, 90 + jitter(10)], [170, 100],
        [60, 135], [140, 135],
      ]
      const edges = [[0, 1], [1, 2], [0, 3], [1, 4], [4, 5], [3, 6], [4, 7]]
      return (
        <>
          {edges.map(([a, b], i) => (
            <path
              key={i}
              d={`M${nodes[a][0]},${nodes[a][1]} L${nodes[a][0]},${nodes[b][1]} L${nodes[b][0]},${nodes[b][1]}`}
              fill="none"
              stroke={DIM}
              strokeWidth="1"
              opacity="0.55"
            />
          ))}
          {nodes.map(([x, y], i) => (
            <rect key={i} x={x - 3} y={y - 3} width="6" height="6" fill={i % 3 === 0 ? ACCENT_ALT : ACCENT} opacity="0.85" />
          ))}
          <text x="115" y="55" fontFamily="var(--font-mono, monospace)" fontSize="11" fill={ACCENT_ALT} opacity="0.7">01</text>
          <text x="140" y="120" fontFamily="var(--font-mono, monospace)" fontSize="11" fill={DIM} opacity="0.7">10</text>
        </>
      )
    }
    case "business": {
      const heights = [28, 45, 36, 60, 78].map((h) => h + jitter(10))
      const baseY = 130
      return (
        <>
          {heights.map((h, i) => (
            <rect key={i} x={25 + i * 30} y={baseY - h} width="14" height={h} fill={i === heights.length - 1 ? ACCENT_ALT : DIM} opacity={i === heights.length - 1 ? 0.85 : 0.55} />
          ))}
          <path
            d={`M32,${baseY - heights[0]} ${heights.map((h, i) => `L${32 + i * 30},${baseY - h}`).join(" ")}`}
            fill="none"
            stroke={ACCENT}
            strokeWidth="1.3"
          />
          <circle cx={32 + (heights.length - 1) * 30} cy={baseY - heights[heights.length - 1]} r="3" fill={ACCENT} />
        </>
      )
    }
    case "law": {
      const tilt = jitter(6)
      return (
        <g transform={`rotate(${tilt} 100 75)`}>
          <line x1="100" y1="25" x2="100" y2="130" stroke={DIM} strokeWidth="1.2" opacity="0.6" />
          <line x1="55" y1="40" x2="145" y2="40" stroke={ACCENT} strokeWidth="1.2" />
          <line x1="55" y1="40" x2="40" y2="75" stroke={DIM} strokeWidth="1" opacity="0.6" />
          <line x1="55" y1="40" x2="70" y2="75" stroke={DIM} strokeWidth="1" opacity="0.6" />
          <path d="M40,75 A15,10 0 0 0 70,75" fill="none" stroke={ACCENT_ALT} strokeWidth="1.2" opacity="0.75" />
          <line x1="145" y1="40" x2="130" y2="75" stroke={DIM} strokeWidth="1" opacity="0.6" />
          <line x1="145" y1="40" x2="160" y2="75" stroke={DIM} strokeWidth="1" opacity="0.6" />
          <path d="M130,75 A15,10 0 0 0 160,75" fill="none" stroke={ACCENT_ALT} strokeWidth="1.2" opacity="0.75" />
          <line x1="75" y1="130" x2="125" y2="130" stroke={DIM} strokeWidth="1.2" opacity="0.6" />
        </g>
      )
    }
    case "engineering": {
      const teeth = 8
      const cx = 100
      const cy = 78
      const rOuter = 34
      const rInner = 26
      return (
        <>
          {Array.from({ length: teeth }, (_, i) => {
            const a = ((Math.PI * 2) / teeth) * i
            const x1 = cx + rInner * Math.cos(a)
            const y1 = cy + rInner * Math.sin(a)
            const x2 = cx + rOuter * Math.cos(a)
            const y2 = cy + rOuter * Math.sin(a)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeWidth="3" opacity="0.7" />
          })}
          <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={ACCENT} strokeWidth="1.2" opacity="0.75" />
          <circle cx={cx} cy={cy} r="5" fill={ACCENT_ALT} />
          <line x1="15" y1="140" x2="185" y2="140" stroke={DIM} strokeWidth="0.8" opacity="0.4" />
          {[30, 60, 90, 120, 150, 180].map((x, i) => (
            <line key={i} x1={x} y1="136" x2={x} y2="144" stroke={DIM} strokeWidth="0.8" opacity="0.4" />
          ))}
        </>
      )
    }
    case "humanities": {
      const sway = jitter(10)
      return (
        <>
          <path d={`M30,140 C ${60 + sway},60 ${140 - sway},90 165,25`} fill="none" stroke={ACCENT} strokeWidth="1.4" opacity="0.8" />
          <circle cx="165" cy="25" r="2.5" fill={ACCENT_ALT} />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1="30" y1={100 + i * 12} x2={30 + 60 - i * 14} y2={100 + i * 12} stroke={DIM} strokeWidth="1" opacity="0.5" />
          ))}
        </>
      )
    }
    case "abstract":
    default: {
      const n = 7
      const nodes = Array.from({ length: n }, () => [30 + rand() * 140, 25 + rand() * 110])
      const edges: [number, number][] = []
      for (let i = 0; i < n; i++) {
        edges.push([i, (i + 1 + Math.floor(rand() * 2)) % n])
      }
      return (
        <>
          {edges.map(([a, b], i) => (
            <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke={DIM} strokeWidth="0.9" opacity="0.45" />
          ))}
          {nodes.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 3.5 : 2.5} fill={i % 3 === 0 ? ACCENT_ALT : ACCENT} opacity="0.85" />
          ))}
        </>
      )
    }
  }
}

export function CourseIllustration({
  courseName,
  description,
  seed,
}: {
  courseName: string
  description?: string | null
  seed: string
}) {
  const category = classify(courseName, description)
  const rand = rngFrom(seed)

  return (
    <svg
      viewBox="0 0 200 150"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full opacity-60 transition-opacity duration-500 group-hover:opacity-80"
      aria-hidden="true"
    >
      <Motif category={category} rand={rand} />
    </svg>
  )
}
