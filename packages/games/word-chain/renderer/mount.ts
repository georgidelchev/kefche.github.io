// Word Chain entry for the player: the word lists load first (every word is
// checked against them, ADR-0050), then a turn session drives the match
// (online, the host's, since nothing is secret) and React renders it.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { runTurnGame, type GameContext, type GameInstance } from "@kefche/game-sdk/browser";
import { loadLexicons } from "@kefche/lexicons/browser";

import { configFrom, engine } from "../engine";
import { manifest } from "../manifest";
import { Game } from "./Game";
import { createSounds } from "./sounds";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  const sounds = createSounds(context);
  sounds.preload();
  const config = configFrom(context.match?.config);
  return runTurnGame(context, {
    engine,
    config,
    ready: loadLexicons(config.pack, manifest.lexicons),
    createBotWorker: () =>
      new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" }),
    render({ seed, session, store }) {
      root.render(createElement(Game, { key: seed, context, store, session, sounds }));
    },
    dispose() {
      root.unmount();
      sounds.dispose();
    },
  });
}
