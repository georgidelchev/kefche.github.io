// Liar's Dice table: the other players along the top with how many dice
// they hold (never which), the bid to beat and the last call's cups in the
// middle, your own dice, and the bidding below: how many, which face, then
// Bid, or call the bid a lie (or exact). The table stays left to right in
// every language.
import { useState, useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  CardTable,
  DICE_CSS,
  Die,
  KIT_CSS,
  TABLE_CSS,
  diceText,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import {
  counts,
  engine,
  higher,
  totalDice,
  type Action,
  type Bid,
  type Reveal,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const FACES = [1, 2, 3, 4, 5, 6] as const;

/** The lowest quantity of a face that beats the bid. */
function lowest(bid: Bid | null, face: number): number {
  const q = bid?.qty ?? 1;
  return higher({ qty: q, face }, bid) ? q : q + 1;
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const dice = diceText(t);
  const [face, setFace] = useState(6);
  const [wanted, setWanted] = useState(1);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      sounds.play(s.bid === null && s.reveal !== null ? "call" : "bid");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const human = view.humanSeat;
  const actions = human === null ? [] : engine.legalActions(s, human);
  const canCall = actions.some((a) => "call" in a && a.call === "liar");
  const canExact = actions.some((a) => "call" in a && a.call === "exact");
  const total = totalDice(s);
  const min = lowest(s.bid, face);
  const qty = Math.min(total, Math.max(wanted, min));
  const canBid = human !== null && min <= total;
  const bidText = (b: Bid) => t("bidText", { qty: b.qty, face: b.face });
  const own = me === null ? [] : (s.dice[me] ?? []);

  const seatLine = (seat: number) => ({
    seat,
    name: name(seat),
    cards: null,
    active: view.toMove.includes(seat),
    detail:
      (s.dice[seat]?.length ?? 0) === 0 ? (
        t("out")
      ) : (
        <span
          className="gld-cup"
          role="img"
          aria-label={t("cup", { count: s.dice[seat]?.length ?? 0 })}
        >
          <span aria-hidden="true">{s.dice[seat]?.length ?? 0}</span>
          <svg viewBox="0 0 20 20" className="gld-cupicon" aria-hidden="true">
            <path d="M3 2.5h14l-2.2 15H5.2z" />
          </svg>
        </span>
      ),
  });
  const others =
    me === null
      ? Array.from({ length: s.players }, (_, i) => i)
      : Array.from({ length: s.players - 1 }, (_, i) => (me + 1 + i) % s.players);

  const status =
    s.bid === null
      ? t("opens", { name: name(s.turn) })
      : t("bidBy", { name: name(s.bidder ?? 0), bid: bidText(s.bid) });

  return (
    <>
      <style>{KIT_CSS + DICE_CSS + TABLE_CSS + LIARS_CSS}</style>
      <CardTable
        label={t("players")}
        others={others.map(seatLine)}
        you={me === null ? null : seatLine(me)}
        center={
          <div className="gld-center">
            <div className="gk-hud">
              <span className="gk-chip">{t("round", { n: s.round })}</span>
              {s.config.wild && <span className="gk-chip">{t("onesWild")}</span>}
            </div>
            <p className="gld-bid" aria-live="polite">
              {s.bid !== null && <Die value={s.bid.face} label={dice.die(s.bid.face)} />}
              <span>{status}</span>
            </p>
            {s.reveal && (
              <RevealPanel
                reveal={s.reveal}
                wild={s.config.wild}
                name={name}
                t={t}
                bidText={bidText}
                dice={dice}
              />
            )}
          </div>
        }
        hand={
          me !== null && (
            <ul className="gld-mine" aria-label={t("yourDice")}>
              {own.map((d, i) => (
                // Dice are told apart by their place under the cup.
                // eslint-disable-next-line @eslint-react/no-array-index-key -- dice have no identity
                <li key={i}>
                  <Die value={d} roll={`${String(s.round)}-${String(i)}`} label={dice.die(d)} />
                </li>
              ))}
            </ul>
          )
        }
        bar={
          me !== null &&
          own.length > 0 && (
            <div className="gld-bidding">
              <div className="gld-row">
                <button
                  type="button"
                  className="gk-btn"
                  aria-label={t("fewer")}
                  disabled={human === null || qty <= min}
                  onClick={() => {
                    setWanted(qty - 1);
                  }}
                >
                  −
                </button>
                <output className="gld-qty" aria-label={t("quantity")}>
                  {qty}
                </output>
                <button
                  type="button"
                  className="gk-btn"
                  aria-label={t("more")}
                  disabled={human === null || qty >= total}
                  onClick={() => {
                    setWanted(qty + 1);
                  }}
                >
                  +
                </button>
                <span className="gld-times" aria-hidden="true">
                  ×
                </span>
              </div>
              <div className="gld-row" role="group" aria-label={t("face")}>
                {FACES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="gld-face"
                    aria-pressed={face === f}
                    disabled={human === null}
                    aria-label={dice.die(f)}
                    onClick={() => {
                      setFace(f);
                    }}
                  >
                    <Die value={f} />
                  </button>
                ))}
              </div>
              <div className="gld-row">
                <button
                  type="button"
                  className="gk-btn gld-go"
                  disabled={!canBid}
                  onClick={() => {
                    if (human !== null) session.act(human, { bid: { qty, face } });
                  }}
                >
                  {t("bid", { bid: bidText({ qty, face }) })}
                </button>
                {canCall && (
                  <button
                    type="button"
                    className="gk-btn gld-liar"
                    onClick={() => {
                      if (human !== null) session.act(human, { call: "liar" });
                    }}
                  >
                    {t("liar")}
                  </button>
                )}
                {canExact && (
                  <button
                    type="button"
                    className="gk-btn"
                    onClick={() => {
                      if (human !== null) session.act(human, { call: "exact" });
                    }}
                  >
                    {t("exact")}
                  </button>
                )}
              </div>
            </div>
          )
        }
      />
    </>
  );
}

function RevealPanel({
  reveal,
  wild,
  name,
  t,
  bidText,
  dice,
}: {
  reveal: Reveal;
  wild: boolean;
  name: (seat: number) => string;
  t: GameContext["t"];
  bidText: (b: Bid) => string;
  dice: ReturnType<typeof diceText>;
}) {
  const said =
    reveal.call === "liar"
      ? t("calledLiar", {
          caller: name(reveal.caller),
          bidder: name(reveal.bidder),
          bid: bidText(reveal.bid),
        })
      : t("calledExact", {
          caller: name(reveal.caller),
          bidder: name(reveal.bidder),
          bid: bidText(reveal.bid),
        });
  const outcome =
    reveal.gainer !== null
      ? t("gains", { name: name(reveal.gainer) })
      : reveal.loser !== null
        ? t("loses", { name: name(reveal.loser) })
        : "";
  return (
    <section className="gld-reveal" aria-label={t("lastCall")}>
      <p>
        {said} {t("thereWere", { count: reveal.count })} {outcome}
      </p>
      <ul className="gld-cups">
        {reveal.dice.map((cup, seat) =>
          cup.length === 0 ? null : (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- one cup per seat
            <li key={seat}>
              <span className="gld-who">{name(seat)}</span>
              <span className="gld-dice">
                {cup.map((d, i) => (
                  <Die
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- dice have no identity
                    key={i}
                    value={d}
                    dim={!counts(d, reveal.bid.face, wild)}
                    label={dice.die(d)}
                  />
                ))}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

const LIARS_CSS = `
.gk-table { --die-w: 2.25rem; }
.gld-center { display: grid; justify-items: center; gap: 0.5rem; width: 100%; }
.gld-bid { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-weight: 700; font-size: 1.05rem; text-align: center; min-height: 2.75rem; }
.gld-cup { display: inline-flex; align-items: center; gap: 0.25rem; font-variant-numeric: tabular-nums; --die-w: 1.1rem; }
.gld-cupicon { width: 1rem; height: 1rem; }
.gld-cupicon path { fill: var(--fill); stroke: var(--text); stroke-width: 1.5; stroke-linejoin: round; }
.gld-mine { display: flex; justify-content: center; gap: 0.4rem; margin: 0; padding: 0; list-style: none; --die-w: 3rem; }
.gld-reveal { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.75rem; background: var(--surface-2); font-size: 0.875rem; }
.gld-reveal p { margin: 0 0 0.4rem; }
.gld-cups { display: grid; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.gld-cups li { display: flex; align-items: center; gap: 0.5rem; }
.gld-who { min-width: 5rem; max-width: 7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gld-dice { display: flex; gap: 0.2rem; --die-w: 1.5rem; }
.gld-dice .gk-die { animation: none; }
.gld-bidding { display: grid; justify-items: center; gap: 0.5rem; width: 100%; }
.gld-row { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.4rem; }
.gld-qty { min-width: 2.5rem; text-align: center; font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.gld-times { font-size: 1.25rem; color: var(--text-muted); }
.gld-face { display: inline-grid; place-items: center; min-width: 2.75rem; min-height: 2.75rem; padding: 0.15rem; border-radius: 0.6rem; border: 2px solid transparent; background: none; cursor: pointer; --die-w: 2.25rem; }
.gld-face[aria-pressed="true"] { border-color: var(--brand); background: var(--surface-2); }
.gld-face:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gld-face .gk-die { animation: none; }
.gld-go { min-width: 9rem; }
.gld-liar { background: var(--danger); border-color: var(--danger); color: var(--on-danger); }
`;
