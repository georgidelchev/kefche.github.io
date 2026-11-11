// A card table's layout for the card games (Phase 12): the other players
// along the top, each with their name, the cards they hold (face down, the
// count is what you may know) and a mark when it's their turn; the play
// area in the middle; your hand and the game's buttons at the bottom. It
// fits a 360 px phone with up to eight players, and stays left to right in
// every language, like the boards.
import { seatStyle } from "./seat";

import type { ReactNode } from "react";

export interface TableSeat {
  seat: number;
  name: string;
  /** Cards held, or null when the game doesn't show a hand (Klondike). */
  cards: number | null;
  /** Their turn now. */
  active: boolean;
  /** Anything else the game shows for them: a score, a bid, "Out". */
  detail?: ReactNode;
}

export function CardTable({
  others,
  center,
  you,
  hand,
  bar,
  label,
}: {
  /** The other seats, in playing order starting after yours. */
  others: readonly TableSeat[];
  center: ReactNode;
  /** Your own line above your hand (name, score), when you have a seat. */
  you?: TableSeat | null;
  hand?: ReactNode;
  bar?: ReactNode;
  /** "Players", for the list of seats. */
  label: string;
}) {
  return (
    <div className="gk gk-table" dir="ltr">
      <ul className="gk-seats" aria-label={label}>
        {others.map((s) => (
          <SeatLine key={s.seat} s={s} />
        ))}
      </ul>
      <div className="gk-center">{center}</div>
      {you && (
        <ul className="gk-seats gk-you">
          <SeatLine s={you} />
        </ul>
      )}
      {hand}
      {bar !== undefined && bar !== null && bar !== false && <div className="gk-bar">{bar}</div>}
    </div>
  );
}

function SeatLine({ s }: { s: TableSeat }) {
  return (
    <li className="gk-seat" style={seatStyle(s.seat)} aria-current={s.active ? "true" : undefined}>
      <strong>{s.name}</strong>
      {s.cards !== null && (
        <span className="gk-count" aria-hidden="true">
          <span className="gk-mini" />
          {s.cards}
        </span>
      )}
      {s.detail !== undefined && <span className="gk-detail">{s.detail}</span>}
    </li>
  );
}

/** Styles for CardTable, with KIT_CSS and CARD_CSS. */
export const TABLE_CSS = `
.gk-table { max-width: 40rem; margin-inline: auto; align-content: start; }
.gk-seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem; margin: 0; padding: 0; list-style: none; width: 100%; }
.gk-seat { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 2.25rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: var(--surface-2); border: 2px solid transparent; border-inline-start: 0.4rem solid var(--fill); font-size: 0.875rem; max-width: 100%; }
.gk-seat strong { max-width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gk-seat[aria-current="true"] { border-color: var(--text); }
.gk-count { display: inline-flex; align-items: center; gap: 0.2rem; font-variant-numeric: tabular-nums; color: var(--text-muted); }
.gk-mini { display: inline-block; width: 0.7rem; height: 1rem; border-radius: 0.15rem; background: var(--card-back); border: 1px solid var(--card-edge); }
.gk-detail { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.gk-center { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; min-height: calc(var(--card-w, 4rem) * 1.7); }
.gk-you .gk-seat { background: transparent; }
`;
