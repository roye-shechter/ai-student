/**
 * Atmospheric backdrop for the "AI Platform" identity: a deep navy canvas
 * lit by one warm amber glow, sitting behind every page instead of only a
 * marketing hero. The glow's core is a particle orb — a dense cluster of
 * small points concentrated at the center and thinning toward the edge,
 * each softly twinkling on its own cycle while the whole cluster drifts in
 * a slow, continuous rotation — the same "constellation sphere" read as a
 * cloud of light rather than a flat circle. Points are pre-generated
 * offline with a seeded RNG (not computed at runtime) so they're fixed and
 * never shift between loads. Server component: the animation is pure CSS,
 * so this still costs nothing at runtime.
 */

// prettier-ignore
const ORB_PARTICLES = [
  { x: 287.4, y: 206.3, s: 2, o: 0.74, d: 4.54, dl: -1.43 }, { x: 280.4, y: 374.4, s: 2.56, o: 0.8, d: 4.37, dl: -0.8 }, { x: 347.9, y: 337.5, s: 2.77, o: 0.9, d: 3.21, dl: -1.29 },
  { x: 386.8, y: 393.7, s: 2.08, o: 0.8, d: 3.6, dl: -2.16 }, { x: 426.2, y: 351.2, s: 2.06, o: 0.67, d: 4.79, dl: -3.88 }, { x: 303.5, y: 367.3, s: 2.5, o: 0.82, d: 4.5, dl: -1.17 },
  { x: 311.2, y: 298.6, s: 2.45, o: 0.94, d: 3.85, dl: -0.88 }, { x: 381, y: 558.6, s: 1.07, o: 0.47, d: 2.54, dl: -1.59 }, { x: 262.9, y: 392, s: 2.26, o: 0.69, d: 2.92, dl: -2.8 },
  { x: 288.5, y: 283.8, s: 2.7, o: 0.92, d: 4.52, dl: -0.38 }, { x: 369.1, y: 388.6, s: 2.34, o: 0.74, d: 4.56, dl: -1.78 }, { x: 189.5, y: 311.8, s: 2.24, o: 0.69, d: 4.52, dl: -1.52 },
  { x: 339.9, y: 314.7, s: 2.56, o: 0.9, d: 4.8, dl: -0.18 }, { x: 460.8, y: 475.9, s: 1.25, o: 0.51, d: 3.64, dl: -2.22 }, { x: 482.7, y: 326.7, s: 1.96, o: 0.59, d: 3.82, dl: -1.12 },
  { x: 336.5, y: 301.4, s: 2.82, o: 0.86, d: 3.05, dl: -4.28 }, { x: 321.7, y: 352.3, s: 2.64, o: 0.95, d: 4.76, dl: -3.54 }, { x: 322.5, y: 321.2, s: 2.93, o: 0.95, d: 4.38, dl: -3.74 },
  { x: 319.4, y: 316.7, s: 2.9, o: 0.93, d: 4.75, dl: -2.83 }, { x: 242.9, y: 334.9, s: 2.35, o: 0.74, d: 3.61, dl: -3.31 }, { x: 276.9, y: 317.5, s: 2.78, o: 0.84, d: 4.13, dl: -3.15 },
  { x: 314.2, y: 326.8, s: 2.77, o: 0.95, d: 4.84, dl: -1.15 }, { x: 292.6, y: 244, s: 2.21, o: 0.73, d: 4.26, dl: -0.03 }, { x: 297.2, y: 590.3, s: 0.77, o: 0.31, d: 4.72, dl: -0.07 },
  { x: 331.7, y: 358.9, s: 2.58, o: 0.82, d: 2.94, dl: -0.2 }, { x: 473.2, y: 459.2, s: 1.35, o: 0.55, d: 3.89, dl: -3.53 }, { x: 363.2, y: 351.9, s: 2.61, o: 0.87, d: 4.48, dl: -0.16 },
  { x: 332.7, y: 332.2, s: 2.56, o: 0.95, d: 4.61, dl: -3.17 }, { x: 363.2, y: 354.7, s: 2.47, o: 0.87, d: 3.54, dl: -0.01 }, { x: 297.6, y: 342.6, s: 2.54, o: 0.86, d: 4.65, dl: -0.68 },
  { x: 291.9, y: 359.5, s: 2.5, o: 0.81, d: 3.73, dl: -4.12 }, { x: 378.1, y: 523.6, s: 1.29, o: 0.41, d: 3.9, dl: -0.01 }, { x: 283.9, y: 417.4, s: 2.07, o: 0.71, d: 3.79, dl: -1.17 },
  { x: 95.6, y: 153.5, s: 1.26, o: 0.37, d: 3.8, dl: -3.77 }, { x: 319.2, y: 319.7, s: 2.75, o: 0.91, d: 4.11, dl: -3.92 }, { x: 361.5, y: 534.8, s: 1.52, o: 0.4, d: 2.67, dl: -0.09 },
  { x: 314.1, y: 270.5, s: 2.63, o: 0.82, d: 4.58, dl: -0.86 }, { x: 610.5, y: 251.3, s: 1.06, o: 0.28, d: 2.5, dl: -4.12 }, { x: 363.7, y: 367.4, s: 2.2, o: 0.85, d: 4.33, dl: -4.52 },
  { x: 317.3, y: 317.2, s: 2.77, o: 0.95, d: 4.13, dl: -0.01 }, { x: 190, y: 302.3, s: 2.07, o: 0.72, d: 2.93, dl: -0.55 }, { x: 320.2, y: 321.5, s: 2.62, o: 0.95, d: 3.31, dl: -1.53 },
  { x: 338.6, y: 345.9, s: 2.69, o: 0.92, d: 3.81, dl: -1.95 }, { x: 345.1, y: 299.2, s: 2.82, o: 0.95, d: 4.85, dl: -2.64 }, { x: 334.6, y: 340.3, s: 2.53, o: 0.95, d: 4.24, dl: -3.42 },
  { x: 413.2, y: 83.3, s: 1.26, o: 0.32, d: 3.85, dl: -1.61 }, { x: 550.2, y: 388.3, s: 1.25, o: 0.42, d: 4.51, dl: -3.3 }, { x: 363, y: 391.8, s: 2.54, o: 0.72, d: 3.46, dl: -1.68 },
  { x: 349.2, y: 418.5, s: 2.16, o: 0.79, d: 4.43, dl: -2.66 }, { x: 507.4, y: 315.5, s: 1.81, o: 0.53, d: 3.46, dl: -1.46 }, { x: 269.6, y: 290.5, s: 2.61, o: 0.87, d: 4.2, dl: -2.18 },
  { x: 320.2, y: 319.5, s: 2.72, o: 0.92, d: 3.38, dl: -4.2 }, { x: 254.2, y: 332, s: 2.24, o: 0.81, d: 2.65, dl: -1.87 }, { x: 502.9, y: 129.4, s: 1.18, o: 0.43, d: 2.57, dl: -3.81 },
  { x: 343.2, y: 292.3, s: 2.65, o: 0.86, d: 3.15, dl: -2.8 }, { x: 336.7, y: 331.2, s: 2.94, o: 0.95, d: 3.74, dl: -2.26 }, { x: 216.5, y: 343.3, s: 2.23, o: 0.71, d: 4.89, dl: -0.98 },
  { x: 320, y: 321.9, s: 2.95, o: 0.95, d: 3.73, dl: -2.56 }, { x: 247.4, y: 196.4, s: 1.97, o: 0.67, d: 3.25, dl: -0.9 }, { x: 322.7, y: 367.3, s: 2.74, o: 0.83, d: 3.09, dl: -4.69 },
  { x: 320.1, y: 321.4, s: 2.84, o: 0.91, d: 3.04, dl: -1.74 }, { x: 319.2, y: 320.9, s: 2.76, o: 0.95, d: 4.12, dl: -2.2 }, { x: 454.6, y: 165.3, s: 1.61, o: 0.46, d: 3.36, dl: -0.43 },
  { x: 71.7, y: 345.5, s: 1.33, o: 0.43, d: 4.04, dl: -4.1 }, { x: 314.4, y: 343, s: 2.87, o: 0.87, d: 3.63, dl: -3.81 }, { x: 314.4, y: 314.5, s: 2.76, o: 0.89, d: 4.08, dl: -1.13 },
  { x: 317.3, y: 314.7, s: 2.76, o: 0.92, d: 4.99, dl: -4.96 }, { x: 363.9, y: 187.9, s: 2.03, o: 0.59, d: 4.88, dl: -0.31 }, { x: 320.5, y: 320.1, s: 3.03, o: 0.95, d: 3.67, dl: -1.86 },
  { x: 121.8, y: 395.3, s: 1.64, o: 0.5, d: 4.06, dl: -4.64 }, { x: 63, y: 254.2, s: 0.94, o: 0.38, d: 4.04, dl: -4.23 }, { x: 315.5, y: 304.4, s: 2.97, o: 0.92, d: 4.83, dl: -1.12 },
  { x: 318.2, y: 322.7, s: 2.89, o: 0.94, d: 4.84, dl: -4.32 }, { x: 404.2, y: 262, s: 2.19, o: 0.8, d: 3.87, dl: -1.92 }, { x: 170.7, y: 165.9, s: 1.19, o: 0.51, d: 3.39, dl: -3.41 },
  { x: 342.1, y: 290.7, s: 2.78, o: 0.88, d: 2.99, dl: -2.17 }, { x: 488.3, y: 489, s: 1.2, o: 0.37, d: 4.18, dl: -3.9 }, { x: 327.2, y: 427.1, s: 2.3, o: 0.74, d: 2.68, dl: -1.09 },
  { x: 310.2, y: 311.1, s: 2.87, o: 0.95, d: 2.68, dl: -3.07 }, { x: 322.2, y: 322.5, s: 2.64, o: 0.91, d: 3.71, dl: -3.91 }, { x: 418.9, y: 98.1, s: 1.36, o: 0.41, d: 3.99, dl: -1.88 },
  { x: 214.2, y: 346, s: 1.97, o: 0.67, d: 4.43, dl: -4.81 }, { x: 376.4, y: 345.6, s: 2.32, o: 0.86, d: 4.29, dl: -3.78 }, { x: 375.3, y: 186, s: 2, o: 0.56, d: 4.27, dl: -1.1 },
  { x: 262, y: 370.3, s: 2.29, o: 0.81, d: 2.78, dl: -1.13 }, { x: 456.5, y: 353.5, s: 1.76, o: 0.61, d: 4.51, dl: -2.97 }, { x: 392.3, y: 505.1, s: 1.7, o: 0.45, d: 3.86, dl: -2.68 },
  { x: 227.1, y: 461.9, s: 1.73, o: 0.56, d: 2.91, dl: -3.23 }, { x: 327.2, y: 276.2, s: 2.69, o: 0.86, d: 2.7, dl: -1.87 }, { x: 135.2, y: 381.9, s: 1.52, o: 0.6, d: 3.35, dl: -4.41 },
  { x: 334.8, y: 402.1, s: 2.44, o: 0.8, d: 4.2, dl: -0.31 }, { x: 317.8, y: 318.1, s: 3.03, o: 0.95, d: 4.73, dl: -4.88 }, { x: 466.5, y: 316.4, s: 1.75, o: 0.66, d: 3.27, dl: -1.31 },
  { x: 396.8, y: 182.6, s: 1.94, o: 0.54, d: 4.87, dl: -3 }, { x: 368, y: 281.5, s: 2.39, o: 0.8, d: 4.43, dl: -0.63 }, { x: 278.7, y: 146.4, s: 1.51, o: 0.52, d: 3.98, dl: -0.67 },
  { x: 411.1, y: 332.8, s: 2.45, o: 0.77, d: 3.01, dl: -0.72 }, { x: 402.2, y: 308.9, s: 2.27, o: 0.77, d: 4.27, dl: -4.65 }, { x: 348.3, y: 373.6, s: 2.59, o: 0.79, d: 3.38, dl: -1.2 },
  { x: 497.3, y: 364.7, s: 1.93, o: 0.61, d: 4.59, dl: -0.97 }, { x: 480.6, y: 547.4, s: 1.09, o: 0.34, d: 3.7, dl: -0.91 }, { x: 111.1, y: 432.1, s: 1.34, o: 0.5, d: 4.84, dl: -1.42 },
  { x: 330.3, y: 332, s: 2.73, o: 0.95, d: 2.86, dl: -2.83 }, { x: 226.6, y: 353.1, s: 2.42, o: 0.71, d: 4.42, dl: -2.4 }, { x: 362.4, y: 66.9, s: 1.27, o: 0.4, d: 4.56, dl: -4.55 },
  { x: 384.5, y: 292, s: 2.37, o: 0.87, d: 2.64, dl: -4.99 }, { x: 87.3, y: 191.1, s: 1.09, o: 0.39, d: 3.25, dl: -1.38 }, { x: 292.9, y: 336.7, s: 2.73, o: 0.83, d: 3.26, dl: -0.08 },
  { x: 377, y: 327.7, s: 2.47, o: 0.85, d: 2.95, dl: -4.42 }, { x: 326.2, y: 319.7, s: 2.85, o: 0.95, d: 3.88, dl: -3.62 }, { x: 323.9, y: 381.8, s: 2.57, o: 0.8, d: 4.48, dl: -1.27 },
  { x: 308, y: 306, s: 2.87, o: 0.95, d: 4.5, dl: -0.88 }, { x: 592.3, y: 247.1, s: 0.9, o: 0.41, d: 3.33, dl: -1.28 }, { x: 420.6, y: 376.8, s: 2, o: 0.77, d: 4.06, dl: -4.73 },
  { x: 561, y: 209.9, s: 0.97, o: 0.35, d: 4.73, dl: -4.7 }, { x: 317.2, y: 328.6, s: 2.58, o: 0.95, d: 3.36, dl: -4.04 }, { x: 346, y: 344.5, s: 2.82, o: 0.94, d: 4.65, dl: -4.72 },
  { x: 298.5, y: 290.2, s: 2.55, o: 0.95, d: 3.62, dl: -3.9 }, { x: 521.7, y: 409.5, s: 1.49, o: 0.43, d: 2.46, dl: -0.42 }, { x: 319.1, y: 316.9, s: 2.97, o: 0.95, d: 4.12, dl: -1.23 },
  { x: 108.5, y: 285.1, s: 1.47, o: 0.58, d: 4.63, dl: -3.02 }, { x: 311.4, y: 331.7, s: 2.82, o: 0.95, d: 3.67, dl: -2.7 }, { x: 334.4, y: 192.8, s: 2.16, o: 0.63, d: 2.67, dl: -0.24 },
  { x: 344.2, y: 226.2, s: 2.32, o: 0.75, d: 2.58, dl: -0.52 }, { x: 236.1, y: 499.6, s: 1.41, o: 0.49, d: 2.47, dl: -0.38 }, { x: 442, y: 359, s: 2.17, o: 0.72, d: 3.21, dl: -4 },
  { x: 512.5, y: 358.2, s: 1.35, o: 0.48, d: 4.54, dl: -3.43 }, { x: 383.8, y: 221.3, s: 2.23, o: 0.76, d: 2.94, dl: -0.15 }, { x: 317.8, y: 321.7, s: 2.72, o: 0.95, d: 3.53, dl: -2.32 },
  { x: 304.2, y: 287, s: 2.63, o: 0.9, d: 2.95, dl: -1.22 }, { x: 452.9, y: 282.2, s: 1.88, o: 0.64, d: 2.65, dl: -4.16 }, { x: 330.9, y: 311.5, s: 2.87, o: 0.95, d: 3.17, dl: -1.94 },
  { x: 245.6, y: 397.3, s: 2.09, o: 0.72, d: 4.9, dl: -2.36 }, { x: 109.3, y: 271.9, s: 1.5, o: 0.56, d: 2.6, dl: -1.68 }, { x: 161.6, y: 323.5, s: 1.75, o: 0.59, d: 4.23, dl: -2.16 },
  { x: 309.7, y: 127, s: 1.37, o: 0.58, d: 4.81, dl: -1.41 }, { x: 312.9, y: 296.1, s: 2.83, o: 0.92, d: 4.79, dl: -4.23 }, { x: 499.6, y: 256.4, s: 1.71, o: 0.5, d: 3.14, dl: -4.87 },
  { x: 313, y: 299.9, s: 2.7, o: 0.95, d: 3.17, dl: -0.59 }, { x: 597.1, y: 245.1, s: 1.07, o: 0.29, d: 3.77, dl: -2.28 }, { x: 328.2, y: 389.3, s: 2.51, o: 0.81, d: 4.33, dl: -0.25 },
  { x: 352.7, y: 206.1, s: 2.22, o: 0.74, d: 4.93, dl: -1.4 }, { x: 310.2, y: 305.8, s: 2.86, o: 0.92, d: 4.56, dl: -1.52 }, { x: 374.3, y: 273.7, s: 2.54, o: 0.78, d: 4.28, dl: -0.77 },
  { x: 316, y: 322.6, s: 2.59, o: 0.95, d: 3.2, dl: -4.05 }, { x: 349.7, y: 540.2, s: 1.44, o: 0.49, d: 2.82, dl: -1.9 }, { x: 520.5, y: 314.3, s: 1.36, o: 0.6, d: 4.5, dl: -2.95 },
  { x: 323.8, y: 387.8, s: 2.16, o: 0.88, d: 4.71, dl: -0.81 }, { x: 384.8, y: 303.8, s: 2.21, o: 0.87, d: 4.97, dl: -4.41 }, { x: 273.4, y: 175.9, s: 1.59, o: 0.56, d: 2.55, dl: -0.9 },
  { x: 319.9, y: 309.3, s: 2.7, o: 0.95, d: 4.87, dl: -3.06 }, { x: 345.1, y: 337.3, s: 2.54, o: 0.87, d: 4.51, dl: -0.32 }, { x: 322.5, y: 299.4, s: 2.8, o: 0.91, d: 3.05, dl: -2.94 },
  { x: 520.5, y: 509.5, s: 1.06, o: 0.34, d: 3.64, dl: -3.18 }, { x: 444.4, y: 417.2, s: 1.77, o: 0.61, d: 2.99, dl: -0.52 }, { x: 311.7, y: 341.5, s: 2.61, o: 0.94, d: 3.76, dl: -2.41 },
  { x: 311.3, y: 294.7, s: 2.42, o: 0.93, d: 4.54, dl: -3.33 }, { x: 343.3, y: 587.4, s: 1.25, o: 0.3, d: 4.93, dl: -0.24 }, { x: 287.2, y: 557, s: 1.15, o: 0.44, d: 3.11, dl: -1.02 },
  { x: 576, y: 262.7, s: 1.06, o: 0.43, d: 4.24, dl: -4.85 }, { x: 318.3, y: 472.7, s: 1.72, o: 0.67, d: 3.81, dl: -1.98 }, { x: 324.3, y: 318, s: 2.72, o: 0.95, d: 3.04, dl: -2.94 },
  { x: 525.1, y: 388.6, s: 1.56, o: 0.51, d: 4.21, dl: -0.06 }, { x: 339.6, y: 301.9, s: 2.69, o: 0.9, d: 3.06, dl: -1.75 }, { x: 238.3, y: 479.5, s: 1.72, o: 0.6, d: 2.78, dl: -3.87 },
  { x: 343, y: 332.2, s: 2.62, o: 0.89, d: 4.5, dl: -2.22 }, { x: 324.3, y: 303, s: 2.55, o: 0.95, d: 2.92, dl: -1.88 }, { x: 438.2, y: 302.3, s: 2.16, o: 0.76, d: 3.54, dl: -0.54 },
  { x: 305, y: 309.2, s: 2.85, o: 0.95, d: 3.77, dl: -2.18 }, { x: 322.3, y: 290.4, s: 2.7, o: 0.95, d: 3.68, dl: -2.53 },
] as const

export function AmbientTexture() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Base vignette: cool navy corners framing the canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_90%_at_50%_-20%,rgba(20,26,38,0.9),transparent_65%),radial-gradient(ellipse_100%_70%_at_50%_115%,rgba(0,0,0,0.55),transparent_60%)]" />

      {/* The glow: a soft amber light source behind the orb, blurred to a
          haze — the visual anchor that keeps a dark page from reading as
          flat or empty. */}
      <div
        className="absolute left-1/2 top-[-14%] h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-[0.38] blur-[110px]"
        style={{
          background: "radial-gradient(circle at 50% 50%, #ff8a3d, #e0561a 45%, transparent 75%)",
        }}
      />
      <div
        className="absolute left-1/2 top-[-6%] h-[200px] w-[200px] -translate-x-1/2 rounded-full opacity-[0.45] blur-[55px]"
        style={{
          background: "radial-gradient(circle at 50% 50%, #ffb066, transparent 70%)",
        }}
      />

      {/* Faint orbit boundary — geometry standing in for the halo the orb's
          own light would cast, not a decorative sticker. */}
      <div className="absolute left-1/2 top-[-10%] h-[600px] w-[600px] -translate-x-1/2 rounded-full border border-[#ff8a3d]/[0.1]" />

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

      {/* The particle orb: hundreds of amber points, densest at the core
          and thinning outward, each twinkling on its own cycle while the
          whole cluster turns slowly — a glowing sphere of light rather
          than a static ring. */}
      <svg
        className="absolute left-1/2 top-[-10%] h-[600px] w-[600px] -translate-x-1/2 overflow-visible"
        viewBox="0 0 640 640"
        aria-hidden="true"
      >
        <g className="ambient-orb-group">
          {ORB_PARTICLES.map((p, i) => (
            <circle
              key={i}
              className="ambient-orb-particle"
              cx={p.x}
              cy={p.y}
              r={p.s}
              fill="#ffb066"
              opacity={p.o}
              style={{ animationDuration: `${p.d}s`, animationDelay: `${p.dl}s` }}
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
