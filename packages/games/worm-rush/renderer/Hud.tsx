// The arena's HUD, laid over the stage: length, place and the connection,
// a minimap, the live top 10, a feed of knockouts, the knocked-out card with
// Play again, and the touch controls' settings (left-handed, moving the boost
// button). Only its buttons and panels take pointers; touches elsewhere go
// through to the arena. Surfaces over the arena keep its night colours; the
// cards use the site's tokens.
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { GameContext } from "@kefche/game-sdk/browser";

import type { BoardRow, FeedEntry, WormClient } from "./client";

interface Props {
  client: WormClient;
  t: GameContext["t"];
  locale: string;
}

const GEAR =
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z";

function formatTime(ms: number, number: Intl.NumberFormat): string {
  const seconds = Math.floor(ms / 1000);
  return `${number.format(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;
}

function feedText(entry: FeedEntry, t: Props["t"]): string {
  if (entry.you) return entry.by === null ? t("feedYouEdge") : t("feedTookYou", { by: entry.by });
  if (entry.byYou) return t("feedYouTook", { victim: entry.victim });
  return entry.by === null
    ? t("feedEdge", { victim: entry.victim })
    : t("feedKnockout", { by: entry.by, victim: entry.victim });
}

function Row({ row, t, number }: { row: BoardRow; t: Props["t"]; number: Intl.NumberFormat }) {
  return (
    <li className="gwr-row" data-you={row.you ? "" : undefined}>
      <span className="gwr-rank">{number.format(row.place)}</span>
      <span className="gwr-name" data-bot={row.bot ? "" : undefined}>
        {row.you ? t("you") : row.name}
        {row.bot && <span className="gwr-bot"> {t("bot")}</span>}
      </span>
      <span className="gwr-len">{number.format(row.length)}</span>
    </li>
  );
}

export function Hud({ client, t, locale }: Props) {
  const hud = useSyncExternalStore(client.subscribe, client.state);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [panel, setPanel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState(client.controls.layout);
  const againRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const leftId = useId();

  const out = !hud.alive && hud.out !== null;
  // The knocked-out card takes focus, so Enter or Space plays again.
  useEffect(() => {
    if (out) againRef.current?.focus();
  }, [out]);
  useEffect(() => {
    if (!panel) return;
    panelRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    // Escape closes the panel before the player sees it (where it pauses the game).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setPanel(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [panel]);

  // Said to screen readers: what happens to the player, not every knockout.
  const mine = hud.feed.filter((f) => f.you || f.byYou).at(-1);

  const stopEditing = () => {
    client.controls.setEditing(false);
    setEditing(false);
  };

  return (
    <div className="gwr-hud">
      <style>{CSS}</style>
      <div className="gwr-start">
        <div className="gwr-chip gwr-stats">
          <span className="gwr-label">{t("length")}</span>
          <strong className="gwr-big">{number.format(hud.alive ? hud.length : 0)}</strong>
          {hud.alive && hud.place > 0 && (
            <span>
              {t("place", { place: number.format(hud.place), count: number.format(hud.of) })}
            </span>
          )}
          {hud.latency !== null && (
            <span
              className="gwr-ping"
              data-quality={hud.latency < 100 ? "good" : hud.latency < 200 ? "fair" : "poor"}
            >
              <span className="gwr-dot" aria-hidden="true" />
              {t("ping", { ms: number.format(Math.round(hud.latency)) })}
            </span>
          )}
        </div>
        <svg className="gwr-map" viewBox="-1.1 -1.1 2.2 2.2" role="img" aria-label={t("map")}>
          <circle r="1" className="gwr-map-edge" />
          {hud.alive && <circle cx={hud.map.x} cy={hud.map.y} r="0.12" className="gwr-map-you" />}
        </svg>
        <button
          type="button"
          className="gwr-icon"
          data-arena-ui=""
          aria-label={t("controls")}
          aria-expanded={panel}
          onClick={() => {
            setPanel(!panel);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d={GEAR}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <section className="gwr-chip gwr-board" aria-label={t("board")}>
        <ol>
          {hud.board.map((row) => (
            <Row key={row.id} row={row} t={t} number={number} />
          ))}
        </ol>
        {hud.you && (
          <ol className="gwr-yours">
            <Row row={hud.you} t={t} number={number} />
          </ol>
        )}
      </section>

      <ul className="gwr-feed" aria-hidden="true">
        {hud.feed.map((entry) => (
          <li key={entry.key} data-you={entry.you || entry.byYou ? "" : undefined}>
            {feedText(entry, t)}
          </li>
        ))}
      </ul>
      <p className="gwr-sr" role="status">
        {mine ? feedText(mine, t) : ""}
      </p>

      {(hud.status === "connecting" || hud.status === "reconnecting") && (
        <p className="gwr-chip gwr-notice" role="status">
          {t(hud.status === "connecting" ? "connecting" : "reconnecting")}
        </p>
      )}

      {editing && (
        <div className="gwr-card gwr-editing" data-arena-ui="">
          <p>{t("moveHint")}</p>
          <div className="gwr-actions">
            <button
              type="button"
              className="gwr-secondary"
              onClick={() => {
                const next = { ...client.controls.layout, button: null };
                client.controls.setLayout(next);
                setLayout(next);
              }}
            >
              {t("resetButton")}
            </button>
            <button type="button" className="gwr-primary" onClick={stopEditing}>
              {t("done")}
            </button>
          </div>
        </div>
      )}

      {panel && (
        <div
          ref={panelRef}
          className="gwr-card gwr-panel"
          role="dialog"
          aria-labelledby={titleId}
          data-arena-ui=""
        >
          <h2 id={titleId}>{t("controls")}</h2>
          <p className="gwr-hint">{t("touchHint")}</p>
          <p className="gwr-hint">{t("keyboardHint")}</p>
          <div className="gwr-check">
            <input
              id={leftId}
              type="checkbox"
              checked={layout.leftHanded}
              onChange={(e) => {
                const next = { ...client.controls.layout, leftHanded: e.currentTarget.checked };
                client.controls.setLayout(next);
                setLayout(next);
              }}
            />
            <label htmlFor={leftId}>
              {t("leftHanded")}
              <span className="gwr-hint">{t("leftHandedHint")}</span>
            </label>
          </div>
          <div className="gwr-actions">
            <button
              type="button"
              className="gwr-secondary"
              onClick={() => {
                setPanel(false);
                setEditing(true);
                client.controls.setEditing(true);
              }}
            >
              {t("moveButton")}
            </button>
            <button
              type="button"
              className="gwr-primary"
              onClick={() => {
                setPanel(false);
              }}
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {out && hud.out && !panel && !editing && (
        <div className="gwr-out" data-arena-ui="">
          <section className="gwr-card" aria-labelledby={`${titleId}-out`}>
            <h2 id={`${titleId}-out`}>{t("outTitle")}</h2>
            <p>{hud.out.by === null ? t("feedYouEdge") : t("feedTookYou", { by: hud.out.by })}</p>
            <dl className="gwr-results">
              <div>
                <dt>{t("bestLength")}</dt>
                <dd>{number.format(hud.out.best)}</dd>
              </div>
              <div>
                <dt>{t("knockouts")}</dt>
                <dd>{number.format(hud.out.kills)}</dd>
              </div>
              <div>
                <dt>{t("timeAlive")}</dt>
                <dd>{formatTime(hud.out.ms, number)}</dd>
              </div>
            </dl>
            <button
              ref={againRef}
              type="button"
              className="gwr-primary"
              onClick={() => {
                client.respawn();
              }}
            >
              {t("playAgain")}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

// Scoped by the gwr- prefix. Text over the arena is white on a dark glass,
// whatever the site's theme; the cards use the site's surfaces.
const CSS = `
.gwr-hud { position: absolute; inset: 0; pointer-events: none; color: #fff; font-size: 0.875rem; line-height: 1.3; }
.gwr-hud button { font: inherit; cursor: pointer; pointer-events: auto; }
.gwr-hud button:focus-visible, .gwr-hud input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gwr-chip { background: rgb(8 11 24 / 0.68); border-radius: 0.65rem; padding: 0.35rem 0.55rem; }
.gwr-start { position: absolute; top: 0.5rem; inset-inline-start: 0.5rem; display: grid; justify-items: start; gap: 0.4rem; }
.gwr-stats { display: grid; gap: 0.05rem; min-width: 5.5rem; }
.gwr-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #c8d0ec; }
.gwr-big { font-size: 1.35rem; font-variant-numeric: tabular-nums; line-height: 1.1; }
.gwr-ping { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; color: #c8d0ec; }
.gwr-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: #3ddc84; }
.gwr-ping[data-quality="fair"] .gwr-dot { background: #ffbe3d; }
.gwr-ping[data-quality="poor"] .gwr-dot { background: #ff5c5c; }
.gwr-map { width: 4.5rem; height: 4.5rem; }
.gwr-map-edge { fill: rgb(8 11 24 / 0.6); stroke: #ff4d6d; stroke-width: 0.05; }
.gwr-map-you { fill: #fff; }
.gwr-icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border: 0; border-radius: 50%; background: rgb(8 11 24 / 0.68); color: #fff; }
.gwr-icon svg { width: 1.4rem; height: 1.4rem; }
.gwr-board { position: absolute; top: 0.5rem; inset-inline-end: 0.5rem; width: 9.75rem; font-size: 0.75rem; background: rgb(8 11 24 / 0.8); }
.gwr-board ol { margin: 0; padding: 0; list-style: none; }
.gwr-yours { border-top: 1px solid rgb(255 255 255 / 0.25); margin-top: 0.2rem !important; padding-top: 0.2rem !important; }
.gwr-row { display: grid; grid-template-columns: 1.4rem minmax(0, 1fr) auto; gap: 0.3rem; padding: 0.05rem 0; }
.gwr-row[data-you] { color: #ffe066; font-weight: 700; }
.gwr-rank { color: #c8d0ec; font-variant-numeric: tabular-nums; }
.gwr-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gwr-name[data-bot] { color: #c8d0ec; }
.gwr-bot { color: #aab3d6; font-size: 0.65rem; }
.gwr-len { font-variant-numeric: tabular-nums; }
.gwr-feed { position: absolute; bottom: 7rem; left: 50%; transform: translateX(-50%); width: min(70%, 22rem); margin: 0; padding: 0; list-style: none; display: grid; gap: 0.25rem; justify-items: center; font-size: 0.8rem; text-align: center; }
.gwr-feed li { background: rgb(8 11 24 / 0.6); border-radius: 0.5rem; padding: 0.15rem 0.5rem; }
.gwr-feed li[data-you] { color: #ffe066; font-weight: 700; }
.gwr-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.gwr-notice { position: absolute; top: 40%; left: 50%; transform: translateX(-50%); margin: 0; padding: 0.6rem 1rem; font-weight: 600; text-align: center; }
.gwr-card { pointer-events: auto; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 1rem; padding: 1rem 1.1rem; box-shadow: 0 10px 30px rgb(0 0 0 / 0.35); }
.gwr-card h2 { margin: 0 0 0.4rem; font-size: 1.15rem; }
.gwr-card p { margin: 0 0 0.6rem; }
.gwr-hint { display: block; color: var(--text-muted); font-size: 0.8rem; }
.gwr-out { position: absolute; inset: 0; display: grid; place-items: center; padding: 1rem; pointer-events: auto; background: rgb(0 0 0 / 0.35); }
.gwr-out .gwr-card { width: min(20rem, 100%); text-align: center; }
.gwr-results { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin: 0.4rem 0 1rem; }
.gwr-results dt { color: var(--text-muted); font-size: 0.75rem; }
.gwr-results dd { margin: 0; font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.gwr-primary, .gwr-secondary { min-height: 2.75rem; padding: 0 1.1rem; border-radius: 0.7rem; font-weight: 700; }
.gwr-primary { border: 0; background: var(--brand); color: var(--on-brand); }
.gwr-out .gwr-primary { width: 100%; }
.gwr-secondary { border: 1px solid var(--border-strong); background: transparent; color: var(--text); }
.gwr-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; }
.gwr-panel { position: absolute; top: 0.5rem; left: 50%; transform: translateX(-50%); width: min(21rem, calc(100% - 1rem)); }
.gwr-check { display: flex; align-items: flex-start; gap: 0.6rem; margin: 0.4rem 0 0.9rem; }
.gwr-check input { width: 1.25rem; height: 1.25rem; margin: 0.1rem 0 0; accent-color: var(--brand); }
.gwr-check label { font-weight: 600; }
.gwr-check .gwr-hint { font-weight: 400; margin-top: 0.15rem; }
.gwr-editing { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); width: min(20rem, calc(100% - 1rem)); text-align: center; }
.gwr-editing .gwr-actions { justify-content: center; }
/* Phones: a narrower board; bots keep their muted colour, and "bot" stays for screen readers. */
@media (max-width: 30rem) {
  .gwr-board { width: 8.25rem; font-size: 0.7rem; padding: 0.3rem 0.45rem; }
  .gwr-row { grid-template-columns: 1.1rem minmax(0, 1fr) auto; gap: 0.25rem; }
  .gwr-bot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .gwr-stats { min-width: 4.75rem; }
  .gwr-big { font-size: 1.2rem; }
  .gwr-map { width: 3.75rem; height: 3.75rem; }
}
`;
