// The word games' kit (Phase 13): letter tiles, an on-screen keyboard for
// each language (Bulgarian in its phonetic and БДС layouts, the choice kept
// per device), letters typed on a physical keyboard, and a text input that
// works with phone keyboards. Letters and folding come from ../words, so a
// word is judged the same in the browser, in bots and on the server.
//
// Strings come from the site's shared ones, merged into the game's own for
// games tagged "words" (context.t("kit.word.…")). A tile's or key's state is
// the game's to name ("in the right place" or "in the word"), so games pass
// labels in.
import {
  useEffect,
  useEffectEvent,
  useRef,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  charsOf,
  KEYBOARD_ROWS,
  LAYOUTS_FOR,
  letterFromKey,
  lettersOf,
  type KeyboardLayout,
  type WordLang,
} from "../words";

import type { GameContext } from "../browser/game-module";

// ------------------------------------------------------------------ names

export interface WordText {
  enter: string;
  backspace: string;
  /** The keyboard's name for screen readers. */
  keyboard: string;
  /** The layout switch's name. */
  layout: string;
  layoutName: (layout: KeyboardLayout) => string;
}

/** The kit's words in the page's language, from the site's shared strings. */
export function wordText(t: GameContext["t"]): WordText {
  const names: Record<KeyboardLayout, string> = {
    qwerty: "QWERTY",
    "bg-phonetic": t("kit.word.phonetic"),
    "bg-bds": t("kit.word.bds"),
  };
  return {
    enter: t("kit.word.enter"),
    backspace: t("kit.word.backspace"),
    keyboard: t("kit.word.keyboard"),
    layout: t("kit.word.layout"),
    layoutName: (layout) => names[layout],
  };
}

/** A letter as it's shown on a tile or a key: upper case in its language. */
export const shownLetter = (lang: WordLang, ch: string): string => ch.toLocaleUpperCase(lang);

// ----------------------------------------------------------------- layout

const layoutKey = (lang: WordLang) => `kefche:words:layout:${lang}`;
const layoutListeners = new Set<() => void>();

function readLayout(lang: WordLang): KeyboardLayout {
  const offered = LAYOUTS_FOR[lang];
  const fallback = offered[0] ?? "qwerty";
  try {
    const stored = localStorage.getItem(layoutKey(lang));
    return offered.find((l) => l === stored) ?? fallback;
  } catch {
    return fallback;
  }
}

/** This device's on-screen layout for a language, and a way to change it. */
export function useKeyboardLayout(lang: WordLang): [KeyboardLayout, (l: KeyboardLayout) => void] {
  const layout = useSyncExternalStore(
    (listener) => {
      layoutListeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === layoutKey(lang)) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        layoutListeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => readLayout(lang),
    () => LAYOUTS_FOR[lang][0] ?? "qwerty",
  );
  const set = (next: KeyboardLayout) => {
    try {
      localStorage.setItem(layoutKey(lang), next);
    } catch {
      // Storage may be off; the choice then lasts until the page closes.
    }
    for (const listener of layoutListeners) listener();
  };
  return [layout, set];
}

/** Switches between a language's layouts; renders nothing when it has one. */
export function LayoutSwitch({ lang, text }: { lang: WordLang; text: WordText }) {
  const [layout, set] = useKeyboardLayout(lang);
  const offered = LAYOUTS_FOR[lang];
  if (offered.length < 2) return null;
  return (
    <div className="gk-bar" role="group" aria-label={text.layout}>
      {offered.map((l) => (
        <button
          key={l}
          type="button"
          className="gk-btn"
          aria-pressed={l === layout}
          onClick={() => {
            set(l);
          }}
        >
          {text.layoutName(l)}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ tiles

/** In place, elsewhere in the word, or not in it. */
export type TileState = "good" | "near" | "miss";

/** A letter tile: empty, typed, or marked with a state (colour and a mark). */
export function LetterTile({
  lang,
  letter,
  state,
  label,
}: {
  lang: WordLang;
  letter?: string | undefined;
  state?: TileState | undefined;
  /** What a screen reader hears; the game names the state. */
  label?: string | undefined;
}) {
  return (
    <span
      className="gk-tile"
      data-state={state}
      data-filled={letter ? "" : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {letter ? shownLetter(lang, letter) : ""}
    </span>
  );
}

// --------------------------------------------------------------- keyboard

/**
 * An on-screen keyboard in the device's chosen layout. Keys show a state
 * once the game knows it; Enter and Delete are optional.
 */
export function LetterKeyboard({
  lang,
  text,
  states,
  label,
  disabled,
  onLetter,
  onEnter,
  onBackspace,
}: {
  lang: WordLang;
  text: WordText;
  states?: Readonly<Record<string, TileState>> | undefined;
  /** A key's name for screen readers (the letter, and its state). */
  label?: ((letter: string, state: TileState | undefined) => string) | undefined;
  disabled?: boolean | undefined;
  onLetter: (letter: string) => void;
  onEnter?: (() => void) | undefined;
  onBackspace?: (() => void) | undefined;
}) {
  const [layout] = useKeyboardLayout(lang);
  const rows = KEYBOARD_ROWS[layout];
  const last = rows.length - 1;
  return (
    // Keys keep their order in every language, like boards.
    <div className="gk-keys" role="group" aria-label={text.keyboard} dir="ltr">
      {rows.map((row, r) => (
        <div key={row} className="gk-keyrow">
          {r === last && onEnter ? (
            <button
              type="button"
              className="gk-key gk-key-wide"
              disabled={disabled}
              onClick={onEnter}
            >
              {text.enter}
            </button>
          ) : null}
          {charsOf(row).map((ch) => {
            const state = states?.[ch];
            return (
              <button
                key={ch}
                type="button"
                className="gk-key"
                data-state={state}
                disabled={disabled}
                aria-label={label ? label(ch, state) : shownLetter(lang, ch)}
                onClick={() => {
                  onLetter(ch);
                }}
              >
                {shownLetter(lang, ch)}
              </button>
            );
          })}
          {r === last && onBackspace ? (
            <button
              type="button"
              className="gk-key gk-key-wide"
              disabled={disabled}
              aria-label={text.backspace}
              title={text.backspace}
              onClick={onBackspace}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d="M9 5h11v14H9l-6-7z M12 9l6 6 M18 9l-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Letters, Enter and Backspace from a physical keyboard, while `enabled`.
 * Typing into a text field (the chat, a WordInput) is left alone. In
 * Bulgarian, a Latin-only keyboard types phonetically (letterFromKey).
 */
export function useTypedKeys(
  lang: WordLang,
  handlers: {
    onLetter: (letter: string) => void;
    onEnter?: () => void;
    onBackspace?: () => void;
  },
  enabled = true,
): void {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.closest("input, textarea, select") !== null)
    )
      return;
    if (event.key === "Enter" && handlers.onEnter) {
      // A focused button's own Enter stays a click on it.
      if (target instanceof HTMLButtonElement) return;
      event.preventDefault();
      handlers.onEnter();
      return;
    }
    if (event.key === "Backspace" && handlers.onBackspace) {
      event.preventDefault();
      handlers.onBackspace();
      return;
    }
    if (event.repeat) return;
    const letter = letterFromKey(lang, event.key, event.code);
    if (letter !== null) {
      event.preventDefault();
      handlers.onLetter(letter);
    }
  });
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled]);
}

// ------------------------------------------------------------------ input

/**
 * A text field for typed answers: only the language's letters are kept
 * (folded, so "Café" becomes "cafe"), but never while a phone keyboard or an
 * input method is still composing, which filtering would break. It stays in
 * view above the phone's keyboard, and Enter submits.
 */
export function WordInput({
  lang,
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  maxLength,
  disabled,
  keepSpaces,
  autoFocus,
}: {
  lang: WordLang;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (() => void) | undefined;
  label: string;
  placeholder?: string | undefined;
  maxLength?: number | undefined;
  disabled?: boolean | undefined;
  /** Keep single spaces between words (a city's name), not only letters. */
  keepSpaces?: boolean | undefined;
  autoFocus?: boolean | undefined;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  const clean = (raw: string): string => {
    const kept = keepSpaces
      ? raw
          .split(/\s+/)
          .map((part) => lettersOf(lang, part))
          .filter((part, i, parts) => part.length > 0 || i === parts.length - 1)
          .join(" ")
      : lettersOf(lang, raw);
    return maxLength === undefined ? kept : charsOf(kept).slice(0, maxLength).join("");
  };

  // Phones shrink the visual viewport for their keyboard; keep the field in it.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onResize = () => {
      if (document.activeElement === ref.current) ref.current?.scrollIntoView({ block: "nearest" });
    };
    viewport.addEventListener("resize", onResize);
    return () => {
      viewport.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <input
      ref={ref}
      className="gk-input"
      type="text"
      lang={lang}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      enterKeyHint={onSubmit ? "send" : "done"}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        onChange(clean(event.currentTarget.value));
      }}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const raw = event.currentTarget.value;
        onChange(composingRef.current ? raw : clean(raw));
      }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing && onSubmit) {
          event.preventDefault();
          onSubmit();
        }
      }}
    />
  );
}

// ----------------------------------------------------------------- styles

/** Styles for tiles, keys and inputs, scoped like KIT_CSS. A tile is --tile-w wide. */
export const WORD_CSS = `
.gk-tile { position: relative; display: inline-grid; place-items: center; width: var(--tile-w, 3rem); height: var(--tile-w, 3rem); border-radius: 0.4rem; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-weight: 700; font-size: calc(var(--tile-w, 3rem) * 0.5); line-height: 1; }
.gk-tile[data-filled] { border-color: var(--border-strong); }
.gk-tile[data-state], .gk-key[data-state] { border-color: transparent; }
.gk-tile[data-state="good"], .gk-key[data-state="good"] { background: var(--tile-good); color: var(--tile-good-ink); }
.gk-tile[data-state="near"], .gk-key[data-state="near"] { background: var(--tile-near); color: var(--tile-near-ink); }
.gk-tile[data-state="miss"], .gk-key[data-state="miss"] { background: var(--tile-miss); color: var(--tile-miss-ink); }
.gk-tile[data-state="good"]::after { content: ""; position: absolute; inset-inline: 22%; bottom: 10%; height: 3px; border-radius: 2px; background: currentColor; }
.gk-tile[data-state="near"]::after { content: ""; position: absolute; top: 10%; inset-inline-end: 10%; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.gk-keys { display: grid; gap: 0.35rem; width: 100%; max-width: 34rem; touch-action: manipulation; }
.gk-keyrow { display: flex; justify-content: center; gap: 0.2rem; }
.gk-key { flex: 1 1 0; min-width: 0; max-width: 3rem; min-height: 3rem; padding: 0; border-radius: 0.4rem; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); font-weight: 700; font-size: 1.05rem; cursor: pointer; }
.gk-key-wide { flex: 1.6 1 0; max-width: 4.6rem; display: inline-grid; place-items: center; font-size: 0.8rem; }
.gk-key:disabled { opacity: 0.45; cursor: not-allowed; }
.gk-key:focus-visible, .gk-input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gk-input { min-height: 2.75rem; width: 100%; max-width: 20rem; padding-inline: 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 1rem; }
@media (forced-colors: active) { .gk-tile[data-state], .gk-key[data-state] { border: 2px solid CanvasText; } }
`;
