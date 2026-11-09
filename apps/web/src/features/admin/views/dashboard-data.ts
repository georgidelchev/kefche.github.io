// The dashboard's data (Phase 10 step 11): staff_dashboard for staff,
// staff_usage for admins, and the arena server's open arenas.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

const count = z.number();
const Dashboard = z.object({
  dau: count,
  wau: count,
  mau: count,
  days: z.array(z.object({ day: z.string(), active: count })),
  signups: z.object({ day: count, week: count, month: count, guestsWeek: count }),
  matches: z.array(z.object({ gameId: z.string(), count })),
  rooms: count,
  online: count,
  reports: count,
  oldestReport: z.nullable(z.string()),
});
export type Dashboard = z.infer<typeof Dashboard>;

export async function fetchDashboard(supabase: Supabase): Promise<Dashboard | null> {
  const { data, error } = await supabase.rpc("staff_dashboard");
  if (error) return null;
  const dashboard = Dashboard.safeParse(data);
  return dashboard.success ? dashboard.data : null;
}

const Usage = z.object({
  databaseBytes: count,
  storageBytes: count,
  storageFiles: count,
  accounts: count,
  guests: count,
  tables: z.array(z.object({ name: z.string(), bytes: count, rows: count })),
});
export type Usage = z.infer<typeof Usage>;

export async function fetchUsage(supabase: Supabase): Promise<Usage | null> {
  const { data, error } = await supabase.rpc("staff_usage");
  if (error) return null;
  const usage = Usage.safeParse(data);
  return usage.success ? usage.data : null;
}

/** Supabase's free plan (Q1): what the panel measures against. */
export const FREE_PLAN = { databaseBytes: 500 * 1024 ** 2, storageBytes: 1024 ** 3 } as const;

/** "12.3 MB", in the page's language. */
export function bytesText(bytes: number, bcp47: string): string {
  const [unit, size] =
    bytes >= 1024 ** 3
      ? (["gigabyte", bytes / 1024 ** 3] as const)
      : bytes >= 1024 ** 2
        ? (["megabyte", bytes / 1024 ** 2] as const)
        : (["kilobyte", bytes / 1024] as const);
  return new Intl.NumberFormat(bcp47, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(size);
}

/** The project's page on the Supabase dashboard, from its API URL. */
export function supabaseDashboard(apiUrl: string | undefined): string {
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(apiUrl ?? "")?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}` : "https://supabase.com/dashboard";
}
