// Analysis of a finished game (Phase 6 step 9): step through its moves on a
// board nobody plays on, with Stockfish's evaluation and best line for the
// position shown, worked out in the browser (no server cost). The engine
// (1.8 MB) loads only when the player turns it on, then follows every step.
// On the board (one tab stop) and the step buttons, the arrow keys, Home and
// End step through the game; the board stays a→h in right-to-left pages, as
// at play.
import { Chess } from "chess.js";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type { AnalysisContext } from "@kefche/game-sdk/browser";

import { forWhite, lineText, whiteShare, type GameRecord } from "./model";
import { checkedKing, codeOf, squareAt } from "../renderer/board-model";
import { BOARD_CSS, THEME_KEY, THEMES } from "../renderer/board-styles";
import { PIECE_KEYS, pieceImage } from "../renderer/pieces";
import { GPL_LICENCE, STOCKFISH_SOURCE } from "../renderer/stockfish-credit";

import type { EngineReply, EngineScore } from "./engine-protocol";

interface Props {
  record: GameRecord;
  context: AnalysisContext;
}

/** The engine's latest word on a position. */
interface Evaluation {
  fen: string;
  depth: number;
  score: EngineScore;
  pv: string[];
}

/** Unicode isolates keep chess notation left to right inside any sentence. */
const ltr = (text: string) => `⁦${text}⁩`;

export function Analysis({ record, context }: Props) {
  const { t, locale } = context;
  const last = record.plies.length;
  // The game opens at its final position.
  const [ply, setPly] = useState(last);
  const [flipped, setFlipped] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const workerRef = useRef<Worker | null>(null);
  /** Positions asked for, by request id: an answer is shown only for its own position. */
  const askedRef = useRef(new Map<number, string>());
  const movesRef = useRef<HTMLOListElement>(null);
  const [theme] = useState(() => {
    const saved = context.storage.get(THEME_KEY);
    return THEMES.find((name) => name === saved) ?? "sand";
  });

  const fen = ply === 0 ? record.start : (record.plies[ply - 1]?.fen ?? record.start);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const lastMove = ply > 0 ? record.plies[ply - 1] : undefined;
  const check = checkedKing(chess);
  const over = chess.isGameOver();
  const shown = evaluation?.fen === fen ? evaluation : null;

  // Stockfish starts when first turned on and stays for the page.
  useEffect(() => {
    if (!engineOn || workerRef.current) return;
    const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<EngineReply>) => {
      const message = event.data;
      if (message.kind === "ready") setReady(true);
      if (message.kind !== "info") return;
      const asked = askedRef.current.get(message.id);
      if (asked === undefined) return;
      setEvaluation({ fen: asked, depth: message.depth, score: message.score, pv: message.pv });
    };
    workerRef.current = worker;
  }, [engineOn]);
  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    [],
  );

  // Each position shown while the engine is on (a finished position needs no engine).
  useEffect(() => {
    const worker = workerRef.current;
    if (!engineOn || !worker || over) return;
    const id = askedRef.current.size + 1;
    askedRef.current.set(id, fen);
    worker.postMessage({ id, fen });
  }, [engineOn, fen, over]);

  // The move list keeps the current move in view. It scrolls itself only:
  // scrollIntoView would scroll the page down to the board too.
  useEffect(() => {
    const list = movesRef.current;
    const move = list?.querySelector("[aria-current]");
    if (!list || !move) return;
    const box = list.getBoundingClientRect();
    const at = move.getBoundingClientRect();
    const past = (start: number, end: number, from: number, to: number) =>
      start < from ? start - from : end > to ? end - to : 0;
    list.scrollBy({
      left: past(at.left, at.right, box.left, box.right),
      top: past(at.top, at.bottom, box.top, box.bottom),
    });
  }, [ply]);

  const go = (to: number) => {
    setPly(Math.max(0, Math.min(last, to)));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowLeft: ply - 1,
      ArrowRight: ply + 1,
      Home: 0,
      End: last,
    };
    const to = step[event.key];
    if (to === undefined) return;
    event.preventDefault();
    go(to);
  };

  const label = (square: ReturnType<typeof squareAt>) => {
    const piece = chess.get(square);
    return piece
      ? t("squarePiece", { square, piece: t(PIECE_KEYS[codeOf(piece.color, piece.type)]) })
      : t("squareEmpty", { square });
  };
  const [whiteName, blackName] = record.names;
  const ending = (): string => {
    if (chess.isCheckmate()) {
      return t("endCheckmate", { name: chess.turn() === "w" ? blackName : whiteName });
    }
    if (chess.isStalemate()) return t("endStalemate");
    if (chess.isInsufficientMaterial()) return t("endInsufficient");
    return "";
  };

  // The bar and score, from White's side.
  const score: EngineScore | null = chess.isCheckmate()
    ? { mate: chess.turn() === "w" ? -1 : 1 }
    : over
      ? { cp: 0 }
      : shown
        ? forWhite(shown.score, fen)
        : null;
  const scoreText = (s: EngineScore) =>
    "mate" in s
      ? t(s.mate > 0 ? "mateWhite" : "mateBlack", { moves: Math.abs(s.mate) })
      : new Intl.NumberFormat(locale, {
          signDisplay: "exceptZero",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(s.cp / 100);

  const pairs = Array.from({ length: Math.ceil(last / 2) }, (_, i) => i * 2);
  const moveButton = (index: number) => {
    const move = record.plies[index];
    if (!move) return null;
    return (
      <button
        type="button"
        aria-current={ply === index + 1 ? "step" : undefined}
        onClick={() => {
          go(index + 1);
        }}
      >
        {move.san}
      </button>
    );
  };
  const player = (seat: 0 | 1, area: "top" | "bottom") => (
    <div className={`gch-player gch-${area}`}>
      <span
        className="gch-chip"
        style={{ backgroundImage: pieceImage(seat === 0 ? "wK" : "bK") }}
        aria-hidden="true"
      />
      <span className="gch-name">{seat === 0 ? whiteName : blackName}</span>
    </div>
  );
  const status = ending();

  return (
    <div className="gch gch-analysis" data-theme={theme}>
      <style>{BOARD_CSS + ANALYSIS_CSS}</style>
      <div className="gch-layout">
        {player(flipped ? 0 : 1, "top")}

        <div className="gch-board-wrap">
          <div
            className="gch-board"
            role="grid"
            aria-readonly="true"
            aria-label={t("boardLabel")}
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            {Array.from({ length: 8 }, (_, row) => (
              <div key={row} role="row" className="gch-row">
                {Array.from({ length: 8 }, (__, col) => {
                  const square = squareAt(row, col, flipped);
                  const piece = chess.get(square);
                  return (
                    <div
                      key={square}
                      role="gridcell"
                      aria-label={label(square)}
                      className="gch-square"
                      data-dark={(row + col) % 2 === 1 ? "" : undefined}
                      data-last={
                        lastMove?.from === square || lastMove?.to === square ? "" : undefined
                      }
                      data-check={square === check ? "" : undefined}
                    >
                      {col === 0 && <span className="gch-rank">{square[1]}</span>}
                      {row === 7 && <span className="gch-file">{square[0]}</span>}
                      {piece && (
                        <span
                          className="gch-piece"
                          style={{ backgroundImage: pieceImage(codeOf(piece.color, piece.type)) }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {player(flipped ? 1 : 0, "bottom")}

        <div className="gch-panel">
          <div
            className="gch-buttons"
            dir="ltr"
            role="toolbar"
            aria-label={t("moves")}
            tabIndex={-1}
            onKeyDown={onKeyDown}
          >
            <button
              type="button"
              className="gch-button gch-step"
              aria-label={t("navFirst")}
              disabled={ply === 0}
              onClick={() => {
                go(0);
              }}
            >
              «
            </button>
            <button
              type="button"
              className="gch-button gch-step"
              aria-label={t("navPrev")}
              disabled={ply === 0}
              onClick={() => {
                go(ply - 1);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="gch-button gch-step"
              aria-label={t("navNext")}
              disabled={ply === last}
              onClick={() => {
                go(ply + 1);
              }}
            >
              ›
            </button>
            <button
              type="button"
              className="gch-button gch-step"
              aria-label={t("navLast")}
              disabled={ply === last}
              onClick={() => {
                go(last);
              }}
            >
              »
            </button>
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
          </div>

          <ol ref={movesRef} className="gch-moves" aria-label={t("moves")} dir="ltr">
            {pairs.map((index) => (
              <li key={index}>
                <span className="gch-move-number">{index / 2 + 1}.</span>
                {moveButton(index)}
                {moveButton(index + 1)}
              </li>
            ))}
          </ol>
          {/* The move shown, for screen readers (the board itself isn't announced). */}
          <p className="gch-sr" aria-live="polite">
            {lastMove ? `${String(Math.ceil(ply / 2))}. ${lastMove.san}` : ""}
          </p>
          {status && <p className="gch-status">{status}</p>}

          <button
            type="button"
            className="gch-button gch-engine"
            aria-pressed={engineOn}
            onClick={() => {
              setEngineOn(!engineOn);
            }}
          >
            {t("engine")}
          </button>
          {engineOn && (
            <div className="gch-eval">
              {!ready && !over ? (
                <p className="gch-note">{t("engineLoading")}</p>
              ) : (
                <>
                  <div className="gch-eval-bar" dir="ltr" aria-hidden="true">
                    <span style={{ width: `${String(score ? whiteShare(score) : 50)}%` }} />
                  </div>
                  {score && (
                    <p className="gch-eval-score">
                      {t("evaluation", { score: scoreText(score) })}
                      {shown && !over && (
                        <span className="gch-note">
                          {" · "}
                          {t("depth", { depth: shown.depth })}
                        </span>
                      )}
                    </p>
                  )}
                  {shown && !over && shown.pv.length > 0 && (
                    <p className="gch-line">
                      {t("bestLine", { line: ltr(lineText(fen, shown.pv)) })}
                    </p>
                  )}
                </>
              )}
              <p className="gch-credit">
                {t("creditAnalysis")}{" "}
                <a href={STOCKFISH_SOURCE} target="_blank" rel="noopener noreferrer">
                  {t("creditSource")}
                </a>
                {" · "}
                <a href={GPL_LICENCE} target="_blank" rel="noopener noreferrer">
                  GPL-3.0
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ANALYSIS_CSS = `
.gch-analysis .gch-piece { cursor: default; }
.gch-analysis .gch-board:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.gch-analysis .gch-moves span { min-width: 1.8rem; }
.gch-moves button { min-width: 3.2rem; min-height: 1.75rem; padding: 0 0.3rem; border: 0; border-radius: 0.35rem; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer; }
.gch-moves button[aria-current] { background: var(--surface); font-weight: 700; box-shadow: 0 0 0 1px var(--border-strong); }
.gch-moves button:focus-visible, .gch-engine:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.gch-step { min-width: 2.75rem; font-size: 1.25rem; line-height: 1; }
.gch-engine { justify-self: start; }
.gch-engine[aria-pressed="true"] { border-color: var(--brand); }
.gch-eval { display: grid; gap: 0.4rem; padding: 0.6rem; border-radius: 0.6rem; border: 1px solid var(--border-strong); }
.gch-eval p { margin: 0; }
.gch-eval-bar { position: relative; height: 0.9rem; border-radius: 999px; overflow: hidden; background: #2b2f3a; box-shadow: 0 0 0 1px var(--border-strong); }
.gch-eval-bar span { position: absolute; inset-block: 0; left: 0; background: #f4f4f1; transition: width 0.3s ease; }
@media (prefers-reduced-motion: reduce) { .gch-eval-bar span { transition: none; } }
.gch-eval-score { font-weight: 700; font-variant-numeric: tabular-nums; }
.gch-eval-score .gch-note { font-weight: 400; }
.gch-line { font-size: 0.9rem; overflow-wrap: anywhere; }
`;
