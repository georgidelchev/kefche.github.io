import { fileURLToPath } from "node:url";

/** Plugins are resolved from this package so consumers don't need to install them. */
const plugin = (name) => fileURLToPath(import.meta.resolve(name));

/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  plugins: [
    plugin("prettier-plugin-astro"),
    // Must be last (see prettier-plugin-tailwindcss README).
    plugin("prettier-plugin-tailwindcss"),
  ],
  overrides: [{ files: "*.astro", options: { parser: "astro" } }],
};
