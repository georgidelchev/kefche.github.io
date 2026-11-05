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
            <p className="gwr-earned" role="status">
              {hud.earned === null ? "" : t("xpEarned", { xp: number.format(hud.earned) })}
            </p>
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
