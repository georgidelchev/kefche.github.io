// Worm Rush entry for the player: the arena fills the container, with the
// HUD (React) over it. For now every game is the solo arena against bots, in
// this page; the online arena and choosing between them come in step 9.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import {
  createLocalArena,
  type GameContext,
  type GameInstance,
  type LocalArena,
} from "@kefche/game-sdk/browser";

import {
  arenaHost,
  bots,
  engine,
  type Event,
  type Input,
  type Snapshot,
  type World,
} from "../engine";
import { createWormClient, type WormClient } from "./client";
import { Hud } from "./Hud";

const BOOST = "M13 2 4 14h7l-1 8 9-12h-7l1-8Z";

function boostIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "30");
  svg.setAttribute("height", "30");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", BOOST);
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = document.createElement("div");
  Object.assign(root.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    borderRadius: "0.75rem",
    background: "#0b1020",
  });
  const stage = document.createElement("div");
  Object.assign(stage.style, { position: "absolute", inset: "0" });
  const hud = document.createElement("div");
  root.append(stage, hud);
  container.append(root);
  const react = createRoot(hud);

  let client: WormClient | null = null;
  let local: LocalArena<World, Input, Snapshot, Event, undefined> | null = null;
  let paused = false;
  let generation = 0;

  const start = (seed: string) => {
    const mine = ++generation;
    client?.destroy();
    client = null;
    react.render(null);
    void createWormClient({
      stage,
      connect: (handlers) => {
        local = createLocalArena({
          engine,
          bots,
          host: { ...arenaHost, seed, config: undefined },
          player: { name: context.t("you"), look: 0 },
          handlers,
        });
        local.pause(paused);
        return local;
      },
      showLatency: false,
      actionLabel: context.t("boost"),
      actionIcon: boostIcon(),
      reducedMotion: context.settings.reducedMotion,
    }).then((made) => {
      // Restarted or closed while the scene was loading.
      if (mine !== generation) {
        made.destroy();
        return;
      }
      client = made;
      made.pause(paused);
      react.render(createElement(Hud, { client: made, t: context.t, locale: context.locale }));
    });
    context.report({ type: "start" });
  };
  start(context.seed);

  const setPaused = (next: boolean) => {
    paused = next;
    local?.pause(next);
    client?.pause(next);
  };

  return {
    pause() {
      setPaused(true);
    },
    resume() {
      setPaused(false);
    },
    restart(seed) {
      start(seed);
    },
    destroy() {
      generation++;
      client?.destroy();
      client = null;
      react.unmount();
      root.remove();
    },
  };
}
