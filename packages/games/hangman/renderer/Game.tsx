// Hangman: the scores, the round's theme (pack words), the gallows (one
// part a wrong letter), the word as letter tiles, and the language's
// keyboard with right letters marked "in place" and wrong ones "not in it"
// (by colour and a mark, the word kit's tiles). On your turn, tap a letter
// or type it. In versus, the setter types a word (checked against the
// dictionary as they type) while the others wait. Every finished round is
// listed with its word.
import { useState, useSyncExternalStore } from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  LayoutSwitch,
  LetterKeyboard,
  LetterTile,
  seatStyle,
  useTurnFeedback,
  useTypedKeys,
  WORD_CSS,
  WordInput,
  wordText,
  type TileState,
} from "@kefche/game-sdk/react";

import {
  CATEGORIES,
  HIDDEN,
  MAX_LENGTH,
  MAX_MISSES,
  validSecret,
  type Action,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

/** Literal keys for the themes' names. */
const THEME_KEYS: Readonly<Record<string, string>> = {
  animals: "themeAnimals",
  food: "themeFood",
  home: "themeHome",
  nature: "themeNature",
  sport: "themeSport",
  jobs: "themeJobs",
  travel: "themeTravel",
  music: "themeMusic",
};

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
  /** Whether the dictionary has loaded (a set word is checked with it). */
  listsReady: boolean;
}

/** The gallows, drawn part by part as wrong letters come. */
function Gallows({ misses, label }: { misses: number; label: string }) {
  const parts = [
    <circle key="head" cx="70" cy="34" r="9" />,
    <line key="body" x1="70" y1="43" x2="70" y2="70" />,
    <line key="arm1" x1="70" y1="50" x2="58" y2="60" />,
    <line key="arm2" x1="70" y1="50" x2="82" y2="60" />,
    <line key="leg1" x1="70" y1="70" x2="60" y2="86" />,
    <line key="leg2" x1="70" y1="70" x2="80" y2="86" />,
  ];
  return (
    <svg className="ghm-gallows" viewBox="0 0 100 100" role="img" aria-label={label}>
      <g className="ghm-frame">
        <line x1="10" y1="94" x2="60" y2="94" />
        <line x1="25" y1="94" x2="25" y2="10" />
        <line x1="25" y1="10" x2="70" y2="10" />
        <line x1="70" y1="10" x2="70" y2="25" />
      </g>
      <g className="ghm-man">{parts.slice(0, misses)}</g>
    </svg>
  );
}

export function Game({ context, store, session, sounds, listsReady }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [draft, setDraft] = useState("");
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const text = wordText(t);

  useTurnFeedback({
    context,
    view,
    moves: view?.state.moves ?? 0,
    sounds,
    onMove: (current) => {
      const action = current.lastMove?.action;
      const st = current.state;
      if (!action || "set" in action) {
        sounds.play("set");
        return;
      }
      // A new round has just begun: the last letter ended the one before.
      if (st.guessed.length === 0 && st.history.length > 0) {
        sounds.play(st.history.at(-1)?.by === null ? "lost" : "solved");
        return;
      }
      sounds.play(st.word.includes(action.letter) ? "hit" : "miss");
    },
  });

  const s = view?.state;
  const human = view?.humanSeat ?? null;
  const done = s ? s.round >= s.rounds : false;
  const myGuess = !!s && !done && s.phase === "guess" && human !== null && human === s.turn;
  const mySet = !!s && !done && s.phase === "set" && human !== null && human === s.setter;
  const pack = s?.config.pack ?? "en";

  // Your guess: it's your turn (human is s.turn).
  const guess = (letter: string) => {
    if (!s || !myGuess || s.guessed.includes(letter)) return;
    session.act(s.turn, { letter });
  };
  useTypedKeys(pack, { onLetter: guess }, myGuess);

  if (!view || !s) return <div className="gk" aria-busy="true" />;

  const keyStates: Record<string, TileState> = {};
  for (const l of s.guessed) {
    keyStates[l] = s.word.includes(l) ? "good" : "miss";
  }
  const wordCheck = listsReady && draft !== "" ? validSecret(pack, draft) : null;
  const send = () => {
    if (human === null || wordCheck === null) return;
    if (session.act(human, { set: wordCheck })) setDraft("");
  };
  const theme = s.category === null ? null : CATEGORIES[s.category];
  const shown = s.word.filter((l) => l !== HIDDEN).length;

  return (
    <div className="gk ghm">
      <style>{KIT_CSS + WORD_CSS + CSS}</style>
      {s.players > 1 && (
        <ol className="ghm-scores" aria-label={t("scores")}>
          {s.scores.map((points, seat) => (
            <li
              // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per seat
              key={seat}
              style={seatStyle(seat)}
              data-turn={!done && seat === (s.phase === "set" ? s.setter : s.turn) ? "" : undefined}
            >
              {t("scoreLine", { name: name(seat), points })}
            </li>
          ))}
        </ol>
      )}
      {!done && (
        <>
          <p className="ghm-round">
            {t("roundOf", { n: s.round + 1, total: s.rounds })}
            {theme !== null && theme !== undefined && (
              <>
                {" · "}
                <strong>{t(THEME_KEYS[theme] ?? "themeAnimals")}</strong>
              </>
            )}
          </p>
          <div className="ghm-stage">
            <Gallows misses={s.misses} label={t("missesLeft", { n: MAX_MISSES - s.misses })} />
            <div
              className="ghm-word"
              dir="ltr"
              role="img"
              aria-label={t("wordLabel", { shown, total: s.word.length })}
            >
              {s.phase === "set" && !mySet ? (
                <span className="ghm-wait">
                  {t("choosing", { name: s.setter === null ? "" : name(s.setter) })}
                </span>
              ) : (
                s.word.map((l, i) => (
                  <LetterTile
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- one tile per letter
                    key={i}
                    lang={pack}
                    letter={l === HIDDEN ? undefined : l}
                    state={
                      l !== HIDDEN && s.phase === "guess" && s.guessed.includes(l)
                        ? "good"
                        : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>
          {mySet ? (
            <form
              className="ghm-set"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <p>{t("setPrompt")}</p>
              <WordInput
                lang={pack}
                value={draft}
                onChange={setDraft}
                onSubmit={send}
                label={t("setLabel")}
                maxLength={MAX_LENGTH}
                takeFocus
              />
              <p className="ghm-hint" role="status">
                {!listsReady
                  ? t("loadingWords")
                  : draft === ""
                    ? t("setRules")
                    : wordCheck === null
                      ? t("notAWord")
                      : t("looksGood")}
              </p>
              <button type="submit" className="gk-btn" disabled={wordCheck === null}>
                {t("setWord")}
              </button>
            </form>
          ) : (
            <>
              <p className="ghm-turn" role="status">
                {s.phase === "guess"
                  ? myGuess
                    ? t("yourGuess")
                    : t("guessing", { name: name(s.turn) })
                  : ""}
              </p>
              <LayoutSwitch lang={pack} text={text} />
              <LetterKeyboard
                lang={pack}
                text={text}
                states={keyStates}
                disabled={!myGuess}
                label={(l, state) =>
                  state === "good"
                    ? t("keyRight", { letter: l.toLocaleUpperCase(pack) })
                    : state === "miss"
                      ? t("keyWrong", { letter: l.toLocaleUpperCase(pack) })
                      : l.toLocaleUpperCase(pack)
                }
                onLetter={guess}
              />
            </>
          )}
        </>
      )}
      {s.history.length > 0 && (
        <ol className="ghm-history" aria-label={t("rounds")}>
          {s.history.map((r, i) => (
            <li
              // eslint-disable-next-line @eslint-react/no-array-index-key -- one line per round
              key={i}
            >
              <strong dir="ltr">{r.word.toLocaleUpperCase(pack)}</strong>{" "}
              {r.by === null
                ? t("roundLost")
                : s.players === 1
                  ? t("roundSolvedSolo")
                  : t("roundSolved", { name: name(r.by) })}
            </li>
          ))}
        </ol>
      )}
      {done && s.players === 1 && (
        <p className="ghm-turn">
          {t("soloEnd", { n: s.history.filter((r) => r.by !== null).length, total: s.rounds })}
        </p>
      )}
    </div>
  );
}

// The gallows in the page's ink; the word's tiles and keys from the word kit.
const CSS = `
.ghm { max-width: 36rem; margin-inline: auto; }
.ghm-scores { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem 0.75rem; margin: 0; padding: 0; list-style: none; }
.ghm-scores li { padding: 0.15rem 0.6rem; border-radius: 999px; border: 2px solid var(--seat, var(--border)); }
.ghm-scores li[data-turn] { background: var(--surface-2); font-weight: 700; }
.ghm-round, .ghm-turn { margin: 0; text-align: center; }
.ghm-turn { font-weight: 700; min-height: 1.5rem; }
.ghm-stage { display: grid; justify-items: center; gap: 0.5rem; width: 100%; }
.ghm-gallows { width: min(40vw, 9rem); height: auto; }
.ghm-frame line, .ghm-man line, .ghm-man circle { fill: none; stroke: var(--text); stroke-width: 4; stroke-linecap: round; }
.ghm-word { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem; --tile-w: min(2.6rem, calc((100vw - 3rem) / 12)); min-height: 2.6rem; }
.ghm-wait { color: var(--text-muted); }
.ghm-set { display: grid; justify-items: center; gap: 0.5rem; width: 100%; text-align: center; }
.ghm-set p { margin: 0; }
.ghm-hint { color: var(--text-muted); min-height: 1.5rem; }
.ghm-history { display: grid; gap: 0.25rem; margin: 0; padding: 0; list-style: none; text-align: center; color: var(--text-muted); }
.ghm-history strong { color: var(--text); letter-spacing: 0.05em; }
`;
