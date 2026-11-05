// Arena controls (SPEC §6.4): one steering state from touch, mouse and keys.
//   Touch:    a floating joystick wherever the thumb lands, and a hold-to-act
//             button (boost) that can be moved, on the left in left-handed mode.
//   Mouse:    steer toward the pointer, hold the button to act.
//   Keyboard: arrows or WASD (eight directions), Space to act.
// The touch controls show on touch screens and after any touch, and hide when
// a mouse is used. Headings are in screen space (radians, y down), which arena
// worlds share. Positions are physical (left/top), not mirrored in RTL: they
// follow the player's hands, not the reading direction.

import { z } from "zod/mini";

export interface ArenaSteer {
  /** Where to head, or null before any steering. Kept when steering stops. */
  heading: number | null;
  /** The action (boost) is held. */
  action: boolean;
}

export interface ControlLayout {
  /** The action button on the left and the joystick for the right thumb. */
  leftHanded: boolean;
  /** The button's center as a share of the stage (right-handed), or null for the corner. */
  button: { x: number; y: number } | null;
}

export const DEFAULT_CONTROL_LAYOUT: ControlLayout = { leftHanded: false, button: null };

/** Where the button sits by default (right-handed), as a share of the stage. */
const DEFAULT_BUTTON = { x: 0.86, y: 0.8 };
const BUTTON_SIZE = 76;
const EDGE = 12;
const JOYSTICK_RADIUS = 56;
const KNOB_SIZE = 52;
/** Joystick travel (CSS px) that still counts as no steering. */
const DEAD_ZONE = 8;
/** Mouse distance (CSS px) from the origin inside which steering holds still. */
const MOUSE_DEAD_ZONE = 6;
/** Smallest heading change worth reporting (a heading byte is 2π/256). */
const HEADING_EPSILON = 0.005;
const LAYOUT_KEY = "kefche:arena-controls";

const share = z.number().check(z.minimum(0), z.maximum(1));
const layoutSchema = z.object({
  leftHanded: z.boolean(),
  button: z.nullable(z.object({ x: share, y: share })),
});

export function loadControlLayout(): ControlLayout {
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    if (stored === null) return DEFAULT_CONTROL_LAYOUT;
    const parsed = layoutSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : DEFAULT_CONTROL_LAYOUT;
  } catch {
    return DEFAULT_CONTROL_LAYOUT;
  }
}

export function saveControlLayout(layout: ControlLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Applies to this page only.
  }
}

/**
 * A joystick pulled `dx`, `dy` from its base: the heading (null inside the
 * dead zone), the knob's offset (held within the radius), and how far the
 * base must follow a thumb that went past the radius.
 */
export function joystick(dx: number, dy: number, radius = JOYSTICK_RADIUS, deadZone = DEAD_ZONE) {
  const distance = Math.hypot(dx, dy);
  const inside = distance <= radius ? 1 : radius / distance;
  const follow = distance <= radius ? 0 : 1 - inside;
  return {
    heading: distance < deadZone ? null : Math.atan2(dy, dx),
    knobX: dx * inside,
    knobY: dy * inside,
    followX: dx * follow,
    followY: dy * follow,
  };
}

/** The heading the held arrow keys point to, or null when they cancel out. */
export function keyHeading(keys: {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}): number | null {
  const dx = Number(keys.right) - Number(keys.left);
  const dy = Number(keys.down) - Number(keys.up);
  return dx === 0 && dy === 0 ? null : Math.atan2(dy, dx);
}

/** The button's center in a `width`×`height` stage, kept fully inside it. */
export function buttonCenter(
  layout: ControlLayout,
  width: number,
  height: number,
  size = BUTTON_SIZE,
) {
  const at = layout.button ?? DEFAULT_BUTTON;
  const x = layout.leftHanded ? 1 - at.x : at.x;
  const half = size / 2 + EDGE;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, half), Math.max(half, max - half));
  return { x: clamp(x * width, width), y: clamp(at.y * height, height) };
}

/** The stored (right-handed) share for a button whose center is at `x`, `y`. */
export function buttonShare(
  layout: ControlLayout,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sx = Math.min(Math.max(x / Math.max(width, 1), 0), 1);
  const sy = Math.min(Math.max(y / Math.max(height, 1), 0), 1);
  return { x: layout.leftHanded ? 1 - sx : sx, y: sy };
}

type HeldKey = "up" | "down" | "left" | "right";

const STEER_KEYS: Record<string, HeldKey> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

export interface ArenaControlsOptions {
  /** The element the arena is drawn in; the touch controls are laid over it. */
  stage: HTMLElement;
  /** The button's accessible name (it shows an icon only). */
  actionLabel: string;
  /** The button's icon: an SVG element or other node, moved into the button. */
  actionIcon?: Node;
  onChange(steer: ArenaSteer): void;
  /** Where the player's own entity is, in CSS px from the stage's top left (default: the center). */
  origin?: () => { x: number; y: number };
  /** Default: the layout this device saved. */
  layout?: ControlLayout;
  /** Show the touch controls from the start (default: on touch screens). */
  touch?: boolean;
  /** Called after the player moves the button (the new layout is already saved). */
  onLayout?(layout: ControlLayout): void;
}

export interface ArenaControls {
  readonly steer: ArenaSteer;
  readonly layout: ControlLayout;
  /** Applies (and saves) a layout, for the left-handed switch or a reset. */
  setLayout(layout: ControlLayout): void;
  /** While editing, dragging the button moves it, and nothing steers. */
  setEditing(editing: boolean): void;
  /** Lets go of everything held (on pause, or when the player is knocked out). */
  release(): void;
  dispose(): void;
}

/** Matches elements the player interacts with inside the stage (HUD buttons, menus). */
const INTERACTIVE = "button, a, input, select, textarea, [role='button'], [data-arena-ui]";

const isField = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest("input, textarea, select, [contenteditable]");

export function createArenaControls(options: ArenaControlsOptions): ArenaControls {
  const { stage } = options;
  let layout = options.layout ?? loadControlLayout();
  let editing = false;
  let touchShown = options.touch ?? window.matchMedia("(pointer: coarse)").matches;
  const steer: ArenaSteer = { heading: null, action: false };
  const held = { touch: false, mouse: false, key: false };
  const keys = { up: false, down: false, left: false, right: false };

  // ---- The overlay: the joystick (shown while a thumb is down) and the button ----
  const overlay = document.createElement("div");
  overlay.dataset.arenaControls = "";
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    overflow: "hidden",
  });
  const base = document.createElement("div");
  const knob = document.createElement("div");
  Object.assign(base.style, {
    position: "absolute",
    width: `${String(JOYSTICK_RADIUS * 2)}px`,
    height: `${String(JOYSTICK_RADIUS * 2)}px`,
    marginLeft: `${String(-JOYSTICK_RADIUS)}px`,
    marginTop: `${String(-JOYSTICK_RADIUS)}px`,
    borderRadius: "50%",
    boxSizing: "border-box",
    border: "2px solid var(--border-strong)",
    background: "color-mix(in srgb, var(--surface) 35%, transparent)",
    display: "none",
  });
  Object.assign(knob.style, {
    position: "absolute",
    left: `${String(JOYSTICK_RADIUS - KNOB_SIZE / 2 - 2)}px`,
    top: `${String(JOYSTICK_RADIUS - KNOB_SIZE / 2 - 2)}px`,
    width: `${String(KNOB_SIZE)}px`,
    height: `${String(KNOB_SIZE)}px`,
    borderRadius: "50%",
    boxSizing: "border-box",
    background: "color-mix(in srgb, var(--text) 45%, transparent)",
  });
  base.append(knob);

  const button = document.createElement("button");
  button.type = "button";
  // Touch only: keyboard players hold Space, so the button stays out of the tab order.
  button.tabIndex = -1;
  button.setAttribute("aria-label", options.actionLabel);
  button.setAttribute("aria-pressed", "false");
  Object.assign(button.style, {
    position: "absolute",
    width: `${String(BUTTON_SIZE)}px`,
    height: `${String(BUTTON_SIZE)}px`,
    marginLeft: `${String(-BUTTON_SIZE / 2)}px`,
    marginTop: `${String(-BUTTON_SIZE / 2)}px`,
    borderRadius: "50%",
    boxSizing: "border-box",
    border: "2px solid var(--border-strong)",
    background: "color-mix(in srgb, var(--surface) 70%, transparent)",
    color: "var(--text)",
    display: "grid",
    placeItems: "center",
    pointerEvents: "auto",
    touchAction: "none",
    userSelect: "none",
    padding: "0",
  });
  if (options.actionIcon) button.append(options.actionIcon);
  overlay.append(base, button);

  if (getComputedStyle(stage).position === "static") stage.style.position = "relative";
  stage.style.touchAction = "none";
  stage.style.userSelect = "none";
  stage.style.setProperty("-webkit-user-select", "none");
  stage.style.setProperty("-webkit-touch-callout", "none");
  stage.append(overlay);

  const placeButton = () => {
    const at = buttonCenter(layout, stage.clientWidth, stage.clientHeight);
    button.style.left = `${String(at.x)}px`;
    button.style.top = `${String(at.y)}px`;
  };
  const showTouch = (shown: boolean) => {
    touchShown = shown;
    button.style.visibility = shown ? "visible" : "hidden";
    if (!shown) base.style.display = "none";
  };
  const styleButton = () => {
    button.setAttribute("aria-pressed", String(steer.action));
    button.style.background = steer.action
      ? "var(--brand)"
      : "color-mix(in srgb, var(--surface) 70%, transparent)";
    button.style.color = steer.action ? "var(--on-brand)" : "var(--text)";
    button.style.borderStyle = editing ? "dashed" : "solid";
    button.style.outline = editing ? "3px solid var(--focus)" : "";
  };

  // ---- The state ----
  const emit = () => {
    options.onChange({ heading: steer.heading, action: steer.action });
  };
  const setHeading = (heading: number | null) => {
    if (heading === null || editing) return;
    if (steer.heading !== null) {
      const turn = Math.abs(
        Math.atan2(Math.sin(heading - steer.heading), Math.cos(heading - steer.heading)),
      );
      if (turn < HEADING_EPSILON) return;
    }
    steer.heading = heading;
    emit();
  };
  const updateAction = () => {
    const action = !editing && (held.touch || held.mouse || held.key);
    if (action === steer.action) return;
    steer.action = action;
    styleButton();
    emit();
  };

  // ---- Touch: the joystick ----
  let thumb: { id: number; x: number; y: number } | null = null;
  const local = (e: PointerEvent) => {
    const box = stage.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  const moveBase = (x: number, y: number) => {
    base.style.left = `${String(x)}px`;
    base.style.top = `${String(y)}px`;
  };
  const moveKnob = (x: number, y: number) => {
    knob.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  };

  // ---- Moving the button (editing) ----
  let dragging: number | null = null;

  const onStageDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      showTouch(false);
      if (e.button !== 0 || (e.target instanceof Element && e.target.closest(INTERACTIVE))) return;
      stage.setPointerCapture(e.pointerId); // let go outside the stage still lets go
      held.mouse = true;
      updateAction();
      return;
    }
    if (!touchShown) {
      showTouch(true);
      placeButton();
    }
    if (editing || thumb || (e.target instanceof Element && e.target.closest(INTERACTIVE))) return;
    const at = local(e);
    thumb = { id: e.pointerId, x: at.x, y: at.y };
    stage.setPointerCapture(e.pointerId);
    moveBase(at.x, at.y);
    moveKnob(0, 0);
    base.style.display = "block";
  };
  const onStageMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      if (touchShown) showTouch(false);
      const at = local(e);
      const from = options.origin?.() ?? { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
      const dx = at.x - from.x;
      const dy = at.y - from.y;
      if (Math.hypot(dx, dy) >= MOUSE_DEAD_ZONE) setHeading(Math.atan2(dy, dx));
      return;
    }
    if (thumb?.id !== e.pointerId) return;
    const at = local(e);
    const pull = joystick(at.x - thumb.x, at.y - thumb.y);
    // A thumb past the edge drags the base along, so turning back is quick.
    thumb.x += pull.followX;
    thumb.y += pull.followY;
    moveBase(thumb.x, thumb.y);
    moveKnob(pull.knobX, pull.knobY);
    setHeading(pull.heading);
  };
  const onStageUp = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      held.mouse = false;
      updateAction();
      return;
    }
    if (thumb?.id !== e.pointerId) return;
    thumb = null;
    base.style.display = "none";
  };
  const onContextMenu = (e: Event) => {
    e.preventDefault(); // a long press on a phone
  };

  const onButtonDown = (e: PointerEvent) => {
    e.stopPropagation(); // not a joystick
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    if (editing) {
      dragging = e.pointerId;
      return;
    }
    held.touch = true;
    updateAction();
  };
  const onButtonMove = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return;
    const at = local(e);
    layout = {
      ...layout,
      button: buttonShare(layout, at.x, at.y, stage.clientWidth, stage.clientHeight),
    };
    placeButton();
  };
  const onButtonUp = (e: PointerEvent) => {
    e.stopPropagation();
    if (dragging === e.pointerId) {
      dragging = null;
      saveControlLayout(layout);
      options.onLayout?.(layout);
      return;
    }
    held.touch = false;
    updateAction();
  };

  // ---- Keyboard ----
  const onKeyDown = (e: KeyboardEvent) => {
    if (isField(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === "Space") {
      // A focused HUD button takes Space as a press (Play again); elsewhere it boosts.
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      e.preventDefault(); // don't scroll the page
      held.key = true;
      updateAction();
      return;
    }
    const key = STEER_KEYS[e.code];
    if (!key) return;
    e.preventDefault();
    keys[key] = true;
    setHeading(keyHeading(keys));
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      held.key = false;
      updateAction();
      return;
    }
    const key = STEER_KEYS[e.code];
    if (!key) return;
    // Letting go of one of two keys turns to the one still held; letting go of the last keeps going.
    keys[key] = false;
    setHeading(keyHeading(keys));
  };

  const release = () => {
    held.touch = held.mouse = held.key = false;
    keys.up = keys.down = keys.left = keys.right = false;
    thumb = null;
    dragging = null;
    base.style.display = "none";
    updateAction();
  };

  const resize = new ResizeObserver(placeButton);
  resize.observe(stage);
  stage.addEventListener("pointerdown", onStageDown);
  stage.addEventListener("pointermove", onStageMove);
  stage.addEventListener("pointerup", onStageUp);
  stage.addEventListener("pointercancel", onStageUp);
  stage.addEventListener("contextmenu", onContextMenu);
  button.addEventListener("pointerdown", onButtonDown);
  button.addEventListener("pointermove", onButtonMove);
  button.addEventListener("pointerup", onButtonUp);
  button.addEventListener("pointercancel", onButtonUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", release);
  placeButton();
  showTouch(touchShown);
  styleButton();

  return {
    steer,
    get layout() {
      return layout;
    },
    setLayout(next) {
      layout = next;
      saveControlLayout(layout);
      placeButton();
    },
    setEditing(next) {
      editing = next;
      if (next) {
        release();
        showTouch(true);
      }
      styleButton();
    },
    release,
    dispose() {
      resize.disconnect();
      stage.removeEventListener("pointerdown", onStageDown);
      stage.removeEventListener("pointermove", onStageMove);
      stage.removeEventListener("pointerup", onStageUp);
      stage.removeEventListener("pointercancel", onStageUp);
      stage.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      overlay.remove();
    },
  };
}
