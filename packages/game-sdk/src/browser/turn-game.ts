// The common `mount()` of a turn-based game: one turn session per match, a
// store of its latest view for the renderer (React's useSyncExternalStore
// fits it), and restart, pause and teardown wired to the player. The game
// only says how to render.

import { createOnlineTurnSession } from "./online-session";
import {
  createTurnSession,
  type TurnSession,
  type TurnSessionOptions,
  type TurnView,
} from "./turn-session";

import type { GameContext, GameInstance } from "./game-module";

/** The latest view of the match, for `useSyncExternalStore(store.subscribe, store.get)`. */
export interface TurnViewStore<State, Action> {
  subscribe: (listener: () => void) => () => void;
  get: () => TurnView<State, Action> | null;
}

export interface TurnGameOptions<State, Action, Config> extends Omit<
  TurnSessionOptions<State, Action, Config>,
  "context" | "onChange"
> {
  /** Draws a new match; called again with a new seed on every restart. */
  render: (match: {
    seed: string;
    session: TurnSession<Action>;
    store: TurnViewStore<State, Action>;
  }) => void;
  /** Frees what `render` set up (a React root, sounds) when the game closes. */
  dispose: () => void;
}

export function runTurnGame<State, Action, Config>(
  context: GameContext,
  options: TurnGameOptions<State, Action, Config>,
): GameInstance {
  const { render, dispose, ...sessionOptions } = options;
  let view: TurnView<State, Action> | null = null;
  const listeners = new Set<() => void>();
  const store: TurnViewStore<State, Action> = {
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
    // Online, the room's host runs the match and everyone else mirrors it.
    const create = context.online ? createOnlineTurnSession : createTurnSession;
    session = create({
      ...sessionOptions,
      context: { ...context, seed },
      onChange(next) {
        view = next;
        for (const listener of listeners) listener();
      },
    });
    render({ seed, session, store });
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
      listeners.clear();
      dispose();
    },
  };
}
