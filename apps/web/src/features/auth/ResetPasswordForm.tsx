import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";

import { Button } from "@kefche/ui/components/button";

import { syncAccount } from "@/features/account/account-state";
import { getSupabase } from "@/lib/supabase/client";

import { FormMessage, PasswordField } from "./components/fields";
import { messagesFor } from "./components/use-messages";
import { authErrorKey } from "./errors";
import { passwordField } from "./validation";

import type { AuthPaths } from "./paths";
import type { AuthStrings } from "./strings";

const schema = z.object({ password: passwordField });

type State = "checking" | "ready" | "expired" | "done";

/** Reached from a password-reset email via the callback page, which signs the user in. */
export function ResetPasswordForm({ strings, paths }: { strings: AuthStrings; paths: AuthPaths }) {
  const messages = messagesFor(strings);
  const [state, setState] = useState<State>("checking");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  useEffect(() => {
    void (async () => {
      const supabase = await getSupabase();
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      setState(session ? "ready" : "expired");
    })();
  }, []);

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const key = authErrorKey(error);
        if (key === "passwordWeak" || key === "samePassword") {
          setError("password", { type: "server", message: key }, { shouldFocus: true });
        } else {
          setFormError(strings.errors[key]);
        }
        return;
      }
      await syncAccount(supabase);
      setState("done");
    } catch (e) {
      setFormError(messages.thrown(e));
    }
  });

  if (state === "checking") return <div className="min-h-40" aria-busy="true" />;

  if (state === "expired") {
    return (
      <div className="grid gap-4">
        <FormMessage tone="error">{strings.errors.linkExpired}</FormMessage>
        <Button asChild variant="outline">
          <a href={paths.forgot}>{strings.reset.requestNew}</a>
        </Button>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="grid gap-4">
        <FormMessage tone="success">{strings.reset.done}</FormMessage>
        <Button asChild>
          <a href={paths.home}>{strings.reset.continue}</a>
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      <PasswordField
        id="reset-password"
        label={strings.fields.newPassword}
        autoComplete="new-password"
        hint={strings.hints.password}
        showLabel={strings.fields.showPassword}
        hideLabel={strings.fields.hidePassword}
        error={messages.field(errors.password)}
        {...register("password")}
      />
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {strings.reset.submit}
      </Button>
    </form>
  );
}
