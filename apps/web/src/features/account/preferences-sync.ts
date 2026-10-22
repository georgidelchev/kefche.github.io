// Theme and language follow a signed-in user across devices (SPEC §7.3,
// Phase 2 DoD). A choice made on this device is kept as "unsaved" until it
// reaches user_settings (a language change navigates away at once, so the
// save may finish on the next page). Without unsaved changes, the profile's
// values win and are applied here. zod/mini: ships to the browser.
import * as z from "zod/mini";

import { rememberLocale, storedLocale } from "@/features/i18n/locale-preference";
import { themePreferenceSchema } from "@/features/theme/theme";
import { currentTheme, setTheme } from "@/features/theme/theme-dom";
import { isLocale, LOCALES } from "@/i18n/locales";
import type { Supabase } from "@/lib/supabase/client";

const UNSAVED_KEY = "kefche:prefs-unsaved";

const unsavedSchema = z.object({
  userId: z.string(),
  theme: z.optional(themePreferenceSchema),
  locale: z.optional(z.enum(LOCALES)),
});
type Unsaved = z.infer<typeof unsavedSchema>;

function readUnsaved(): Unsaved | null {
  try {
    const raw = localStorage.getItem(UNSAVED_KEY);
    const result = raw === null ? null : unsavedSchema.safeParse(JSON.parse(raw));
    return result?.success ? result.data : null;
  } catch {
    return null;
  }
}

function writeUnsaved(value: Unsaved | null): void {
  try {
    if (value) localStorage.setItem(UNSAVED_KEY, JSON.stringify(value));
    else localStorage.removeItem(UNSAVED_KEY);
  } catch {
    // Not kept; the change still applies on this device.
  }
}

/** Records the user's own change for `userId`, to be saved by syncPreferences. */
export function markUnsaved(userId: string, change: Omit<Unsaved, "userId">): void {
  const current = readUnsaved();
  writeUnsaved({ ...(current?.userId === userId ? current : {}), ...change, userId });
}

/** Forget unsaved changes (sign-out). */
export const clearUnsaved = () => {
  writeUnsaved(null);
};

/** Saves unsaved changes, or applies the profile's theme and language here. */
export async function syncPreferences(supabase: Supabase, userId: string): Promise<void> {
  const unsaved = readUnsaved();
  if (unsaved?.userId === userId) {
    const change = {
      ...(unsaved.theme && { theme: unsaved.theme }),
      ...(unsaved.locale && { locale: unsaved.locale }),
    };
    const { error } = await supabase.from("user_settings").update(change).eq("user_id", userId);
    if (!error) writeUnsaved(null);
    return;
  }
  if (unsaved) writeUnsaved(null); // left over from another account

  const { data, error } = await supabase
    .from("user_settings")
    .select("theme, locale")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return;
  const theme = themePreferenceSchema.safeParse(data.theme);
  if (theme.success && theme.data !== currentTheme()) setTheme(theme.data, { announce: false });
  if (isLocale(data.locale) && data.locale !== storedLocale()) {
    rememberLocale(data.locale, { announce: false });
  }
}
