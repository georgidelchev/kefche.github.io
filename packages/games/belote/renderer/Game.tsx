// Belote table: the two teams' scores, the contract and the calls, the
// other three players (in playing order, to your right first: play goes
// counter-clockwise), the trick, declarations, and your hand. Bid with the
// call buttons (only the calls you may make are on), then play: cards you
// may play stand out.
import { useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  CARD_CSS,
  CardTable,
  FourColourToggle,
  Hand,
  KIT_CSS,
  SUIT_PATHS,
  TABLE_CSS,
  TRICK_CSS,
  TrickArea,
  cardText,
  suitColour,
  useFourColour,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import {
  CONTRACTS,
  SEATS,
  TARGET,
  legalCalls,
  nextSeat,
  playable,
  type Action,
  type Call,
  type Contract,
  type Declaration,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const CONTRACT_KEYS = {
  clubs: "clubs",
  diamonds: "diamonds",
  hearts: "hearts",
  spades: "spades",
  no: "noTrumps",
  all: "allTrumps",
} as const;
const DECL_KEYS = {
  tierce: "tierce",
  quarte: "quarte",
  quinte: "quinte",
  carre: "carre",
  belote: "belote",
} as const;

function ContractMark({ kind, four }: { kind: Contract; four: boolean }) {
  if (kind === "no" || kind === "all") return null;
  return (
    <svg viewBox="0 0 24 24" className="gbe-suit" aria-hidden="true">
      <path d={SUIT_PATHS[kind]} style={{ fill: suitColour(kind, four) }} />
    </svg>
  );
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const text = cardText(t);
  const [four] = useFourColour();
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const contractName = (k: Contract) => t(CONTRACT_KEYS[k]);
  const callName = (c: Call) =>
    "pass" in c
      ? t("pass")
      : "double" in c
        ? t("double")
        : "redouble" in c
          ? t("redouble")
          : contractName(c.bid);
  const declName = (d: Declaration) => t(DECL_KEYS[d.kind]);

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      if (s.phase === "bid") sounds.play("call");
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
  const calls = human !== null && bidding ? legalCalls(state, human) : [];
  const canCall = (c: Call) => calls.some((x) => JSON.stringify(x) === JSON.stringify(c));
  const canPlay = new Set(human === null || bidding ? [] : playable(state, human));
  const showing = state.trick.length > 0 ? state.trick : (state.lastTrick?.plays ?? []);
  const winner = state.trick.length === 0 ? (state.lastTrick?.winner ?? null) : null;
  // In playing order from you: to your right first.
  const order: number[] = [];
  for (let s = nextSeat(me ?? 0); order.length < SEATS - 1; s = nextSeat(s)) order.push(s);
  const team = (n: 0 | 1) =>
    t("team", { names: `${name(n)} & ${name(n + 2)}`, score: state.scores[n] });
  const contract = state.contract;
  const lastCalls = state.calls.slice(-4);
  const counted = state.declarations.filter((d) => d.counts);

  return (
    <>
      <style>{KIT_CSS + CARD_CSS + TABLE_CSS + TRICK_CSS + BELOTE_CSS}</style>
      <CardTable
        label={t("players")}
        others={(me === null ? [0, 3, 2, 1] : order).map((s) => ({
          seat: s,
          name: name(s),
          cards: state.hands[s]?.length ?? 0,
          active: view.toMove.includes(s),
        }))}
        you={
          me === null
            ? null
            : { seat: me, name: name(me), cards: hand.length, active: view.toMove.includes(me) }
        }
        center={
          <div className="gbe-center">
            <div className="gk-hud">
              <span className="gk-chip">{team(0)}</span>
              <span className="gk-chip">{team(1)}</span>
              <span className="gk-chip">{t("to", { target: TARGET })}</span>
            </div>
            {contract && (
              <p className="gk-chip gbe-contract">
                <ContractMark kind={contract.kind} four={four} />
                {t("contract", {
                  contract: contractName(contract.kind),
                  name: name(contract.seat),
                })}
                {contract.doubled === 1 && ` · ${t("double")}`}
                {contract.doubled === 2 && ` · ${t("redouble")}`}
              </p>
            )}
            {bidding ? (
              <ul className="gbe-calls" aria-label={t("calls")}>
                {lastCalls.map((c, i) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- calls are a log, in order
                  <li key={i} className="gk-chip">
                    {name(c.seat)}: {callName(c.call)}
                  </li>
                ))}
              </ul>
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
            {!bidding && counted.length > 0 && (
              <ul className="gbe-calls" aria-label={t("declarations")}>
                {counted.map((d) => (
                  <li key={`${String(d.seat)}-${d.kind}-${String(d.rank)}`} className="gk-chip">
                    {name(d.seat)}: {declName(d)} ({d.points})
                  </li>
                ))}
              </ul>
            )}
            {bidding && state.lastDeal && (
              <p className="gk-chip">
                {t(state.lastDeal.inside ? "lastInside" : "lastDeal", {
                  a: state.lastDeal.points[0],
                  b: state.lastDeal.points[1],
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
              <div className="gbe-bids" role="group" aria-label={t("yourCall")}>
                <button
                  type="button"
                  className="gk-btn"
                  onClick={() => session.act(human, { pass: true })}
                >
                  {t("pass")}
                </button>
                {CONTRACTS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="gk-btn gbe-bid"
                    disabled={!canCall({ bid: k })}
                    onClick={() => session.act(human, { bid: k })}
                  >
                    <ContractMark kind={k} four={four} />
                    {contractName(k)}
                  </button>
                ))}
                {canCall({ double: true }) && (
                  <button
                    type="button"
                    className="gk-btn"
                    onClick={() => session.act(human, { double: true })}
                  >
                    {t("double")}
                  </button>
                )}
                {canCall({ redouble: true }) && (
                  <button
                    type="button"
                    className="gk-btn"
                    onClick={() => session.act(human, { redouble: true })}
                  >
                    {t("redouble")}
                  </button>
                )}
              </div>
            )}
            <FourColourToggle label={text.fourColour} />
          </>
        }
      />
    </>
  );
}

const BELOTE_CSS = `
.gk-table { --card-w: clamp(3.1rem, 14vw, 4.75rem); }
.gbe-center { display: grid; justify-items: center; gap: 0.5rem; }
.gbe-calls { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.gbe-contract { display: inline-flex; align-items: center; gap: 0.3rem; }
.gbe-suit { width: 1.1rem; height: 1.1rem; background: var(--card-face); border-radius: 0.2rem; }
.gbe-bids { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem; max-width: 30rem; }
.gbe-bid { display: inline-flex; align-items: center; gap: 0.3rem; }
`;
