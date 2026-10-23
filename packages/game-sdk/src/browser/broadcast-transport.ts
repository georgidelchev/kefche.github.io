// A Transport between tabs of one browser (BroadcastChannel), for trying
// rooms locally without a server. Presence is a heartbeat: each tab announces
// itself every second and is dropped after three missed beats or a goodbye.

import { deliver, type PresenceState, type Transport } from "../transport";

import type { Message } from "../protocol";

type Wire =
  | { kind: "message"; message: Message }
  | { kind: "here"; presence: PresenceState }
  | { kind: "bye"; memberId: string };

const BEAT_MS = 1000;

export function createBroadcastTransport(roomId: string, self: string): Transport {
  const channel = new BroadcastChannel(`kefche-room-${roomId}`);
  const messages = new Set<(m: Message) => void>();
  const presenceHandlers = new Set<(p: readonly PresenceState[]) => void>();
  const seen = new Map<string, { presence: PresenceState; at: number }>();
  let mine: PresenceState | null = null;
  let beat: ReturnType<typeof setInterval> | null = null;

  const roster = () => [...seen.values()].map((s) => s.presence);
  const announce = () => {
    const list = roster();
    for (const handler of presenceHandlers) handler(list);
  };
  const post = (wire: Wire) => {
    channel.postMessage(wire);
  };

  channel.onmessage = (event: MessageEvent<unknown>) => {
    const wire = event.data as Partial<Wire> | null;
    if (wire?.kind === "message") deliver(wire.message, roomId, self, messages);
    else if (wire?.kind === "here" && wire.presence && typeof wire.presence.memberId === "string") {
      const known = seen.has(wire.presence.memberId);
      seen.set(wire.presence.memberId, { presence: wire.presence, at: Date.now() });
      if (!known) announce();
    } else if (wire?.kind === "bye" && typeof wire.memberId === "string") {
      if (seen.delete(wire.memberId)) announce();
    }
  };

  return {
    self,
    connect(presence) {
      mine = presence;
      seen.set(self, { presence, at: Date.now() });
      const tick = () => {
        if (mine) post({ kind: "here", presence: mine });
        const now = Date.now();
        let changed = false;
        for (const [id, s] of seen) {
          if (id !== self && now - s.at > BEAT_MS * 3) changed = seen.delete(id) || changed;
        }
        if (changed) announce();
      };
      tick();
      beat = setInterval(tick, BEAT_MS);
      announce();
      return Promise.resolve();
    },
    send(to, message) {
      post({ kind: "message", message: { ...message, to } });
    },
    broadcast(message) {
      post({ kind: "message", message });
    },
    onMessage(handler) {
      messages.add(handler);
      return () => messages.delete(handler);
    },
    onPresence(handler) {
      presenceHandlers.add(handler);
      handler(roster());
      return () => presenceHandlers.delete(handler);
    },
    latency: () => 0,
    close() {
      if (beat !== null) clearInterval(beat);
      post({ kind: "bye", memberId: self });
      channel.close();
    },
  };
}
