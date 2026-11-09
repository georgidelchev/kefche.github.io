// Feature flags (SPEC §14, Phase 10 step 10, Q3), for admins: each feature
// on or off without a deploy, enforced by the database (and the arena and
// giphy servers), hidden in pages too. A feature this build leaves out
// (its build variable) says so: the flag can't turn it on.
import { useEffect, useState } from "react";
import * as z from "zod/mini";

import { Badge } from "@kefche/ui/components/badge";
import { Button } from "@kefche/ui/components/button";

import { fill } from "@/features/auth/strings";
import { FLAG_KEYS, type FlagKey } from "@/features/flags/flags";
import type { Supabase } from "@/lib/supabase/client";

import { ConfirmDialog } from "./ConfirmDialog";
import { errorText } from "./PlayerActions";

import type { FlagsStrings, PlayersStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: FlagsStrings; players: PlayersStrings };

const Rows = z.array(z.object({ key: z.string(), enabled: z.boolean() }));

async function fetchFlags(supabase: Supabase): Promise<Map<string, boolean> | null> {
  const { data, error } = await supabase.from("feature_flags").select("key, enabled");
  if (error) return null;
  const rows = Rows.safeParse(data);
  return rows.success ? new Map(rows.data.map((r) => [r.key, r.enabled])) : null;
}

export function FlagsAdmin({ supabase, strings: s, players }: Props) {
  const [flags, setFlags] = useState<Map<string, boolean> | null | "failed">(null);
  const [pending, setPending] = useState<{ key: FlagKey; enabled: boolean } | null>(null);
  const [opened, setOpened] = useState(0);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void fetchFlags(supabase).then((next) => {
      setFlags(next ?? "failed");
    });
  }, [supabase]);

  async function save(key: FlagKey, enabled: boolean) {
    const { error } = await supabase.rpc("staff_set_flag", { p_key: key, p_enabled: enabled });
    setFlags((await fetchFlags(supabase)) ?? "failed");
    setPending(null);
    setOutcome(
      error === null
        ? { ok: true, text: fill(enabled ? s.nowOn : s.nowOff, { name: s.names[key] }) }
        : { ok: false, text: errorText(error.message, players.act) },
    );
  }

  return (
    <div className="grid gap-4">
      <p className="max-w-prose text-muted">{s.body}</p>
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted empty:hidden"}
      >
        {outcome?.text ?? ""}
      </p>
      {flags === null && (
        <p className="text-muted" aria-busy="true">
          {s.loading}
        </p>
      )}
      {flags === "failed" && <p role="alert">{s.failed}</p>}
      {flags instanceof Map && (
        <ul className="grid gap-3 md:grid-cols-2">
          {FLAG_KEYS.map((key) => {
            const enabled = flags.get(key) ?? true;
            const buildOff = s.buildOff.includes(key);
            return (
              <li
                key={key}
                className="grid content-start gap-2 rounded-2xl border border-border bg-surface p-4"
              >
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-lg font-semibold">{s.names[key]}</span>
                  <Badge variant={enabled ? "neutral" : "accent"}>{enabled ? s.on : s.off}</Badge>
                </p>
                <p className="text-sm text-muted">{s.hints[key]}</p>
                {buildOff && <p className="text-sm font-semibold">{s.buildOffNote}</p>}
                <div>
                  <Button
                    variant={enabled ? "danger" : "primary"}
                    onClick={() => {
                      setOutcome(null);
                      setOpened((n) => n + 1);
                      setPending({ key, enabled: !enabled });
                    }}
                  >
                    {fill(enabled ? s.turnOff : s.turnOn, { name: s.names[key] })}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pending !== null && (
        <ConfirmDialog
          key={opened}
          title={fill(pending.enabled ? s.turnOnTitle : s.turnOffTitle, {
            name: s.names[pending.key],
          })}
          body={pending.enabled ? s.onBody : s.offBody}
          confirm={fill(pending.enabled ? s.turnOn : s.turnOff, { name: s.names[pending.key] })}
          danger={!pending.enabled}
          strings={players.act}
          onClose={() => {
            setPending(null);
          }}
          onConfirm={() => save(pending.key, pending.enabled)}
        />
      )}
    </div>
  );
}
