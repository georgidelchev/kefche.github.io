import { AUTH_STORAGE_KEY, supabaseConfig } from "./config";

import type { Database } from "./database.gen";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Supabase = SupabaseClient<Database>;

let client: Promise<Supabase> | undefined;

/**
 * The browser's Supabase client, or null when the build has no Supabase.
 * supabase-js is loaded on first use, so pages that never need it don't pay
 * for it. Sessions live in localStorage (ADR-0011).
 */
export function getSupabase(): Promise<Supabase> | null {
  if (!supabaseConfig) return null;
  const { url, key } = supabaseConfig;
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient<Database>(url, key, {
      auth: {
        flowType: "pkce",
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        // The auth callback page completes sign-ins explicitly.
        detectSessionInUrl: false,
      },
    }),
  );
  return client;
}

/**
 * Generated types can't express that a SQL function returning `text` may
 * return null (our RPCs use null for "no problem"), so widen them here.
 */
export const nullable = <T>(value: T): T | null => value;

/** True when this browser holds a stored session (no network, no supabase-js). */
export function hasStoredSession(): boolean {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
