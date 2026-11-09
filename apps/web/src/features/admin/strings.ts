import type { AppT } from "@/i18n/i18n";

import { ADMIN_LABEL_KEYS, ADMIN_SECTIONS, type AdminSectionId } from "./sections";

/** The admin shell's strings: the menu, its states and the section names. */
export function adminStrings(t: AppT) {
  return {
    menu: t("admin:menu"),
    loading: t("admin:loading"),
    failed: t("admin:failed"),
    retry: t("admin:retry"),
    staffOnly: t("admin:staffOnly"),
    staffOnlyBody: t("admin:staffOnlyBody"),
    home: t("common:comingSoon.back"),
    adminOnly: t("admin:adminOnly"),
    pending: t("admin:pending"),
    role: { admin: t("admin:role.admin"), moderator: t("admin:role.moderator") },
    sections: Object.fromEntries(
      ADMIN_SECTIONS.map(({ id }) => [id, t(ADMIN_LABEL_KEYS[id])]),
    ) as Record<AdminSectionId, string>,
  };
}

export type AdminStrings = ReturnType<typeof adminStrings>;
