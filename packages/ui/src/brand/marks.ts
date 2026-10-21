/**
 * kefche brand marks, "Pixel" design (owner-approved 2026-10-21, SPEC §6.1):
 * square-capped strokes with right angles, the two e's in the brand color.
 * Single source of geometry for the Logo component and the generated icons
 * (scripts/generate-icons.mjs). Pure data, no DOM.
 */

export const WORDMARK = {
  viewBox: "0 0 358 92",
  strokeWidth: 14,
  /** k, f, c, h, drawn in the text color. */
  ink: [
    "M14 12V78M42 40 18 58M28 52 44 78",
    "M138 78V16h20M128 42h24",
    "M218 42h-32v36h32",
    "M244 12V78M244 42h34v36",
  ],
  /** Both e's, drawn in the brand color. */
  accent: ["M74 60h34V42H74v36h34", "M306 60h34V42h-34v36h34"],
} as const;

/** Compact mark: a `k` on a rounded square (favicon, app icons). */
export const ICON = {
  viewBox: "0 0 64 64",
  size: 64,
  radius: 8,
  strokeWidth: 9,
  k: "M24 16V48M42 27 27 38M33 35 42 48",
  /** Visual center of the `k`, for scaling it inside full-bleed icons. */
  kCenter: [33, 32],
} as const;

/**
 * Fixed colors for static icon files, which can't use CSS variables. They
 * match the light-theme `--brand` and `--on-brand` tokens (6.2:1 contrast).
 */
export const ICON_COLORS = { fill: "#ff6b1a", ink: "#141826" } as const;
