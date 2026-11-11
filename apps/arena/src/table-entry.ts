// Who is joining a table, and the room's match it holds: `public.table_entry`
// answers with the player's own access token (PostgREST checks it), from the
// room's row, so the table and every member's browser build the same match.
import { z } from "zod/mini";

import type { TableErrorCode } from "@kefche/game-sdk";

import type { Env } from "./env";

const roomSchema = z.object({
  roomId: z.uuid(),
  gameId: z.string(),
  gameVersion: z.number(),
  players: z.number().check(z.int(), z.minimum(1), z.maximum(30)),
  botSeats: z.array(z.number()),
  settings: z.object({
    seed: z.string(),
    startedAt: z.number(),
    timer: z.optional(z.number()),
    options: z.optional(z.record(z.string(), z.unknown())),
    bots: z.optional(z.record(z.string(), z.string())),
  }),
  seats: z.array(z.object({ seat: z.number(), userId: z.uuid(), guest: z.boolean() })),
});
const entrySchema = z.extend(roomSchema, { userId: z.uuid(), seat: z.nullable(z.number()) });
const errorSchema = z.object({ message: z.string() });

export type TableRoom = z.infer<typeof roomSchema>;
export type TableEntry = z.infer<typeof entrySchema>;

const REFUSALS: readonly TableErrorCode[] = ["not_in_room", "suspended", "game_disabled"];

export async function tableEntry(
  env: Env,
  token: string,
  room: string,
  match: string,
): Promise<TableEntry | TableErrorCode> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/table_entry`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_room: room, p_match: match }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const entry = entrySchema.safeParse(body);
    return entry.success ? entry.data : "not_in_room";
  }
  const message = errorSchema.safeParse(body);
  const code = message.success ? message.data.message : "";
  return REFUSALS.find((r) => r === code) ?? "invalid_token";
}
