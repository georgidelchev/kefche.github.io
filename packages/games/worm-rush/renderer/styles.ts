// Worm Rush's page styles (HUD, mode screen, notices), added once by mount.ts.
// Scoped by the gwr- prefix. Text over the arena is white on a dark glass,
// whatever the site's theme; the cards use the site's surfaces.
export const CSS = `
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
.gwr-screen { position: absolute; inset: 0; display: grid; place-items: center; padding: 1rem; overflow: auto; background: rgb(0 0 0 / 0.4); }
.gwr-screen button { font: inherit; cursor: pointer; }
.gwr-screen button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gwr-screen .gwr-card { width: min(22rem, 100%); }
.gwr-modes { display: grid; gap: 0.6rem; margin-top: 0.4rem; }
.gwr-mode { display: grid; gap: 0.15rem; width: 100%; min-height: 4rem; padding: 0.7rem 0.9rem; border: 1px solid var(--border-strong); border-radius: 0.8rem; background: transparent; color: var(--text); text-align: start; }
.gwr-mode strong { font-size: 1.05rem; }
.gwr-mode span { color: var(--text-muted); font-size: 0.85rem; }
.gwr-mode[data-main] { border: 0; background: var(--brand); color: var(--on-brand); }
.gwr-mode[data-main] span { color: var(--on-brand); }
.gwr-joining { display: flex; align-items: center; justify-content: center; gap: 0.6rem; margin: 0; font-weight: 600; }
.gwr-spinner { width: 1.25rem; height: 1.25rem; border-radius: 50%; border: 3px solid var(--border-strong); border-top-color: var(--brand); animation: gwr-spin 0.9s linear infinite; }
@keyframes gwr-spin { to { transform: rotate(1turn); } }
@media (prefers-reduced-motion: reduce) { .gwr-spinner { animation: none; } }
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
