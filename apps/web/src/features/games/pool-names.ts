// Rating pools' names, by pool id (the manifests' `rated.pools`): chess's
// clock pools, and Checkers' variants (Phase 11). Literal keys, so the i18n
// check sees each one.
import type { AppT } from "@/i18n/i18n";

const POOL_KEYS = {
  bullet: "lobby:rated.pools.bullet",
  blitz: "lobby:rated.pools.blitz",
  rapid: "lobby:rated.pools.rapid",
  classical: "lobby:rated.pools.classical",
  russian: "lobby:rated.pools.russian",
  international: "lobby:rated.pools.international",
} as const;

/** Every pool's name in the page's language; an unknown pool isn't listed (show its id). */
export const poolNames = (t: AppT): Record<string, string> =>
  Object.fromEntries(Object.entries(POOL_KEYS).map(([id, key]) => [id, t(key)]));
