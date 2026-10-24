// The Transport for online rooms (SPEC §10.1): Supabase Realtime Broadcast
// for messages and Presence for who is connected, on the private channel
// `room:<code>`. Realtime Authorization (RLS on realtime.messages) lets only
// the room's members in. realtime-js reconnects the socket and rejoins on its
// own; presence is re-tracked after every rejoin.
//
// Broadcast doesn't verify who sent a message, so the messages that change a
// match (moves, states, race progress) go through the `room_relay` function,
// which checks the sender and stamps `from`, and arrive on the listen-only
// channel `room-relay:<code>`. Those types are dropped when they come on
// `room:<code>`, where anyone in the room could have written them.
import * as z from "zod/mini";

import {
  deliver,
  type Message,
  type MessageType,
  type PresenceState,
  type Transport,
} from "@kefche/game-sdk";

import type { Supabase } from "@/lib/supabase/client";

import type { RealtimeChannel } from "@supabase/supabase-js";

const EVENT = "m";
const PROBE = "probe";
const PROBE_MS = 10_000;
/** Message types that only count when the server stamped their sender. */
const RELAYED: ReadonlySet<MessageType> = new Set(["action", "state", "progress", "finish"]);
const isRelayed = (payload: unknown) =>
  RELAYED.has((payload as { type?: unknown } | null)?.type as MessageType);

const presenceSchema = z.object({
  memberId: z.string().check(z.minLength(1), z.maxLength(64)),
  joinedAt: z.number(),
});

export class ChannelError extends Error {}

export function createSupabaseTransport(
  supabase: Supabase,
  room: { id: string; code: string },
  self: string,
): Transport {
  const handlers = new Set<(m: Message) => void>();
  const presenceHandlers = new Set<(p: readonly PresenceState[]) => void>();
  let roster: PresenceState[] = [];
  let mine: PresenceState | null = null;
  let rtt: number | null = null;
  let probe: ReturnType<typeof setInterval> | null = null;

  const channel: RealtimeChannel = supabase.channel(`room:${room.code}`, {
    config: { private: true, broadcast: { self: false, ack: true }, presence: { key: self } },
  });

  // Listen-only: everything here came through room_relay.
  const relay: RealtimeChannel = supabase.channel(`room-relay:${room.code}`, {
    config: { private: true },
  });

  channel.on("broadcast", { event: EVENT }, ({ payload }) => {
    if (!isRelayed(payload)) deliver(payload, room.id, self, handlers);
  });
  relay.on("broadcast", { event: EVENT }, ({ payload }) => {
    if (isRelayed(payload)) deliver(payload, room.id, self, handlers);
  });
  channel.on("presence", { event: "sync" }, () => {
    // Everyone's presence is untrusted input: keep only well-formed entries.
    roster = Object.values(channel.presenceState()).flatMap((entries) => {
      const parsed = presenceSchema.safeParse(entries[0]);
      return parsed.success ? [parsed.data] : [];
    });
    for (const handler of presenceHandlers) handler(roster);
  });

  let joined = false;
  // Only over the joined socket: before that, realtime-js would quietly fall
  // back to its REST API. The session resends state after (re)connecting, and
  // a relayed message that fails (rate limit, network) is recovered the same
  // way: guests ask for the state again.
  const send = (payload: Message) => {
    if (!joined) return;
    if (RELAYED.has(payload.type)) {
      // A query builder runs only once awaited.
      void supabase
        .rpc("room_relay", { p_room: room.id, p_message: payload as never })
        .then(({ error }) => {
          if (error) console.warn("room_relay", error.message);
        });
    } else {
      void channel.send({ type: "broadcast", event: EVENT, payload });
    }
  };
  const measure = () => {
    if (!joined) return;
    const start = performance.now();
    void channel.send({ type: "broadcast", event: PROBE, payload: {} }).then((result) => {
      if (result === "ok") rtt = Math.round(performance.now() - start);
    });
  };

  return {
    self,
    connect(presence) {
      mine = presence;
      // Joined first, so the first state the host relays isn't missed.
      const relayed = new Promise<void>((resolve, reject) => {
        let settled = false;
        relay.subscribe((status, error) => {
          const state: string = status;
          if (settled) return;
          if (state === "SUBSCRIBED") {
            settled = true;
            resolve();
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
            settled = true;
            reject(new ChannelError(error?.message ?? state));
          }
        });
      });
      return relayed.then(
        () =>
          new Promise((resolve, reject) => {
            let settled = false;
            channel.subscribe((status, error) => {
              // As a string: the enum would pull supabase-js into this chunk eagerly.
              const state: string = status;
              joined = state === "SUBSCRIBED";
              if (joined) {
                // Also after a reconnect: presence starts empty on a new join.
                if (mine) void channel.track(mine);
                // Round trips to the server, from the broadcast acknowledgements.
                probe ??= setInterval(measure, PROBE_MS);
                if (!settled) {
                  settled = true;
                  resolve();
                }
              } else if (!settled && (state === "CHANNEL_ERROR" || state === "TIMED_OUT")) {
                settled = true;
                reject(new ChannelError(error?.message ?? state));
              }
            });
          }),
      );
    },
    send(to, message) {
      send({ ...message, to });
    },
    broadcast(message) {
      send(message);
    },
    onMessage(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    onPresence(handler) {
      presenceHandlers.add(handler);
      handler(roster);
      return () => presenceHandlers.delete(handler);
    },
    latency: () => rtt,
    close() {
      if (probe !== null) clearInterval(probe);
      if (joined) void channel.untrack();
      joined = false;
      void supabase.removeChannel(channel);
      void supabase.removeChannel(relay);
    },
  };
}
