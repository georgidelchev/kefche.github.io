// Reporting from a chat (SPEC §8.3): the reason, optional details for the
// moderator, and the outcome in place. The profile has its own plain-script
// dialog (ProfileActions.astro) with the same strings.
import { useId, useState } from "react";

import { Button } from "@kefche/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kefche/ui/components/dialog";

import { fill } from "@/features/games/turn/labels";
import type { Supabase } from "@/lib/supabase/client";

import {
  DETAILS_MAX,
  REASON_KEYS,
  REPORT_REASONS,
  sendReport,
  type ReportOutcome,
  type ReportReason,
  type ReportType,
} from "./report";

import type { ReportStrings } from "./strings";

/** What's being reported, and whose it is. */
export interface ReportTarget {
  type: ReportType;
  id: string;
  name: string;
}

export function ReportDialog({
  target,
  supabase,
  strings: s,
  guidelinesPath,
  onClose,
}: {
  target: ReportTarget | null;
  supabase: Supabase;
  strings: ReportStrings;
  guidelinesPath: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <DialogContent closeLabel={s.close}>
          {/* A new form for each target, so nothing carries over. */}
          <ReportForm
            key={`${target.type}:${target.id}`}
            target={target}
            supabase={supabase}
            strings={s}
            guidelinesPath={guidelinesPath}
            onClose={onClose}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ReportForm({
  target,
  supabase,
  strings: s,
  guidelinesPath,
  onClose,
}: {
  target: ReportTarget;
  supabase: Supabase;
  strings: ReportStrings;
  guidelinesPath: string;
  onClose: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);
  const done = outcome === "sent" || outcome === "already" || outcome === "gone";
  const title = fill(target.type === "user" ? s.titlePlayer : s.titleMessage, {
    name: target.name,
  });

  async function submit() {
    setSending(true);
    setOutcome(
      await sendReport(supabase, { type: target.type, target: target.id, reason, details }),
    );
    setSending(false);
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!done) void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{s.hint}</DialogDescription>
      </DialogHeader>
      {done ? (
        <p role="status" className="font-semibold">
          {s.outcomes[outcome]}
        </p>
      ) : (
        <div className="grid gap-3">
          <label htmlFor={`${id}-reason`} className="grid gap-1.5 font-semibold">
            {s.reason}
            <select
              id={`${id}-reason`}
              value={reason}
              onChange={(e) => {
                setReason(e.currentTarget.value as ReportReason);
              }}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base font-normal text-text"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {s.reasons[REASON_KEYS[r]]}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-details`} className="grid gap-1.5 font-semibold">
            {s.details}
            <textarea
              id={`${id}-details`}
              rows={3}
              maxLength={DETAILS_MAX}
              value={details}
              onChange={(e) => {
                setDetails(e.currentTarget.value);
              }}
              className="w-full rounded-xl border border-border-strong bg-surface-2 p-3 text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
          </label>
          <a
            href={guidelinesPath}
            target="_blank"
            rel="noopener"
            className="justify-self-start text-sm font-semibold text-link underline-offset-4 hover:underline"
          >
            {s.guidelines}
          </a>
          <p role="alert" className="text-sm font-semibold text-danger empty:hidden">
            {outcome ? s.outcomes[outcome] : ""}
          </p>
        </div>
      )}
      <DialogFooter>
        {done ? (
          <Button type="button" onClick={onClose}>
            {s.close}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              {s.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={sending}>
              {s.submit}
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}
