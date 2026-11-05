// A solo arena life's record (Phase 9 step 9c): the player's input in effect
// at each tick, as the hex of its encoded bytes (null before their first),
// packed like a race log (race-log.ts), so steady steering packs into runs.
// Its length is the life's length in ticks. The server replays it on the
// arena's seed (supabase/functions/_shared/arena-solo.ts).

/**
 * The most of a life the server replays: 3 minutes of play. A longer life
 * counts as it stood then, so the record stops there.
 */
export const ARENA_REPLAY_SECONDS = 180;

export function inputHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/** The bytes of an input's hex; null when it isn't hex (or longer than 64 bytes). */
export function hexInput(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || hex.length > 128 || !/^[0-9a-f]*$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
