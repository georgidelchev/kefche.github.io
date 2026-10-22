// Server-side lookup for the public profile page (Worker-rendered).
import { z } from "zod";

import type { PublicEnv } from "@/lib/env";

/** Public columns only; private fields live in user_settings (owner-only). */
const COLUMNS = "id,nickname,avatar_kind,avatar_preset,avatar_path,country,bio,level,created_at";

const profileSchema = z.object({
  id: z.uuid(),
  nickname: z.string(),
  avatar_kind: z.string(),
  avatar_preset: z.string().nullable(),
  avatar_path: z.string().nullable(),
  country: z.string().nullable(),
  bio: z.string().nullable(),
  level: z.number().int(),
  created_at: z.string(),
});
export type PublicProfile = z.infer<typeof profileSchema>;

export type ProfileLookup =
  { status: "found"; profile: PublicProfile } | { status: "missing" } | { status: "error" };

/** Finds a profile by nickname, case-insensitively (the column is citext). */
export async function fetchPublicProfile(
  env: PublicEnv,
  nickname: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProfileLookup> {
  if (nickname.length < 1 || nickname.length > 40) return { status: "missing" };
  const url = new URL("/rest/v1/profiles", env.PUBLIC_SUPABASE_URL);
  url.searchParams.set("select", COLUMNS);
  url.searchParams.set("nickname", `eq.${nickname}`);
  url.searchParams.set("limit", "1");
  try {
    const res = await fetchImpl(url, {
      headers: { apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, accept: "application/json" },
    });
    if (!res.ok) return { status: "error" };
    const rows = z.array(profileSchema).safeParse(await res.json());
    if (!rows.success) return { status: "error" };
    const profile = rows.data[0];
    return profile ? { status: "found", profile } : { status: "missing" };
  } catch {
    return { status: "error" };
  }
}
