// Mafia: the narrator (day or night, and the story so far), your role card,
// what you do now, and everyone with what's known of them. Night: the Mafia
// choose who to eliminate (seeing each other's choices), the Doctor who to
// protect, the Detective who to check, the Villagers sleep. Day: talk in
// the room's chat (or aloud on one device), say you're ready, then vote for
// someone or no one. Buttons are reachable with Tab.
import { useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback } from "@kefche/game-sdk/react";

import { HIDDEN, NOBODY, engine, type Action, type Event, type Role, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const ROLE_KEYS = {
  mafia: "roleMafia",
  doctor: "roleDoctor",
  detective: "roleDetective",
  villager: "roleVillager",
} as const;
const ROLE_HINTS = {
  mafia: "hintMafia",
  doctor: "hintDoctor",
  detective: "hintDetective",
  villager: "hintVillager",
} as const;
const NIGHT_PROMPTS = {
  mafia: "nightMafia",
  doctor: "nightDoctor",
  detective: "nightDetective",
  villager: "nightVillager",
} as const;
const TALK_KEYS = { online: "talkChat", hotseat: "talkAloud", "solo-bots": "talkBots" } as const;

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const roleName = (r: Role) => t(ROLE_KEYS[r]);

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      sounds.play(current.state.phase === "night" ? "night" : "day");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const human = view.humanSeat;
  const me = view.viewer ?? (yourSeat(match) >= 0 ? yourSeat(match) : null);
  const myRole = me === null ? undefined : s.roles[me];
  const role = myRole === HIDDEN ? undefined : myRole;
  const over = s.winner !== null;
  const actions = human === null ? [] : engine.legalActions(s, human);
  const act = (a: Action) => {
    if (human !== null) session.act(human, a);
  };
  const aliveCount = s.alive.filter(Boolean).length;

  const story = (e: Event) => {
    switch (e.kind) {
      case "killed":
        return t("storyKilled", { day: e.day, name: name(e.seat), role: roleName(e.role) });
      case "saved":
        return t("storySaved", { day: e.day });
      case "executed":
        return t("storyExecuted", { day: e.day, name: name(e.seat), role: roleName(e.role) });
      case "spared":
        return t("storySpared", { day: e.day });
    }
  };
  const votesOf = (e: Event) =>
    e.kind === "executed" || e.kind === "spared"
      ? e.votes
          .flatMap((v, voter) =>
            v === NOBODY && !(e.kind === "executed" && voter === e.seat)
              ? []
              : [
                  t("voteLine", {
                    voter: name(voter),
                    target: v === NOBODY ? t("nobody") : name(v),
                  }),
                ],
          )
          .join(" · ")
      : "";

  const targets = actions.flatMap((a) => ("target" in a ? [a.target] : []));
  const voteTargets = actions.flatMap((a) => ("vote" in a ? [a.vote] : []));
  const mafiaPartners =
    role === "mafia" ? s.roles.flatMap((r, x) => (r === "mafia" && x !== me ? [x] : [])) : [];

  return (
    <div className="gk gmf">
      <style>{KIT_CSS + MAFIA_CSS}</style>
      <p className="gmf-phase" data-night={s.phase === "night" || undefined} aria-live="polite">
        {over
          ? t(s.winner === "town" ? "townWins" : s.winner === "mafia" ? "mafiaWins" : "drawEnd")
          : s.phase === "night"
            ? t("phaseNight", { day: s.day })
            : t("phaseDay", { day: s.day })}
      </p>
      {me !== null && role && (
        <section className="gmf-card" data-role={role} aria-label={t("yourRole")}>
          <h2>{t("youAre", { role: roleName(role) })}</h2>
          <p>{t(ROLE_HINTS[role])}</p>
          {mafiaPartners.length > 0 && (
            <p>{t("partners", { names: mafiaPartners.map(name).join(", ") })}</p>
          )}
          {role === "detective" && s.checks.length > 0 && (
            <ul className="gmf-checks" aria-label={t("checksTitle")}>
              {s.checks.map((c) => (
                <li key={c.seat}>
                  {t(c.mafia ? "checkMafia" : "checkClear", { name: name(c.seat) })}
                </li>
              ))}
            </ul>
          )}
          {s.alive[me] === false && <p className="gmf-out">{t("youAreOut")}</p>}
        </section>
      )}
      {!over && human !== null && role && s.phase === "night" && (
        <section className="gmf-step" aria-label={t(NIGHT_PROMPTS[role])}>
          <h2 className="gmf-title">{t(NIGHT_PROMPTS[role])}</h2>
          {targets.length > 0 ? (
            <div className="gmf-buttons" role="group" aria-label={t(NIGHT_PROMPTS[role])}>
              {targets.map((x) => {
                const partnerPick = mafiaPartners.some((p) => s.night[p] === x);
                return (
                  <button
                    key={x}
                    type="button"
                    className="gk-btn gmf-pick"
                    style={seatStyle(x)}
                    data-partner={partnerPick || undefined}
                    onClick={() => {
                      act({ target: x });
                    }}
                  >
                    {name(x)}
                    {partnerPick && <span className="gk-sr">{` ${t("partnerChose")}`}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            actions.length > 0 && (
              <button
                type="button"
                className="gk-btn"
                onClick={() => {
                  act({ sleep: true });
                }}
              >
                {t("sleep")}
              </button>
            )
          )}
        </section>
      )}
      {!over && s.phase === "talk" && (
        <section className="gmf-step">
          <p className="gmf-hint">{t(TALK_KEYS[match?.mode ?? "hotseat"])}</p>
          {me !== null && s.alive[me] === true && (
            <button
              type="button"
              className="gk-btn"
              aria-pressed={s.ready[me] === true}
              disabled={human === null || s.ready[me] === true}
              onClick={() => {
                act({ ready: true });
              }}
            >
              {t("ready")}
            </button>
          )}
          <p className="gmf-count">
            {t("readyCount", {
              n: s.ready.filter((r, x) => r && s.alive[x]).length,
              total: aliveCount,
            })}
          </p>
        </section>
      )}
      {!over && s.phase === "vote" && human !== null && voteTargets.length > 0 && (
        <section className="gmf-step" aria-label={t("votePrompt")}>
          <h2 className="gmf-title">{t("votePrompt")}</h2>
          <div className="gmf-buttons" role="group" aria-label={t("votePrompt")}>
            {voteTargets.map((x) => (
              <button
                key={x}
                type="button"
                className="gk-btn gmf-pick"
                style={x === NOBODY ? undefined : seatStyle(x)}
                onClick={() => {
                  act({ vote: x });
                }}
              >
                {x === NOBODY ? t("nobody") : name(x)}
              </button>
            ))}
          </div>
        </section>
      )}
      {!over && s.phase !== "talk" && human === null && me !== null && s.alive[me] === true && (
        <p className="gmf-hint">{t("waiting")}</p>
      )}
      <ul className="gmf-people" aria-label={t("players")}>
        {s.roles.map((r, x) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per seat
          <li key={x} style={seatStyle(x)} data-dead={!s.alive[x] || undefined}>
            <strong>{name(x)}</strong>
            <span>
              {[
                s.alive[x] ? "" : t("out"),
                r !== HIDDEN && (!s.alive[x] || x === me || r === "mafia") ? roleName(r) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      {s.events.length > 0 && (
        <section className="gmf-story" aria-label={t("story")}>
          <h2 className="gmf-title">{t("story")}</h2>
          <ol reversed>
            {[...s.events].reverse().map((e, k) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- the story in order
              <li key={s.events.length - k}>
                <p>{story(e)}</p>
                {votesOf(e) && <p className="gmf-votes">{votesOf(e)}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

const MAFIA_CSS = `
.gmf { max-width: 36rem; width: 100%; margin-inline: auto; align-content: start; }
.gmf-phase { margin: 0; padding: 0.4rem 1rem; border-radius: 999px; background: var(--surface-2); font-weight: 800; }
.gmf-phase[data-night] { background: var(--text); color: var(--bg); }
.gmf-card { display: grid; gap: 0.3rem; width: 100%; padding: 0.9rem; border-radius: 1rem; background: var(--surface-2); border: 2px solid var(--border-strong); text-align: center; }
.gmf-card[data-role="mafia"] { border-color: var(--danger); }
.gmf-card h2 { margin: 0; font-size: 1.3rem; }
.gmf-card p { margin: 0; color: var(--text-muted); }
.gmf-checks { margin: 0; padding: 0; list-style: none; font-weight: 600; }
.gmf-out { font-weight: 700; color: var(--danger); }
.gmf-step { display: grid; justify-items: center; gap: 0.5rem; width: 100%; }
.gmf-title { margin: 0; font-size: 1rem; text-align: center; }
.gmf-hint, .gmf-count { margin: 0; color: var(--text-muted); text-align: center; font-size: 0.9rem; }
.gmf-buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem; }
.gmf-pick { border-inline-start: 0.4rem solid var(--fill, var(--border-strong)); }
.gmf-pick[data-partner] { outline: 2px dashed var(--danger); }
.gmf-people { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); gap: 0.3rem; width: 100%; margin: 0; padding: 0; list-style: none; }
.gmf-people li { display: grid; padding: 0.35rem 0.6rem; border-radius: 0.6rem; background: var(--surface-2); border-inline-start: 0.4rem solid var(--fill); font-size: 0.85rem; }
.gmf-people li[data-dead] { opacity: 0.6; text-decoration: line-through; }
.gmf-people span { color: var(--text-muted); font-size: 0.8rem; }
.gmf-story { width: 100%; }
.gmf-story ol { display: grid; gap: 0.3rem; margin: 0.4rem 0 0; padding: 0; list-style: none; }
.gmf-story li { padding: 0.4rem 0.6rem; border-radius: 0.6rem; background: var(--surface-2); font-size: 0.875rem; }
.gmf-story p { margin: 0; }
.gmf-votes { color: var(--text-muted); font-size: 0.8rem; margin-top: 0.2rem; }
`;
