// Verifies WCAG 2.2 contrast for the design tokens in packages/ui/src/tokens.css.
// Usage: node scripts/check-contrast.mjs [--all]   (--all prints passing pairs too)
import { readFileSync } from "node:fs";

const TEXT = 4.5; // 1.4.3 normal text
const UI = 3; // 1.4.11 non-text (borders that identify controls, focus rings, indicators)

const css = readFileSync(new URL("../packages/ui/src/tokens.css", import.meta.url), "utf8");

/** Extracts `--name: #hex` declarations from the first block matching `selector`. */
function block(selectorPattern) {
  const match = new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`tokens.css: block not found: ${selectorPattern}`);
  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
}

// Light = the first bare `:root {` block (at the start of a line).
const light = block(String.raw`(?:^|\n):root`);
const darkMedia = block(String.raw`:root:not\(\[data-theme="light"\]\)`);
const darkAttr = block(String.raw`:root\[data-theme="dark"\]`);

const failures = [];

if (JSON.stringify(darkMedia) !== JSON.stringify(darkAttr)) {
  failures.push(
    'dark tokens differ between the prefers-color-scheme block and [data-theme="dark"]',
  );
}

const themes = { light, dark: { ...light, ...darkAttr } };

/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const surfaces = ["bg", "surface", "surface-2"];
const textOn = (fg, bgs = surfaces) => bgs.map((bg) => [fg, bg, TEXT]);
const uiOn = (fg, bgs = surfaces) => bgs.map((bg) => [fg, bg, UI]);

/** [foreground, background, minimum] — checked in every theme. */
const pairs = [
  ...textOn("text"),
  ...textOn("text-muted"),
  ...textOn("brand-strong", ["bg", "surface"]),
  ...textOn("link", ["bg", "surface"]),
  ...["danger", "warning", "success", "info"].flatMap((c) => textOn(c, ["bg", "surface"])),
  ["on-brand", "brand", TEXT],
  ["on-brand-2", "brand-2", TEXT],
  ["on-accent", "accent", TEXT],
  ["on-danger", "danger", TEXT],
  ...uiOn("border-strong"),
  ...uiOn("focus"),
  ...uiOn("accent-strong", ["bg", "surface"]),
];

// Player and category colors are theme-independent fills with a paired ink
// (shape icon, label or 1px outline drawn on top), SPEC §6.2.
const fillPairs = (prefix) =>
  Object.keys(light)
    .filter((k) => k.startsWith(prefix) && !k.endsWith("-ink"))
    .map((k) => [`${k}-ink`, k, TEXT]);
pairs.push(...fillPairs("player-"), ...fillPairs("cat-"));

const showAll = process.argv.includes("--all");
for (const [theme, tokens] of Object.entries(themes)) {
  for (const [fg, bg, min] of pairs) {
    if (!tokens[fg] || !tokens[bg]) {
      failures.push(`${theme}: missing token --${tokens[fg] ? bg : fg}`);
      continue;
    }
    const r = ratio(tokens[fg], tokens[bg]);
    const ok = r >= min;
    if (!ok) failures.push(`${theme}: --${fg} on --${bg} = ${r.toFixed(2)}:1 (needs ${min}:1)`);
    if (showAll || !ok) {
      console.log(
        `${ok ? "✓" : "✗"} ${theme.padEnd(5)} --${fg} on --${bg}: ${r.toFixed(2)}:1 (min ${min})`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`\nContrast check failed (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Contrast check passed: ${pairs.length} pairs × ${Object.keys(themes).length} themes.`);
