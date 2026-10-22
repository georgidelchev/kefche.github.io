import { useEffect, useRef, useState } from "react";

import { FormMessage } from "@/features/auth/components/fields";

import { useAccount } from "./use-account";

import type { SettingsStrings } from "./strings";

interface Options {
  sound_master: number;
  sound_music: number;
  sound_effects: number;
  haptics: boolean;
  reduced_motion: string;
  privacy_messages: string;
  privacy_invites: string;
  show_online: boolean;
  show_in_leaderboards: boolean;
}
type Change = Partial<Options>;

const COLUMNS =
  "sound_master, sound_music, sound_effects, haptics, reduced_motion, privacy_messages, privacy_invites, show_online, show_in_leaderboards";

const selectClass =
  "min-h-11 w-full cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const checkClass = "size-5 cursor-pointer accent-brand";

interface Props {
  strings: SettingsStrings;
  group: "preferences" | "privacy";
  signInPath: string;
}

/** Preferences or privacy options; every change saves on its own (sliders after a pause). */
export function OptionsSettings({ strings, group, signInPath }: Props) {
  const account = useAccount(signInPath);
  const [options, setOptions] = useState<Options | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const pendingRef = useRef<Change>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (account.status !== "ready") return;
    void account.supabase
      .from("user_settings")
      .select(COLUMNS)
      .eq("user_id", account.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setStatus("failed");
        else setOptions(data);
      });
  }, [account]);

  function change(patch: Change, delay = 0) {
    if (account.status !== "ready") return;
    setOptions((current) => (current ? { ...current, ...patch } : current));
    pendingRef.current = { ...pendingRef.current, ...patch };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const save = pendingRef.current;
      pendingRef.current = {};
      void account.supabase
        .from("user_settings")
        .update(save)
        .eq("user_id", account.user.id)
        .then(({ error }) => {
          setStatus(error ? "failed" : "saved");
        });
    }, delay);
  }

  if (account.status === "error")
    return <FormMessage tone="error">{strings.saveFailed}</FormMessage>;
  if (!options) {
    return status === "failed" ? (
      <FormMessage tone="error">{strings.saveFailed}</FormMessage>
    ) : (
      <div className="min-h-32" aria-busy="true" />
    );
  }

  const p = strings.preferences;
  const s = strings.privacy;
  const audience = [
    ["everyone", s.everyone],
    ["friends", s.friends],
    ["nobody", s.nobody],
  ].map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));

  return (
    <div className="grid gap-5">
      {group === "preferences" ? (
        <>
          <fieldset className="grid gap-3">
            <legend className="mb-1 font-semibold">{p.sound}</legend>
            {(
              [
                ["sound_master", p.master],
                ["sound_music", p.music],
                ["sound_effects", p.effects],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1">
                <label htmlFor={`settings-${key}`}>{label}</label>
                <output htmlFor={`settings-${key}`} className="text-sm text-muted tabular-nums">
                  {options[key]}%
                </output>
                <input
                  id={`settings-${key}`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={options[key]}
                  onChange={(e) => {
                    change({ [key]: Number(e.currentTarget.value) }, 500);
                  }}
                  className="col-span-2 min-h-11 w-full cursor-pointer accent-brand"
                />
              </div>
            ))}
          </fieldset>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className={checkClass}
              checked={options.haptics}
              onChange={(e) => {
                change({ haptics: e.currentTarget.checked });
              }}
            />
            <span>
              {p.haptics} <span className="text-sm text-muted">{p.hapticsHint}</span>
            </span>
          </label>
          <div className="grid gap-1.5">
            <label htmlFor="settings-motion" className="font-semibold">
              {p.motion}
            </label>
            <select
              id="settings-motion"
              className={selectClass}
              value={options.reduced_motion}
              onChange={(e) => {
                change({ reduced_motion: e.currentTarget.value });
              }}
            >
              <option value="system">{p.motionSystem}</option>
              <option value="on">{p.motionReduce}</option>
              <option value="off">{p.motionFull}</option>
            </select>
          </div>
          <p className="text-sm text-muted">{p.gamesHint}</p>
        </>
      ) : (
        <>
          {(
            [
              ["privacy_messages", s.messages],
              ["privacy_invites", s.invites],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="grid gap-1.5">
              <label htmlFor={`settings-${key}`} className="font-semibold">
                {label}
              </label>
              <select
                id={`settings-${key}`}
                className={selectClass}
                value={options[key]}
                onChange={(e) => {
                  change({ [key]: e.currentTarget.value });
                }}
              >
                {audience}
              </select>
            </div>
          ))}
          {(
            [
              ["show_online", s.showOnline],
              ["show_in_leaderboards", s.showInLeaderboards],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className={checkClass}
                checked={options[key]}
                onChange={(e) => {
                  change({ [key]: e.currentTarget.checked });
                }}
              />
              {label}
            </label>
          ))}
        </>
      )}
      <p role="status" className="min-h-6 text-sm font-semibold">
        {status === "saved" && <span className="text-success">{strings.saved}</span>}
        {status === "failed" && <span className="text-danger">{strings.saveFailed}</span>}
      </p>
    </div>
  );
}
