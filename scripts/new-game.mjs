// Game scaffolder (SPEC §9.2): `pnpm new:game <id> --kind=<turn|race> [--category=<c>]`.
// Creates packages/games/<id>/ with a working skeleton. All 11 translation
// files start from an English template marked TODO(new-game); `pnpm i18n:check`
// fails until every marker is replaced, so an unfinished game can't ship.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
  "CREDITS.md": `# ${id}: credits

Every asset and content source with its license (SPEC §19). ${TODO}: list sources, or write "No third-party assets."
`,
};

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

for (const [file, content] of Object.entries(files)) {
  const path = join(dir, file);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`);
}
console.log(
  `Created packages/games/${id}. Next: pnpm install, then replace every ${TODO} (pnpm i18n:check lists them).`,
);
