// The signed-in player's live connection (Phase 8 decisions): one per tab,
// on their own private channel `user:<id>`, which only the database writes.
// Its messages are passed on as LIVE_EVENT on the document; pages listen for
// what concerns them. Guests and visitors open nothing.
//
// The tab also reports its status: on load, when the page's context changes
// (a lobby, a game), and every minute. Hidden for 5 minutes, it reports
// "away" and closes the connection (the free plan allows 200 at once); back
// in view, it reconnects and says LIVE_RESUME_EVENT so pages catch up. A
// closing tab says goodbye.
import { localStorageOrUndefined } from "@/features/account/account-state";
import { readAccountSummary } from "@/features/account/account-summary";
import { getSupabase, hasStoredSession, send, type Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import {
  LIVE_EVENT,
  LIVE_RESUME_EVENT,
  PRESENCE_CONTEXT_EVENT,
  presenceContext,
} from "./presence-context";

import type { RealtimeChannel } from "@supabase/supabase-js";

const HEARTBEAT_MS = 60_000;
const AWAY_AFTER_MS = 5 * 60_000;
/** The events the database sends on a player's channel. */
const EVENTS = ["presence"] as const;

function start(supabase: Supabase, userId: string) {
  const tab = crypto.randomUUID();
  let channel: RealtimeChannel | null = null;
  let away = false;
  let awayTimer: ReturnType<typeof setTimeout> | undefined;
  let token: string | null = null;
  let stopped = false;

  void supabase.auth.getSession().then(({ data }) => {
    token = data.session?.access_token ?? null;
  });

  const report = () => {
    if (stopped) return;
    const context = away ? { status: "away" as const } : presenceContext();
    send(
      supabase.rpc("report_presence", {
        p_tab: tab,
        p_status: context.status,
        ...("game" in context ? { p_game: context.game } : {}),
      }),
    );
  };

  const connect = () => {
    if (channel || stopped) return;
    const joined = supabase.channel(`user:${userId}`, { config: { private: true } });
    for (const event of EVENTS) {
      joined.on("broadcast", { event }, ({ payload }: { payload: unknown }) => {
        document.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: { event, payload } }));
      });
    }
    joined.subscribe();
    channel = joined;
  };

  const disconnect = () => {
    if (!channel) return;
    void supabase.removeChannel(channel);
    channel = null;
  };

  const heartbeat = setInterval(report, HEARTBEAT_MS);

  const stop = () => {
    stopped = true;
    clearTimeout(awayTimer);
    clearInterval(heartbeat);
    disconnect();
  };

  const goodbye = () => {
    if (!token || !supabaseConfig || stopped) return;
    fetch(`${supabaseConfig.url}/rest/v1/rpc/leave_presence`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: supabaseConfig.key,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_tab: tab }),
    }).catch(() => undefined);
  };

  supabase.auth.onAuthStateChange((event, session) => {
    token = session?.access_token ?? null;
    if (event === "SIGNED_OUT" || session?.user.id !== userId) stop();
  });

  document.addEventListener("visibilitychange", () => {
    clearTimeout(awayTimer);
    if (document.visibilityState === "hidden") {
      awayTimer = setTimeout(() => {
        away = true;
        disconnect();
        report();
      }, AWAY_AFTER_MS);
    } else if (away) {
      away = false;
      connect();
      report();
      document.dispatchEvent(new CustomEvent(LIVE_RESUME_EVENT));
    }
  });
  document.addEventListener(PRESENCE_CONTEXT_EVENT, report);
  window.addEventListener("pagehide", goodbye);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) report();
  });

  connect();
  report();
}

const summary = readAccountSummary(localStorageOrUndefined());
// The summary exists only for accounts, not guests.
if (summary && hasStoredSession()) {
  const begin = () => {
    void getSupabase()?.then((supabase) => {
      start(supabase, summary.id);
    });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(begin, { timeout: 3000 });
  else setTimeout(begin, 1000);
}
