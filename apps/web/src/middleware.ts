import { defineMiddleware } from "astro:middleware";

import { parseGlobalHeaders } from "@/lib/security-headers";

import headersFile from "../public/_headers?raw";

const SECURITY_HEADERS = parseGlobalHeaders(headersFile);

/** Adds the `_headers` security headers to on-demand (Worker-rendered) responses. */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.isPrerendered) return response;
  // Copy instead of mutating: some responses have immutable headers.
  const headers = new Headers(response.headers);
  for (const [name, value] of SECURITY_HEADERS) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
