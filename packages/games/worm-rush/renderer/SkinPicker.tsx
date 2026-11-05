// The skin picker on the setup screen: every skin drawn as a little worm on
// the arena's night colour, the locked ones dimmed with what unlocks them.
// The name and how to unlock the focused or chosen skin show under the grid;
// screen readers get them from each button.
import { useId, useState } from "react";

import type { AchievementTier, PlayerProgress } from "@kefche/game-sdk";
import type { GameContext } from "@kefche/game-sdk/browser";

import { LOOK_UNLOCKS, lookUnlocked, type LookUnlock } from "../engine";
import { manifest } from "../manifest";
import { SKINS, segmentTint, type Skin, type SkinName } from "./skins";

type T = GameContext["t"];

const NAME_KEYS = {
  ember: "skinEmber",
  lagoon: "skinLagoon",
  honey: "skinHoney",
  dusk: "skinDusk",
  sky: "skinSky",
  moss: "skinMoss",
  berry: "skinBerry",
  glacier: "skinGlacier",
  orchid: "skinOrchid",
  bee: "skinBee",
  sunset: "skinSunset",
  comet: "skinComet",
} as const satisfies Record<SkinName, string>;

const TIER_INDEX = { bronze: 0, silver: 1, gold: 2 } as const satisfies Record<
  AchievementTier,
  number
>;

/** What unlocks a locked skin, in words; empty for a free one. */
function unlockText(t: T, number: Intl.NumberFormat, unlock: LookUnlock): string {
  switch (unlock.kind) {
    case "free":
      return "";
    case "level":
      return t("unlockLevel", { level: number.format(unlock.level) });
    case "achievement": {
      const def = manifest.achievements.find((a) => a.id === unlock.achievement);
      const goal = number.format(def?.tiers[TIER_INDEX[unlock.tier]] ?? 0);
      return unlock.achievement === "long-worm"
        ? t("unlockLength", { length: goal })
        : t("unlockLives", { count: goal });
    }
  }
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const SEGMENTS = 7;

/** A short worm in the skin, heading right (mirrored in RTL, so it heads the way text reads). */
function SkinArt({ skin }: { skin: Skin }) {
  const parts = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const k = SEGMENTS - 1 - i; // the tail first, so the head is on top
    parts.push(
      <circle
        key={k}
        cx={9 + i * 7.5}
        cy={15 + Math.sin(i * 0.95) * 3.5}
        r={k === 0 ? 7.5 : 6.5}
        fill={hex(segmentTint(skin, k, SEGMENTS))}
      />,
    );
  }
  const hx = 9 + (SEGMENTS - 1) * 7.5;
  const hy = 15 + Math.sin((SEGMENTS - 1) * 0.95) * 3.5;
  return (
    <svg className="gwr-skin-art" viewBox="0 0 64 30" aria-hidden="true">
      {parts}
      <circle cx={hx + 2.5} cy={hy - 2.6} r={2.3} fill="#fff" />
      <circle cx={hx + 2.5} cy={hy + 2.6} r={2.3} fill="#fff" />
      <circle cx={hx + 3.2} cy={hy - 2.6} r={1.1} fill="#111122" />
      <circle cx={hx + 3.2} cy={hy + 2.6} r={1.1} fill="#111122" />
    </svg>
  );
}

const LOCK =
  "M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z";

export function SkinPicker({
  t,
  locale,
  look,
  progress,
  onLook,
}: {
  t: T;
  locale: string;
  look: number;
  progress: PlayerProgress;
  onLook: (look: number) => void;
}) {
  const id = useId();
  const [shown, setShown] = useState<number | null>(null);
  const number = new Intl.NumberFormat(locale);
  const caption = shown ?? look;
  const captionSkin = SKINS[caption];
  const captionUnlock = LOOK_UNLOCKS[caption];
  const captionLocked = !lookUnlocked(caption, progress);
  return (
    <fieldset className="gwr-skins">
      <legend>{t("skinTitle")}</legend>
      <div className="gwr-skin-grid">
        {SKINS.map((skin, i) => {
          const unlock = LOOK_UNLOCKS[i];
          const locked = !lookUnlocked(i, progress);
          return (
            <button
              key={skin.name}
              type="button"
              className="gwr-skin"
              aria-label={t(NAME_KEYS[skin.name])}
              aria-pressed={i === look}
              aria-disabled={locked || undefined}
              aria-describedby={locked ? `${id}-${String(i)}` : undefined}
              onClick={() => {
                if (!locked) onLook(i);
              }}
              onFocus={() => {
                setShown(i);
              }}
              onBlur={() => {
                setShown(null);
              }}
              onPointerEnter={() => {
                setShown(i);
              }}
              onPointerLeave={() => {
                setShown(null);
              }}
            >
              <SkinArt skin={skin} />
              {locked && (
                <svg className="gwr-skin-lock" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={LOCK} fill="currentColor" />
                </svg>
              )}
              {locked && unlock && (
                <span id={`${id}-${String(i)}`} className="gwr-sr">
                  {unlockText(t, number, unlock)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="gwr-skin-caption" aria-hidden="true">
        <strong>{captionSkin ? t(NAME_KEYS[captionSkin.name]) : ""}</strong>
        {captionLocked && captionUnlock && <span> · {unlockText(t, number, captionUnlock)}</span>}
      </p>
    </fieldset>
  );
}
