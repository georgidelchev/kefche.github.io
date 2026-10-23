// Pieces the offline player (GamePlayer) and online matches share.
import { useEffect, type ReactNode } from "react";

import { createSoundService, type GameStorage } from "@kefche/game-sdk/browser";

// "Quiet", the owner's pick in the Phase 3 sound picker. A volume slider
// arrives with the settings in Phase 16.
export const VOLUME = 0.22;

export function gameStorage(id: string): GameStorage {
  return {
    get: (key) => {
      try {
        return localStorage.getItem(`kefche:game:${id}:${key}`);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        if (value === null) localStorage.removeItem(`kefche:game:${id}:${key}`);
        else localStorage.setItem(`kefche:game:${id}:${key}`, value);
      } catch {
        // Not saved; the game goes on.
      }
    },
  };
}

export function createLowTimeSound() {
  // The owner's pick in the Phase 4 sound picker.
  return createSoundService({ low: "tick-tock" }, () => VOLUME);
}

/** While a game is open: no page scroll, and the screen stays awake. */
export function useGameScreen(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    let lock: WakeLockSentinel | null = null;
    let released = false;
    // Not every browser has the Wake Lock API.
    if ("wakeLock" in navigator) {
      void navigator.wakeLock.request("screen").then(
        (sentinel) => {
          if (released) void sentinel.release();
          else lock = sentinel;
        },
        () => undefined,
      );
    }
    return () => {
      root.style.overflow = "";
      released = true;
      void lock?.release();
    };
  }, [open]);
}

export function Overlay({
  children,
  placement = "cover",
}: {
  children: ReactNode;
  placement?: "cover" | "bottom";
}) {
  return placement === "cover" ? (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/90 p-6 text-center backdrop-blur-sm">
      {children}
    </div>
  ) : (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-center gap-3 border-t border-border bg-surface/95 p-4 text-center shadow-[0_-8px_24px_rgb(0_0_0/0.12)] backdrop-blur-sm [&>p]:basis-full">
      {children}
    </div>
  );
}
