// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

const claimsSchema = z.object({ app_roles: z.optional(z.array(z.string())) });

/**
 * Whether the session's access token says its user is staff (the `app_roles`
 * claim set by the token hook). Only a hint for the header's admin link: the
 * token isn't verified here, and the admin panel reads the roles table.
 */
export function isStaffToken(token: string): boolean {
  const payload = token.split(".")[1];
  if (!payload) return false;
  try {
    // base64url; atob accepts it without padding once the alphabet is restored.
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = claimsSchema.safeParse(JSON.parse(json));
    const roles = claims.success ? (claims.data.app_roles ?? []) : [];
    return roles.includes("admin") || roles.includes("moderator");
  } catch {
    return false;
  }
}
