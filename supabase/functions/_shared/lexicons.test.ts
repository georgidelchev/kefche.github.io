// The word lists the server replays word games with (ADR-0050): the
// generated copy decodes, matches its hashes, and answers like the browser's.
// Run: deno test _shared/lexicons.test.ts
import { GAMES, lexiconOf, readyLexicons, type ServerGame } from "./engines.ts";
import { equal } from "./test-utils.ts";

Deno.test("readyLexicons provides every list a game names, in both languages", async () => {
  const any = [...GAMES.values()][0];
  if (!any) throw new Error("no games");
  const game: ServerGame = { ...any, lexicons: ["all", "common", "blocked"] };
  await readyLexicons(game);
  equal(lexiconOf("en", "all").has("crane"), true, "en: crane");
  equal(lexiconOf("en", "all").has("crnae"), false, "en: crnae");
  equal(lexiconOf("en", "common").has("zyzzyva"), false, "en common: no obscure words");
  equal(lexiconOf("en", "blocked").has("fuck"), true, "en blocked");
  equal(lexiconOf("bg", "all").has("котките"), true, "bg: котките");
  equal(lexiconOf("bg", "all").has("котк"), false, "bg: котк");
  equal(lexiconOf("en", "all").size, 173528, "en size");
  equal(lexiconOf("bg", "all").size, 861087, "bg size");
});
