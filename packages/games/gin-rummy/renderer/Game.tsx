// Gin Rummy table: the other player above, the stock and the discard pile
// in the middle, your hand below, sorted into your best melds and then your
// deadwood. Draw by tapping the stock or the face-up discard, then tap a
// card to discard it. When you may knock, turn Knock on first; the hand's
// end shows both hands laid out.
import { useState, useSyncExternalStore } from "react";

import { HIDDEN, sortHand } from "@kefche/game-sdk";
import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  CARD_CSS,
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

import { KNOCK_LIMIT, bestMelds, engine, type Action, type Melded, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

function Laid({
  m,
  label,
  four,
  name,
}: {
  m: Melded;
  label: string;
  four: boolean;
  name: (c: number) => string;
}) {
  return (
    <div className="ggr-laid" role="group" aria-label={label}>
      {m.melds.map((meld) => (
        <span key={meld.join()} className="ggr-meld">
          {meld.map((c) => (
            <PlayingCard key={c} card={c} four={four} label={name(c)} />
          ))}
        </span>
      ))}
      {m.deadwood.length > 0 && (
        <span className="ggr-meld ggr-dead">
          {m.deadwood.map((c) => (
            <PlayingCard key={c} card={c} four={four} label={name(c)} />
          ))}
        </span>
      )}
    </div>
  );
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const text = cardText(t);
  const [four] = useFourColour();
  const [knocking, setKnocking] = useState(false);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      if (s.lastHand && s.hands[0].length === 10 && s.discard.length === 1)
        sounds.play(s.lastHand.gin ? "gin" : "knock");
      else sounds.play(s.phase === "discard" ? "draw_" : "discard");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const state = view.state;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const human = view.humanSeat;
  const them = me === null ? 1 : me === 0 ? 1 : 0;
  const hand = me === null ? [] : state.hands[me as 0 | 1];
  const melded = bestMelds(hand.filter((c) => c !== HIDDEN));
  const ordered = [...melded.melds.flat(), ...sortHand(melded.deadwood)];
  const actions = human === null ? [] : engine.legalActions(state, human);
  const knockable = new Set(actions.flatMap((a) => ("knock" in a ? [a.knock] : [])));
  const discardable = new Set(actions.flatMap((a) => ("discard" in a ? [a.discard] : [])));
  const top = state.discard.at(-1);
  const drawing = state.phase === "draw";
  const fresh =
    state.hands[0].length === 10 && state.hands[1].length === 10 && state.discard.length === 1;
  const end = fresh ? state.lastHand : null;

  const play = (c: number) => {
    if (human === null) return;
    if (knocking && knockable.has(c)) {
      session.act(human, { knock: c });
      setKnocking(false);
    } else session.act(human, { discard: c });
  };

  return (
    <>
      <style>{KIT_CSS + CARD_CSS + TABLE_CSS + GIN_CSS}</style>
      <CardTable
        label={t("players")}
        others={[
          {
            seat: them,
            name: name(them),
            cards: state.hands[them].length,
            active: view.toMove.includes(them),
            detail: t("score", { score: state.scores[them] }),
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
                detail: t("score", { score: state.scores[me as 0 | 1] }),
              }
        }
        center={
          <div className="ggr-center">
            <div className="ggr-piles">
              <button
                type="button"
                className="ggr-pile"
                disabled={!(drawing && human !== null)}
                onClick={() => {
                  if (human !== null) session.act(human, { draw: "stock" });
                }}
              >
                <PlayingCard card={HIDDEN} label={t("drawStock", { count: state.stock.length })} />
              </button>
              {top !== undefined && (
                <button
                  type="button"
                  className="ggr-pile"
                  disabled={!(drawing && human !== null)}
                  onClick={() => {
                    if (human !== null) session.act(human, { draw: "discard" });
                  }}
                >
                  <PlayingCard
                    card={top}
                    four={four}
                    label={t("takeDiscard", { card: text.name(top) })}
                  />
                </button>
              )}
            </div>
            <div className="gk-hud">
              {me !== null && (
                <span className="gk-chip">{t("deadwood", { points: melded.points })}</span>
              )}
              <span className="gk-chip">{t("to", { target: state.target })}</span>
              {human !== null && (
                <span className="gk-chip">{drawing ? t("drawPrompt") : t("discardPrompt")}</span>
              )}
            </div>
            {end && (
              <div className="ggr-end">
                <p className="gk-chip">
                  {end.gin
                    ? t("gin", { name: name(end.knocker), points: Math.max(...end.points) })
                    : end.undercut
                      ? t("undercut", {
                          name: name(end.knocker === 0 ? 1 : 0),
                          points: Math.max(...end.points),
                        })
                      : t("knocked", { name: name(end.knocker), points: Math.max(...end.points) })}
                </p>
                {([0, 1] as const).map((s) => (
                  <Laid
                    key={s}
                    m={end.shown[s] ?? { melds: [], deadwood: [], points: 0 }}
                    four={four}
                    name={text.name}
                    label={t("handOf", { name: name(s) })}
                  />
                ))}
              </div>
            )}
            {fresh && state.hand > 0 && !end && <p className="gk-chip">{t("drawnHand")}</p>}
          </div>
        }
        hand={
          me !== null && (
            <Hand
              cards={ordered}
              text={text}
              four={four}
              label={t("yourHand")}
              quiet={drawing}
              canPlay={(c) => (knocking ? knockable.has(c) : discardable.has(c))}
              onPlay={play}
            />
          )
        }
        bar={
          <>
            {human !== null && knockable.size > 0 && (
              <button
                type="button"
                className="gk-btn"
                aria-pressed={knocking}
                onClick={() => {
                  setKnocking(!knocking);
                }}
              >
                {t("knock", { limit: KNOCK_LIMIT })}
              </button>
            )}
            <FourColourToggle label={text.fourColour} />
          </>
        }
      />
    </>
  );
}

const GIN_CSS = `
.gk-table { --card-w: clamp(3rem, 13vw, 4.5rem); }
.ggr-center { display: grid; justify-items: center; gap: 0.5rem; }
.ggr-piles { display: flex; gap: 1rem; }
.ggr-pile { padding: 0; border: 0; background: none; border-radius: 0.4rem; cursor: pointer; }
.ggr-pile:disabled { cursor: default; }
.ggr-pile:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.ggr-end { display: grid; justify-items: center; gap: 0.4rem; --card-w: 2.2rem; }
.ggr-laid { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem; }
.ggr-meld { display: inline-flex; }
.ggr-meld .gk-card + .gk-card { margin-inline-start: calc(var(--card-w) * -0.45); }
.ggr-dead { opacity: 0.75; }
`;
