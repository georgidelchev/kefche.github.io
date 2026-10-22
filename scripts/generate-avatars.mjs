// Preset avatar generator: `pnpm avatars:generate`.
// Writes the "Blob buddies" set (owner's pick, Phase 2) to
// apps/web/public/avatars/blob-01.svg … blob-24.svg: eight player colors
// (tokens.css --player-N, color-blind safe) × three face sets. Deterministic,
// so regenerating changes nothing unless this file changes. The ids must stay
// in sync with the profiles.avatar_preset check (supabase/migrations).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "apps/web/public/avatars");

// [fill, ink] per player color, from packages/ui/src/tokens.css.
const PLAYER = [
  ["#e69f00", "#141826"],
  ["#56b4e9", "#141826"],
  ["#009e73", "#141826"],
  ["#f0e442", "#141826"],
  ["#0072b2", "#ffffff"],
  ["#d55e00", "#141826"],
  ["#cc79a7", "#141826"],
  ["#000000", "#ffffff"],
];

/** Small seeded PRNG (mulberry32): same seed, same blob. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (n) => String(Math.round(n * 10) / 10);

/** Closed, smooth outline through jittered points on a circle. */
function blobPath(seed) {
  const random = rng(seed);
  const n = 8;
  const pts = Array.from({ length: n }, (_, k) => {
    const angle = (k / n) * Math.PI * 2;
    const radius = 25 + random() * 5;
    return [32 + Math.cos(angle) * radius, 33 + Math.sin(angle) * radius];
  });
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  let d = `M${fmt(start[0])} ${fmt(start[1])}`;
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const m = mid(p, pts[(k + 1) % n]);
    d += `Q${fmt(p[0])} ${fmt(p[1])} ${fmt(m[0])} ${fmt(m[1])}`;
  }
  return `${d}Z`;
}

const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const line = (d, c) =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

const EYES = [
  (c) => dot(25, 29, 3.2, c) + dot(39, 29, 3.2, c), // round
  (c) => dot(25, 29, 3.2, c) + line("M36 29h6", c), // wink
  (c) => line("M22 30q3-4 6 0", c) + line("M36 30q3-4 6 0", c), // happy
  (c) => dot(25, 28, 4.2, c) + dot(39, 28, 4.2, c), // wide
  (c) => line("M22 29h6", c) + line("M36 29h6", c), // calm
];
const MOUTHS = [
  (c) => line("M26 40q6 6 12 0", c), // smile
  (c) => `<ellipse cx="32" cy="41" rx="4" ry="5" fill="${c}"/>`, // "oh"
  (c) => `<path d="M25 39q7 9 14 0z" fill="${c}"/>`, // grin
  (c) => line("M27 41h10", c), // flat
  (c) => line("M27 42q2.5-3 5 0t5 0", c), // wobbly
];
// Three face sets; each pairs eyes and mouth differently per color.
const FACES = [
  [0, 0],
  [3, 1],
  [2, 2],
  [1, 0],
  [4, 3],
  [0, 4],
  [2, 1],
  [3, 2],
  [2, 0],
  [0, 1],
  [1, 2],
  [4, 0],
  [3, 4],
  [2, 3],
  [0, 2],
  [1, 4],
  [4, 2],
  [1, 1],
  [0, 3],
  [3, 0],
  [2, 4],
  [4, 1],
  [3, 3],
  [1, 3],
];

mkdirSync(outDir, { recursive: true });
const ids = [];
for (let i = 0; i < 24; i++) {
  const [fill, ink] = PLAYER[i % 8];
  const [eyes, mouth] = FACES[i];
  const id = `blob-${String(i + 1).padStart(2, "0")}`;
  // The black blob gets a faint light rim so it doesn't vanish on dark backgrounds.
  const rim = fill === "#000000" ? ` stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">` +
    `<path d="${blobPath(1000 + i * 7919)}" fill="${fill}"${rim}/>${EYES[eyes](ink)}${MOUTHS[mouth](ink)}</svg>\n`;
  writeFileSync(join(outDir, `${id}.svg`), svg);
  ids.push(id);
}
console.log(
  `Wrote ${String(ids.length)} avatars to apps/web/public/avatars/ (${ids[0]} … ${ids.at(-1)}).`,
);
