// "Profile" tab (no framework): your public profile when signed in, the
// sign-in page otherwise (returning here afterwards).
import { localStorageOrUndefined, syncAccount } from "@/features/account/account-state";
import { readAccountSummary, type AccountSummary } from "@/features/account/account-summary";
import { getSupabase, hasStoredSession } from "@/lib/supabase/client";

const root = document.querySelector<HTMLElement>("[data-profile-redirect]");

function go(summary: AccountSummary | null, data: DOMStringMap) {
  if (summary?.nickname) {
    location.replace(`${data.userBase ?? ""}${encodeURIComponent(summary.nickname)}/`);
  } else if (summary) {
    location.replace(data.onboarding ?? "/");
  } else {
    location.replace(`${data.signIn ?? "/"}?next=${encodeURIComponent(location.pathname)}`);
  }
}

if (root) {
  const cached = readAccountSummary(localStorageOrUndefined());
  const supabase = hasStoredSession() ? getSupabase() : null;
  if (cached || !supabase) {
    go(cached, root.dataset);
  } else {
    // A session without a cached summary (e.g. storage was partly cleared).
    void supabase.then(syncAccount).then((summary) => {
      go(summary, root.dataset);
    });
  }
}
