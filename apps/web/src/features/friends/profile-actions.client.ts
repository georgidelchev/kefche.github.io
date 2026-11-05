// A profile's friend actions (no framework; ProfileActions.astro). For a
// signed-in viewer other than the profile's player, shows the friendship
// between them with what can be done about it, and their mutual friends.
// Guests can only block. Removing a friend and blocking ask first. Invite to
// a game opens a list of games, each a link that opens a new lobby and
// invites the player (`?new&invite=<id>`). Report (guests too) opens a form
// for their nickname or bio, or their uploaded avatar. The database decides
// every action; this only shows the result.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { localStorageOrUndefined } from "@/features/account/account-state";
import { readAccountSummary } from "@/features/account/account-summary";
import { fill } from "@/features/games/turn/labels";
import { REPORT_REASONS, sendReport, type ReportReason } from "@/features/moderation/report";
import { getSupabase, hasStoredSession, type Supabase } from "@/lib/supabase/client";

import {
  fetchRelation,
  friendErrorCode,
  FRIEND_ERROR_CODES,
  type ProfileRelation,
} from "./friends-data";

const stringsSchema = z.object({
  errors: z.record(z.enum(FRIEND_ERROR_CODES), z.string()),
  confirm: z.object({
    removeTitle: z.string(),
    removeBody: z.string(),
    blockTitle: z.string(),
    blockBody: z.string(),
  }),
  mutual: z.string(),
  mutualMore: z.string(),
  actions: z.object({ remove: z.string(), block: z.string() }),
  report: z.object({
    sent: z.string(),
    already: z.string(),
    rateLimited: z.string(),
    gone: z.string(),
    failed: z.string(),
  }),
});
type Strings = z.infer<typeof stringsSchema>;

type Action =
  "add" | "accept" | "decline" | "cancel" | "remove" | "unblock" | "block" | "invite" | "report";

/** The controls each state shows. */
function shown(relation: ProfileRelation, guest: boolean): { status?: string; actions: Action[] } {
  if (relation.blocked) return { status: "blocked", actions: ["unblock", "report"] };
  if (guest) return { actions: ["block", "report"] };
  switch (relation.friendship) {
    case "none":
      return { actions: ["add", "invite", "block", "report"] };
    case "requested":
      return { status: "requested", actions: ["cancel", "invite", "block", "report"] };
    case "incoming":
      return { status: "incoming", actions: ["accept", "decline", "invite", "block", "report"] };
    case "friends":
      return { status: "friends", actions: ["invite", "remove", "block", "report"] };
  }
}

function setUp(root: HTMLElement, supabase: Supabase, s: Strings, guest: boolean) {
  const userId = root.dataset.userId ?? "";
  const nickname = root.dataset.nickname ?? "";
  const profileBase = root.dataset.profileBase ?? "/";
  const message = root.querySelector<HTMLElement>("[data-message]");
  const mutual = root.querySelector<HTMLElement>("[data-mutual]");
  const dialog = root.querySelector<HTMLDialogElement>("dialog[data-confirm]");
  const games = root.querySelector<HTMLDialogElement>("dialog[data-invite]");
  const report = root.querySelector<HTMLDialogElement>("dialog[data-report]");
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button[data-action]")];
  const statuses = [...root.querySelectorAll<HTMLElement>("[data-status]")];
  // Message shows with Invite: for accounts, unless the viewer blocked them.
  const messageLink = root.querySelector<HTMLElement>("[data-message]");
  const say = (text: string) => {
    if (message) message.textContent = text;
  };

  function render(relation: ProfileRelation) {
    const { status, actions } = shown(relation, guest);
    for (const el of statuses) el.hidden = el.dataset.status !== status;
    if (messageLink) messageLink.hidden = !actions.includes("invite");
    for (const button of buttons) {
      button.hidden = !actions.includes(button.dataset.action as Action);
      button.disabled = false;
    }
    if (mutual) {
      const { count, players } = relation.mutual;
      mutual.hidden = count === 0;
      const links = players.map((p) => {
        const a = document.createElement("a");
        a.href = `${profileBase}${encodeURIComponent(p.nickname)}/`;
        a.className = "font-semibold text-link hover:underline";
        a.textContent = p.nickname;
        return a;
      });
      const parts: (Node | string)[] = [`${s.mutual}: `];
      links.forEach((link, i) => {
        if (i > 0) parts.push(", ");
        parts.push(link);
      });
      if (count > players.length) {
        const more = (count - players.length).toLocaleString(root.dataset.locale);
        parts.push(` ${fill(s.mutualMore, { count: more })}`);
      }
      mutual.replaceChildren(...parts);
    }
    root.hidden = false;
  }

  async function refresh() {
    const relation = await fetchRelation(supabase, userId);
    if (relation) render(relation);
  }

  async function run(action: Action) {
    for (const button of buttons) button.disabled = true;
    say("");
    const p = { p_user: userId };
    const { error } =
      action === "add" || action === "accept"
        ? await supabase.rpc("add_friend", p)
        : action === "block"
          ? await supabase.rpc("block_user", p)
          : action === "unblock"
            ? await supabase.rpc("unblock_user", p)
            : await supabase.rpc("remove_friend", p);
    if (error) say(s.errors[friendErrorCode(error)]);
    await refresh();
  }

  if (report) setUpReport(report, supabase, userId, s.report);

  let pending: Action | null = null;
  dialog?.addEventListener("close", () => {
    if (dialog.returnValue === "confirm" && pending) void run(pending);
    pending = null;
  });

  for (const button of buttons) {
    const action = button.dataset.action as Action;
    button.addEventListener("click", () => {
      if (action === "invite") {
        games?.showModal();
        return;
      }
      if (action === "report") {
        report?.dispatchEvent(new Event("kefche:open"));
        return;
      }
      if ((action === "remove" || action === "block") && dialog) {
        pending = action;
        const title = dialog.querySelector("h2");
        const body = dialog.querySelector("p");
        const confirm = dialog.querySelector<HTMLButtonElement>("[data-confirm-action]");
        if (title) {
          title.textContent = fill(
            action === "remove" ? s.confirm.removeTitle : s.confirm.blockTitle,
            { name: nickname },
          );
        }
        if (body)
          body.textContent = action === "remove" ? s.confirm.removeBody : s.confirm.blockBody;
        if (confirm) confirm.textContent = action === "remove" ? s.actions.remove : s.actions.block;
        dialog.returnValue = "";
        dialog.showModal();
        return;
      }
      void run(action);
    });
  }
  void refresh();
}

/** The report form: sends on Send, shows the outcome, then offers Close. */
function setUpReport(
  dialog: HTMLDialogElement,
  supabase: Supabase,
  userId: string,
  outcomes: Strings["report"],
) {
  const form = dialog.querySelector("form");
  const fields = dialog.querySelector<HTMLElement>("[data-report-fields]");
  const outcome = dialog.querySelector<HTMLElement>("[data-report-outcome]");
  const cancel = dialog.querySelector<HTMLButtonElement>("[data-report-cancel]");
  const sendButton = dialog.querySelector<HTMLButtonElement>("[data-report-send]");
  const close = dialog.querySelector<HTMLButtonElement>("[data-report-close]");
  if (!form || !fields || !outcome || !cancel || !sendButton || !close) return;
  const avatarPath = dialog.dataset.avatarPath;

  const finished = (done: boolean) => {
    fields.hidden = done;
    cancel.hidden = done;
    sendButton.hidden = done;
    close.hidden = !done;
  };
  dialog.addEventListener("kefche:open", () => {
    form.reset();
    outcome.textContent = "";
    finished(false);
    sendButton.disabled = false;
    dialog.showModal();
  });
  form.addEventListener("submit", (event) => {
    if (event.submitter !== sendButton) return;
    event.preventDefault();
    const data = new FormData(form);
    const asked = data.get("reason");
    const reason = REPORT_REASONS.find((r): r is ReportReason => r === asked) ?? "other";
    const details = data.get("details");
    const avatar = data.get("type") === "avatar" ? avatarPath : undefined;
    sendButton.disabled = true;
    void sendReport(supabase, {
      type: avatar ? "avatar" : "user",
      target: avatar ?? userId,
      reason,
      details: typeof details === "string" ? details : "",
    }).then((result) => {
      outcome.textContent = outcomes[result];
      sendButton.disabled = false;
      finished(result === "sent" || result === "already" || result === "gone");
    });
  });
}

const root = document.querySelector<HTMLElement>("[data-profile-actions]");
const viewer = readAccountSummary(localStorageOrUndefined());
// The player's own profile, or no session: nothing to show.
if (root && hasStoredSession() && viewer?.id !== root.dataset.userId) {
  const parsed = stringsSchema.safeParse(JSON.parse(root.dataset.strings ?? "{}"));
  void (async () => {
    const supabase = await getSupabase();
    const user = supabase ? (await supabase.auth.getSession()).data.session?.user : undefined;
    if (!supabase || !user || user.id === root.dataset.userId || !parsed.success) return;
    setUp(root, supabase, parsed.data, user.is_anonymous === true);
  })();
}
