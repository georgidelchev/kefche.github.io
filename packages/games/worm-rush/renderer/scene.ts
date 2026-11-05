// The arena drawn with PixiJS (WebGL, ADR to come in step 12): a grid that
// scrolls with the camera, the arena's edge, glowing orbs, and worms as rows
// of shaded discs, which batch into a few draw calls however long they grow.
// Sprites are pooled and reused frame to frame. Names are page text laid over
// the canvas: the browser shapes every script, and a new name costs no
// texture upload mid-game. The arena keeps its own night colours in both
// site themes.

import "pixi.js/unsafe-eval"; // no eval(), for the Content-Security-Policy (Phase 17)
import "pixi.js/graphics";
import "pixi.js/sprite-tiling";
import { Application, Container, Graphics, Sprite, Texture, TilingSprite } from "pixi.js";

import { MAX_DPR } from "@kefche/game-sdk/browser";

import { ARENA_RADIUS, ORB_HUES, POSITION_SCALE, orbRadius } from "../engine";
import { cameraZoom, type Frame } from "./frame";
import { segmentTint, skinOf } from "./skins";

export const ARENA_BACKGROUND = 0x0b1020;
/** The orbs' colours, by the engine's hue (0 to ORB_HUES − 1). */
export const ORB_COLORS = [0xffd166, 0x06d6a0, 0x4cc9f0, 0xef476f, 0xc77dff, 0xf8961e] as const;
const EDGE_COLOR = 0xff4d6d;
const GRID_SIZE = 160;
/** How quickly the zoom follows the worm's growth (per second). */
const ZOOM_RATE = 2;

export interface ArenaScene {
  readonly canvas: HTMLCanvasElement;
  /** Draws `frame`; `now` is performance.now(). Does nothing once disposed. */
  draw(frame: Frame, now: number): void;
  dispose(): void;
}

function canvasTexture(size: number, paint: (g: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) paint(g, size);
  return Texture.from(canvas);
}

const textures = () => ({
  // A disc lit from the top left, tinted per segment.
  segment: canvasTexture(128, (g, s) => {
    const grad = g.createRadialGradient(s * 0.4, s * 0.38, s * 0.05, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.75, "#d9d9d9");
    grad.addColorStop(1, "#8c8c8c");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    g.fill();
  }),
  glow: canvasTexture(64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.75)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }),
  dot: canvasTexture(32, (g, s) => {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    g.fill();
  }),
  grid: canvasTexture(GRID_SIZE, (g, s) => {
    g.fillStyle = "#0b1020";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(120, 140, 200, 0.12)";
    g.lineWidth = 2;
    g.strokeRect(0, 0, s, s);
    g.fillStyle = "rgba(150, 170, 230, 0.22)";
    g.beginPath();
    g.arc(s / 2, s / 2, 3, 0, Math.PI * 2);
    g.fill();
  }),
});

/** Sprites handed out in order each frame (so their order is the drawing order). */
class SpritePool {
  private readonly items: Sprite[] = [];
  private used = 0;

  constructor(private readonly layer: Container) {}

  begin(): void {
    this.used = 0;
  }

  next(texture: Texture): Sprite {
    let sprite = this.items[this.used];
    if (!sprite) {
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      this.layer.addChild(sprite);
      this.items.push(sprite);
    }
    sprite.texture = texture;
    sprite.visible = true;
    sprite.alpha = 1;
    this.used++;
    return sprite;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) {
      const sprite = this.items[i];
      if (sprite) sprite.visible = false;
    }
  }
}

export async function createArenaScene(parent: HTMLElement): Promise<ArenaScene> {
  const app = new Application();
  await app.init({
    width: Math.max(1, parent.clientWidth),
    height: Math.max(1, parent.clientHeight),
    resolution: Math.min(window.devicePixelRatio || 1, MAX_DPR),
    autoDensity: true,
    background: ARENA_BACKGROUND,
    preference: "webgl",
    antialias: false,
    autoStart: false,
    skipExtensionImports: true,
  });
  const canvas = app.canvas;
  canvas.style.display = "block";
  // Names: decorative (the HUD's board names worms for screen readers).
  const names = document.createElement("div");
  names.setAttribute("aria-hidden", "true");
  Object.assign(names.style, {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
    color: "#ffffff",
    font: "600 13px/1 system-ui, sans-serif",
    textShadow: "0 0 3px #000, 0 1px 2px #000",
    whiteSpace: "nowrap",
  });
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  parent.append(canvas, names);
  const tex = textures();
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");

  const grid = new TilingSprite({
    texture: tex.grid,
    width: app.screen.width,
    height: app.screen.height,
  });
  const world = new Container();
  // Past the edge: dimmed, then the edge itself.
  const outside = new Graphics()
    .circle(0, 0, ARENA_RADIUS + 3000)
    .stroke({ width: 6000, color: 0x000000, alpha: 0.6 })
    .circle(0, 0, ARENA_RADIUS)
    .stroke({ width: 14, color: EDGE_COLOR, alpha: 0.85 });
  const orbLayer = new Container();
  const wormLayer = new Container();
  world.addChild(outside, orbLayer, wormLayer);
  app.stage.addChild(grid, world);
  const orbs = new SpritePool(orbLayer);
  const worms = new SpritePool(wormLayer);
  const orbBorn = new Map<number, number>();
  const labels = new Map<number, HTMLElement>();

  let zoom = 0;
  let lastDraw = 0;
  let disposed = false;

  // One frame with every texture and shader now, while the game is loading,
  // instead of a stall on the first frame of play (~280 ms on a slow phone).
  for (const texture of [tex.segment, tex.glow, tex.dot]) orbs.next(texture).position.set(0, 0);
  app.render();
  orbs.begin();
  orbs.end();

  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    app.renderer.resize(width, height);
    grid.width = width;
    grid.height = height;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(parent);

  const label = (id: number, name: string) => {
    let element = labels.get(id);
    if (!element) {
      element = document.createElement("span");
      element.style.position = "absolute";
      element.style.left = "0";
      element.style.top = "0";
      names.append(element);
      labels.set(id, element);
    }
    if (element.textContent !== name) element.textContent = name;
    return element;
  };

  return {
    canvas,
    draw(frame, now) {
      if (disposed) return;
      const width = app.screen.width;
      const height = app.screen.height;
      const dt = lastDraw === 0 ? 1 : Math.min(1, (now - lastDraw) / 1000);
      lastDraw = now;
      const target = cameraZoom(width, height, frame.mass);
      zoom = zoom === 0 ? target : zoom + (target - zoom) * Math.min(1, dt * ZOOM_RATE);
      const ox = width / 2 - frame.x * zoom;
      const oy = height / 2 - frame.y * zoom;
      world.scale.set(zoom);
      world.position.set(ox, oy);
      grid.tileScale.set(zoom);
      grid.tilePosition.set(ox, oy);
      const motion = !still.matches;
      // What's on screen, in world units, with a margin.
      const halfW = width / 2 / zoom + 40;
      const halfH = height / 2 / zoom + 40;
      const onScreen = (x: number, y: number) =>
        Math.abs(x - frame.x) < halfW && Math.abs(y - frame.y) < halfH;

      orbs.begin();
      const seen = new Set<number>();
      for (const orb of frame.orbs) {
        seen.add(orb.id);
        const born = orbBorn.get(orb.id) ?? now;
        if (!orbBorn.has(orb.id)) orbBorn.set(orb.id, now);
        const x = orb.x / POSITION_SCALE;
        const y = orb.y / POSITION_SCALE;
        if (!onScreen(x, y)) continue;
        const grow = motion ? Math.min(1, (now - born) / 250) : 1;
        const pulse = motion ? 1 + 0.12 * Math.sin(now / 280 + orb.id) : 1;
        const sprite = orbs.next(tex.glow);
        sprite.position.set(x, y);
        sprite.scale.set(((orbRadius(orb.value) * 3.2) / 64) * grow * pulse);
        sprite.tint = ORB_COLORS[orb.hue % ORB_HUES] ?? 0xffffff;
      }
      orbs.end();
      for (const id of orbBorn.keys()) if (!seen.has(id)) orbBorn.delete(id);

      worms.begin();
      const named = new Set<number>();
      for (const worm of frame.worms) {
        const skin = skinOf(worm.look);
        const body = worm.body;
        const count = body.length / 2;
        const scale = (worm.radius * 2) / 128;
        if (worm.boosting) {
          for (let k = count - 1; k >= 0; k -= 2) {
            const x = body[k * 2] ?? 0;
            const y = body[k * 2 + 1] ?? 0;
            if (!onScreen(x, y)) continue;
            const glow = worms.next(tex.glow);
            glow.position.set(x, y);
            glow.scale.set((worm.radius * 3.4) / 64);
            glow.tint = skin.color;
            glow.alpha = motion ? 0.3 + 0.1 * Math.sin(now / 90 + k) : 0.35;
          }
        }
        // Tail first, so the head is on top.
        for (let k = count - 1; k >= 0; k--) {
          const x = body[k * 2] ?? 0;
          const y = body[k * 2 + 1] ?? 0;
          if (!onScreen(x, y)) continue;
          const segment = worms.next(tex.segment);
          segment.position.set(x, y);
          segment.scale.set(k === 0 ? scale * 1.12 : scale);
          segment.tint = segmentTint(skin, k, count);
        }
        const hx = body[0] ?? 0;
        const hy = body[1] ?? 0;
        if (!onScreen(hx, hy)) continue;
        // Eyes, looking where the worm heads.
        const fx = Math.cos(worm.heading);
        const fy = Math.sin(worm.heading);
        for (const side of [-1, 1]) {
          const ex = hx + fx * worm.radius * 0.35 - fy * side * worm.radius * 0.48;
          const ey = hy + fy * worm.radius * 0.35 + fx * side * worm.radius * 0.48;
          const white = worms.next(tex.dot);
          white.position.set(ex, ey);
          white.scale.set((worm.radius * 0.62) / 32);
          white.tint = 0xffffff;
          const pupil = worms.next(tex.dot);
          pupil.position.set(ex + fx * worm.radius * 0.12, ey + fy * worm.radius * 0.12);
          pupil.scale.set((worm.radius * 0.32) / 32);
          pupil.tint = 0x111122;
        }
        if (!worm.self && worm.name !== "") {
          const x = Math.round(hx * zoom + ox);
          const y = Math.round((hy - worm.radius) * zoom + oy - 6);
          label(worm.id, worm.name).style.transform =
            `translate(${String(x)}px, ${String(y)}px) translate(-50%, -100%)`;
          named.add(worm.id);
        }
      }
      worms.end();
      for (const [id, element] of labels) {
        if (named.has(id)) continue;
        element.remove();
        labels.delete(id);
      }
      app.render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      names.remove();
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    },
  };
}
