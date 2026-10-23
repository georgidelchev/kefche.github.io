// The guest's first step into an online room (SPEC §7.1): pick a nickname
// and, when chat needs it, confirm being 13 or older. Accounts skip it.
import { useId, useState } from "react";

import { Button } from "@kefche/ui/components/button";

import { FormMessage, TextField } from "@/features/auth/components/fields";
import { authErrorKey } from "@/features/auth/errors";
import { getSupabase, nullable } from "@/lib/supabase/client";

import type { GuestStrings } from "./strings";

interface Props {
  strings: GuestStrings;
  privacyHref: string;
  needsNickname: boolean;
  /** Ask for "13 or older" (chat needs it). */
  needsAge: boolean;
  onDone: () => void;
}

export function GuestProfileForm({
  strings: s,
  privacyHref,
  needsNickname,
  needsAge,
  onDone,
}: Props) {
  const id = useId();
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (needsAge && !age) {
      setError(s.ageNeeded);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { data, error: rpcError } = await supabase.rpc("set_guest_profile", {
        ...(needsNickname ? { p_nickname: nickname.trim() } : {}),
        p_age_confirmed: needsAge && age,
      });
      if (rpcError) throw rpcError;
      const code = nullable(data);
      if (code !== null) {
        setError(s.errors[authErrorKey(code)]);
        return;
      }
      onDone();
    } catch (e) {
      setError(s.errors[authErrorKey(e)]);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3 className="text-2xl">{s.title}</h3>
      <p className="text-muted">{s.intro}</p>
      {needsNickname && (
        <TextField
          id={`${id}-nickname`}
          label={s.nickname}
          value={nickname}
          autoComplete="nickname"
          required
          minLength={3}
          maxLength={20}
          onChange={(e) => {
            setNickname(e.target.value);
          }}
        />
      )}
      {needsAge && (
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-brand"
            checked={age}
            onChange={(e) => {
              setAge(e.target.checked);
            }}
          />
          {s.ageConfirm}
        </label>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {s.submit}
      </Button>
      <p className="text-sm text-muted">
        {s.privacyNote}{" "}
        <a
          href={privacyHref}
          className="font-semibold text-link underline-offset-4 hover:underline"
        >
          {s.privacyLink}
        </a>
      </p>
    </form>
  );
}
