import { EMOJI_DATA_LOCALES } from "@/features/chat/emoji-locale";

import type { APIRoute, GetStaticPaths } from "astro";

// The emoji picker's data (Emojibase, MIT), served from this site instead of
// a CDN: `/emoji/<locale>/data.json` and `messages.json`, built from the
// pinned emojibase-data package. Only the locales the picker uses are built.
const files = import.meta.glob<string>("/node_modules/emojibase-data/*/{data,messages}.json", {
  query: "?raw",
  import: "default",
});

export const getStaticPaths = (() =>
  EMOJI_DATA_LOCALES.flatMap((locale) =>
    ["data.json", "messages.json"].map((file) => ({ params: { locale, file } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const load = files[`/node_modules/emojibase-data/${params.locale ?? ""}/${params.file ?? ""}`];
  if (!load) return new Response(null, { status: 404 });
  return new Response(await load(), { headers: { "Content-Type": "application/json" } });
};
