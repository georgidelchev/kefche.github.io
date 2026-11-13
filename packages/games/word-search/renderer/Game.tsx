// Word Search: a menu of sizes with the best time of each on this device,
// then the grid, the theme and its words. Mark a word by its first and
// last letters: drag across it, or tap one end and then the other (the
// first tap is shown), or move with the arrow keys and press Enter or
// Space at each end. Found words stay marked in the grid and are crossed
// off the list. In a race the room's size and words start at once. The
// grid stays left to right in every language.
import { createElement, useRef, useState, type PointerEvent } from "react";

import { formatDuration, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  useGridFocus,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  configFrom,
  engine,
  line,
  PACKS,
  SIZES,
  THEME_IDS,
  WORDS_FOR,
  type Config,
  type Pack,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => `${config.pack}-${String(config.size)}`;
/** Literal keys for the themes' names. */
const THEME_KEYS: Readonly<Record<string, string>> = {
  animals: "themeAnimals",
  food: "themeFood",
  home: "themeHome",
  nature: "themeNature",
  sport: "themeSport",
  jobs: "themeJobs",
  travel: "themeTravel",
  music: "themeMusic",
};

function Game({
  context,
  seed,
  handle,
  sounds,
}: {
  context: GameContext;
  seed: string;
  handle: PuzzleHandle;
  sounds: Sounds;
}) {
  const { t } = context;
  // Alone, the words are in the page's language (the game is offered only in its packs').
  const pack: Pack = PACKS.find((p) => context.locale.startsWith(p)) ?? "en";
  const puzzle = usePuzzle({ context, seed, handle, engine, raceConfig: configFrom, timeKey });
  const state = puzzle.state;
  const size = state?.size ?? 10;
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const dragRef = useRef<{ from: number; moved: boolean } | null>(null);
  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: 0,
    onActivate: (cell) => {
      mark(cell);
    },
  });

  function select(from: number, to: number) {
    setStart(null);
    setEnd(null);
    const before = state?.found.filter((f) => f !== null).length ?? 0;
    const next = puzzle.dispatch({ from, to });
    const after = next?.found.filter((f) => f !== null).length ?? before;
    if (next && after > before) {
      sounds.play(after === next.words.length ? "win" : "found");
      vibrate(after === next.words.length ? HAPTICS.win : HAPTICS.tap, context.settings.haptics);
    } else if (next) sounds.play("miss");
  }

  /** A tap or Enter on a cell: the first end, then the other. */
  function mark(cell: number) {
    if (start === null) setStart(cell);
    else if (start === cell) setStart(null);
    else select(start, cell);
  }

  const cellAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    return el ? Number(el.dataset.cell) : null;
  };

  function onDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button > 0 || puzzle.screen !== "playing") return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { from: cell, moved: false };
    setEnd(null);
  }
  function onMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null || cell === drag.from) return;
    drag.moved = true;
    setStart(drag.from);
    setEnd(cell);
  }
  function onUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const cell = cellAt(event.clientX, event.clientY) ?? drag.from;
    if (drag.moved && cell !== drag.from) select(drag.from, cell);
    else mark(drag.from);
  }

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("chooseSize")}
        choices={SIZES.map((s) => ({
          config: { pack, size: s },
          label: t("sizeLabel", { size: s }),
          detail: t("wordsCount", { n: WORDS_FOR[s] }),
        }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best")}
        onPick={(config) => {
          setStart(null);
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const foundCount = state.found.filter((f) => f !== null).length;
  const foundCells = new Set(
    state.found.flatMap((f) => (f ? (line(state.size, f.from, f.to) ?? []) : [])),
  );
  const selecting = new Set(
    start !== null ? (end !== null ? (line(state.size, start, end) ?? [start]) : [start]) : [],
  );
  const up = (w: string) => w.toLocaleUpperCase(state.pack);
  const themeKey = THEME_KEYS[THEME_IDS[state.theme] ?? "animals"] ?? "themeAnimals";
  return (
    <div className="gk gws">
      <style>{KIT_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t(themeKey)}</span>
        <span className="gk-stat">
          <span>{t("found")}</span>{" "}
          <strong>{t("of", { n: foundCount, total: state.words.length })}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
      </div>
      <div
        className="gws-grid"
        role="grid"
        aria-label={t("gridLabel")}
        style={{ gridTemplateRows: `repeat(${String(size)}, 1fr)` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          dragRef.current = null;
          setEnd(null);
        }}
      >
        {Array.from({ length: size }, (_, r) => (
          <div
            key={r}
            role="row"
            className="gws-row"
            style={{ gridTemplateColumns: `repeat(${String(size)}, 1fr)` }}
          >
            {Array.from({ length: size }, (__, c) => {
              const cell = r * size + c;
              const focus = grid.cellProps(cell);
              const letter = up(state.letters[cell] ?? "");
              return (
                <div
                  key={cell}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={
                    start === cell
                      ? t("cellStart", { letter })
                      : foundCells.has(cell)
                        ? t("cellFound", { letter })
                        : letter
                  }
                  aria-selected={selecting.has(cell)}
                  className="gws-cell"
                  data-cell={cell}
                  data-found={foundCells.has(cell) ? "" : undefined}
                  data-sel={selecting.has(cell) ? "" : undefined}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="gws-words" aria-label={t("wordsLabel")}>
        {state.words.map((w, i) => (
          <li key={w.word} data-found={state.found[i] ? "" : undefined}>
            {up(w.word)}
            {state.found[i] && <span className="gk-sr"> {t("foundWord")}</span>}
          </li>
        ))}
      </ul>
      {puzzle.screen === "over" && (
        <p role="status" className="gws-done">
          {t("solved", { time: formatDuration(puzzle.elapsedMs) })}{" "}
          {puzzle.newBest ? t("newBest") : ""}
        </p>
      )}
      {puzzle.screen === "playing" && !puzzle.racing && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("changeSize")}
        </button>
      )}
    </div>
  );
}

export function mount(container: HTMLElement, context: GameContext) {
  const sounds = createSounds(context);
  sounds.preload();
  return mountPuzzle(
    container,
    context,
    (seed, handle) => createElement(Game, { context, seed, handle, sounds }),
    () => {
      sounds.dispose();
    },
  );
}

// Found letters in the word kit's "in place" colours; the selection in the
// brand colour. Both with their inks (5:1 or more).
const CSS = `
.gws { max-width: 36rem; margin-inline: auto; }
.gws-grid { display: grid; gap: 2px; width: min(100%, calc(100dvh - 16rem), 32rem); min-width: 15rem; aspect-ratio: 1; padding: 4px; border-radius: 0.75rem; background: var(--border); direction: ltr; touch-action: none; user-select: none; -webkit-user-select: none; }
.gws-row { display: grid; gap: 2px; }
.gws-cell { display: grid; place-items: center; border-radius: 0.3rem; background: var(--surface); color: var(--text); font-weight: 700; font-size: clamp(0.8rem, 3.6vw, 1.25rem); cursor: pointer; }
.gws-cell[data-found] { background: var(--tile-good); color: var(--tile-good-ink); }
.gws-cell[data-sel] { background: var(--brand); color: var(--on-brand); }
.gws-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: -2px; }
.gws-words { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem 0.6rem; margin: 0; padding: 0; list-style: none; font-weight: 700; letter-spacing: 0.04em; }
.gws-words li { padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--surface-2); }
.gws-words li[data-found] { color: var(--text-muted); text-decoration: line-through; }
.gws-done { margin: 0; text-align: center; font-weight: 700; }
`;
