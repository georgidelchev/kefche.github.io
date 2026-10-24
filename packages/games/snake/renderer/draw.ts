// The Snake board's picture, shared by the game and the race's mini boards:
// the checkered field, the food and the snake, in logical units (one per cell).
import { COLS, colOf, ROWS, rowOf, type State } from "../engine";

export interface Colors {
  light: string;
  dark: string;
  food: string;
  body: string;
  head: string;
  dead: string;
}

/** The board's colors, from the site's tokens as `element` sees them. */
export function readColors(element: Element): Colors {
  const css = getComputedStyle(element);
  const color = (name: string) => css.getPropertyValue(name).trim();
  return {
    light: color("--surface"),
    dark: color("--surface-2"),
    food: color("--brand"),
    body: color("--accent"),
    head: color("--accent-strong"),
    dead: color("--danger"),
  };
}

/** The one-cell move from `from` to `to` as [x, y], across an edge with wrap-around. */
function delta(from: number, to: number): [number, number] {
  let dx = colOf(to) - colOf(from);
  let dy = rowOf(to) - rowOf(from);
  if (dx > 1) dx -= COLS;
  else if (dx < -1) dx += COLS;
  if (dy > 1) dy -= ROWS;
  else if (dy < -1) dy += ROWS;
  return [dx, dy];
}

/**
 * Draws `state`. `previous` is the state before its last step and `alpha`
 * (0–1) how far the snake is between the two, so it glides every frame.
 */
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  state: State,
  previous: State,
  alpha: number,
  colors: Colors,
) {
  ctx.fillStyle = colors.light;
  ctx.fillRect(0, 0, COLS, ROWS);
  ctx.fillStyle = colors.dark;
  for (let r = 0; r < ROWS; r++) {
    for (let c = (r + 1) % 2; c < COLS; c += 2) ctx.fillRect(c, r, 1, 1);
  }

  // New food grows in during the step that ate the old one; the head
  // covers the old one as it arrives.
  const ate = state.eaten !== previous.eaten;
  const foods: [number, number][] = [];
  if (ate && previous.food >= 0) foods.push([previous.food, 0.36]);
  if (state.food >= 0) foods.push([state.food, ate ? 0.36 * Math.min(1, alpha * 1.5) : 0.36]);
  ctx.fillStyle = colors.food;
  for (const [cell, radius] of foods) {
    ctx.beginPath();
    ctx.arc(colOf(cell) + 0.5, rowOf(cell) + 0.5, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // The body as one rounded line through the cell centres, head first.
  // The head slides from the neck toward its new cell and the tail
  // slides out of its old cell. Points are unwrapped so neighbours are
  // one cell apart; with wrap-around the line is also drawn shifted by a
  // board width or height, so it shows on both sides of an edge.
  const cells = state.snake;
  const head = cells[0] ?? 0;
  const neck = cells[1] ?? head;
  const oldTail = previous.snake.at(-1) ?? cells.at(-1) ?? head;
  const [hx, hy] = delta(neck, head);
  const points: [number, number][] = [
    [colOf(neck) + 0.5 + hx * alpha, rowOf(neck) + 0.5 + hy * alpha],
    [colOf(neck) + 0.5, rowOf(neck) + 0.5],
  ];
  for (let i = 2; i < cells.length; i++) {
    const [px, py] = points[i - 1] ?? [0, 0];
    const [dx, dy] = delta(cells[i - 1] ?? 0, cells[i] ?? 0);
    points.push([px + dx, py + dy]);
  }
  const [lx, ly] = points.at(-1) ?? [0, 0];
  const [tx, ty] = delta(cells.at(-1) ?? 0, oldTail);
  points.push([lx + tx * (1 - alpha), ly + ty * (1 - alpha)]);

  const shifts = state.config.walls ? [0] : [-1, 0, 1];
  const [headX, headY] = points[0] ?? [0, 0];
  for (const sx of shifts) {
    for (const sy of shifts) {
      const ox = sx * COLS;
      const oy = sy * ROWS;
      ctx.strokeStyle = colors.body;
      ctx.lineWidth = 0.72;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      points.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x + ox, y + oy);
        else ctx.lineTo(x + ox, y + oy);
      });
      ctx.stroke();
      ctx.fillStyle = state.over && !state.won ? colors.dead : colors.head;
      ctx.beginPath();
      ctx.arc(headX + ox, headY + oy, 0.46, 0, Math.PI * 2);
      ctx.fill();
      // Eyes look the way the head is moving.
      ctx.fillStyle = colors.light;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(
          headX + ox + hx * 0.16 + hy * side * 0.2,
          headY + oy + hy * 0.16 + hx * side * 0.2,
          0.1,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
}
