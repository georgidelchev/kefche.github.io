// Who's the Spy: your role card (the location, or that you're the spy),
// then what this part of the round asks. Talking: questions in the room's
// chat (or aloud on one device), and "Ready to vote" when you've heard
// enough; the spy may name the location instead. Voting: pick who you think
// the spy is. Caught, the spy has one guess at the place. Every possible
// location is listed for everyone. Buttons are reachable with Tab.
import { useState, useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback } from "@kefche/game-sdk/react";

import { HIDDEN, type Action, type State } from "../engine";
import { locationsOf } from "./packs";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

/** Where the talking happens: the room chat online, aloud on one device. */
const TALK_KEYS = { online: "talkChat", hotseat: "talkAloud", "solo-bots": "talkAloud" } as const;

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [picked, setPicked] = useState<number | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      sounds.play(current.state.phase === "talk" ? "ready" : "vote");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const places = locationsOf(s.config.pack);
  const place = (i: number) => places[i] ?? "";
  const human = view.humanSeat;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const amSpy = me !== null && s.spy === me;
  const over = s.winner !== null;
  const act = (action: Action) => {
    if (human !== null) session.act(human, action);
  };
  const readyCount = s.ready.filter(Boolean).length;
  const votesIn = s.votes.filter((v) => v !== null).length;
  // The spy names the place while talking, or once caught.
  const canGuess = !over && amSpy && human === me && (s.phase === "talk" || s.phase === "guess");

  const role =
    me === null ? null : amSpy ? (
      <section className="gws-card" data-spy="" aria-label={t("yourRole")}>
        <h2>{t("roleSpy")}</h2>
        <p>{t("roleSpyHint")}</p>
      </section>
    ) : s.location !== HIDDEN ? (
      <section className="gws-card" aria-label={t("yourRole")}>
        <h2>{t("roleLocation", { place: place(s.location) })}</h2>
        <p>{t("roleLocationHint")}</p>
      </section>
    ) : null;

  return (
    <div className="gk gws">
      <style>{KIT_CSS + SPY_CSS}</style>
      {!over && role}
      {over && (
        <p className="gws-reveal" aria-live="polite">
          {t("reveal", { name: name(s.spy), place: place(s.location) })}
          {s.votes.every((v) => v !== null) &&
            (s.accused === null
              ? ` ${t("tie")}`
              : s.accused !== s.spy
                ? ` ${t("wrongVote", { name: name(s.accused) })}`
                : "")}
          {s.guess !== null && ` ${t("spyGuessed", { place: place(s.guess) })}`}
        </p>
      )}
      {!over && s.phase === "talk" && (
        <section className="gws-step">
          <p className="gws-hint">{t(TALK_KEYS[match?.mode ?? "hotseat"])}</p>
          <button
            type="button"
            className="gk-btn gws-ready"
            aria-pressed={me !== null && s.ready[me] === true}
            disabled={human === null || me === null || s.ready[me] === true}
            onClick={() => {
              act({ ready: true });
            }}
          >
            {t("ready")}
          </button>
          <p className="gws-count">{t("readyCount", { n: readyCount, total: s.players })}</p>
        </section>
      )}
      {!over && s.phase === "vote" && (
        <section className="gws-step" aria-label={t("votePrompt")}>
          <h2 className="gws-title">{t("votePrompt")}</h2>
          <div className="gws-votes" role="group" aria-label={t("votePrompt")}>
            {Array.from({ length: s.players }, (_, seat) => seat)
              .filter((seat) => seat !== me)
              .map((seat) => (
                <button
                  key={seat}
                  type="button"
                  className="gk-btn gws-vote"
                  style={seatStyle(seat)}
                  aria-pressed={me !== null && s.votes[me] === seat}
                  disabled={human === null || me === null || s.votes[me] !== null}
                  onClick={() => {
                    act({ vote: seat });
                  }}
                >
                  {name(seat)}
                </button>
              ))}
          </div>
          <p className="gws-count">{t("votesIn", { n: votesIn, total: s.players })}</p>
        </section>
      )}
      {!over && s.phase === "guess" && (
        <p className="gws-hint" aria-live="polite">
          {t("caught", { name: name(s.spy) })}
        </p>
      )}
      <section className="gws-places" aria-label={t("locations")}>
        <h2 className="gws-title">{canGuess ? t("nameIt") : t("locations")}</h2>
        <ul>
          {places.map((p, i) => (
            <li key={p}>
              {canGuess ? (
                <button
                  type="button"
                  className="gws-place"
                  aria-pressed={picked === i}
                  onClick={() => {
                    setPicked(i);
                  }}
                >
                  {p}
                </button>
              ) : (
                <span
                  className="gws-place"
                  data-here={(over || !amSpy) && i === s.location ? "" : undefined}
                >
                  {p}
                </span>
              )}
            </li>
          ))}
        </ul>
        {canGuess && picked !== null && (
          <button
            type="button"
            className="gk-btn gws-confirm"
            onClick={() => {
              act({ guess: picked });
            }}
          >
            {t("confirmGuess", { place: place(picked) })}
          </button>
        )}
      </section>
    </div>
  );
}

const SPY_CSS = `
.gws { max-width: 36rem; width: 100%; margin-inline: auto; align-content: start; }
.gws-card { display: grid; gap: 0.3rem; width: 100%; padding: 1rem; border-radius: 1rem; background: var(--surface-2); border: 2px solid var(--border-strong); text-align: center; }
.gws-card[data-spy] { border-color: var(--danger); }
.gws-card h2 { margin: 0; font-size: 1.35rem; }
.gws-card p { margin: 0; color: var(--text-muted); }
.gws-reveal { margin: 0; font-weight: 700; text-align: center; font-size: 1.05rem; }
.gws-step { display: grid; justify-items: center; gap: 0.5rem; width: 100%; }
.gws-title { margin: 0; font-size: 1rem; text-align: center; }
.gws-hint, .gws-count { margin: 0; color: var(--text-muted); text-align: center; font-size: 0.9rem; }
.gws-ready { min-width: 10rem; }
.gws-votes { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem; }
.gws-vote { border-inline-start: 0.4rem solid var(--fill); }
.gws-places { width: 100%; }
.gws-places ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.3rem; margin: 0.4rem 0 0; padding: 0; list-style: none; }
.gws-place { display: flex; align-items: center; width: 100%; min-height: 2.5rem; padding: 0.3rem 0.6rem; border-radius: 0.6rem; background: var(--surface-2); border: 2px solid transparent; color: var(--text); font: inherit; font-size: 0.875rem; text-align: start; }
button.gws-place { cursor: pointer; border-color: var(--border-strong); background: var(--surface); }
button.gws-place[aria-pressed="true"] { border-color: var(--brand); background: var(--surface-2); font-weight: 700; }
button.gws-place:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gws-place[data-here] { border-color: var(--brand); font-weight: 700; }
.gws-confirm { margin-top: 0.5rem; width: 100%; background: var(--danger); border-color: var(--danger); color: var(--on-danger); }
`;
