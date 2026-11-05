// The arena Worker: `/arenas/<name>` upgrades to a WebSocket held by that
// arena's Durable Object; `/health` answers "ok".
import { Arena } from "./arena";

import type { Env } from "./env";

export { Arena };

const ARENA_PATH = /^\/arenas\/([a-z0-9-]{1,40})$/;

export default {
  fetch(request, env): Response | Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    const name = ARENA_PATH.exec(url.pathname)?.[1];
    if (!name) return new Response("not_found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("upgrade_required", { status: 426 });
    }
    // Browsers always send Origin, so another site can't open an arena from
    // its pages. Other clients still need a valid token to play.
    const origin = request.headers.get("Origin");
    const allowed = env.SITE_ORIGINS.split(",").map((o) => o.trim());
    if (origin !== null && !allowed.includes(origin)) {
      return new Response("forbidden", { status: 403 });
    }
    return env.ARENA.getByName(name).fetch(request);
  },
} satisfies ExportedHandler<Env>;
