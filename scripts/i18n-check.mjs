// Translation integrity check (SPEC §5): `pnpm i18n:check`.
// Fails on: missing/extra locales or namespaces, missing/extra keys vs English,
// empty or non-string values, invalid ICU syntax, placeholder mismatches, and
// keys that are unused in code or used in code but not defined.
// Keys are detected in source as full "<namespace>:<key>" string literals.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

import { DEFAULT_LOCALE, LOCALES } from "../apps/web/src/i18n/locales.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const localesDir = join(root, "apps/web/locales");
const sourceDirs = [join(root, "apps/web/src"), join(root, "packages")];
const sourceExt = /\.(astro|ts|tsx|mts)$/;

const errors = [];
const rel = (p) => relative(root, p).replaceAll("\\", "/");

const listDir = (dir, filter) =>
  readdirSync(dir, { withFileTypes: true })
    .filter(filter)
    .map((d) => d.name)
    .sort();
const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Flattens nested JSON into dotted keys; every leaf must be a non-empty
 * string. Arrays (paragraphs, FAQ entries) are allowed in game texts only.
 */
function flatten(obj, file, prefix = "", out = new Map(), allowArrays = false) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      if (v.trim() === "") errors.push(`${file}: "${key}" is empty`);
      out.set(key, v);
    } else if (v && typeof v === "object" && (allowArrays || !Array.isArray(v))) {
      flatten(v, file, key, out, allowArrays);
    } else {
      errors.push(`${file}: "${key}" must be a string or an object of strings`);
    }
  }
  return out;
}

/** Names of all ICU arguments ({name}, plurals, selects, tags) in a message. */
function icuArgs(elements, out = new Set()) {
  for (const el of elements) {
    if ([TYPE.argument, TYPE.number, TYPE.date, TYPE.time].includes(el.type)) out.add(el.value);
    if (el.type === TYPE.select || el.type === TYPE.plural) {
      out.add(el.value);
      for (const opt of Object.values(el.options)) icuArgs(opt.value, out);
    }
    if (el.type === TYPE.tag) {
      out.add(`<${el.value}>`);
      icuArgs(el.children, out);
    }
  }
  return out;
}

// 1. Locale folders match the registry.
const localeDirs = listDir(localesDir, (d) => d.isDirectory());
const expected = [...LOCALES].sort();
if (!sameSet(localeDirs, expected)) {
  errors.push(`locale folders [${localeDirs.join(", ")}] ≠ LOCALES [${expected.join(", ")}]`);
}

// 2. Load every locale; English is the source of truth.
const catalogs = new Map(); // locale → ns → Map(key → { message, args })
for (const locale of LOCALES) {
  const dir = join(localesDir, locale);
  const nsFiles = listDir(dir, (d) => d.isFile() && d.name.endsWith(".json"));
  const byNs = new Map();
  for (const file of nsFiles) {
    const path = join(dir, file);
    let json;
    try {
      json = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      errors.push(`${rel(path)}: invalid JSON (${e.message})`);
      continue;
    }
    const entries = new Map();
    for (const [key, message] of flatten(json, rel(path))) {
      try {
        entries.set(key, { message, args: icuArgs(parse(message, { requiresOtherClause: true })) });
      } catch (e) {
        errors.push(`${rel(path)}: "${key}" has invalid ICU syntax (${e.message})`);
      }
    }
    byNs.set(file.replace(/\.json$/, ""), entries);
  }
  catalogs.set(locale, byNs);
}

const source = catalogs.get(DEFAULT_LOCALE) ?? new Map();
const namespaces = [...source.keys()].sort();

// 3. Every locale has the same namespaces, keys and placeholders as English.
for (const [locale, byNs] of catalogs) {
  if (locale === DEFAULT_LOCALE) continue;
  const nsList = [...byNs.keys()].sort();
  if (!sameSet(nsList, namespaces)) {
    errors.push(
      `${locale}: namespaces [${nsList.join(", ")}] ≠ ${DEFAULT_LOCALE} [${namespaces.join(", ")}]`,
    );
  }
  for (const ns of namespaces) {
    const entries = byNs.get(ns) ?? new Map();
    for (const [key, { args }] of source.get(ns)) {
      const t = entries.get(key);
      if (!t) {
        errors.push(`${locale}/${ns}: missing "${key}"`);
      } else if (!sameSet([...t.args].sort(), [...args].sort())) {
        errors.push(`${locale}/${ns}: "${key}" placeholders {${[...t.args]}} ≠ {${[...args]}}`);
      }
    }
    for (const key of entries.keys()) {
      if (!source.get(ns).has(key))
        errors.push(`${locale}/${ns}: extra key "${key}" (not in ${DEFAULT_LOCALE})`);
    }
  }
}

// 4. Usage: every key is referenced in code, and every referenced key exists.
function* walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.name === "node_modules" || d.name === "dist" || d.name.startsWith(".")) continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else if (sourceExt.test(d.name)) yield p;
  }
}
const nsPattern = namespaces.map((ns) => ns.replace(/[-]/g, "\\-")).join("|");
const keyRef = new RegExp(`["'\`](${nsPattern}):([\\w-]+(?:\\.[\\w-]+)*)["'\`]`, "g");
const used = new Map(); // "ns:key" → first file
for (const dir of sourceDirs) {
  for (const file of walk(dir)) {
    for (const [, ns, key] of readFileSync(file, "utf8").matchAll(keyRef)) {
      const id = `${ns}:${key}`;
      if (!used.has(id)) used.set(id, rel(file));
    }
  }
}
for (const ns of namespaces) {
  for (const key of source.get(ns).keys()) {
    if (!used.has(`${ns}:${key}`))
      errors.push(`unused key "${ns}:${key}" (remove it, or reference it as "${ns}:${key}")`);
  }
}
for (const [id, file] of used) {
  const [ns, key] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  if (!source.get(ns)?.has(key))
    errors.push(`${file}: "${id}" is not defined in ${DEFAULT_LOCALE}/${ns}.json`);
}

// Games: packages/games/<id>/i18n/<locale>.json. Same keys and placeholders
// as English in every locale, and no TODO(new-game) markers left by
// `pnpm new:game`. (Shape and lengths are validated by the registry at build.)
const gamesDir = join(root, "packages/games");
const gameIds = listDir(gamesDir, (d) => d.isDirectory());
for (const id of gameIds) {
  const textDir = join(gamesDir, id, "i18n");
  const byLocale = new Map();
  for (const locale of LOCALES) {
    const path = join(textDir, `${locale}.json`);
    try {
      const raw = readFileSync(path, "utf8");
      if (raw.includes("TODO(new-game)"))
        errors.push(`${rel(path)}: replace the TODO(new-game) placeholders`);
      const flat = flatten(JSON.parse(raw), rel(path), "", new Map(), true);
      for (const [key, message] of flat) {
        try {
          flat.set(key, { message, args: icuArgs(parse(message)) });
        } catch (e) {
          errors.push(`${rel(path)}: "${key}" has invalid ICU syntax (${e.message})`);
        }
      }
      byLocale.set(locale, flat);
    } catch (e) {
      errors.push(
        `${rel(path)}: ${e.code === "ENOENT" ? "missing" : `invalid JSON (${e.message})`}`,
      );
    }
  }
  const en = byLocale.get(DEFAULT_LOCALE);
  if (!en) continue;
  for (const [locale, flat] of byLocale) {
    if (locale === DEFAULT_LOCALE) continue;
    for (const [key, entry] of en) {
      const other = flat.get(key);
      if (!other) errors.push(`games/${id}/${locale}: missing "${key}"`);
      else if (
        entry.args &&
        other.args &&
        !sameSet([...entry.args].sort(), [...other.args].sort())
      ) {
        errors.push(`games/${id}/${locale}: "${key}" placeholders differ from ${DEFAULT_LOCALE}`);
      }
    }
    for (const key of flat.keys()) {
      if (!en.has(key)) errors.push(`games/${id}/${locale}: extra key "${key}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(`i18n check failed (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
const keyCount = namespaces.reduce((n, ns) => n + source.get(ns).size, 0);
console.log(
  `i18n check passed: ${LOCALES.length} locales × ${namespaces.length} namespaces, ${keyCount} keys; ${gameIds.length} games.`,
);
