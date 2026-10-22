import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod/mini";

import { Button } from "@kefche/ui/components/button";

import { setAccount } from "@/features/account/account-state";
import { getSupabase, nullable } from "@/lib/supabase/client";

import { BirthDateField, FormMessage, TextField } from "./components/fields";
import { messagesFor } from "./components/use-messages";
import { useNicknameCheck } from "./components/use-nickname-check";
import { authErrorKey } from "./errors";
import { nextFromLocation, routeAfterSignIn } from "./session";
import { birthDateChecks, birthDateShape, nicknameField } from "./validation";

import type { AuthPaths } from "./paths";
import type { AuthStrings } from "./strings";

interface Props {
  strings: AuthStrings;
  paths: AuthPaths;
  monthNames: readonly string[];
}

interface Needs {
  nickname: boolean;
  birthDate: boolean;
}

/**
 * Collects what an account is missing after OAuth sign-up (or for any account
 * without a nickname or birth year) and saves it with complete_profile.
 */
export function OnboardingForm(props: Props) {
  const { strings, paths } = props;
  const [needs, setNeeds] = useState<Needs | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = await getSupabase();
        const user = supabase ? (await supabase.auth.getUser()).data.user : null;
        if (!supabase || !user) {
          location.assign(paths.signIn);
          return;
        }
        const [profile, settings] = await Promise.all([
          supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
          supabase.from("user_settings").select("birth_year").eq("user_id", user.id).maybeSingle(),
        ]);
        if (profile.error) throw profile.error;
        if (settings.error) throw settings.error;
        const missing = {
          nickname: !profile.data?.nickname,
          birthDate: settings.data?.birth_year == null,
        };
        if (!missing.nickname && !missing.birthDate) {
          await routeAfterSignIn(supabase, paths, nextFromLocation());
          return;
        }
        setNeeds(missing);
      } catch (e) {
        setBlocked(strings.errors[authErrorKey(e)]);
      }
    })();
  }, [paths, strings]);

  if (blocked) return <FormMessage tone="error">{blocked}</FormMessage>;
  if (!needs) return <div className="min-h-40" aria-busy="true" />;
  return <OnboardingFields {...props} needs={needs} onBlocked={setBlocked} />;
}

function OnboardingFields({
  strings,
  paths,
  monthNames,
  needs,
  onBlocked,
}: Props & {
  needs: Needs;
  onBlocked: (message: string) => void;
}) {
  const messages = messagesFor(strings);
  const [formError, setFormError] = useState<string | null>(null);
  // Fields that aren't needed get valid placeholders, so one schema fits all.
  const schema = z
    .object({ nickname: needs.nickname ? nicknameField : z.string(), ...birthDateShape })
    .check(...birthDateChecks<{ birthMonth: string; birthYear: string }>());
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      nickname: "",
      birthMonth: needs.birthDate ? "" : "1",
      birthYear: needs.birthDate ? "" : "1900",
    },
  });

  const nickname = useWatch({ control, name: "nickname" });
  const check = useNicknameCheck(needs.nickname ? nickname : "");
  const current = check?.value === nickname.trim() ? check : null;

  const onSubmit = handleSubmit(async ({ nickname, birthMonth, birthYear }) => {
    setFormError(null);
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { data, error } = await supabase.rpc("complete_profile", {
        ...(needs.nickname && { p_nickname: nickname }),
        ...(needs.birthDate && {
          p_birth_year: Number(birthYear),
          p_birth_month: Number(birthMonth),
        }),
      });
      if (error) throw error;
      const problem = nullable(data); // null: success
      if (problem === null) {
        await routeAfterSignIn(supabase, paths, nextFromLocation());
        return;
      }
      const key = authErrorKey(problem);
      if (key === "ageRestricted") {
        // The server already deleted the account (SPEC §7.1); forget it here too.
        await supabase.auth.signOut({ scope: "local" });
        setAccount(null);
        onBlocked(strings.errors.ageRestricted);
      } else if (key.startsWith("nickname")) {
        setError("nickname", { type: "server", message: key }, { shouldFocus: true });
      } else if (key === "birthDateInvalid") {
        setError("birthYear", { type: "server", message: key }, { shouldFocus: true });
      } else {
        setFormError(strings.errors[key]);
      }
    } catch (e) {
      setFormError(messages.thrown(e));
    }
  });

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      {needs.nickname && (
        <TextField
          id="onboarding-nickname"
          label={strings.fields.nickname}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          hint={strings.hints.nickname}
          error={
            messages.field(errors.nickname) ??
            (current?.problem ? strings.errors[current.problem] : undefined)
          }
          success={current && !current.problem ? strings.hints.nicknameAvailable : undefined}
          {...register("nickname")}
        />
      )}
      {needs.birthDate && (
        <BirthDateField
          id="onboarding-birth"
          legend={strings.fields.birthDate}
          monthLabel={strings.fields.birthMonth}
          yearLabel={strings.fields.birthYear}
          monthNames={monthNames}
          hint={strings.hints.birthDate}
          error={messages.field(errors.birthMonth) ?? messages.field(errors.birthYear)}
          month={register("birthMonth")}
          year={register("birthYear")}
        />
      )}
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {strings.onboarding.submit}
      </Button>
    </form>
  );
}
