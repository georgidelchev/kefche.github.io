// What this tab is doing, which pages set, and the live connection's event
// names. No dependencies: every page's shell script imports this.

/** What this tab is doing; "away" is worked out from the tab being hidden. */
export type PresenceContext = { status: "online" } | { status: "lobby" | "playing"; game: string };

export const PRESENCE_CONTEXT_EVENT = "kefche:presence-context";

let current: PresenceContext = { status: "online" };

/** A page says what its player is doing: in a lobby or a game (and which), or neither. */
export function setPresenceContext(context: PresenceContext): void {
  current = context;
  document.dispatchEvent(new CustomEvent(PRESENCE_CONTEXT_EVENT, { detail: context }));
}

export const presenceContext = (): PresenceContext => current;

/** A message on the player's own channel: {event, payload}, untrusted until parsed. */
export const LIVE_EVENT = "kefche:live";
/** The tab is back after being away: whatever it shows live may have changed meanwhile. */
export const LIVE_RESUME_EVENT = "kefche:live-resume";
