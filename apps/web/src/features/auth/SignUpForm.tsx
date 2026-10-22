import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod/mini";

import { Button } from "@kefche/ui/components/button";

import type { Locale } from "@/i18n/locales";
import { getSupabase } from "@/lib/supabase/client";

import { BirthDateField, FormMessage, PasswordField, TextField } from "./components/fields";
import { OAuthButtons } from "./components/OAuthButtons";
import { messagesFor } from "./components/use-messages";
import { useNicknameCheck } from "./components/use-nickname-check";
import { authErrorKey, type AuthErrorKey } from "./errors";
import { nextFromLocation, routeAfterSignIn } from "./session";
import { fill } from "./strings";
import {
  birthDateChecks,
  birthDateShape,
  emailField,
  nicknameField,
  passwordField,
} from "./validation";

import type { AuthPaths } from "./paths";
import type { AuthStrings } from "./strings";

const schema = z
  .object({
    nickname: nicknameField,
    email: emailField,
    password: passwordField,
    ...birthDateShape,
  })
  .check(...birthDateChecks<{ birthMonth: string; birthYear: string }>());

type Field = "nickname" | "email" | "password" | "birthYear";

/** Server error codes that belong to a specific field. */
const FIELD_FOR: Partial<Record<AuthErrorKey, Field>> = {
  nicknameLength: "nickname",
  nicknameCharacters: "nickname",
  nicknameReserved: "nickname",
  nicknameBlocked: "nickname",
  nicknameTaken: "nickname",
  passwordWeak: "password",
  ageRestricted: "birthYear",
  birthDateInvalid: "birthYear",
};

interface Props {
  strings: AuthStrings;
  paths: AuthPaths;
  locale: Locale;
  monthNames: readonly string[];
}

export function SignUpForm({ strings, paths, locale, monthNames }: Props) {
  const messages = messagesFor(strings);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nickname: "", email: "", password: "", birthMonth: "", birthYear: "" },
  });

  const nickname = useWatch({ control, name: "nickname" });
  const check = useNicknameCheck(nickname);
  const current = check?.value === nickname.trim() ? check : null;
  const nicknameError =
    messages.field(errors.nickname) ??
    (current?.problem ? strings.errors[current.problem] : undefined);

  const onSubmit = handleSubmit(async ({ nickname, email, password, birthMonth, birthYear }) => {
    setFormError(null);
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: new URL(paths.callback, location.origin).href,
          // Read by the sign-up hook and trigger; the birth month is never stored.
          data: {
            nickname,
            birth_year: Number(birthYear),
            birth_month: Number(birthMonth),
            locale,
          },
        },
      });
      if (error) {
        const key = authErrorKey(error);
        const field = FIELD_FOR[key];
        if (field) setError(field, { type: "server", message: key }, { shouldFocus: true });
        else setFormError(strings.errors[key]);
        return;
      }
      // With email confirmation on (always, outside tests) there is no session yet.
      if (data.session) await routeAfterSignIn(supabase, paths, nextFromLocation());
      else setSentTo(email);
    } catch (e) {
      setFormError(messages.thrown(e));
    }
  });

  if (sentTo !== null) {
    return (
      <div className="grid justify-items-center gap-3 text-center" role="status">
        <MailCheck aria-hidden="true" className="size-12 text-brand-strong" />
        <h2 className="text-2xl">{strings.signUp.checkEmailTitle}</h2>
        <p className="text-muted">{fill(strings.signUp.checkEmailBody, { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <TextField
          id="sign-up-nickname"
          label={strings.fields.nickname}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          hint={strings.hints.nickname}
          error={nicknameError}
          success={current && !current.problem ? strings.hints.nicknameAvailable : undefined}
          {...register("nickname")}
        />
        <TextField
          id="sign-up-email"
          label={strings.fields.email}
          type="email"
          autoComplete="email"
          error={messages.field(errors.email)}
          {...register("email")}
        />
        <PasswordField
          id="sign-up-password"
          label={strings.fields.password}
          autoComplete="new-password"
          hint={strings.hints.password}
          showLabel={strings.fields.showPassword}
          hideLabel={strings.fields.hidePassword}
          error={messages.field(errors.password)}
          {...register("password")}
        />
        <BirthDateField
          id="sign-up-birth"
          legend={strings.fields.birthDate}
          monthLabel={strings.fields.birthMonth}
          yearLabel={strings.fields.birthYear}
          monthNames={monthNames}
          hint={strings.hints.birthDate}
          error={messages.field(errors.birthMonth) ?? messages.field(errors.birthYear)}
          month={register("birthMonth")}
          year={register("birthYear")}
        />
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {strings.signUp.submit}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {strings.signIn.or}
        <span className="h-px flex-1 bg-border" />
      </div>
      <OAuthButtons strings={strings} paths={paths} />

      <p className="text-center">
        {strings.signUp.haveAccount}{" "}
        <a
          href={paths.signIn}
          className="font-semibold text-link underline-offset-4 hover:underline"
        >
          {strings.signUp.signIn}
        </a>
      </p>
    </div>
  );
}
