// Anagrams: a menu with the best on this device, then seven letter tiles
// and two minutes. Tap tiles (or type) to build a word, Enter to send it;
// Backspace takes a letter back, Shuffle mixes the tiles. Each word is
// judged at once (a word, already found, not a word, too short), and the
// found words are listed with their points. At the end: the seven-letter
// word and words you could have made. The word lists load first
// (ADR-0050); time spent paused doesn't count.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { charsOf, hasLexicon, lexiconOf, Rng } from "@kefche/game-sdk";
import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  LetterTile,
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
  allWords,
  configFrom,
  DURATION_MS,
  engine,
  judge,
  PACKS,
  pointsFor,
  type Config,
  type Pack,
  type State,
  type Verdict,
} from "../engine";
import { manifest } from "../manifest";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => config.pack;
/** Literal keys for each verdict's message. */
const VERDICT_KEYS: Readonly<Record<Verdict, string>> = {
  ok: "verdictOk",
  short: "verdictShort",
  letters: "verdictLetters",
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
  // The tiles picked for the word being built (indexes into the shown order).
  const [picked, setPicked] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [verdict, setVerdict] = useState<{ word: string; v: Verdict } | null>(null);
  const [left, setLeft] = useState(DURATION_MS);
  const clock = useStimulus(playing ? seed : null);
  // Paused time so far, taken off the clock.
  const pausedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const text = wordText(t);

  const letters = state?.letters ?? [];
  const shown = order.map((i) => letters[i] ?? "");
  const word = picked.map((i) => shown[i] ?? "").join("");

  function addLetter(letter: string) {
    const i = shown.findIndex((l, k) => l === letter && !picked.includes(k));
    if (i >= 0) setPicked((p) => [...p, i]);
  }
  function submit(at: number) {
    if (!state || !playing || handle.paused || word === "") return;
    const v = judge(state, word);
    setVerdict({ word, v });
    setPicked([]);
    if (v !== "ok") {
      sounds.play("no");
      return;
    }
    const ms = Math.round((clock.since(at) ?? 0) - pausedRef.current);
    const next = puzzle.dispatch({ word, ms: Math.max(0, Math.min(ms, DURATION_MS - 1)) });
    if (next) {
      sounds.play(charsOf(word).length === 7 ? "seven" : "yes");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }
  useTypedKeys(
    state?.pack ?? pack,
    {
      onLetter: addLetter,
      onBackspace: () => {
        setPicked((p) => p.slice(0, -1));
      },
      onEnter: submit,
    },
    playing,
  );

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
    if (ms >= DURATION_MS) {
      const next = puzzle.dispatch({ stop: true });
      if (next) sounds.play("end");
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
        choices={[{ config: { pack }, label: t("start"), detail: t("startDetail") }]}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best", { n: "{time}" })}
        formatBest={(n) => t("best", { n })}
        {...(puzzle.screen === "failed" ? { failed: t("loadFailed") } : {})}
        onPick={(config) => {
          pausedRef.current = 0;
          lastFrameRef.current = null;
          setPicked([]);
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
    <div className="gk gan">
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
          <div className="gan-word" dir="ltr" role="group" aria-label={t("yourWord")}>
            {Array.from({ length: 7 }, (_, i) => (
              <LetterTile key={i} lang={state.pack} letter={word ? charsOf(word)[i] : undefined} />
            ))}
          </div>
          <p className="gan-verdict" role="status">
            {verdict
              ? `${up(verdict.word)}: ${t(VERDICT_KEYS[verdict.v], { points: pointsFor(verdict.word) })}`
              : ""}
          </p>
          <div className="gan-tiles" dir="ltr" role="group" aria-label={t("lettersLabel")}>
            {shown.map((l, i) => (
              <button
                // eslint-disable-next-line @eslint-react/no-array-index-key -- tiles keep their place
                key={i}
                type="button"
                className="gk-key gan-tile"
                disabled={picked.includes(i)}
                onClick={() => {
                  setPicked((p) => [...p, i]);
                }}
              >
                {up(l)}
              </button>
            ))}
          </div>
          <div className="gk-bar">
            <button
              type="button"
              className="gk-btn"
              onClick={() => {
                setOrder((o) => Rng.fromSeed(`${seed}:${String(Date.now())}`).shuffle(o));
                setPicked([]);
              }}
            >
              {t("shuffle")}
            </button>
            <button
              type="button"
              className="gk-btn"
              aria-label={text.backspace}
              disabled={picked.length === 0}
              onClick={() => {
                setPicked((p) => p.slice(0, -1));
              }}
            >
              ⌫
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
          <ul className="gan-found" aria-label={t("foundLabel")}>
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
  // Words you could have made: the common ones where the language has a list.
  const list = hasLexicon(state.pack, "common")
    ? lexiconOf(state.pack, "common")
    : lexiconOf(state.pack, "all");
  const missed = allWords(list, state.letters)
    .filter((w) => !state.found.includes(w))
    .slice(0, 24);
  return (
    <div className="gan-summary" role="status">
      <p className="gk-big">{t("pointsTotal", { n: state.points })}</p>
      <p>{t("seven", { word: up(state.seed) })}</p>
      {newBest && <p>{t("newBest")}</p>}
      {missed.length > 0 && (
        <>
          <p>{t("missed")}</p>
          <ul className="gan-found gan-missed">
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
.gan { max-width: 32rem; margin-inline: auto; }
.gan-word { display: flex; gap: 0.3rem; --tile-w: min(2.75rem, calc((100vw - 4rem) / 7)); }
.gan-verdict { margin: 0; min-height: 1.5rem; font-weight: 700; text-align: center; }
.gan-tiles { display: flex; justify-content: center; gap: 0.4rem; width: 100%; }
.gan-tile { flex: 0 1 3.25rem; min-height: 3.25rem; font-size: 1.35rem; }
.gk-btn[data-primary] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.gan-found { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem 0.5rem; margin: 0; padding: 0; list-style: none; font-weight: 700; }
.gan-found li { padding: 0.1rem 0.55rem; border-radius: 999px; background: var(--surface-2); }
.gan-found li span { color: var(--text-muted); font-weight: 600; }
.gan-missed li { font-weight: 600; color: var(--text-muted); }
.gan-summary { display: grid; justify-items: center; gap: 0.4rem; text-align: center; }
.gan-summary p { margin: 0; }
`;
