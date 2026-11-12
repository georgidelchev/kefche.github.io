// Sequence Memory: a menu with the best on this device, then four pads in a
// square. The game shows the sequence (each pad lights with its own sound),
// then it's your turn: press the pads in the same order. Each pad has its
// own colour, sound and shape, so colour is never the only cue. Keys 1 to
// 4 press the pads too. A wrong pad ends the game and shows which was
// right. Pausing stops the showing; it starts over when you come back.
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
  SpeedPad,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { engine, score, stepMs } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "classic";
/** Each pad: its colour (fixed in both themes, Okabe–Ito), its sound and its shape. */
const PAD_LOOK = [
  { colour: "#D55E00", sound: "pad0", shape: "M24 6 A18 18 0 1 1 23.9 6 Z" },
  { colour: "#56B4E9", sound: "pad1", shape: "M8 8 H40 V40 H8 Z" },
  { colour: "#009E73", sound: "pad2", shape: "M24 6 L42 40 H6 Z" },
  { colour: "#F0E442", sound: "pad3", shape: "M24 4 L44 24 L24 44 L4 24 Z" },
] as const;
/** Literal keys for each pad's name (its shape and colour, for screen readers). */
const PAD_KEYS = ["pad1", "pad2", "pad3", "pad4"] as const;
/** The pause after the player's last press before the next showing. */
const BETWEEN_MS = 700;

type Phase = "ready" | "show" | "input";

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
  const [phase, setPhase] = useState<Phase>("ready");
  const [lit, setLit] = useState<number | null>(null);
  // When the current phase began (a frame's time), counted in the frame loop.
  const sinceRef = useRef<number | null>(null);
  const shownRef = useRef(-1);
  // When the player last pressed a pad (its event's time), to light it a moment.
  const pressedRef = useRef(0);

  function begin(next: Phase) {
    sinceRef.current = null;
    shownRef.current = -1;
    setLit(null);
    setPhase(next);
  }

  function press(pad: number, at: number) {
    if (!state || !playing || phase !== "input" || handle.paused) return;
    pressedRef.current = at;
    const next = puzzle.dispatch({ pad });
    if (!next) return;
    const look = PAD_LOOK[pad];
    if (look) sounds.play(look.sound);
    setLit(pad);
    if (next.missed !== null) {
      sounds.play("end");
      vibrate(HAPTICS.lose, context.settings.haptics);
      return;
    }
    vibrate(HAPTICS.tap, context.settings.haptics);
    if (next.length > state.length) begin("ready");
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const n = ["1", "2", "3", "4"].indexOf(event.key);
    if (n < 0) return;
    event.preventDefault();
    press(n, event.timeStamp);
  });
  useEffect(() => {
    if (!playing) return;
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  // Each frame: wait, then show the sequence step by step, then hand over.
  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      // The showing starts over on return; a turn in progress just waits.
      if (phase === "show") begin("ready");
      sinceRef.current = time;
      return;
    }
    sinceRef.current ??= time;
    const gone = time - sinceRef.current;
    if (phase === "ready" && gone >= BETWEEN_MS) {
      begin("show");
    } else if (phase === "show") {
      const step = stepMs(state.length);
      const i = Math.floor(gone / step);
      if (i >= state.length) {
        begin("input");
        return;
      }
      // Lit for the first two thirds of each step, dark for the rest.
      const on = gone - i * step < (step * 2) / 3;
      const pad = state.steps[i] ?? 0;
      if (on && shownRef.current !== i) {
        shownRef.current = i;
        const look = PAD_LOOK[pad];
        if (look) sounds.play(look.sound);
      }
      setLit(on ? pad : null);
    } else if (phase === "input" && lit !== null && time - pressedRef.current > 250) {
      // A pressed pad's light fades after a moment.
      setLit(null);
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
          begin("ready");
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const over = puzzle.screen === "over";
  const right = over ? state.steps[state.pos] : undefined;
  return (
    <div className="gk gsm">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("length")}</span> <strong>{state.length}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("bestRun")}</span> <strong>{score(state)}</strong>
        </span>
      </div>
      <p className="gsm-turn" role="status">
        {over
          ? t("over", { n: score(state) })
          : phase === "input"
            ? t("yourTurn", { n: state.length - state.pos })
            : t("watch")}
      </p>
      <div className="gsm-pads" role="group" aria-label={t("padsLabel")}>
        {PAD_LOOK.map((look, pad) => (
          <SpeedPad
            key={look.sound}
            className="gsm-pad"
            // Its name and the key shown in its corner (WCAG 2.5.3).
            label={`${t(PAD_KEYS[pad] ?? "pad1")} ${String(pad + 1)}`}
            disabled={phase !== "input" || over}
            onPress={(at) => {
              press(pad, at);
            }}
            style={{ "--pad": look.colour } as CSSProperties}
          >
            <span
              className="gsm-face"
              data-lit={lit === pad ? "" : undefined}
              data-right={right === pad ? "" : undefined}
              data-wrong={over && state.missed === pad ? "" : undefined}
            >
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path d={look.shape} />
              </svg>
              <kbd aria-hidden="true">{pad + 1}</kbd>
            </span>
          </SpeedPad>
        ))}
      </div>
      {over && puzzle.newBest && <p>{t("newBest")}</p>}
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
  return mountPuzzle(
    container,
    context,
    (seed, handle) => createElement(Game, { context, seed, handle, sounds }),
    () => {
      sounds.dispose();
    },
  );
}

// Pads are their colour, dimmed until lit; lit, they brighten, ring in
// white and grow a little (not with reduced motion). The shapes are dark
// on every colour (at least 4.5:1).
const CSS = `
.gsm { max-width: 32rem; margin-inline: auto; }
.gsm-turn { margin: 0; min-height: 1.5rem; font-weight: 700; text-align: center; }
.gsm-pads { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4%; width: min(100%, calc(100dvh - 11rem), 26rem); aspect-ratio: 1; direction: ltr; }
.gsm-pad { min-height: 0; padding: 0; border: none; background: none; }
.gsm-pad:disabled { cursor: default; }
.gsm-face { position: relative; display: grid; place-items: center; width: 100%; height: 100%; border-radius: 1.25rem; background: var(--pad); filter: brightness(0.55) saturate(0.8); border: 4px solid transparent; transition: filter 80ms, transform 80ms; }
.gsm-face[data-lit] { filter: none; border-color: #ffffff; box-shadow: 0 0 0 4px var(--pad); transform: scale(1.04); }
.gsm-face[data-right] { filter: none; border-color: #ffffff; }
.gsm-face[data-wrong] { filter: brightness(0.4); border-color: var(--danger); border-style: dashed; }
.gsm-face svg { width: 40%; height: 40%; fill: #1d2333; stroke: #ffffff; stroke-width: 3; stroke-linejoin: round; overflow: visible; }
.gsm-face kbd { position: absolute; inset-block-start: 0.5rem; inset-inline-start: 0.6rem; min-width: 1.4rem; padding: 0.1rem 0.35rem; border-radius: 0.4rem; background: #1d2333; color: #ffffff; font-family: inherit; font-weight: 700; font-size: 0.85rem; text-align: center; }
@media (prefers-reduced-motion: reduce) { .gsm-face { transition: none; } .gsm-face[data-lit] { transform: none; } }
`;
