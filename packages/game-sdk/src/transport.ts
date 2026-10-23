// Transport abstraction (SPEC §10.1): how room members exchange protocol
// messages and see who is here. The first real implementation is Supabase
// Realtime (Broadcast + Presence on `room:<code>`); a dedicated game server or
// WebRTC can be added later without touching game code. The in-memory hub
// below connects members in one process, for tests and simulations.
import { parseMessage, type Message } from "./protocol";

/** What each member shares through presence. */
export interface PresenceState {
  /** The member's user id (guests included). */
  memberId: string;
  /** When the member joined the room, ms since epoch: the host election order. */
  joinedAt: number;
}

export interface Transport {
  /** This member's id. */
  readonly self: string;
  connect(presence: PresenceState): Promise<void>;
  /** To one member: everyone else ignores it. */
  send(to: string, message: Message): void;
  broadcast(message: Message): void;
  /** Validated messages from other members; returns an unsubscribe. */
  onMessage(handler: (message: Message) => void): () => void;
  /** Everyone connected now, this member included; called on every change. */
  onPresence(handler: (members: readonly PresenceState[]) => void): () => void;
  /** Round-trip time to the room in ms, or null before the first measurement. */
  latency(): number | null;
  close(): void;
}

/**
 * Delivery shared by transports that carry raw JSON: drops messages to other
 * members and anything invalid, then hands the rest to the handlers.
 */
export function deliver(
  raw: unknown,
  roomId: string,
  self: string,
  handlers: Iterable<(message: Message) => void>,
): void {
  const message = parseMessage(raw, roomId);
  if (!message || message.from === self) return;
  if (message.to !== undefined && message.to !== self) return;
  for (const handler of handlers) handler(message);
}

/** Connects members in one process. Delivery is async, like a network. */
export function createMemoryHub(roomId: string) {
  const members = new Map<
    string,
    {
      presence: PresenceState | null;
      messages: Set<(m: Message) => void>;
      presenceHandlers: Set<(p: readonly PresenceState[]) => void>;
    }
  >();
  const roster = () => [...members.values()].flatMap((m) => (m.presence ? [m.presence] : []));
  const announce = () => {
    const list = roster();
    for (const m of members.values()) for (const handler of m.presenceHandlers) handler(list);
  };
  // Later, like a network (and with no DOM or Node timers in isomorphic code).
  const later = (task: () => void) => {
    void Promise.resolve().then(task);
  };
  const post = (message: Message) => {
    // A copy through JSON, as a network would deliver it.
    const raw: unknown = JSON.parse(JSON.stringify(message));
    later(() => {
      for (const [memberId, m] of members) deliver(raw, roomId, memberId, m.messages);
    });
  };

  return {
    connect(self: string): Transport {
      const entry = {
        presence: null as PresenceState | null,
        messages: new Set<(m: Message) => void>(),
        presenceHandlers: new Set<(p: readonly PresenceState[]) => void>(),
      };
      members.set(self, entry);
      return {
        self,
        connect(presence) {
          entry.presence = presence;
          later(announce);
          return Promise.resolve();
        },
        send(to, message) {
          post({ ...message, to });
        },
        broadcast(message) {
          post(message);
        },
        onMessage(handler) {
          entry.messages.add(handler);
          return () => entry.messages.delete(handler);
        },
        onPresence(handler) {
          entry.presenceHandlers.add(handler);
          handler(roster());
          return () => entry.presenceHandlers.delete(handler);
        },
        latency: () => 0,
        close() {
          members.delete(self);
          later(announce);
        },
      };
    },
    /** Members connected now (for tests). */
    roster,
  };
}
