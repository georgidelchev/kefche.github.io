import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";

import { Button } from "@kefche/ui/components/button";

import { getSupabase } from "@/lib/supabase/client";

import { FormMessage, PasswordField, TextField } from "./components/fields";
import { OAuthButtons } from "./components/OAuthButtons";
import { messagesFor } from "./components/use-messages";
import { forgetGuest, guestSession, rememberGuest } from "./guest";
import { nextFromLocation, routeAfterSignIn } from "./session";
import { emailField } from "./validation";

import type { AuthPaths } from "./paths";
import type { AuthStrings } from "./strings";

const schema = z.object({
  email: emailField,
  password: z.string().check(z.minLength(1, { error: "required" })),
});

export function SignInForm({ strings, paths }: { strings: AuthStrings; paths: AuthPaths }) {
  const messages = messagesFor(strings);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      // Signing in replaces a guest session; keep it for the merge offer.
      const guest = await guestSession(supabase);
      if (guest) rememberGuest(guest);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await routeAfterSignIn(supabase, paths, nextFromLocation());
    } catch (e) {
      forgetGuest();
      setFormError(messages.thrown(e));
    }
  });

  return (
    <div className="grid gap-6">
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <TextField
          id="sign-in-email"
          label={strings.fields.email}
          type="email"
          autoComplete="email"
          error={messages.field(errors.email)}
          {...register("email")}
        />
        <PasswordField
          id="sign-in-password"
          label={strings.fields.password}
          autoComplete="current-password"
          showLabel={strings.fields.showPassword}
          hideLabel={strings.fields.hidePassword}
          error={messages.field(errors.password)}
          {...register("password")}
        />
        <a
          href={paths.forgot}
          className="justify-self-start text-sm font-semibold text-link underline-offset-4 hover:underline"
        >
          {strings.signIn.forgot}
        </a>
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {strings.signIn.submit}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {strings.signIn.or}
        <span className="h-px flex-1 bg-border" />
      </div>
      <OAuthButtons strings={strings} paths={paths} mode="signIn" />

      <p className="text-center">
        {strings.signIn.noAccount}{" "}
        <a
          href={paths.signUp}
          className="font-semibold text-link underline-offset-4 hover:underline"
        >
          {strings.signIn.createAccount}
        </a>
      </p>
    </div>
  );
}
