import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useId } from "react";

import { useThemeStore, subscribeToOtherTabs } from "./theme-store";

import type { ThemePreference } from "./theme";

export interface ThemeSwitcherLabels {
  legend: string;
  light: string;
  dark: string;
  system: string;
}

const OPTIONS: readonly { value: ThemePreference; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/** Light / Dark / System as a native radio group (keyboard and screen readers for free). */
export function ThemeSwitcher({ labels }: { labels: ThemeSwitcherLabels }) {
  const groupId = useId();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  useEffect(() => {
    useThemeStore.getState().syncFromStorage();
    return subscribeToOtherTabs();
  }, []);

  return (
    <fieldset className="inline-flex rounded-full border border-border-strong bg-surface-2 p-0.5">
      <legend className="sr-only">{labels.legend}</legend>
      {OPTIONS.map(({ value, icon: Icon }) => (
        <label
          key={value}
          className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-text has-checked:bg-surface has-checked:text-text has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus motion-reduce:transition-none"
        >
          <input
            type="radio"
            name={groupId}
            value={value}
            checked={preference === value}
            onChange={() => {
              setPreference(value);
            }}
            className="sr-only"
          />
          <Icon aria-hidden="true" className="size-5" />
          <span className="sr-only">{labels[value]}</span>
        </label>
      ))}
    </fieldset>
  );
}
