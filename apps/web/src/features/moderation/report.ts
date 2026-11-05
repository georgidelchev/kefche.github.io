// Reports (SPEC §8.3): a message, a lobby chat message, a player (their
// nickname or bio) or an uploaded avatar (by its path), with a reason. The
// database keeps a copy for the moderator and hides what 3 accounts report
// until one looks. Dependency-free: the profile's plain script uses it too.
import type { Supabase } from "@/lib/supabase/client";

export type ReportType = "message" | "room_message" | "user" | "avatar";

/** The reasons, as the database names them. */
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "self-harm",
  "cheating",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** The strings key of each reason. */
export const REASON_KEYS = {
  spam: "spam",
  harassment: "harassment",
  hate: "hate",
  sexual: "sexual",
  "self-harm": "selfHarm",
  cheating: "cheating",
  other: "other",
} as const satisfies Record<ReportReason, string>;

export const DETAILS_MAX = 500;

/** How a report went: sent, sent before, or why not. */
export type ReportOutcome = "sent" | "already" | "rateLimited" | "gone" | "failed";

export async function sendReport(
  supabase: Supabase,
  report: { type: ReportType; target: string; reason: ReportReason; details: string },
): Promise<ReportOutcome> {
  const details = report.details.trim();
  const { data, error } = await supabase.rpc("report", {
    p_type: report.type,
    p_target: report.target,
    p_reason: report.reason,
    ...(details === "" ? {} : { p_details: details }),
  });
  if (error) {
    if (error.message === "rate_limited") return "rateLimited";
    if (error.message === "not_found") return "gone";
    return "failed";
  }
  return data === "already_reported" ? "already" : "sent";
}
