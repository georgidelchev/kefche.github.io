// A seat's colour and shape (SPEC §6.2): pieces use --player-<n>, and every
// seat also has a shape, so colour is never the only signal.

import { SHAPE_PATHS } from "../browser/shapes";
import { seatShape } from "../seats";

import type { CSSProperties } from "react";

/** --fill and --ink for a seat's pieces: its --player-<n> colour and the ink on it. */
export function seatStyle(seat: number): CSSProperties {
  const n = String((seat % 8) + 1);
  return { "--fill": `var(--player-${n})`, "--ink": `var(--player-${n}-ink)` } as CSSProperties;
}

/** The seat's shape as an SVG, filled with --ink (set by seatStyle) unless styled. */
export function SeatShape({ seat, className }: { seat: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d={SHAPE_PATHS[seatShape(seat)]} />
    </svg>
  );
}
