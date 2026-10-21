/**
 * Parses the global (`/*`) rule of a Cloudflare `_headers` file into header
 * pairs. `public/_headers` is the single source of truth: Cloudflare applies it
 * to static assets, and the middleware applies the same headers to
 * Worker-rendered responses, which `_headers` does not cover.
 */
export function parseGlobalHeaders(file: string): [name: string, value: string][] {
  const headers: [string, string][] = [];
  let inGlobalRule = false;
  for (const line of file.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inGlobalRule = line.trim() === "/*";
      continue;
    }
    if (!inGlobalRule) continue;
    const colon = line.indexOf(":");
    if (colon > 0) headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
  }
  return headers;
}
