// Trivia: a menu of topics (all mixed, or one category) with the best score
// of each on this device, a 3-2-1 countdown, then ten questions. Each shows
// its four answers and a 15-second bar; tap or click one, or press 1 to 4.
// The answer is timed from the frame that drew the question to the input's
// own event. Then the right answer shows (and yours, if it was wrong) with
// the points, for a moment, and the next question comes. Pausing gives up
// the question on screen, so it can't be looked up. At the end: the score,
// and every question with your answer and the right one.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  useCountdown,
  usePuzzle,
  useStimulus,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  BANK,
  configFrom,
  current,
  engine,
  LIMIT_MS,
  PACKS,
  TOPICS,
  type Config,
  type Pack,
  type State,
  type Topic,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";

/** How long the right answer shows before the next question. */
const REVEAL_MS = 1600;

const timeKey = (config: Config) => `${config.pack}:${config.topic}`;

/** Literal keys for the topics' names. */
const TOPIC_KEYS: Readonly<Record<Topic, string>> = {
  mixed: "topicMixed",
  geography: "topicGeography",
  history: "topicHistory",
  science: "topicScience",
  nature: "topicNature",
  sport: "topicSport",
  arts: "topicArts",
  music: "topicMusic",
  food: "topicFood",
};

const rightCount = (s: State) => s.answers.filter((a) => a.right).length;

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
    finishNote: (s) => t("resultNote", { n: rightCount(s), total: s.picks.length }),
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  const [run, setRun] = useState(0);
  const [live, setLive] = useState(false);
  /** The question just answered, shown with the right answer for a moment. */
  const [reveal, setReveal] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const count = useCountdown(playing && !live ? run : null, 3, () => {
    setLive(true);
  });
  const asking = playing && live && reveal === null && state !== null && !state.over;
  const clock = useStimulus(asking ? `${String(run)}:${String(state.index)}` : null);
  const firstRef = useRef<HTMLButtonElement>(null);

  function begin(config: Config) {
    setLive(false);
    setReveal(null);
    setNow(0);
    setRun((r) => r + 1);
    puzzle.start(config);
  }

  /** Records the answer (or none, when time ran out) and shows the right one. */
  function answer(choice: number | null, at: number) {
    if (!state || !asking || handle.paused) return;
    const index = state.index;
    let next: State | null;
    if (choice === null) next = puzzle.dispatch({ timeout: true });
    else {
      const ms = clock.since(at);
      if (ms === null) return;
      next = puzzle.dispatch({ choice, ms: Math.min(ms, LIMIT_MS - 1) });
    }
    if (!next) return;
    setReveal(index);
    const right = next.answers.at(-1)?.right ?? false;
    sounds.play(right ? "right" : "wrong");
    vibrate(right ? HAPTICS.tap : HAPTICS.hit, context.settings.haptics);
  }

  // After a moment, the next question (or the end).
  useEffect(() => {
    if (reveal === null) return;
    const timer = setTimeout(() => {
      setReveal(null);
      setNow(0);
    }, REVEAL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [reveal]);

  // The first answer takes focus with each question, for keyboard players.
  useEffect(() => {
    if (asking) firstRef.current?.focus({ preventScroll: true });
  }, [asking, state?.index]);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || !/^[1-4]$/.test(event.key)) return;
    event.preventDefault();
    answer(Number(event.key) - 1, event.timeStamp);
  });
  useEffect(() => {
    if (!playing) return;
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  const pausedRef = useRef(false);
  const frame = useEffectEvent((time: number) => {
    if (!asking) return;
    // A pause gives up the question on screen (it could be looked up meanwhile):
    // nothing is taken while paused, so it goes on the first frame back.
    if (handle.paused) {
      pausedRef.current = true;
      return;
    }
    if (pausedRef.current) {
      pausedRef.current = false;
      answer(null, time);
      return;
    }
    const ms = clock.since(time);
    if (ms === null) return;
    setNow(ms);
    if (ms >= LIMIT_MS) answer(null, time);
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
        title={t("chooseTopic")}
        choices={TOPICS.map((topic) => ({
          config: { pack, topic },
          label: t(TOPIC_KEYS[topic]),
          detail: t(topic === "mixed" ? "topicMixedDetail" : "topicOneDetail"),
        }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best", { n: "{time}" })}
        formatBest={(n) => t("best", { n })}
        onPick={begin}
      />
    );
  }
  if (!state) return null;
  const over = puzzle.screen === "over" && reveal === null;
  const shownIndex = reveal ?? state.index;
  const shown = current({ ...state, index: shownIndex });
  const given = reveal === null ? null : state.answers[reveal];
  const order = state.orders[shownIndex] ?? [];
  const left = Math.max(0, LIMIT_MS - now);

  return (
    <div className="gk gtv">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t(TOPIC_KEYS[state.topic])}</span>
        <span className="gk-stat">
          <span>{t("question")}</span>{" "}
          <strong>
            {t("questionOf", {
              n: Math.min(shownIndex + 1, state.picks.length),
              total: state.picks.length,
            })}
          </strong>
        </span>
        <span className="gk-stat">
          <span>{t("points")}</span> <strong>{state.score}</strong>
        </span>
      </div>
      {over ? (
        <div className="gtv-summary">
          <p className="gk-big" role="status">
            {t("pointsTotal", { n: state.score })}
          </p>
          <p>{t("resultNote", { n: rightCount(state), total: state.picks.length })}</p>
          {puzzle.newBest && <p>{t("newBest")}</p>}
          <ol className="gtv-review">
            {state.picks.map((pick, i) => {
              const q = BANK[state.pack][pick];
              const a = state.answers[i];
              if (!q || !a) return null;
              const chosen = a.choice === null ? null : q.answers[state.orders[i]?.[a.choice] ?? 0];
              return (
                <li key={q.id} data-right={a.right ? "" : undefined}>
                  <p className="gtv-q">{q.question}</p>
                  <p>
                    {a.right
                      ? t("reviewRight", { answer: q.answers[0] ?? "", points: a.points })
                      : chosen === null || chosen === undefined
                        ? t("reviewTimeout", { answer: q.answers[0] ?? "" })
                        : t("reviewWrong", { answer: q.answers[0] ?? "", yours: chosen })}
                  </p>
                </li>
              );
            })}
          </ol>
          {!puzzle.racing && (
            <div className="gk-bar">
              <button
                type="button"
                className="gk-btn"
                data-primary=""
                onClick={() => {
                  begin({ pack: state.pack, topic: state.topic });
                }}
              >
                {t("again")}
              </button>
              <button type="button" className="gk-btn" onClick={puzzle.menu}>
                {t("menu")}
              </button>
            </div>
          )}
        </div>
      ) : count !== null ? (
        <div className="gtv-count">
          <span className="gk-count">{count}</span>
        </div>
      ) : shown ? (
        <>
          <div
            className="gtv-bar"
            role="progressbar"
            aria-label={t("timeLeft")}
            aria-valuemin={0}
            aria-valuemax={LIMIT_MS / 1000}
            aria-valuenow={Math.ceil((reveal === null ? left : 0) / 1000)}
          >
            <span
              style={{
                inlineSize: `${String(reveal === null ? (left / LIMIT_MS) * 100 : 0)}%`,
              }}
            />
          </div>
          <h2 className="gtv-question" aria-live="polite">
            {shown.question.question}
          </h2>
          <div className="gtv-answers" role="group" aria-label={t("answers")}>
            {shown.answers.map((text, i) => {
              const right = order[i] === 0;
              const mark =
                given === null || given === undefined
                  ? undefined
                  : right
                    ? "right"
                    : given.choice === i
                      ? "wrong"
                      : undefined;
              return (
                <button
                  key={text}
                  ref={i === 0 ? firstRef : undefined}
                  type="button"
                  className="gtv-answer"
                  data-mark={mark}
                  aria-disabled={!asking}
                  aria-keyshortcuts={String(i + 1)}
                  onPointerDown={(event) => {
                    if (event.button > 0) return;
                    event.preventDefault();
                    answer(i, event.timeStamp);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      answer(i, event.timeStamp);
                    }
                  }}
                >
                  <span className="gtv-key" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{text}</span>
                </button>
              );
            })}
          </div>
          <p className="gtv-note" role="status">
            {given === null || given === undefined
              ? ""
              : given.right
                ? t("rightPoints", { points: given.points })
                : given.choice === null
                  ? t("timeUp")
                  : t("wrongAnswer")}
          </p>
        </>
      ) : null}
      {playing && !puzzle.racing && !over && (
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

const CSS = `
.gtv { max-width: 36rem; width: 100%; margin-inline: auto; align-content: start; }
.gtv-count { display: grid; place-items: center; min-height: 12rem; }
.gtv-bar { width: 100%; height: 0.6rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.gtv-bar > span { display: block; height: 100%; background: var(--brand); }
.gtv-question { margin: 0; min-height: 3.5rem; font-size: clamp(1.15rem, 4.5vw, 1.5rem); line-height: 1.3; text-align: center; overflow-wrap: anywhere; }
.gtv-answers { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.5rem; width: 100%; }
.gtv-answer { display: flex; align-items: center; gap: 0.6rem; min-height: 3.25rem; padding: 0.5rem 0.75rem; border-radius: 0.85rem; border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font: inherit; font-weight: 600; text-align: start; cursor: pointer; touch-action: manipulation; overflow-wrap: anywhere; }
.gtv-answer[aria-disabled="true"] { cursor: default; }
.gtv-answer:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gtv-answer[data-mark="right"] { border-color: var(--success); background: color-mix(in oklab, var(--success) 18%, var(--surface)); }
.gtv-answer[data-mark="wrong"] { border-color: var(--danger); background: color-mix(in oklab, var(--danger) 14%, var(--surface)); text-decoration: line-through; }
.gtv-key { display: inline-grid; place-items: center; flex: none; width: 1.6rem; height: 1.6rem; border-radius: 0.45rem; background: var(--surface-2); color: var(--text-muted); font-size: 0.85rem; font-variant-numeric: tabular-nums; }
.gtv-note { margin: 0; min-height: 1.5rem; text-align: center; font-weight: 700; }
.gk-btn[data-primary] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.gtv-summary { display: grid; justify-items: center; gap: 0.4rem; width: 100%; text-align: center; }
.gtv-summary > p { margin: 0; }
.gtv-review { display: grid; gap: 0.4rem; width: 100%; margin: 0.5rem 0; padding: 0; list-style: none; text-align: start; }
.gtv-review li { padding: 0.45rem 0.7rem; border-radius: 0.75rem; background: var(--surface-2); border-inline-start: 0.35rem solid var(--danger); }
.gtv-review li[data-right] { border-inline-start-color: var(--success); }
.gtv-review p { margin: 0; font-size: 0.9rem; }
.gtv-review .gtv-q { font-weight: 700; }
`;
