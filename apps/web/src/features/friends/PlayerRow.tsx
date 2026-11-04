import { UserAvatar } from "@kefche/ui/components/avatar";
import { isAvatarFrame } from "@kefche/ui/lib/frames";

import { avatarUrl } from "@/features/account/avatar-url";
import { supabaseConfig } from "@/lib/supabase/config";

import type { PlayerCard } from "./friends-data";
import type { ReactNode } from "react";

interface Props {
  player: PlayerCard;
  detail?: string;
  /** Links the nickname to their profile; without it (in a lobby, which a link would leave) it's plain text. */
  profileBase?: string;
  /** Their online status ("Playing Chess"), when the viewer may see it and they're online. */
  status?: { text: string; away: boolean } | null;
  /** The row's actions. */
  children: ReactNode;
}

/** A player in a list: avatar, nickname (to their profile), a line about them, and actions. */
export function PlayerRow({ player, detail, profileBase, status, children }: Props) {
  const image = supabaseConfig
    ? avatarUrl(
        {
          avatar_kind: player.avatarKind,
          avatar_preset: player.avatarPreset,
          avatar_path: player.avatarPath,
        },
        supabaseConfig.url,
      )
    : null;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <UserAvatar
        name={player.nickname}
        id={player.id}
        {...(image ? { src: image } : {})}
        frame={isAvatarFrame(player.avatarFrame) ? player.avatarFrame : null}
      />
      <span className="grid min-w-0 flex-1 basis-40">
        {profileBase === undefined ? (
          <span className="truncate font-semibold">{player.nickname}</span>
        ) : (
          <a
            href={`${profileBase}${encodeURIComponent(player.nickname)}/`}
            className="truncate font-semibold hover:underline"
          >
            {player.nickname}
          </a>
        )}
        {status && (
          <span
            className={`flex min-w-0 items-center gap-1.5 text-sm font-semibold ${status.away ? "text-muted" : "text-success"}`}
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${status.away ? "bg-warning" : "bg-success"}`}
            />
            <span className="truncate">{status.text}</span>
          </span>
        )}
        {detail !== undefined && <span className="truncate text-sm text-muted">{detail}</span>}
      </span>
      <span className="flex flex-wrap gap-2">{children}</span>
    </li>
  );
}
