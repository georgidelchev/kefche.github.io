// Dice for the dice games (Phase 12): an SVG die with pips, a short tumble
// when it lands (still under reduced motion), and names for screen readers
// from the site's shared strings, merged into games tagged "dice"
// (context.t("kit.die.…")). Values come from the game's state: online, the
// table rolls them (SPEC §10.6), so nobody can know them in advance.
import type { GameContext } from "../browser/game-module";
import type { CSSProperties } from "react";

export interface DiceText {
  /** "Die showing 5". */
  die: (value: number) => string;
  /** A die not rolled yet. */
  unrolled: string;
}

export function diceText(t: GameContext["t"]): DiceText {
  return {
    die: (value) => t("kit.die.showing", { value }),
    unrolled: t("kit.die.unrolled"),
  };
}

// Pip places on a 3 × 3 grid, by face.
const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

/**
 * One die, 1–6, or 0 for one not rolled yet (drawn blank). `roll` changes
 * whenever the die is thrown again, which replays the tumble. `colour` and
 * `ink` set its face and pips (a seat's --player-n and its ink, say).
 */
export function Die({
  value,
  label,
  roll,
  colour,
  ink,
  dim = false,
  className,
}: {
  value: number;
  /** Its name; leave it out inside a labelled control. */
  label?: string;
  /** Changes on each throw (a move count): the die tumbles once. */
  roll?: number | string;
  colour?: string;
  ink?: string;
  /** Used already (Backgammon's played dice). */
  dim?: boolean;
  className?: string;
}) {
  const style = {
    ...(colour ? { "--die-face": colour } : {}),
    ...(ink ? { "--die-ink": ink } : {}),
  } as CSSProperties;
  return (
    <svg
      // A new key restarts the animation on each throw.
      key={roll}
      viewBox="0 0 40 40"
      className={["gk-die", dim ? "gk-die-dim" : "", className ?? ""].filter(Boolean).join(" ")}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x={1.5} y={1.5} width={37} height={37} rx={8} className="gk-die-face" />
      {(PIPS[value] ?? []).map(([col, row]) => (
        <circle
          key={`${String(col)},${String(row)}`}
          cx={10 + col * 10}
          cy={10 + row * 10}
          r={3.6}
          className="gk-die-pip"
        />
      ))}
    </svg>
  );
}

/** Styles for dice, scoped like KIT_CSS. A die is --die-w wide. */
export const DICE_CSS = `
.gk-die { display: inline-block; width: var(--die-w, 2.75rem); height: var(--die-w, 2.75rem); animation: gk-tumble 420ms cubic-bezier(.2,.8,.3,1.2); }
.gk-die-face { fill: var(--die-face, var(--card-face)); stroke: var(--card-edge); stroke-width: 1.5; }
.gk-die-pip { fill: var(--die-ink, var(--card-ink)); }
.gk-die-dim { opacity: 0.45; }
@keyframes gk-tumble { 0% { transform: rotate(-200deg) scale(0.6); } 70% { transform: rotate(12deg) scale(1.05); } 100% { transform: none; } }
@media (prefers-reduced-motion: reduce) { .gk-die { animation: none; } }
`;
