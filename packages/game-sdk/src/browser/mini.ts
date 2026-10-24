// A square canvas for a game's MiniView (race mode's live boards of the other
// players): fills its container's width, stays sharp on high-density
// screens, and redraws on resize and theme changes.

export type MiniDraw = (
  ctx: CanvasRenderingContext2D,
  size: number,
  /** A design token's current value: color("surface-2") reads --surface-2. */
  color: (token: string) => string,
) => void;

export function createMiniCanvas(container: HTMLElement, draw: MiniDraw) {
  const canvas = document.createElement("canvas");
  // Decorative: the standings next to it say how the player is doing.
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;width:100%;aspect-ratio:1;border-radius:0.5rem";
  container.append(canvas);
  const ctx = canvas.getContext("2d");
  const color = (token: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim() || "#888";

  const redraw = () => {
    if (!ctx) return;
    const size = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.max(1, Math.round(size * dpr));
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    draw(ctx, size, color);
  };
  const resize = new ResizeObserver(redraw);
  resize.observe(canvas);
  const theme = new MutationObserver(redraw);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", redraw);

  return {
    redraw,
    destroy() {
      resize.disconnect();
      theme.disconnect();
      scheme.removeEventListener("change", redraw);
      canvas.remove();
    },
  };
}
