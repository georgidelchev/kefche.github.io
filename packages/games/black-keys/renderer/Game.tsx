// Black Keys: a menu with the best on this device, then a board of four
// columns and four rows that scroll down. Tap the black tile in each row,
// in order; the first tap (on the bottom row's black tile, marked "Start")
// starts the scroll. A white tile, or a black one let go, ends the game
// and shows which.
//
// The scroll is the engine's function of time: each frame sets it as a CSS
// variable (--y) that places the rows, and React re-renders only when a
// new row comes on. Taps are timed by their own events (any finger), and
// the keyboard plays the bottom row with D F J K (or 1 2 3 4). The tiles
// are black and white in both themes, outlined so each reads against the
// other. Pausing starts the game over.
import {
  createElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { COLUMNS, engine, scrollAt, VISIBLE_ROWS } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "endless";
/** Keys for the four columns, left to right. */
const KEYS: readonly (readonly string[])[] = [
  ["d", "1"],
  ["f", "2"],
  ["j", "3"],
  ["k", "4"],
];

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
  const puzzle = usePuzzle({
    context,
    seed,
    handle,
    engine,
    raceConfig: () => undefined,
    timeKey,
    best: { order: "desc" },
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  // The first tap's timestamp (performance.now()'s clock), and the scroll.
  const startRef = useRef<number | null>(null);
  const yRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  // The lowest row on the board, for rendering.
  const [base, setBase] = useState(0);

  function reset() {
    startRef.current = null;
    yRef.current = 0;
    trackRef.current?.style.setProperty("--y", "0");
    setBase(0);
  }

  function tap(row: number, col: number, at: number) {
    if (!state || !playing || handle.paused) return;
    const first = startRef.current === null;
    if (first && !(row === 0 && col === state.cols[0])) return;
    const ms = first ? 0 : Math.round(at - (startRef.current ?? at));
    const next = puzzle.dispatch({ row, col, ms });
    if (!next) return;
    if (first) startRef.current = at;
    if (next.over) {
      sounds.play("end");
      vibrate(HAPTICS.lose, context.settings.haptics);
    } else {
      sounds.play("key");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }

  // Taps on the board, read from the tile under them (a listener on the
  // board, like the keys' on the window: the board is one input surface).
  const boardRef = useRef<HTMLDivElement>(null);
  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    if (event.button > 0) return;
    const tile = (event.target as HTMLElement).closest<HTMLElement>("[data-row]");
    if (!tile) return;
    event.preventDefault();
    tap(Number(tile.dataset.row), Number(tile.dataset.col), event.timeStamp);
  });
  useEffect(() => {
    const board = boardRef.current;
    if (!playing || !board) return;
    // No long-press menu over the keys.
    const noMenu = (event: Event) => {
      event.preventDefault();
    };
    board.addEventListener("pointerdown", onPointerDown);
    board.addEventListener("contextmenu", noMenu);
    return () => {
      board.removeEventListener("pointerdown", onPointerDown);
      board.removeEventListener("contextmenu", noMenu);
    };
  }, [playing]);

  // The keyboard plays the next row.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !state) return;
    const col = KEYS.findIndex((keys) => keys.includes(event.key.toLowerCase()));
    if (col < 0) return;
    event.preventDefault();
    tap(state.played, col, event.timeStamp);
  });
  useEffect(() => {
    if (!playing) return;
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  // Each frame: scroll, and end the game when the next black tile is gone.
  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      if (startRef.current !== null) {
        reset();
        puzzle.start(undefined);
      }
      return;
    }
    const start = startRef.current;
    if (start === null) return;
    const ms = Math.round(time - start);
    const y = scrollAt(ms);
    yRef.current = y;
    trackRef.current?.style.setProperty("--y", y.toFixed(4));
    if (Math.floor(y) !== base) setBase(Math.floor(y));
    if (y >= state.played + 1) {
      const next = puzzle.dispatch({ miss: ms });
      if (next?.over) {
        // Scroll back so the tile that got away shows, in red, at the bottom.
        yRef.current = next.over.row;
        trackRef.current?.style.setProperty("--y", String(next.over.row));
        setBase(next.over.row);
        sounds.play("end");
        vibrate(HAPTICS.lose, context.settings.haptics);
      }
    }
  });
  const rafRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const loop = (time: number) => {
      frame(time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("chooseTitle")}
        choices={[{ config: undefined, label: t("start"), detail: t("startDetail") }]}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best", { n: "{time}" })}
        formatBest={(n) => t("best", { n })}
        onPick={(config) => {
          reset();
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const rows = Array.from({ length: VISIBLE_ROWS + 1 }, (_, i) => base + i);
  return (
    <div className="gk gbk">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("tiles")}</span> <strong>{state.played}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("speed")}</span>{" "}
          <strong>
            {t("rowsPerSecond", { n: (2.5 + 0.08 * (state.last / 1000)).toFixed(1) })}
          </strong>
        </span>
      </div>
      <div ref={boardRef} className="gbk-board" role="application" aria-label={t("boardLabel")}>
        <div ref={trackRef} className="gbk-track">
          {rows.map((row) => (
            <div key={row} className="gbk-row" style={{ "--r": String(row) } as CSSProperties}>
              {Array.from({ length: COLUMNS }, (_, col) => {
                const black = state.cols[row] === col;
                const tile =
                  state.over?.why === "wrong" && state.over.row === row && state.over.col === col
                    ? "wrong"
                    : black && state.over?.why === "missed" && state.over.row === row
                      ? "wrong"
                      : black && row < state.played
                        ? "done"
                        : black
                          ? "black"
                          : "white";
                return (
                  <div
                    key={col}
                    className="gbk-tile"
                    data-tile={tile}
                    data-row={row}
                    data-col={col}
                  >
                    {row === 0 && black && state.played === 0 ? t("startTile") : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="gk-sr" role="status">
        {state.over ? t("tilesTotal", { n: state.played }) : ""}
      </p>
      {puzzle.screen === "over" && (
        <div className="gbk-summary">
          <p className="gk-big">{t("tilesTotal", { n: state.played })}</p>
          <p>{state.over?.why === "missed" ? t("missed") : t("wrongTile")}</p>
          {puzzle.newBest && <p>{t("newBest")}</p>}
        </div>
      )}
      {playing && !puzzle.racing && state.played === 0 && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("quit")}
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

// Fixed colours in both themes: white and near-black tiles with a grey
// grid, tapped tiles grey with a mark, a wrong one red. Inks: 17:1 on the
// black tile, 4.9:1 on the red.
const CSS = `
.gbk { max-width: 40rem; margin-inline: auto; }
.gbk-board { position: relative; width: min(100%, 26rem, calc((100dvh - 11rem) * 0.75)); aspect-ratio: 3 / 4; overflow: hidden; border-radius: 0.75rem; border: 2px solid #475569; background: #f8fafc; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; direction: ltr; }
.gbk-track { --y: 0; position: absolute; inset: 0; transform: translateY(calc(var(--y) * 25%)); will-change: transform; }
.gbk-row { position: absolute; inset-inline: 0; height: 25%; bottom: calc(var(--r) * 25%); display: grid; grid-template-columns: repeat(4, 1fr); }
.gbk-tile { display: grid; place-items: center; border: 1px solid #94a3b8; font-weight: 800; font-size: 1rem; }
.gbk-tile[data-tile="white"] { background: #f8fafc; }
.gbk-tile[data-tile="black"] { background: #0f172a; color: #ffffff; }
.gbk-tile[data-tile="done"] { background: #cbd5e1; background-image: linear-gradient(135deg, transparent 45%, #64748b 45%, #64748b 55%, transparent 55%); }
.gbk-tile[data-tile="wrong"] { background: #dc2626; color: #ffffff; }
.gbk-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.gbk-summary p { margin: 0; }
`;
