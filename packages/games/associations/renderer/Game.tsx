// Associations: the scores, this round's word, a field to write yours (the
// word you think the others will write), and every round so far with
// everyone's words and points, matches marked. Your word stays hidden until
// everyone has written. The field takes letters, digits, spaces,
// apostrophes and hyphens, up to 24; Enter sends it.
import { useState, useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback } from "@kefche/game-sdk/react";

import { MAX_LENGTH, validAnswer, type Action, type State } from "../engine";
import { promptsOf } from "./packs";

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
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      sounds.play(current.state.answered.every((a) => !a) ? "reveal" : "write");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const prompts = promptsOf(s.config.pack);
  const human = view.humanSeat;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const done = s.history.length >= s.config.rounds;
  const current = s.prompts[s.history.length];
  const mine = me === null ? null : (s.answers[me] ?? null);
  const written = s.answered.filter(Boolean).length;
  const canWrite = human !== null && human === me && mine === null && !done;

  const send = () => {
    if (human === null) return;
    if (!validAnswer(draft)) {
      setInvalid(true);
      return;
    }
    if (session.act(human, { answer: draft })) {
      setDraft("");
      setInvalid(false);
    }
  };

  return (
    <div className="gk gas">
      <style>{KIT_CSS + ASSOC_CSS}</style>
      <ol className="gas-scores" aria-label={t("scores")}>
        {s.scores.map((points, seat) => (
          <li
            // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per seat
            key={seat}
            style={seatStyle(seat)}
            data-written={s.answered[seat] === true || undefined}
          >
            {t("scoreLine", { name: name(seat), points })}
          </li>
        ))}
      </ol>
      {!done && current !== undefined && (
        <section
          className="gas-round"
          aria-label={t("roundN", { n: s.history.length + 1, total: s.config.rounds })}
        >
          <p className="gas-n">
            {t("roundN", { n: s.history.length + 1, total: s.config.rounds })}
          </p>
          <h2 className="gas-prompt">{prompts[current]?.word}</h2>
          <p className="gas-hint">{t("hint")}</p>
          {mine === null ? (
            <form
              className="gas-form"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label className="gk-sr" htmlFor="gas-word">
                {t("yourAnswer")}
              </label>
              <input
                id="gas-word"
                className="gas-input"
                value={draft}
                maxLength={MAX_LENGTH}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={!canWrite}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? "gas-invalid" : undefined}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setInvalid(false);
                }}
              />
              <button
                type="submit"
                className="gk-btn gas-send"
                disabled={!canWrite || draft.trim() === ""}
              >
                {t("send")}
              </button>
              {invalid && (
                <p id="gas-invalid" className="gas-error" role="alert">
                  {t("invalid")}
                </p>
              )}
            </form>
          ) : (
            <p className="gas-mine">
              {t("yourWord", { word: mine === "" ? t("noAnswer") : mine })}
            </p>
          )}
          <p className="gas-count">{t("writtenCount", { n: written, total: s.players })}</p>
        </section>
      )}
      {s.history.length > 0 && (
        <section className="gas-history" aria-label={t("rounds")}>
          <h2 className="gas-title">{t("rounds")}</h2>
          {[...s.history].reverse().map((round, k) => {
            const index = s.history.length - k;
            return (
              <div key={index} className="gas-past" aria-live={k === 0 ? "polite" : undefined}>
                <h3>{prompts[round.prompt]?.word}</h3>
                <ul>
                  {round.answers.map((word, seat) => (
                    <li
                      // eslint-disable-next-line @eslint-react/no-array-index-key -- one answer per seat
                      key={seat}
                      style={seatStyle(seat)}
                      data-match={(round.points[seat] ?? 0) > 0 || undefined}
                    >
                      {t("answerLine", {
                        name: name(seat),
                        word: word === "" ? t("noAnswer") : word,
                        points: round.points[seat] ?? 0,
                      })}
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

const ASSOC_CSS = `
.gas { max-width: 36rem; width: 100%; margin-inline: auto; align-content: start; }
.gas-scores { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.gas-scores li { padding: 0.25rem 0.65rem; border-radius: 999px; background: var(--surface-2); border-inline-start: 0.4rem solid var(--fill); font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.gas-scores li[data-written] { outline: 2px solid var(--border-strong); }
.gas-round { display: grid; justify-items: center; gap: 0.5rem; width: 100%; padding: 1rem; border-radius: 1rem; background: var(--surface-2); }
.gas-n, .gas-hint, .gas-count { margin: 0; color: var(--text-muted); font-size: 0.875rem; text-align: center; }
.gas-prompt { margin: 0; font-size: 2rem; font-weight: 800; text-align: center; }
.gas-form { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; width: 100%; }
.gas-input { flex: 1 1 12rem; min-width: 0; min-height: 2.75rem; padding: 0 0.75rem; border-radius: 0.75rem; border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font: inherit; font-size: 1.1rem; }
.gas-input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gas-input[aria-invalid] { border-color: var(--danger); }
.gas-error { flex-basis: 100%; margin: 0; color: var(--danger); font-size: 0.85rem; text-align: center; }
.gas-mine { margin: 0; font-weight: 700; }
.gas-title { margin: 0; font-size: 1rem; }
.gas-history { width: 100%; display: grid; gap: 0.5rem; }
.gas-past h3 { margin: 0 0 0.25rem; font-size: 0.95rem; }
.gas-past ul { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.gas-past li { padding: 0.25rem 0.6rem; border-radius: 0.6rem; background: var(--surface-2); border-inline-start: 0.35rem solid var(--fill); font-size: 0.85rem; }
.gas-past li[data-match] { font-weight: 700; outline: 2px solid var(--brand); }
`;
