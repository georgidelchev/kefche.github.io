/**
 * Notification channels beyond the app (Phase 8 step 12). Server and build
 * time: the settings page passes them to its island.
 *
 * Push shows only in builds with `PUBLIC_VAPID_PUBLIC_KEY`, the public half
 * of the VAPID key pair whose private half is the send-push function's
 * secret (docs/RUNBOOK.md, "Web Push").
 */
const vapidKey = import.meta.env.PUBLIC_VAPID_PUBLIC_KEY ?? "";
export const VAPID_PUBLIC_KEY: string | null = /^[A-Za-z0-9_-]{86,88}$/.test(vapidKey)
  ? vapidKey
  : null;

/**
 * Email preferences show only with `PUBLIC_EMAIL_NOTIFICATIONS=on`, which is
 * for once Resend sends the outbox (Phase 21). Until then the preferences
 * would promise emails that never come.
 */
export const EMAIL_NOTIFICATIONS: boolean = import.meta.env.PUBLIC_EMAIL_NOTIFICATIONS === "on";
