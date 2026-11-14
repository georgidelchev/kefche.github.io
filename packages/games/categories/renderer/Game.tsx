// Categories: the scores, the round's letter, large, and then by phase:
// - Answering: a field for each of the game's six categories (typed, with a
//   warning when an answer doesn't start with the letter) and Done. Enter
//   moves to the next field. Others' answers stay hidden until all are in.
// - Voting: each doubtful answer with Counts and Doesn't count (your own are
//   shown, for the others to judge), and Done voting.
// - Every finished round: each category's answers, marked, with the points.
// With a clock on, what's been typed or chosen is sent just before time runs
// out. Everything is reachable with Tab; buttons take Enter or Space.
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { charsOf } from "@kefche/game-sdk";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import { KIT_CSS, seatStyle, useTurnFeedback, WORD_CSS, WordInput } from "@kefche/game-sdk/react";

import {
  CATEGORIES,
  cleanAnswer,
  HIDDEN,
  SHARED_POINTS,
  type Action,
  type Mark,
  type Pack,
  type Round,
  type State,
} from "../engine";

import type { ClockWatch } from "./clock";
import type { Sounds } from "./sounds";

/** How long before a clock runs out a sheet or ballot is sent. */
const SEND_BEFORE_MS = 2000;

const CATEGORY_KEYS: Readonly<Record<string, string>> = {
  country: "catCountry",
  city: "catCity",
  animal: "catAnimal",
  plant: "catPlant",
  food: "catFood",
  name: "catName",
  job: "catJob",
  thing: "catThing",
};

const MARK_KEYS: Readonly<Record<Mark, string>> = {
  empty: "markEmpty",
  letter: "markLetter",
  blocked: "markBlocked",
  known: "markPoints",
  doubt: "markDoubt",
  in: "markPoints",
  out: "markOut",
};

/** Categories of names, shown with capitals. */
const PROPER = new Set(["country", "city", "name"]);

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
  clock: ClockWatch;
}

/** Calls `send` once when `seat`'s clock is about to run out. */
function useSendBeforeTime(clock: ClockWatch, seat: number, send: () => void) {
  const sentRef = useRef(false);
  const fire = useEffectEvent(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    send();
  });
  useEffect(
    () =>
      clock.subscribe(() => {
        const left = clock.left(seat);
        if (left !== null && left <= SEND_BEFORE_MS) fire();
      }),
    [clock, seat],
  );
}

export function Game({ context, store, session, sounds, clock }: Props) {
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
      const fresh = s.sent.every((v) => !v);
      sounds.play(fresh || s.phase === "vote" ? (s.phase === "vote" ? "vote" : "reveal") : "sent");
    },
  });

  if (!view) return <div className="gk" aria-busy="true" />;
  const s = view.state;
  const pack = s.config.pack;
  const human = view.humanSeat;
  const done = view.result !== null;
  const letter = s.letters[s.round] ?? HIDDEN;
  const up = (text: string) => text.toLocaleUpperCase(pack);
  const category = (index: number) => t(CATEGORY_KEYS[CATEGORIES[index] ?? ""] ?? "");
  const waiting = s.sent.flatMap((v, seat) => (v ? [] : [name(seat)])).join(", ");
  const last = s.history.at(-1);
  const earlier = s.history.slice(0, -1);

  const shown = (index: number, answer: string) =>
    PROPER.has(CATEGORIES[index] ?? "")
      ? answer
          .split(" ")
          .map((w) => (w ? up(charsOf(w)[0] ?? "") + charsOf(w).slice(1).join("") : w))
          .join(" ")
      : answer;

  const results = (round: Pick<Round, "answers" | "marks"> & { points?: number[][] }) => (
    <ol className="gcat-results">
      {s.categories.map((index, slot) => (
        <li key={index}>
          <h3>{category(index)}</h3>
          <ul>
            {round.answers.map((answers, seat) => {
              const mark = round.marks[seat]?.[slot] ?? "empty";
              const answer = answers[slot] ?? "";
              const points = round.points?.[seat]?.[slot] ?? 0;
              return (
                <li
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- one answer per seat
                  key={seat}
                  style={seatStyle(seat)}
                  data-mark={mark}
                  data-shared={
                    (mark === "known" || mark === "in") && points === SHARED_POINTS ? "" : undefined
                  }
                >
                  <span className="gcat-who">{name(seat)}</span>{" "}
                  <strong dir="auto">{answer ? shown(index, answer) : "—"}</strong>{" "}
                  <span className="gcat-mark">
                    {round.points || mark !== "known"
                      ? t(MARK_KEYS[mark], { n: points })
                      : t("markKnown")}
                  </span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );

  let main: ReactNode = null;
  if (!done && human !== null && s.phase === "answer") {
    main = (
      <AnswerSheet
        key={`${String(s.round)}:${String(human)}`}
        context={context}
        clock={clock}
        seat={human}
        pack={pack}
        letter={letter}
        labels={s.categories.map(category)}
        onSend={(answers) => {
          session.act(human, { answers });
        }}
      />
    );
  } else if (!done && human !== null && s.phase === "vote") {
    main = (
      <Ballot
        key={`${String(s.round)}:${String(human)}`}
        context={context}
        clock={clock}
        seat={human}
        items={s.doubts.map((d) => ({
          seat: d.seat,
          category: category(s.categories[d.slot] ?? 0),
          answer: shown(s.categories[d.slot] ?? 0, s.sheets[d.seat]?.[d.slot] ?? ""),
          name: name(d.seat),
        }))}
        onSend={(votes) => {
          session.act(human, { votes });
        }}
      />
    );
  }

  return (
    <div className="gk gcat">
      <style>{KIT_CSS + WORD_CSS + CSS}</style>
      <ol className="gcat-scores" aria-label={t("scores")}>
        {s.scores.map((points, seat) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per seat
          <li key={seat} style={seatStyle(seat)} data-sent={!done && s.sent[seat] ? "" : undefined}>
            {t("scoreLine", { name: name(seat), points })}
          </li>
        ))}
      </ol>
      {!done && (
        <div className="gcat-head">
          <p className="gcat-round">{t("roundN", { n: s.round + 1, total: s.config.rounds })}</p>
          <div className="gcat-letter" aria-live="polite">
            <span>{t("letterIs")}</span>
            <strong dir="ltr">{up(letter)}</strong>
          </div>
        </div>
      )}
      {main}
      {!done && waiting && (
        <p className="gcat-status" role="status">
          {t(s.phase === "answer" ? "stillAnswering" : "stillVoting", { names: waiting })}
        </p>
      )}
      {!done && s.phase === "vote" && (
        <section className="gcat-round-box" aria-label={t("thisRound", { letter: up(letter) })}>
          <h2>{t("thisRound", { letter: up(letter) })}</h2>
          {results({ answers: s.sheets, marks: s.marks })}
        </section>
      )}
      {last && (
        <section
          className="gcat-round-box"
          aria-label={t(done ? "roundLetter" : "lastRound", {
            n: s.history.length,
            letter: up(last.letter),
          })}
        >
          <h2>
            {t(done ? "roundLetter" : "lastRound", {
              n: s.history.length,
              letter: up(last.letter),
            })}
          </h2>
          {results(last)}
          {last.doubts.length > 0 && (
            <ul className="gcat-tallies">
              {last.doubts.map((d, i) => (
                <li key={`${String(d.seat)}:${String(d.slot)}`}>
                  {t("tally", {
                    answer: shown(s.categories[d.slot] ?? 0, last.answers[d.seat]?.[d.slot] ?? ""),
                    yes: last.tallies[i]?.in ?? 0,
                    no: last.tallies[i]?.out ?? 0,
                  })}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {earlier.length > 0 && (
        <details className="gcat-earlier">
          <summary>{t("earlier")}</summary>
          {[...earlier].reverse().map((round, k) => {
            const n = earlier.length - k;
            return (
              <section key={n} className="gcat-round-box">
                <h2>{t("roundLetter", { n, letter: up(round.letter) })}</h2>
                {results(round)}
              </section>
            );
          })}
        </details>
      )}
    </div>
  );
}

function AnswerSheet({
  context,
  clock,
  seat,
  pack,
  letter,
  labels,
  onSend,
}: {
  context: GameContext;
  clock: ClockWatch;
  seat: number;
  pack: Pack;
  letter: string;
  labels: string[];
  onSend: (answers: string[]) => void;
}) {
  const { t } = context;
  const [answers, setAnswers] = useState(() => labels.map(() => ""));
  const formRef = useRef<HTMLFormElement>(null);
  const send = () => {
    onSend(answers);
  };
  useSendBeforeTime(clock, seat, send);
  const up = letter.toLocaleUpperCase(pack);

  /** Enter moves to the next field (the last one's Enter does nothing). */
  const next = (slot: number) => {
    const fields = formRef.current?.querySelectorAll("input");
    fields?.[slot + 1]?.focus();
  };

  return (
    <form
      ref={formRef}
      className="gcat-sheet"
      aria-label={t("sheet")}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <p className="gcat-hint">{t("answerHint", { letter: up })}</p>
      {labels.map((label, slot) => {
        const answer = answers[slot] ?? "";
        const first = charsOf(cleanAnswer(pack, answer))[0];
        const wrong = first !== undefined && first !== letter;
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- the categories are fixed for the game
          <div key={slot} className="gcat-field">
            <span aria-hidden="true">{label}</span>
            <WordInput
              lang={pack}
              value={answer}
              onChange={(value) => {
                setAnswers((all) => all.map((v, i) => (i === slot ? value : v)));
              }}
              onSubmit={() => {
                next(slot);
              }}
              label={label}
              maxLength={40}
              keepSpaces
              takeFocus={slot === 0}
            />
            {wrong && <small className="gcat-warn">{t("wrongLetter", { letter: up })}</small>}
          </div>
        );
      })}
      <div className="gk-bar">
        <button type="submit" className="gk-btn" data-primary="">
          {t("send")}
        </button>
      </div>
    </form>
  );
}

interface BallotItem {
  seat: number;
  category: string;
  answer: string;
  name: string;
}

function Ballot({
  context,
  clock,
  seat,
  items,
  onSend,
}: {
  context: GameContext;
  clock: ClockWatch;
  seat: number;
  items: BallotItem[];
  onSend: (votes: boolean[]) => void;
}) {
  const { t } = context;
  const [votes, setVotes] = useState(() => items.map(() => true));
  const send = () => {
    onSend(votes);
  };
  useSendBeforeTime(clock, seat, send);
  const choose = (i: number, value: boolean) => {
    setVotes((all) => all.map((v, k) => (k === i ? value : v)));
  };

  return (
    <section className="gcat-ballot" aria-label={t("voteTitle")}>
      <h2>{t("voteTitle")}</h2>
      <p className="gcat-hint">{t("voteHelp")}</p>
      <ul>
        {items.map((item, i) => (
          <li key={`${String(item.seat)}:${item.category}`} style={seatStyle(item.seat)}>
            <span className="gcat-cat">{item.category}</span>{" "}
            <strong dir="auto">{item.answer}</strong> <span className="gcat-who">{item.name}</span>
            {item.seat === seat ? (
              <span className="gcat-yours">{t("yours")}</span>
            ) : (
              <span
                className="gcat-choice"
                role="group"
                aria-label={t("voteOn", { answer: item.answer, name: item.name })}
              >
                <button
                  type="button"
                  className="gk-btn"
                  aria-pressed={votes[i] === true}
                  onClick={() => {
                    choose(i, true);
                  }}
                >
                  {t("voteIn")}
                </button>
                <button
                  type="button"
                  className="gk-btn"
                  aria-pressed={votes[i] === false}
                  onClick={() => {
                    choose(i, false);
                  }}
                >
                  {t("voteOut")}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="gk-bar">
        <button type="button" className="gk-btn" data-primary="" onClick={send}>
          {t("sendVotes")}
        </button>
      </div>
    </section>
  );
}

const CSS = `
.gcat { max-width: 40rem; width: 100%; margin-inline: auto; align-content: start; }
.gcat-scores { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.gcat-scores li { padding: 0.25rem 0.65rem; border-radius: 999px; background: var(--surface-2); border-inline-start: 0.4rem solid var(--fill); font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.gcat-scores li[data-sent] { outline: 2px solid var(--border-strong); }
.gcat-head { display: grid; justify-items: center; gap: 0.25rem; }
.gcat-round { margin: 0; color: var(--text-muted); font-size: 0.9rem; }
.gcat-letter { display: flex; align-items: center; gap: 0.6rem; }
.gcat-letter span { color: var(--text-muted); }
.gcat-letter strong { display: grid; place-items: center; width: 3.75rem; height: 3.75rem; border-radius: 1rem; background: var(--brand); color: var(--on-brand); font-size: 2.25rem; line-height: 1; }
.gcat-sheet { display: grid; gap: 0.5rem; width: 100%; }
.gcat-hint, .gcat-status { margin: 0; color: var(--text-muted); font-size: 0.9rem; text-align: center; }
.gcat-field { display: grid; grid-template-columns: minmax(5.5rem, 8rem) 1fr; align-items: center; gap: 0.25rem 0.6rem; }
.gcat-field > span { font-weight: 700; }
.gcat-field .gk-input { width: 100%; min-width: 0; }
.gcat-warn { grid-column: 2; color: var(--danger); font-weight: 600; }
.gk-btn[data-primary] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.gcat-ballot { display: grid; gap: 0.5rem; width: 100%; }
.gcat-ballot h2, .gcat-round-box h2 { margin: 0; font-size: 1rem; text-align: center; }
.gcat-ballot ul { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.gcat-ballot li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem; padding: 0.4rem 0.6rem; border-radius: 0.75rem; background: var(--surface-2); border-inline-start: 0.4rem solid var(--fill); }
.gcat-cat, .gcat-who, .gcat-yours { color: var(--text-muted); font-size: 0.85rem; }
.gcat-ballot strong { font-size: 1.05rem; }
.gcat-choice { display: flex; gap: 0.35rem; margin-inline-start: auto; }
.gcat-yours { margin-inline-start: auto; font-style: italic; }
.gcat-round-box { display: grid; gap: 0.4rem; width: 100%; padding: 0.6rem; border-radius: 1rem; background: var(--surface-2); }
.gcat-results { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.gcat-results h3 { margin: 0 0 0.2rem; font-size: 0.85rem; color: var(--text-muted); }
.gcat-results ul { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.gcat-results ul li { padding: 0.15rem 0.5rem; border-radius: 0.5rem; background: var(--surface); border-bottom: 0.2rem solid var(--fill); font-size: 0.85rem; overflow-wrap: anywhere; }
.gcat-results li[data-mark="empty"], .gcat-results li[data-mark="letter"], .gcat-results li[data-mark="blocked"], .gcat-results li[data-mark="out"] { color: var(--text-muted); }
.gcat-results li[data-mark="out"] strong, .gcat-results li[data-mark="letter"] strong { text-decoration: line-through; }
.gcat-mark { font-variant-numeric: tabular-nums; font-weight: 700; }
.gcat-results li[data-mark="known"]:not([data-shared]) .gcat-mark, .gcat-results li[data-mark="in"]:not([data-shared]) .gcat-mark { color: var(--success); }
.gcat-tallies { margin: 0; padding-inline-start: 1.2rem; color: var(--text-muted); font-size: 0.85rem; }
.gcat-earlier { width: 100%; }
.gcat-earlier summary { cursor: pointer; font-weight: 600; padding: 0.4rem 0; }
.gcat-earlier .gcat-round-box { margin-top: 0.5rem; }
`;
