// Lowest Unique Number: the scores, a pad of numbers 1–10 to pick from (your
// pick stays hidden until everyone has picked), who is still choosing, and
// every round so far with everyone's numbers and the winner. Buttons are
// reachable with Tab; Enter or Space picks.
import { useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback } from "@kefche/game-sdk/react";

import { MAX, SECRET, type Action, type State } from "../engine";

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

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const s = current.state;
      sounds.play(s.picks.every((p) => p === null) ? "reveal" : "pick");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const human = view.humanSeat;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const mine = me === null ? null : (s.picks[me] ?? null);
  const done = s.history.length >= s.config.rounds;
  const choosing = s.picks.flatMap((p, seat) => (p === null ? [name(seat)] : []));
  const last = s.history.at(-1);

  return (
    <div className="gk gln">
      <style>{KIT_CSS + LUN_CSS}</style>
      <ol className="gln-scores" aria-label={t("scores")}>
        {s.scores.map((points, seat) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per seat
          <li key={seat} style={seatStyle(seat)} data-picked={s.picks[seat] !== null || undefined}>
            {t("scoreLine", { name: name(seat), points })}
          </li>
        ))}
      </ol>
      {!done && (
        <section className="gln-pad-wrap" aria-label={t("pickTitle")}>
          <h2 className="gln-title">
            {t("roundN", { n: s.history.length + 1, total: s.config.rounds })}
          </h2>
          {last && (
            <p className="gln-last" aria-live="polite">
              {last.winner === null
                ? t("noWinner")
                : t("lastWinner", {
                    name: name(last.winner),
                    number: last.picks[last.winner] ?? 0,
                  })}
            </p>
          )}
          <div className="gln-pad" role="group" aria-label={t("pickTitle")}>
            {Array.from({ length: MAX }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className="gln-num"
                aria-pressed={mine === n}
                disabled={human === null || mine !== null}
                onClick={() => {
                  if (human !== null) session.act(human, { pick: n });
                }}
              >
                {n}
              </button>
            ))}
          </div>
          {choosing.length > 0 && (
            <p className="gln-status">{t("stillChoosing", { names: choosing.join(", ") })}</p>
          )}
        </section>
      )}
      {s.history.length > 0 && (
        <section className="gln-history" aria-label={t("rounds")}>
          <h2 className="gln-title">{t("rounds")}</h2>
          <ol reversed>
            {[...s.history].reverse().map((round, k) => {
              const index = s.history.length - k;
              return (
                <li key={index}>
                  <span className="gln-rn">{t("roundShort", { n: index })}</span>
                  <span className="gln-picks">
                    {round.picks.map((n, seat) => (
                      <span
                        // eslint-disable-next-line @eslint-react/no-array-index-key -- one pick per seat
                        key={seat}
                        className="gln-pick"
                        style={seatStyle(seat)}
                        data-won={round.winner === seat || undefined}
                        aria-label={t("pickOf", { name: name(seat), number: n })}
                        role="img"
                      >
                        {n}
                      </span>
                    ))}
                  </span>
                  <span className="gln-who">
                    {round.winner === null ? t("nobody") : name(round.winner)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {/* A pick made but hidden shows only that it's in. */}
      {s.picks.some((p) => p === SECRET) && <span className="gk-sr">{t("someIn")}</span>}
    </div>
  );
}

const LUN_CSS = `
.gln { max-width: 36rem; width: 100%; margin-inline: auto; align-content: start; }
.gln-scores { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.gln-scores li { padding: 0.25rem 0.65rem; border-radius: 999px; background: var(--surface-2); border-inline-start: 0.4rem solid var(--fill); font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.gln-scores li[data-picked] { outline: 2px solid var(--border-strong); }
.gln-pad-wrap { display: grid; justify-items: center; gap: 0.5rem; width: 100%; padding: 0.75rem; border-radius: 1rem; background: var(--surface-2); }
.gln-title { margin: 0; font-size: 1rem; }
.gln-last, .gln-status { margin: 0; color: var(--text-muted); font-size: 0.9rem; text-align: center; }
.gln-pad { display: grid; grid-template-columns: repeat(5, minmax(2.75rem, 3.5rem)); gap: 0.4rem; }
.gln-num { min-height: 2.75rem; border-radius: 0.75rem; border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 1.25rem; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums; }
.gln-num[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.gln-num:disabled:not([aria-pressed="true"]) { opacity: 0.45; cursor: default; }
.gln-num:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gln-history { width: 100%; }
.gln-history ol { display: grid; gap: 0.3rem; margin: 0.4rem 0 0; padding: 0; list-style: none; }
.gln-history li { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; border-radius: 0.6rem; background: var(--surface-2); font-size: 0.85rem; }
.gln-rn { color: var(--text-muted); min-width: 2.5rem; }
.gln-picks { display: flex; flex-wrap: wrap; gap: 0.25rem; flex: 1; }
.gln-pick { display: inline-grid; place-items: center; min-width: 1.6rem; height: 1.6rem; border-radius: 0.4rem; background: var(--surface); border-bottom: 0.25rem solid var(--fill); font-weight: 700; font-variant-numeric: tabular-nums; }
.gln-pick[data-won] { background: var(--brand); color: var(--on-brand); }
.gln-who { font-weight: 700; max-width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
