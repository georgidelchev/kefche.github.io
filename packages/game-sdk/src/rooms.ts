// How a room's settings become a match (Phase 12): the engine config from
// the options the room chose, and the timer it plays with. The site's lobby,
// the table on the arena server and submit-match all work it out the same
// way from the room's row, so nobody's word is needed for it.

import type { BotDifficulty, GameManifest, GameOptionDef, TimerPreset } from "./manifest";

/**
 * The engine config: every option at the value chosen if it's one of its
 * values, otherwise its first (an option rooms don't show, `rooms: false`,
 * included). Undefined for a game without options.
 */
export function roomConfig(
  options: readonly GameOptionDef[] | undefined,
  chosen: Readonly<Record<string, unknown>>,
): Record<string, string | number | boolean> | undefined {
  if (!options || options.length === 0) return undefined;
  const config: Record<string, string | number | boolean> = {};
  for (const option of options) {
    const value = option.values.find((v) => v.value === chosen[option.key]) ?? option.values[0];
    if (value) config[option.key] = value.value;
  }
  return config;
}

/**
 * The timers online rooms may use, the room's starting one first: with
 * `awayPlayers: "clock"` only clocks (chess), otherwise all of them.
 */
export function roomTimers(
  manifest: Pick<GameManifest, "timers" | "awayPlayers" | "onlineTimer">,
): number[] {
  const allowed = manifest.timers.flatMap((preset, i) =>
    manifest.awayPlayers === "clock" && preset.kind !== "clock" ? [] : [i],
  );
  const first = manifest.onlineTimer;
  return first !== undefined && allowed.includes(first)
    ? [first, ...allowed.filter((i) => i !== first)]
    : allowed;
}

/** The room's timer: the one it names if rooms may use it, or the first they may. */
export function roomTimer(
  manifest: Pick<GameManifest, "timers" | "awayPlayers" | "onlineTimer">,
  index: number,
): TimerPreset {
  const allowed = roomTimers(manifest);
  const chosen = allowed.includes(index) ? index : allowed[0];
  return (chosen === undefined ? undefined : manifest.timers[chosen]) ?? { kind: "none" };
}

/**
 * A bot seat's difficulty: the room's choice if the game has it, otherwise
 * medium, or the game's first (lobby/room-match.ts defaultDifficulty).
 */
export function roomBotDifficulty(
  manifest: Pick<GameManifest, "bots">,
  chosen: unknown,
): BotDifficulty {
  const offered = manifest.bots.difficulties;
  return (
    offered.find((d) => d === chosen) ??
    (offered.includes("medium") ? "medium" : (offered[0] ?? "easy"))
  );
}
