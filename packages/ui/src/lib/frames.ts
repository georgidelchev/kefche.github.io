// Avatar frames (SPEC §12.6, Phase 7 Q4): cosmetic rewards for play
// streaks and gold achievements. Each is a ring drawn around the avatar in
// the theme-independent tier colours (or the brand's), with a gap in the
// surface colour, so it reads the same in both themes. The server decides
// which a player has unlocked; these are only how they look.

export const AVATAR_FRAMES = ["streak-3", "streak-7", "streak-30", "streak-100", "gold"] as const;
export type AvatarFrame = (typeof AVATAR_FRAMES)[number];

export const isAvatarFrame = (value: unknown): value is AvatarFrame =>
  (AVATAR_FRAMES as readonly unknown[]).includes(value);

/** The classes that draw each frame (on a rounded avatar). */
export const FRAME_CLASSES: Record<AvatarFrame, string> = {
  "streak-3": "ring-3 ring-tier-bronze ring-offset-2 ring-offset-surface",
  "streak-7": "ring-3 ring-tier-silver ring-offset-2 ring-offset-surface",
  "streak-30": "ring-3 ring-tier-gold ring-offset-2 ring-offset-surface",
  "streak-100":
    "ring-3 ring-brand ring-offset-2 ring-offset-surface outline-2 outline-offset-[7px] outline-tier-gold",
  gold: "ring-4 ring-tier-gold ring-offset-2 ring-offset-surface outline-2 outline-offset-[8px] outline-tier-gold",
};

/** The same frames for small avatars (the header's): a thinner ring, no outer line. */
export const SMALL_FRAME_CLASSES: Record<AvatarFrame, string> = {
  "streak-3": "ring-2 ring-tier-bronze ring-offset-1 ring-offset-surface",
  "streak-7": "ring-2 ring-tier-silver ring-offset-1 ring-offset-surface",
  "streak-30": "ring-2 ring-tier-gold ring-offset-1 ring-offset-surface",
  "streak-100": "ring-2 ring-brand ring-offset-1 ring-offset-surface",
  gold: "ring-3 ring-tier-gold ring-offset-1 ring-offset-surface",
};
