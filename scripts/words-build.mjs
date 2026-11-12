// Builds the word lists the word games check words against (Phase 13,
// ADR-0050): `pnpm words:build`.
//
// For each language it reads the sources in packages/lexicons/sources,
// folds and filters the words to the language's alphabet (the same alphabet
// as @kefche/game-sdk's words.ts, read from it), and packs each list as a
// minimal acyclic automaton (a DAFSA: words that share an ending share
// nodes, so 861,087 Bulgarian forms fit in a few hundred KB):
//
//   all      every valid word (what a guess or a play is checked against)
//   common   words people know, for answers and bot plays (English: SCOWL
//            levels 10 to 35); blocked words left out
//   blocked  words that stay valid but are never an answer, a prompt or a
//            bot's play (packages/lexicons/blocked)
//
// Each list is written gzipped to apps/web/public/lexicons/<lang>-<name>-<hash>.kwl
// (not named .gz, which servers may send with Content-Encoding: gzip),
// named by the SHA-256 of its uncompressed bytes, and only if it isn't there
// yet: old files stay, so a match played with an older list still replays
// with it. packages/lexicons/index.gen.ts lists the current files.
//
// File format (little-endian):
//   0   "KWL1"
//   4   u8 format version (1)
//   5   u8 alphabet size
//   6   u8[6] language code, ASCII, zero-padded
//   12  u32 number of words
//   16  u32 edges[], from index 1 (index 0 is unused, so a target of 0
//       means "no children"). A node is a run of edges, in alphabet order;
//       the root's run starts at edge 1. Each edge:
//         bits 0-4   letter (index in the alphabet)
//         bit 5      last edge of its node
//         bit 6      the letters so far, with this one, make a word
//         bits 7-31  first edge of the target node (0: none)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const ROOT = new URL("../", import.meta.url);
const path = (p) => new URL(p, ROOT);
const read = (p) => readFileSync(path(p), "utf8");
const OUT_DIR = "apps/web/public/lexicons/";
const INDEX = "packages/lexicons/index.gen.ts";

// ------------------------------------------------------------- alphabets

const wordsTs = read("packages/game-sdk/src/words.ts");
const alphabetBlock = /export const ALPHABETS[^=]*=\s*\{([^}]*)\}/.exec(wordsTs)?.[1];
if (!alphabetBlock) throw new Error("ALPHABETS not found in words.ts");
const ALPHABETS = Object.fromEntries(
  [...alphabetBlock.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
);

/** The same folding as words.ts foldWord. */
const ACCENTS = { en: /\p{M}/gu, bg: /[̀́]/gu };
const fold = (lang, raw) =>
  raw.normalize("NFD").replace(ACCENTS[lang], "").normalize("NFC").toLocaleLowerCase(lang).trim();

function clean(lang, words) {
  const letters = new Set(ALPHABETS[lang]);
  const out = new Set();
  for (const raw of words) {
    const w = fold(lang, raw);
    if (w.length > 0 && Array.from(w).every((c) => letters.has(c))) out.add(w);
  }
  return [...out].sort(compare);
}
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const lines = (p) =>
  read(p)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));

// ------------------------------------------------------- Bulgarian forms

/**
 * Every form of every lower-case headword (proper names are left out), from
 * BgOffice's Hunspell rules. The rules are suffixes only (SFX), with no
 * prefixes and no flags on affixes, which is all this expands. Returns the
 * forms, and each headword's forms (for blocking a headword whole).
 */
function bulgarian() {
  const rules = new Map();
  for (const line of read("packages/lexicons/sources/bg/bg_BG.aff").split("\n")) {
    const f = line.trim().split(/\s+/);
    if (f[0] === "PFX") throw new Error("bg_BG.aff: prefixes aren't supported");
    if (f[0] !== "SFX" || f.length < 5) continue;
    const [, flag, strip, add, cond] = f;
    if (add.includes("/")) throw new Error("bg_BG.aff: flags on affixes aren't supported");
    const list = rules.get(flag) ?? [];
    list.push({
      strip: strip === "0" ? "" : strip,
      add: add === "0" ? "" : add,
      cond: new RegExp(`${cond === "." ? "" : cond}$`, "u"),
    });
    rules.set(flag, list);
  }
  const forms = [];
  const byHeadword = new Map();
  for (const line of read("packages/lexicons/sources/bg/bg_BG.dic").split("\n").slice(1)) {
    if (line.trim() === "") continue;
    const [stem, flags = ""] = line.trim().split("/");
    if (stem !== stem.toLocaleLowerCase("bg")) continue;
    const mine = [stem];
    for (const flag of flags) {
      for (const r of rules.get(flag) ?? []) {
        if (!r.cond.test(stem) || !stem.endsWith(r.strip)) continue;
        mine.push(stem.slice(0, stem.length - r.strip.length) + r.add);
      }
    }
    forms.push(...mine);
    byHeadword.set(stem, [...(byHeadword.get(stem) ?? []), ...mine]);
  }
  return { forms, byHeadword };
}

// ------------------------------------------------------------- the DAFSA

/** A minimal acyclic automaton of sorted words (Daciuk et al., 2000). */
function automaton(lang, words) {
  const index = new Map(Array.from(ALPHABETS[lang]).map((c, i) => [c, i]));
  const node = () => ({ final: false, edges: [] }); // edges: [letter, node] in order
  const root = node();
  const register = new Map();
  const ids = new Map();
  const signature = (n) =>
    `${n.final ? 1 : 0}|${n.edges.map(([c, t]) => `${c}:${ids.get(t)}`).join(",")}`;
  const unchecked = []; // [parent, letter, child]
  const minimize = (down) => {
    while (unchecked.length > down) {
      const [parent, , child] = unchecked.pop();
      const key = signature(child);
      const same = register.get(key);
      if (same) parent.edges[parent.edges.length - 1][1] = same;
      else {
        ids.set(child, ids.size + 1);
        register.set(key, child);
      }
    }
  };
  let previous = [];
  for (const word of words) {
    const letters = Array.from(word, (c) => index.get(c));
    let common = 0;
    while (
      common < letters.length &&
      common < previous.length &&
      letters[common] === previous[common]
    )
      common++;
    minimize(common);
    let at = unchecked.length > 0 ? unchecked[unchecked.length - 1][2] : root;
    for (const c of letters.slice(common)) {
      const next = node();
      at.edges.push([c, next]);
      unchecked.push([at, c, next]);
      at = next;
    }
    at.final = true;
    previous = letters;
  }
  minimize(0);
  return root;
}

/** The automaton as the file's edges (breadth first, so the root comes first). */
function encode(lang, words) {
  const root = automaton(lang, words);
  const start = new Map();
  const order = [];
  let next = 1;
  const queue = [root];
  start.set(root, next);
  next += root.edges.length;
  // The queue grows as it's walked; an array's iterator sees what's pushed.
  for (const n of queue) {
    order.push(n);
    for (const [, t] of n.edges) {
      if (start.has(t) || t.edges.length === 0) continue;
      start.set(t, next);
      next += t.edges.length;
      queue.push(t);
    }
  }
  if (next >= 2 ** 25) throw new Error(`${lang}: too many edges for the format`);
  const header = 16;
  const bytes = new Uint8Array(header + next * 4);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("KWL1"), 0);
  view.setUint8(4, 1);
  view.setUint8(5, Array.from(ALPHABETS[lang]).length);
  bytes.set(new TextEncoder().encode(lang).slice(0, 6), 6);
  view.setUint32(12, words.length, true);
  for (const n of order) {
    let at = start.get(n);
    n.edges.forEach(([c, t], i) => {
      const last = i === n.edges.length - 1 ? 1 : 0;
      const target = t.edges.length === 0 ? 0 : start.get(t);
      view.setUint32(
        header + at * 4,
        (c | (last << 5) | ((t.final ? 1 : 0) << 6) | (target << 7)) >>> 0,
        true,
      );
      at++;
    });
  }
  return bytes;
}

/** Reads a word back, to check the encoding. */
function has(bytes, lang, word) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const index = new Map(Array.from(ALPHABETS[lang]).map((c, i) => [c, i]));
  let at = 1;
  let final = false;
  for (const ch of word) {
    const c = index.get(ch);
    if (at === 0 || c === undefined) return false;
    for (;;) {
      const e = view.getUint32(16 + at * 4, true);
      if ((e & 31) === c) {
        final = ((e >>> 6) & 1) === 1;
        at = e >>> 7;
        break;
      }
      if ((e >>> 5) & 1) return false;
      at++;
    }
  }
  return final;
}

// ------------------------------------------------------------------ lists

function lists() {
  const out = {};
  // English.
  {
    const all = clean("en", lines("packages/lexicons/sources/en/enable2k.txt"));
    const valid = new Set(all);
    const blocked = clean("en", lines("packages/lexicons/blocked/en.txt")).filter((w) =>
      valid.has(w),
    );
    const block = new Set(blocked);
    const common = clean("en", lines("packages/lexicons/sources/en/scowl-35.txt")).filter(
      (w) => valid.has(w) && !block.has(w),
    );
    out.en = { all, common, blocked };
  }
  // Bulgarian.
  {
    const { forms, byHeadword } = bulgarian();
    const all = clean("bg", forms);
    const valid = new Set(all);
    const blockedForms = lines("packages/lexicons/blocked/bg.txt").flatMap(
      (w) => byHeadword.get(w) ?? [w],
    );
    const blocked = clean("bg", blockedForms).filter((w) => valid.has(w));
    out.bg = { all, blocked };
  }
  return out;
}

// ------------------------------------------------------------------- main

mkdirSync(path(OUT_DIR), { recursive: true });
const index = {};
for (const [lang, named] of Object.entries(lists())) {
  index[lang] = {};
  for (const [name, words] of Object.entries(named)) {
    const bytes = encode(lang, words);
    for (const w of words) if (!has(bytes, lang, w)) throw new Error(`${lang}-${name}: lost ${w}`);
    for (const w of ["", "zzzzq", "ъъъъ"])
      if (has(bytes, lang, w)) throw new Error(`${lang}: ${w}?`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const file = `${lang}-${name}-${sha256.slice(0, 16)}.kwl`;
    const target = path(OUT_DIR + file);
    if (!existsSync(target)) writeFileSync(target, gzipSync(bytes, { level: 9 }));
    const gz = readFileSync(target).length;
    index[lang][name] = { lang, name, file, sha256, words: words.length, bytes: bytes.length };
    console.log(
      `${file}: ${String(words.length)} words, ${String(Math.round(bytes.length / 1024))} KB (${String(Math.round(gz / 1024))} KB gzipped)`,
    );
  }
}

const body = `// Generated by \`pnpm words:build\` (scripts/words-build.mjs). Do not edit.
// The current word lists of each language (ADR-0050), served from
// /lexicons/<file> and checked against their SHA-256 when loaded.
import type { LexiconRef } from "@kefche/game-sdk";

export const LEXICONS = ${JSON.stringify(index, null, 2)} as const satisfies Record<string, Record<string, LexiconRef>>;
`;
writeFileSync(path(INDEX), body);

// The Edge Functions' copy (ADR-0050): the current files themselves, gzipped
// and in base64, so a replay needs no fetch and nothing to configure. Only
// replays of word games import it.
const server = {};
for (const named of Object.values(index)) {
  for (const ref of Object.values(named)) {
    server[`${ref.lang}:${ref.name}`] = {
      ...ref,
      gz: readFileSync(path(OUT_DIR + ref.file)).toString("base64"),
    };
  }
}
const serverBody = [
  "// Generated by `pnpm words:build` (scripts/words-build.mjs). Do not edit.",
  "// The word games' current lists for the server's replays (ADR-0050): each",
  "// file gzipped, in base64, checked against its SHA-256 when read.",
  "export interface LexiconFile {",
  "  lang: string;",
  "  name: string;",
  "  file: string;",
  "  sha256: string;",
  "  words: number;",
  "  bytes: number;",
  "  gz: string;",
  "}",
  "",
  `export const LEXICON_FILES: Readonly<Record<string, LexiconFile>> = ${JSON.stringify(server, null, 2)};`,
  "",
].join("\n");
writeFileSync(path("supabase/functions/_shared/lexicons.gen.ts"), serverBody);
