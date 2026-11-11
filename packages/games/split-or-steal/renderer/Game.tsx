// Split or Steal: the scores, your pair this round (the pot, and two buttons:
// Split or Steal), a reminder to talk it over first, and every round so far
// with who split and who stole. Your choice stays hidden until your partner
// has chosen too. Buttons are reachable with Tab; Enter or Space chooses.
import { useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback } from "@kefche/game-sdk/react";

import { pairOf, type Action, type Choice, type Pair, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const CHOICES: readonly Choice[] = ["split", "steal"];
const CHOICE_KEYS = { split: "split", steal: "steal" } as const;
/** Where the talking happens: the room chat online, aloud on one device; bots stay silent. */
const TALK_KEYS = { online: "talkChat", hotseat: "talkAloud", "solo-bots": "talkBots" } as const;

/** kefche's own icons: a coin cut in two, and a hand closing on a coin. */
function ChoiceIcon({ choice }: { choice: Choice }) {
  return (
    <svg viewBox="0 0 24 24" className="gss-icon" aria-hidden="true">
      {choice === "split" ? (
        <>
          <path d="M10 3a9 9 0 0 0 0 18z" />
          <path d="M14 3a9 9 0 0 1 0 18z" />
        </>
      ) : (
        <>
          <circle cx="15" cy="9" r="6" />
          <path d="M2 15h7l3 2h6v3H8l-6-2z" />
        </>
      )}
    </svg>
  );
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const choiceName = (c: Choice) => t(CHOICE_KEYS[c]);

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const done =
        current.state.pairs.every((p) => p.won === null) && current.state.history.length > 0;
      sounds.play(done ? "reveal" : "choose");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const human = view.humanSeat;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const done = s.round >= s.config.rounds;
  const mine = me === null ? null : pairOf(s, me);

  const outcome = (p: Pair) => {
    const [x, y] = p.choices;
    if (!p.won || (x !== "split" && x !== "steal") || (y !== "split" && y !== "steal")) return "";
    return t("pairResult", {
      a: name(p.a),
      x: choiceName(x),
      b: name(p.b),
      y: choiceName(y),
      wa: p.won[0],
      wb: p.won[1],
    });
  };

  const yours = (() => {
    if (done || me === null) return null;
    if (!mine) return <p className="gss-status">{t("sittingOut")}</p>;
    const partner = mine.side === 0 ? mine.pair.b : mine.pair.a;
    const own = mine.pair.choices[mine.side];
    return (
      <section className="gss-mine" aria-label={t("yourPair")}>
        <h2 className="gss-title">{t("withPartner", { name: name(partner) })}</h2>
        <p className="gss-pot">{t("pot", { n: mine.pair.pot })}</p>
        <p className="gss-hint">{t(TALK_KEYS[match?.mode ?? "solo-bots"])}</p>
        <div className="gss-choices" role="group" aria-label={t("yourChoice")}>
          {CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              className="gss-choice"
              data-choice={c}
              aria-pressed={own === c}
              disabled={human === null || own !== null}
              onClick={() => {
                if (human !== null) session.act(human, { choose: c });
              }}
            >
              <ChoiceIcon choice={c} />
              <span>{choiceName(c)}</span>
            </button>
          ))}
        </div>
        {own !== null && <p className="gss-status">{t("waitingFor", { name: name(partner) })}</p>}
      </section>
    );
  })();

  return (
    <div className="gk gss">
      <style>{KIT_CSS + SOS_CSS}</style>
      <ol className="gss-scores" aria-label={t("scores")}>
        {s.scores.map((points, seat) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per seat
          <li key={seat} style={seatStyle(seat)}>
            {t("scoreLine", { name: name(seat), points })}
          </li>
        ))}
      </ol>
      {!done && (
        <p className="gss-round">{t("roundN", { n: s.round + 1, total: s.config.rounds })}</p>
      )}
      {yours}
      {s.history.length > 0 && (
        <section className="gss-history" aria-label={t("rounds")}>
          <h2 className="gss-title">{t("rounds")}</h2>
          {[...s.history].reverse().map((round, k) => {
            const index = s.history.length - k;
            return (
              <div key={index} className="gss-past">
                <h3>{t("roundShort", { n: index })}</h3>
                <ul>
                  {round.map((p) => (
                    <li
                      key={`${String(p.a)}-${String(p.b)}`}
                      aria-live={k === 0 ? "polite" : undefined}
                    >
                      {outcome(p)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

const SOS_CSS = `
.gss { max-width: 36rem; width: 100%; margin-inline: auto; align-content: start; }
.gss-scores { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.gss-scores li { padding: 0.25rem 0.65rem; border-radius: 999px; background: var(--surface-2); border-inline-start: 0.4rem solid var(--fill); font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.gss-round { margin: 0; font-weight: 700; }
.gss-mine { display: grid; justify-items: center; gap: 0.45rem; width: 100%; padding: 0.75rem; border-radius: 1rem; background: var(--surface-2); }
.gss-title { margin: 0; font-size: 1.05rem; text-align: center; }
.gss-pot { margin: 0; font-size: 1.6rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.gss-hint, .gss-status { margin: 0; color: var(--text-muted); font-size: 0.9rem; text-align: center; }
.gss-choices { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.6rem; }
.gss-choice { display: grid; justify-items: center; gap: 0.25rem; min-width: 7rem; padding: 0.7rem 1rem; border-radius: 1rem; border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 1.05rem; font-weight: 800; cursor: pointer; }
.gss-choice[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.gss-choice:disabled:not([aria-pressed="true"]) { opacity: 0.45; cursor: default; }
.gss-choice:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gss-icon { width: 2.5rem; height: 2.5rem; fill: currentColor; }
.gss-history { width: 100%; display: grid; gap: 0.5rem; }
.gss-past h3 { margin: 0 0 0.2rem; font-size: 0.85rem; color: var(--text-muted); }
.gss-past ul { display: grid; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.gss-past li { padding: 0.3rem 0.6rem; border-radius: 0.6rem; background: var(--surface-2); font-size: 0.85rem; }
`;
