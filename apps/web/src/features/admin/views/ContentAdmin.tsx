// The Content section (SPEC §14, Phase 10 step 8), for admins:
// announcements written per language with a preview, an audience, a time
// and an optional place in the home page's news; the daily challenge's
// next two weeks; the Word of the Day; and the achievements, read-only.
// Every change goes through an audited RPC; one status line says how each
// went.
import { Megaphone } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Badge } from "@kefche/ui/components/badge";
import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";
import { EmptyState } from "@kefche/ui/components/states";

import { fill } from "@/features/auth/strings";
import { LOCALES, type Locale } from "@/i18n/locales";

import { ConfirmDialog } from "./ConfirmDialog";
import {
  configText,
  dayText,
  draftOf,
  emptyDraft,
  fetchAnnouncements,
  fetchSchedule,
  fetchWords,
  removeAnnouncement,
  saveAnnouncement,
  sendsNow,
  setDaily,
  setWord,
  todayUtc,
  type Announcement,
  type AnnouncementDraft,
  type Audience,
  type Schedule,
  type Word,
} from "./content-data";
import { errorText } from "./PlayerActions";
import { dateTime, Field, selectClass } from "./ui";

import type { ContentStrings, PlayersStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: ContentStrings; players: PlayersStrings };

interface Pending {
  title: string;
  body: string;
  confirm: string;
  danger: boolean;
  run: () => Promise<string | null>;
}
interface Shared {
  ask: (pending: Pending) => void;
  /** Runs a change at once (no confirmation) and says how it went. */
  act: (run: () => Promise<string | null>) => Promise<boolean>;
  version: number;
}
type Section = Props & Shared;

const textareaClass =
  "min-h-20 w-full min-w-0 rounded-xl border border-border-strong bg-surface-2 px-3 py-2 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const languageNames = (bcp47: string) => {
  const names = new Intl.DisplayNames(bcp47, { type: "language" });
  return (locale: string) => names.of(locale) ?? locale;
};

export function ContentAdmin(props: Props) {
  const { strings: s, players } = props;
  const [pending, setPending] = useState<Pending | null>(null);
  const [opened, setOpened] = useState(0);
  const [version, setVersion] = useState(0);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const report = (error: string | null) => {
    setVersion((n) => n + 1);
    setOutcome(
      error === null
        ? { ok: true, text: s.done }
        : { ok: false, text: s.errors[error] ?? errorText(error, players.act) },
    );
    return error === null;
  };
  const shared: Shared = {
    ask: (next) => {
      setOutcome(null);
      setOpened((n) => n + 1);
      setPending(next);
    },
    act: async (run) => {
      setOutcome(null);
      return report(await run());
    },
    version,
  };

  return (
    <div className="grid gap-10">
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted empty:hidden"}
      >
        {outcome?.text ?? ""}
      </p>
      <Part id="content-news" title={s.announcementsTitle} body={s.announcementsBody}>
        <Announcements {...props} {...shared} />
      </Part>
      <Part id="content-daily" title={s.dailyTitle} body={s.dailyBody}>
        <Daily {...props} {...shared} />
      </Part>
      <Part id="content-words" title={s.wordsTitle} body={s.wordsBody}>
        <Words {...props} {...shared} />
      </Part>
      <Part id="content-achievements" title={s.achievementsTitle} body={s.achievementsBody}>
        <Achievements {...props} />
      </Part>
      {pending !== null && (
        <ConfirmDialog
          key={opened}
          title={pending.title}
          body={pending.body}
          confirm={pending.confirm}
          danger={pending.danger}
          strings={players.act}
          onClose={() => {
            setPending(null);
          }}
          onConfirm={async () => {
            const error = await pending.run();
            setPending(null);
            report(error);
          }}
        />
      )}
    </div>
  );
}

function Part({
  id,
  title,
  body,
  children,
}: {
  id: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <div className="grid gap-1">
        <h2 id={id} className="text-xl">
          {title}
        </h2>
        <p className="max-w-prose text-muted">{body}</p>
      </div>
      {children}
    </section>
  );
}

const Loading = ({ text }: { text: string }) => (
  <p className="text-muted" aria-busy="true">
    {text}
  </p>
);

function Announcements(props: Section) {
  const { supabase, bcp47, strings: s, ask, version } = props;
  const [list, setList] = useState<Announcement[] | null | "failed">(null);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft);
  const [editor, setEditor] = useState(0);
  const language = languageNames(bcp47);

  useEffect(() => {
    void fetchAnnouncements(supabase).then((next) => {
      setList(next ?? "failed");
    });
  }, [supabase, version]);

  const audienceText = (a: { audience: Audience; locale: string | null }) =>
    a.audience === "language"
      ? fill(s.audienceLanguage, { language: language(a.locale ?? "en") })
      : s.audiences[a.audience];

  return (
    <div className="grid gap-6">
      <Editor
        key={editor}
        {...props}
        draft={draft}
        onDone={() => {
          setDraft(emptyDraft());
          setEditor((n) => n + 1);
        }}
      />
      {list === null && <Loading text={s.loading} />}
      {list === "failed" && <p role="alert">{s.failed}</p>}
      {Array.isArray(list) &&
        (list.length === 0 ? (
          <EmptyState icon={<Megaphone />} title={s.noAnnouncements} />
        ) : (
          <ul className="grid gap-3">
            {list.map((a) => (
              <li key={a.id} className="grid gap-2 rounded-2xl border border-border bg-surface p-4">
                <p className="break-words" dir="auto">
                  {a.texts.en}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span>{audienceText(a)}</span>
                  <span>
                    {a.sent_at === null
                      ? fill(s.scheduled, { date: dateTime(a.send_at, bcp47) })
                      : fill(s.sentTo, {
                          date: dateTime(a.sent_at, bcp47),
                          count: (a.recipients ?? 0).toLocaleString(bcp47),
                        })}
                  </span>
                  <span>
                    {fill(s.languagesCount, {
                      count: Object.keys(a.texts).length.toLocaleString(bcp47),
                    })}
                  </span>
                  {a.ticker && <Badge variant="accent">{s.inNews}</Badge>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {a.sent_at === null && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraft(draftOf(a));
                        setEditor((n) => n + 1);
                      }}
                    >
                      {s.edit}
                    </Button>
                  )}
                  {a.sent_at === null ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        ask({
                          title: s.deleteTitle,
                          body: s.deleteBody,
                          confirm: s.delete,
                          danger: true,
                          run: () => removeAnnouncement(supabase, a.id),
                        });
                      }}
                    >
                      {s.delete}
                    </Button>
                  ) : (
                    a.ticker && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          ask({
                            title: s.untickTitle,
                            body: s.untickBody,
                            confirm: s.untick,
                            danger: false,
                            run: () => removeAnnouncement(supabase, a.id),
                          });
                        }}
                      >
                        {s.untick}
                      </Button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function Editor({
  supabase,
  bcp47,
  strings: s,
  ask,
  act,
  draft: initial,
  onDone,
}: Section & { draft: AnnouncementDraft; onDone: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState(initial);
  const [preview, setPreview] = useState<Locale>("en");
  const language = languageNames(bcp47);
  const set = (patch: Partial<AnnouncementDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  const english = (draft.texts.en ?? "").trim();
  const shown = (draft.texts[preview] ?? "").trim();

  function submit() {
    const save = () => saveAnnouncement(supabase, draft);
    const finish = (ok: boolean) => {
      if (ok) onDone();
    };
    if (sendsNow(draft)) {
      ask({
        title: s.sendTitle,
        body: fill(s.sendBody, {
          audience:
            draft.audience === "language"
              ? fill(s.audienceLanguage, { language: language(draft.locale) })
              : s.audiences[draft.audience],
        }),
        confirm: s.send,
        danger: false,
        run: async () => {
          const error = await save();
          if (error === null) onDone();
          return error;
        },
      });
      return;
    }
    void act(save).then(finish);
  }

  return (
    <form
      aria-label={draft.id ? s.editAnnouncement : s.newAnnouncement}
      className="grid gap-4 rounded-2xl border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h3 className="text-lg">{draft.id ? s.editAnnouncement : s.newAnnouncement}</h3>
      <p id={`${id}-texts-hint`} className="text-sm text-muted">
        {s.textHint}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {LOCALES.map((locale) => (
          <Field
            key={locale}
            id={`${id}-${locale}`}
            label={fill(s.textIn, { language: language(locale) })}
          >
            <textarea
              id={`${id}-${locale}`}
              lang={locale}
              dir="auto"
              maxLength={500}
              required={locale === "en"}
              value={draft.texts[locale] ?? ""}
              aria-describedby={`${id}-texts-hint`}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  texts: { ...current.texts, [locale]: value },
                }));
              }}
              className={textareaClass}
            />
          </Field>
        ))}
      </div>
      <div className="grid gap-3 rounded-xl bg-surface-2 p-3">
        <div className="max-w-xs">
          <Field id={`${id}-preview`} label={s.preview}>
            <select
              id={`${id}-preview`}
              value={preview}
              onChange={(e) => {
                setPreview(e.currentTarget.value as Locale);
              }}
              className={selectClass}
            >
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {language(locale)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div
          className="grid gap-1 rounded-xl border border-border bg-surface p-3"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 font-semibold">
            <Megaphone aria-hidden="true" className="size-4" />
            <span lang={shown ? preview : "en"} dir="auto" className="break-words">
              {shown || english || s.previewEmpty}
            </span>
          </p>
          {!shown && english !== "" && preview !== "en" && (
            <p className="text-sm text-muted">{s.fallback}</p>
          )}
          {draft.url.trim() !== "" && <p className="text-sm text-muted">{draft.url.trim()}</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id={`${id}-url`} label={s.url} hint={s.urlHint}>
          <Input
            id={`${id}-url`}
            value={draft.url}
            maxLength={300}
            aria-describedby={`${id}-url-hint`}
            onChange={(e) => {
              set({ url: e.currentTarget.value });
            }}
          />
        </Field>
        <Field id={`${id}-audience`} label={s.audience}>
          <select
            id={`${id}-audience`}
            value={draft.audience}
            onChange={(e) => {
              set({ audience: e.currentTarget.value as Audience });
            }}
            className={selectClass}
          >
            {(["everyone", "language", "staff"] as const).map((value) => (
              <option key={value} value={value}>
                {s.audiences[value]}
              </option>
            ))}
          </select>
        </Field>
        {draft.audience === "language" && (
          <Field id={`${id}-locale`} label={s.language}>
            <select
              id={`${id}-locale`}
              value={draft.locale}
              onChange={(e) => {
                set({ locale: e.currentTarget.value as Locale });
              }}
              className={selectClass}
            >
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {language(locale)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id={`${id}-send`} label={s.sendAt} hint={s.sendAtHint}>
          <Input
            id={`${id}-send`}
            type="datetime-local"
            value={draft.sendAt}
            aria-describedby={`${id}-send-hint`}
            onChange={(e) => {
              set({ sendAt: e.currentTarget.value });
            }}
          />
        </Field>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={draft.ticker}
          onChange={(e) => {
            set({ ticker: e.currentTarget.checked });
          }}
          className="size-5 cursor-pointer accent-brand"
        />
        {s.ticker}
      </label>
      {draft.ticker && (
        <div className="max-w-xs">
          <Field id={`${id}-until`} label={s.tickerUntil} hint={s.tickerUntilHint}>
            <Input
              id={`${id}-until`}
              type="datetime-local"
              value={draft.tickerUntil}
              aria-describedby={`${id}-until-hint`}
              onChange={(e) => {
                set({ tickerUntil: e.currentTarget.value });
              }}
            />
          </Field>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={english === ""}>
          {sendsNow(draft) ? s.send : s.schedule}
        </Button>
        {draft.id !== null && (
          <Button variant="outline" type="button" onClick={onDone}>
            {s.cancelEdit}
          </Button>
        )}
      </div>
    </form>
  );
}

function Daily({ supabase, bcp47, strings: s, players, act, version }: Section) {
  const id = useId();
  const [schedule, setSchedule] = useState<Schedule | null | "failed">(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  useEffect(() => {
    void fetchSchedule(supabase).then((next) => {
      setSchedule(next ?? "failed");
      setChosen({});
    });
  }, [supabase, version]);
  if (schedule === null) return <Loading text={s.loading} />;
  if (schedule === "failed") return <p role="alert">{s.failed}</p>;
  const today = todayUtc();
  const label = (gameId: string, config: Record<string, unknown>) => {
    const settings = configText(config);
    return `${players.games[gameId] ?? gameId}${settings ? ` (${settings})` : ""}`;
  };
  return (
    <ul className="grid gap-2">
      {schedule.days.map((day) => {
        const value = chosen[day.day] ?? "";
        return (
          <li
            key={day.day}
            className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface p-3"
          >
            <div className="grid min-w-48 flex-1 gap-0.5">
              <span className="font-semibold">{dayText(day.day, bcp47)}</span>
              <span className="text-sm text-muted">
                {label(day.gameId, day.config)}
                {day.chosen && ` · ${s.chosen}`}
              </span>
            </div>
            {day.day <= today ? (
              <span className="text-sm text-muted">{s.dayLocked}</span>
            ) : (
              <>
                <div className="min-w-56 flex-1 sm:flex-none">
                  <Field
                    id={`${id}-${day.day}`}
                    label={fill(s.challengeOn, { date: dayText(day.day, bcp47) })}
                  >
                    <select
                      id={`${id}-${day.day}`}
                      value={value}
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setChosen((current) => ({ ...current, [day.day]: next }));
                      }}
                      className={selectClass}
                    >
                      <option value="">{s.keep}</option>
                      <option value="rotation">{s.rotation}</option>
                      {schedule.choices.map((choice) => (
                        <option key={choice.position} value={String(choice.position)}>
                          {label(choice.gameId, choice.config)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Button
                  variant="outline"
                  disabled={value === ""}
                  aria-label={fill(s.saveDay, { date: dayText(day.day, bcp47) })}
                  onClick={() =>
                    void act(() =>
                      setDaily(supabase, day.day, value === "rotation" ? null : Number(value)),
                    )
                  }
                >
                  {s.save}
                </Button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Words({ supabase, bcp47, strings: s, ask, act, version }: Section) {
  const id = useId();
  const [words, setWords] = useState<Word[] | null | "failed">(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [day, setDay] = useState(() => todayUtc());
  const [wordText, setWordText] = useState("");
  const [meaning, setMeaning] = useState("");
  const language = languageNames(bcp47);
  useEffect(() => {
    void fetchWords(supabase).then((next) => {
      setWords(next ?? "failed");
    });
  }, [supabase, version]);
  return (
    <div className="grid gap-4">
      <form
        aria-label={s.wordsTitle}
        className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => setWord(supabase, locale, day, wordText, meaning)).then((ok) => {
            if (ok) {
              setWordText("");
              setMeaning("");
            }
          });
        }}
      >
        <Field id={`${id}-locale`} label={s.language}>
          <select
            id={`${id}-locale`}
            value={locale}
            onChange={(e) => {
              setLocale(e.currentTarget.value as Locale);
            }}
            className={selectClass}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {language(l)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-day`} label={s.day} hint={s.dayHint}>
          <Input
            id={`${id}-day`}
            type="date"
            min={todayUtc()}
            required
            value={day}
            aria-describedby={`${id}-day-hint`}
            onChange={(e) => {
              setDay(e.currentTarget.value);
            }}
          />
        </Field>
        <Field id={`${id}-word`} label={s.word}>
          <Input
            id={`${id}-word`}
            lang={locale}
            required
            maxLength={40}
            value={wordText}
            onChange={(e) => {
              setWordText(e.currentTarget.value);
            }}
          />
        </Field>
        <Field id={`${id}-meaning`} label={s.meaning}>
          <Input
            id={`${id}-meaning`}
            lang={locale}
            maxLength={300}
            value={meaning}
            onChange={(e) => {
              setMeaning(e.currentTarget.value);
            }}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit">{s.setWord}</Button>
        </div>
      </form>
      {words === null && <Loading text={s.loading} />}
      {words === "failed" && <p role="alert">{s.failed}</p>}
      {Array.isArray(words) &&
        (words.length === 0 ? (
          <p className="text-muted">{s.noWords}</p>
        ) : (
          <ul className="grid gap-2">
            {words.map((w) => (
              <li
                key={`${w.locale}:${w.day}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface p-3"
              >
                <span className="text-sm text-muted">{dayText(w.day, bcp47)}</span>
                <span className="text-sm text-muted">{language(w.locale)}</span>
                <span lang={w.locale} className="font-semibold">
                  {w.word}
                </span>
                {w.meaning !== null && (
                  <span lang={w.locale} className="min-w-0 break-words text-muted">
                    {w.meaning}
                  </span>
                )}
                <Button
                  variant="outline"
                  className="ms-auto"
                  aria-label={fill(s.removeWordLabel, { word: w.word })}
                  onClick={() => {
                    ask({
                      title: fill(s.removeWordTitle, { word: w.word }),
                      body: s.removeWordBody,
                      confirm: s.remove,
                      danger: true,
                      run: () => setWord(supabase, w.locale, w.day, "", ""),
                    });
                  }}
                >
                  {s.remove}
                </Button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function Achievements({ strings: s }: Props) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {s.achievements.map((a) => (
        <li key={a.key} className="grid gap-1 rounded-2xl border border-border bg-surface p-4">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-semibold">{a.name}</span>
            <span className="text-sm text-muted">{a.game ?? s.siteWide}</span>
          </p>
          <ul className="grid gap-0.5 text-sm">
            {a.tiers.map((tier) => (
              <li key={tier.tier}>
                <span className="font-semibold">{tier.tier}</span>: {tier.description}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
