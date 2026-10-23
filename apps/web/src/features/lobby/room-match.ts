// The match a room plays, built the same way in every member's browser from
// the room row: seats in order, bots with their difficulty and a name drawn
// from the room's seed, the timer preset, and which seat is this browser's.
import { Rng, pickBotNames, type BotDifficulty, type Seat } from "@kefche/game-sdk";
import type { MatchSetup } from "@kefche/game-sdk/browser";

import type { TurnStrings } from "@/features/games/turn/labels";
import type { TurnConfig } from "@/features/games/turn/match-setup";

import type { RoomSettings } from "./room-settings";
import type { RoomSnapshot } from "./room-store";

export interface RoomMatch {
  setup: MatchSetup;
  /** The member in each seat; null for bots. */
  seatMembers: (string | null)[];
}

export const defaultDifficulty = (config: TurnConfig): BotDifficulty =>
  config.difficulties.includes("medium") ? "medium" : (config.difficulties[0] ?? "easy");

export function roomMatch(
  { room, members }: RoomSnapshot,
  settings: RoomSettings & { seed: string },
  config: TurnConfig,
  strings: TurnStrings,
  self: string,
): RoomMatch {
  const bots = room.bot_seats.length;
  const botNames = pickBotNames(Rng.fromSeed(`${settings.seed}:names`), bots);
  let nextBot = 0;
  const seatMembers: (string | null)[] = [];
  const seats = Array.from({ length: room.players }, (_, i): Seat => {
    if (room.bot_seats.includes(i)) {
      seatMembers.push(null);
      return {
        kind: "bot",
        difficulty: settings.bots[String(i)] ?? defaultDifficulty(config),
        nameId: botNames[nextBot++] ?? "mila",
      };
    }
    const member = members.find((m) => m.seat === i && m.role === "player");
    seatMembers.push(member?.userId ?? null);
    return { kind: "human", name: member?.nickname ?? "?" };
  });
  const localSeat = seatMembers.indexOf(self);
  return {
    setup: {
      mode: "online",
      seats,
      names: seats.map((seat) => (seat.kind === "bot" ? strings.botNames[seat.nameId] : seat.name)),
      timer: config.timers[settings.timer] ?? { kind: "none" },
      ...(localSeat >= 0 ? { localSeat } : {}),
    },
    seatMembers,
  };
}
