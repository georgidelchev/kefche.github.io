// Chess board: tap a piece and then a square, or drag it there. Dots mark
// the legal moves, the last move and a king in check are highlighted, and a
// picker offers the promotion piece. While the other side is to move, a move
// can be queued (a premove) and plays as soon as the turn comes. Beside the
// board on wide screens and under it on phones: both players with the
// material they've won, the move list, offers and the game's buttons. The
// board stays a→h, left to right, in every language.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { HAPTICS, vibrate, yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";

import { boardOf, engine, turnOf, type Action, type Config, type End, type State } from "../engine";
import {
  checkedKing,
  codeOf,
  colorOf,
  historyOf,
  isPromotion,
  lastMoveOf,
  materialOf,
  premoveTargets,
  squareAt,
} from "./board-model";
import { pieceImage, type PieceCode } from "./pieces";

import type { Sounds } from "./sounds";
import type { PieceSymbol, Square } from "chess.js";

interface Props {
  context: GameContext;
  config: Config;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const THEME_KEY = "theme";
const THEMES = ["sand", "sea", "meadow"] as const;
type Theme = (typeof THEMES)[number];
const THEME_LABEL_KEYS: Record<Theme, string> = {
  sand: "themeSand",
  sea: "themeSea",
  meadow: "themeMeadow",
};
const PIECE_KEYS: Record<PieceCode, string> = {
  wK: "pieceWK",
  wQ: "pieceWQ",
  wR: "pieceWR",
  wB: "pieceWB",
  wN: "pieceWN",
  wP: "pieceWP",
  bK: "pieceBK",
  bQ: "pieceBQ",
  bR: "pieceBR",
  bB: "pieceBB",
  bN: "pieceBN",
  bP: "pieceBP",
};
const PROMOTIONS = ["q", "r", "b", "n"] as const;
const STOCKFISH_SOURCE = "https://github.com/nmrugg/stockfish.js/tree/v19.0.1";
const GPL_LICENCE = "https://www.gnu.org/licenses/gpl-3.0.html";
const other = (seat: number) => 1 - seat;
/** Pointer travel that turns a press into a drag. */
const DRAG_PX = 6;

interface Press {
  square: Square;
  x: number;
  y: number;
  dragging: boolean;
  /** The press landed on a piece that can move, which it picked up. */
  picked: boolean;
  /** That piece was already picked up: a tap puts it down again. */
  wasSelected: boolean;
  /** The press landed on a square the picked-up piece can go to. */
  target: boolean;
}

export function Game({ context, config, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(config, 2, context.seed));
  const state = view?.state ?? initial;
  const chess = boardOf(state);
  const result = view?.result ?? null;
  const over = result !== null;

  const hotseat = match?.mode === "hotseat";
  /** This browser's own seat: premoves, orientation and the game's buttons. */
  const me = hotseat ? null : yourSeat(match) >= 0 ? yourSeat(match) : null;
  const human = view?.humanSeat ?? null;
  const mover = view?.toMove[0];
  const premoving = human === null && me !== null && !over && mover !== undefined && mover !== me;

  const [flipped, setFlipped] = useState(me === 1);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [premove, setPremove] = useState<{ from: Square; to: Square; uci: string } | null>(null);
  const [ghost, setGhost] = useState<{ from: Square; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<Square>(me === 1 ? "e7" : "e2");
  const [confirmResign, setConfirmResign] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = context.storage.get(THEME_KEY);
    return THEMES.find((name) => name === saved) ?? "sand";
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef(new Map<Square, HTMLDivElement>());
  const pressRef = useRef<Press | null>(null);
  const movesRef = useRef<HTMLOListElement>(null);
  const promotionRef = useRef<HTMLButtonElement>(null);
  // What has already been sounded, so re-renders stay quiet.
  const heardRef = useRef({ moves: state.moves.length, offers: 0, over: false });

  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  /** Whose pieces can be picked up now: the person to move, or a premove. */
  const picker = human ?? (premoving ? me : null);
  const pickable = (square: Square) =>
    picker !== null && !over && chess.get(square)?.color === colorOf(picker);
  const targetsOf = (from: Square): Square[] => {
    if (picker === null || !pickable(from)) return [];
    if (human !== null) return chess.moves({ square: from, verbose: true }).map((m) => m.to);
    return premoveTargets(state, picker, from);
  };
  const current = selected !== null && pickable(selected) ? selected : null;
  const targets = new Set(current === null ? [] : targetsOf(current));
  const last = lastMoveOf(state);
  const check = checkedKing(chess);
  const history = historyOf(state);
  const material = materialOf(chess);

  // A premove plays the moment its turn comes, if it's legal then. It's
  // watched on the store, which tells about a new turn before React renders.
  const premoveRef = useRef<string | null>(null);
  const queuePremove = (next: { from: Square; to: Square; uci: string } | null) => {
    premoveRef.current = next?.uci ?? null;
    setPremove(next);
  };
  useEffect(
    () =>
      store.subscribe(() => {
        const uci = premoveRef.current;
        const seat = store.get()?.humanSeat;
        if (uci === null || seat === null || seat === undefined || seat !== me) return;
        premoveRef.current = null;
        setPremove(null);
        // Once the session has finished announcing the move it just applied.
        queueMicrotask(() => {
          session.act(seat, { type: "move", uci });
        });
      }),
    [store, session, me],
  );

  // Sounds and haptics for what just happened.
  useEffect(() => {
    if (!view) return;
    const heard = heardRef.current;
    const offers = (state.drawOffer === null ? 0 : 1) + (state.takeback === null ? 0 : 2);
    const moved = state.moves.length !== heard.moves;
    const offered = offers !== 0 && offers !== heard.offers;
    const ended = result !== null && !heard.over;
    heardRef.current = { moves: state.moves.length, offers, over: result !== null };
    if (ended) {
      const outcome = result.outcome ?? [];
      const you = yourSeat(match);
      if (outcome.every((o) => o === 0.5)) sounds.play("draw");
      else if (you >= 0 && outcome[you] !== 1) {
        sounds.play("lose");
        vibrate(HAPTICS.lose, context.settings.haptics);
      } else {
        sounds.play("win");
        vibrate(HAPTICS.win, context.settings.haptics);
      }
      return;
    }
    if (moved) {
      const san = boardOf(state).history().at(-1) ?? "";
      sounds.play(san.includes("+") ? "check" : san.includes("x") ? "capture" : "move");
      vibrate(HAPTICS.tap, context.settings.haptics);
    } else if (offered) sounds.play("offer");
  }, [view, state, result, match, sounds, context.settings.haptics]);

  // The move list follows the game.
  useEffect(() => {
    const list = movesRef.current;
    list?.scrollTo({ top: list.scrollHeight, left: list.scrollWidth });
  }, [history.length]);

  useEffect(() => {
    if (promotion) promotionRef.current?.focus();
  }, [promotion]);

  const play = (uci: string) => {
    if (human !== null) session.act(human, { type: "move", uci });
  };

  /** Moves the picked-up piece from `from` to `to`, or queues it as a premove. */
  const tryMove = (from: Square, to: Square) => {
    setSelected(null);
    if (!targetsOf(from).includes(to)) {
      if (pickable(to)) setSelected(to);
      return;
    }
    const promoting = isPromotion(chess, from, to);
    if (human !== null) {
      if (promoting) setPromotion({ from, to });
      else play(`${from}${to}`);
      return;
    }
    queuePremove({ from, to, uci: `${from}${to}${promoting ? "q" : ""}` });
  };

  /** A tap, a click or Enter on a square. */
  const activate = (square: Square, wasSelected: boolean) => {
    if (current !== null && targets.has(square)) tryMove(current, square);
    else if (pickable(square) && !wasSelected) setSelected(square);
    else {
      setSelected(null);
      queuePremove(null);
    }
  };

  const squareFromPoint = (x: number, y: number): Square | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((x - rect.left) / rect.width) * 8);
    const row = Math.floor(((y - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return squareAt(row, col, flipped);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const square = squareFromPoint(e.clientX, e.clientY);
    if (!square) return;
    const target = current !== null && targets.has(square);
    const picked = !target && pickable(square);
    pressRef.current = {
      square,
      x: e.clientX,
      y: e.clientY,
      dragging: false,
      picked,
      wasSelected: current === square,
      target,
    };
    if (picked) {
      setSelected(square);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!press?.picked || !rect) return;
    if (!press.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_PX) return;
    press.dragging = true;
    setGhost({ from: press.square, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    pressRef.current = null;
    setGhost(null);
    if (!press) return;
    if (press.dragging) {
      const square = squareFromPoint(e.clientX, e.clientY);
      if (square && square !== press.square) tryMove(press.square, square);
      return;
    }
    if (press.target && current !== null) tryMove(current, press.square);
    else if (!press.picked || press.wasSelected) activate(press.square, press.wasSelected);
  };
  const onPointerCancel = () => {
    pressRef.current = null;
    setGhost(null);
  };

  const moveFocus = (square: Square) => {
    setFocus(square);
    cellsRef.current.get(square)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent, row: number, col: number) => {
    const to: Record<string, [number, number]> = {
      ArrowLeft: [row, Math.max(0, col - 1)],
      ArrowRight: [row, Math.min(7, col + 1)],
      ArrowUp: [Math.max(0, row - 1), col],
      ArrowDown: [Math.min(7, row + 1), col],
      Home: [row, 0],
      End: [row, 7],
    };
    const target = to[e.key];
    const square = squareAt(row, col, flipped);
    if (target) moveFocus(squareAt(target[0], target[1], flipped));
    else if (e.key === "Enter" || e.key === " ") activate(square, current === square);
    else if (e.key === "Escape") {
      setSelected(null);
      queuePremove(null);
    } else return;
    e.preventDefault();
  };

  const pieceName = (code: PieceCode) => t(PIECE_KEYS[code]);
  const label = (square: Square) => {
    const piece = chess.get(square);
    const values = {
      square,
      ...(piece ? { piece: pieceName(codeOf(piece.color, piece.type)) } : {}),
    };
    if (targets.has(square)) return t(piece ? "squareCapture" : "squareMove", values);
    return t(piece ? "squarePiece" : "squareEmpty", values);
  };

  const endText = (end: End): string => {
    const winner = end.winner === null ? "" : name(end.winner);
    switch (end.reason) {
      case "checkmate":
        return t("endCheckmate", { name: winner });
      case "stalemate":
        return t("endStalemate");
      case "insufficient":
        return t("endInsufficient");
      case "threefold":
        return t("endThreefold");
      case "fifty-moves":
        return t("endFiftyMoves");
      case "resign":
        return t("endResign", { name: end.winner === null ? "" : name(other(end.winner)) });
      case "agreement":
        return t("endAgreement");
      case "timeout":
        return "";
    }
  };
  // Running out of time is the session's to call, not the engine's.
  const timedOut = over && !state.end && mover === undefined;
  const status = state.end ? endText(state.end) : timedOut ? "" : check ? t("check") : "";
  const lastSan = history.at(-1);
  const announcement = [
    lastSan === undefined ? "" : t("played", { name: name(other(turnOf(state))), move: lastSan }),
    status,
  ]
    .filter(Boolean)
    .join(" ");

  // ---------------------------------------------------------- side actions
  const sideOf = (seat: number | undefined) =>
    seat === undefined ? [] : (engine.sideActions?.(state, seat) ?? []).map((a) => a.type);
  /** Who presses a button: on one device the player whose turn fits it, else you. */
  const actor = (type: Action["type"]): number | undefined => {
    if (!hotseat) return me ?? undefined;
    if (type === "takeback") return mover === undefined ? undefined : other(mover);
    if (type === "accept-draw" || type === "decline-draw") {
      return state.drawOffer === null ? undefined : other(state.drawOffer);
    }
    if (type === "accept-takeback" || type === "decline-takeback") {
      return state.takeback === null ? undefined : other(state.takeback);
    }
    return mover;
  };
  const can = (type: Action["type"]) => sideOf(actor(type)).includes(type);
  const side = (type: Action["type"]) => {
    const seat = actor(type);
    if (seat !== undefined) session.act(seat, { type } as Action);
    setConfirmResign(false);
  };
  const solo = match?.mode === "solo-bots";
  const drawOfferedToYou = can("accept-draw");
  const takebackAskedOfYou = can("accept-takeback");

  const topSeat = flipped ? 0 : 1;
  const bottomSeat = other(topSeat);
  const playerRow = (seat: number, area: "top" | "bottom") => (
    <div className={`gch-player gch-${area}`} data-active={mover === seat ? "" : undefined}>
      <span
        className="gch-chip"
        aria-hidden="true"
        style={{ backgroundImage: pieceImage(codeOf(colorOf(seat), "k")) }}
      />
      <span className="gch-name">{name(seat)}</span>
      <span className="gch-taken" role="group" aria-label={t("taken", { name: name(seat) })}>
        {material.taken[seat === 0 ? 0 : 1].map((type: PieceSymbol, i) => (
          <span
            key={`${type}${String(i)}`}
            className="gch-taken-piece"
            role="img"
            aria-label={pieceName(codeOf(colorOf(other(seat)), type))}
            style={{ backgroundImage: pieceImage(codeOf(colorOf(other(seat)), type)) }}
          />
        ))}
      </span>
      {material.lead[seat === 0 ? 0 : 1] > 0 && (
        <span className="gch-lead">
          {t("lead", { points: material.lead[seat === 0 ? 0 : 1].toLocaleString(context.locale) })}
        </span>
      )}
    </div>
  );

  const pairs = Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => [
    history[i * 2] ?? "",
    history[i * 2 + 1],
  ]);

  return (
    <div className="gch" data-theme={theme}>
      <style>{CSS}</style>
      <div className="gch-layout">
        {playerRow(topSeat, "top")}

        <div className="gch-board-wrap">
          <div
            ref={boardRef}
            className="gch-board"
            role="grid"
            aria-label={t("boardLabel")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            {Array.from({ length: 8 }, (_, row) => (
              <div key={row} role="row" className="gch-row">
                {Array.from({ length: 8 }, (__, col) => {
                  const square = squareAt(row, col, flipped);
                  const piece = chess.get(square);
                  const dark = (row + col) % 2 === 1;
                  return (
                    <div
                      key={square}
                      ref={(el) => {
                        if (el) cellsRef.current.set(square, el);
                        else cellsRef.current.delete(square);
                      }}
                      role="gridcell"
                      tabIndex={square === focus ? 0 : -1}
                      aria-label={label(square)}
                      aria-selected={square === current}
                      className="gch-square"
                      data-dark={dark ? "" : undefined}
                      data-last={last?.from === square || last?.to === square ? "" : undefined}
                      data-selected={square === current ? "" : undefined}
                      data-premove={
                        premove?.from === square || premove?.to === square ? "" : undefined
                      }
                      data-check={square === check ? "" : undefined}
                      data-target={targets.has(square) ? (piece ? "capture" : "move") : undefined}
                      onFocus={() => {
                        setFocus(square);
                      }}
                      onKeyDown={(e) => {
                        onKeyDown(e, row, col);
                      }}
                    >
                      {col === 0 && <span className="gch-rank">{square[1]}</span>}
                      {row === 7 && <span className="gch-file">{square[0]}</span>}
                      {piece && (
                        <span
                          className="gch-piece"
                          data-lifted={ghost?.from === square ? "" : undefined}
                          style={{ backgroundImage: pieceImage(codeOf(piece.color, piece.type)) }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {ghost && chess.get(ghost.from) && (
              <span
                className="gch-ghost"
                style={{
                  left: ghost.x,
                  top: ghost.y,
                  backgroundImage: pieceImage(
                    codeOf(chess.get(ghost.from)?.color ?? "w", chess.get(ghost.from)?.type ?? "p"),
                  ),
                }}
              />
            )}
          </div>

          {promotion && human !== null && (
            <div className="gch-promotion" role="dialog" aria-label={t("promoteTo")}>
              <p>{t("promoteTo")}</p>
              <div>
                {PROMOTIONS.map((type, i) => {
                  const code = codeOf(colorOf(human), type);
                  return (
                    <button
                      key={type}
                      ref={i === 0 ? promotionRef : undefined}
                      type="button"
                      aria-label={pieceName(code)}
                      style={{ backgroundImage: pieceImage(code) }}
                      onClick={() => {
                        setPromotion(null);
                        play(`${promotion.from}${promotion.to}${type}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setPromotion(null);
                      }}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                className="gch-button"
                onClick={() => {
                  setPromotion(null);
                }}
              >
                {t("cancel")}
              </button>
            </div>
          )}
        </div>

        {playerRow(bottomSeat, "bottom")}

        <div className="gch-panel">
          <ol ref={movesRef} className="gch-moves" aria-label={t("moves")} dir="ltr">
            {pairs.map(([white, black], i) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- a move number is its position
              <li key={i}>
                <span className="gch-move-number">{(i + 1).toLocaleString(context.locale)}.</span>
                <span data-current={i * 2 === history.length - 1 ? "" : undefined}>{white}</span>
                {black !== undefined && (
                  <span data-current={i * 2 + 1 === history.length - 1 ? "" : undefined}>
                    {black}
                  </span>
                )}
              </li>
            ))}
          </ol>

          {status && <p className="gch-status">{status}</p>}
          {premove && (
            <p className="gch-note">{t("premoveSet", { from: premove.from, to: premove.to })}</p>
          )}

          {state.drawOffer !== null && !over && (
            <div className="gch-offer">
              <p>{t("drawOffered", { name: name(state.drawOffer) })}</p>
              {drawOfferedToYou && (
                <div className="gch-buttons">
                  <button
                    type="button"
                    className="gch-button"
                    onClick={() => {
                      side("accept-draw");
                    }}
                  >
                    {t("accept")}
                  </button>
                  <button
                    type="button"
                    className="gch-button"
                    onClick={() => {
                      side("decline-draw");
                    }}
                  >
                    {t("decline")}
                  </button>
                </div>
              )}
            </div>
          )}
          {state.takeback !== null && !over && (
            <div className="gch-offer">
              <p>{t("takebackAsked", { name: name(state.takeback) })}</p>
              {takebackAskedOfYou && (
                <div className="gch-buttons">
                  <button
                    type="button"
                    className="gch-button"
                    onClick={() => {
                      side("accept-takeback");
                    }}
                  >
                    {t("accept")}
                  </button>
                  <button
                    type="button"
                    className="gch-button"
                    onClick={() => {
                      side("decline-takeback");
                    }}
                  >
                    {t("decline")}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="gch-buttons">
            {confirmResign ? (
              <>
                <button
                  type="button"
                  className="gch-button gch-danger"
                  onClick={() => {
                    side("resign");
                  }}
                >
                  {t("resignConfirm")}
                </button>
                <button
                  type="button"
                  className="gch-button"
                  onClick={() => {
                    setConfirmResign(false);
                  }}
                >
                  {t("cancel")}
                </button>
              </>
            ) : (
              <>
                {can("resign") && (
                  <button
                    type="button"
                    className="gch-button"
                    onClick={() => {
                      setConfirmResign(true);
                    }}
                  >
                    {t("resign")}
                  </button>
                )}
                {!solo && can("offer-draw") && (
                  <button
                    type="button"
                    className="gch-button"
                    onClick={() => {
                      side("offer-draw");
                    }}
                  >
                    {t("offerDraw")}
                  </button>
                )}
                {config.takebacks && can("takeback") && (
                  <button
                    type="button"
                    className="gch-button"
                    onClick={() => {
                      side("takeback");
                    }}
                  >
                    {t("takeback")}
                  </button>
                )}
                {solo && (
                  <button
                    type="button"
                    className="gch-button"
                    disabled={!view?.canUndo}
                    onClick={() => {
                      session.undo();
                    }}
                  >
                    {t("undo")}
                  </button>
                )}
                <button
                  type="button"
                  className="gch-button"
                  aria-pressed={flipped}
                  onClick={() => {
                    setFlipped(!flipped);
                  }}
                >
                  {t("flip")}
                </button>
              </>
            )}
          </div>

          <fieldset className="gch-themes">
            <legend>{t("theme")}</legend>
            {THEMES.map((name) => (
              <label key={name} data-theme={name}>
                <input
                  type="radio"
                  name="gch-theme"
                  checked={theme === name}
                  onChange={() => {
                    setTheme(name);
                    context.storage.set(THEME_KEY, name);
                  }}
                />
                <span className="gch-swatch" aria-hidden="true" />
                {t(THEME_LABEL_KEYS[name])}
              </label>
            ))}
          </fieldset>

          {/* Stockfish is GPL-3.0: its licence and source go wherever it plays. */}
          {match?.seats.some((seat) => seat.kind === "bot") && (
            <p className="gch-credit">
              {t("creditStockfish")}{" "}
              <a href={STOCKFISH_SOURCE} target="_blank" rel="noopener noreferrer">
                {t("creditSource")}
              </a>
              {" · "}
              <a href={GPL_LICENCE} target="_blank" rel="noopener noreferrer">
                GPL-3.0
              </a>
            </p>
          )}
        </div>
      </div>
      <p className="gch-sr" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

// Scoped by the gch- prefix. The board's colours are the theme's own (they
// don't change with the site's light or dark theme); everything else uses
// the site's tokens. The layout follows the player's width (a container
// query): board and panel side by side from 46rem, stacked below that.
const CSS = `
.gch { container-type: inline-size; width: 100%; margin-block: auto; user-select: none; -webkit-user-select: none; }
.gch[data-theme="sand"] { --gch-light: #f3e0bf; --gch-dark: #b98a55; }
.gch[data-theme="sea"] { --gch-light: #e2eaf6; --gch-dark: #6787b8; }
.gch[data-theme="meadow"] { --gch-light: #eef1d8; --gch-dark: #77964a; }
.gch-themes label[data-theme="sand"] { --gch-light: #f3e0bf; --gch-dark: #b98a55; }
.gch-themes label[data-theme="sea"] { --gch-light: #e2eaf6; --gch-dark: #6787b8; }
.gch-themes label[data-theme="meadow"] { --gch-light: #eef1d8; --gch-dark: #77964a; }
.gch-layout { --size: min(100cqi, max(16rem, calc(100dvh - 21rem))); display: grid; justify-content: center; gap: 0.5rem; grid-template-columns: var(--size); grid-template-areas: "top" "board" "bottom" "panel"; }
@container (min-width: 46rem) {
  .gch-layout { --size: min(calc(100cqi - 20rem), calc(100dvh - 9rem), 46rem); grid-template-columns: var(--size) 18rem; grid-template-rows: auto 1fr auto; grid-template-areas: "board top" "board panel" "board bottom"; column-gap: 1rem; }
  .gch-moves { flex-direction: column; flex-wrap: nowrap; max-height: 16rem; overflow-x: hidden; overflow-y: auto; }
}
.gch-top { grid-area: top; } .gch-bottom { grid-area: bottom; }
.gch-board-wrap { grid-area: board; position: relative; width: var(--size); }
.gch-panel { grid-area: panel; display: grid; align-content: start; gap: 0.5rem; min-width: 0; }
.gch-player { display: flex; align-items: center; gap: 0.5rem; min-height: 2.25rem; min-width: 0; padding: 0.25rem 0.5rem; border-radius: 0.6rem; }
.gch-player[data-active] { background: var(--surface-2); }
.gch-chip { flex: none; width: 1.9rem; height: 1.9rem; border-radius: 50%; background: #e9ecf3 center / 80% no-repeat; }
.gch-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gch-taken { display: flex; flex-wrap: wrap; min-width: 0; }
.gch-taken:not(:empty) { padding: 0.1rem 0.5rem 0.1rem 0.2rem; border-radius: 999px; background: #e9ecf3; }
.gch-taken-piece { width: 1.1rem; height: 1.1rem; margin-inline-end: -0.3rem; background: center / contain no-repeat; }
.gch-lead { margin-inline-start: 0.4rem; color: var(--text-muted); font-weight: 600; font-variant-numeric: tabular-nums; }
.gch-board { direction: ltr; position: relative; display: grid; grid-template-rows: repeat(8, 1fr); width: 100%; aspect-ratio: 1; border-radius: 0.5rem; overflow: hidden; box-shadow: 0 0 0 2px var(--border-strong); touch-action: none; }
.gch-row { display: grid; grid-template-columns: repeat(8, 1fr); }
.gch-square { position: relative; background: var(--gch-light); color: var(--gch-dark); }
.gch-square[data-dark] { background: var(--gch-dark); color: var(--gch-light); }
.gch-square::before { content: ""; position: absolute; inset: 0; pointer-events: none; }
.gch-square[data-last]::before { background: rgb(255 170 40 / 0.42); }
.gch-square[data-premove]::before { background: rgb(37 99 235 / 0.4); }
.gch-square[data-selected]::before { background: rgb(132 204 22 / 0.55); }
.gch-square[data-check]::before { background: radial-gradient(circle, rgb(220 30 30 / 0.95) 0%, rgb(220 30 30 / 0.6) 35%, transparent 72%); }
.gch-square[data-target]::after { content: ""; position: absolute; pointer-events: none; z-index: 2; }
.gch-square[data-target="move"]::after { inset: 36%; border-radius: 50%; background: rgb(20 24 38 / 0.35); }
.gch-square[data-target="capture"]::after { inset: 4%; border-radius: 50%; border: 0.28rem solid rgb(20 24 38 / 0.35); }
.gch-square:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; z-index: 3; }
.gch-rank, .gch-file { position: absolute; z-index: 1; font-size: clamp(0.55rem, 1.6cqi, 0.75rem); font-weight: 700; line-height: 1; pointer-events: none; }
.gch-rank { top: 0.15rem; inset-inline-start: 0.2rem; }
.gch-file { bottom: 0.12rem; inset-inline-end: 0.2rem; }
.gch-piece { position: absolute; inset: 0; z-index: 1; background: center / 90% no-repeat; cursor: pointer; }
.gch-piece[data-lifted] { opacity: 0.3; }
.gch-ghost { position: absolute; z-index: 5; width: 12.5%; aspect-ratio: 1; transform: translate(-50%, -60%) scale(1.15); background: center / 90% no-repeat; pointer-events: none; filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.35)); }
.gch-promotion { position: absolute; inset: 0; z-index: 6; display: grid; place-content: center; justify-items: center; gap: 0.75rem; background: rgb(20 24 38 / 0.6); border-radius: 0.5rem; color: #fff; }
.gch-promotion p { margin: 0; font-weight: 700; font-size: 1.1rem; }
.gch-promotion div { display: flex; gap: 0.5rem; }
.gch-promotion div button { width: min(18cqi, 5rem); max-width: calc(var(--size) / 5); aspect-ratio: 1; border-radius: 0.75rem; border: 2px solid var(--border-strong); background: var(--surface) center / 85% no-repeat; cursor: pointer; }
.gch-promotion button:focus-visible, .gch-button:focus-visible, .gch-themes input:focus-visible + .gch-swatch { outline: 2px solid var(--focus); outline-offset: 2px; }
.gch-moves { display: flex; flex-wrap: nowrap; gap: 0.25rem 0.75rem; margin: 0; padding: 0.4rem 0.5rem; min-height: 2.25rem; list-style: none; overflow-x: auto; border-radius: 0.6rem; background: var(--surface-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gch-moves li { display: flex; gap: 0.4rem; }
.gch-moves span { min-width: 3.2rem; }
.gch-moves .gch-move-number { min-width: 1.8rem; color: var(--text-muted); }
.gch-moves [data-current] { font-weight: 700; color: var(--text); }
.gch-status { margin: 0; font-weight: 700; }
.gch-note { margin: 0; color: var(--text-muted); }
.gch-offer { display: grid; gap: 0.4rem; padding: 0.5rem; border-radius: 0.6rem; border: 1px solid var(--border-strong); }
.gch-offer p { margin: 0; font-weight: 600; }
.gch-buttons { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.gch-button { min-height: 2.75rem; padding-inline: 0.9rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font: inherit; font-weight: 600; cursor: pointer; }
.gch-button[aria-pressed="true"] { background: var(--surface-2); }
.gch-button:disabled { opacity: 0.45; cursor: not-allowed; }
.gch-danger { border-color: var(--danger); color: var(--danger); }
.gch-themes { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; margin: 0; padding: 0; border: 0; }
.gch-themes legend { padding: 0; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 600; }
.gch-themes label { display: flex; align-items: center; gap: 0.4rem; min-height: 2.75rem; cursor: pointer; }
.gch-themes input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.gch-swatch { width: 1.6rem; height: 1.6rem; border-radius: 0.35rem; background: linear-gradient(135deg, var(--gch-light) 50%, var(--gch-dark) 50%); box-shadow: 0 0 0 1px var(--border-strong); }
.gch-themes input:checked + .gch-swatch { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text); }
.gch-credit { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
.gch-credit a { color: var(--link); }
.gch-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
