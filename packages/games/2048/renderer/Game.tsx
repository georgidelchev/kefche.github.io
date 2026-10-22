// 2048 board: tiles are positioned by row and column with CSS transforms and
// keyed by id, so slides animate; merges pop and new tiles grow in.
import { useEffect, useRef, useState } from "react";

import { HAPTICS, onDirectionKeys, onSwipe, vibrate } from "@kefche/game-sdk/browser";
import type { GameContext } from "@kefche/game-sdk/browser";

import { engine, bestTile, SIZE, type Direction, type State } from "../engine";

export interface GameHandle {
  paused: boolean;
}

interface Props {
  context: GameContext;
  seed: string;
  handle: GameHandle;
}

const BEST_KEY = "best";

export function Game({ context, seed, handle }: Props) {
  const { t } = context;
  const [state, setState] = useState<State>(() => engine.initialState(undefined, seed));
  // Best score from earlier games; the live best also counts this game.
  const [storedBest] = useState(() => Number(context.storage.get(BEST_KEY) ?? 0));
  const best = Math.max(storedBest, state.score);
  const boardRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  // Input: arrows, WASD and swipes.
  useEffect(() => {
    const move = (direction: Direction) => {
      if (handle.paused) return;
      setState((s) => engine.apply(s, { type: "move", direction }));
    };
    const offKeys = onDirectionKeys(move);
    const offSwipe = boardRef.current ? onSwipe(boardRef.current, move) : undefined;
    return () => {
      offKeys();
      offSwipe?.();
    };
  }, [handle]);

  // Side effects of a new state: best score, haptics, reporting.
  useEffect(() => {
    if (state.moves === 0) return;
    context.report({ type: "score", score: state.score });
    if (state.score > storedBest) context.storage.set(BEST_KEY, String(state.score));
    if (state.tiles.some((tile) => tile.merged)) vibrate(HAPTICS.tap, context.settings.haptics);
    const result = engine.result(state);
    if (result && !finishedRef.current) {
      finishedRef.current = true;
      vibrate(HAPTICS.lose, context.settings.haptics);
      context.report({ type: "finish", result });
    }
  }, [state, storedBest, context]);

  const motion = !context.settings.reducedMotion;
  const showWin = state.won && !state.continued;
  return (
    <div className="g2048" data-motion={motion ? "on" : "off"}>
      <style>{CSS}</style>
      <div className="g2048-hud">
        <div className="g2048-stat">
          <span>{t("score")}</span>
          <strong>{state.score}</strong>
        </div>
        <div className="g2048-stat">
          <span>{t("best")}</span>
          <strong>{best}</strong>
        </div>
        <button
          type="button"
          className="g2048-undo"
          disabled={!state.undo || state.undoUsed}
          onClick={() => {
            setState((s) => engine.apply(s, { type: "undo" }));
          }}
        >
          {t("undo")}
        </button>
      </div>
      <div
        ref={boardRef}
        className="g2048-board"
        role="img"
        aria-label={t("boardLabel", { score: state.score, best: bestTile(state) })}
      >
        {Array.from({ length: SIZE * SIZE }, (_, i) => (
          <div
            key={`cell-${String(i)}`}
            className="g2048-cell"
            style={cellPosition(Math.floor(i / SIZE), i % SIZE)}
          />
        ))}
        {state.tiles.map((tile) => (
          <div key={tile.id} className="g2048-slot" style={cellPosition(tile.row, tile.col)}>
            <div
              className="g2048-tile"
              data-value={tile.value > 2048 ? "big" : tile.value}
              data-merged={tile.merged ? "" : undefined}
              data-spawned={tile.spawned ? "" : undefined}
              data-digits={String(tile.value).length}
            >
              {tile.value}
            </div>
          </div>
        ))}
        {showWin && (
          <div
            className="g2048-overlay"
            role="dialog"
            aria-modal="false"
            aria-labelledby="g2048-win"
          >
            <p id="g2048-win">{t("won")}</p>
            <button
              type="button"
              onClick={() => {
                setState((s) => engine.apply(s, { type: "continue" }));
              }}
            >
              {t("keepGoing")}
            </button>
          </div>
        )}
      </div>
      <p className="g2048-status" role="status">
        {t("boardLabel", { score: state.score, best: bestTile(state) })}
      </p>
    </div>
  );
}

const cellPosition = (row: number, col: number) => ({
  transform: `translate(${String(col * 100)}%, ${String(row * 100)}%)`,
});

// Scoped by the g2048- prefix. Surfaces use the site's tokens so the board
// follows the light and dark themes; tile colors are the game's own.
const CSS = `
.g2048 { display: grid; gap: 0.75rem; width: min(100%, 30rem); margin-inline: auto; user-select: none; }
.g2048-hud { display: flex; gap: 0.5rem; align-items: stretch; }
.g2048-stat { flex: 1; display: grid; place-items: center; padding: 0.35rem; border-radius: 0.75rem; background: var(--surface-2); }
.g2048-stat span { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.g2048-stat strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.g2048-undo, .g2048-overlay button { min-height: 2.75rem; padding-inline: 1rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 600; cursor: pointer; }
.g2048-undo:disabled { opacity: 0.45; cursor: not-allowed; }
.g2048 button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.g2048-board { position: relative; aspect-ratio: 1; padding: 2%; border-radius: 1rem; background: var(--border-strong); container-type: size; touch-action: none; }
.g2048-cell, .g2048-slot { position: absolute; inset-block-start: 2%; inset-inline-start: 2%; width: 24%; height: 24%; padding: 1.5%; box-sizing: border-box; }
.g2048-cell::before { content: ""; display: block; width: 100%; height: 100%; border-radius: 0.6rem; background: var(--surface-2); opacity: 0.6; }
[dir="rtl"] .g2048-board { direction: ltr; }
[data-motion="on"] .g2048-slot { transition: transform 110ms ease-in-out; }
.g2048-tile { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 0.6rem; font-weight: 800; font-size: 11cqi; color: #3b2f2a; background: #eee4da; font-variant-numeric: tabular-nums; }
.g2048-tile[data-digits="3"] { font-size: 9cqi; }
.g2048-tile[data-digits="4"] { font-size: 7cqi; }
.g2048-tile[data-digits="5"], .g2048-tile[data-digits="6"] { font-size: 5.5cqi; }
[data-motion="on"] .g2048-tile[data-spawned] { animation: g2048-in 160ms ease-out both; animation-delay: 90ms; }
[data-motion="on"] .g2048-tile[data-merged] { animation: g2048-pop 180ms ease-out; }
@keyframes g2048-in { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes g2048-pop { 50% { transform: scale(1.14); } }
.g2048-tile[data-value="4"] { background: #ede0c8; }
.g2048-tile[data-value="8"] { background: #f2b179; }
.g2048-tile[data-value="16"] { background: #f59563; }
.g2048-tile[data-value="32"] { background: #f67c5f; color: #fff; }
.g2048-tile[data-value="64"] { background: #e2502e; color: #fff; }
.g2048-tile[data-value="128"] { background: #edcf72; }
.g2048-tile[data-value="256"] { background: #edcc61; }
.g2048-tile[data-value="512"] { background: #edc850; }
.g2048-tile[data-value="1024"] { background: #4f9de0; color: #fff; }
.g2048-tile[data-value="2048"] { background: #2563c9; color: #fff; }
.g2048-tile[data-value="big"] { background: #1c1f3a; color: #fff; }
.g2048-overlay { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 1rem; border-radius: 1rem; background: color-mix(in srgb, var(--surface) 85%, transparent); text-align: center; }
.g2048-overlay p { margin: 0; font-size: 1.6rem; font-weight: 800; }
.g2048-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
`;
