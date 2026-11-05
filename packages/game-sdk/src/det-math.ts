// Trigonometry from + − × ÷ only. Math.sin, Math.cos and Math.atan2 may
// differ in their last bits between JavaScript engines (V8, JavaScriptCore,
// SpiderMonkey), and a real-time world stepping for thousands of ticks turns
// any difference into a different game. With these, the same world comes
// out of the browser, the arena server and Deno alike (replays, ADR-0028).
// Accurate to about 1e-9, far below anything a game can see.

const PI = 3.141592653589793;
const TAU = 6.283185307179586;
const HALF_PI = 1.5707963267948966;
const QUARTER_PI = 0.7853981633974483;
const TAN_EIGHTH_PI = 0.41421356237309503;

/** `x` brought into [−π, π]. */
export function wrapAngle(x: number): number {
  return x - Math.round(x / TAU) * TAU;
}

export function detSin(x: number): number {
  let r = wrapAngle(x);
  // sin(π − r) = sin(r): fold onto [−π/2, π/2], where the series converges fast.
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  const r2 = r * r;
  // Taylor series to r^15: the error stays under 1e-9 on [−π/2, π/2].
  return (
    r *
    (1 +
      r2 *
        (-1 / 6 +
          r2 *
            (1 / 120 +
              r2 *
                (-1 / 5040 +
                  r2 *
                    (1 / 362880 +
                      r2 * (-1 / 39916800 + r2 * (1 / 6227020800 + r2 * (-1 / 1307674368000))))))))
  );
}

export function detCos(x: number): number {
  return detSin(x + HALF_PI);
}

/** atan(t) for |t| ≤ tan(π/8), by its series to t^23. */
function atanSmall(t: number): number {
  const t2 = t * t;
  let sum = 0;
  for (let n = 23; n >= 1; n -= 2) sum = 1 / n - t2 * sum;
  return t * sum;
}

/** atan(a) for a in [0, 1]. */
function atanUnit(a: number): number {
  return a > TAN_EIGHTH_PI ? QUARTER_PI + atanSmall((a - 1) / (a + 1)) : atanSmall(a);
}

/** The angle of (x, y) in (−π, π], like Math.atan2 (0 for the origin). */
export function detAtan2(y: number, x: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax === 0 && ay === 0) return 0;
  const a = ax >= ay ? atanUnit(ay / ax) : HALF_PI - atanUnit(ax / ay);
  const angle = x >= 0 ? a : PI - a;
  return y < 0 ? -angle : angle;
}
