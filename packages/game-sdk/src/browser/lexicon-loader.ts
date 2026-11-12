// Loads a word list in a page or a worker (ADR-0050): fetched from
// /lexicons/ (immutable, cached by the browser), gunzipped with
// DecompressionStream, checked against its SHA-256 and read once per page.
import { loadLexicon, type Lexicon, type LexiconRef, type LexiconSource } from "../lexicon";

const loaded = new Map<string, Promise<Lexicon>>();

const asBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer instanceof ArrayBuffer &&
  bytes.byteOffset === 0 &&
  bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : bytes.slice().buffer;

/** The browser's way to fetch, gunzip and hash a list file. */
export function browserLexiconSource(base = "/lexicons/"): LexiconSource {
  return {
    async fetch(file) {
      const res = await fetch(base + file);
      if (!res.ok) throw new Error(`lexicon: ${file}: HTTP ${String(res.status)}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async gunzip(bytes) {
      const stream = new Blob([asBuffer(bytes)])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    },
    async sha256(bytes) {
      const digest = await crypto.subtle.digest("SHA-256", asBuffer(bytes));
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    },
  };
}

/** A word list, loaded once per page or worker however many games ask. */
export function fetchLexicon(ref: LexiconRef, source = browserLexiconSource()): Promise<Lexicon> {
  const known = loaded.get(ref.sha256);
  if (known) return known;
  const pending = loadLexicon(ref, source);
  loaded.set(ref.sha256, pending);
  // A failed load (offline) can be tried again.
  pending.catch(() => {
    loaded.delete(ref.sha256);
  });
  return pending;
}
