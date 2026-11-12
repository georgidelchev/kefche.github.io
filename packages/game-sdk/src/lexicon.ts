// Word lists for the word games (Phase 13, ADR-0050): a list is a minimal
// acyclic automaton (a DAFSA) built by `pnpm words:build`
// (scripts/words-build.mjs, which documents the file format). Isomorphic:
// the browser, bots, the table and the server's replay all read the same
// file, named by its SHA-256, so a word is judged the same everywhere and a
// match always replays with the list it was played with.
//
// Words are looked up folded (words.ts foldWord); a letter outside the
// language's alphabet is never in a list.
import { ALPHABETS, charsOf, type WordLang } from "./words";

/** A list file as packages/lexicons/index.gen.ts names it. */
export interface LexiconRef {
  readonly lang: string;
  /** "all" (every valid word), "common" (answers, bot plays) or "blocked". */
  readonly name: string;
  /** The file under /lexicons/. */
  readonly file: string;
  /** SHA-256 of the uncompressed file, hex. */
  readonly sha256: string;
  readonly words: number;
  readonly bytes: number;
}

const MAGIC = "KWL1";
const HEADER = 16;
const LETTER = 31;
const LAST = 1 << 5;
const FINAL = 1 << 6;

/** A node of the automaton: the start of its run of edges (0: no letters follow). */
export type LexiconNode = number;

export class Lexicon {
  readonly lang: WordLang;
  readonly size: number;
  /** The node every word starts from. */
  readonly root: LexiconNode = 1;
  private readonly edges: Uint32Array;
  private readonly letters: ReadonlyMap<string, number>;
  private readonly alphabet: readonly string[];

  private constructor(lang: WordLang, size: number, edges: Uint32Array) {
    this.lang = lang;
    this.size = size;
    this.edges = edges;
    this.alphabet = charsOf(ALPHABETS[lang]);
    this.letters = new Map(this.alphabet.map((c, i) => [c, i]));
  }

  /** Reads an uncompressed list file; throws if it isn't one for a known language. */
  static decode(bytes: Uint8Array): Lexicon {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = String.fromCharCode(...bytes.subarray(0, 4));
    if (bytes.byteLength < HEADER || magic !== MAGIC || view.getUint8(4) !== 1)
      throw new Error("lexicon: not a word list");
    const lang = String.fromCharCode(...bytes.subarray(6, 12).filter((b) => b !== 0));
    if (!(lang === "en" || lang === "bg")) throw new Error(`lexicon: unknown language ${lang}`);
    if (view.getUint8(5) !== charsOf(ALPHABETS[lang]).length)
      throw new Error("lexicon: alphabet differs");
    const count = (bytes.byteLength - HEADER) / 4;
    if (!Number.isInteger(count)) throw new Error("lexicon: truncated");
    const edges = new Uint32Array(count);
    for (let i = 0; i < count; i++) edges[i] = view.getUint32(HEADER + i * 4, true);
    return new Lexicon(lang, view.getUint32(12, true), edges);
  }

  /**
   * The node after one more letter, and whether the letters so far make a
   * word; null when no word continues that way.
   */
  step(node: LexiconNode, letter: string): { node: LexiconNode; word: boolean } | null {
    const c = this.letters.get(letter);
    if (c === undefined || node === 0) return null;
    for (let at = node; at < this.edges.length; at++) {
      const e = this.edges[at] ?? 0;
      if ((e & LETTER) === c) return { node: e >>> 7, word: (e & FINAL) !== 0 };
      if ((e & LAST) !== 0) return null;
    }
    return null;
  }

  /** The node a prefix leads to, or null when no word starts with it. */
  walk(prefix: string, from: LexiconNode = this.root): { node: LexiconNode; word: boolean } | null {
    let at = { node: from, word: false };
    for (const ch of prefix) {
      const next = this.step(at.node, ch);
      if (!next) return null;
      at = next;
    }
    return at;
  }

  /** Whether a (folded) word is in the list. */
  has(word: string): boolean {
    return word.length > 0 && (this.walk(word)?.word ?? false);
  }

  /** Whether some word in the list starts with `prefix` (or is it). */
  hasPrefix(prefix: string): boolean {
    return this.walk(prefix) !== null;
  }

  /** The letters that can follow a node, each with its node and whether it ends a word. */
  next(node: LexiconNode): { letter: string; node: LexiconNode; word: boolean }[] {
    const out: { letter: string; node: LexiconNode; word: boolean }[] = [];
    if (node === 0) return out;
    for (let at = node; at < this.edges.length; at++) {
      const e = this.edges[at] ?? 0;
      out.push({
        letter: this.alphabet[e & LETTER] ?? "",
        node: e >>> 7,
        word: (e & FINAL) !== 0,
      });
      if ((e & LAST) !== 0) break;
    }
    return out;
  }

  /**
   * Every word from a node on, in alphabetical order (with `prefix` in
   * front), up to `limit`: for small walks, like the words of one length.
   */
  words({
    prefix = "",
    length,
    limit = Infinity,
  }: { prefix?: string; length?: number; limit?: number } = {}): string[] {
    const start = prefix === "" ? { node: this.root, word: false } : this.walk(prefix);
    const out: string[] = [];
    if (!start) return out;
    if (start.word && (length === undefined || charsOf(prefix).length === length)) out.push(prefix);
    const visit = (node: LexiconNode, sofar: string, depth: number) => {
      for (const edge of this.next(node)) {
        if (out.length >= limit) return;
        const word = sofar + edge.letter;
        if (length !== undefined && depth + 1 > length) return;
        if (edge.word && (length === undefined || depth + 1 === length)) out.push(word);
        visit(edge.node, word, depth + 1);
      }
    };
    visit(start.node, prefix, charsOf(prefix).length);
    return out;
  }
}

/** What loading a list needs from where it runs (browser, worker, Deno, Workers). */
export interface LexiconSource {
  /** The file's bytes as received (gzipped, unless something on the way already gunzipped them). */
  fetch: (file: string) => Promise<Uint8Array>;
  gunzip: (bytes: Uint8Array) => Promise<Uint8Array>;
  /** SHA-256, lower-case hex. */
  sha256: (bytes: Uint8Array) => Promise<string>;
}

/** Whether bytes start with gzip's signature (a list itself starts with "KWL1"). */
const gzipped = (bytes: Uint8Array): boolean => bytes[0] === 0x1f && bytes[1] === 0x8b;

/** Fetches a list, checks it's exactly the file named, and reads it. */
export async function loadLexicon(ref: LexiconRef, source: LexiconSource): Promise<Lexicon> {
  const received = await source.fetch(ref.file);
  const bytes = gzipped(received) ? await source.gunzip(received) : received;
  const hash = await source.sha256(bytes);
  if (hash !== ref.sha256) throw new Error(`lexicon: ${ref.file} doesn't match its hash`);
  const lexicon = Lexicon.decode(bytes);
  if (lexicon.lang !== ref.lang || lexicon.size !== ref.words)
    throw new Error(`lexicon: ${ref.file} isn't the list named`);
  return lexicon;
}
