// The geometry of a rating history chart (SPEC §12.3), drawn in-house with
// no chart library. Games are evenly spaced, oldest on the left, with the
// rating before the first of them as the line's start. Coordinates are
// percentages of the plot, so the SVG can stretch to any width.
import type { RatingSeries } from "./history";

export interface ChartPoint {
  /** 0–100 from the left. */
  x: number;
  /** 0–100 from the top. */
  y: number;
  rating: number;
  at: string;
}

export interface RatingChart {
  /** The SVG path through every vertex, in a 100 × 100 box. */
  path: string;
  /** One per game (the start isn't a game). */
  points: ChartPoint[];
  /** The scale's top, middle and bottom, each on a step: at y 0, 50 and 100. */
  ticks: [number, number, number];
  first: number;
  last: number;
}

/** Ratings round to this on the scale; the scale spans at least two steps. */
const STEP = 50;

export function ratingChart(series: RatingSeries): RatingChart | null {
  const last = series.points.at(-1);
  if (!last) return null;
  const values = [
    ...(series.start === null ? [] : [series.start]),
    ...series.points.map((p) => p.rating),
  ];
  let low = Math.floor(Math.min(...values) / STEP) * STEP;
  let high = Math.ceil(Math.max(...values) / STEP) * STEP;
  if (high - low < 2 * STEP) {
    const middle = Math.round((low + high) / 2 / STEP) * STEP;
    low = middle - STEP;
    high = middle + STEP;
  }
  // Keep the middle tick on a step too.
  if ((high - low) % (2 * STEP) !== 0) high += STEP;
  const y = (rating: number) => ((high - rating) / (high - low)) * 100;
  // The start sits at x 0 and each game after it; a lone game sits in the middle.
  const slots = series.start === null ? series.points.length - 1 : series.points.length;
  const x = (i: number) => (slots === 0 ? 50 : (i / slots) * 100);
  const offset = series.start === null ? 0 : 1;
  const points = series.points.map((p, i) => ({ x: x(i + offset), y: y(p.rating), ...p }));
  const vertices = [...(series.start === null ? [] : [{ x: 0, y: y(series.start) }]), ...points];
  const path = vertices
    .map((v, i) => `${i === 0 ? "M" : "L"}${String(round(v.x))} ${String(round(v.y))}`)
    .join(" ");
  return {
    path,
    points,
    ticks: [high, (low + high) / 2, low],
    first: values[0] ?? last.rating,
    last: last.rating,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
