// Avatar frames' names and how to unlock them, in the page's language
// (literal keys, for i18n:check). Server side: pages pass them to islands.
import type { AvatarFrame } from "@kefche/ui/lib/frames";

import type { AppT } from "@/i18n/i18n";

export function frameNames(t: AppT): Record<AvatarFrame, string> {
  return {
    "streak-3": t("settings:frames.names.streak3"),
    "streak-7": t("settings:frames.names.streak7"),
    "streak-30": t("settings:frames.names.streak30"),
    "streak-100": t("settings:frames.names.streak100"),
    gold: t("settings:frames.names.gold"),
  };
}

export function frameHints(t: AppT): Record<AvatarFrame, string> {
  return {
    "streak-3": t("settings:frames.hints.streak3"),
    "streak-7": t("settings:frames.hints.streak7"),
    "streak-30": t("settings:frames.hints.streak30"),
    "streak-100": t("settings:frames.hints.streak100"),
    gold: t("settings:frames.hints.gold"),
  };
}
