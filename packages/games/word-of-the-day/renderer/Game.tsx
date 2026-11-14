// Word of the Day: a menu with today's word (the same for everyone, from
// the server) and practice, then six rows of five tiles over the language's
// keyboard. Type a word (on screen or on a keyboard; Bulgarian phonetically
// on a Latin one) and press Enter; each letter is marked by colour and by a
// shape (a bar for the right place, a dot for elsewhere), with its name for
// screen readers.
// - Today's game is kept on this device as it goes, so it carries on after
//   leaving the page and isn't played twice. Finishing it records the
//   player's streak: on the server for an account, on this device for a guest.
// - At the end: the word (and its meaning, when the day has one), a grid to
//   share with no letters in it, the streak, and when the next word comes.
// - In a room's race everyone gets the same practice word from the seed.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { HAPTICS, vibrate, type DailyStreak, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  LayoutSwitch,
  LetterKeyboard,
  LetterTile,
  mountPuzzle,
  shownLetter,
  usePuzzle,
  useTypedKeys,
  WORD_CSS,
  wordText,
  type PuzzleHandle,
  type TileState,
} from "@kefche/game-sdk/react";
import { loadLexicons } from "@kefche/lexicons/browser";

import {
  answerWord,
  configFrom,
  engine,
  LENGTH,
  PACKS,
  refusal,
  scoreOf,
  TRIES,
  type Config,
  type Mark,
  type Pack,
  type Refusal,
  type State,
} from "../engine";
import { manifest } from "../manifest";
import {
  localStreak,
  readDay,
  recordLocal,
  saveDay,
  shareGrid,
  untilNextWord,
  utcToday,
} from "./daily";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => (config.daily ? "daily" : "practice");
/** Literal keys for what a refused guess says. */
const REFUSAL_KEYS: Record<Refusal, string> = {
  length: "tooShort",
  unknown: "unknownWord",
  repeat: "repeatWord",
};
const MARK_KEYS: Record<Mark, string> = { good: "tileGood", near: "tileNear", miss: "tileMiss" };
const RANK: Record<Mark, number> = { miss: 0, near: 1, good: 2 };
/** 1 to TRIES, for the wins by tries. */
const TRY_NUMBERS = Array.from({ length: TRIES }, (_, i) => i + 1);

type Today =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; day: string; word: string; meaning: string | null };

/** How the game ended: solved in so many tries, or the word. */
const resultLine = (s: State, t: GameContext["t"]): string =>
  s.won
    ? t("solvedIn", { n: s.guesses.length, total: TRIES })
    : t("theWordWas", { word: shownLetter(s.pack, s.answer) });

/** Each letter's best mark so far, for the keyboard. */
function keyStates(state: State): Record<string, TileState> {
  const out: Record<string, TileState> = {};
  state.guesses.forEach((guess, g) => {
    Array.from(guess).forEach((ch, i) => {
      const mark = state.marks[g]?.[i];
      const was = out[ch];
      if (mark && (was === undefined || RANK[mark] > RANK[was])) out[ch] = mark;
    });
  });
  return out;
}

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
  const { t, storage } = context;
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
    create: async (s, config) => {
      await loadLexicons(config.pack, manifest.lexicons);
      return engine.initialState(config, s);
    },
    finishNote: (s) => resultLine(s, t),
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  const [today, setToday] = useState<Today>({ status: "loading" });
  const [streak, setStreak] = useState<DailyStreak | null>(null);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<Refusal | null>(null);
  const [shared, setShared] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const restoreRef = useRef<string[]>([]);

  // Today's word, and the player's streak (the server's, or this device's).
  useEffect(() => {
    if (puzzle.racing) return;
    let live = true;
    void (context.daily?.today(pack) ?? Promise.resolve(null)).then((found) => {
      if (!live) return;
      const data = found?.data as { word?: unknown; meaning?: unknown } | undefined;
      const word = answerWord(pack, data?.word);
      setToday(
        found && word
          ? {
              status: "ready",
              day: found.day,
              word,
              meaning: typeof data?.meaning === "string" ? data.meaning : null,
            }
          : { status: "none" },
      );
    });
    void (context.daily?.streak(pack) ?? Promise.resolve(null)).then((server) => {
      if (live) setStreak(server ?? localStreak(storage, pack, utcToday()));
    });
    return () => {
      live = false;
    };
  }, [context.daily, pack, puzzle.racing, storage]);

  // The countdown to the next word, on the menu and at the end.
  useEffect(() => {
    if (playing) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => {
      clearInterval(timer);
    };
  }, [playing]);

  // Today's game carries on from where it was left, once play starts.
  const restore = useEffectEvent(() => {
    const pending = restoreRef.current;
    restoreRef.current = [];
    for (const guess of pending) puzzle.dispatch({ guess });
  });
  useEffect(() => {
    if (playing) restore();
  }, [playing]);

  function start(config: Config, restore: string[] = []) {
    restoreRef.current = restore;
    setTyped("");
    setNote(null);
    setShared(false);
    puzzle.start(config);
  }

  function finishDay(next: State) {
    const day = next.day;
    if (day === null) return;
    const tries = next.guesses.length;
    const local = recordLocal(storage, pack, day, next.won, tries);
    setStreak(local);
    void (context.daily?.finish(next.pack, next.guesses) ?? Promise.resolve(null)).then(
      (server) => {
        if (server) setStreak(server);
      },
    );
  }

  function submit() {
    if (!state || !playing || handle.paused) return;
    const why = typed.length < LENGTH ? "length" : refusal(state, typed);
    if (why) {
      setNote(why);
      sounds.play("refused");
      vibrate(HAPTICS.hit, context.settings.haptics);
      return;
    }
    const next = puzzle.dispatch({ guess: typed });
    if (!next) return;
    setTyped("");
    setNote(null);
    if (next.day !== null)
      saveDay(storage, next.pack, next.day, { guesses: next.guesses, over: next.over });
    if (next.over) {
      sounds.play(next.won ? "win" : "lose");
      finishDay(next);
    } else {
      sounds.play("guess");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }

  function letter(ch: string) {
    if (!playing || handle.paused) return;
    setNote(null);
    setTyped((v) => (Array.from(v).length < LENGTH ? v + ch : v));
  }
  function backspace() {
    if (!playing || handle.paused) return;
    setNote(null);
    setTyped((v) => Array.from(v).slice(0, -1).join(""));
  }
  useTypedKeys(
    state?.pack ?? pack,
    { onLetter: letter, onEnter: submit, onBackspace: backspace },
    playing,
  );

  const nextIn = untilNextWord(now);
  const nextWord = t("nextWord", {
    h: Math.floor(nextIn / 3_600_000),
    m: Math.floor((nextIn % 3_600_000) / 60_000),
  });

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    const saved = today.status === "ready" ? readDay(storage, pack, today.day) : null;
    return (
      <div className="gk gwd">
        <style>{KIT_CSS + WORD_CSS + CSS}</style>
        <h2 className="gwd-title">{t("chooseGame")}</h2>
        {puzzle.screen === "failed" && <p role="alert">{t("loadFailed")}</p>}
        <div className="gwd-choices">
          {today.status === "loading" ? (
            <p className="gwd-muted" aria-busy="true">
              {t("loadingToday")}
            </p>
          ) : today.status === "none" ? (
            <p className="gwd-muted">{t("noWordToday")}</p>
          ) : saved?.over ? (
            <div className="gwd-done" role="status">
              <p>{t("doneToday")}</p>
              <p className="gwd-muted">{nextWord}</p>
            </div>
          ) : (
            <button
              type="button"
              className="gk-choice"
              onClick={() => {
                start({ pack, daily: { day: today.day, word: today.word } }, saved?.guesses ?? []);
              }}
            >
              {t("todaysWord")}
              <span>
                {saved && saved.guesses.length > 0
                  ? t("continueDetail", { n: saved.guesses.length })
                  : t("todaysWordDetail")}
              </span>
            </button>
          )}
          <button
            type="button"
            className="gk-choice"
            onClick={() => {
              start({ pack });
            }}
          >
            {t("practice")}
            <span>{t("practiceDetail")}</span>
          </button>
        </div>
        {streak && streak.played > 0 && <Stats streak={streak} t={t} />}
      </div>
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
  const daily = state.day !== null;
  const meaning =
    daily && today.status === "ready" && today.day === state.day ? today.meaning : null;
  const keys = keyStates(state);
  const shareText = () => {
    const score = state.won ? String(state.guesses.length) : "X";
    const title = daily
      ? t("shareDaily", { day: state.day ?? "", score })
      : t("sharePractice", { score });
    return `${title}\n${shareGrid(state.marks)}`;
  };
  /** Phones and tablets open their share sheet; elsewhere the text is copied. */
  async function share() {
    const body = shareText();
    try {
      if (typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text: body });
      } else {
        await navigator.clipboard.writeText(body);
        setShared(true);
      }
    } catch {
      // Cancelled, or the clipboard is off: nothing to say.
    }
  }

  return (
    <div className="gk gwd">
      <style>{KIT_CSS + WORD_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{daily ? t("todaysWord") : t("practice")}</span>
        <span className="gk-stat">
          {t("guessOf", {
            n: Math.min(state.guesses.length + (over ? 0 : 1), TRIES),
            total: TRIES,
          })}
        </span>
      </div>
      <ol className="gwd-board" lang={state.pack} aria-label={t("board")}>
        {Array.from({ length: TRIES }, (_, row) => {
          const guess = state.guesses[row];
          const marks = state.marks[row];
          const current = !over && row === state.guesses.length;
          const letters = Array.from(guess ?? (current ? typed : ""));
          return (
            <li
              key={row}
              className="gwd-row"
              data-current={current ? "" : undefined}
              data-refused={current && note ? "" : undefined}
              aria-label={t("guessN", { n: row + 1 })}
            >
              {Array.from({ length: LENGTH }, (_, i) => {
                const ch = letters[i];
                const mark = marks?.[i];
                const shown = ch ? shownLetter(state.pack, ch) : undefined;
                return (
                  <LetterTile
                    key={i}
                    lang={state.pack}
                    letter={ch}
                    state={mark}
                    label={
                      shown ? (mark ? t(MARK_KEYS[mark], { letter: shown }) : shown) : undefined
                    }
                  />
                );
              })}
            </li>
          );
        })}
      </ol>
      <p className="gwd-note" role="status">
        {note ? t(REFUSAL_KEYS[note]) : ""}
      </p>
      {over ? (
        <div className="gwd-end">
          <p className="gwd-result" role="status">
            {resultLine(state, t)}
          </p>
          {meaning && (
            <p className="gwd-meaning" lang={state.pack}>
              <strong>{shownLetter(state.pack, state.answer)}</strong> {meaning}
            </p>
          )}
          <div className="gk-bar">
            <button
              type="button"
              className="gk-btn"
              onClick={() => {
                void share();
              }}
            >
              {t("share")}
            </button>
            {!puzzle.racing && (
              <button
                type="button"
                className="gk-btn"
                onClick={() => {
                  start({ pack: state.pack });
                }}
              >
                {daily ? t("practice") : t("playAgain")}
              </button>
            )}
            {!puzzle.racing && (
              <button type="button" className="gk-btn" onClick={puzzle.menu}>
                {t("menu")}
              </button>
            )}
          </div>
          <p className="gwd-muted" role="status">
            {shared ? t("shared") : ""}
          </p>
          {daily && streak && <Stats streak={streak} t={t} />}
          {daily && <p className="gwd-muted">{nextWord}</p>}
          {!daily && !puzzle.racing && scoreOf(state) > 0 && puzzle.newBest && (
            <p>{t("newBest")}</p>
          )}
        </div>
      ) : (
        <>
          <LetterKeyboard
            lang={state.pack}
            text={text}
            states={keys}
            label={(ch, mark) =>
              mark
                ? t(MARK_KEYS[mark], { letter: shownLetter(state.pack, ch) })
                : shownLetter(state.pack, ch)
            }
            onLetter={letter}
            onEnter={submit}
            onBackspace={backspace}
          />
          <LayoutSwitch lang={state.pack} text={text} />
          {!puzzle.racing && (
            <button type="button" className="gk-btn" onClick={puzzle.menu}>
              {t("menu")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** The streak: games played, the share won, days in a row, and wins by tries. */
function Stats({ streak, t }: { streak: DailyStreak; t: GameContext["t"] }) {
  const most = Math.max(1, ...streak.spread);
  const rate = streak.played === 0 ? 0 : Math.round((streak.won / streak.played) * 100);
  return (
    <section className="gwd-stats" aria-label={t("statsTitle")}>
      <dl className="gwd-numbers">
        <div>
          <dt>{t("played")}</dt>
          <dd>{streak.played}</dd>
        </div>
        <div>
          <dt>{t("won")}</dt>
          <dd>{t("percent", { n: rate })}</dd>
        </div>
        <div>
          <dt>{t("streak")}</dt>
          <dd>{streak.current}</dd>
        </div>
        <div>
          <dt>{t("bestStreak")}</dt>
          <dd>{streak.best}</dd>
        </div>
      </dl>
      <p className="gwd-spread-title">{t("spreadTitle")}</p>
      <ol className="gwd-spread">
        {TRY_NUMBERS.map((tries) => {
          const n = streak.spread[tries - 1] ?? 0;
          return (
            <li key={tries} aria-label={t("spreadRow", { tries, n })}>
              <span aria-hidden="true">{tries}</span>
              <span
                className="gwd-bar"
                aria-hidden="true"
                style={{ inlineSize: `${String(Math.max(8, (n / most) * 100))}%` }}
              >
                {n}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
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
.gwd { max-width: 34rem; margin-inline: auto; --tile-w: min(3.4rem, 15vw); }
.gwd-title { margin: 0; font-size: 1.25rem; }
.gwd-choices { display: grid; gap: 0.6rem; width: 100%; max-width: 24rem; }
.gwd-muted { margin: 0; color: var(--text-muted); text-align: center; }
.gwd-done { display: grid; gap: 0.25rem; padding: 0.75rem 1rem; border-radius: 0.75rem; background: var(--surface-2); text-align: center; }
.gwd-done p { margin: 0; }
.gwd-board { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; direction: ltr; }
.gwd-row { display: flex; gap: 0.35rem; justify-content: center; }
@media (prefers-reduced-motion: no-preference) {
  .gwd-row[data-refused] { animation: gwd-shake 0.3s; }
}
@keyframes gwd-shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.gwd-note { margin: 0; min-height: 1.5rem; font-weight: 600; text-align: center; }
.gwd-end { display: grid; justify-items: center; gap: 0.6rem; width: 100%; }
.gwd-result { margin: 0; font-size: 1.35rem; font-weight: 800; text-align: center; }
.gwd-meaning { margin: 0; max-width: 28rem; text-align: center; }
.gwd-stats { display: grid; gap: 0.5rem; width: 100%; max-width: 24rem; }
.gwd-numbers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.4rem; margin: 0; text-align: center; }
.gwd-numbers dt { font-size: 0.8rem; color: var(--text-muted); }
.gwd-numbers dd { margin: 0; font-size: 1.4rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.gwd-spread-title { margin: 0; font-weight: 700; }
.gwd-spread { display: grid; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.gwd-spread li { display: grid; grid-template-columns: 1.2rem 1fr; align-items: center; gap: 0.4rem; font-variant-numeric: tabular-nums; }
.gwd-bar { display: block; min-inline-size: 1.6rem; padding-inline: 0.4rem; border-radius: 0.3rem; background: var(--tile-miss); color: var(--tile-miss-ink); text-align: end; font-weight: 700; }
`;
