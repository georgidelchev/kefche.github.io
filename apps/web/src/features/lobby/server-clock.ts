// The database's clock as seen from this device (`server_time`), so every
// browser counts down to the same moment whatever its own clock says: a
// race's start, and when a rated game's clocks begin.
import type { Supabase } from "@/lib/supabase/client";

/**
 * The database's clock minus this device's (ms), from the quickest of three
 * round trips (the most accurate); null if none came back.
 */
export async function measureServerOffset(supabase: Supabase): Promise<number | null> {
  let best: { offset: number; rtt: number } | null = null;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc("server_time");
    const t1 = Date.now();
    if (error) continue;
    const sample = { offset: data - (t0 + t1) / 2, rtt: t1 - t0 };
    if (!best || sample.rtt < best.rtt) best = sample;
  }
  return best?.offset ?? null;
}
