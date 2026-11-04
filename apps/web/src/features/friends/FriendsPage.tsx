// The friends page (SPEC §8.1): add a friend by nickname; friends, requests
// both ways and blocked players in tabs, each with its actions. Removing a
// friend and blocking ask first. Every change goes through the database
// (add_friend, remove_friend, block_user, unblock_user), then the lists are
// read again. Friends show their online status, live. Invite to a game
// picks a game, whose new lobby invites the friend (`?new&invite=<id>`).
import { useCallback, useEffect, useId, useState } from "react";

import { Button, buttonVariants } from "@kefche/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kefche/ui/components/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kefche/ui/components/tabs";

import { FormMessage, TextField } from "@/features/auth/components/fields";
import { fill } from "@/features/games/turn/labels";
import {
  fetchStatuses,
  onPresenceChange,
  presenceText,
  type Status,
} from "@/features/live/presence";
import { LIVE_RESUME_EVENT } from "@/features/live/presence-context";
import { useAccount } from "@/features/settings/use-account";
import type { Supabase } from "@/lib/supabase/client";

import { friendErrorCode, fetchMyFriends, type MyFriends, type PlayerCard } from "./friends-data";
import { PlayerRow } from "./PlayerRow";

import type { FriendsPageStrings } from "./strings";

type Tab = "friends" | "requests" | "blocked";
const TABS: readonly Tab[] = ["friends", "requests", "blocked"];

/** A change that asks first (removing a friend or blocking a player), or the games to invite a friend to. */
type Confirming = { kind: "remove" | "block" | "invite"; player: PlayerCard } | null;

interface Props {
  strings: FriendsPageStrings;
  bcp47: string;
  dir: "ltr" | "rtl";
  signInPath: string;
  /** "/<locale>/u/": a profile is `${profileBase}${nickname}/`. */
  profileBase: string;
  /** Game names by id, in the page's language (online statuses name the game). */
  gameNames: Record<string, string>;
  /** The games with online rooms, and "/<locale>/play/". */
  games: { id: string; name: string }[];
  playBase: string;
}

/** The tab in the address (`?tab=requests`). Tabs only show once the account loads, in the browser. */
function initialTab(): Tab {
  if (typeof location === "undefined") return "friends";
  const asked = new URLSearchParams(location.search).get("tab");
  return TABS.find((tab) => tab === asked) ?? "friends";
}

export function FriendsPage({
  strings: s,
  bcp47,
  dir,
  signInPath,
  profileBase,
  gameNames,
  games,
  playBase,
}: Props) {
  const account = useAccount(signInPath);
  const id = useId();
  const [lists, setLists] = useState<MyFriends | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [nickname, setNickname] = useState("");
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const date = (iso: string) => new Date(iso).toLocaleDateString(bcp47, { dateStyle: "medium" });

  const load = useCallback(async (supabase: Supabase) => {
    setLists(await fetchMyFriends(supabase));
  }, []);

  useEffect(() => {
    if (account.status === "ready") void fetchMyFriends(account.supabase).then(setLists);
  }, [account]);

  // Friends' statuses: read for the list, then kept live; read again when the tab comes back.
  const friendIds = lists?.friends.map((f) => f.id).join(",") ?? "";
  useEffect(() => {
    if (account.status !== "ready" || friendIds === "") return;
    const supabase = account.supabase;
    const read = () => {
      void fetchStatuses(supabase, friendIds.split(",")).then(setStatuses);
    };
    read();
    const stop = onPresenceChange((user, status) => {
      setStatuses((current) => {
        if (status) return { ...current, [user]: status };
        return Object.fromEntries(Object.entries(current).filter(([id]) => id !== user));
      });
    });
    document.addEventListener(LIVE_RESUME_EVENT, read);
    return () => {
      stop();
      document.removeEventListener(LIVE_RESUME_EVENT, read);
    };
  }, [account, friendIds]);

  if (account.status === "error" || lists === null) {
    return (
      <div className="grid justify-items-start gap-3">
        <p role="alert">{s.failed}</p>
        {account.status === "ready" && (
          <Button variant="outline" onClick={() => void load(account.supabase)}>
            {s.retry}
          </Button>
        )}
      </div>
    );
  }
  if (account.status !== "ready" || lists === undefined) {
    return (
      <p className="min-h-32 text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  }
  const { supabase } = account;

  /** Runs a friend action, then reads the lists again; returns false on an error. */
  async function act(run: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
    setBusy(true);
    setNote(null);
    const { error } = await run();
    if (error) setNote({ tone: "error", text: s.errors[friendErrorCode(error)] });
    await load(supabase);
    setBusy(false);
    return !error;
  }

  async function addByNickname() {
    const name = nickname.trim();
    if (name === "" || busy) return;
    setBusy(true);
    setNote(null);
    const { data: found } = await supabase
      .from("profiles")
      .select("id,nickname")
      .eq("nickname", name)
      .maybeSingle();
    if (!found?.nickname) {
      setBusy(false);
      setNote({ tone: "error", text: s.add.notFound });
      return;
    }
    const { data, error } = await supabase.rpc("add_friend", { p_user: found.id });
    if (error) {
      setNote({ tone: "error", text: s.errors[friendErrorCode(error)] });
    } else {
      setNickname("");
      setNote({
        tone: "success",
        text: fill(data === "friends" ? s.add.friends : s.add.requested, { name: found.nickname }),
      });
    }
    await load(supabase);
    setBusy(false);
  }

  const rowProps = { profileBase };
  const statusText = (user: string) => {
    const status = statuses[user];
    return status
      ? { text: presenceText(status, s.presence, gameNames), away: status.status === "away" }
      : null;
  };
  return (
    <div className="grid gap-6">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void addByNickname();
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <TextField
              id={`${id}-nickname`}
              label={s.add.label}
              value={nickname}
              maxLength={20}
              autoComplete="off"
              onChange={(e) => {
                setNickname(e.target.value);
              }}
            />
          </div>
          <Button type="submit" disabled={busy || nickname.trim() === ""}>
            {s.add.submit}
          </Button>
        </div>
        {note && <FormMessage tone={note.tone}>{note.text}</FormMessage>}
      </form>

      <Tabs
        dir={dir}
        value={tab}
        onValueChange={(value) => {
          const next = TABS.find((t) => t === value) ?? "friends";
          setTab(next);
          const url = new URL(location.href);
          if (next === "friends") url.searchParams.delete("tab");
          else url.searchParams.set("tab", next);
          history.replaceState(history.state, "", url);
        }}
      >
        <TabsList>
          <TabsTrigger value="friends">
            {s.tabs.friends} <Count n={lists.friends.length} bcp47={bcp47} />
          </TabsTrigger>
          <TabsTrigger value="requests">
            {s.tabs.requests} <Count n={lists.incoming.length} bcp47={bcp47} />
          </TabsTrigger>
          <TabsTrigger value="blocked">{s.tabs.blocked}</TabsTrigger>
        </TabsList>

        <TabsContent value="friends">
          {lists.friends.length === 0 ? (
            <Empty title={s.empty.friends} hint={s.empty.friendsHint} />
          ) : (
            <ul className="grid gap-2">
              {/* Online friends first, in their own order. */}
              {lists.friends
                .toSorted((a, b) => Number(b.id in statuses) - Number(a.id in statuses))
                .map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    detail={fill(s.list.since, { date: date(p.since) })}
                    status={statusText(p.id)}
                    {...rowProps}
                  >
                    {games.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setConfirming({ kind: "invite", player: p });
                        }}
                      >
                        {s.actions.invite}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setConfirming({ kind: "remove", player: p });
                      }}
                    >
                      {s.actions.remove}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setConfirming({ kind: "block", player: p });
                      }}
                    >
                      {s.actions.block}
                    </Button>
                  </PlayerRow>
                ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {lists.incoming.length + lists.outgoing.length === 0 ? (
            <Empty title={s.empty.requests} />
          ) : (
            <ul className="grid gap-2">
              {lists.incoming.map((p) => (
                <PlayerRow key={p.id} player={p} detail={s.list.incoming} {...rowProps}>
                  <Button
                    disabled={busy}
                    onClick={() => void act(() => supabase.rpc("add_friend", { p_user: p.id }))}
                  >
                    {s.actions.accept}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act(() => supabase.rpc("remove_friend", { p_user: p.id }))}
                  >
                    {s.actions.decline}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setConfirming({ kind: "block", player: p });
                    }}
                  >
                    {s.actions.block}
                  </Button>
                </PlayerRow>
              ))}
              {lists.outgoing.map((p) => (
                <PlayerRow key={p.id} player={p} detail={s.list.outgoing} {...rowProps}>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act(() => supabase.rpc("remove_friend", { p_user: p.id }))}
                  >
                    {s.actions.cancel}
                  </Button>
                </PlayerRow>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="blocked">
          {lists.blocked.length === 0 ? (
            <Empty title={s.empty.blocked} />
          ) : (
            <ul className="grid gap-2">
              {lists.blocked.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  detail={fill(s.list.blockedOn, { date: date(p.at) })}
                  {...rowProps}
                >
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act(() => supabase.rpc("unblock_user", { p_user: p.id }))}
                  >
                    {s.actions.unblock}
                  </Button>
                </PlayerRow>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        {confirming?.kind === "invite" && (
          <DialogContent closeLabel={s.confirm.close}>
            <DialogHeader>
              <DialogTitle>
                {fill(s.invite.title, { name: confirming.player.nickname })}
              </DialogTitle>
              <DialogDescription>
                {fill(s.invite.hint, { name: confirming.player.nickname })}
              </DialogDescription>
            </DialogHeader>
            <ul className="grid gap-2 sm:grid-cols-2">
              {games.map((game) => (
                <li key={game.id}>
                  <a
                    href={`${playBase}${game.id}/?new&invite=${confirming.player.id}`}
                    className={buttonVariants({ variant: "outline", className: "w-full" })}
                  >
                    {game.name}
                  </a>
                </li>
              ))}
            </ul>
          </DialogContent>
        )}
        {confirming && confirming.kind !== "invite" && (
          <DialogContent closeLabel={s.confirm.close}>
            <DialogHeader>
              <DialogTitle>
                {fill(confirming.kind === "remove" ? s.confirm.removeTitle : s.confirm.blockTitle, {
                  name: confirming.player.nickname,
                })}
              </DialogTitle>
              <DialogDescription>
                {confirming.kind === "remove" ? s.confirm.removeBody : s.confirm.blockBody}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming(null);
                }}
              >
                {s.confirm.keep}
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  const { kind, player } = confirming;
                  setConfirming(null);
                  void act(() =>
                    supabase.rpc(kind === "remove" ? "remove_friend" : "block_user", {
                      p_user: player.id,
                    }),
                  );
                }}
              >
                {confirming.kind === "remove" ? s.actions.remove : s.actions.block}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Count({ n, bcp47 }: { n: number; bcp47: string }) {
  if (n === 0) return null;
  return (
    <span className="rounded-full bg-surface-2 px-2 text-sm tabular-nums">
      {n.toLocaleString(bcp47)}
    </span>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}
