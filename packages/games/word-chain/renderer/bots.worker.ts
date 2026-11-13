// Word Chain bots, off the main thread (SPEC §9.5). They read the word
// lists (ADR-0050), which the worker loads first; a request that comes
// sooner waits for them. Both languages' lists are loaded, since a request
// is the first the worker hears of the game's.
import { serveBots } from "@kefche/game-sdk/browser";
import { loadLexicons } from "@kefche/lexicons/browser";

import { bots } from "../bots";
import { manifest } from "../manifest";

serveBots(
  bots,
  Promise.all([loadLexicons("en", manifest.lexicons), loadLexicons("bg", manifest.lexicons)]),
);
