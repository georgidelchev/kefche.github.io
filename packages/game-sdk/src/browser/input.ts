// Input helpers (SPEC §2): swipes and arrow keys map to the same directions,
// so every grid game supports touch and keyboard with one handler.

export type Direction = "up" | "down" | "left" | "right";

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

/**
 * Calls `onDirection` for arrow keys and WASD while `target` (or its window)
 * has focus. Ignores keys typed into form fields. Returns an unsubscribe.
 */
export function onDirectionKeys(
  onDirection: (d: Direction) => void,
  target: Window | HTMLElement = window,
): () => void {
  const handler = (event: Event) => {
    const e = event as KeyboardEvent;
    const field =
      e.target instanceof HTMLElement &&
      e.target.closest("input, textarea, select, [contenteditable]");
    const direction = KEY_DIRECTIONS[e.code];
    if (!direction || field || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); // don't scroll the page
    onDirection(direction);
  };
  target.addEventListener("keydown", handler);
  return () => {
    target.removeEventListener("keydown", handler);
  };
}

export interface SwipeOptions {
  /** Minimum travel in CSS pixels before a swipe counts. */
  threshold?: number;
}

/**
 * Detects swipes on `element` with pointer events. Sets `touch-action: none`
 * so the page doesn't scroll or zoom while playing. Returns an unsubscribe.
 */
export function onSwipe(
  element: HTMLElement,
  onDirection: (d: Direction) => void,
  options: SwipeOptions = {},
): () => void {
  const threshold = options.threshold ?? 24;
  let start: { x: number; y: number; id: number } | null = null;
  element.style.touchAction = "none";

  const down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const up = (e: PointerEvent) => {
    if (start?.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    onDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };
  const cancel = () => {
    start = null;
  };
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", cancel);
  return () => {
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointercancel", cancel);
  };
}
