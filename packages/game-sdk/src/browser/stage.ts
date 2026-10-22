// Stage scaling (SPEC §2, §6.5): games draw in their own logical size and the
// stage fits it into the available space, letterboxed. Canvases render at the
// device pixel ratio, capped at 2 to save battery on dense screens.

export const MAX_DPR = 2;

export interface CanvasStage {
  context: CanvasRenderingContext2D;
  /** Current scale from logical units to CSS pixels. */
  readonly scale: number;
  dispose(): void;
}

/**
 * Sizes `canvas` to fit its parent while keeping `width`×`height` logical
 * units, and keeps doing so as the parent resizes. Drawing code always uses
 * logical units.
 */
export function createCanvasStage(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  onResize?: () => void,
): CanvasStage {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  const parent = canvas.parentElement ?? document.body;
  let scale = 1;

  const fit = () => {
    const box = parent.getBoundingClientRect();
    scale = Math.max(0.1, Math.min(box.width / width, box.height / height));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.style.width = `${String(Math.floor(width * scale))}px`;
    canvas.style.height = `${String(Math.floor(height * scale))}px`;
    canvas.width = Math.floor(width * scale * dpr);
    canvas.height = Math.floor(height * scale * dpr);
    context.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    onResize?.();
  };

  const observer = new ResizeObserver(fit);
  observer.observe(parent);
  fit();
  return {
    context,
    get scale() {
      return scale;
    },
    dispose() {
      observer.disconnect();
    },
  };
}

/** True when the screen is in portrait (for orientation hints). */
export const isPortrait = () => window.matchMedia("(orientation: portrait)").matches;
