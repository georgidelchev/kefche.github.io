// Word lists for tables of word games (Phase 13, ADR-0050): a word game's
// engine reads lists (its manifest's `lexicons`), so a table provides them
// before it runs one. They're the Edge Functions' generated copy (written by
// `pnpm words:build`), so the table, the server's replay and the browser
// judge words with the same files. Read once an instance, checked against
// their hashes.
import { Lexicon, provideLexicon, type GameManifest } from "@kefche/game-sdk";

import { LEXICON_FILES } from "../../../supabase/functions/_shared/lexicons.gen";

const ready = new Set<string>();

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Provides the lists a game's engine reads, in every language there's a file for. */
export async function readyLexicons(manifest: GameManifest): Promise<void> {
  for (const name of manifest.lexicons ?? []) {
    if (ready.has(name)) continue;
    for (const file of Object.values(LEXICON_FILES)) {
      if (file.name !== name) continue;
      const bytes = await gunzip(Uint8Array.from(atob(file.gz), (c) => c.charCodeAt(0)));
      if ((await sha256(bytes)) !== file.sha256) throw new Error(`lexicon ${file.file}: bad hash`);
      provideLexicon(name, Lexicon.decode(bytes));
    }
    ready.add(name);
  }
}
