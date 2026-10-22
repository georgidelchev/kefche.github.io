/**
 * Primary navigation (SPEC §6.5). `soon` sections render a localized "coming
 * soon" page (src/pages/[locale]/[section].astro) until their phase ships;
 * that phase flips the entry to `available` and adds the real page.
 */
export const NAV_ITEMS = [
  { id: "home", path: "/", status: "available" },
  { id: "games", path: "/games/", status: "soon" }, // Phase 3
  { id: "play", path: "/play/", status: "soon" }, // Phase 5
  { id: "friends", path: "/friends/", status: "soon" }, // Phase 8
  // Needs accounts: "soon" in builds without Supabase (ADR-0011).
  { id: "profile", path: "/profile/", status: "accounts" },
] as const satisfies readonly {
  id: string;
  path: string;
  status: "available" | "soon" | "accounts";
}[];

export type NavId = (typeof NAV_ITEMS)[number]["id"];

/** Sections that may show "coming soon", plus header search (catalog search, Phase 3). */
export type SoonSection = Exclude<NavId, "home"> | "search";

/** Sections without a real page in this build. */
export function soonSections(accounts: boolean): SoonSection[] {
  const soon = NAV_ITEMS.filter(
    (item) => item.status === "soon" || (item.status === "accounts" && !accounts),
  ).map((item) => item.id as SoonSection);
  return [...soon, "search"];
}

/** Literal keys (not built from the id) so typed `t()` and `pnpm i18n:check` can see them. */
export const NAV_LABEL_KEYS = {
  home: "nav:home",
  games: "nav:games",
  play: "nav:play",
  friends: "nav:friends",
  profile: "nav:profile",
  search: "nav:search",
} as const satisfies Record<NavId | SoonSection, `nav:${string}`>;
