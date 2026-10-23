// Four in a Row entry for the player: a turn session (seats, bots, timers)
// drives the match, and React renders its views.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import {
  createTurnSession,
  type GameContext,
  type GameInstance,
  type TurnSession,
  type TurnView,
} from "@kefche/game-sdk/browser";

import { engine, type Action, type State } from "../engine";
import { Game, type ViewStore } from "./Game";
import { createSounds } from "./sounds";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  const sounds = createSounds(context);
  sounds.preload();
  let view: TurnView<State, Action> | null = null;
  const listeners = new Set<() => void>();
  const store: ViewStore = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => view,
  };

  let session: TurnSession<Action> | null = null;
  const start = (seed: string) => {
    session?.destroy();
    view = null;
    const current = createTurnSession({
      engine,
      config: undefined,
      context: { ...context, seed },
      createBotWorker: () =>
        new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" }),
      allowUndo: true,
      onChange(next) {
        view = next;
        for (const listener of listeners) listener();
      },
    });
    session = current;
    // A new key (seed) remounts the board for a fresh match.
    root.render(
      createElement(Game, {
        key: seed,
        context,
        seed,
        store,
        sounds,
        act: (seat, action) => current.act(seat, action),
        undo: () => {
          current.undo();
        },
      }),
    );
  };
  start(context.seed);

  return {
    pause() {
      session?.pause();
    },
    resume() {
      session?.resume();
    },
    restart(seed) {
      start(seed);
    },
    destroy() {
      session?.destroy();
      session = null;
      root.unmount();
      sounds.dispose();
    },
  };
}
