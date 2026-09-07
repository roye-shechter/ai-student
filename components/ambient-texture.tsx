/**
 * Replaces the old "living equations" tech backdrop with something quieter,
 * matching the classic-editorial identity: a soft warm vignette plus a
 * barely-there paper grain. No motion, no imagery (there are no real
 * photographs to draw color from in a study dashboard) — restraint reads as
 * premium the way it does in the photography-membership sites this look is
 * drawn from. Server component: static, so it costs nothing at runtime.
 */
export function AmbientTexture() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(184,141,87,0.09),transparent_60%),radial-gradient(ellipse_100%_60%_at_50%_110%,rgba(0,0,0,0.4),transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}
