// The clocks the turn session reports to the HUD, watched for the renderer:
// with a clock on, a sheet or ballot is sent by itself just before time
// runs out, so what's been typed counts (a clock running out would send an
// empty sheet). The session reports on every tick, on one device and online.
import type { GameContext } from "@kefche/game-sdk/browser";

export interface ClockWatch {
  /** The context to run the game with: its reports pass through here. */
  context: GameContext;
  /** Milliseconds left for a seat, or null without a clock. */
  left(seat: number): number | null;
  subscribe(listener: () => void): () => void;
}

export function watchClocks(context: GameContext): ClockWatch {
  let clocks: readonly (number | null)[] = [];
  const listeners = new Set<() => void>();
  return {
    context: {
      ...context,
      report(event) {
        if (event.type === "turn") {
          clocks = event.clocks;
          for (const listener of listeners) listener();
        }
        context.report(event);
      },
    },
    left: (seat) => clocks[seat] ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
