// Shared HTTP helpers for Edge Functions: CORS, JSON responses and
// structured logs (SPEC §18: generic errors to clients, details in logs).

// The site calls functions from the browser with the user's JWT. The
// Authorization header, not the origin, is what grants access.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Stable error code for the client; details go to the log only. */
export const fail = (code: string, status: number) => json({ error: code }, status);

export function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  console[level](JSON.stringify({ level, event, ...fields, at: new Date().toISOString() }));
}

/** The bearer token from the Authorization header, if any. */
export function bearer(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
