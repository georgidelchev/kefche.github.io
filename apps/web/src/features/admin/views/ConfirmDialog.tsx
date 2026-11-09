// A confirmation for one admin action: its title and what it does, Cancel,
// and a button naming the action. It stays open while the action runs.
import { useState } from "react";

import { Button } from "@kefche/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kefche/ui/components/dialog";

import type { PlayersStrings } from "../strings";

export function ConfirmDialog({
  title,
  body,
  confirm,
  danger,
  strings: a,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirm: string;
  danger: boolean;
  strings: Pick<PlayersStrings["act"], "cancel" | "close">;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent closeLabel={a.close}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {a.cancel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onConfirm().finally(() => {
                setBusy(false);
              });
            }}
          >
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
