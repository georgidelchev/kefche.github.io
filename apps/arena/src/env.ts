import type { Arena } from "./arena";
import type { Directory } from "./directory";
import type { Table } from "./table";

export interface Env {
  ARENA: DurableObjectNamespace<Arena>;
  /** One per game: its open arenas. */
  DIRECTORY: DurableObjectNamespace<Directory>;
  /** One per room's match of a game with hidden information (Phase 12). */
  TABLE: DurableObjectNamespace<Table>;
  /** The Supabase project ("https://<ref>.supabase.co"); `--var` in CI, `.dev.vars` locally. */
  SUPABASE_URL: string;
  /** Its publishable key (`sb_publishable_…`), public by design. */
  SUPABASE_PUBLISHABLE_KEY: string;
  /** Comma-separated origins whose pages may open an arena's WebSocket. */
  SITE_ORIGINS: string;
  /**
   * Shared with submit-match, for reporting lives (a Worker secret; `.dev.vars`
   * locally). Without it, lives aren't reported.
   */
  ARENA_SECRET?: string;
}
