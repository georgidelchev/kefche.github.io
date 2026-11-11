// Hearts table: the other three players along the top with their points,
// the trick in the middle (each card in front of whoever played it), your
// hand at the bottom. First choose three cards to pass (the direction is
// shown), then play: cards you may play stand out, the rest are dimmed.
import { useState, useSyncExternalStore } from "react";

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

import { QUEEN_OF_SPADES, SEATS, passOffset, playable, type Action, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const PASS_KEYS = { 1: "passLeft", 3: "passRight", 2: "passAcross", 0: "passNone" } as const;

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const text = cardText(t);
  const [four] = useFourColour();
  const [chosen, setChosen] = useState<number[]>([]);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      if (s.trick.length === 0 && s.lastTrick) {
        const queen = s.lastTrick.plays.some((p) => p.card === QUEEN_OF_SPADES);
        sounds.play(queen ? "queen" : "take");
      } else sounds.play(s.phase === "pass" ? "pass" : "play");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const state = view.state;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const human = view.humanSeat;
  const hand = me === null ? [] : (state.hands[me] ?? []);
  const passing = state.phase === "pass";
  const myPass = me === null ? null : (state.passes[me] ?? null);
  const offset = passOffset(state);
  const target = me === null ? "" : name((me + offset) % SEATS);
  const canPlay = new Set(human === null || passing ? [] : playable(state, human));

  const toggle = (c: number) => {
    setChosen((now) =>
      now.includes(c) ? now.filter((x) => x !== c) : now.length < 3 ? [...now, c] : now,
    );
  };
  const pass = () => {
    if (human === null || chosen.length !== 3) return;
    if (session.act(human, { pass: [...chosen].sort((a, b) => a - b) })) setChosen([]);
  };

  const showing = state.trick.length > 0 ? state.trick : (state.lastTrick?.plays ?? []);
  const winner = state.trick.length === 0 ? (state.lastTrick?.winner ?? null) : null;
  const order = Array.from({ length: SEATS - 1 }, (_, i) => ((me ?? 0) + 1 + i) % SEATS);
  const detail = (s: number) =>
    t("points", { hand: state.taken[s] ?? 0, total: state.scores[s] ?? 0 });
  const received = me === null ? [] : (state.received[me] ?? []);
  const announcement =
    state.trick.length === 0 && state.lastTrick
      ? t("took", { name: name(state.lastTrick.winner) })
      : "";

  return (
    <>
      <style>{KIT_CSS + CARD_CSS + TABLE_CSS + TRICK_CSS + HEARTS_CSS}</style>
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
          <div className="ghe-center">
            {passing ? (
              <p className="gk-chip">
                {offset === 0 ? t("passNone") : t(PASS_KEYS[offset as 1 | 2 | 3], { name: target })}
              </p>
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
              {state.heartsBroken && !passing && <span className="gk-chip">{t("broken")}</span>}
              <span className="gk-chip">{t("to", { target: state.target })}</span>
            </div>
            {received.length > 0 && (
              <p className="ghe-received">
                {t("received", { cards: received.map((c) => text.name(c)).join(", ") })}
              </p>
            )}
            {state.lastHand &&
              state.trick.length === 0 &&
              state.hands.every((h) => h.length === 13) && (
                <p className="ghe-received">
                  {t("lastHand", {
                    points: state.lastHand.map((p, s) => `${name(s)} ${String(p)}`).join(", "),
                  })}
                </p>
              )}
          </div>
        }
        hand={
          me !== null && (
            <Hand
              cards={hand}
              text={text}
              four={four}
              label={t("yourHand")}
              pick={passing ? "select" : "play"}
              selected={new Set(chosen)}
              canPlay={(c) => (passing ? human !== null && myPass === null : canPlay.has(c))}
              onPlay={(c) => {
                if (passing) toggle(c);
                else if (human !== null) session.act(human, { play: c });
              }}
            />
          )
        }
        bar={
          <>
            {passing && human !== null && myPass === null && (
              <button
                type="button"
                className="gk-btn"
                disabled={chosen.length !== 3}
                onClick={pass}
              >
                {t("passThree", { count: chosen.length })}
              </button>
            )}
            {passing && me !== null && myPass !== null && (
              <span className="gk-chip">{t("waiting")}</span>
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

const HEARTS_CSS = `
.gk-table { --card-w: clamp(2.9rem, 13vw, 4.5rem); }
.ghe-center { display: grid; justify-items: center; gap: 0.5rem; }
.ghe-received { margin: 0; font-size: 0.875rem; color: var(--text-muted); text-align: center; }
`;
