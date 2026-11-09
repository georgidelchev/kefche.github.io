// Feature flags (Phase 10 step 10, Q3): features an admin turns off without
// a deploy. The database enforces each one; pages also hide what's off.
// Dependency-free: BootScript.astro reads the stored list before paint.

/** Every flag, as `public.feature_flags` names them. */
export const FLAG_KEYS = [
  "gifs",
  "global_chat",
  "direct_messages",
  "quick_match",
  "online_arenas",
  "guest_sign_in",
] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

/**
 * localStorage: the flags last seen off, space-separated, so the next page
 * hides them before paint (`<html data-flags-off>`), then checks again.
 */
export const FLAGS_STORAGE_KEY = "kefche:flags-off";
