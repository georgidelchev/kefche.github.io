// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

/**
 * localStorage key of the cached account summary. BootScript reads it before
 * first paint, so the header shows the signed-in state without a flash.
 */
export const ACCOUNT_STORAGE_KEY = "kefche:account";

/** What the header needs to show a signed-in, non-guest user. */
export const accountSummarySchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(64)),
  /** Null until onboarding picks one. */
  nickname: z.nullable(z.string().check(z.maxLength(40))),
  /** Uploaded (http/https URL) or preset (site path) avatar image; null shows initials. */
  avatarUrl: z.nullable(
    z.string().check(z.maxLength(500), z.regex(/^(?:https?:\/\/|\/(?!\/))[^\s"'()\\]+$/)),
  ),
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;

/** Minimal Storage surface, injectable for tests. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The cached summary, or null when absent, unreadable or invalid. */
export function readAccountSummary(storage: KeyValueStorage | undefined): AccountSummary | null {
  try {
    const raw = storage?.getItem(ACCOUNT_STORAGE_KEY);
    if (raw == null) return null;
    const result = accountSummarySchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function writeAccountSummary(
  storage: KeyValueStorage | undefined,
  summary: AccountSummary | null,
): void {
  try {
    if (summary) storage?.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(summary));
    else storage?.removeItem(ACCOUNT_STORAGE_KEY);
  } catch {
    // Not cached; the header falls back to "Sign in" until the session check runs.
  }
}
