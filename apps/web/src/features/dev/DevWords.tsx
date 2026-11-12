// Dev-only gallery island (pages/[locale]/dev/ui.astro): the word kit's
// tiles in every state, the on-screen keyboard in each language and layout,
// typing from a physical keyboard, and the typed-answer input. Kit strings
// come from the real translations (wordKitUi).
import { useState } from "react";

import { charsOf, WORD_LANGS, type WordLang } from "@kefche/game-sdk";
import {
  KIT_CSS,
  LayoutSwitch,
  LetterKeyboard,
  LetterTile,
  useTypedKeys,
  WORD_CSS,
  WordInput,
  wordText,
  type TileState,
} from "@kefche/game-sdk/react";

const SAMPLE: Record<WordLang, { word: string; states: TileState[] }> = {
  en: { word: "crane", states: ["good", "miss", "near", "miss", "good"] },
  bg: { word: "чайка", states: ["good", "near", "miss", "good", "miss"] },
};

export function DevWords({ ui }: { ui: Record<string, string> }) {
  const t = (key: string) => ui[key] ?? key;
  const text = wordText(t);
  const [lang, setLang] = useState<WordLang>("en");
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const sample = SAMPLE[lang];
  const keyStates: Record<string, TileState> = {};
  charsOf(sample.word).forEach((ch, i) => {
    const state = sample.states[i];
    if (state) keyStates[ch] = state;
  });

  const handlers = {
    onLetter: (ch: string) => {
      setTyped((w) => (w.length < 5 ? w + ch : w));
    },
    onBackspace: () => {
      setTyped((w) => w.slice(0, -1));
    },
    onEnter: () => {
      setTyped("");
    },
  };
  useTypedKeys(lang, handlers);

  return (
    <div className="grid gap-4">
      <style>{KIT_CSS + WORD_CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        {WORD_LANGS.map((l) => (
          <button
            key={l}
            type="button"
            className="gk-btn"
            aria-pressed={l === lang}
            onClick={() => {
              setLang(l);
              setTyped("");
            }}
          >
            {l}
          </button>
        ))}
        <LayoutSwitch lang={lang} text={text} />
      </div>
      <div className="flex gap-1" dir="ltr">
        {charsOf(sample.word).map((ch, i) => (
          <LetterTile key={`${ch}${String(i)}`} lang={lang} letter={ch} state={sample.states[i]} />
        ))}
      </div>
      <div className="flex gap-1" dir="ltr">
        {[0, 1, 2, 3, 4].map((i) => (
          <LetterTile key={i} lang={lang} letter={typed[i]} />
        ))}
      </div>
      <LetterKeyboard lang={lang} text={text} states={keyStates} {...handlers} />
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <WordInput
          lang={lang}
          value={answer}
          onChange={setAnswer}
          keepSpaces
          maxLength={24}
          label="Answer"
          onSubmit={() => {
            if (answer.trim()) setSent((s) => [...s, answer.trim()]);
            setAnswer("");
          }}
        />
        <span className="text-sm text-muted">{sent.join(", ")}</span>
      </form>
    </div>
  );
}
