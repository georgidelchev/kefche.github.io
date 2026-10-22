import type { AppT } from "@/i18n/i18n";

import type { AuthErrorKey } from "./errors";

/**
 * Every string the auth islands show, translated on the server and passed as
 * props (ADR-0009). Keys are written out in full so `pnpm i18n:check` sees them.
 */
export function authStrings(t: AppT) {
  const errors: Record<AuthErrorKey, string> = {
    required: t("auth:errors.required"),
    emailInvalid: t("auth:errors.emailInvalid"),
    passwordWeak: t("auth:errors.passwordWeak"),
    samePassword: t("auth:errors.samePassword"),
    invalidCredentials: t("auth:errors.invalidCredentials"),
    emailNotConfirmed: t("auth:errors.emailNotConfirmed"),
    rateLimited: t("auth:errors.rateLimited"),
    linkExpired: t("auth:errors.linkExpired"),
    ageRestricted: t("auth:errors.ageRestricted"),
    birthDateInvalid: t("auth:errors.birthDateInvalid"),
    nicknameLength: t("auth:errors.nicknameLength"),
    nicknameCharacters: t("auth:errors.nicknameCharacters"),
    nicknameReserved: t("auth:errors.nicknameReserved"),
    nicknameBlocked: t("auth:errors.nicknameBlocked"),
    nicknameTaken: t("auth:errors.nicknameTaken"),
    network: t("auth:errors.network"),
    unknown: t("auth:errors.unknown"),
  };
  return {
    errors,
    fields: {
      email: t("auth:fields.email"),
      password: t("auth:fields.password"),
      newPassword: t("auth:fields.newPassword"),
      nickname: t("auth:fields.nickname"),
      birthDate: t("auth:fields.birthDate"),
      birthMonth: t("auth:fields.birthMonth"),
      birthYear: t("auth:fields.birthYear"),
      showPassword: t("auth:fields.showPassword"),
      hidePassword: t("auth:fields.hidePassword"),
    },
    hints: {
      password: t("auth:hints.password"),
      nickname: t("auth:hints.nickname"),
      nicknameAvailable: t("auth:hints.nicknameAvailable"),
      birthDate: t("auth:hints.birthDate"),
    },
    oauth: {
      google: t("auth:oauth.google"),
      discord: t("auth:oauth.discord"),
      twitch: t("auth:oauth.twitch"),
      facebook: t("auth:oauth.facebook"),
    },
    signIn: {
      submit: t("auth:signIn.submit"),
      forgot: t("auth:signIn.forgot"),
      noAccount: t("auth:signIn.noAccount"),
      createAccount: t("auth:signIn.createAccount"),
      or: t("auth:signIn.or"),
    },
    signUp: {
      submit: t("auth:signUp.submit"),
      haveAccount: t("auth:signUp.haveAccount"),
      signIn: t("auth:signIn.submit"),
      checkEmailTitle: t("auth:signUp.checkEmailTitle"),
      // Filled in on the client; the placeholder survives ICU formatting.
      checkEmailBody: t("auth:signUp.checkEmailBody", { email: "{email}" }),
    },
    forgot: {
      submit: t("auth:forgot.submit"),
      sent: t("auth:forgot.sent", { email: "{email}" }),
      back: t("auth:forgot.back"),
    },
    reset: {
      submit: t("auth:reset.submit"),
      done: t("auth:reset.done"),
      continue: t("auth:reset.continue"),
      requestNew: t("auth:forgot.title"),
    },
    onboarding: {
      submit: t("auth:onboarding.submit"),
    },
  };
}

export type AuthStrings = ReturnType<typeof authStrings>;

/** Fills a `{email}`-style placeholder left in a pre-translated string. */
export const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
