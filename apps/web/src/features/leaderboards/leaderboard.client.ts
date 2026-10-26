// Fills in every leaderboard on the page (LeaderboardView.astro): the chosen
// board's top for all time or this week, from the `leaderboard` RPC, with
// the viewer's own place even below the top. A signed-in viewer asks with
// their session, so the server knows which place is theirs; anyone else
// asks with the publishable key alone, without loading supabase-js.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { formatDuration } from "@kefche/game-sdk/browser";
import { initialsFor, paletteIndexFor } from "@kefche/ui/lib/avatar";

import { avatarUrl } from "@/features/account/avatar-url";
import { fill } from "@/features/games/turn/labels";
import { getSupabase, hasStoredSession } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

const stringsSchema = z.object({
  you: z.string(),
  yourPlace: z.string(),
  empty: z.string(),
  hidden: z.string(),
  loading: z.string(),
  failed: z.string(),
  retry: z.string(),
  friendsSoon: z.string(),
  weekEnds: z.string(),
  xpValue: z.string(),
});

const rowSchema = z.object({
  rank: z.int(),
  userId: z.string(),
  nickname: z.string(),
  avatarKind: z.string(),
  avatarPreset: z.nullable(z.string()),
  avatarPath: z.nullable(z.string()),
  value: z.number(),
});
const boardSchema = z.object({
  entries: z.array(rowSchema),
  me: z.nullable(rowSchema),
  hidden: z.boolean(),
  total: z.int(),
});
type Row = z.infer<typeof rowSchema>;
type Board = z.infer<typeof boardSchema>;
type Period = "all" | "week" | "friends";

async function fetchBoard(board: string, period: "all" | "week", limit: number) {
  const args = { p_board: board, p_period: period, p_limit: limit };
  if (hasStoredSession()) {
    const supabase = await getSupabase();
    const reply = await supabase?.rpc("leaderboard", args);
    return reply && !reply.error ? boardSchema.safeParse(reply.data) : null;
  }
  if (!supabaseConfig) return null;
  const res = await fetch(new URL("/rest/v1/rpc/leaderboard", supabaseConfig.url), {
    method: "POST",
    headers: { apikey: supabaseConfig.key, "content-type": "application/json" },
    body: JSON.stringify(args),
  }).catch(() => null);
  return res?.ok ? boardSchema.safeParse(await res.json().catch(() => null)) : null;
}

/** When this week's boards give way to the next: Monday 00:00 UTC. */
function nextMonday(now = new Date()): Date {
  const day = (now.getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7 - day));
}

function setUp(root: HTMLElement) {
  const parsed = stringsSchema.safeParse(JSON.parse(root.dataset.strings ?? "{}"));
  if (!parsed.success) return;
  const s = parsed.data;
  const locale = root.dataset.locale ?? "en";
  const limit = Number(root.dataset.limit ?? "50");
  const userBase = root.dataset.userBase ?? "/";
  const boardSelect = root.querySelector<HTMLSelectElement>("[data-board]");
  const periodButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-period]")];
  const noteEl = root.querySelector<HTMLElement>("[data-note]");
  const statusEl = root.querySelector<HTMLElement>("[data-status]");
  const listEl = root.querySelector<HTMLOListElement>("[data-rows]");
  if (!boardSelect || !noteEl || !statusEl || !listEl) return;
  // Bound once found, so the functions below see them as there.
  const select: HTMLSelectElement = boardSelect;
  const note: HTMLElement = noteEl;
  const status: HTMLElement = statusEl;
  const list: HTMLOListElement = listEl;
  const sync = root.dataset.syncUrl === "true";

  let period: Period = "all";
  if (sync) {
    const params = new URLSearchParams(location.search);
    const asked = params.get("board");
    if (asked && [...select.options].some((o) => o.value === asked)) select.value = asked;
    if (params.get("period") === "week") period = "week";
  }
  let request = 0;

  const option = () => select.selectedOptions[0];
  const valueText = (value: number) => {
    const kind = option()?.dataset.kind;
    if (kind === "time") return formatDuration(value);
    if (kind === "xp") return fill(s.xpValue, { xp: Math.round(value).toLocaleString(locale) });
    return Math.round(value).toLocaleString(locale);
  };

  function rowElement(row: Row, mine: boolean): HTMLLIElement {
    const li = document.createElement("li");
    li.className = `flex items-center gap-3 rounded-2xl border p-3 ${
      mine ? "border-brand-strong bg-surface-2" : "border-border bg-surface"
    }`;
    const rank = document.createElement("span");
    rank.className = "w-10 shrink-0 text-end font-semibold tabular-nums";
    rank.textContent = `#${row.rank.toLocaleString(locale)}`;
    const avatar = document.createElement("span");
    avatar.setAttribute("aria-hidden", "true");
    avatar.className =
      "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cover bg-center text-sm font-bold";
    const picture = supabaseConfig
      ? avatarUrl(
          {
            avatar_kind: row.avatarKind,
            avatar_preset: row.avatarPreset,
            avatar_path: row.avatarPath,
          },
          supabaseConfig.url,
        )
      : null;
    const slot = String(paletteIndexFor(row.userId));
    if (picture) {
      avatar.style.backgroundImage = `url("${picture.replace(/["\\]/g, "")}")`;
    } else {
      avatar.style.backgroundColor = `var(--player-${slot})`;
      avatar.style.color = `var(--player-${slot}-ink)`;
      avatar.textContent = initialsFor(row.nickname, locale);
    }
    const name = document.createElement("a");
    name.href = `${userBase}${encodeURIComponent(row.nickname)}/`;
    name.className = "min-w-0 flex-1 truncate font-semibold hover:underline";
    name.textContent = row.nickname;
    li.append(rank, avatar, name);
    if (mine) {
      const you = document.createElement("span");
      you.className = "shrink-0 rounded-full bg-surface px-2 text-sm font-semibold";
      you.textContent = s.you;
      li.append(you);
    }
    const value = document.createElement("span");
    value.className = "shrink-0 font-semibold tabular-nums";
    value.textContent = valueText(row.value);
    li.append(value);
    return li;
  }

  function say(text: string, retry = false) {
    status.replaceChildren(text);
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "min-h-11 rounded-full border border-border-strong px-4 text-sm font-semibold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
      button.textContent = s.retry;
      button.addEventListener("click", () => void load());
      status.append(button);
    }
  }

  function draw(board: Board) {
    const me = board.me;
    const rows = board.entries.map((row) => rowElement(row, row.rank === me?.rank));
    // Below the top: a gap, then the viewer's own row.
    if (me && !board.entries.some((row) => row.rank === me.rank)) {
      const gap = document.createElement("li");
      gap.setAttribute("aria-hidden", "true");
      gap.className = "text-center text-muted";
      gap.textContent = "⋯";
      rows.push(gap, rowElement(me, true));
    }
    list.replaceChildren(...rows);
    if (board.entries.length === 0) say(s.empty);
    else if (board.hidden) say(s.hidden);
    else if (me)
      say(
        fill(s.yourPlace, {
          rank: me.rank.toLocaleString(locale),
          total: board.total.toLocaleString(locale),
        }),
      );
    else say("");
  }

  async function load() {
    const weekly = option()?.dataset.weekly === "true";
    if (!weekly && period === "week") period = "all";
    for (const button of periodButtons) {
      const id = button.dataset.period;
      button.setAttribute("aria-pressed", String(id === period));
      button.hidden = id === "week" && !weekly;
    }
    note.textContent =
      period === "week"
        ? fill(s.weekEnds, {
            date: new Intl.DateTimeFormat(locale, {
              weekday: "long",
              hour: "numeric",
              minute: "2-digit",
            }).format(nextMonday()),
          })
        : "";
    if (sync) {
      const params = new URLSearchParams(location.search);
      params.set("board", select.value);
      if (period === "week") params.set("period", "week");
      else params.delete("period");
      history.replaceState(null, "", `?${params.toString()}`);
    }
    if (period === "friends") {
      list.replaceChildren();
      say(s.friendsSoon);
      return;
    }
    const mine = ++request;
    say(s.loading);
    const board = await fetchBoard(select.value, period, limit);
    if (mine !== request) return;
    if (!board?.success) {
      list.replaceChildren();
      say(s.failed, true);
      return;
    }
    draw(board.data);
  }

  select.addEventListener("change", () => void load());
  for (const button of periodButtons) {
    button.addEventListener("click", () => {
      period = (button.dataset.period ?? "all") as Period;
      void load();
    });
  }
  void load();
}

for (const root of document.querySelectorAll<HTMLElement>("[data-leaderboard]")) setUp(root);
