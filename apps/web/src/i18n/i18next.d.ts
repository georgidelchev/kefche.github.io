// Typed translation keys: `t("common:theme.light")` is checked against the
// English source files, so a typo is a type error.
import type common from "../../locales/en/common.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
    };
  }
}
