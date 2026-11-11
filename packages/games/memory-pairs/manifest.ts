import { defineManifest } from "@kefche/game-sdk";

// Memory Pairs (Phase 12, TODO #5): Memory Match's cards, taking turns, for
// 2–6 players with bots, on one device or online. The face-down cards must
// stay hidden from every player, so online matches play on a table on the
// arena server, which turns each card as it's chosen (hiddenInformation,
// ADR-0047). Memory Match stays the race against the clock.
export const manifest = defineManifest({
  id: "memory-pairs",
  version: 1,
  category: "logic",
  kind: "turn",
  players: { min: 2, max: 6, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 10, onExpiry: "random-move" },
    { kind: "per-move", seconds: 20, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "cards",
      label: "cards",
      values: [
        { value: 20, label: "cards20" },
        { value: 12, label: "cards12" },
        { value: 30, label: "cards30" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 10],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // The layout comes from the seed; every flip is a move.
  scoreValidation: { kind: "replay" },
  tags: ["memory", "classic", "family", "multiplayer"],
});
