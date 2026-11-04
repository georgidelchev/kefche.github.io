// Which notifications show (Phase 8 step 6): each type a player can turn off
// in the app, saved on its own through set_notification_pref. Notices about
// the account always show. Push and email join these in step 12.
import { useEffect, useState } from "react";

import { FormMessage } from "@/features/auth/components/fields";
import { OPTIONAL_TYPES, type OptionalType } from "@/features/notifications/notifications-data";
import type { NotificationSettingsStrings } from "@/features/notifications/strings";

import { useAccount } from "./use-account";

interface Props {
  strings: NotificationSettingsStrings;
  signInPath: string;
}

/** On unless turned off: the stored preference is `{"<type>": {"app": false}}`. */
function appOn(prefs: unknown, type: OptionalType): boolean {
  if (typeof prefs !== "object" || prefs === null) return true;
  const entry = (prefs as Record<string, unknown>)[type];
  return !(
    typeof entry === "object" &&
    entry !== null &&
    (entry as { app?: unknown }).app === false
  );
}

export function NotificationSettings({ strings: s, signInPath }: Props) {
  const account = useAccount(signInPath);
  const [on, setOn] = useState<Record<OptionalType, boolean> | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

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
        setOn(
          Object.fromEntries(
            OPTIONAL_TYPES.map((type) => [type, appOn(data.notification_prefs, type)]),
          ) as Record<OptionalType, boolean>,
        );
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

  function change(type: OptionalType, value: boolean) {
    if (!supabase) return;
    setOn((current) => (current ? { ...current, [type]: value } : current));
    void supabase
      .rpc("set_notification_pref", { p_type: type, p_channel: "app", p_on: value })
      .then(({ error }) => {
        setStatus(error ? "failed" : "saved");
        // Put the box back if it didn't save.
        if (error) setOn((current) => (current ? { ...current, [type]: !value } : current));
      });
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">{s.hint}</p>
      <div className="grid gap-1">
        {OPTIONAL_TYPES.map((type) => (
          <label key={type} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 cursor-pointer accent-brand"
              checked={on[type]}
              onChange={(e) => {
                change(type, e.currentTarget.checked);
              }}
            />
            {s.types[type]}
          </label>
        ))}
      </div>
      <p role="status" className="min-h-6 text-sm font-semibold">
        {status === "saved" && <span className="text-success">{s.saved}</span>}
        {status === "failed" && <span className="text-danger">{s.saveFailed}</span>}
      </p>
    </div>
  );
}
