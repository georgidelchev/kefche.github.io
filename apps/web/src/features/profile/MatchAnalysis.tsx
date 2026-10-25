// The analysis view on a finished game's page: the game's own analysis
// module (chess: the moves with Stockfish's view of each position), loaded
// in the browser only. A game without one shows nothing here; its moves are
// still in the PGN below.
import { useEffect, useRef } from "react";

import { loadAnalysis } from "@/features/games/loaders";
import { gameStorage } from "@/features/games/player-parts";
import { fill } from "@/features/games/turn/labels";

interface Props {
  gameId: string;
  /** The stored game (chess: PGN). */
  record: string;
  /** The game's "ui" strings in the page's language. */
  ui: Record<string, string>;
  locale: string;
  dir: "ltr" | "rtl";
}

export function MatchAnalysis({ gameId, record, ui, locale, dir }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let instance: { destroy(): void } | null = null;
    let cancelled = false;
    loadAnalysis(gameId).then(
      (module) => {
        const stage = stageRef.current;
        if (cancelled || !module || !stage) return;
        instance = module.mount(stage, {
          record,
          locale,
          dir,
          t: (key, values) => fill(ui[key] ?? key, values),
          storage: gameStorage(gameId),
        });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      // Its own React root can't unmount while this one commits.
      const closing = instance;
      queueMicrotask(() => closing?.destroy());
    };
  }, [gameId, record, ui, locale, dir]);

  return <div ref={stageRef} />;
}
