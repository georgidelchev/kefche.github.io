// Morse Master: a menu of the two tasks with the best of each on this
// device (and the code chart, to learn from), a 3-2-1 countdown, then 60
// seconds of letters.
// - Read: the letter's code is drawn and played as tones; tap its letter
//   on the on-screen keyboard or type it (Bulgarian phonetically on a Latin
//   keyboard). "Play again" repeats the tones.
// - Send: the letter is shown; key its code with the dot and dash keys (or
//   "." and "-"). Each symbol sounds as it's keyed, and the code is judged
//   as soon as it's complete or goes wrong.
// After each answer the next letter shows at once with a note on the last
// one; after a wrong one, the keys rest for a second. The clock starts on
// the frame that draws the first letter. Pausing starts the run over after
// the countdown.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  LayoutSwitch,
  LetterKeyboard,
  mountPuzzle,
  PuzzleMenu,
  shownLetter,
  SPEED_CSS,
  useCountdown,
  usePuzzle,
  useStimulus,
  useTypedKeys,
  WORD_CSS,
  wordText,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  codeOf,
  configFrom,
  DURATION_MS,
  engine,
  lettersIn,
  PACKS,
  TASKS,
  WRONG_PAUSE_MS,
  type Config,
  type Pack,
  type Task,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";
import { createKeyer, type Keyer } from "./tones";

const timeKey = (config: Config) => `${config.pack}-${config.task}`;
/** Literal keys for the tasks' names and descriptions. */
const TASK_KEYS: Record<Task, { name: string; detail: string }> = {
  read: { name: "taskRead", detail: "taskReadDetail" },
  send: { name: "taskSend", detail: "taskSendDetail" },
};

/** A code drawn as dots and dashes, named for screen readers. */
function Code({ code, label, big }: { code: string; label: string; big?: boolean }) {
  return (
    <span className={big ? "gmm-code gmm-big" : "gmm-code"} role="img" aria-label={label} dir="ltr">
      {/* Each symbol keyed by the code up to it, which is unique. */}
      {Array.from(code, (_, i) => code.slice(0, i + 1)).map((upTo) => (
        <span
          key={upTo}
          className={upTo.endsWith("-") ? "gmm-dash" : "gmm-dot"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** Every letter of a pack with its code, to learn from (never during a run). */
function Chart({
  pack,
  t,
  spoken,
}: {
  pack: Pack;
  t: GameContext["t"];
  spoken: (c: string) => string;
}) {
  return (
    <details className="gmm-chart">
      <summary>{t("chart")}</summary>
      <dl lang={pack}>
        {lettersIn(pack).map((letter) => (
          <div key={letter}>
            <dt>{shownLetter(pack, letter)}</dt>
            <dd>
              <Code code={codeOf(pack, letter)} label={spoken(codeOf(pack, letter))} />
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Game({
  context,
  seed,
  handle,
  sounds,
  keyer,
}: {
  context: GameContext;
  seed: string;
  handle: PuzzleHandle;
  sounds: Sounds;
  keyer: Keyer;
}) {
  const { t } = context;
  const pack: Pack = PACKS.find((p) => context.locale.startsWith(p)) ?? "en";
  const text = wordText(t);
  const puzzle = usePuzzle({
    context,
    seed,
    handle,
    engine,
    raceConfig: configFrom,
    timeKey,
    best: { order: "desc" },
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  const [run, setRun] = useState(0);
  const [live, setLive] = useState(false);
  const [held, setHeld] = useState(false);
  const [keyed, setKeyed] = useState("");
  const [resting, setResting] = useState(false);
  const [now, setNow] = useState(0);
  const count = useCountdown(playing && !live && !held ? run : null, 3, () => {
    setLive(true);
  });
  const clock = useStimulus(playing && live ? run : null);

  const spoken = (code: string) =>
    Array.from(code)
      .map((s) => (s === "-" ? t("dash") : t("dot")))
      .join(" ");

  function restart() {
    keyer.stop();
    setLive(false);
    setRun((r) => r + 1);
    setKeyed("");
    setResting(false);
    setNow(0);
  }

  const letter = state?.letters[state.index] ?? "";
  const code = state ? codeOf(state.pack, letter) : "";
  const active = !!state && playing && live && !resting;

  // Read: play each new letter's code as it appears.
  useEffect(() => {
    if (state?.task === "read" && playing && live && code !== "") keyer.play(code);
  }, [state?.task, state?.index, playing, live, code, keyer]);
  useEffect(() => {
    if (!playing) keyer.stop();
  }, [playing, keyer]);

  // After a wrong answer the keys rest, as the engine ignores answers then.
  useEffect(() => {
    if (!resting) return;
    const timer = setTimeout(() => {
      setResting(false);
    }, WRONG_PAUSE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [resting]);

  function answer(given: string, at: number) {
    if (!state || !active || handle.paused) return;
    const ms = clock.since(at);
    if (ms === null) return;
    const next = puzzle.dispatch({ answer: given, ms: Math.min(ms, DURATION_MS - 1) });
    if (!next) return;
    setKeyed("");
    const right = next.right > state.right;
    sounds.play(right ? "right" : "wrong");
    vibrate(right ? HAPTICS.tap : HAPTICS.hit, context.settings.haptics);
    if (!right) {
      keyer.stop();
      setResting(true);
    }
  }

  /** Send: one more symbol, judged once the code is complete or wrong. */
  function key(symbol: "." | "-", at: number) {
    if (state?.task !== "send" || !active || handle.paused) return;
    const sofar = keyed + symbol;
    keyer.play(symbol);
    if (sofar === code || !code.startsWith(sofar)) answer(sofar, at);
    else setKeyed(sofar);
  }

  useTypedKeys(
    state?.pack ?? pack,
    {
      onLetter: (l) => {
        answer(l, performance.now());
      },
    },
    playing && state?.task === "read",
  );
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.key === ".") key(".", event.timeStamp);
    else if (event.key === "-") key("-", event.timeStamp);
    else return;
    event.preventDefault();
  });
  useEffect(() => {
    if (!playing || state?.task !== "send") return;
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [playing, state?.task]);

  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      if (!held) {
        setHeld(true);
        if (state.index > 0) puzzle.start(configFrom({ pack: state.pack, task: state.task }));
        restart();
      }
      return;
    }
    if (held) setHeld(false);
    if (!live) return;
    const ms = clock.since(time) ?? 0;
    if (Math.floor(ms / 250) !== Math.floor(now / 250)) setNow(ms);
    if (ms >= DURATION_MS) {
      const next = puzzle.dispatch({ stop: true });
      if (next) {
        keyer.stop();
        sounds.play("end");
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
      <div className="gk gmm">
        <style>{KIT_CSS + CSS}</style>
        <PuzzleMenu
          title={t("chooseTask")}
          choices={TASKS.map((task) => ({
            config: { pack, task },
            label: t(TASK_KEYS[task].name),
            detail: t(TASK_KEYS[task].detail),
          }))}
          storage={context.storage}
          timeKey={timeKey}
          bestLabel={t("best", { n: "{time}" })}
          formatBest={(n) => t("best", { n })}
          onPick={(config) => {
            restart();
            puzzle.start(config);
          }}
        />
        <Chart pack={pack} t={t} spoken={spoken} />
      </div>
    );
  }
  if (!state) return null;
  const over = puzzle.screen === "over";
  const prev = state.answers.at(-1);
  const prevLetter = state.letters[state.index - 1] ?? "";
  const prevCode = codeOf(state.pack, prevLetter);
  const left = Math.max(0, DURATION_MS - now);
  const shown = shownLetter(state.pack, letter);
  return (
    <div className="gk gmm">
      <style>{KIT_CSS + WORD_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t(TASK_KEYS[state.task].name)}</span>
        <span className="gk-stat">
          <span>{t("right")}</span> <strong>{state.right}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("timeLeft")}</span>{" "}
          <strong>{t("seconds", { s: Math.ceil(left / 1000) })}</strong>
        </span>
      </div>
      {over ? (
        <>
          <div className="gmm-summary" role="status">
            <p className="gk-big">{t("rightTotal", { n: state.right })}</p>
            <p>{t("wrongTotal", { n: state.wrong })}</p>
            {puzzle.newBest && <p>{t("newBest")}</p>}
          </div>
          <Chart pack={state.pack} t={t} spoken={spoken} />
        </>
      ) : (
        <>
          <div
            className="gmm-bar"
            role="progressbar"
            aria-label={t("timeLeft")}
            aria-valuemin={0}
            aria-valuemax={DURATION_MS / 1000}
            aria-valuenow={Math.ceil(left / 1000)}
          >
            <span style={{ inlineSize: `${String((left / DURATION_MS) * 100)}%` }} />
          </div>
          <div className="gmm-stage" lang={state.pack}>
            {count !== null ? (
              <span className="gk-count">{count}</span>
            ) : state.task === "read" ? (
              <Code code={code} label={t("codeIs", { code: spoken(code) })} big />
            ) : (
              <>
                <span
                  className="gmm-letter"
                  role="img"
                  aria-label={t("keyLetter", { letter: shown })}
                >
                  {shown}
                </span>
                <span className="gmm-keyed">
                  {keyed === "" ? (
                    <span className="gmm-hint">{t("keyHint")}</span>
                  ) : (
                    <Code code={keyed} label={t("keyedSoFar", { code: spoken(keyed) })} />
                  )}
                </span>
              </>
            )}
          </div>
          <p className="gmm-last" role="status">
            {prev && prevLetter
              ? t(prev.right ? "wasRight" : "wasWrong", {
                  letter: shownLetter(state.pack, prevLetter),
                  code: spoken(prevCode),
                })
              : ""}
          </p>
          {prev && !prev.right && prevLetter ? (
            <p className="gmm-fix" aria-hidden="true" lang={state.pack}>
              <strong>{shownLetter(state.pack, prevLetter)}</strong>{" "}
              <Code code={prevCode} label="" />
            </p>
          ) : null}
          {state.task === "read" ? (
            <>
              <button
                type="button"
                className="gk-btn"
                disabled={count !== null}
                onClick={() => {
                  keyer.play(code);
                }}
              >
                {t("playAgain")}
              </button>
              <LetterKeyboard
                lang={state.pack}
                text={text}
                disabled={!active}
                onLetter={(l) => {
                  answer(l, performance.now());
                }}
              />
              <LayoutSwitch lang={state.pack} text={text} />
            </>
          ) : (
            <div className="gmm-keys" role="group" aria-label={t("morseKey")}>
              {["." as const, "-" as const].map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  className="gk-btn gmm-key"
                  disabled={!active}
                  aria-label={symbol === "." ? t("dot") : t("dash")}
                  onPointerDown={(event) => {
                    if (event.button > 0) return;
                    event.preventDefault();
                    key(symbol, event.timeStamp);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!event.repeat) key(symbol, event.timeStamp);
                    }
                  }}
                >
                  <span className={symbol === "-" ? "gmm-dash" : "gmm-dot"} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {playing && !puzzle.racing && (
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
  const keyer = createKeyer(() => context.settings.volume);
  return mountPuzzle(
    container,
    context,
    (seed, handle) => createElement(Game, { context, seed, handle, sounds, keyer }),
    () => {
      sounds.dispose();
      keyer.dispose();
    },
  );
}

const CSS = `
.gmm { max-width: 34rem; margin-inline: auto; }
.gmm-bar { width: 100%; height: 0.6rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.gmm-bar > span { display: block; height: 100%; background: var(--brand); }
.gmm-stage { display: grid; justify-items: center; align-content: center; gap: 0.6rem; min-height: 8.5rem; }
.gmm-code { display: inline-flex; align-items: center; gap: 0.4em; font-size: 1rem; }
.gmm-big { font-size: clamp(1.6rem, 8vw, 2.4rem); }
.gmm-dot, .gmm-dash { display: inline-block; height: 0.6em; border-radius: 999px; background: currentColor; }
.gmm-dot { width: 0.6em; }
.gmm-dash { width: 1.8em; }
.gmm-letter { font-size: clamp(3rem, 14vw, 4.5rem); font-weight: 800; line-height: 1; }
.gmm-keyed { display: grid; place-items: center; min-height: 2rem; font-size: 1.4rem; }
.gmm-hint { font-size: 0.95rem; color: var(--text-muted); }
.gmm-last { margin: 0; min-height: 1.5rem; color: var(--text-muted); text-align: center; }
.gmm-fix { display: inline-flex; align-items: center; gap: 0.6rem; margin: 0; padding: 0.3rem 0.8rem; border-radius: 0.6rem; background: var(--surface-2); font-size: 1.2rem; }
.gmm-keys { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; width: min(100%, 22rem); direction: ltr; }
.gmm-key { display: grid; place-items: center; min-height: 5rem; font-size: 2rem; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.gmm-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.gmm-summary p { margin: 0; }
.gmm-chart { width: 100%; }
.gmm-chart summary { cursor: pointer; font-weight: 700; padding: 0.4rem 0; }
.gmm-chart dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr)); gap: 0.35rem; margin: 0.4rem 0 0; }
.gmm-chart dl > div { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0.6rem; border-radius: 0.5rem; background: var(--surface-2); }
.gmm-chart dt { min-width: 1.2em; font-weight: 800; }
.gmm-chart dd { margin: 0; }
`;
