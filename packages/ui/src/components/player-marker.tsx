import { cn } from "../lib/cn";

import type * as React from "react";

// Player identity = color + unique shape (SPEC §2, §6.2), so players stay
// distinguishable without color perception. Order matches tokens.css.

export type PlayerSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const SHAPES: Record<PlayerSlot, React.ReactNode> = {
  1: <circle cx="12" cy="12" r="5.5" />,
  2: <rect x="6.5" y="6.5" width="11" height="11" rx="1" />,
  3: <path d="M12 5.5 18.5 17.5h-13z" />,
  4: <path d="M12 4.5 19.5 12 12 19.5 4.5 12z" />,
  5: <path d="m12 4.5 2.2 4.6 5 .7-3.6 3.5.9 5L12 16l-4.5 2.3.9-5-3.6-3.5 5-.7z" />,
  6: <path d="M12 4.5 18.5 8.25v7.5L12 19.5l-6.5-3.75v-7.5z" />,
  7: <path d="M10 5.5h4v4.5h4.5v4H14v4.5h-4V14H5.5v-4H10z" />,
  8: <path d="M12 19s-7-4.4-7-9.2a3.6 3.6 0 0 1 7-1.6 3.6 3.6 0 0 1 7 1.6C19 14.6 12 19 12 19z" />,
};

const FILL: Record<PlayerSlot, string> = {
  1: "fill-player-1 stroke-player-1-ink text-player-1-ink",
  2: "fill-player-2 stroke-player-2-ink text-player-2-ink",
  3: "fill-player-3 stroke-player-3-ink text-player-3-ink",
  4: "fill-player-4 stroke-player-4-ink text-player-4-ink",
  5: "fill-player-5 stroke-player-5-ink text-player-5-ink",
  6: "fill-player-6 stroke-player-6-ink text-player-6-ink",
  7: "fill-player-7 stroke-player-7-ink text-player-7-ink",
  8: "fill-player-8 stroke-player-8-ink text-player-8-ink",
};

interface PlayerMarkerProps {
  player: PlayerSlot;
  /** Accessible name (e.g. the player's nickname); omit when the name is shown next to it. */
  label?: string;
  className?: string;
}

function PlayerMarker({ player, label, className }: PlayerMarkerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={cn("size-8 shrink-0", FILL[player], className)}
    >
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" strokeWidth="1" />
      <g fill="currentColor" stroke="none">
        {SHAPES[player]}
      </g>
    </svg>
  );
}

export { PlayerMarker, type PlayerMarkerProps };
