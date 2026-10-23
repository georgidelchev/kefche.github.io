// Typed translation keys: `t("common:theme.light")` is checked against the
// English source files, so a typo is a type error.
import type account from "../../locales/en/account.json";
import type auth from "../../locales/en/auth.json";
import type common from "../../locales/en/common.json";
import type errors from "../../locales/en/errors.json";
import type games from "../../locales/en/games.json";
import type legal from "../../locales/en/legal.json";
import type lobby from "../../locales/en/lobby.json";
import type nav from "../../locales/en/nav.json";
import type profile from "../../locales/en/profile.json";
import type settings from "../../locales/en/settings.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      nav: typeof nav;
      errors: typeof errors;
      account: typeof account;
      auth: typeof auth;
      profile: typeof profile;
      settings: typeof settings;
      games: typeof games;
      legal: typeof legal;
      lobby: typeof lobby;
    };
  }
}
