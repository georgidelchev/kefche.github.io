// Client-side Supabase settings, inlined by Vite at build time. They are
// validated by getSupabaseEnv() (@/lib/env, full Zod, server only), which
// BaseLayout calls while rendering every page, so an invalid value fails the
// build before it can reach the browser.
const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Null when the build has no Supabase: account features are absent. */
export const supabaseConfig = url && key ? { url, key } : null;

/** localStorage key of the Supabase session (set explicitly so it's stable and checkable). */
export const AUTH_STORAGE_KEY = "kefche:auth";
