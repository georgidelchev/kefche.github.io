// War table: the other player's pile at the top, yours at the bottom, and
// the battle between them (face-down war cards under the face-up ones).
// Flip with the button (or Enter on it); "Play by itself" flips for you, as
// soon as it's your turn. The table stays left to right in every language.
import { useEffect, useState, useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  CARD_CSS,
  CardBacks,
  cardText,
  FourColourToggle,
  KIT_CSS,
  PlayingCard,
  seatStyle,
  useFourColour,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { total, type Action, type Battle, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const AUTO_KEY = "auto";
/** A flip "by itself" waits this long, so each battle can be seen. */
const AUTO_MS = 450;
/** At most this many backs are drawn for a pile; the count says the rest. */
const PILE_BACKS = 8;

export function Game({ context, store, session, sounds }: Props) {
  const { t, match, storage } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const text = cardText(t);
  const [four] = useFourColour();
  const [auto, setAuto] = useState(() => storage.get(AUTO_KEY) === "1");
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const state = view?.state ?? null;
  const human = view?.humanSeat ?? null;
  const you = yourSeat(match);
  const bottom: 0 | 1 = you === 1 ? 1 : 0;
  const top: 0 | 1 = bottom === 0 ? 1 : 0;

  useTurnFeedback({
    context,
    view,
    moves: state?.moves ?? 0,
    sounds,
    onMove: (current) => {
      const { battle, last } = current.state;
      const war = battle.down[0].length > 0 && battle.up[0].length === battle.up[1].length;
      sounds.play(war ? "war" : last && battle.up[0].length === 0 ? "take" : "flip");
    },
  });

  // Playing by itself: flip as soon as it's this player's turn.
  const moves = state?.moves ?? -1;
  useEffect(() => {
    if (!auto || human === null) return;
    const timer = setTimeout(() => session.act(human, { flip: true }), AUTO_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [auto, human, moves, session]);

  if (!state) return <div className="gwar" aria-busy="true" />;

  // What's on the table: a war being fought (both have cards in it), or
  // the last battle decided (one card flipped face down waits its turn).
  const fighting = state.battle.up[0].length > 0 && state.battle.up[1].length > 0;
  const waiting = ([0, 1] as const).filter((s) => state.flipped[s] && !fighting);
  const shown: Battle | null = fighting ? state.battle : state.last;
  const war = shown !== null && shown.down[0].length > 0;
  const taken = shown?.winner ?? null;
  const takenCount = shown
    ? shown.up[0].length + shown.up[1].length + shown.down[0].length + shown.down[1].length
    : 0;
  const announcement =
    taken !== null
      ? t("takes", { name: name(taken), count: takenCount })
      : war && fighting
        ? t("war")
        : "";
  const battleLabel =
    state.limit >= 1000
      ? t("battleCount", { n: state.battles })
      : t("battleOf", { n: state.battles, total: state.limit });

  const side = (seat: 0 | 1) => (
    <div className="gwar-side" style={seatStyle(seat)} data-seat={seat}>
      <div className="gwar-who">
        <strong>{name(seat)}</strong>
        <span>{t("cards", { count: total(state, seat) })}</span>
      </div>
      {waiting.includes(seat) && <span className="gk-chip">{t("ready")}</span>}
      <CardBacks
        count={Math.min(PILE_BACKS, total(state, seat))}
        label={t("cards", { count: total(state, seat) })}
      />
    </div>
  );

  const played = (seat: 0 | 1) => {
    const up = shown?.up[seat] ?? [];
    const down = shown?.down[seat] ?? [];
    return (
      <div className="gwar-played" data-won={taken === seat || undefined}>
        {down.length > 0 && (
          <CardBacks count={down.length} label={t("faceDown", { count: down.length })} />
        )}
        <div className="gwar-up">
          {up.map((c, i) => (
            <PlayingCard
              // Face-up cards are told apart by their order in the battle.
              // eslint-disable-next-line @eslint-react/no-array-index-key -- a hidden card has no identity
              key={i}
              card={c}
              four={four}
              label={text.name(c)}
            />
          ))}
          {up.length === 0 && <span className="gwar-slot" aria-hidden="true" />}
        </div>
      </div>
    );
  };

  return (
    <div className="gk gwar" dir="ltr">
      <style>{KIT_CSS + CARD_CSS + WAR_CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{battleLabel}</span>
        {war && <span className="gk-chip gwar-war">{t("war")}</span>}
      </div>
      {side(top)}
      <div className="gwar-battle">
        {played(top)}
        {played(bottom)}
      </div>
      {side(bottom)}
      <div className="gk-bar">
        <button
          type="button"
          className="gk-btn gwar-flip"
          disabled={human === null}
          onClick={() => {
            if (human !== null) session.act(human, { flip: true });
          }}
        >
          {match?.mode === "hotseat" && human !== null
            ? t("flipFor", { name: name(human) })
            : t("flip")}
        </button>
        <button
          type="button"
          className="gk-btn"
          aria-pressed={auto}
          onClick={() => {
            storage.set(AUTO_KEY, auto ? "0" : "1");
            setAuto(!auto);
          }}
        >
          {t("auto")}
        </button>
        <FourColourToggle label={text.fourColour} />
      </div>
      <p className="gk-sr" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

const WAR_CSS = `
.gwar { --card-w: clamp(3.25rem, 16vw, 5rem); max-width: 34rem; margin-inline: auto; }
.gwar-side { display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%; padding: 0.4rem 0.75rem; border-radius: 0.75rem; background: var(--surface-2); border-inline-start: 0.4rem solid var(--fill); }
.gwar-who { display: grid; gap: 0.1rem; }
.gwar-who span { color: var(--text-muted); font-size: 0.875rem; font-variant-numeric: tabular-nums; }
.gwar-battle { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%; min-height: calc(var(--card-w) * 1.6); align-items: center; }
.gwar-played { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; padding: 0.5rem; border-radius: 0.75rem; border: 2px solid transparent; }
.gwar-played[data-won] { border-color: var(--success); }
.gwar-up { display: flex; }
.gwar-up .gk-card + .gk-card { margin-inline-start: calc(var(--card-w) * -0.55); }
.gwar-slot { display: block; width: var(--card-w); aspect-ratio: 60 / 84; border-radius: 0.4rem; border: 2px dashed var(--border-strong); }
.gwar-war { background: var(--danger); color: var(--on-danger); }
.gwar-flip { min-width: 8rem; font-size: 1.05rem; }
`;
