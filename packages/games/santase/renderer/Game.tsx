// Santase table: the other player above, the stock with the trump card
// under it, the trick between you, your hand below. When you lead you may
// swap the nine of trumps for the trump card, or close the stock; leading a
// king or queen whose partner you hold announces the marriage.
import { useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  CARD_CSS,
  CardBacks,
  CardTable,
  FourColourToggle,
  Hand,
  KIT_CSS,
  PlayingCard,
  TABLE_CSS,
  TRICK_CSS,
  TrickArea,
  cardText,
  useFourColour,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { TARGET, engine, trumpCard, type Action, type State } from "../engine";

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
      if (s.marriages.length > (view?.state.marriages.length ?? 0)) sounds.play("marriage");
      else if (s.trick.length === 0 && s.lastTrick) sounds.play("take");
      else sounds.play("play");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const state = view.state;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const human = view.humanSeat;
  const them = me === null ? 1 : 1 - me;
  const hand = me === null ? [] : state.hands[me as 0 | 1];
  const actions = human === null ? [] : engine.legalActions(state, human);
  const canPlay = new Set(actions.flatMap((a) => ("play" in a ? [a.play] : [])));
  const showing = state.trick.length > 0 ? state.trick : (state.lastTrick?.plays ?? []);
  const winner = state.trick.length === 0 ? (state.lastTrick?.winner ?? null) : null;
  const up = trumpCard(state);
  const detail = (s: number) =>
    t("points", { points: state.points[s as 0 | 1], score: state.scores[s as 0 | 1] });

  return (
    <>
      <style>{KIT_CSS + CARD_CSS + TABLE_CSS + TRICK_CSS + SANTASE_CSS}</style>
      <CardTable
        label={t("players")}
        others={[
          {
            seat: them,
            name: name(them),
            cards: state.hands[them as 0 | 1].length,
            active: view.toMove.includes(them),
            detail: detail(them),
          },
        ]}
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
          <div className="gsa-center">
            <div
              className="gsa-stock"
              aria-label={t("stock", { count: state.stock.length })}
              role="group"
            >
              {state.stock.length > 1 && (
                <CardBacks
                  count={Math.min(4, state.stock.length - 1)}
                  label={t("stock", { count: state.stock.length })}
                />
              )}
              {up !== null && (
                <div className="gsa-trump">
                  <PlayingCard
                    card={up}
                    four={four}
                    label={t("trumpCard", { card: text.name(up) })}
                  />
                </div>
              )}
              {up === null && (
                <span className="gk-chip">{t("trumps", { suit: text.suit(state.trump) })}</span>
              )}
            </div>
            <TrickArea
              plays={showing}
              players={2}
              me={me}
              winner={winner}
              four={four}
              label={t("trick")}
              name={(p) => t("playedBy", { name: name(p.seat), card: text.name(p.card) })}
            />
            <div className="gk-hud">
              {state.closed !== null && (
                <span className="gk-chip">{t("closedBy", { name: name(state.closed) })}</span>
              )}
              {state.marriages.map((m) => (
                <span key={m.suit} className="gk-chip">
                  {t("marriage", { name: name(m.seat), suit: text.suit(m.suit) })}
                </span>
              ))}
              <span className="gk-chip">{t("to", { target: TARGET })}</span>
              {state.lastDeal &&
                state.trick.length === 0 &&
                state.tricks[0] + state.tricks[1] === 0 && (
                  <span className="gk-chip">
                    {t("lastDeal", {
                      name: name(state.lastDeal.winner),
                      points: state.lastDeal.points,
                    })}
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
              canPlay={(c) => canPlay.has(c)}
              onPlay={(c) => {
                if (human !== null) session.act(human, { play: c });
              }}
            />
          )
        }
        bar={
          <>
            {human !== null && actions.some((a) => "exchange" in a) && (
              <button
                type="button"
                className="gk-btn"
                onClick={() => session.act(human, { exchange: true })}
              >
                {t("exchange")}
              </button>
            )}
            {human !== null && actions.some((a) => "close" in a) && (
              <button
                type="button"
                className="gk-btn"
                onClick={() => session.act(human, { close: true })}
              >
                {t("close")}
              </button>
            )}
            <FourColourToggle label={text.fourColour} />
          </>
        }
      />
    </>
  );
}

const SANTASE_CSS = `
.gk-table { --card-w: clamp(3.4rem, 16vw, 5rem); }
.gsa-center { display: grid; justify-items: center; gap: 0.5rem; }
.gsa-stock { display: flex; align-items: center; gap: 0.75rem; }
.gsa-trump { transform: rotate(90deg); margin-inline: 0.75rem; }
`;
