import { defineManifest } from "@kefche/game-sdk";

// SPEC §22 (Phase 9): a real-time arena of worms, drop-in and endless. Each
// life is a game: online lives are reported by the arena server, solo lives
// replayed (step 9c).
export const manifest = defineManifest({
  id: "worm-rush",
  // Stored with every result; the arena server reports it with online lives.
  version: 1,
  category: "arenas",
  kind: "realtime",
  // People in one online arena; bots fill it to 10 (apps/arena, engine/arena.ts).
  players: { min: 1, max: 15, default: 1 },
  // The solo arena against bots, and the online arenas (not rooms: arenas are
  // joined through the arena server's directory).
  modes: ["solo-bots", "online-public"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["joystick", "mouse", "keyboard"],
  renderer: "pixi",
  estimatedMinutes: [2, 15],
  // Online lives only (Phase 9 Q5): the arena server decides them.
  leaderboards: [{ id: "longest", metric: "score", order: "desc" }],
  achievements: [
    { id: "long-worm", icon: "trophy", metric: "bestScore", tiers: [150, 500, 1500] },
    { id: "regular", icon: "repeat", metric: "played", tiers: [10, 50, 200] },
  ],
  // Solo lives replay from the seed and the inputs by tick (step 9c).
  scoreValidation: { kind: "replay" },
  tags: ["arena", "multiplayer", "reflexes", "bots"],
});
