// Loads a game's word lists in the browser and provides them to its
// engine (ADR-0050): the current files of a language, fetched once a page
// (or worker) and checked against their hashes.
import { provideLexicon, type LexiconName, type LexiconRef, type WordLang } from "@kefche/game-sdk";
import { fetchLexicon } from "@kefche/game-sdk/browser";

import { LEXICONS } from "./index.gen";

/** The current file of a list, if the language has one. */
export function lexiconRef(lang: WordLang, name: LexiconName): LexiconRef | undefined {
  return (LEXICONS[lang] as Readonly<Record<string, LexiconRef | undefined>>)[name];
}

/**
 * Loads the named lists of a language and provides them to engines. A
 * list the language doesn't have (Bulgarian's "common", for now) is
 * skipped: engines check `hasLexicon` before reading an optional one.
 */
export async function loadLexicons(lang: WordLang, names: readonly LexiconName[]): Promise<void> {
  await Promise.all(
    names.map(async (name) => {
      const ref = lexiconRef(lang, name);
      if (ref) provideLexicon(name, await fetchLexicon(ref));
    }),
  );
}
