import type { Arena } from "./arena";

export interface Env {
  ARENA: DurableObjectNamespace<Arena>;
  /** The Supabase project ("https://<ref>.supabase.co"); `--var` in CI, `.dev.vars` locally. */
  SUPABASE_URL: string;
  /** Its publishable key (`sb_publishable_…`), public by design. */
  SUPABASE_PUBLISHABLE_KEY: string;
  /** Comma-separated origins whose pages may open an arena's WebSocket. */
  SITE_ORIGINS: string;
}
