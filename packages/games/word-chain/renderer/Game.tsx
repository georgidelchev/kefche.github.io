// Word Chain: the players with their lives (hearts and a number), the
// letter the next word must start with, large, and the chain so far, newest
// first. On your turn, type a word: it's checked as you type (a word, the
// wrong first letter, used already, not in the dictionary), and Enter or
// the button plays it. Stuck, pass and lose a life.
import { useState, useSyncExternalStore } from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback, WORD_CSS, WordInput } from "@kefche/game-sdk/react";

import { judge, LIVES, type Action, type State, type Verdict } from "../engine";

import type { Sounds } from "./sounds";

const VERDICT_KEYS: Readonly<Record<Verdict, string>> = {
  ok: "verdictOk",
  short: "verdictShort",
  letter: "verdictLetter",
  used: "verdictUsed",
  unknown: "verdictUnknown",
};

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
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const action = current.lastMove?.action;
      const seat = current.lastMove?.seat;
      if (!action || !("pass" in action)) sounds.play("word");
      else sounds.play(seat !== undefined && current.state.lives[seat] === 0 ? "out" : "pass");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const pack = s.config.pack;
  const human = view.humanSeat;
  const done = view.result !== null;
  const mine = !done && human !== null && human === s.turn;
  const verdict = draft === "" ? null : judge(s, draft);
  const up = (w: string) => w.toLocaleUpperCase(pack);

  const play = () => {
    if (!mine || verdict !== "ok") return;
    if (session.act(s.turn, { word: draft })) setDraft("");
  };

  return (
    <div className="gk gwc">
      <style>{KIT_CSS + WORD_CSS + CSS}</style>
      <ol className="gwc-players" aria-label={t("players")}>
        {s.lives.map((lives, seat) => (
          <li
            // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per seat
            key={seat}
            style={seatStyle(seat)}
            data-turn={!done && seat === s.turn ? "" : undefined}
            data-out={lives === 0 ? "" : undefined}
          >
            <span>{name(seat)}</span>{" "}
            <span aria-hidden="true">
              {"♥".repeat(lives)}
              <span className="gwc-lost">{"♡".repeat(LIVES - lives)}</span>
            </span>
            <span className="gk-sr">{t("livesLeft", { n: lives })}</span>
          </li>
        ))}
      </ol>
      {!done && (
        <div className="gwc-letter" aria-live="polite">
          <span>{t("startsWith")}</span>
          <strong dir="ltr">{up(s.letter)}</strong>
        </div>
      )}
      {mine ? (
        <form
          className="gwc-play"
          onSubmit={(event) => {
            event.preventDefault();
            play();
          }}
        >
          <WordInput
            lang={pack}
            value={draft}
            onChange={setDraft}
            onSubmit={play}
            label={t("yourWord")}
            maxLength={24}
            takeFocus
          />
          <p className="gwc-hint" role="status">
            {verdict === null
              ? t("yourTurn", { letter: up(s.letter) })
              : t(VERDICT_KEYS[verdict], { letter: up(s.letter) })}
          </p>
          <div className="gk-bar">
            <button
              type="button"
              className="gk-btn"
              onClick={() => {
                session.act(s.turn, { pass: true });
                setDraft("");
              }}
            >
              {t("pass")}
            </button>
            <button type="submit" className="gk-btn" data-primary="" disabled={verdict !== "ok"}>
              {t("playWord")}
            </button>
          </div>
        </form>
      ) : (
        !done && (
          <p className="gwc-hint" role="status">
            {t("thinking", { name: name(s.turn) })}
          </p>
        )
      )}
      {s.words.length > 0 && (
        <ol className="gwc-chain" aria-label={t("chain")} reversed>
          {s.words
            .map((w, i) => ({ w, by: s.by[i] ?? 0 }))
            .reverse()
            .slice(0, 16)
            .map(({ w, by }) => (
              <li key={w} style={seatStyle(by)}>
                <strong dir="ltr">{up(w)}</strong> <span>{name(by)}</span>
              </li>
            ))}
        </ol>
      )}
      {done && <p className="gwc-hint">{t("wordsSaid", { n: s.words.length })}</p>}
    </div>
  );
}

const CSS = `
.gwc { max-width: 34rem; margin-inline: auto; }
.gwc-players { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem 0.6rem; margin: 0; padding: 0; list-style: none; }
.gwc-players li { padding: 0.15rem 0.6rem; border-radius: 999px; border: 2px solid var(--fill, var(--border)); }
.gwc-players li[data-turn] { background: var(--surface-2); font-weight: 700; }
.gwc-players li[data-out] { border-style: dashed; color: var(--text-muted); text-decoration: line-through; }
.gwc-players li > span:nth-child(2) { color: var(--danger); letter-spacing: 0.1em; }
.gwc-lost { color: var(--text-muted); }
.gwc-letter { display: grid; justify-items: center; gap: 0.2rem; }
.gwc-letter span { color: var(--text-muted); }
.gwc-letter strong { display: grid; place-items: center; width: 4.5rem; height: 4.5rem; border-radius: 1rem; background: var(--brand); color: var(--on-brand); font-size: 2.75rem; line-height: 1; }
.gwc-play { display: grid; justify-items: center; gap: 0.5rem; width: 100%; }
.gwc-hint { margin: 0; min-height: 1.5rem; text-align: center; font-weight: 600; }
.gk-btn[data-primary] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.gwc-chain { display: grid; gap: 0.25rem; width: 100%; max-width: 22rem; margin: 0; padding: 0; list-style: none; }
.gwc-chain li { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 0.6rem; border-inline-start: 4px solid var(--fill, var(--border)); background: var(--surface); }
.gwc-chain li span { color: var(--text-muted); }
`;
