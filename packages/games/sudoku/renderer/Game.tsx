// Sudoku board: a difficulty menu (with "continue" for a saved game), then
// the grid with notes, hints, undo, a mistakes toggle and keyboard entry.
import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  createStopwatch,
  formatDuration,
  HAPTICS,
  vibrate,
  type GameContext,
} from "@kefche/game-sdk/browser";

import {
  boxOf,
  colOf,
  conflicts,
  DIFFICULTIES,
  engine,
  isSolved,
  rowOf,
  type Action,
  type Difficulty,
  type State,
} from "../engine";
import { bestTime, loadSaved, newGame, recordTime, save } from "./puzzle";

import type { Sounds } from "./sounds";

export interface GameHandle {
  paused: boolean;
}

interface Props {
  context: GameContext;
  seed: string;
  handle: GameHandle;
  sounds: Sounds;
}

type Screen =
  | { kind: "menu" }
  | { kind: "loading"; difficulty: Difficulty }
  | { kind: "failed"; difficulty: Difficulty }
  | { kind: "playing" }
  | { kind: "solved" };

const ERRORS_KEY = "highlight-mistakes";
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIFFICULTY_KEYS = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  expert: "expert",
} as const satisfies Record<Difficulty, string>;

export function Game({ context, seed, handle, sounds }: Props) {
  const { t, storage } = context;
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState(40);
  const [notesMode, setNotesMode] = useState(false);
  const [showErrors, setShowErrors] = useState(() => storage.get(ERRORS_KEY) !== "off");
  const [saved] = useState(() => loadSaved(storage));
  // Play time: earlier sessions of a saved game plus this stopwatch.
  const [watch] = useState(() => createStopwatch());
  const [baseMs, setBaseMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  // The unfinished game, for saving from the clock and on exit; null once solved.
  const liveRef = useRef<State | null>(null);

  function begin(next: State, previousMs: number) {
    liveRef.current = next;
    setState(next);
    setBaseMs(previousMs);
    setElapsedMs(previousMs);
    setSelected(Math.max(0, next.values.indexOf(0)));
    setNotesMode(false);
    watch.start();
    setScreen({ kind: "playing" });
  }

  function start(difficulty: Difficulty) {
    setScreen({ kind: "loading", difficulty });
    newGame(seed, difficulty).then(
      (next) => {
        begin(next, 0);
      },
      () => {
        setScreen({ kind: "failed", difficulty });
      },
    );
  }

  function dispatch(action: Action) {
    if (handle.paused || !state || screen.kind !== "playing") return;
    const next = engine.apply(state, action);
    if (next === state) return;
    setState(next);
    const ms = baseMs + watch.elapsed();
    if (isSolved(next)) {
      liveRef.current = null;
      watch.pause();
      setElapsedMs(ms);
      setScreen({ kind: "solved" });
      save(storage, null);
      recordTime(storage, next.difficulty, ms);
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
      context.report({ type: "finish", result: { completed: true, timeMs: ms } });
      return;
    }
    liveRef.current = next;
    save(storage, { state: next, elapsedMs: ms });
    const placed = action.type === "enter" && next.values[action.cell] === action.digit;
    const wrong = placed && next.solution[action.cell] !== action.digit;
    // A wrong digit only sounds wrong when mistakes are shown.
    if (wrong && showErrors) sounds.play("mistake");
    else if (placed) sounds.play("place");
    else if (action.type === "note") sounds.play("note");
    else if (action.type === "hint") sounds.play("hint");
    else sounds.play("erase"); // erase, undo, or the same digit again
    vibrate(wrong && showErrors ? HAPTICS.hit : HAPTICS.tap, context.settings.haptics);
  }

  function input(digit: number, asNote = notesMode) {
    dispatch({ type: asNote ? "note" : "enter", cell: selected, digit });
  }

  // The clock: follows the player's pause, and the saved game keeps its time.
  useEffect(() => {
    if (screen.kind !== "playing") return;
    const persist = () => {
      if (liveRef.current) {
        save(storage, { state: liveRef.current, elapsedMs: baseMs + watch.elapsed() });
      }
    };
    const tick = () => {
      if (handle.paused && watch.running) {
        watch.pause();
        persist();
      } else if (!handle.paused && !watch.running) {
        watch.resume();
      }
      setElapsedMs(baseMs + watch.elapsed());
    };
    const timer = setInterval(tick, 250);
    return () => {
      clearInterval(timer);
      persist();
    };
  }, [screen.kind, baseMs, watch, handle, storage]);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (screen.kind !== "playing" || handle.paused || e.altKey) return;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
    const ctrl = e.ctrlKey || e.metaKey;
    let handled = true;
    if (digit && !ctrl) input(Number(digit), notesMode !== e.shiftKey);
    else if (["Backspace", "Delete", "Digit0", "Numpad0"].includes(e.code))
      dispatch({ type: "erase", cell: selected });
    else if (e.key === "ArrowUp") setSelected((c) => (c + 72) % 81);
    else if (e.key === "ArrowDown") setSelected((c) => (c + 9) % 81);
    // The board is never mirrored, so left is left in every language.
    else if (e.key === "ArrowLeft") setSelected((c) => c - (c % 9) + ((c + 8) % 9));
    else if (e.key === "ArrowRight") setSelected((c) => c - (c % 9) + ((c + 1) % 9));
    else if (e.code === "KeyN" && !ctrl) setNotesMode((n) => !n);
    else if (e.code === "KeyH" && !ctrl) dispatch({ type: "hint", cell: selected });
    else if ((e.code === "KeyZ" && ctrl) || (e.code === "KeyU" && !ctrl))
      dispatch({ type: "undo" });
    else handled = false;
    if (handled) e.preventDefault();
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      onKey(e);
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, []);

  if (screen.kind === "menu" || screen.kind === "failed") {
    return (
      <div className="gsdk gsdk-menu">
        <style>{CSS}</style>
        <h3 className="gsdk-title">{t("chooseDifficulty")}</h3>
        {screen.kind === "failed" && <p role="alert">{t("generateFailed")}</p>}
        {saved && (
          <button
            type="button"
            className="gsdk-choice"
            data-primary=""
            onClick={() => {
              begin(saved.state, saved.elapsedMs);
            }}
          >
            <strong>{t("continue")}</strong>
            <span>
              {t("continueDetail", {
                difficulty: t(DIFFICULTY_KEYS[saved.state.difficulty]),
                time: formatDuration(saved.elapsedMs),
              })}
            </span>
          </button>
        )}
        {DIFFICULTIES.map((difficulty) => {
          const best = bestTime(storage, difficulty);
          return (
            <button
              key={difficulty}
              type="button"
              className="gsdk-choice"
              onClick={() => {
                start(difficulty);
              }}
            >
              <strong>{t(DIFFICULTY_KEYS[difficulty])}</strong>
              {best !== null && <span>{t("best", { time: formatDuration(best) })}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  if (screen.kind === "loading" || !state) {
    return (
      <div className="gsdk gsdk-menu">
        <style>{CSS}</style>
        <p role="status">{t("generating")}</p>
      </div>
    );
  }

  const clash = conflicts(state.values);
  const selectedValue = state.values[selected] ?? 0;
  const placed = DIGITS.map((d) => state.values.filter((v) => v === d).length);
  const isWrong = (cell: number) => {
    const v = state.values[cell] ?? 0;
    if (!v || state.givens[cell]) return false;
    return showErrors ? v !== state.solution[cell] : clash.has(cell);
  };
  const label = (cell: number) => {
    const where = { row: rowOf(cell) + 1, col: colOf(cell) + 1 };
    const v = state.values[cell] ?? 0;
    if (state.givens[cell]) return t("cellGiven", { ...where, value: v });
    if (v) return t("cellValue", { ...where, value: v });
    const notes = DIGITS.filter((d) => (state.notes[cell] ?? 0) & (1 << d));
    return notes.length
      ? t("cellNotes", { ...where, notes: notes.join(", ") })
      : t("cellEmpty", where);
  };

  return (
    <div className="gsdk" data-motion={context.settings.reducedMotion ? "off" : "on"}>
      <style>{CSS}</style>
      <div className="gsdk-hud">
        <span className="gsdk-chip">{t(DIFFICULTY_KEYS[state.difficulty])}</span>
        <span className="gsdk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(elapsedMs)}</strong>
        </span>
        <span className="gsdk-stat">
          <span>{t("mistakes")}</span> <strong>{state.mistakes}</strong>
        </span>
        <label className="gsdk-toggle">
          <input
            type="checkbox"
            checked={showErrors}
            onChange={(e) => {
              setShowErrors(e.target.checked);
              storage.set(ERRORS_KEY, e.target.checked ? "on" : "off");
            }}
          />
          {t("highlightMistakes")}
        </label>
      </div>

      <div className="gsdk-main">
        <div className="gsdk-board" role="grid" aria-label={t("boardLabel")}>
          {DIGITS.map((_, r) => (
            <div key={`row-${String(r)}`} role="row" className="gsdk-row">
              {DIGITS.map((__, k) => {
                const cell = r * 9 + k;
                const v = state.values[cell] ?? 0;
                const notes = state.notes[cell] ?? 0;
                const isSelected = cell === selected;
                const peer =
                  !isSelected &&
                  (rowOf(cell) === rowOf(selected) ||
                    colOf(cell) === colOf(selected) ||
                    boxOf(cell) === boxOf(selected));
                return (
                  <div
                    key={cell}
                    role="gridcell"
                    tabIndex={isSelected ? 0 : -1}
                    aria-selected={isSelected}
                    aria-label={label(cell)}
                    className="gsdk-cell"
                    data-given={state.givens[cell] ? "" : undefined}
                    data-hinted={state.hinted.includes(cell) ? "" : undefined}
                    data-peer={peer ? "" : undefined}
                    data-same={v && v === selectedValue && !isSelected ? "" : undefined}
                    data-wrong={isWrong(cell) ? "" : undefined}
                    data-box-end-col={k % 3 === 2 && k < 8 ? "" : undefined}
                    data-box-end-row={r % 3 === 2 && r < 8 ? "" : undefined}
                    onPointerDown={() => {
                      setSelected(cell);
                    }}
                    onFocus={() => {
                      setSelected(cell);
                    }}
                  >
                    {v ? (
                      <span className="gsdk-value">{v}</span>
                    ) : notes ? (
                      <span className="gsdk-notes" aria-hidden="true">
                        {DIGITS.map((d) => (
                          <span key={d}>{notes & (1 << d) ? d : ""}</span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="gsdk-controls">
          <div className="gsdk-tools">
            <button
              type="button"
              disabled={state.history.length === 0}
              onClick={() => {
                dispatch({ type: "undo" });
              }}
            >
              {t("undo")}
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "erase", cell: selected });
              }}
            >
              {t("erase")}
            </button>
            <button
              type="button"
              aria-pressed={notesMode}
              onClick={() => {
                setNotesMode((n) => !n);
              }}
            >
              {t("notes")}
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "hint", cell: selected });
              }}
            >
              {t("hint")}
            </button>
          </div>
          <div className="gsdk-pad" data-notes={notesMode ? "" : undefined}>
            {DIGITS.map((d, i) => {
              const left = 9 - (placed[i] ?? 0);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={left <= 0 && !notesMode}
                  aria-label={t("digitLabel", { digit: d, count: Math.max(0, left) })}
                  onClick={() => {
                    input(d);
                  }}
                >
                  <strong>{d}</strong>
                  <span aria-hidden="true">{Math.max(0, left)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="gsdk-sr" role="status">
        {label(selected)}
      </p>
    </div>
  );
}

// Scoped by the gsdk- prefix; surfaces use the site's tokens so the board
// follows the light and dark themes. The board stays left-to-right in every
// language, and sizes itself to the space the player leaves it.
const CSS = `
.gsdk { --gsdk-size: min(100%, 34rem, calc(100dvh - 19rem)); display: grid; gap: 0.75rem; width: 100%; max-width: 34rem; margin-inline: auto; user-select: none; -webkit-user-select: none; }
.gsdk-menu { max-width: 22rem; justify-items: stretch; text-align: center; }
.gsdk-title { margin: 0 0 0.25rem; font-size: 1.4rem; }
.gsdk-choice { display: grid; gap: 0.1rem; min-height: 3.25rem; padding: 0.5rem 1rem; border-radius: 0.9rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); cursor: pointer; font: inherit; }
.gsdk-choice strong { font-size: 1.05rem; }
.gsdk-choice span { font-size: 0.85rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.gsdk-choice[data-primary] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.gsdk-choice[data-primary] span { color: inherit; }
.gsdk button { font: inherit; }
.gsdk button:focus-visible, .gsdk-cell:focus-visible, .gsdk-toggle:focus-within { outline: 2px solid var(--focus); outline-offset: 2px; }
.gsdk-hud { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.9rem; font-size: 0.9rem; }
.gsdk-chip { padding: 0.2rem 0.65rem; border-radius: 999px; background: var(--surface-2); font-weight: 700; }
.gsdk-stat span { color: var(--text-muted); }
.gsdk-stat strong { font-variant-numeric: tabular-nums; }
.gsdk-toggle { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 2.75rem; margin-inline-start: auto; border-radius: 0.5rem; cursor: pointer; }
.gsdk-toggle input { width: 1.15rem; height: 1.15rem; accent-color: var(--brand-strong); }
.gsdk-main { display: grid; gap: 0.75rem; justify-items: center; }
.gsdk-board { direction: ltr; display: grid; grid-template-rows: repeat(9, 1fr); width: var(--gsdk-size); aspect-ratio: 1; border: 2px solid var(--text); border-radius: 0.6rem; overflow: hidden; background: var(--surface); container-type: inline-size; touch-action: manipulation; }
.gsdk-row { display: grid; grid-template-columns: repeat(9, 1fr); }
.gsdk-cell { position: relative; display: grid; place-items: center; border-inline-end: 1px solid var(--border); border-block-end: 1px solid var(--border); color: var(--brand-2); cursor: pointer; outline-offset: -3px; }
.gsdk-row:last-child .gsdk-cell { border-block-end: 0; }
.gsdk-cell:last-child { border-inline-end: 0; }
.gsdk-cell[data-box-end-col] { border-inline-end: 2px solid var(--text); }
.gsdk-cell[data-box-end-row] { border-block-end: 2px solid var(--text); }
.gsdk-cell[data-peer] { background: var(--surface-2); }
.gsdk-cell[data-same] { background: color-mix(in srgb, var(--brand-2) 22%, var(--surface)); }
.gsdk-cell[aria-selected="true"] { background: color-mix(in srgb, var(--brand-2) 38%, var(--surface)); }
.gsdk-cell[data-given] { color: var(--text); }
.gsdk-cell[data-hinted] { color: var(--accent-strong); }
.gsdk-cell[data-wrong] { color: var(--danger); background: color-mix(in srgb, var(--danger) 14%, var(--surface)); }
.gsdk-cell[data-wrong][aria-selected="true"] { background: color-mix(in srgb, var(--danger) 26%, var(--surface)); }
.gsdk-value { font-size: 6.4cqi; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
.gsdk-cell[data-given] .gsdk-value { font-weight: 800; }
.gsdk-notes { position: absolute; inset: 6%; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); place-items: center; font-size: 2.5cqi; font-weight: 600; line-height: 1; color: var(--text-muted); }
.gsdk-controls { display: grid; gap: 0.6rem; width: var(--gsdk-size); }
.gsdk-tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; }
.gsdk-tools button { min-height: 2.75rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 600; cursor: pointer; }
.gsdk-tools button[aria-pressed="true"] { background: var(--text); border-color: var(--text); color: var(--bg); }
.gsdk button:disabled { opacity: 0.4; cursor: not-allowed; }
.gsdk-pad { display: grid; grid-template-columns: repeat(9, 1fr); gap: 0.3rem; direction: ltr; }
.gsdk-pad button { display: grid; place-items: center; min-height: 3.25rem; padding: 0.2rem 0; border-radius: 0.75rem; border: 0; background: var(--surface-2); color: var(--text); cursor: pointer; }
.gsdk-pad strong { font-size: 1.45rem; line-height: 1.1; }
.gsdk-pad span { font-size: 0.7rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.gsdk-pad[data-notes] button { background: var(--surface); border: 1px dashed var(--border-strong); }
.gsdk-pad[data-notes] strong { font-weight: 500; color: var(--text-muted); }
.gsdk-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (orientation: landscape) and (max-height: 40rem) {
  .gsdk { --gsdk-size: min(calc(100dvh - 9rem), 30rem); max-width: none; }
  .gsdk-main { grid-template-columns: auto minmax(14rem, 22rem); align-items: center; }
  .gsdk-controls { width: 100%; }
  .gsdk-pad { grid-template-columns: repeat(3, 1fr); }
}
@media (hover: hover) { .gsdk-cell:not([aria-selected="true"]):hover { background: color-mix(in srgb, var(--brand-2) 12%, var(--surface)); } }
`;
