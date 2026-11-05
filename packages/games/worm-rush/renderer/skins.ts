// Worm skins: a body colour, an accent and a pattern along the body, so two
// worms of a similar colour still look different (SPEC §12.6). Which ones are
// free and how the rest unlock comes with the skin picker (Phase 9 step 10).

export type SkinPattern = "solid" | "stripes" | "rings" | "fade";

export interface Skin {
  color: number;
  accent: number;
  pattern: SkinPattern;
}

const FIRST: Skin = { color: 0xff6b4a, accent: 0xffd2c4, pattern: "solid" };

export const SKINS: readonly Skin[] = [
  FIRST,
  { color: 0x2ec4b6, accent: 0x0b6e66, pattern: "stripes" },
  { color: 0xffbe3d, accent: 0x8a5a00, pattern: "rings" },
  { color: 0x8f6bff, accent: 0xe0d6ff, pattern: "fade" },
  { color: 0x3a9bff, accent: 0xffffff, pattern: "stripes" },
  { color: 0x7bd65a, accent: 0x2f6b1c, pattern: "rings" },
  { color: 0xff5c9a, accent: 0x5c1030, pattern: "solid" },
  { color: 0x4fe0ff, accent: 0x1b4bd1, pattern: "fade" },
  { color: 0xc56bff, accent: 0xffe066, pattern: "stripes" },
  { color: 0xffe066, accent: 0x2b2b2b, pattern: "rings" },
  { color: 0x56d6a0, accent: 0xff6b4a, pattern: "fade" },
  { color: 0xff9f43, accent: 0x1d1d3b, pattern: "stripes" },
];

export const skinOf = (look: number): Skin => SKINS[look % SKINS.length] ?? FIRST;

const mix = (a: number, b: number, t: number): number => {
  const channel = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
};

/** The tint of body segment `k` of `count` (0 is the head). */
export function segmentTint(skin: Skin, k: number, count: number): number {
  switch (skin.pattern) {
    case "solid":
      return skin.color;
    case "stripes":
      return k % 6 < 3 ? skin.color : skin.accent;
    case "rings":
      return k % 5 === 4 ? skin.accent : skin.color;
    case "fade":
      return mix(skin.color, skin.accent, count > 1 ? k / (count - 1) : 0);
  }
}
