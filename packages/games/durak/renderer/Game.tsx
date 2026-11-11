// Durak table: the other players along the top (who attacks, who defends,
// who's out), the cards on the table in attack and defence pairs, the deck
// with the trump card under it, and your hand. Tap a card to attack, beat
// the card that's open, or throw in; Take picks the table up, Done ends
// your throwing in. With transfers on, Transfer passes the attack on.
import { useState, useSyncExternalStore } from "react";

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
  cardText,
  useFourColour,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { engine, type Action, type State } from "../engine";

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
  const [transferring, setTransferring] = useState(false);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      if (s.table.length === 0 && s.lastBout) sounds.play(s.lastBout.took ? "take" : "done");
      else sounds.play("play");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const state = view.state;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const human = view.humanSeat;
  const hand = me === null ? [] : (state.hands[me] ?? []);
  const actions = human === null ? [] : engine.legalActions(state, human);
  const of = (key: string) =>
    new Set(actions.flatMap((a) => (key in a ? [(a as Record<string, number>)[key] ?? -1] : [])));
  const attackable = of("attack");
  const beatable = of("beat");
  const addable = of("add");
  const transferable = of("transfer");
  const canTake = actions.some((a) => "take" in a);
  const canPass = actions.some((a) => "pass" in a);

  const playable = (c: number) =>
    transferring
      ? transferable.has(c)
      : attackable.has(c) ||
        beatable.has(c) ||
        addable.has(c) ||
        (beatable.size === 0 && transferable.has(c));
  const play = (c: number) => {
    if (human === null) return;
    if (transferring && transferable.has(c)) {
      session.act(human, { transfer: c });
      setTransferring(false);
    } else if (attackable.has(c)) session.act(human, { attack: c });
    else if (beatable.has(c)) session.act(human, { beat: c });
    else if (addable.has(c)) session.act(human, { add: c });
    else if (transferable.has(c)) session.act(human, { transfer: c });
  };

  const others = Array.from(
    { length: state.players - 1 },
    (_, i) => ((me ?? 0) + 1 + i) % state.players,
  );
  const role = (s: number) =>
    state.out.includes(s)
      ? t("out")
      : s === state.defender
        ? t("defending")
        : s === state.attacker
          ? t("attacking")
          : undefined;
  const up = state.deck.at(-1);
  const prompt =
    human === null
      ? null
      : state.phase === "attack"
        ? t("promptAttack")
        : state.phase === "defend"
          ? t("promptDefend")
          : state.phase === "pile"
            ? t("promptPile", { name: name(state.defender) })
            : t("promptThrow");

  return (
    <>
      <style>{KIT_CSS + CARD_CSS + TABLE_CSS + DURAK_CSS}</style>
      <CardTable
        label={t("players")}
        others={(me === null ? Array.from({ length: state.players }, (_, i) => i) : others).map(
          (s) => ({
            seat: s,
            name: name(s),
            cards: state.hands[s]?.length ?? 0,
            active: view.toMove.includes(s),
            ...(role(s) === undefined ? {} : { detail: role(s) }),
          }),
        )}
        you={
          me === null
            ? null
            : {
                seat: me,
                name: name(me),
                cards: hand.length,
                active: view.toMove.includes(me),
                ...(role(me) === undefined ? {} : { detail: role(me) }),
              }
        }
        center={
          <div className="gdu-center">
            <div className="gdu-deck">
              {state.deck.length > 1 && (
                <CardBacks
                  count={Math.min(4, state.deck.length - 1)}
                  label={t("deck", { count: state.deck.length })}
                />
              )}
              {up !== undefined ? (
                <div className="gdu-trump">
                  <PlayingCard
                    card={up}
                    four={four}
                    label={t("trumpCard", { card: text.name(up) })}
                  />
                </div>
              ) : (
                <span className="gk-chip">{t("trumps", { suit: text.suit(state.trump) })}</span>
              )}
            </div>
            <ul className="gdu-table" aria-label={t("table")}>
              {state.table.map((p) => (
                <li key={p.attack} className="gdu-pair">
                  <PlayingCard card={p.attack} four={four} label={text.name(p.attack)} />
                  {p.defense !== null && (
                    <span className="gdu-defense">
                      <PlayingCard
                        card={p.defense}
                        four={four}
                        label={t("beatenBy", { card: text.name(p.defense) })}
                      />
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="gk-hud">
              <span className="gk-chip">
                {t("bout", { attacker: name(state.attacker), defender: name(state.defender) })}
              </span>
              {prompt && <span className="gk-chip">{prompt}</span>}
              {state.table.length === 0 && state.lastBout && (
                <span className="gk-chip">
                  {state.lastBout.took
                    ? t("took", { name: name(state.lastBout.defender) })
                    : t("beaten", { name: name(state.lastBout.defender) })}
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
              canPlay={playable}
              onPlay={play}
            />
          )
        }
        bar={
          <>
            {canTake && (
              <button
                type="button"
                className="gk-btn"
                onClick={() => human !== null && session.act(human, { take: true })}
              >
                {t("take")}
              </button>
            )}
            {transferable.size > 0 && (
              <button
                type="button"
                className="gk-btn"
                aria-pressed={transferring}
                onClick={() => {
                  setTransferring(!transferring);
                }}
              >
                {t("transfer")}
              </button>
            )}
            {canPass && (
              <button
                type="button"
                className="gk-btn"
                onClick={() => human !== null && session.act(human, { pass: true })}
              >
                {t("done")}
              </button>
            )}
            <FourColourToggle label={text.fourColour} />
          </>
        }
      />
    </>
  );
}

const DURAK_CSS = `
.gk-table { --card-w: clamp(2.9rem, 13vw, 4.5rem); }
.gdu-center { display: grid; justify-items: center; gap: 0.5rem; }
.gdu-deck { display: flex; align-items: center; gap: 0.75rem; }
.gdu-trump { transform: rotate(90deg); margin-inline: 0.75rem; }
.gdu-table { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem 1rem; margin: 0; padding: 0; list-style: none; min-height: calc(var(--card-w) * 1.6); }
.gdu-pair { position: relative; padding-bottom: calc(var(--card-w) * 0.35); padding-inline-end: calc(var(--card-w) * 0.3); }
.gdu-defense { position: absolute; top: calc(var(--card-w) * 0.35); left: calc(var(--card-w) * 0.3); }
`;
