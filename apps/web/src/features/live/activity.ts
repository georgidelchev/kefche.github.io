// Notes the signed-in player (an account or a guest) as active today, once
// per UTC day per browser and player (Phase 10 step 11, owner decision Q5:
// the dashboard's active players; kept 35 days, as the privacy notice says).
import type { Supabase } from "@/lib/supabase/client";

const KEY = "kefche:active";

export async function noteActivity(supabase: Supabase, userId: string): Promise<void> {
  const mark = `${new Date().toISOString().slice(0, 10)}:${userId}`;
  try {
    if (localStorage.getItem(KEY) === mark) return;
  } catch {
    // Storage unavailable: note it anyway (the database keeps one row a day).
  }
  const { error } = await supabase.rpc("note_activity");
  if (error) return;
  try {
    localStorage.setItem(KEY, mark);
  } catch {
    // Storage unavailable.
  }
}
