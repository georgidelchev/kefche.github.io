// Conquest's map, kefche's own: thirty territories in six regions of five,
// each region a hub with four around it, joined to its neighbours by land
// and by two sea lanes. Territory t is region Math.floor(t / 5), place t % 5:
// 0 the hub, then north, east, south and west of it.

export const REGIONS = 6;
export const PER_REGION = 5;
export const TERRITORIES = REGIONS * PER_REGION;

/** Armies a whole region adds to its owner's reinforcements. */
export const BONUS: readonly number[] = [3, 3, 4, 2, 3, 3];

const t = (region: number, place: number) => region * PER_REGION + place;
const HUB = 0;
const N = 1;
const E = 2;
const S = 3;
const W = 4;

/** Regions: 0 top left, 1 top middle, 2 top right, 3 bottom left, 4 bottom middle, 5 bottom right. */
const LAND: readonly (readonly [number, number])[] = [
  [t(0, E), t(1, W)],
  [t(1, E), t(2, W)],
  [t(0, S), t(3, N)],
  [t(1, S), t(4, N)],
  [t(2, S), t(5, N)],
  [t(3, E), t(4, W)],
  [t(4, E), t(5, W)],
];
/** Sea lanes, drawn dashed: along the top and down the right. */
export const SEA: readonly (readonly [number, number])[] = [
  [t(0, N), t(2, N)],
  [t(2, E), t(5, E)],
];

function inside(region: number): [number, number][] {
  const hub = t(region, HUB);
  const ring = [N, E, S, W].map((p) => t(region, p));
  return [
    ...ring.map((r): [number, number] => [hub, r]),
    ...ring.map((r, i): [number, number] => [r, ring[(i + 1) % 4] ?? r]),
  ];
}

/** Every border, once. */
export const EDGES: readonly (readonly [number, number])[] = [
  ...Array.from({ length: REGIONS }, (_, r) => inside(r)).flat(),
  ...LAND,
  ...SEA,
];

export const NEIGHBOURS: readonly (readonly number[])[] = Array.from(
  { length: TERRITORIES },
  (_, i) => EDGES.flatMap(([a, b]) => (a === i ? [b] : b === i ? [a] : [])).sort((x, y) => x - y),
);

export const regionOf = (territory: number) => Math.floor(territory / PER_REGION);
export const adjacent = (a: number, b: number) => NEIGHBOURS[a]?.includes(b) ?? false;

/** Where each territory is drawn, in a 400 × 320 box. */
const CENTRES: readonly (readonly [number, number])[] = [
  [72, 76],
  [200, 76],
  [328, 76],
  [72, 240],
  [200, 240],
  [328, 240],
];
const OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -42],
  [42, 0],
  [0, 42],
  [-42, 0],
];
export const POSITION: readonly (readonly [number, number])[] = Array.from(
  { length: TERRITORIES },
  (_, i) => {
    const [cx, cy] = CENTRES[regionOf(i)] ?? [0, 0];
    const [dx, dy] = OFFSETS[i % PER_REGION] ?? [0, 0];
    return [cx + dx, cy + dy];
  },
);
