import base from "@kefche/config/prettier";

/** @type {import("prettier").Config} */
export default {
  ...base,
  // Tailwind 4: the class sorter reads the theme from the app's entry stylesheet.
  tailwindStylesheet: "./apps/web/src/styles/global.css",
};
