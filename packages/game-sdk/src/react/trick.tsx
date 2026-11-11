// The trick in the middle of a trick-taking game's table (Hearts, Spades,
// Belote, Santase): each card in front of the seat that played it, placed
// around you (you at the bottom), and the winner marked once it's complete.
// Stays left to right in every language, like the table.
import { PlayingCard } from "./cards";

import type { Card } from "../cards";

export interface TrickPlay {
  seat: number;
  card: Card;
}

/** Where each seat sits, seen from `me` (seat 0 when there's no one, as for spectators). */
function place(seat: number, me: number, players: number): string {
  const offset = (seat - me + players) % players;
  if (offset === 0) return "s";
  if (players === 2) return "n";
  if (players === 3) return offset === 1 ? "w" : "e";
  return ["s", "w", "n", "e"][offset] ?? "n";
}

export function TrickArea({
  plays,
  players,
  me,
  winner = null,
  four = false,
  name,
  label,
}: {
  plays: readonly TrickPlay[];
  players: number;
  me: number | null;
  /** The seat that took it, once the trick is complete. */
  winner?: number | null;
  four?: boolean;
  /** "Ana: Queen of hearts", for each card. */
  name: (play: TrickPlay) => string;
  /** "Trick", for the group. */
  label: string;
}) {
  return (
    <div className="gk-trick" role="group" aria-label={label} dir="ltr">
      {plays.map((p) => (
        <div
          key={p.seat}
          className="gk-trick-card"
          data-place={place(p.seat, me ?? 0, players)}
          data-won={winner === p.seat || undefined}
        >
          <PlayingCard card={p.card} four={four} label={name(p)} />
        </div>
      ))}
    </div>
  );
}

/** Styles for TrickArea, with CARD_CSS. */
export const TRICK_CSS = `
.gk-trick { display: grid; grid-template-areas: "w n e" "w s e"; grid-template-columns: repeat(3, var(--card-w, 4rem)); grid-template-rows: repeat(2, auto); column-gap: 0.4rem; row-gap: 0.25rem; justify-content: center; align-items: center; justify-items: center; min-height: calc(var(--card-w, 4rem) * 2.9); }
.gk-trick-card[data-place="n"] { grid-area: n; }
.gk-trick-card[data-place="s"] { grid-area: s; }
.gk-trick-card[data-place="w"] { grid-area: w; }
.gk-trick-card[data-place="e"] { grid-area: e; }
.gk-trick-card { border-radius: 0.45rem; outline: 3px solid transparent; outline-offset: 1px; }
.gk-trick-card[data-won] { outline-color: var(--success); }
`;
