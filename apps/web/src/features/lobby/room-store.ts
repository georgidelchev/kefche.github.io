// A room as one member sees it: the rooms row and its members with their
// nicknames, kept live through Realtime database changes (RLS decides what
// arrives). Every change refetches both, so the view is always one
// consistent read.
import type { Supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.gen";

export type RoomRow = Tables<"rooms">;

export interface RoomMember {
  userId: string;
  seat: number | null;
  role: "player" | "spectator";
  status: "joined" | "left" | "kicked";
  ready: boolean;
  joinedAt: number;
  nickname: string | null;
}

export interface RoomSnapshot {
  room: RoomRow;
  members: RoomMember[];
}

async function read(supabase: Supabase, roomId: string): Promise<RoomSnapshot | null> {
  const [room, members] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
    supabase
      .from("room_members")
      .select("user_id, seat, role, status, ready, joined_at")
      .eq("room_id", roomId)
      .order("joined_at"),
  ]);
  if (room.error) throw room.error;
  if (members.error) throw members.error;
  if (!room.data) return null;
  const ids = members.data.map((m) => m.user_id);
  const profiles =
    ids.length === 0
      ? { data: [], error: null }
      : await supabase.from("profiles").select("id, nickname").in("id", ids);
  if (profiles.error) throw profiles.error;
  const nickname = new Map(profiles.data.map((p) => [p.id, p.nickname]));
  return {
    room: room.data,
    members: members.data.map((m) => ({
      userId: m.user_id,
      seat: m.seat,
      role: m.role === "spectator" ? "spectator" : "player",
      status: m.status === "left" || m.status === "kicked" ? m.status : "joined",
      ready: m.ready,
      joinedAt: Date.parse(m.joined_at),
      nickname: nickname.get(m.user_id) ?? null,
    })),
  };
}

/**
 * Calls `onChange` with the room now and after every change; null when it
 * can't be read any more (closed for good, or the member was removed).
 * Returns a stop function.
 */
export function watchRoom(
  supabase: Supabase,
  roomId: string,
  onChange: (snapshot: RoomSnapshot | null) => void,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  const refresh = () => {
    if (pending !== null) clearTimeout(pending);
    // Changes come in bursts (a member and the room at once): read once.
    pending = setTimeout(() => {
      pending = null;
      const mine = ++generation;
      read(supabase, roomId).then(
        (snapshot) => {
          if (!stopped && mine === generation) onChange(snapshot);
        },
        (error: unknown) => {
          if (!stopped) onError(error);
        },
      );
    }, 80);
  };
  const channel = supabase
    .channel(`room-db:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      refresh,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
      refresh,
    )
    .subscribe((status) => {
      // Read again on every (re)subscription: changes may have been missed.
      const state: string = status;
      if (state === "SUBSCRIBED") refresh();
    });
  return () => {
    stopped = true;
    if (pending !== null) clearTimeout(pending);
    void supabase.removeChannel(channel);
  };
}

/** Readable error codes from the room functions (their message), else "unknown". */
export function roomErrorCode(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && /^[a-z_]+$/.test(message) ? message : "unknown";
}
