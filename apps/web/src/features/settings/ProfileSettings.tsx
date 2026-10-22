import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";

import { UserAvatar } from "@kefche/ui/components/avatar";
import { Button } from "@kefche/ui/components/button";
import { cn } from "@kefche/ui/lib/cn";

import { syncAccount } from "@/features/account/account-state";
import { avatarUrl } from "@/features/account/avatar-url";
import { FormMessage, TextField } from "@/features/auth/components/fields";
import { messagesFor } from "@/features/auth/components/use-messages";
import { authErrorKey } from "@/features/auth/errors";
import { fill, type AuthStrings } from "@/features/auth/strings";
import { nicknameField } from "@/features/auth/validation";
import type { Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import { toAvatarFile } from "./avatar-image";
import { useAccount } from "./use-account";

import type { SettingsStrings } from "./strings";
import type { User } from "@supabase/supabase-js";

const PRESETS = Array.from({ length: 24 }, (_, i) => `blob-${String(i + 1).padStart(2, "0")}`);
const COOLDOWN_DAYS = 30;

interface Profile {
  nickname: string | null;
  avatar_kind: string;
  avatar_preset: string | null;
  avatar_path: string | null;
  country: string | null;
  bio: string | null;
  nickname_changed_at: string | null;
}

interface Props {
  strings: SettingsStrings;
  auth: AuthStrings;
  countries: [string, string][];
  bcp47: string;
  signInPath: string;
  /** Public profile URL without the nickname, e.g. "/en/u/". */
  profileBase: string;
}

interface Loaded {
  profile: Profile;
  uploadAllowed: boolean;
}

async function loadProfile(supabase: Supabase, user: User): Promise<Loaded> {
  const [row, allowed] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "nickname, avatar_kind, avatar_preset, avatar_path, country, bio, nickname_changed_at",
      )
      .eq("id", user.id)
      .single(),
    supabase.rpc("avatar_upload_allowed"),
  ]);
  if (row.error) throw row.error;
  return { profile: row.data, uploadAllowed: allowed.data === true };
}

export function ProfileSettings(props: Props) {
  const account = useAccount(props.signInPath);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (account.status !== "ready") return;
    loadProfile(account.supabase, account.user).then(setLoaded, () => {
      setFailed(true);
    });
  }, [account]);

  if (failed || account.status === "error") {
    return <FormMessage tone="error">{props.strings.saveFailed}</FormMessage>;
  }
  if (account.status !== "ready" || !loaded) return <div className="min-h-64" aria-busy="true" />;
  const { profile, uploadAllowed } = loaded;
  const reload = async () => {
    setLoaded(await loadProfile(account.supabase, account.user));
  };
  return (
    <div className="grid gap-8">
      <AvatarPicker
        {...props}
        supabase={account.supabase}
        user={account.user}
        profile={profile}
        uploadAllowed={uploadAllowed}
        onSaved={reload}
      />
      <ProfileForm
        {...props}
        supabase={account.supabase}
        user={account.user}
        profile={profile}
        onSaved={reload}
      />
    </div>
  );
}

interface SectionProps extends Props {
  supabase: Supabase;
  user: User;
  profile: Profile;
  onSaved: () => Promise<void>;
}

function AvatarPicker({
  strings,
  supabase,
  user,
  profile,
  uploadAllowed,
  onSaved,
}: SectionProps & { uploadAllowed: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const current = supabaseConfig ? avatarUrl(profile, supabaseConfig.url) : null;

  async function save(change: {
    avatar_kind: string;
    avatar_preset: string | null;
    avatar_path: string | null;
  }) {
    const { error } = await supabase.from("profiles").update(change).eq("id", user.id);
    if (error) throw error;
    // The previous upload is no longer used.
    if (profile.avatar_path && profile.avatar_path !== change.avatar_path) {
      await supabase.storage.from("avatars").remove([profile.avatar_path]);
    }
    await syncAccount(supabase);
    await onSaved();
  }

  async function run(task: () => Promise<void>, errorText = strings.saveFailed) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setMessage({ tone: "success", text: strings.saved });
    } catch {
      setMessage({ tone: "error", text: errorText });
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    let image: Awaited<ReturnType<typeof toAvatarFile>>;
    try {
      image = await toAvatarFile(file);
    } catch {
      throw new Error("invalid");
    }
    const path = `${user.id}/${crypto.randomUUID()}.${image.extension}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, image.blob, { contentType: image.blob.type, cacheControl: "31536000" });
    if (error) throw error;
    await save({ avatar_kind: "upload", avatar_preset: null, avatar_path: path });
  }

  const option =
    "flex size-14 cursor-pointer items-center justify-center rounded-full outline-offset-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus aria-pressed:outline-3 aria-pressed:outline-brand-strong disabled:cursor-wait";
  return (
    <section className="grid gap-4" aria-labelledby="avatar-heading">
      <h3 id="avatar-heading" className="text-lg font-semibold">
        {strings.profile.avatar}
      </h3>
      <div className="flex items-center gap-4">
        <UserAvatar
          name={profile.nickname ?? "?"}
          id={user.id}
          size="xl"
          {...(current ? { src: current } : {})}
        />
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || profile.avatar_kind === "initials"}
            onClick={() =>
              void run(() =>
                save({ avatar_kind: "initials", avatar_preset: null, avatar_path: null }),
              )
            }
          >
            {strings.profile.initials}
          </Button>
          <label
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
              uploadAllowed && !busy
                ? "cursor-pointer hover:bg-surface-2"
                : "cursor-not-allowed opacity-50",
            )}
          >
            <ImageUp aria-hidden="true" className="size-5" />
            {busy ? strings.profile.uploading : strings.profile.upload}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={!uploadAllowed || busy}
              aria-describedby="avatar-upload-hint"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) void run(() => upload(file), strings.profile.uploadInvalid);
              }}
            />
          </label>
        </div>
      </div>
      <p id="avatar-upload-hint" className="text-sm text-muted">
        {uploadAllowed ? strings.profile.uploadHint : strings.profile.uploadLocked}
      </p>
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">{strings.profile.presets}</legend>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2">
          {PRESETS.map((id, i) => (
            <button
              key={id}
              type="button"
              className={option}
              disabled={busy}
              aria-pressed={profile.avatar_kind === "preset" && profile.avatar_preset === id}
              onClick={() =>
                void run(() =>
                  save({ avatar_kind: "preset", avatar_preset: id, avatar_path: null }),
                )
              }
            >
              <img
                src={`/avatars/${id}.svg`}
                alt={fill(strings.profile.preset, { number: String(i + 1) })}
                width={48}
                height={48}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

const profileSchema = z.object({
  nickname: nicknameField,
  country: z.string(),
  bio: z.string().check(z.maxLength(160, { error: "bioTooLong" })),
});

function ProfileForm({
  strings,
  auth,
  countries,
  bcp47,
  profileBase,
  supabase,
  user,
  profile,
  onSaved,
}: SectionProps) {
  const messages = messagesFor(auth);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const changedAt = profile.nickname_changed_at ? new Date(profile.nickname_changed_at) : null;
  const unlock = changedAt ? new Date(changedAt.getTime() + COOLDOWN_DAYS * 86_400_000) : null;
  const [locked] = useState(() => unlock !== null && unlock.getTime() > Date.now());
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nickname: profile.nickname ?? "",
      country: profile.country ?? "",
      bio: profile.bio ?? "",
    },
  });

  const onSubmit = handleSubmit(async ({ nickname, country, bio }) => {
    setMessage(null);
    const change = {
      ...(nickname !== profile.nickname && { nickname }),
      country: country === "" ? null : country,
      bio: bio.trim() === "" ? null : bio.trim(),
    };
    const { error } = await supabase.from("profiles").update(change).eq("id", user.id);
    if (error) {
      const key = error.code === "23505" ? "nicknameTaken" : authErrorKey(error);
      if (error.message === "bio_blocked") {
        setError("bio", { type: "server", message: "bioBlocked" });
      } else if (key.startsWith("nickname")) {
        setError("nickname", { type: "server", message: key }, { shouldFocus: true });
      } else if (error.message === "nickname_cooldown") {
        setMessage({
          tone: "error",
          text: fill(strings.profile.nicknameCooldown, {
            date: unlock ? unlock.toLocaleDateString(bcp47) : "",
          }),
        });
      } else {
        setMessage({ tone: "error", text: strings.saveFailed });
      }
      return;
    }
    await syncAccount(supabase);
    await onSaved();
    setMessage({ tone: "success", text: strings.saved });
  });

  const bioError =
    errors.bio?.message === "bioBlocked"
      ? strings.profile.bioBlocked
      : errors.bio
        ? auth.errors.unknown
        : undefined;
  const nicknameHint =
    locked && unlock
      ? fill(strings.profile.nicknameCooldown, {
          date: unlock.toLocaleDateString(bcp47, { dateStyle: "long" }),
        })
      : strings.profile.nicknameHint;
  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
      <TextField
        id="settings-nickname"
        label={auth.fields.nickname}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        readOnly={locked}
        hint={nicknameHint}
        error={messages.field(errors.nickname)}
        {...register("nickname")}
      />
      <div className="grid gap-1.5">
        <label htmlFor="settings-country" className="font-semibold">
          {strings.profile.country}
        </label>
        <select
          id="settings-country"
          className="min-h-11 w-full cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          {...register("country")}
        >
          <option value="">{strings.profile.countryNone}</option>
          {countries.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="settings-bio" className="font-semibold">
          {strings.profile.bio}
        </label>
        <textarea
          id="settings-bio"
          rows={3}
          maxLength={160}
          aria-describedby="settings-bio-hint"
          aria-invalid={bioError ? true : undefined}
          className="w-full rounded-xl border border-border-strong bg-surface-2 p-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-invalid:border-danger"
          {...register("bio")}
        />
        <p id="settings-bio-hint" className="text-sm text-muted">
          {strings.profile.bioHint}
        </p>
        {bioError && <p className="text-sm font-semibold text-danger">{bioError}</p>}
      </div>
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {strings.profile.save}
        </Button>
        {profile.nickname && (
          <a
            href={`${profileBase}${encodeURIComponent(profile.nickname)}/`}
            className="font-semibold text-link underline-offset-4 hover:underline"
          >
            {strings.profile.view}
          </a>
        )}
      </div>
    </form>
  );
}
