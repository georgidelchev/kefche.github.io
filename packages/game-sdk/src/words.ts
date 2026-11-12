// Letters and words for the word games (Phase 13): each content language's
// alphabet, how a typed word is folded before it's compared, and the
// on-screen keyboards. Isomorphic, so engines, bots and the server's replay
// judge words exactly as the browser does.
//
// Folding: Unicode NFC, lower case in the word's language, and accents
// dropped (café → cafe; a Bulgarian stress mark, ѝ → и), but a letter of the
// alphabet that Unicode spells with a mark stays itself: Bulgarian й is not и.

/** The languages word games have content in (ADR-0049: offered only there). */
export const WORD_LANGS = ["en", "bg"] as const;
export type WordLang = (typeof WORD_LANGS)[number];

export const isWordLang = (value: unknown): value is WordLang =>
  typeof value === "string" && (WORD_LANGS as readonly string[]).includes(value);

/** Each language's letters, in alphabetical order. */
export const ALPHABETS: Readonly<Record<WordLang, string>> = {
  en: "abcdefghijklmnopqrstuvwxyz",
  bg: "абвгдежзийклмнопрстуфхцчшщъьюя",
};

const LETTER_SETS: Readonly<Record<WordLang, ReadonlySet<string>>> = {
  en: new Set(ALPHABETS.en),
  bg: new Set(ALPHABETS.bg),
};

/** Marks that are only accents in a language, never part of a letter. */
const ACCENTS: Readonly<Record<WordLang, RegExp>> = {
  // Latin letters lose every mark: naïve, café, über.
  en: /\p{M}/gu,
  // Stress marks only (grave, acute); the breve makes й a letter of its own.
  bg: /[̀́]/gu,
};

/** A typed word as the games compare it (lower case, accents dropped, trimmed). */
export function foldWord(lang: WordLang, raw: string): string {
  return raw
    .normalize("NFD")
    .replace(ACCENTS[lang], "")
    .normalize("NFC")
    .toLocaleLowerCase(lang)
    .trim();
}

/**
 * A word's letters. Every letter of every alphabet here is one Unicode code
 * point once folded (NFC), so splitting by code point is splitting by letter.
 */
export const charsOf = (word: string): string[] => Array.from(word);

/** Whether a single folded character is a letter of the language. */
export const isLetter = (lang: WordLang, ch: string): boolean => LETTER_SETS[lang].has(ch);

/** The folded word, if it's made only of the language's letters; otherwise null. */
export function wordOf(lang: WordLang, raw: string): string | null {
  const word = foldWord(lang, raw);
  if (word.length === 0) return null;
  for (const ch of word) if (!isLetter(lang, ch)) return null;
  return word;
}

/** Only the language's letters of a typed string, folded (for an input as it's typed). */
export function lettersOf(lang: WordLang, raw: string): string {
  let out = "";
  for (const ch of foldWord(lang, raw)) if (isLetter(lang, ch)) out += ch;
  return out;
}

/** How many of each letter a word has. */
export function letterCounts(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

/** Whether `word` can be spelled from `letters`, each used at most once. */
export function canSpell(word: string, letters: string): boolean {
  const left = letterCounts(letters);
  for (const ch of word) {
    const n = left.get(ch) ?? 0;
    if (n === 0) return false;
    left.set(ch, n - 1);
  }
  return true;
}

// -------------------------------------------------------------- keyboards

/** On-screen keyboard layouts: rows of letters, top to bottom. */
export const KEYBOARD_LAYOUTS = ["qwerty", "bg-phonetic", "bg-bds"] as const;
export type KeyboardLayout = (typeof KEYBOARD_LAYOUTS)[number];

export const KEYBOARD_ROWS: Readonly<Record<KeyboardLayout, readonly string[]>> = {
  qwerty: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
  // The traditional phonetic layout, with ч and ю (on ` and \ on a real
  // keyboard) at the ends of the lower rows.
  "bg-phonetic": ["явертъуиопшщ", "асдфгхйклю", "зьцжбнмч"],
  // БДС 5237, without the letters Bulgarian no longer uses (ы, э).
  "bg-bds": ["уеишщксдзцб", "ьяаожгтнвмч", "юйъфхпрл"],
};

/** The layouts each language offers, its usual one first. */
export const LAYOUTS_FOR: Readonly<Record<WordLang, readonly KeyboardLayout[]>> = {
  en: ["qwerty"],
  bg: ["bg-phonetic", "bg-bds"],
};

/**
 * Keys of a physical keyboard (KeyboardEvent.code) for a language whose
 * letters it can't type: someone playing in Bulgarian with only a Latin
 * layout installed types phonetically, as Bulgarians often do (a → а).
 */
const PHYSICAL: Readonly<Record<WordLang, Readonly<Record<string, string>>>> = {
  en: {},
  bg: physicalMap([
    ["KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight", "явертъуиопшщ"],
    ["KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Backquote Backslash", "асдфгхйклчю"],
    ["KeyZ KeyX KeyC KeyV KeyB KeyN KeyM", "зьцжбнм"],
  ]),
};

function physicalMap(rows: readonly (readonly [string, string])[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [codes, letters] of rows) {
    const keys = codes.split(" ");
    const chars = charsOf(letters);
    keys.forEach((code, i) => {
      const ch = chars[i];
      if (ch !== undefined) map[code] = ch;
    });
  }
  return map;
}

/**
 * The letter a key press types in a language: the key's own character when
 * it's one of the language's letters, otherwise its position on a Latin
 * keyboard (Bulgarian only), otherwise null.
 */
export function letterFromKey(lang: WordLang, key: string, code: string): string | null {
  const ch = foldWord(lang, key);
  if (charsOf(ch).length === 1 && isLetter(lang, ch)) return ch;
  return PHYSICAL[lang][code] ?? null;
}
