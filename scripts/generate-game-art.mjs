// Game art generator: `pnpm art:generate` (style "chunky stickers", the
// owner's pick in Phase 3). For every packages/games/<id>/assets/art.mjs it
// writes, next to it:
// - thumbnail.svg: the emblem on the game's category colour (4:3, catalog cards);
// - hero.svg: a wide banner (8:3) with the emblem on the right (game page).
// Deterministic: regenerating changes nothing unless the drawings change.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as kit from "./game-art/kit.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const gamesDir = join(root, "packages/games");
const tokens = readFileSync(join(root, "packages/ui/src/tokens.css"), "utf8");

/** The category colour from tokens.css (the same in both themes). */
function categoryColor(category) {
  const match = new RegExp(`--cat-${category}:\\s*(#[0-9a-f]{6})`, "i").exec(tokens);
  if (!match) throw new Error(`No --cat-${category} token in tokens.css`);
  return match[1];
}

/** Small seeded PRNG (mulberry32), seeded from the game id. */
function rng(id) {
  let a = [...id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (n) => String(Math.round(n * 10) / 10);

/** Confetti for the empty side of the banner: dots, sparkles and a squiggle. */
function confetti(id) {
  const random = rng(id);
  let out = "";
  // One item per cell of a 4 × 2 grid over x 10–200, y 10–140, jittered.
  for (let i = 0; i < 8; i++) {
    const x = 18 + (i % 4) * 46 + random() * 26;
    const y = 22 + Math.floor(i / 4) * 66 + random() * 40;
    const kind = Math.floor(random() * 3);
    if (kind === 0)
      out += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(4 + random() * 5)}" fill="#ffffff" fill-opacity="0.55"/>`;
    else if (kind === 1)
      out += kit.sparkle(Math.round(x), Math.round(y), 5 + Math.round(random() * 3));
    else {
      const w = 18 + random() * 10;
      out += `<path d="M${fmt(x - w / 2)} ${fmt(y)}q${fmt(w / 4)} -7 ${fmt(w / 2)} 0t${fmt(w / 2)} 0" fill="none" stroke="${kit.INK}" stroke-width="2.5" stroke-linecap="round" stroke-opacity="0.7"/>`;
    }
  }
  return out;
}

const written = [];
for (const id of readdirSync(gamesDir).sort()) {
  const artFile = join(gamesDir, id, "assets/art.mjs");
  if (!existsSync(artFile)) continue;
  const source = readFileSync(artFile, "utf8");
  if (source.includes("TODO(new-game)")) {
    throw new Error(
      `packages/games/${id}/assets/art.mjs still has TODO(new-game): draw the emblem first.`,
    );
  }
  const manifest = readFileSync(join(gamesDir, id, "manifest.ts"), "utf8");
  const category = /category:\s*"([a-z]+)"/.exec(manifest)?.[1];
  if (!category) throw new Error(`packages/games/${id}/manifest.ts: no category found`);
  const bg = categoryColor(category);
  const { emblem } = await import(pathToFileURL(artFile).href);
  const body = emblem(kit);

  const thumbnail =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="640" height="480">` +
    `<rect width="160" height="120" fill="${bg}"/>${body}</svg>\n`;
  const hero =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" width="1200" height="450">` +
    `<rect width="400" height="150" fill="${bg}"/>${confetti(id)}` +
    `<g transform="translate(206 3) scale(1.2)">${body}</g></svg>\n`;
  writeFileSync(join(gamesDir, id, "assets/thumbnail.svg"), thumbnail);
  writeFileSync(join(gamesDir, id, "assets/hero.svg"), hero);
  written.push(id);
}
console.log(
  `Wrote thumbnail.svg and hero.svg for ${String(written.length)} games: ${written.join(", ")}.`,
);
