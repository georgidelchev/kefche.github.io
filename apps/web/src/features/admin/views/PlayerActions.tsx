// What staff can do from a player's page (Phase 10 step 3): reset the
// nickname, avatar or bio, sanction and revoke, change roles (admins), and
// delete the account for a GDPR request (admins). Each is one audited RPC;
// the panel only offers what the role may do, and the database checks again.
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

import { fill } from "@/features/auth/strings";
import type { Supabase } from "@/lib/supabase/client";

import { selectClass } from "./ui";

import type { Player, Sanction } from "./players-data";
import type { StaffRole } from "../sections";
import type { PlayersStrings } from "../strings";

type Field = "nickname" | "avatar" | "bio";

/** An action waiting for the staff member's confirmation. */
export type ActionRequest =
  | { type: "reset"; field: Field }
  | { type: "sanction" }
  | { type: "revoke"; sanction: Sanction }
  | { type: "role"; role: StaffRole; granted: boolean }
  | { type: "delete" }
  | { type: "undelete" };

/** What the staff member may do to this player (the database decides again). */
export function permissions(player: Player, userId: string, roles: readonly StaffRole[]) {
  const admin = roles.includes("admin");
  const self = player.id === userId;
  const staff = player.roles.length > 0;
  const over = admin || !staff;
  return {
    admin,
    reset: over,
    sanction: over && !self,
    /** Moderators revoke what they could give: no bans, nothing on staff. */
    revoke: (s: Sanction) => admin || (s.kind !== "ban" && !staff),
    roles: admin && !player.guest,
    delete: admin && !self && !staff,
  };
}

const SANCTION_KINDS = ["warn", "mute", "suspend", "ban"] as const;
const SANCTION_REASONS = ["spam", "harassment", "hate", "sexual", "self-harm", "cheating", "other"];
/** Lengths offered, in minutes; null: until revoked. */
const DURATIONS = [
  ["h1", 60],
  ["h24", 1440],
  ["d7", 10080],
  ["d30", 43200],
  ["none", null],
] as const;

/** A sanction as the dialog's form gives it. */
export interface SanctionInput {
  kind: string;
  reason: string;
  minutes: number | null;
  note: string;
}

/** The sanction_player arguments for the form's sanction, linked to a report when given. */
export const sanctionArgs = (userId: string, input: SanctionInput, report?: string) => ({
  p_user: userId,
  p_kind: input.kind,
  p_reason: input.reason,
  ...(input.kind !== "warn" && input.minutes !== null && { p_minutes: input.minutes }),
  ...(input.note.trim() !== "" && { p_note: input.note.trim() }),
  ...(report !== undefined && { p_report: report }),
});

/** The error's message for the staff member. */
export function errorText(code: string, s: PlayersStrings["act"]): string {
  if (code === "admin_only") return s.errors.adminOnly;
  if (code === "rate_limited") return s.errors.rateLimited;
  if (code === "nothing_to_reset") return s.errors.nothing;
  if (code === "staff_account") return s.errors.staffAccount;
  if (code === "cannot remove the last admin") return s.errors.lastAdmin;
  return s.errors.failed;
}

/** Runs the confirmed action: null when done, else the error to show. */
export async function performAction(
  supabase: Supabase,
  player: Player,
  request: ActionRequest,
  sanction: SanctionInput,
  s: PlayersStrings["act"],
): Promise<string | null> {
  const { error } =
    request.type === "reset"
      ? await supabase.rpc("staff_reset_profile", { p_user: player.id, p_field: request.field })
      : request.type === "sanction"
        ? await supabase.rpc("sanction_player", sanctionArgs(player.id, sanction))
        : request.type === "revoke"
          ? await supabase.rpc("revoke_sanction", { p_sanction: request.sanction.id })
          : request.type === "role"
            ? await supabase.rpc("set_user_role", {
                p_user_id: player.id,
                p_role: request.role,
                p_granted: request.granted,
              })
            : request.type === "delete"
              ? await supabase.rpc("staff_delete_account", { p_user: player.id })
              : await supabase.rpc("staff_cancel_deletion", { p_user: player.id });
  return error ? errorText(error.message, s) : null;
}

/** The buttons, by kind of action, with the last outcome. */
export function ActionsPanel({
  player,
  userId,
  roles,
  strings: s,
  outcome,
  onRequest,
}: {
  player: Player;
  userId: string;
  roles: readonly StaffRole[];
  strings: PlayersStrings;
  outcome: { ok: boolean; text: string } | null;
  onRequest: (request: ActionRequest) => void;
}) {
  const a = s.act;
  const can = permissions(player, userId, roles);
  const has = (role: StaffRole) => player.roles.includes(role);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {can.sanction && (
          <Button
            variant="danger"
            onClick={() => {
              onRequest({ type: "sanction" });
            }}
          >
            {a.sanction}
          </Button>
        )}
        {can.reset &&
          (
            [
              ["nickname", a.resetNickname, player.nickname !== null],
              ["avatar", a.resetAvatar, player.avatarKind !== "initials"],
              ["bio", a.resetBio, player.bio !== null],
            ] as const
          ).map(([field, label, possible]) => (
            <Button
              key={field}
              variant="outline"
              disabled={!possible}
              onClick={() => {
                onRequest({ type: "reset", field });
              }}
            >
              {label}
            </Button>
          ))}
        {can.roles &&
          (["moderator", "admin"] as const).map((role) => (
            <Button
              key={role}
              variant="outline"
              onClick={() => {
                onRequest({ type: "role", role, granted: !has(role) });
              }}
            >
              {roleLabel(role, !has(role), a)}
            </Button>
          ))}
        {can.delete &&
          (player.deletionAt === null ? (
            <Button
              variant="danger"
              onClick={() => {
                onRequest({ type: "delete" });
              }}
            >
              {a.deleteAccount}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                onRequest({ type: "undelete" });
              }}
            >
              {a.cancelDeletion}
            </Button>
          ))}
      </div>
      {/* Always in the page, so screen readers hear each outcome. */}
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted"}
      >
        {outcome?.text ?? ""}
      </p>
    </div>
  );
}

/** "Make moderator", "Remove admin"… */
function roleLabel(role: StaffRole, granted: boolean, a: PlayersStrings["act"]): string {
  if (role === "moderator") return granted ? a.makeModerator : a.removeModerator;
  return granted ? a.makeAdmin : a.removeAdmin;
}

/** Confirms the requested action (with the sanction's form), then runs it. */
export function ActionDialog({
  request,
  name,
  admin,
  strings: s,
  reason: initialReason = "spam",
  sanctionBody,
  onClose,
  onConfirm,
}: {
  request: ActionRequest | null;
  /** The player's nickname, or what stands for it. */
  name: string;
  admin: boolean;
  strings: PlayersStrings;
  /** The sanction's reason to start with. */
  reason?: string;
  /** What the sanction dialog says, when not the usual. */
  sanctionBody?: string;
  onClose: () => void;
  onConfirm: (sanction: SanctionInput) => Promise<void>;
}) {
  const id = useId();
  const a = s.act;
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<string>("warn");
  const [reason, setReason] = useState<string>(
    SANCTION_REASONS.includes(initialReason) ? initialReason : "spam",
  );
  const [minutes, setMinutes] = useState<number | null>(1440);
  const [note, setNote] = useState("");

  if (request === null) return null;
  const text: { title: string; body: string; confirm: string; danger: boolean } =
    request.type === "reset"
      ? request.field === "nickname"
        ? {
            title: fill(a.resetNicknameTitle, { name }),
            body: a.resetNicknameBody,
            confirm: a.resetNickname,
            danger: false,
          }
        : request.field === "avatar"
          ? {
              title: fill(a.resetAvatarTitle, { name }),
              body: a.resetAvatarBody,
              confirm: a.resetAvatar,
              danger: false,
            }
          : {
              title: fill(a.resetBioTitle, { name }),
              body: a.resetBioBody,
              confirm: a.resetBio,
              danger: false,
            }
      : request.type === "sanction"
        ? {
            title: fill(a.sanctionTitle, { name }),
            body: sanctionBody ?? a.sanctionBody,
            confirm: a.give,
            danger: true,
          }
        : request.type === "revoke"
          ? {
              title: a.revokeTitle,
              body: s.kinds[request.sanction.kind] ?? request.sanction.kind,
              confirm: a.revoke,
              danger: false,
            }
          : request.type === "role"
            ? {
                title: roleLabel(request.role, request.granted, a),
                body: fill(a.roleBody, { name }),
                confirm: roleLabel(request.role, request.granted, a),
                danger: false,
              }
            : request.type === "delete"
              ? {
                  title: fill(a.deleteTitle, { name }),
                  body: a.deleteBody,
                  confirm: a.deleteAccount,
                  danger: true,
                }
              : {
                  title: a.cancelDeletion,
                  body: fill(a.cancelDeletionBody, { name }),
                  confirm: a.cancelDeletion,
                  danger: false,
                };

  const kinds = SANCTION_KINDS.filter((k) => k !== "ban" || admin);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent closeLabel={a.close}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void onConfirm({ kind, reason, minutes, note }).finally(() => {
              setBusy(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{text.title}</DialogTitle>
            <DialogDescription>{text.body}</DialogDescription>
          </DialogHeader>
          {request.type === "sanction" && (
            <div className="grid gap-3">
              <label htmlFor={`${id}-kind`} className="grid gap-1.5 font-semibold">
                {a.kind}
                <select
                  id={`${id}-kind`}
                  className={selectClass}
                  value={kind}
                  onChange={(e) => {
                    setKind(e.currentTarget.value);
                  }}
                >
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {s.kinds[k]}
                    </option>
                  ))}
                </select>
              </label>
              {kind !== "warn" && (
                <label htmlFor={`${id}-duration`} className="grid gap-1.5 font-semibold">
                  {a.duration}
                  <select
                    id={`${id}-duration`}
                    className={selectClass}
                    value={minutes ?? ""}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setMinutes(value === "" ? null : Number(value));
                    }}
                  >
                    {DURATIONS.map(([key, value]) => (
                      <option key={key} value={value ?? ""}>
                        {a.durations[key]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label htmlFor={`${id}-reason`} className="grid gap-1.5 font-semibold">
                {s.reason}
                <select
                  id={`${id}-reason`}
                  className={selectClass}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.currentTarget.value);
                  }}
                >
                  {SANCTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {s.reasons[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={`${id}-note`} className="grid gap-1.5 font-semibold">
                {a.note}
                <textarea
                  id={`${id}-note`}
                  rows={3}
                  maxLength={500}
                  value={note}
                  aria-describedby={`${id}-note-hint`}
                  onChange={(e) => {
                    setNote(e.currentTarget.value);
                  }}
                  className="w-full min-w-0 rounded-xl border border-border-strong bg-surface-2 px-3 py-2 text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
                <span id={`${id}-note-hint`} className="text-sm font-normal text-muted">
                  {a.noteHint}
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {a.cancel}
            </Button>
            <Button type="submit" variant={text.danger ? "danger" : "primary"} disabled={busy}>
              {text.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
