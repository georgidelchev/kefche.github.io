// Memory Match board. The menu offers play alone (12, 20 or 30 cards, with
// the best time of each) and play together on this device: 2–4 players,
// friends taking turns or bots that remember what they've seen. Alone and
// in a race every flip is logged and the finish reported; together is a
// local game and records nothing. A missed pair shows for a moment, then
// turns face down. Cards are buttons: Tab or the arrow keys move, Enter or
// Space flips. The table stays left to right in every language.
import { createElement, useEffect, useRef, useState, type CSSProperties } from "react";

import { Rng } from "@kefche/game-sdk";
import { formatDuration, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  bestTime,
  KIT_CSS,
  mountPuzzle,
  useGridFocus,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  configFrom,
  engine,
  LAYOUT,
  partyFlip,
  partyWinners,
  SIZES,
  startParty,
  type Config,
  type Outcome,
  type Party,
  type Size,
  type Table,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";
import { SYMBOLS } from "./symbols";
import { chooseFlip, RECALL, remember, type Difficulty, type Memory } from "../engine/bots";

const timeKey = (config: Config) => String(config.cards);
/** How long a missed pair stays face up, and a bot's pause before a flip. */
const SHOW_MS = 1100;
const BOT_MS = 700;
const SEAT_COLOURS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea"];

type Opponents = "friends" | Difficulty;
interface Together {
  cards: Size;
  players: number;
  opponents: Opponents;
}

function Menu({
  context,
  onAlone,
  onTogether,
}: {
  context: GameContext;
  onAlone: (config: Config) => void;
  onTogether: (setup: Together) => void;
}) {
  const { t } = context;
  const [setup, setSetup] = useState<Together>({ cards: 20, players: 2, opponents: "medium" });
  const segment = <K extends keyof Together>(
    key: K,
    legend: string,
    values: readonly { value: Together[K]; label: string }[],
  ) => (
    <fieldset className="gmm-seg">
      <legend>{legend}</legend>
      <div>
        {values.map((v) => (
          <label key={String(v.value)}>
            <input
              type="radio"
              name={`gmm-${key}`}
              checked={setup[key] === v.value}
              onChange={() => {
                setSetup({ ...setup, [key]: v.value });
              }}
            />
            <span>{v.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div className="gk gk-menu gmm-menu">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <h3 className="gk-title">{t("aloneTitle")}</h3>
      {SIZES.map((cards) => {
        const best = bestTime(context.storage, String(cards));
        return (
          <button
            key={cards}
            type="button"
            className="gk-choice"
            onClick={() => {
              onAlone({ cards });
            }}
          >
            <span>{t("cardsLabel", { cards })}</span>
            {best !== null && <small>{t("best", { time: formatDuration(best) })}</small>}
          </button>
        );
      })}
      <h3 className="gk-title">{t("togetherTitle")}</h3>
      {segment(
        "cards",
        t("cards"),
        SIZES.map((cards) => ({ value: cards, label: String(cards) })),
      )}
      {segment(
        "players",
        t("players"),
        [2, 3, 4].map((n) => ({ value: n, label: String(n) })),
      )}
      {segment("opponents", t("opponents"), [
        { value: "friends", label: t("friends") },
        { value: "easy", label: t("easy") },
        { value: "medium", label: t("medium") },
        { value: "hard", label: t("hard") },
      ])}
      <button
        type="button"
        className="gk-btn gmm-start"
        onClick={() => {
          onTogether(setup);
        }}
      >
        {t("start")}
      </button>
    </div>
  );
}

function Cards({
  context,
  table,
  cards,
  hidden,
  disabled,
  onFlip,
}: {
  context: GameContext;
  table: Table;
  cards: Size;
  /** Cards shown face down although still up (a missed pair after its moment). */
  hidden: readonly number[];
  disabled: boolean;
  onFlip: (card: number) => void;
}) {
  const { t } = context;
  const [cols, rows] = LAYOUT[cards];
  const grid = useGridFocus({
    cols,
    rows,
    initial: 0,
    onActivate: (card) => {
      if (!disabled) onFlip(card);
    },
  });
  return (
    <div
      className="gmm-board"
      role="grid"
      aria-label={t("boardLabel")}
      style={{ "--cols": String(cols), "--rows": String(rows) } as CSSProperties}
    >
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} role="row" className="gmm-row">
          {Array.from({ length: cols }, (__, c) => {
            const card = r * cols + c;
            const symbol = table.symbols[card] ?? 0;
            const faceUp =
              table.matched[card] === true || (table.up.includes(card) && !hidden.includes(card));
            const focus = grid.cellProps(card);
            const art = SYMBOLS[symbol % SYMBOLS.length];
            return (
              <div key={card} role="gridcell" className="gmm-cell">
                <button
                  type="button"
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  className="gmm-card"
                  data-up={faceUp ? "" : undefined}
                  data-matched={table.matched[card] ? "" : undefined}
                  aria-label={
                    faceUp
                      ? t("cardUp", {
                          number: card + 1,
                          symbol: t(`symbol${String(symbol % SYMBOLS.length)}`),
                        })
                      : t("cardDown", { number: card + 1 })
                  }
                  aria-disabled={disabled || table.matched[card] ? true : undefined}
                  onClick={() => {
                    if (!disabled) onFlip(card);
                  }}
                >
                  {faceUp && art && (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      style={{ color: art.colour, fill: art.colour }}
                    >
                      {art.draw}
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** A missed pair turns face down after a moment (only how it looks: the next flip does it for real). */
function useHiddenMiss(table: Table | null) {
  const [hidden, setHidden] = useState<number[]>([]);
  const key = table?.up.length === 2 ? table.up.join() : "";
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => {
      setHidden(key.split(",").map(Number));
    }, SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [key]);
  return key ? hidden.filter((c) => key.split(",").map(Number).includes(c)) : [];
}

function feedback(outcome: Outcome, sounds: Sounds, context: GameContext) {
  if (outcome === "first") sounds.play("flip");
  else if (outcome === "match") {
    sounds.play("match");
    vibrate(HAPTICS.tap, context.settings.haptics);
  } else if (outcome === "miss") sounds.play("miss");
}

function PartyGame({
  context,
  seed,
  setup,
  sounds,
  onMenu,
}: {
  context: GameContext;
  seed: string;
  setup: Together;
  sounds: Sounds;
  onMenu: () => void;
}) {
  const { t } = context;
  const [round, setRound] = useState(0);
  const [party, setParty] = useState<Party>(() =>
    startParty(setup.cards, setup.players, `${seed}:party:0`),
  );
  const memoryRef = useRef<Memory[]>(
    Array.from({ length: setup.players }, (): Memory => new Map()),
  );
  const [rng] = useState(() => Rng.fromSeed(`${seed}:bots`));
  const hidden = useHiddenMiss(party);
  const bot = (seat: number) => setup.opponents !== "friends" && seat > 0;
  const name = (seat: number) =>
    bot(seat) ? t("botName", { number: seat }) : t("playerName", { number: seat + 1 });
  const winners = partyWinners(party);

  function play(card: number) {
    const { party: next, outcome } = partyFlip(party, card);
    if (outcome === "none") return;
    feedback(outcome, sounds, context);
    if (setup.opponents !== "friends") {
      const recall = RECALL[setup.opponents];
      memoryRef.current = memoryRef.current.map((m, seat) =>
        seat > 0 ? remember(m, next, card, recall, rng) : m,
      );
    }
    if (partyWinners(next)) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    }
    setParty(next);
  }

  // A bot's turn: a pause, then a flip (longer after a miss, so it can be seen).
  const botTurn = !winners && bot(party.turn);
  useEffect(() => {
    if (!botTurn) return;
    const timer = setTimeout(
      () => {
        play(chooseFlip(memoryRef.current[party.turn] ?? new Map<number, number>(), party, rng));
      },
      party.up.length === 2 ? SHOW_MS + 200 : BOT_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  });

  return (
    <div className="gk gmm">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ol className="gmm-seats" aria-label={t("scores")}>
        {party.pairs.map((pairs, seat) => (
          <li
            // eslint-disable-next-line @eslint-react/no-array-index-key -- seats are positional
            key={seat}
            className="gmm-seat"
            data-turn={seat === party.turn && !winners ? "" : undefined}
            style={{ "--seat": SEAT_COLOURS[seat] } as CSSProperties}
          >
            <span aria-hidden="true">{name(seat)}</span> <strong aria-hidden="true">{pairs}</strong>
            <span className="gk-sr">{t("seatScore", { name: name(seat), pairs })}</span>
          </li>
        ))}
      </ol>
      <p className="gmm-status" role="status">
        {winners
          ? winners.length > 1
            ? t("tie")
            : t("wins", { name: name(winners[0] ?? 0) })
          : t("turn", { name: name(party.turn) })}
      </p>
      <Cards
        context={context}
        table={party}
        cards={setup.cards}
        hidden={hidden}
        disabled={botTurn || winners !== null}
        onFlip={play}
      />
      <div className="gmm-actions">
        {winners && (
          <button
            type="button"
            className="gk-btn"
            onClick={() => {
              const next = round + 1;
              setRound(next);
              memoryRef.current = Array.from({ length: setup.players }, (): Memory => new Map());
              setParty(startParty(setup.cards, setup.players, `${seed}:party:${String(next)}`));
            }}
          >
            {t("again")}
          </button>
        )}
        <button type="button" className="gk-btn" onClick={onMenu}>
          {t("menu")}
        </button>
      </div>
    </div>
  );
}

function Game({
  context,
  seed,
  handle,
  sounds,
}: {
  context: GameContext;
  seed: string;
  handle: PuzzleHandle;
  sounds: Sounds;
}) {
  const { t } = context;
  const puzzle = usePuzzle({ context, seed, handle, engine, raceConfig: configFrom, timeKey });
  const [together, setTogether] = useState<Together | null>(null);
  const hidden = useHiddenMiss(puzzle.state);

  if (together) {
    return (
      <PartyGame
        context={context}
        seed={seed}
        setup={together}
        sounds={sounds}
        onMenu={() => {
          setTogether(null);
        }}
      />
    );
  }
  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return <Menu context={context} onAlone={puzzle.start} onTogether={setTogether} />;
  }
  const state = puzzle.state;
  if (!state) return null;
  const pairs = state.matched.filter(Boolean).length / 2;
  return (
    <div className="gk gmm">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t("cardsLabel", { cards: state.cards })}</span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("flips")}</span> <strong>{state.flips}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("pairs")}</span>{" "}
          <strong>{t("pairsOf", { pairs, total: state.cards / 2 })}</strong>
        </span>
      </div>
      <Cards
        context={context}
        table={state}
        cards={state.cards}
        hidden={hidden}
        disabled={puzzle.screen !== "playing"}
        onFlip={(card) => {
          const before = puzzle.state;
          const next = puzzle.dispatch({ flip: card });
          if (!next || !before) return;
          const outcome: Outcome =
            next.matched.filter(Boolean).length > before.matched.filter(Boolean).length
              ? "match"
              : next.up.length === 2
                ? "miss"
                : "first";
          feedback(outcome, sounds, context);
          if (engine.result(next)) {
            sounds.play("win");
            vibrate(HAPTICS.win, context.settings.haptics);
          }
        }}
      />
      {puzzle.screen === "over" && (
        <p role="status" className="gmm-status">
          {t("clearedIn", { flips: state.flips })} {puzzle.newBest ? t("newBest") : ""}
        </p>
      )}
      {puzzle.screen === "playing" && !puzzle.racing && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("menu")}
        </button>
      )}
    </div>
  );
}

export function mount(container: HTMLElement, context: GameContext) {
  const sounds = createSounds(context);
  sounds.preload();
  return mountPuzzle(
    container,
    context,
    (seed, handle) => createElement(Game, { context, seed, handle, sounds }),
    () => {
      sounds.dispose();
    },
  );
}

const CSS = `
.gmm-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--rows), minmax(0, 1fr)); gap: 0.4rem; width: min(100%, 30rem, calc((100dvh - 16rem) * var(--cols) / var(--rows))); aspect-ratio: var(--cols) / var(--rows); }
.gmm-row { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 0.4rem; }
.gmm-cell { display: grid; }
.gmm-card { display: grid; place-items: center; width: 100%; height: 100%; padding: 12%; border-radius: 0.6rem; border: 2px solid #1e3a8a; background: repeating-linear-gradient(45deg, #2b4fb3 0 6px, #3560d0 6px 12px); cursor: pointer; transition: transform 0.15s; }
.gmm-card[data-up] { background: #fffdf7; border-color: #c9c2b0; }
.gmm-card[data-matched] { background: #eef7ef; border-color: #6fbf73; cursor: default; }
.gmm-card[aria-disabled] { cursor: default; }
.gmm-card:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.gmm-card svg { width: 100%; height: 100%; }
@media (prefers-reduced-motion: no-preference) { .gmm-card:not([aria-disabled]):active { transform: scale(0.95); } }
.gmm-status { margin: 0; font-weight: 600; text-align: center; }
.gmm-seats { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; }
.gmm-seat { display: flex; gap: 0.35rem; align-items: center; padding: 0.3rem 0.7rem; border-radius: 999px; border: 2px solid var(--seat); background: var(--surface); font-size: 0.9rem; }
.gmm-seat[data-turn] { background: var(--seat); color: #fff; }
.gmm-actions { display: flex; gap: 0.5rem; justify-content: center; }
.gmm-menu { width: 100%; max-height: 100%; overflow-y: auto; }
.gmm-seg { border: 0; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
.gmm-seg legend { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.3rem; }
.gmm-seg > div { display: flex; gap: 0.25rem; padding: 0.25rem; border-radius: 0.75rem; background: var(--surface-2); }
.gmm-seg label { flex: 1; }
.gmm-seg input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.gmm-seg span { display: flex; min-height: 2.75rem; align-items: center; justify-content: center; border-radius: 0.55rem; font-weight: 600; font-size: 0.9rem; color: var(--muted); cursor: pointer; text-align: center; padding-inline: 0.4rem; }
.gmm-seg input:checked + span { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / 0.15); }
.gmm-seg input:focus-visible + span { outline: 2px solid var(--focus); outline-offset: 2px; }
.gmm-start { min-height: 3rem; }
`;
