// Memory Pairs table: Memory Match's cards (its board, shared), the players
// with their pairs, and whose turn it is. Tap a card, or move with Tab or
// the arrow keys and press Enter or Space. A missed pair shows for a moment,
// then looks face down; the next flip turns it for real. The table stays
// left to right in every language.
import { useSyncExternalStore } from "react";

import { BOARD_CSS, Cards, useHiddenMiss } from "@kefche/game-memory-match/board";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback } from "@kefche/game-sdk/react";

import type { Action, State } from "../engine";
import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const hidden = useHiddenMiss(view?.state ?? null);

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      if (s.up.length === 1) sounds.play("flip");
      else if (s.up.length === 2) sounds.play("miss");
      else sounds.play("match");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const human = view.humanSeat;
  const total = s.symbols.length / 2;
  const missed = s.up.length === 2;
  const status = s.matched.every(Boolean)
    ? ""
    : missed
      ? t("missed", { name: name(s.turn === 0 ? s.seats - 1 : s.turn - 1) })
      : t("toFlip", { name: name(s.turn) });

  return (
    <div className="gk gmp" dir="ltr">
      <style>{KIT_CSS + BOARD_CSS + PAIRS_CSS}</style>
      <ol className="gmp-seats" aria-label={t("scores")}>
        {s.pairs.map((pairs, seat) => (
          <li
            // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per seat
            key={seat}
            className="gmp-seat"
            style={seatStyle(seat)}
            aria-current={seat === s.turn && !s.matched.every(Boolean) ? "true" : undefined}
          >
            {t("seatScore", { name: name(seat), pairs })}
          </li>
        ))}
      </ol>
      <p className="gmp-status" role="status">
        {status}
      </p>
      <Cards
        context={context}
        table={s}
        cards={s.cards}
        hidden={hidden}
        disabled={human === null}
        onFlip={(card) => {
          if (human !== null) session.act(human, { flip: card });
        }}
      />
      <p className="gmp-left">
        {t("pairsOf", { pairs: s.pairs.reduce((a, b) => a + b, 0), total })}
      </p>
    </div>
  );
}

const PAIRS_CSS = `
.gmp { max-width: 34rem; width: 100%; margin-inline: auto; }
.gmp-seats { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; }
.gmp-seat { padding: 0.3rem 0.7rem; border-radius: 999px; border: 2px solid transparent; border-inline-start: 0.45rem solid var(--fill); background: var(--surface-2); font-size: 0.875rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.gmp-seat[aria-current="true"] { border-color: var(--text); border-inline-start-color: var(--fill); }
.gmp-status { margin: 0; min-height: 1.5rem; font-weight: 700; text-align: center; }
.gmp-left { margin: 0; color: var(--text-muted); font-size: 0.875rem; }
`;
