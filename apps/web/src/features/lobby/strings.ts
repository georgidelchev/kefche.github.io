// Text for online play (Phase 5), translated on the page and passed to islands.
import type { AuthErrorKey } from "@/features/auth/errors";
import type { AppT } from "@/i18n/i18n";

export interface GuestStrings {
  title: string;
  intro: string;
  nickname: string;
  ageConfirm: string;
  ageNeeded: string;
  submit: string;
  privacyNote: string;
  privacyLink: string;
  errors: Record<AuthErrorKey, string>;
}

export function guestStrings(t: AppT, errors: Record<AuthErrorKey, string>): GuestStrings {
  return {
    title: t("lobby:guest.title"),
    intro: t("lobby:guest.intro"),
    nickname: t("lobby:guest.nickname"),
    ageConfirm: t("lobby:guest.ageConfirm"),
    ageNeeded: t("lobby:guest.ageNeeded"),
    submit: t("lobby:guest.submit"),
    privacyNote: t("legal:privacy.signUpNote"),
    privacyLink: t("legal:privacy.title"),
    errors,
  };
}
