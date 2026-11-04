/**
 * GIFs in chat (Phase 8 step 10, Q1): off unless the build sets
 * `PUBLIC_GIFS=on`, which is for once the `giphy` function has its
 * GIPHY_API_KEY (docs/RUNBOOK.md). Without the key the function answers
 * `gifs_off` anyway; the switch keeps the button from showing in vain.
 * Server and build time: pages pass it to the chat islands.
 */
export const GIFS_ENABLED: boolean = import.meta.env.PUBLIC_GIFS === "on";
