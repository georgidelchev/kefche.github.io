// Playing cards for the card games (Phase 12): one original deck drawn in
// SVG, with large corner indices so a fanned hand reads on a phone, and a
// four-colour option (clubs green, diamonds blue) kept per device for every
// card game. A hand plays by tap (lift, then tap again), by dragging a card
// up, or from the keyboard. Hands keep their order in every language, like
// boards. Names for screen readers come from the site's shared strings,
// which the player merges into the game's own for games tagged "cards"
// (context.t("kit.card.…")).
import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { HIDDEN, rankOf, suitOf, type Card, type Rank, type Suit } from "../cards";

import type { GameContext } from "../browser/game-module";

// ------------------------------------------------------------------ names

export interface CardText {
  /** "Queen of hearts". */
  name: (c: Card) => string;
  faceDown: string;
  suit: (s: Suit) => string;
  fourColour: string;
}

/** Card names in the page's language, from the site's shared card strings. */
export function cardText(t: GameContext["t"]): CardText {
  const suits: Record<Suit, string> = {
    clubs: t("kit.card.clubs"),
    diamonds: t("kit.card.diamonds"),
    hearts: t("kit.card.hearts"),
    spades: t("kit.card.spades"),
  };
  const faces: Partial<Record<Rank, string>> = {
    11: t("kit.card.jack"),
    12: t("kit.card.queen"),
    13: t("kit.card.king"),
    14: t("kit.card.ace"),
  };
  return {
    name: (c) =>
      c === HIDDEN
        ? t("kit.card.faceDown")
        : t("kit.card.name", {
            rank: faces[rankOf(c)] ?? String(rankOf(c)),
            suit: suits[suitOf(c)],
          }),
    faceDown: t("kit.card.faceDown"),
    suit: (s) => suits[s],
    fourColour: t("kit.card.fourColour"),
  };
}

// ------------------------------------------------------- four-colour deck

const FOUR_KEY = "kefche:cards:four-colour";
const fourListeners = new Set<() => void>();

function readFour(): boolean {
  try {
    return localStorage.getItem(FOUR_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether this device shows the four-colour deck, and a way to change it. */
export function useFourColour(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (listener) => {
      fourListeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === FOUR_KEY) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        fourListeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    readFour,
    () => false,
  );
  const set = (next: boolean) => {
    try {
      localStorage.setItem(FOUR_KEY, next ? "1" : "0");
    } catch {
      // Storage may be off; the choice then lasts until the page closes.
    }
    for (const listener of fourListeners) listener();
  };
  return [on, set];
}

/** A button for the four-colour deck, for the game's own toolbar. */
export function FourColourToggle({ label }: { label: string }) {
  const [on, set] = useFourColour();
  return (
    <button
      type="button"
      className="gk-btn gk-four"
      aria-pressed={on}
      title={label}
      onClick={() => {
        set(!on);
      }}
    >
      <svg viewBox="0 0 48 24" aria-hidden="true">
        {/* On a card's face, so every suit shows in both themes. */}
        <rect width={48} height={24} rx={4} style={{ fill: "var(--card-face)" }} />
        {(["spades", "hearts", "diamonds", "clubs"] as const).map((s, i) => (
          <path
            key={s}
            d={SUIT_PATHS[s]}
            transform={`translate(${String(i * 12)} 6) scale(0.5)`}
            style={{ fill: suitColour(s, true) }}
          />
        ))}
      </svg>
      <span className="gk-sr">{label}</span>
    </button>
  );
}

// ------------------------------------------------------------------ faces

/** The suits in a 24 × 24 box, drawn for kefche. */
export const SUIT_PATHS: Readonly<Record<Suit, string>> = {
  hearts:
    "M12 21.5C9 19 2 14.5 2 8.6A5.1 5.1 0 0 1 12 6.4A5.1 5.1 0 0 1 22 8.6C22 14.5 15 19 12 21.5Z",
  diamonds: "M12 1.5L20.5 12L12 22.5L3.5 12Z",
  spades:
    "M12 1.5C15 4.5 22 9 22 14.2A4.9 4.9 0 0 1 13.3 17.3L14.8 22.5H9.2L10.7 17.3A4.9 4.9 0 0 1 2 14.2C2 9 9 4.5 12 1.5Z",
  clubs:
    "M12 2A4.6 4.6 0 0 1 15.6 9.5A4.6 4.6 0 1 1 13.4 17.4L14.8 22.5H9.2L10.6 17.4A4.6 4.6 0 1 1 8.4 9.5A4.6 4.6 0 0 1 12 2Z",
};

/** A suit's ink: red and black, or with the four-colour deck clubs green and diamonds blue. */
export function suitColour(suit: Suit, four: boolean): string {
  if (four && suit === "clubs") return "var(--card-green)";
  if (four && suit === "diamonds") return "var(--card-blue)";
  return suit === "hearts" || suit === "diamonds" ? "var(--card-red)" : "var(--card-ink)";
}

const RANK_TEXT: Readonly<Record<number, string>> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export const rankText = (rank: Rank): string => RANK_TEXT[rank] ?? String(rank);

// Pip places for 2–10 as [column, row]: column 0, 0.5 or 1; row 0 (top) to 1.
const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  2: [
    [0.5, 0],
    [0.5, 1],
  ],
  3: [
    [0.5, 0],
    [0.5, 0.5],
    [0.5, 1],
  ],
  4: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  5: [
    [0, 0],
    [1, 0],
    [0.5, 0.5],
    [0, 1],
    [1, 1],
  ],
  6: [
    [0, 0],
    [1, 0],
    [0, 0.5],
    [1, 0.5],
    [0, 1],
    [1, 1],
  ],
  7: [
    [0, 0],
    [1, 0],
    [0.5, 0.25],
    [0, 0.5],
    [1, 0.5],
    [0, 1],
    [1, 1],
  ],
  8: [
    [0, 0],
    [1, 0],
    [0.5, 0.25],
    [0, 0.5],
    [1, 0.5],
    [0.5, 0.75],
    [0, 1],
    [1, 1],
  ],
  9: [
    [0, 0],
    [1, 0],
    [0, 1 / 3],
    [1, 1 / 3],
    [0.5, 0.5],
    [0, 2 / 3],
    [1, 2 / 3],
    [0, 1],
    [1, 1],
  ],
  10: [
    [0, 0],
    [1, 0],
    [0.5, 1 / 6],
    [0, 1 / 3],
    [1, 1 / 3],
    [0, 2 / 3],
    [1, 2 / 3],
    [0.5, 5 / 6],
    [0, 1],
    [1, 1],
  ],
};

/** Court cards: an ornament above the suit, one for each rank. */
const COURT_MARKS: Readonly<Record<number, string>> = {
  // Jack: a feather.
  11: "M30 25C25 31 25 37 29 41L31 41C35 37 35 31 30 25ZM30 30V41",
  // Queen: a tiara.
  12: "M20 41L22 31L26 36L30 28L34 36L38 31L40 41Z",
  // King: a crown.
  13: "M19 41V30L24.5 35L30 27L35.5 35L41 30V41Z",
};

const W = 60;
const H = 84;

function SuitMark({ suit, x, y, size, four, flip = false }: SuitProps) {
  const s = size / 24;
  const t = flip
    ? `translate(${String(x + size / 2)} ${String(y + size / 2)}) rotate(180) translate(${String(-size / 2)} ${String(-size / 2)}) scale(${String(s)})`
    : `translate(${String(x)} ${String(y)}) scale(${String(s)})`;
  return <path d={SUIT_PATHS[suit]} transform={t} style={{ fill: suitColour(suit, four) }} />;
}

interface SuitProps {
  suit: Suit;
  x: number;
  y: number;
  size: number;
  four: boolean;
  flip?: boolean;
}

function Face({ c, four }: { c: Card; four: boolean }) {
  const suit = suitOf(c);
  const rank = rankOf(c);
  const ink = suitColour(suit, four);
  const corner = (
    <>
      <text x={8} y={17} className="gk-rank" style={{ fill: ink }}>
        {rankText(rank)}
      </text>
      <SuitMark suit={suit} x={2.5} y={19.5} size={11} four={four} />
    </>
  );
  let middle;
  if (rank <= 10) {
    middle = (PIPS[rank] ?? []).map(([col, row]) => (
      <SuitMark
        key={`${String(col)},${String(row)}`}
        suit={suit}
        x={21 + col * 18 - 5}
        y={20 + row * 44 - 5}
        size={10}
        four={four}
        flip={row > 0.5}
      />
    ));
  } else if (rank === 14) {
    middle = <SuitMark suit={suit} x={W / 2 - 11} y={H / 2 - 11} size={22} four={four} />;
  } else {
    middle = (
      <>
        <rect x={16} y={18} width={28} height={48} rx={3} className="gk-court" />
        <path d={COURT_MARKS[rank]} style={{ fill: ink, stroke: ink }} className="gk-mark" />
        <SuitMark suit={suit} x={W / 2 - 8} y={45} size={16} four={four} />
      </>
    );
  }
  return (
    <>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={5} className="gk-face" />
      {corner}
      <g transform={`rotate(180 ${String(W / 2)} ${String(H / 2)})`}>{corner}</g>
      {middle}
    </>
  );
}

function Back() {
  const id = useId();
  return (
    <>
      <defs>
        <pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse">
          <path d="M0 3L3 0L6 3L3 6Z" className="gk-back-lines" />
        </pattern>
      </defs>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={5} className="gk-back" />
      <rect x={5} y={5} width={W - 10} height={H - 10} rx={3} fill={`url(#${id})`} />
      <circle cx={W / 2} cy={H / 2} r={9} className="gk-back" />
      <circle cx={W / 2} cy={H / 2} r={5.5} className="gk-back-lines" />
    </>
  );
}

/** One card, face up or (HIDDEN) face down. Its name is for screen readers. */
/**
 * A face for very small cards (Spider's ten columns on a phone): a big rank
 * and suit across the top, the strip that shows when cards are stacked, and
 * the suit again in the middle.
 */
function CompactFace({ c, four }: { c: Card; four: boolean }) {
  const suit = suitOf(c);
  const ink = suitColour(suit, four);
  return (
    <>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={5} className="gk-face" />
      <text x={4} y={24} className="gk-rank-big" style={{ fill: ink }}>
        {rankText(rankOf(c))}
      </text>
      <SuitMark suit={suit} x={W - 25} y={4} size={21} four={four} />
      <SuitMark suit={suit} x={W / 2 - 14} y={40} size={28} four={four} />
    </>
  );
}

export function PlayingCard({
  card: c,
  four = false,
  label,
  className,
  compact = false,
}: {
  card: Card;
  four?: boolean;
  /** The card's name; leave it out when the card sits inside a labelled control. */
  label?: string;
  className?: string;
  /** The big-index face for tiny cards. */
  compact?: boolean;
}) {
  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      className={`gk-card${className ? ` ${className}` : ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {c === HIDDEN ? (
        <Back />
      ) : compact ? (
        <CompactFace c={c} four={four} />
      ) : (
        <Face c={c} four={four} />
      )}
    </svg>
  );
}

// ------------------------------------------------------------------- hand

/** A card dragged up this far (in px) is played. */
const DRAG_PLAY_PX = 40;

/**
 * The player's hand, fanned left to right. `pick` "play" plays a card on a
 * second tap (the first lifts it), on a drag up, or on Enter; "select"
 * toggles cards for a multi-card choice (passing three in Hearts). Cards
 * that can't be played now are dimmed and can't be picked.
 */
export function Hand({
  cards,
  text,
  label,
  canPlay,
  onPlay,
  pick = "play",
  selected,
  four = false,
  face,
  quiet = false,
}: {
  cards: readonly Card[];
  /** Names for screen readers (`name` is all a game with its own deck needs). */
  text: Pick<CardText, "name">;
  /** The hand's name, "Your hand". */
  label: string;
  /** Whether a card may be played (or selected) now; nothing is when it isn't your turn. */
  canPlay: (c: Card) => boolean;
  onPlay: (c: Card) => void;
  pick?: "play" | "select";
  /** "select": the cards chosen so far. */
  selected?: ReadonlySet<Card>;
  four?: boolean;
  /**
   * A game with its own deck (Crazy Colors) draws its cards: an SVG with
   * class gk-card, role img and the card's name. By default, the French deck.
   */
  face?: (c: Card, label: string) => ReactNode;
  /** Nothing can be played now (bidding), but the hand isn't greyed out: it's for reading. */
  quiet?: boolean;
}) {
  const [lifted, setLifted] = useState<Card | null>(null);
  const [focus, setFocus] = useState(0);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const dragRef = useRef<{ card: Card; y: number; played: boolean; mouse: boolean } | null>(null);
  const at = Math.min(focus, Math.max(0, cards.length - 1));

  const choose = (c: Card, direct: boolean) => {
    if (!canPlay(c)) return;
    if (pick === "select" || direct || lifted === c) {
      setLifted(null);
      onPlay(c);
    } else {
      setLifted(c);
    }
  };
  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const to =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? cards.length - 1
          : step !== 0
            ? Math.max(0, Math.min(cards.length - 1, index + step))
            : null;
    if (to === null) return;
    event.preventDefault();
    setFocus(to);
    buttonsRef.current[to]?.focus();
  };
  const onDown = (event: PointerEvent, c: Card) => {
    dragRef.current = {
      card: c,
      y: event.clientY,
      played: false,
      mouse: event.pointerType === "mouse",
    };
  };
  const onMove = (event: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.played) return;
    if (d.y - event.clientY > DRAG_PLAY_PX && canPlay(d.card)) {
      d.played = true;
      setLifted(null);
      onPlay(d.card);
    }
  };

  return (
    <div
      className={quiet ? "gk-hand gk-quiet" : "gk-hand"}
      role="group"
      aria-label={label}
      dir="ltr"
      // Bigger hands overlap more, so 13 cards still fit a phone.
      style={
        { "--overlap": cards.length <= 6 ? 0.2 : cards.length <= 9 ? 0.4 : 0.55 } as CSSProperties
      }
    >
      {cards.map((c, i) => {
        const playable = canPlay(c);
        const up = pick === "select" ? (selected?.has(c) ?? false) : lifted === c;
        return (
          <button
            // A hand holds each card once; hidden cards are told apart by place.
            key={c === HIDDEN ? `h${String(i)}` : c}
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            type="button"
            className="gk-hand-card"
            data-up={up || undefined}
            aria-disabled={!playable}
            aria-pressed={pick === "select" ? up : undefined}
            tabIndex={i === at ? 0 : -1}
            onFocus={() => {
              setFocus(i);
            }}
            onKeyDown={(event) => {
              onKey(event, i);
            }}
            onPointerDown={(event) => {
              onDown(event, c);
            }}
            onPointerMove={onMove}
            onClick={(event) => {
              const d = dragRef.current;
              dragRef.current = null;
              if (d?.played) return;
              // A mouse click, Enter or Space (detail 0) plays at once; a tap lifts first.
              choose(c, event.detail === 0 || (d?.mouse ?? false));
            }}
          >
            {/* The card's image names the button (its indices are part of the picture). */}
            {face ? (
              face(c, text.name(c))
            ) : (
              <PlayingCard card={c} four={four} label={text.name(c)} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Face-down cards in a row, for another player's hand: the count is what you may know. */
export function CardBacks({ count, label }: { count: number; label: string }) {
  return (
    <div className="gk-backs" role="img" aria-label={label} dir="ltr">
      {Array.from({ length: count }, (_, i) => (
        <PlayingCard key={i} card={HIDDEN} />
      ))}
    </div>
  );
}

/**
 * Styles for cards and hands, scoped by the gk- prefix like KIT_CSS. A card
 * is --card-w wide (set it on a parent to size the table); a hand overlaps
 * its cards so it fits the width.
 */
export const CARD_CSS = `
.gk-card { display: block; width: var(--card-w, clamp(2.75rem, 12vw, 4.75rem)); aspect-ratio: 60 / 84; height: auto; filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.25)); }
.gk-face { fill: var(--card-face); stroke: var(--card-edge); stroke-width: 1; }
.gk-rank { font: 700 15px/1 system-ui, sans-serif; text-anchor: middle; }
.gk-card text { direction: ltr; unicode-bidi: isolate; }
.gk-rank-big { font: 800 24px/1 system-ui, sans-serif; text-anchor: start; }
.gk-court { fill: none; stroke: var(--card-edge); stroke-width: 0.8; }
.gk-mark { stroke-width: 1.2; stroke-linejoin: round; }
.gk-back { fill: var(--card-back); stroke: var(--card-edge); stroke-width: 1; }
.gk-back-lines { fill: none; stroke: var(--card-back-ink); stroke-width: 0.8; }
.gk-hand { display: flex; justify-content: center; padding-top: 0.9rem; max-width: 100%; }
.gk-hand-card { position: relative; flex: 0 1 auto; min-width: 0; padding: 0; border: 0; background: none; border-radius: 0.4rem; cursor: pointer; transition: transform 120ms ease; touch-action: none; }
.gk-hand-card + .gk-hand-card { margin-inline-start: calc(var(--card-w, clamp(2.75rem, 12vw, 4.75rem)) * var(--overlap, 0.45) * -1); }
.gk-hand-card[data-up] { transform: translateY(-0.8rem); }
.gk-hand-card[aria-disabled="true"] { cursor: default; }
.gk-hand-card[aria-disabled="true"] .gk-card { filter: brightness(0.72) saturate(0.6); }
.gk-quiet .gk-hand-card[aria-disabled="true"] .gk-card { filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.25)); }
.gk-hand-card:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; z-index: 1; }
.gk-backs { display: flex; --card-w: clamp(1.6rem, 6vw, 2.5rem); }
.gk-backs .gk-card + .gk-card { margin-inline-start: calc(var(--card-w) * -0.6); }
.gk-four svg { width: 2rem; height: 1rem; }
@media (prefers-reduced-motion: reduce) { .gk-hand-card { transition: none; } }
`;
