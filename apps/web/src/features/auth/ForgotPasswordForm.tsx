import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";

import { Button } from "@kefche/ui/components/button";

import { getSupabase } from "@/lib/supabase/client";

import { FormMessage, TextField } from "./components/fields";
import { messagesFor } from "./components/use-messages";
import { authErrorKey } from "./errors";
import { fill } from "./strings";
import { emailField } from "./validation";

import type { AuthPaths } from "./paths";
import type { AuthStrings } from "./strings";

const schema = z.object({ email: emailField });

export function ForgotPasswordForm({ strings, paths }: { strings: AuthStrings; paths: AuthPaths }) {
  const messages = messagesFor(strings);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      // The email links to the callback page, which opens the new-password page.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL(paths.callback, location.origin).href,
      });
      const key = error ? authErrorKey(error) : null;
      // Only problems the user can act on are shown; everything else looks
      // like success, so the form doesn't reveal which emails have accounts.
      if (key === "rateLimited" || key === "network" || key === "emailInvalid") {
        setFormError(strings.errors[key]);
        return;
      }
      setSentTo(email);
    } catch (e) {
      setFormError(messages.thrown(e));
    }
  });

  return (
    <div className="grid gap-6">
      {sentTo === null ? (
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          {formError && <FormMessage tone="error">{formError}</FormMessage>}
          <TextField
            id="forgot-email"
            label={strings.fields.email}
            type="email"
            autoComplete="email"
            error={messages.field(errors.email)}
            {...register("email")}
          />
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {strings.forgot.submit}
          </Button>
        </form>
      ) : (
        <FormMessage tone="success">{fill(strings.forgot.sent, { email: sentTo })}</FormMessage>
      )}
      <a
        href={paths.signIn}
        className="justify-self-center font-semibold text-link underline-offset-4 hover:underline"
      >
        {strings.forgot.back}
      </a>
    </div>
  );
}
