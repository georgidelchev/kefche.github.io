// The board's look, shared by play and analysis. Scoped by the gch- prefix.
// The board's colours are the theme's own (they don't change with the
// site's light or dark theme); everything else uses the site's tokens. The
// layout follows the player's width (a container query): board and panel
// side by side from 46rem, stacked below that.

/** The board themes, remembered in the game's storage under THEME_KEY. */
export const THEMES = ["sand", "sea", "meadow"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = "theme";

export const BOARD_CSS = `
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
