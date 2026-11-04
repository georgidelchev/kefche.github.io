// Sanction notices (SPEC §8.3). The database refuses a sanctioned player
// with a stable code (`muted`: no chat; `suspended`: no online play) and, as
// the error's detail, when the sanction ends (ISO 8601, empty when it has no
// end), so the notice can say until when.
import * as z from "zod/mini";

import { fill } from "@/features/games/turn/labels";

export type SanctionCode = "muted" | "suspended";

const refusal = z.object({
  message: z.string(),
  details: z.optional(z.nullable(z.string())),
});

/**
 * When the sanction behind `error` ends, if `error` is the `code` refusal: a
 * time, or null when it has no end. Undefined for any other error.
 */
export function sanctionEnd(error: unknown, code: SanctionCode): Date | null | undefined {
  const parsed = refusal.safeParse(error);
  if (!parsed.success || parsed.data.message !== code) return undefined;
  const at = Date.parse(parsed.data.details ?? "");
  return Number.isNaN(at) ? null : new Date(at);
}

/** `until` ("… until {until}.") with the end in the reader's locale, or `forever` without one. */
export function sanctionNotice(
  ends: Date | null,
  strings: { until: string; forever: string },
  locale: string,
): string {
  if (!ends) return strings.forever;
  const until = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    ends,
  );
  return fill(strings.until, { until });
}
