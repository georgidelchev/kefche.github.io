// The arena Worker:
//   GET /games/<game>/arena     {"arena": "<name>"}: where "Play online" goes (the directory)
//   WS  /arenas/<game>/<name>   the arena's WebSocket, held by its Durable Object
//   GET /health                 "ok"
// Only the site's pages may use them (SITE_ORIGINS); browsers always send
// Origin, and other clients still need a valid token to play.
import { Arena } from "./arena";
import { Directory } from "./directory";
import { GAMES } from "./games";

import type { Env } from "./env";

export { Arena, Directory };

const ARENA_PATH = /^\/arenas\/([a-z0-9-]{1,40})\/([a-z0-9-]{1,40})$/;
const DIRECTORY_PATH = /^\/games\/([a-z0-9-]{1,40})\/arena$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    const origin = request.headers.get("Origin");
    const allowed = env.SITE_ORIGINS.split(",").map((o) => o.trim());
    if (origin !== null && !allowed.includes(origin)) {
      return new Response("forbidden", { status: 403 });
    }

    const listing = DIRECTORY_PATH.exec(url.pathname);
    if (listing) {
      const cors = { "Access-Control-Allow-Origin": origin ?? "*", Vary: "Origin" };
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      const id = listing[1] ?? "";
      const game = GAMES[id];
      if (!game || request.method !== "GET")
        return new Response("not_found", { status: 404, headers: cors });
      const arena = await env.DIRECTORY.getByName(id).assign(game.host.maxPeople);
      return Response.json({ arena }, { headers: { ...cors, "Cache-Control": "no-store" } });
    }

    const arena = ARENA_PATH.exec(url.pathname);
    if (!arena) return new Response("not_found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("upgrade_required", { status: 426 });
    }
    return env.ARENA.getByName(`${arena[1] ?? ""}/${arena[2] ?? ""}`).fetch(request);
  },
} satisfies ExportedHandler<Env>;
