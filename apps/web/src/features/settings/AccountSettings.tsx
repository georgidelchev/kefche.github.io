import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";

import { Button } from "@kefche/ui/components/button";

import { signOut } from "@/features/account/account-state";
import { FormMessage, PasswordField, TextField } from "@/features/auth/components/fields";
import { messagesFor } from "@/features/auth/components/use-messages";
import { authErrorKey } from "@/features/auth/errors";
import { fill, type AuthStrings } from "@/features/auth/strings";
import { emailField, passwordField } from "@/features/auth/validation";
import { AUTH_PROVIDERS, OAUTH_PROVIDERS, type OAuthProvider } from "@/lib/auth-providers";
import type { Supabase } from "@/lib/supabase/client";

import { useAccount } from "./use-account";

import type { SettingsStrings } from "./strings";
import type { User, UserIdentity } from "@supabase/supabase-js";

// Brand names, not translated.
const PROVIDER_NAMES: Record<OAuthProvider, string> = {
  google: "Google",
  discord: "Discord",
  twitch: "Twitch",
  facebook: "Facebook",
};

type Note = { tone: "error" | "success"; text: string } | null;

interface Props {
  strings: SettingsStrings;
  auth: AuthStrings;
  signInPath: string;
  homePath: string;
  callbackPath: string;
}

export function AccountSettings(props: Props) {
  const account = useAccount(props.signInPath);
  if (account.status === "error")
    return <FormMessage tone="error">{props.strings.saveFailed}</FormMessage>;
  if (account.status !== "ready") return <div className="min-h-64" aria-busy="true" />;
  return (
    <div className="grid gap-8">
      <EmailForm {...props} supabase={account.supabase} user={account.user} />
      <PasswordForm {...props} supabase={account.supabase} />
      <SignInMethods {...props} supabase={account.supabase} />
      <SignOut {...props} supabase={account.supabase} />
    </div>
  );
}

interface Inner extends Props {
  supabase: Supabase;
}

const callbackUrl = (callbackPath: string) => {
  const url = new URL(callbackPath, location.origin);
  url.searchParams.set("next", location.pathname);
  return url.href;
};

function EmailForm({ strings, auth, supabase, user, callbackPath }: Inner & { user: User }) {
  const messages = messagesFor(auth);
  const [note, setNote] = useState<Note>(null);
  const { register, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(z.object({ email: emailField })),
    defaultValues: { email: "" },
  });
  const onSubmit = handleSubmit(async ({ email }) => {
    setNote(null);
    // Confirmed through the email-change link (sent to both addresses).
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: new URL(callbackPath, location.origin).href },
    );
    if (error) {
      const key = authErrorKey(error);
      if (key === "emailTaken" || key === "emailInvalid")
        setError("email", { type: "server", message: key });
      else setNote({ tone: "error", text: auth.errors[key] });
      return;
    }
    setNote({ tone: "success", text: fill(strings.account.emailSent, { email }) });
  });
  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-3">
      <h3 className="text-lg font-semibold">{strings.account.email}</h3>
      <p className="break-all text-muted">{user.email}</p>
      <TextField
        id="settings-email"
        label={strings.account.newEmail}
        type="email"
        autoComplete="email"
        error={messages.field(formState.errors.email)}
        {...register("email")}
      />
      {note && <FormMessage tone={note.tone}>{note.text}</FormMessage>}
      <Button
        type="submit"
        variant="outline"
        className="justify-self-start"
        disabled={formState.isSubmitting}
      >
        {strings.account.changeEmail}
      </Button>
    </form>
  );
}

function PasswordForm({ strings, auth, supabase }: Inner) {
  const messages = messagesFor(auth);
  const [note, setNote] = useState<Note>(null);
  const { register, handleSubmit, setError, reset, formState } = useForm({
    resolver: zodResolver(z.object({ password: passwordField })),
    defaultValues: { password: "" },
  });
  const onSubmit = handleSubmit(async ({ password }) => {
    setNote(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // secure_password_change: needs a recent sign-in.
      if (error.code === "reauthentication_needed") {
        setNote({ tone: "error", text: strings.account.reauth });
        return;
      }
      const key = authErrorKey(error);
      if (key === "passwordWeak" || key === "samePassword")
        setError("password", { type: "server", message: key });
      else setNote({ tone: "error", text: auth.errors[key] });
      return;
    }
    reset();
    setNote({ tone: "success", text: strings.account.passwordChanged });
  });
  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-3">
      <PasswordField
        id="settings-password"
        label={auth.fields.newPassword}
        autoComplete="new-password"
        hint={auth.hints.password}
        showLabel={auth.fields.showPassword}
        hideLabel={auth.fields.hidePassword}
        error={messages.field(formState.errors.password)}
        {...register("password")}
      />
      {note && <FormMessage tone={note.tone}>{note.text}</FormMessage>}
      <Button
        type="submit"
        variant="outline"
        className="justify-self-start"
        disabled={formState.isSubmitting}
      >
        {strings.account.changePassword}
      </Button>
    </form>
  );
}

function SignInMethods({ strings, auth, supabase, callbackPath }: Inner) {
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUserIdentities().then(({ data }) => {
      setIdentities(data?.identities ?? []);
    });
  }, [supabase]);

  async function act(task: () => Promise<{ error: unknown }>) {
    setBusy(true);
    setNote(null);
    const { error } = await task();
    if (error) setNote({ tone: "error", text: auth.errors[authErrorKey(error)] });
    const { data } = await supabase.auth.getUserIdentities();
    setIdentities(data?.identities ?? []);
    setBusy(false);
  }

  if (!identities) return <div className="min-h-24" aria-busy="true" />;
  const only = identities.length <= 1;
  const linked = (provider: string) => identities.find((i) => i.provider === provider);
  const email = linked("email");
  return (
    <section className="grid gap-3" aria-labelledby="methods-heading">
      <h3 id="methods-heading" className="text-lg font-semibold">
        {strings.account.methods}
      </h3>
      <ul className="grid gap-2">
        {email && (
          <li className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border p-3">
            <span className="font-semibold">{strings.account.emailMethod}</span>
          </li>
        )}
        {/* Providers this build offers, plus any already linked (so they can be unlinked). */}
        {OAUTH_PROVIDERS.filter((p) => AUTH_PROVIDERS.includes(p) || linked(p)).map((provider) => {
          const identity = linked(provider);
          return (
            <li
              key={provider}
              className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <span className="font-semibold">{PROVIDER_NAMES[provider]}</span>
              {identity ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || only}
                  onClick={() => void act(() => supabase.auth.unlinkIdentity(identity))}
                >
                  {strings.account.disconnect}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      supabase.auth.linkIdentity({
                        provider,
                        options: { redirectTo: callbackUrl(callbackPath) },
                      }),
                    )
                  }
                >
                  {strings.account.connect}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {only && <p className="text-sm text-muted">{strings.account.lastMethod}</p>}
      {note && <FormMessage tone={note.tone}>{note.text}</FormMessage>}
    </section>
  );
}

function SignOut({ strings, supabase, homePath }: Inner) {
  const [busy, setBusy] = useState(false);
  async function leave(scope: "local" | "global") {
    setBusy(true);
    await signOut(supabase, scope);
    location.assign(homePath);
  }
  return (
    <div className="flex flex-wrap gap-3 border-t border-border pt-6">
      <Button type="button" variant="outline" disabled={busy} onClick={() => void leave("local")}>
        {strings.account.signOut}
      </Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => void leave("global")}>
        {strings.account.signOutEverywhere}
      </Button>
    </div>
  );
}
