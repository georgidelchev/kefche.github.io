// Which notifications arrive, and how (Phase 8 steps 6 and 12): each type in
// the app, by push and by email, saved on its own through
// set_notification_pref, plus push on this device (opt-in per device). Push
// shows in builds with a VAPID key, email once it's switched on (Phase 21).
// Notices about the account always arrive.
import { useEffect, useState } from "react";

import { Button } from "@kefche/ui/components/button";

import { FormMessage } from "@/features/auth/components/fields";
import { OPTIONAL_TYPES } from "@/features/notifications/notification-text";
import { pushState, turnOffPush, turnOnPush, type PushState } from "@/features/notifications/push";
import type { NotificationSettingsStrings } from "@/features/notifications/strings";
import type { Supabase } from "@/lib/supabase/client";

import { useAccount } from "./use-account";

type Channel = "app" | "push" | "email";
type Row = (typeof OPTIONAL_TYPES)[number] | "announcement" | "digest";

interface Props {
  strings: NotificationSettingsStrings;
  signInPath: string;
  /** The VAPID public key; null in builds without push. */
  vapidKey: string | null;
  email: boolean;
}

/** The channels each row can be turned off in (announcements always show in the app). */
const ALL: readonly Channel[] = ["app", "push", "email"];
const CHANNELS: Record<Row, readonly Channel[]> = {
  friend_request: ALL,
  friend_accepted: ALL,
  invite: ALL,
  message: ALL,
  achievement: ALL,
  rating: ALL,
  daily: ALL,
  announcement: ["push", "email"],
  digest: ["email"],
};

/** The database's defaults (private.notification_on). */
const PUSH_BY_DEFAULT: readonly Row[] = ["friend_request", "friend_accepted", "invite", "message"];

function prefOn(prefs: unknown, row: Row, channel: Channel): boolean {
  const entry =
    typeof prefs === "object" && prefs !== null ? (prefs as Record<string, unknown>)[row] : null;
  const stored =
    typeof entry === "object" && entry !== null
      ? (entry as Record<string, unknown>)[channel]
      : null;
  if (typeof stored === "boolean") return stored;
  return channel === "app" || (channel === "push" && PUSH_BY_DEFAULT.includes(row));
}

const key = (row: Row, channel: Channel) => `${row}:${channel}`;

export function NotificationSettings({ strings: s, signInPath, vapidKey, email }: Props) {
  const account = useAccount(signInPath);
  const [on, setOn] = useState<Record<string, boolean> | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const channels: Channel[] = [
    "app",
    ...(vapidKey ? ["push" as const] : []),
    ...(email ? ["email" as const] : []),
  ];
  const rows: Row[] = [
    ...OPTIONAL_TYPES,
    ...(channels.length > 1 ? ["announcement" as const] : []),
    ...(email ? ["digest" as const] : []),
  ];

  useEffect(() => {
    if (account.status !== "ready") return;
    void account.supabase
      .from("user_settings")
      .select("notification_prefs")
      .eq("user_id", account.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setStatus("failed");
          return;
        }
        const all: Record<string, boolean> = {};
        for (const row of Object.keys(CHANNELS) as Row[]) {
          for (const channel of CHANNELS[row]) {
            all[key(row, channel)] = prefOn(data.notification_prefs, row, channel);
          }
        }
        setOn(all);
      });
  }, [account]);

  if (account.status === "error") return <FormMessage tone="error">{s.saveFailed}</FormMessage>;
  if (!on) {
    return status === "failed" ? (
      <FormMessage tone="error">{s.saveFailed}</FormMessage>
    ) : (
      <div className="min-h-32" aria-busy="true" />
    );
  }
  const { supabase } = account.status === "ready" ? account : { supabase: null };

  function change(row: Row, channel: Channel, value: boolean) {
    if (!supabase) return;
    const k = key(row, channel);
    setOn((current) => (current ? { ...current, [k]: value } : current));
    void supabase
      .rpc("set_notification_pref", { p_type: row, p_channel: channel, p_on: value })
      .then(({ error }) => {
        setStatus(error ? "failed" : "saved");
        // Put the box back if it didn't save.
        if (error) setOn((current) => (current ? { ...current, [k]: !value } : current));
      });
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">{s.hint}</p>
      {vapidKey && supabase && (
        <PushDevice strings={s.push} vapidKey={vapidKey} supabase={supabase} />
      )}
      <table className="w-full border-collapse text-start">
        <caption className="sr-only">{s.hint}</caption>
        <thead>
          <tr className="text-sm text-muted">
            <th scope="col" className="py-2 text-start font-semibold">
              <span className="sr-only">{s.type}</span>
            </th>
            {channels.map((channel) => (
              <th
                key={channel}
                scope="col"
                className="w-16 px-1 py-2 text-center font-semibold sm:w-24"
              >
                {s.channels[channel]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-t border-border">
              <th scope="row" className="py-2 pe-2 text-start font-normal">
                {s.types[row]}
              </th>
              {channels.map((channel) => (
                <td key={channel} className="px-1 py-2 text-center">
                  {CHANNELS[row].includes(channel) ? (
                    <input
                      type="checkbox"
                      aria-label={`${s.types[row]}: ${s.channels[channel]}`}
                      className="size-5 cursor-pointer align-middle accent-brand"
                      checked={on[key(row, channel)] ?? false}
                      onChange={(e) => {
                        change(row, channel, e.currentTarget.checked);
                      }}
                    />
                  ) : row === "announcement" && channel === "app" ? (
                    // Always shown in the app.
                    <input
                      type="checkbox"
                      aria-label={`${s.types[row]}: ${s.channels[channel]}`}
                      className="size-5 align-middle accent-brand"
                      checked
                      disabled
                    />
                  ) : (
                    <span aria-hidden="true" className="text-muted">
                      –
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {email && <p className="text-sm text-muted">{s.emailHint}</p>}
      <p role="status" className="min-h-6 text-sm font-semibold">
        {status === "saved" && <span className="text-success">{s.saved}</span>}
        {status === "failed" && <span className="text-danger">{s.saveFailed}</span>}
      </p>
    </div>
  );
}

/** Push on this device: its state, and the switch. */
function PushDevice({
  strings: s,
  vapidKey,
  supabase,
}: {
  strings: NotificationSettingsStrings["push"];
  vapidKey: string;
  supabase: Supabase;
}) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void pushState(supabase).then(setState);
  }, [supabase]);

  async function toggle() {
    setBusy(true);
    setFailed(false);
    if (state === "on") {
      const done = await turnOffPush(supabase);
      setFailed(!done);
      setState(await pushState(supabase));
    } else {
      const next = await turnOnPush(supabase, vapidKey);
      setFailed(next === "failed");
      setState(next === "failed" ? await pushState(supabase) : next);
    }
    setBusy(false);
  }

  const text =
    state === null
      ? ""
      : state === "on"
        ? s.on
        : state === "off"
          ? s.off
          : state === "denied"
            ? s.denied
            : state === "install"
              ? s.install
              : s.unsupported;
  return (
    <div className="grid gap-2 rounded-xl border border-border p-4">
      <p className="font-semibold">{s.title}</p>
      <p className="text-sm text-muted">{s.hint}</p>
      <p className="min-h-6 text-sm" aria-live="polite">
        {text}
      </p>
      {(state === "on" || state === "off") && (
        <Button
          type="button"
          variant={state === "on" ? "outline" : "primary"}
          className="justify-self-start"
          disabled={busy}
          onClick={() => {
            void toggle();
          }}
        >
          {state === "on" ? s.turnOff : s.turnOn}
        </Button>
      )}
      {failed && <FormMessage tone="error">{s.failed}</FormMessage>}
    </div>
  );
}
