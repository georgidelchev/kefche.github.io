import { useEffect, useState } from "react";

import { getSupabase, nullable } from "@/lib/supabase/client";

import { authErrorKey, type AuthErrorKey } from "../errors";
import { nicknameField } from "../validation";

export interface NicknameCheck {
  value: string;
  /** Null when available. */
  problem: AuthErrorKey | null;
}

/**
 * Asks the server (check_nickname) whether `nickname` is usable, 400 ms after
 * typing stops. Returns the latest answer; compare its `value` with the
 * current input before showing it.
 */
export function useNicknameCheck(nickname: string): NicknameCheck | null {
  const [result, setResult] = useState<NicknameCheck | null>(null);

  useEffect(() => {
    const value = nickname.trim();
    if (!nicknameField.safeParse(value).success) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const supabase = await getSupabase();
        if (!supabase) return;
        const { data, error } = await supabase.rpc("check_nickname", { p_nickname: value });
        const problem = nullable(data); // null: available
        // Rate limits and network errors: say nothing; submitting checks again.
        if (cancelled || error || problem === "rate_limited") return;
        setResult({ value, problem: problem === null ? null : authErrorKey(problem) });
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nickname]);

  return result;
}
