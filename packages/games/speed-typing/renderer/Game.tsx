// Speed Typing: a menu of lengths with the best of each on this device,
// then the passage and a box to type it in. The clock starts with the first
// key. Each word shows letter by letter as it's typed (right, wrong, still
// to come); a word is done when it's typed exactly with its space (the last
// needs no space). Phone punctuation (curly quotes, long dashes) counts as
// the plain kind, and Bulgarian types phonetically on a Latin keyboard.
// Pasting does nothing; paused time doesn't count.
import {
  createElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { charsOf, foldWord, isLetter, letterFromKey } from "@kefche/game-sdk";
import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  usePuzzle,
  WORD_CSS,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  accuracy,
  charsDone,
  configFrom,
  engine,
  finished,
  LENGTHS,
  MAX_MS,
  PACKS,
  PASSAGES,
  wpm,
  type Config,
  type Length,
  type Pack,
  type State,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => `${config.pack}-${config.length}`;
const LENGTH_KEYS: Readonly<Record<Length, readonly [string, string]>> = {
  short: ["lengthShort", "shortDetail"],
  long: ["lengthLong", "longDetail"],
};

/** Phone keyboards' typographic punctuation, as the plain characters the texts use. */
const PLAIN = new Map<number, string>([
  // Single quotes and the prime, as an apostrophe.
  ...[0x2018, 0x2019, 0x201b, 0x2032].map((c) => [c, "'"] as const),
  // Double quotes, low and high.
  ...[0x201c, 0x201d, 0x201e, 0x2033].map((c) => [c, '"'] as const),
  // Hyphens and dashes.
  ...[0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015].map((c) => [c, "-"] as const),
  [0x2026, "..."],
  // A no-break space.
  [0x00a0, " "],
]);

export const plain = (raw: string): string =>
  charsOf(raw)
    .map((ch) => PLAIN.get(ch.codePointAt(0) ?? 0) ?? ch)
    .join("");

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
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  const [typed, setTyped] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const typosRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const pausedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const target = state?.words[state.done] ?? "";
  const lastWord = !!state && state.done === state.words.length - 1;

  /** The box's new text, typed at `at` (an event's time). */
  function input(raw: string, at: number) {
    if (!state || !playing || handle.paused) return;
    const value = plain(raw);
    startRef.current ??= at;
    const expected = lastWord ? target : `${target} `;
    if (charsOf(value).length > charsOf(typed).length && !expected.startsWith(value)) {
      typosRef.current++;
      sounds.play("miss");
    }
    if (value !== expected) {
      setTyped(value);
      return;
    }
    const ms = Math.round(at - startRef.current - pausedRef.current);
    const next = puzzle.dispatch({
      word: target,
      ms: Math.max(0, Math.min(ms, MAX_MS)),
      typos: Math.min(typosRef.current, 99),
    });
    if (!next) {
      // Faster than anyone types (a keyboard's autocomplete): type the space again.
      setTyped(target);
      return;
    }
    typosRef.current = 0;
    setTyped("");
    if (next.over) sounds.play("end");
    else vibrate(HAPTICS.tap, context.settings.haptics);
  }

  /** A keyboard without the language's letters types them phonetically (A gives А). */
  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!state || state.pack === "en") return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;
    if (charsOf(event.key).length !== 1 || isLetter(state.pack, foldWord(state.pack, event.key))) {
      return;
    }
    const letter = letterFromKey(state.pack, event.key, event.code);
    if (letter === null) return;
    event.preventDefault();
    const el = event.currentTarget;
    const ch = event.shiftKey ? letter.toLocaleUpperCase(state.pack) : letter;
    const from = el.selectionStart ?? el.value.length;
    const to = el.selectionEnd ?? from;
    input(el.value.slice(0, from) + ch + el.value.slice(to), event.timeStamp);
  }

  // Phones shrink the visual viewport for their keyboard; keep the box in it.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onResize = () => {
      if (document.activeElement === inputRef.current) {
        inputRef.current?.scrollIntoView({ block: "nearest" });
      }
    };
    viewport.addEventListener("resize", onResize);
    return () => {
      viewport.removeEventListener("resize", onResize);
    };
  }, []);
  useEffect(() => {
    if (playing) inputRef.current?.focus({ preventScroll: true });
  }, [playing]);

  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    const lastFrame = lastFrameRef.current;
    lastFrameRef.current = time;
    if (handle.paused) {
      if (lastFrame !== null) pausedRef.current += time - lastFrame;
      return;
    }
    const start = startRef.current;
    if (start === null) return;
    const ms = time - start - pausedRef.current;
    if (Math.floor(ms / 250) !== Math.floor(elapsed / 250)) setElapsed(ms);
    if (ms >= MAX_MS && puzzle.dispatch({ stop: true })) sounds.play("end");
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
        title={t("chooseLength")}
        choices={LENGTHS.map((length) => ({
          config: { pack, length },
          label: t(LENGTH_KEYS[length][0]),
          detail: t(LENGTH_KEYS[length][1]),
        }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best", { n: "{time}" })}
        formatBest={(n) => t("best", { n })}
        {...(puzzle.screen === "failed" ? { failed: t("loadFailed") } : {})}
        onPick={(config) => {
          startRef.current = null;
          pausedRef.current = 0;
          lastFrameRef.current = null;
          typosRef.current = 0;
          setTyped("");
          setElapsed(0);
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
  const live = wpm(charsDone(state), Math.max(elapsed, state.last));
  const source = PASSAGES[state.pack][state.passage]?.source;
  return (
    <div className="gk gst">
      <style>{KIT_CSS + WORD_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("wpm")}</span>{" "}
          <strong>{over ? (finished(state) ? wpm(charsDone(state), state.last) : 0) : live}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("accuracy")}</span> <strong>{t("percent", { n: accuracy(state) })}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("words")}</span>{" "}
          <strong>{t("wordsOf", { n: state.done, total: state.words.length })}</strong>
        </span>
      </div>
      {over ? (
        <Summary context={context} state={state} newBest={puzzle.newBest} source={source} />
      ) : (
        <>
          <p className="gst-text" lang={state.pack} dir="ltr" aria-label={t("textLabel")}>
            {state.words.map((word, i) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- a word's place in the text
              <span key={i}>
                {i < state.done ? (
                  <span className="gst-done">{word}</span>
                ) : i === state.done ? (
                  <Current word={word} typed={typed} />
                ) : (
                  <span className="gst-todo">{word}</span>
                )}{" "}
              </span>
            ))}
          </p>
          <input
            ref={inputRef}
            className="gk-input gst-input"
            type="text"
            lang={state.pack}
            dir="ltr"
            value={typed}
            aria-label={t("typeHere")}
            aria-invalid={!(lastWord ? target : `${target} `).startsWith(typed)}
            placeholder={state.done === 0 && typed === "" ? t("startTyping") : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            onKeyDown={onKeyDown}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              input(event.currentTarget.value, event.timeStamp);
            }}
            onPaste={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
            }}
          />
          <p className="gst-source">{source ? t("from", { source }) : t("original")}</p>
        </>
      )}
    </div>
  );
}

/** The word being typed, letter by letter: right, wrong, and still to come. */
function Current({ word, typed }: { word: string; typed: string }) {
  const want = charsOf(word);
  const got = charsOf(typed);
  return (
    <span className="gst-now">
      {want.map((ch, i) => (
        <span
          // eslint-disable-next-line @eslint-react/no-array-index-key -- a letter's place in the word
          key={i}
          data-state={
            got[i] === undefined
              ? i === got.length
                ? "caret"
                : undefined
              : got[i] === ch
                ? "ok"
                : "bad"
          }
        >
          {ch}
        </span>
      ))}
      {got.length > want.length && <span data-state="bad">{got.slice(want.length).join("")}</span>}
    </span>
  );
}

function Summary({
  context,
  state,
  newBest,
  source,
}: {
  context: GameContext;
  state: State;
  newBest: boolean;
  source: string | undefined;
}) {
  const { t } = context;
  const done = finished(state);
  return (
    <div className="gst-summary" role="status">
      {done ? (
        <>
          <p className="gk-big">{t("wpmTotal", { n: wpm(charsDone(state), state.last) })}</p>
          <p>
            {t("accuracyTotal", { n: accuracy(state) })} ·{" "}
            {t("timeTotal", { s: (state.last / 1000).toFixed(1) })}
          </p>
          {newBest && <p>{t("newBest")}</p>}
        </>
      ) : (
        <p>{t("unfinished")}</p>
      )}
      <p className="gst-source">{source ? t("from", { source }) : t("original")}</p>
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
.gst { max-width: 40rem; margin-inline: auto; }
.gst-text { margin: 0; padding: 0.9rem 1rem; border-radius: 0.9rem; background: var(--surface); border: 1px solid var(--border); font-size: 1.2rem; line-height: 1.75; text-align: start; overflow-wrap: anywhere; }
.gst-done { color: var(--text-muted); }
.gst-todo { color: var(--text); }
.gst-now { border-radius: 0.25rem; background: var(--surface-2); box-shadow: 0 0 0 2px var(--surface-2); }
.gst-now [data-state="ok"] { color: var(--success); }
.gst-now [data-state="bad"] { color: var(--danger); background: color-mix(in srgb, var(--danger) 18%, transparent); text-decoration: underline wavy; }
.gst-now [data-state="caret"] { box-shadow: inset 0 -3px 0 var(--brand); }
.gst-input { width: 100%; max-width: none; font-size: 1.15rem; }
.gst-input[aria-invalid="true"] { border-color: var(--danger); }
.gst-source { margin: 0; color: var(--text-muted); font-size: 0.9rem; text-align: center; }
.gst-summary { display: grid; justify-items: center; gap: 0.4rem; text-align: center; }
.gst-summary p { margin: 0; }
`;
