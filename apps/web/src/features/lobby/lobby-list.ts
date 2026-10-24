// The public lobby browser's data (Phase 5 step 8): open public rooms from
// `public_rooms`, read again as soon as the database announces a change to
// the list on the private Broadcast topic `lobbies` (a room listed, changed,
// turned private or gone; migration 20261024100200), and when the page shows
// again. Browsing needs no identity: visitors read and listen as `anon`.

import { nullable, type Supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.gen";

type PublicRoomRow = Database["public"]["Functions"]["public_rooms"]["Returns"][number];

export interface PublicRoom {
  code: string;
  gameId: string;
  playing: boolean;
  /** Seats in the match, and how many bots and people fill them. */
  seats: number;
  taken: number;
  host: string | null;
  createdAt: number;
}

export function publicRoom(row: PublicRoomRow): PublicRoom {
  return {
    code: row.code,
    gameId: row.game_id,
    playing: row.status === "playing",
    seats: row.players,
    taken: Math.min(row.players, row.bots + row.people),
    // Null when the host's account is gone (a left join the types don't show).
    host: nullable(row.host_nickname),
    createdAt: Date.parse(row.created_at),
  };
}

// Changes come in bursts (a member and the room at once): read once per burst.
const MIN_GAP_MS = 300;

/** Calls `onList` with the open public rooms now and whenever they may have changed. */
export function watchPublicRooms(
  supabase: Supabase,
  onList: (rooms: PublicRoom[]) => void,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastRead = 0;
  let generation = 0;

  const load = () => {
    timer = null;
    lastRead = Date.now();
    const mine = ++generation;
    supabase.rpc("public_rooms").then(
      ({ data, error }) => {
        if (stopped || mine !== generation) return;
        if (error) onError(error);
        else onList(data.map(publicRoom));
      },
      (error: unknown) => {
        if (!stopped) onError(error);
      },
    );
  };
  // A read soon, never closer than MIN_GAP_MS to the last one.
  const soon = () => {
    if (stopped || timer !== null || document.hidden) return;
    timer = setTimeout(load, Math.max(0, lastRead + MIN_GAP_MS - Date.now()));
  };

  const channel = supabase
    .channel("lobbies", { config: { private: true } })
    .on("broadcast", { event: "changed" }, soon)
    .subscribe((status) => {
      // Read again on every (re)subscription: changes may have been missed.
      const state: string = status;
      if (state === "SUBSCRIBED") soon();
    });
  const onVisible = () => {
    if (!document.hidden) soon();
  };
  document.addEventListener("visibilitychange", onVisible);
  load();

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
    void supabase.removeChannel(channel);
  };
}
