// Spades table: the two teams' scores, the other three players with their
// bids and tricks, the trick in the middle, your hand at the bottom. Bid by
// tapping a number (Nil is zero), then play: cards you may play stand out.
import { useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  CARD_CSS,
  CardTable,
  FourColourToggle,
  Hand,
  KIT_CSS,
  TABLE_CSS,
  TRICK_CSS,
  TrickArea,
  cardText,
  useFourColour,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { SEATS, playable, type Action, type State } from "../engine";

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
  const text = cardText(t);
  const [four] = useFourColour();
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      if (s.phase === "bid" && s.bids.some((b) => b !== null)) sounds.play("bid");
      else if (s.trick.length === 0 && s.lastTrick) sounds.play("take");
      else sounds.play("play");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const state = view.state;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const human = view.humanSeat;
  const hand = me === null ? [] : (state.hands[me] ?? []);
  const bidding = state.phase === "bid";
  const canPlay = new Set(human === null || bidding ? [] : playable(state, human));
  const showing = state.trick.length > 0 ? state.trick : (state.lastTrick?.plays ?? []);
  const winner = state.trick.length === 0 ? (state.lastTrick?.winner ?? null) : null;
  const order = Array.from({ length: SEATS - 1 }, (_, i) => ((me ?? 0) + 1 + i) % SEATS);
  const bidText = (b: number | null | undefined) =>
    b === null || b === undefined ? "–" : b === 0 ? t("nil") : String(b);
  const detail = (s: number) =>
    t("bidTricks", { bid: bidText(state.bids[s]), tricks: state.tricks[s] ?? 0 });
  const team = (n: 0 | 1) =>
    t("team", {
      names: `${name(n)} & ${name(n + 2)}`,
      score: state.scores[n],
      bags: state.bags[n],
    });
  const announcement =
    state.trick.length === 0 && state.lastTrick
      ? t("took", { name: name(state.lastTrick.winner) })
      : "";

  return (
    <>
      <style>{KIT_CSS + CARD_CSS + TABLE_CSS + TRICK_CSS + SPADES_CSS}</style>
      <CardTable
        label={t("players")}
        others={(me === null ? [0, 1, 2, 3] : order).map((s) => ({
          seat: s,
          name: name(s),
          cards: state.hands[s]?.length ?? 0,
          active: view.toMove.includes(s),
          detail: detail(s),
        }))}
        you={
          me === null
            ? null
            : {
                seat: me,
                name: name(me),
                cards: hand.length,
                active: view.toMove.includes(me),
                detail: detail(me),
              }
        }
        center={
          <div className="gsp-center">
            <div className="gk-hud">
              <span className="gk-chip">{team(0)}</span>
              <span className="gk-chip">{team(1)}</span>
            </div>
            {bidding ? (
              <p className="gk-chip">{t("bidding")}</p>
            ) : (
              <TrickArea
                plays={showing}
                players={SEATS}
                me={me}
                winner={winner}
                four={four}
                label={t("trick")}
                name={(p) => t("playedBy", { name: name(p.seat), card: text.name(p.card) })}
              />
            )}
            <div className="gk-hud">
              {state.spadesBroken && !bidding && <span className="gk-chip">{t("broken")}</span>}
              <span className="gk-chip">{t("to", { target: state.target })}</span>
              {state.lastHand && bidding && (
                <span className="gk-chip">
                  {t("lastHand", { a: state.lastHand[0], b: state.lastHand[1] })}
                </span>
              )}
            </div>
          </div>
        }
        hand={
          me !== null && (
            <Hand
              cards={hand}
              text={text}
              four={four}
              label={t("yourHand")}
              quiet={bidding}
              canPlay={(c) => canPlay.has(c)}
              onPlay={(c) => {
                if (human !== null) session.act(human, { play: c });
              }}
            />
          )
        }
        bar={
          <>
            {bidding && human !== null && (
              <div className="gsp-bids" role="group" aria-label={t("yourBid")}>
                {Array.from({ length: 14 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    className="gk-btn"
                    onClick={() => {
                      session.act(human, { bid: n });
                    }}
                  >
                    {n === 0 ? t("nil") : n}
                  </button>
                ))}
              </div>
            )}
            <FourColourToggle label={text.fourColour} />
          </>
        }
      />
      <p className="gk-sr" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

const SPADES_CSS = `
.gk-table { --card-w: clamp(2.9rem, 13vw, 4.5rem); }
.gsp-center { display: grid; justify-items: center; gap: 0.5rem; }
.gsp-bids { display: grid; grid-template-columns: repeat(7, minmax(2.75rem, 1fr)); gap: 0.3rem; width: 100%; max-width: 26rem; }
.gsp-bids .gk-btn { padding-inline: 0; min-width: 0; }
`;
