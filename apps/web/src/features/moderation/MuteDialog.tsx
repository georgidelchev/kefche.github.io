// A moderator mutes a player from a chat (sanction_player): a length and a
// reason, which the player's notice shows.
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

import type { MuteStrings } from "./strings";

/** Mute lengths offered to moderators, in minutes. */
const MUTES = [
  ["m10", 10],
  ["h1", 60],
  ["h24", 1440],
  ["d7", 10080],
] as const;
const MUTE_REASONS = ["spam", "harassment", "hate", "sexual", "self-harm", "other"] as const;

/** Mutes `player`; resolves with the notice to show, or null when it failed. */
export async function mutePlayer(
  supabase: Supabase,
  player: { id: string; nickname: string },
  minutes: number,
  reason: string,
  s: MuteStrings,
): Promise<string | null> {
  const { error } = await supabase.rpc("sanction_player", {
    p_user: player.id,
    p_kind: "mute",
    p_reason: reason,
    p_minutes: minutes,
  });
  return error ? null : fill(s.muted, { name: player.nickname });
}

export function MuteDialog({
  player,
  strings: s,
  onClose,
  onMute,
}: {
  player: { id: string; nickname: string } | null;
  strings: MuteStrings;
  onClose: () => void;
  onMute: (minutes: number, reason: string) => void;
}) {
  const id = useId();
  const [minutes, setMinutes] = useState<number>(MUTES[0][1]);
  const [reason, setReason] = useState<string>(MUTE_REASONS[0]);
  const select =
    "min-h-11 w-full cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text";
  return (
    <Dialog
      open={player !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {player && (
        <DialogContent closeLabel={s.close}>
          <DialogHeader>
            <DialogTitle>{fill(s.muteTitle, { name: player.nickname })}</DialogTitle>
            <DialogDescription className="sr-only">
              {fill(s.mute, { name: player.nickname })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label htmlFor={`${id}-minutes`} className="grid gap-1.5 font-semibold">
              {s.duration}
              <select
                id={`${id}-minutes`}
                className={select}
                value={minutes}
                onChange={(e) => {
                  setMinutes(Number(e.currentTarget.value));
                }}
              >
                {MUTES.map(([key, value]) => (
                  <option key={key} value={value}>
                    {s.durations[key]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-reason`} className="grid gap-1.5 font-semibold">
              {s.reason}
              <select
                id={`${id}-reason`}
                className={select}
                value={reason}
                onChange={(e) => {
                  setReason(e.currentTarget.value);
                }}
              >
                {MUTE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {s.reasons[r === "self-harm" ? "selfHarm" : r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {s.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onMute(minutes, reason);
              }}
            >
              {s.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
