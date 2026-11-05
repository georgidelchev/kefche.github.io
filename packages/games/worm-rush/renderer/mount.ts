// Worm Rush entry for the player: the arena fills the container, with the
// HUD (React) over it. With an online arena in this build the player picks
// it or the solo arena first; without one, the solo arena starts at once.
// Online, a full arena sends the player to another; a refusal or a server
// that can't be reached (down, or past its daily limit) offers the solo
// arena instead.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import type { ArenaErrorCode } from "@kefche/game-sdk";
import {
  arenaSocketUrl,
  connectArena,
  createLocalArena,
  findArena,
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
import { createWormClient, type WormClient, type WormClientOptions } from "./client";
import { Hud } from "./Hud";
import { Joining, ModeScreen, ProblemScreen, type Mode, type Problem } from "./Screens";
import { CSS } from "./styles";

const GAME_ID = "worm-rush";
const BOOST = "M13 2 4 14h7l-1 8 9-12h-7l1-8Z";
/** Reconnecting this long means the online arena is out of reach. */
const STALL_MS = 15_000;
/** Other arenas tried when the one handed out filled up first. */
const FULL_RETRIES = 2;

const PROBLEMS: Partial<Record<ArenaErrorCode, Problem>> = {
  suspended: "suspended",
  version: "outdated",
  unknown_game: "outdated",
  nickname_required: "nickname",
  replaced: "replaced",
};

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
  const { t } = context;
  const root = document.createElement("div");
  Object.assign(root.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    borderRadius: "0.75rem",
    background: "#0b1020",
  });
  const style = document.createElement("style");
  style.textContent = CSS;
  const stage = document.createElement("div");
  Object.assign(stage.style, { position: "absolute", inset: "0" });
  const overlay = document.createElement("div");
  root.append(style, stage, overlay);
  container.append(root);
  const react = createRoot(overlay);

  let client: WormClient | null = null;
  let local: LocalArena<World, Input, Snapshot, Event, undefined> | null = null;
  let unsubscribe: (() => void) | null = null;
  let stall: ReturnType<typeof setTimeout> | null = null;
  let mode: Mode | null = null;
  let seed = context.seed;
  let paused = false;
  // Each start's number: work for an earlier one (a scene still loading) is dropped.
  let generation = 0;

  const stop = () => {
    generation++;
    unsubscribe?.();
    unsubscribe = null;
    if (stall) clearTimeout(stall);
    stall = null;
    client?.destroy();
    client = null;
    local = null;
  };

  const base = (): Omit<WormClientOptions, "connect" | "showLatency"> => ({
    stage,
    actionLabel: t("boost"),
    actionIcon: boostIcon(),
    reducedMotion: context.settings.reducedMotion,
  });

  const show = (made: WormClient) => {
    client = made;
    made.pause(paused);
    react.render(createElement(Hud, { client: made, t, locale: context.locale }));
  };

  const playSolo = async () => {
    stop();
    mode = "solo";
    const mine = generation;
    const made = await createWormClient({
      ...base(),
      showLatency: false,
      connect: (handlers) => {
        local = createLocalArena({
          engine,
          bots,
          host: { ...arenaHost, seed, config: undefined },
          player: { name: t("you"), look: 0 },
          handlers,
        });
        local.pause(paused);
        return local;
      },
    });
    if (mine !== generation) made.destroy();
    else show(made);
  };

  const problem = (which: Problem) => {
    stop();
    react.render(
      createElement(ProblemScreen, {
        t,
        problem: which,
        onRetry: () => void playOnline(0),
        onSolo: () => void playSolo(),
      }),
    );
  };

  const choose = () => {
    stop();
    mode = null;
    if (!context.arena) {
      void playSolo();
      return;
    }
    react.render(
      createElement(ModeScreen, {
        t,
        onPick: (picked) => void (picked === "solo" ? playSolo() : playOnline(0)),
      }),
    );
  };

  const playOnline = async (fullTries: number) => {
    const arena = context.arena;
    if (!arena) return;
    stop();
    mode = "online";
    const mine = generation;
    react.render(createElement(Joining, { t }));
    let name: string;
    try {
      await arena.token(); // a guest names themselves first
      name = await findArena(arena.url, GAME_ID);
    } catch (e) {
      if (mine !== generation) return;
      if (e instanceof Error && e.message === "cancelled") choose();
      else problem("unavailable");
      return;
    }
    if (mine !== generation) return;
    const made = await createWormClient({
      ...base(),
      showLatency: true,
      connect: (handlers) =>
        connectArena({
          url: arenaSocketUrl(arena.url, GAME_ID, name),
          token: () => arena.token(),
          look: 0,
          engine,
          handlers,
        }),
    });
    if (mine !== generation) {
      made.destroy();
      return;
    }
    show(made);
    unsubscribe = made.subscribe(() => {
      const { status, error } = made.state();
      if (status === "closed" && error) {
        // Not from inside the connection's own callback.
        queueMicrotask(() => {
          if (mine !== generation) return;
          if (error === "arena_full" && fullTries < FULL_RETRIES) void playOnline(fullTries + 1);
          else problem(PROBLEMS[error] ?? "unavailable");
        });
      } else if (status === "reconnecting") {
        stall ??= setTimeout(() => {
          if (mine === generation) problem("unavailable");
        }, STALL_MS);
      } else if (stall) {
        clearTimeout(stall);
        stall = null;
      }
    });
  };

  choose();
  context.report({ type: "start" });

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
    restart(next) {
      seed = next;
      if (mode === "online") void playOnline(0);
      else if (mode === "solo") void playSolo();
      else choose();
    },
    destroy() {
      stop();
      react.unmount();
      root.remove();
    },
  };
}
