// Game scaffolder (SPEC §9.2): `pnpm new:game <id> --kind=<turn|race> [--category=<c>]`.
// Creates packages/games/<id>/ with a working skeleton. All 11 translation
// files start from an English template marked TODO(new-game); `pnpm i18n:check`
// fails until every marker is replaced, so an unfinished game can't ship.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as prettier from "prettier";

import { LOCALES } from "../apps/web/src/i18n/locales.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const kind = option("kind", "race");
const category = option("category", "logic");

const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  fail("Usage: pnpm new:game <id> --kind=<turn|race> [--category=<category>]   (id: kebab-case)");
}
if (!["turn", "race"].includes(kind)) {
  fail(`--kind=${kind}: the realtime and simultaneous kinds arrive in Phases 9 and 11.`);
}
const dir = join(root, "packages/games", id);
if (existsSync(dir)) fail(`packages/games/${id} already exists.`);

const TODO = "TODO(new-game)";
const files = {
  "package.json": JSON.stringify(
    {
      name: `@kefche/game-${id}`,
      version: "0.0.0",
      private: true,
      type: "module",
      sideEffects: false,
      exports: { ".": "./index.ts", "./manifest": "./manifest.ts" },
      scripts: { typecheck: "tsc -p . && tsc -p engine" },
      dependencies: { "@kefche/game-sdk": "workspace:*" },
      devDependencies: { "@kefche/config": "workspace:*", typescript: "6.0.3" },
    },
    null,
    2,
  ),
  "tsconfig.json": `{
  // Renderer and entry: browser code.
  "extends": "@kefche/config/tsconfig.base.json",
  "compilerOptions": { "lib": ["es2024", "dom", "dom.iterable"], "jsx": "react-jsx" },
  "include": ["."],
  "exclude": ["engine"]
}
`,
  "engine/tsconfig.json": `{
  // Rules only: no DOM, no Node, so the engine runs in browsers, workers,
  // tests and Deno (server-side validation).
  "extends": "@kefche/config/tsconfig.base.json",
  "include": ["."]
}
`,
  "manifest.ts": `import { defineManifest } from "@kefche/game-sdk";

export const manifest = defineManifest({
  id: "${id}",
  version: 1,
  category: "${category}",
  kind: "${kind}",
  players: { min: 1, max: ${kind === "race" ? 8 : 2}, default: ${kind === "race" ? 1 : 2} },
  modes: ["solo"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "none" }],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [2, 10],
  leaderboards: [{ id: "best-score", metric: "score", order: "desc" }],
  achievements: [],
  scoreValidation: { kind: "none" },
  tags: [],
});
`,
  "engine/index.ts": `// ${id} rules: pure and deterministic (SPEC §9.1). ${TODO}: implement.
import type { RaceEngine } from "@kefche/game-sdk";

export interface State {
  moves: number;
}
export interface Action {
  type: "move";
}

export const engine: RaceEngine<State, Action> = {
  initialState: () => ({ moves: 0 }),
  apply: (state) => ({ moves: state.moves + 1 }),
  progress: () => 0,
  result: () => null,
};
`,
  "renderer/mount.ts": `// ${id} renderer. ${TODO}: draw the game and handle input.
import type { GameContext, GameInstance } from "@kefche/game-sdk/browser";

import { engine, type State } from "../engine";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  let state: State = engine.initialState(undefined, context.seed);
  const render = () => {
    container.textContent = String(state.moves);
  };
  const onClick = () => {
    state = engine.apply(state, { type: "move" });
    render();
  };
  container.addEventListener("click", onClick);
  render();
  return {
    pause() {
      // Nothing runs on its own yet.
    },
    resume() {
      // Nothing runs on its own yet.
    },
    restart(seed) {
      state = engine.initialState(undefined, seed);
      render();
    },
    destroy() {
      container.removeEventListener("click", onClick);
      container.replaceChildren();
    },
  };
}
`,
  "index.ts": `// Public entry, loaded lazily by the player when Play is pressed.
import type { GameModule } from "@kefche/game-sdk/browser";

import { mount } from "./renderer/mount";

export const game: GameModule = { mount };
`,
  "assets/art.mjs": `// ${id} sticker art for \`pnpm art:generate\`, drawn in a 160 × 120 box with
// the shared kit (scripts/game-art/kit.mjs). ${TODO}: draw the game's emblem;
// art:generate refuses this file until the marker is gone.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed }) {
  return shadowed(\`<rect x="40" y="20" width="80" height="80" rx="14" fill="\${WHITE}" stroke="\${INK}" stroke-width="4"/>\`);
}
`,
  "CREDITS.md": `# ${id}: credits

Every asset and content source with its license (SPEC §19). ${TODO}: list sources, or write "No third-party assets."
`,
};

// Turn-based games (Phase 4): a working two-player skeleton with bots in a
// worker and the shared turn runtime (seats, timers, HUD, undo).
if (kind === "turn") {
  Object.assign(files, {
    "package.json": JSON.stringify(
      {
        ...JSON.parse(files["package.json"]),
        scripts: { typecheck: "tsc -p . && tsc -p engine && tsc -p bots" },
      },
      null,
      2,
    ),
    "tsconfig.json": files["tsconfig.json"].replace(
      '"exclude": ["engine"]',
      '"exclude": ["engine", "bots"]',
    ),
    "bots/tsconfig.json": `{
  // Bot strategies: no DOM, no Node, like the engine. They run in a Web
  // Worker, in tests and, for online rooms, on the host.
  "extends": "@kefche/config/tsconfig.base.json",
  "include": [".", "../engine"]
}
`,
    "manifest.ts": files["manifest.ts"]
      .replace("players: { min: 1,", "players: { min: 2,")
      .replace('modes: ["solo"]', 'modes: ["solo-bots", "hotseat"]')
      .replace(
        "bots: { supported: false, difficulties: [], canFillSeats: false }",
        'bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true }',
      )
      .replace(
        'timers: [{ kind: "none" }]',
        'timers: [{ kind: "none" }, { kind: "per-move", seconds: 30, onExpiry: "random-move" }]',
      )
      .replace('scoreValidation: { kind: "none" }', 'scoreValidation: { kind: "replay" }'),
    "engine/index.ts": `// ${id} rules: pure and deterministic (SPEC §9.1). ${TODO}: replace this
// placeholder game (take turns adding 1, 2 or 3; whoever reaches 21 wins).
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export const GOAL = 21;

export interface State {
  seats: number;
  total: number;
  turn: number;
  moves: number;
  winner: number | null;
}
export interface Action {
  add: number;
}

export const engine: TurnEngine<State, Action> = {
  initialState: (_config, seats) => ({ seats, total: 0, turn: 0, moves: 0, winner: null }),
  legalActions: (state, seat) =>
    state.winner !== null || seat !== state.turn
      ? []
      : [1, 2, 3].filter((add) => state.total + add <= GOAL).map((add) => ({ add })),
  applyAction(state, seat, { add }) {
    if (state.winner !== null || seat !== state.turn || ![1, 2, 3].includes(add)) return state;
    if (state.total + add > GOAL) return state;
    const total = state.total + add;
    return {
      ...state,
      total,
      moves: state.moves + 1,
      turn: (state.turn + 1) % state.seats,
      winner: total === GOAL ? seat : null,
    };
  },
  currentSeats: (state) => (state.winner === null ? [state.turn] : []),
  result: (state): GameResult | null =>
    state.winner === null
      ? null
      : {
          completed: true,
          outcome: Array.from({ length: state.seats }, (_, i) => (i === state.winner ? 1 : 0)),
        },
};
`,
    "bots/index.ts": `// ${id} bots (SPEC §9.5). ${TODO}: write a bot per difficulty; the SDK's
// searchBestAction() does alpha-beta search against the deadline.
import { searchBestAction, type Bot, type GameBots } from "@kefche/game-sdk";

import { engine, type Action, type State } from "../engine";

const random: Bot<State, Action> = {
  choose: (state, seat, { rng }) => rng.pick(engine.legalActions(state, seat)),
};

const search = (maxDepth: number): Bot<State, Action> => ({
  choose: (state, seat, { rng, deadline, now }) =>
    searchBestAction({ engine, evaluate: () => 0 }, state, seat, { maxDepth, deadline, now }, rng)
      .action,
});

export const bots: GameBots<State, Action> = { easy: random, medium: search(2), hard: search(30) };
`,
    "renderer/bots.worker.ts": `// ${id} bots, off the main thread (SPEC §9.5).
import { serveBots } from "@kefche/game-sdk/browser";

import { bots } from "../bots";

serveBots(bots);
`,
    "renderer/mount.ts": `// ${id} renderer. ${TODO}: draw the board (React or DOM) and pass the
// person's moves to the session. The player shows seats, turns and timers.
import { runTurnGame, type GameContext, type GameInstance } from "@kefche/game-sdk/browser";

import { engine } from "../engine";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  let unsubscribe: (() => void) | null = null;
  return runTurnGame(context, {
    engine,
    config: undefined,
    createBotWorker: () =>
      new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" }),
    allowUndo: true,
    render({ session, store }) {
      unsubscribe?.();
      const draw = () => {
        const view = store.get();
        container.replaceChildren();
        const total = document.createElement("p");
        total.textContent = String(view?.state.total ?? 0);
        container.append(total);
        for (const add of [1, 2, 3]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = \`+\${String(add)}\`;
          const seat = view?.humanSeat ?? null;
          button.disabled = seat === null;
          button.addEventListener("click", () => {
            if (seat !== null) session.act(seat, { add });
          });
          container.append(button);
        }
      };
      unsubscribe = store.subscribe(draw);
      draw();
    },
    dispose() {
      unsubscribe?.();
      container.replaceChildren();
    },
  });
}
`,
  });
}

const text = {
  name: `${TODO}: display name`,
  tagline: `${TODO}: one line for catalog cards`,
  description: `${TODO}: meta description, about 150 characters, saying what the game is and that it's free.`,
  about: [`${TODO}: 2–3 paragraphs about the game (250–600 words across the page, SPEC §15).`],
  howToPlay: [`${TODO}: rules, one step per item.`],
  controls: [`${TODO}: touch and keyboard controls.`],
  tips: [`${TODO}: tips for better play.`],
  faq: [{ question: `${TODO}: a common question?`, answer: `${TODO}: its answer.` }],
  ui: { score: "Score" },
};
for (const locale of LOCALES) files[`i18n/${locale}.json`] = JSON.stringify(text, null, 2);

// Written in the repo's Prettier style, so `pnpm format:check` passes from the start.
for (const [file, content] of Object.entries(files)) {
  const path = join(dir, file);
  mkdirSync(join(path, ".."), { recursive: true });
  const options = (await prettier.resolveConfig(path)) ?? {};
  writeFileSync(path, await prettier.format(content, { ...options, filepath: path }));
}
console.log(
  `Created packages/games/${id}. Next: pnpm install, replace every ${TODO} (pnpm i18n:check lists the text ones), then pnpm art:generate.`,
);
