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
  { id: "profile", path: "/profile/", status: "soon" }, // Phase 2
] as const satisfies readonly { id: string; path: string; status: "available" | "soon" }[];

export type NavId = (typeof NAV_ITEMS)[number]["id"];

/** Sections without a real page yet, plus header search (catalog search, Phase 3). */
export const SOON_SECTIONS = [
  ...NAV_ITEMS.filter((i) => i.status === "soon").map((i) => i.id),
  "search",
] as const;

export type SoonSection = (typeof SOON_SECTIONS)[number];

/** Literal keys (not built from the id) so typed `t()` and `pnpm i18n:check` can see them. */
export const NAV_LABEL_KEYS = {
  home: "nav:home",
  games: "nav:games",
  play: "nav:play",
  friends: "nav:friends",
  profile: "nav:profile",
  search: "nav:search",
} as const satisfies Record<NavId | SoonSection, `nav:${string}`>;
