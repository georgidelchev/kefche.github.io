// The i18n report (SPEC §14, Phase 10 step 9), for admins: per language,
// the keys it lacks and the strings still the same as English, from the
// locale files as they were when the site was built (a static JSON file).
// Read-only: translations change in the repository.
import { useEffect, useId, useMemo, useState } from "react";
import * as z from "zod/mini";

import { Input } from "@kefche/ui/components/input";

import { fill } from "@/features/auth/strings";
import { LOCALES, type Locale } from "@/i18n/locales";

import { Field, linkClass } from "./ui";

import type { I18nStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: I18nStrings };

const Report = z.object({
  locales: z.array(
    z.object({
      locale: z.enum(LOCALES),
      total: z.number(),
      missing: z.array(z.string()),
      same: z.array(z.tuple([z.string(), z.string()])),
    }),
  ),
});
type LocaleReport = z.infer<typeof Report>["locales"][number];

async function fetchReport(url: string): Promise<LocaleReport[] | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const report = Report.safeParse(await response.json());
    return report.success ? report.data.locales : null;
  } catch {
    return null;
  }
}

/** "game/chess:about.0" → its group ("game/chess") and key. */
const groupOf = (key: string) => key.slice(0, key.indexOf(":"));

export function I18nReport({ bcp47, paths, strings: s }: Props) {
  const id = useId();
  const [report, setReport] = useState<LocaleReport[] | null | "failed">(null);
  const [chosen] = useState<Locale | null>(() => {
    const value = new URLSearchParams(location.search).get("locale");
    return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : null;
  });
  const [filter, setFilter] = useState("");
  const names = useMemo(() => new Intl.DisplayNames(bcp47, { type: "language" }), [bcp47]);
  const number = (n: number) => n.toLocaleString(bcp47);
  const percent = (n: number, total: number) =>
    new Intl.NumberFormat(bcp47, { style: "percent", maximumFractionDigits: 1 }).format(
      total === 0 ? 0 : n / total,
    );

  useEffect(() => {
    void fetchReport(paths.i18nReport).then((next) => {
      setReport(next ?? "failed");
    });
  }, [paths.i18nReport]);

  if (report === null)
    return (
      <p className="text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  if (report === "failed") return <p role="alert">{s.failed}</p>;
  const detail = report.find((r) => r.locale === chosen);
  const words = filter.trim().toLocaleLowerCase();
  const same = (detail?.same ?? []).filter(
    ([key, text]) =>
      words === "" ||
      key.toLocaleLowerCase().includes(words) ||
      text.toLocaleLowerCase().includes(words),
  );
  const groups = new Map<string, [string, string][]>();
  for (const entry of same) {
    const list = groups.get(groupOf(entry[0])) ?? [];
    list.push(entry);
    groups.set(groupOf(entry[0]), list);
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby="i18n-summary" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="i18n-summary" className="text-xl">
            {s.summaryTitle}
          </h2>
          <p className="max-w-prose text-muted">{s.summaryBody}</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.map((r) => (
            <li
              key={r.locale}
              className={`grid gap-1 rounded-2xl border bg-surface p-3 ${r.locale === chosen ? "border-border-strong" : "border-border"}`}
            >
              <a
                href={`${paths.i18n}?locale=${r.locale}`}
                aria-current={r.locale === chosen ? "true" : undefined}
                className={`${linkClass} justify-self-start`}
              >
                {names.of(r.locale) ?? r.locale}
              </a>
              <span
                className={`text-sm ${r.missing.length > 0 ? "font-semibold text-danger" : "text-muted"}`}
              >
                {fill(s.missing, { count: number(r.missing.length) })}
              </span>
              <span className="text-sm text-muted">
                {fill(s.same, {
                  count: number(r.same.length),
                  percent: percent(r.same.length, r.total),
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {detail && (
        <section aria-labelledby="i18n-detail" className="grid gap-4">
          <h2 id="i18n-detail" className="text-xl">
            {names.of(detail.locale) ?? detail.locale}
          </h2>
          <div className="grid gap-2">
            <h3 className="text-base">{s.missingTitle}</h3>
            {detail.missing.length === 0 ? (
              <p className="text-muted">{s.noMissing}</p>
            ) : (
              <ul className="grid gap-1">
                {detail.missing.map((key) => (
                  <li key={key}>
                    <code className="text-sm break-all">{key}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <h3 className="text-base">{s.sameTitle}</h3>
              <p className="max-w-prose text-sm text-muted">{s.sameBody}</p>
            </div>
            <div className="max-w-md">
              <Field id={`${id}-filter`} label={s.filter} hint={s.filterHint}>
                <Input
                  id={`${id}-filter`}
                  type="search"
                  value={filter}
                  aria-describedby={`${id}-filter-hint`}
                  onChange={(e) => {
                    setFilter(e.currentTarget.value);
                  }}
                />
              </Field>
            </div>
            <p role="status" className="text-sm text-muted">
              {fill(s.shown, { count: number(same.length) })}
            </p>
            <div className="grid gap-2">
              {[...groups].map(([group, entries]) => (
                <details key={group} className="rounded-2xl border border-border bg-surface p-3">
                  <summary className="cursor-pointer font-semibold">
                    {group} · {number(entries.length)}
                  </summary>
                  <ul className="mt-2 grid gap-2">
                    {entries.map(([key, text]) => (
                      <li key={key} className="grid gap-0.5">
                        <code className="text-xs break-all text-muted">{key}</code>
                        <span lang="en" className="break-words">
                          {text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
