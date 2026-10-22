import { useEffect, useState } from "react";

import { Button } from "@kefche/ui/components/button";

import { signOut } from "@/features/account/account-state";
import { FormMessage } from "@/features/auth/components/fields";
import { fill } from "@/features/auth/strings";
import { nullable } from "@/lib/supabase/client";

import { useAccount } from "./use-account";

import type { SettingsStrings } from "./strings";

interface Props {
  strings: SettingsStrings;
  bcp47: string;
  signInPath: string;
  homePath: string;
}

/** Data rights (SPEC §17): download everything, or delete the account after 7 days. */
export function DataSettings({ strings, bcp47, signInPath, homePath }: Props) {
  const account = useAccount(signInPath);
  const [deletionDate, setDeletionDate] = useState<string | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = strings.data;

  useEffect(() => {
    if (account.status !== "ready") return;
    void account.supabase.rpc("account_deletion_date").then(({ data }) => {
      setDeletionDate(nullable(data));
    });
  }, [account]);

  if (account.status !== "ready" || deletionDate === undefined) {
    return <div className="min-h-32" aria-busy="true" />;
  }
  const { supabase } = account;

  async function download() {
    setBusy(true);
    setError(null);
    const result = await supabase.functions.invoke<unknown>("export-data");
    setBusy(false);
    if (result.error !== null || result.data === null) {
      setError(d.downloadFailed);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "kefche-data.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function requestDeletion() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("request_account_deletion");
    if (rpcError) {
      setBusy(false);
      setError(strings.saveFailed);
      return;
    }
    // Signing in again within 7 days is how a change of mind starts.
    await signOut(supabase, "global");
    location.assign(homePath);
  }

  async function cancelDeletion() {
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("cancel_account_deletion");
    setBusy(false);
    if (rpcError) setError(strings.saveFailed);
    else setDeletionDate(null);
  }

  const date = deletionDate
    ? new Date(deletionDate).toLocaleDateString(bcp47, { dateStyle: "long" })
    : "";
  return (
    <div className="grid gap-6">
      <div className="grid justify-items-start gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void download()}>
          {d.download}
        </Button>
        <p className="text-sm text-muted">{d.downloadHint}</p>
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {deletionDate ? (
        <div className="grid justify-items-start gap-3 rounded-xl border border-danger p-4">
          <p className="font-semibold">{fill(d.pending, { date })}</p>
          <Button type="button" disabled={busy} onClick={() => void cancelDeletion()}>
            {d.cancel}
          </Button>
        </div>
      ) : confirming ? (
        <div className="grid justify-items-start gap-3 rounded-xl border border-danger p-4">
          <p>{d.deleteWarning}</p>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 cursor-pointer accent-brand"
              checked={understood}
              onChange={(e) => {
                setUnderstood(e.currentTarget.checked);
              }}
            />
            {d.deleteConfirm}
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="danger"
              disabled={!understood || busy}
              onClick={() => void requestDeletion()}
            >
              {d.delete}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setUnderstood(false);
              }}
            >
              {d.keep}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="justify-self-start border-danger text-danger"
          onClick={() => {
            setConfirming(true);
          }}
        >
          {d.delete}
        </Button>
      )}
    </div>
  );
}
