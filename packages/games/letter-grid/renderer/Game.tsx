// Letter Grid: a menu of sizes with the best of each on this device, then
// the grid and three minutes. Build a word by tapping touching squares one
// after another, by dragging through them (a square counts when the finger
// is near its middle, so diagonals don't catch a neighbour), or by typing
// it (its path lights up when there is one); Enter sends it, Backspace
// takes a letter back. Each word is judged at once; at the end, the words
// you could have found. The lists load first; paused time doesn't count.
// The grid stays left to right in every language.
import {
  createElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { hasLexicon, lexiconOf } from "@kefche/game-sdk";
import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  usePuzzle,
  useStimulus,
  useTypedKeys,
  WORD_CSS,
  wordText,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";
import { loadLexicons } from "@kefche/lexicons/browser";

import {
  configFrom,
  DURATION_MS,
  engine,
  gridWords,
  judge,
  neighbours,
  PACKS,
  pointsFor,
  SIZES,
  trace,
  type Config,
  type Pack,
  type State,
  type Verdict,
} from "../engine";
import { manifest } from "../manifest";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => `${config.pack}-${String(config.size)}`;
const VERDICT_KEYS: Readonly<Record<Verdict, string>> = {
  ok: "verdictOk",
  short: "verdictShort",
  path: "verdictPath",
  found: "verdictFound",
  unknown: "verdictUnknown",
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
  const pack: Pack = PACKS.find((p) => context.locale.startsWith(p)) ?? "en";
  const puzzle = usePuzzle({
    context,
    seed,
    handle,
    engine,
    raceConfig: configFrom,
    timeKey,
    best: { order: "desc" },
    create: async (s, config) => {
      await loadLexicons(config.pack, manifest.lexicons);
      return engine.initialState(config, s);
    },
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  const [path, setPath] = useState<number[]>([]);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<{ word: string; v: Verdict } | null>(null);
  const [left, setLeft] = useState(DURATION_MS);
  const clock = useStimulus(playing ? seed : null);
  const pausedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const dragRef = useRef(false);
  const text = wordText(t);

  const letters = state?.letters ?? [];
  const size = state?.size ?? 4;
  const word = path.length > 0 ? path.map((c) => letters[c] ?? "").join("") : typed;
  const lit = path.length > 0 ? path : typed ? (trace(letters, size, typed) ?? []) : [];

  function clear() {
    setPath([]);
    setTyped("");
  }
  function submit(at: number) {
    if (!state || !playing || handle.paused || word === "") return;
    const v = judge(state, word);
    setVerdict({ word, v });
    clear();
    if (v !== "ok") {
      sounds.play("no");
      return;
    }
    const ms = Math.round((clock.since(at) ?? 0) - pausedRef.current);
    if (puzzle.dispatch({ word, ms: Math.max(0, Math.min(ms, DURATION_MS - 1)) })) {
      sounds.play("yes");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }
  /** A square added to the path: the first, or one touching the last; tapping the last again sends. */
  function touch(cell: number, at: number) {
    if (!playing) return;
    setTyped("");
    const last = path.at(-1);
    if (last === cell && !dragRef.current) {
      submit(at);
      return;
    }
    if (path.includes(cell)) return;
    if (last === undefined || neighbours(size, last).includes(cell)) setPath([...path, cell]);
    else setPath([cell]);
  }

  useTypedKeys(
    state?.pack ?? pack,
    {
      onLetter: (l) => {
        setPath([]);
        setTyped((w) => w + l);
      },
      onBackspace: () => {
        if (path.length > 0) setPath((p) => p.slice(0, -1));
        else setTyped((w) => w.slice(0, -1));
      },
      onEnter: submit,
    },
    playing,
  );

  /** The square under a point, if it's near the square's middle. */
  const cellAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const near =
      Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2)) < b.width * 0.38;
    return near ? Number(el.dataset.cell) : null;
  };
  function onDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button > 0 || !playing) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = false;
    touch(cell, event.timeStamp);
  }
  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const cell = cellAt(event.clientX, event.clientY);
    const last = path.at(-1);
    if (cell === null || cell === last || last === undefined) return;
    if (path.length >= 2 && path.at(-2) === cell) {
      // Dragging back over the last square takes it off.
      setPath((p) => p.slice(0, -1));
      return;
    }
    if (!path.includes(cell) && neighbours(size, last).includes(cell)) {
      dragRef.current = true;
      setPath([...path, cell]);
    }
  }
  function onUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current && path.length >= 2) submit(event.timeStamp);
    dragRef.current = false;
  }

  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    const lastFrame = lastFrameRef.current;
    lastFrameRef.current = time;
    if (handle.paused) {
      if (lastFrame !== null) pausedRef.current += time - lastFrame;
      return;
    }
    const ms = (clock.since(time) ?? 0) - pausedRef.current;
    setLeft(Math.max(0, DURATION_MS - ms));
    if (ms >= DURATION_MS && puzzle.dispatch({ stop: true })) sounds.play("end");
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
        title={t("chooseSize")}
        choices={SIZES.map((s) => ({
          config: { pack, size: s },
          label: t("sizeLabel", { size: s }),
          detail: t("threeMinutes"),
        }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best", { n: "{time}" })}
        formatBest={(n) => t("best", { n })}
        {...(puzzle.screen === "failed" ? { failed: t("loadFailed") } : {})}
        onPick={(config) => {
          pausedRef.current = 0;
          lastFrameRef.current = null;
          clear();
          setVerdict(null);
          setLeft(DURATION_MS);
          puzzle.start(config);
        }}
      />
    );
  }
  if (puzzle.screen === "loading" || !state) {
    return (
      <p className="gk" aria-busy="true">
        {t("loading")}
      </p>
    );
  }
  const over = puzzle.screen === "over";
  const up = (w: string) => w.toLocaleUpperCase(state.pack);
  return (
    <div className="gk glg">
      <style>{KIT_CSS + WORD_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("points")}</span> <strong>{state.points}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("words")}</span> <strong>{state.found.length}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("timeLeft")}</span>{" "}
          <strong>{t("seconds", { s: Math.ceil(left / 1000) })}</strong>
        </span>
      </div>
      {over ? (
        <Summary context={context} state={state} newBest={puzzle.newBest} up={up} />
      ) : (
        <>
          <p className="glg-word" aria-live="polite">
            {word ? up(word) : " "}
          </p>
          <div
            className="glg-grid"
            role="grid"
            aria-label={t("gridLabel")}
            style={{ gridTemplateRows: `repeat(${String(size)}, 1fr)` }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {Array.from({ length: size }, (_, r) => (
              <div
                key={r}
                role="row"
                className="glg-row"
                style={{ gridTemplateColumns: `repeat(${String(size)}, 1fr)` }}
              >
                {Array.from({ length: size }, (__, c) => {
                  const cell = r * size + c;
                  return (
                    <div
                      key={cell}
                      role="gridcell"
                      className="glg-cell"
                      data-cell={cell}
                      data-lit={lit.includes(cell) ? "" : undefined}
                      aria-selected={lit.includes(cell)}
                    >
                      {up(letters[cell] ?? "")}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="glg-verdict" role="status">
            {verdict
              ? `${up(verdict.word)}: ${t(VERDICT_KEYS[verdict.v], { points: pointsFor(verdict.word) })}`
              : ""}
          </p>
          <div className="gk-bar">
            <button type="button" className="gk-btn" disabled={word === ""} onClick={clear}>
              {t("clear")}
            </button>
            <button
              type="button"
              className="gk-btn"
              data-primary=""
              disabled={word === ""}
              onClick={(event) => {
                submit(event.timeStamp);
              }}
            >
              {text.enter}
            </button>
          </div>
          <ul className="glg-found" aria-label={t("foundLabel")}>
            {[...state.found].reverse().map((w) => (
              <li key={w}>
                {up(w)} <span>+{pointsFor(w)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Summary({
  context,
  state,
  newBest,
  up,
}: {
  context: GameContext;
  state: State;
  newBest: boolean;
  up: (w: string) => string;
}) {
  const { t } = context;
  const list = hasLexicon(state.pack, "common")
    ? lexiconOf(state.pack, "common")
    : lexiconOf(state.pack, "all");
  const missed = gridWords(list, state.letters, state.size)
    .filter((w) => !state.found.includes(w))
    .slice(0, 24);
  return (
    <div className="glg-summary" role="status">
      <p className="gk-big">{t("pointsTotal", { n: state.points })}</p>
      <p>{t("wordsTotal", { n: state.found.length })}</p>
      {newBest && <p>{t("newBest")}</p>}
      {missed.length > 0 && (
        <>
          <p>{t("missed")}</p>
          <ul className="glg-found glg-missed">
            {missed.map((w) => (
              <li key={w}>{up(w)}</li>
            ))}
          </ul>
        </>
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

const CSS = `
.glg { max-width: 32rem; margin-inline: auto; }
.glg-word { margin: 0; min-height: 2rem; font-size: 1.5rem; font-weight: 800; letter-spacing: 0.08em; }
.glg-grid { display: grid; gap: 4%; width: min(100%, calc(100dvh - 18rem), 24rem); min-width: 14rem; aspect-ratio: 1; direction: ltr; touch-action: none; user-select: none; -webkit-user-select: none; }
.glg-row { display: grid; gap: 4%; }
.glg-cell { display: grid; place-items: center; border-radius: 0.75rem; border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: clamp(1.25rem, 7vw, 2rem); font-weight: 800; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.glg-cell[data-lit] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.glg-verdict { margin: 0; min-height: 1.5rem; font-weight: 700; text-align: center; }
.gk-btn[data-primary] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.glg-found { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem 0.5rem; margin: 0; padding: 0; list-style: none; font-weight: 700; }
.glg-found li { padding: 0.1rem 0.55rem; border-radius: 999px; background: var(--surface-2); }
.glg-found li span { color: var(--text-muted); font-weight: 600; }
.glg-missed li { font-weight: 600; color: var(--text-muted); }
.glg-summary { display: grid; justify-items: center; gap: 0.4rem; text-align: center; }
.glg-summary p { margin: 0; }
`;
