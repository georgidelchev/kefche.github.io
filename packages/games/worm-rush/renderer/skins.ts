// Worm skins: a body colour, an accent and a pattern along the body, so two
// worms of a similar colour still look different (SPEC §12.6). Skins with the
// same pattern differ in colour for every kind of colour vision, and every
// colour shows on the arena's night background (checked in Phase 9 step 10).
// Which ones are free and how the rest unlock is engine/looks.ts.

export type SkinPattern = "solid" | "stripes" | "rings" | "fade" | "beads";

export type SkinName =
  | "ember"
  | "lagoon"
  | "honey"
  | "dusk"
  | "sky"
  | "moss"
  | "berry"
  | "glacier"
  | "orchid"
  | "bee"
  | "sunset"
  | "comet";

export interface Skin {
  name: SkinName;
  color: number;
  accent: number;
  pattern: SkinPattern;
}

const FIRST: Skin = { name: "ember", color: 0xff6b4a, accent: 0xffd2c4, pattern: "solid" };

/** By look (engine/looks.ts). */
export const SKINS: readonly Skin[] = [
  FIRST,
  { name: "lagoon", color: 0x2ec4b6, accent: 0x0b6e66, pattern: "stripes" },
  { name: "honey", color: 0xffbe3d, accent: 0x8a5a00, pattern: "rings" },
  { name: "dusk", color: 0x8f6bff, accent: 0xe0d6ff, pattern: "fade" },
  { name: "sky", color: 0x3a9bff, accent: 0xffffff, pattern: "stripes" },
  { name: "moss", color: 0xb4f08a, accent: 0x4f9f38, pattern: "beads" },
  { name: "berry", color: 0xff5c9a, accent: 0xffd6e7, pattern: "beads" },
  { name: "glacier", color: 0x4fe0ff, accent: 0x1b4bd1, pattern: "fade" },
  { name: "orchid", color: 0xc56bff, accent: 0xffe066, pattern: "rings" },
  { name: "bee", color: 0xffe066, accent: 0x4d4d4d, pattern: "stripes" },
  { name: "sunset", color: 0xffd166, accent: 0xff6f91, pattern: "fade" },
  { name: "comet", color: 0xff9f43, accent: 0x3f51e0, pattern: "beads" },
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
    case "beads":
      return k % 2 === 0 ? skin.color : skin.accent;
  }
}
