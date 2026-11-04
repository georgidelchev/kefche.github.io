// Inviting friends to the lobby (SPEC §8.1, Phase 8 step 5), for members
// with an account. The list loads when it's opened: friends not already in
// the room, online ones first, each with Invite. A lobby opened from the
// friends page or a profile (`?new&invite=<id>`) invites that player once
// (useInviteOnOpen, in the room, so a rematch's lobby doesn't invite again)
// and opens the list.
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@kefche/ui/components/button";

import { fetchMyFriends, type MyFriends } from "@/features/friends/friends-data";
import { PlayerRow } from "@/features/friends/PlayerRow";
import { fill } from "@/features/games/turn/labels";
import {
  fetchStatuses,
  onPresenceChange,
  presenceText,
  type Status,
} from "@/features/live/presence";
import type { Supabase } from "@/lib/supabase/client";

import { sendInvite, type InviteErrorCode } from "./invites";

import type { InviteStrings } from "./strings";

type Result = "sending" | "sent" | InviteErrorCode;

/** An invite and how it went; `nickname` is empty if it couldn't be read. */
export interface Invited {
  id: string;
  nickname: string;
  result: Result;
}

/**
 * Invites the player from the address once, when the room opens. They may
 * not be a friend, so their nickname comes from their profile.
 */
export function useInviteOnOpen(
  supabase: Supabase,
  roomId: string,
  invitee: string | null,
): Invited | null {
  const [invited, setInvited] = useState<Invited | null>(() =>
    invitee ? { id: invitee, nickname: "", result: "sending" } : null,
  );
  useEffect(() => {
    if (invitee) void inviteWithName(supabase, roomId, invitee).then(setInvited);
  }, [supabase, roomId, invitee]);
  return invited;
}

async function inviteWithName(
  supabase: Supabase,
  roomId: string,
  userId: string,
): Promise<Invited> {
  const { data } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .maybeSingle();
  const error = await sendInvite(supabase, roomId, userId);
  return { id: userId, nickname: data?.nickname ?? "", result: error ?? "sent" };
}

interface Props {
  supabase: Supabase;
  roomId: string;
  /** Players in the room, who aren't listed. */
  members: ReadonlySet<string>;
  /** The invite from the address (useInviteOnOpen). */
  first: Invited | null;
  /** Game names by id, in the page's language (online statuses name the game). */
  gameNames: Record<string, string>;
  strings: InviteStrings;
}

export function InviteFriends({ supabase, roomId, members, first, gameNames, strings: s }: Props) {
  const id = useId();
  const [open, setOpen] = useState(first !== null);
  const [friends, setFriends] = useState<MyFriends["friends"] | null | undefined>(undefined);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  // Who was last invited from the list, for the announcement.
  const [last, setLast] = useState<{ id: string; nickname: string } | null>(null);
  const resultOf = (userId: string): Result | undefined =>
    results[userId] ?? (first?.id === userId ? first.result : undefined);

  async function invite(userId: string, nickname: string) {
    setResults((current) => ({ ...current, [userId]: "sending" }));
    const error = await sendInvite(supabase, roomId, userId);
    setResults((current) => ({ ...current, [userId]: error ?? "sent" }));
    if (!error) setLast({ id: userId, nickname });
  }

  useEffect(() => {
    if (!open || friends !== undefined) return;
    void fetchMyFriends(supabase).then((lists) => {
      setFriends(lists?.friends ?? null);
    });
  }, [open, friends, supabase]);

  // Friends' statuses, live while the list is open.
  const friendIds = friends?.map((f) => f.id).join(",") ?? "";
  useEffect(() => {
    if (!open || friendIds === "") return;
    void fetchStatuses(supabase, friendIds.split(",")).then(setStatuses);
    return onPresenceChange((user, status) => {
      setStatuses((current) => {
        if (status) return { ...current, [user]: status };
        return Object.fromEntries(Object.entries(current).filter(([key]) => key !== user));
      });
    });
  }, [open, friendIds, supabase]);

  const listed = (friends ?? []).filter((f) => !members.has(f.id));
  const failure = (result: Result | undefined): InviteErrorCode | null =>
    result === undefined || result === "sending" || result === "sent" ? null : result;
  const announced = last ?? first;
  const firstError = first ? failure(resultOf(first.id)) : null;
  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
      <Button
        variant="outline"
        className="justify-self-start"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {s.title}
        <ChevronDown
          aria-hidden="true"
          className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </Button>
      <p role="status" className="text-sm font-semibold text-success empty:hidden">
        {announced && resultOf(announced.id) === "sent" && announced.nickname !== ""
          ? fill(s.sentTo, { name: announced.nickname })
          : ""}
      </p>
      {firstError && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {s.errors[firstError]}
        </p>
      )}
      <div id={`${id}-list`} hidden={!open}>
        {friends === undefined ? (
          <p className="text-sm text-muted" aria-busy="true">
            {s.loading}
          </p>
        ) : friends === null ? (
          <p role="alert" className="text-sm text-danger">
            {s.failed}
          </p>
        ) : listed.length === 0 ? (
          <p className="text-sm text-muted">{s.empty}</p>
        ) : (
          <ul className="grid gap-2">
            {/* Online friends first, in their own order (by nickname). */}
            {listed
              .toSorted((a, b) => Number(b.id in statuses) - Number(a.id in statuses))
              .map((friend) => {
                const status = statuses[friend.id];
                const result = resultOf(friend.id);
                const failed = failure(result);
                return (
                  <PlayerRow
                    key={friend.id}
                    player={friend}
                    status={
                      status
                        ? {
                            text: presenceText(status, s.presence, gameNames),
                            away: status.status === "away",
                          }
                        : null
                    }
                    {...(failed ? { detail: s.errors[failed] } : {})}
                  >
                    <Button
                      variant={result === "sent" ? "ghost" : "outline"}
                      disabled={result === "sending" || result === "sent"}
                      onClick={() => void invite(friend.id, friend.nickname)}
                    >
                      {result === "sent" ? s.sent : s.send}
                    </Button>
                  </PlayerRow>
                );
              })}
          </ul>
        )}
      </div>
    </section>
  );
}
