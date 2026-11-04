// The GIF button of global chat and DMs: trending GIFs, or a search, from
// GIPHY through the giphy function, with "Powered by GIPHY" (its terms). A
// picked GIF is sent at once. Shown only in builds with GIFs on.
import { useEffect, useId, useState } from "react";

import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@kefche/ui/components/popover";

import type { Supabase } from "@/lib/supabase/client";

import { findGifs, gifUrl, type GifPage } from "./gifs";

import type { ChatToolsStrings } from "./strings";

/** Searches wait this long after the last key. */
const DEBOUNCE_MS = 400;

export function GifButton({
  supabase,
  strings: s,
  dir,
  onPick,
}: {
  supabase: Supabase;
  strings: ChatToolsStrings;
  dir: "ltr" | "rtl";
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={s.gif}>
          <span aria-hidden="true" className="text-xs font-bold">
            {s.gif}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" dir={dir} aria-label={s.gif}>
        {open && (
          <GifSearch
            supabase={supabase}
            strings={s}
            onPick={(id) => {
              setOpen(false);
              onPick(id);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function GifSearch({
  supabase,
  strings: s,
  onPick,
}: {
  supabase: Supabase;
  strings: ChatToolsStrings;
  onPick: (id: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<GifPage | "busy" | "failed" | null>(null);
  const [more, setMore] = useState(false);

  // Trending at first; a search once typing pauses.
  useEffect(() => {
    let stale = false;
    const timer = setTimeout(
      () => {
        void findGifs(supabase, query, 0, s.locale).then((next) => {
          if (!stale) setPage(next);
        });
      },
      query === "" ? 0 : DEBOUNCE_MS,
    );
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [supabase, query, s.locale]);

  async function loadMore() {
    if (!page || typeof page !== "object" || page.next === null || more) return;
    setMore(true);
    const next = await findGifs(supabase, query, page.next, s.locale);
    setMore(false);
    if (typeof next === "object") {
      setPage({ gifs: [...page.gifs, ...next.gifs], next: next.next });
    }
  }

  return (
    <div className="grid w-[min(20rem,calc(100vw-1rem))] gap-2 p-2">
      <label htmlFor={`${id}-q`} className="sr-only">
        {s.gifSearch}
      </label>
      <Input
        id={`${id}-q`}
        type="search"
        value={query}
        maxLength={50}
        placeholder={s.gifSearch}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
        }}
      />
      <div className="h-72 overflow-y-auto overscroll-contain" aria-busy={page === null}>
        {page === null ? (
          <p className="p-3 text-sm text-muted">{s.loading}</p>
        ) : page === "busy" || page === "failed" ? (
          <p role="alert" className="p-3 text-sm text-muted">
            {page === "busy" ? s.gifBusy : s.gifFailed}
          </p>
        ) : page.gifs.length === 0 ? (
          <p className="p-3 text-sm text-muted">{s.gifEmpty}</p>
        ) : (
          <>
            <ul className="columns-2 gap-1">
              {page.gifs.map((gif) => {
                const src = gifUrl(gif.id, "width");
                if (!src) return null;
                return (
                  <li key={gif.id} className="mb-1 break-inside-avoid">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(gif.id);
                      }}
                      className="block w-full cursor-pointer overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <img
                        src={src}
                        alt={gif.title || s.gifAlt}
                        width={200}
                        height={gif.width > 0 ? Math.round((200 * gif.height) / gif.width) : 200}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-auto w-full bg-surface-2"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
            {page.next !== null && (
              <Button
                variant="ghost"
                className="w-full"
                disabled={more}
                onClick={() => void loadMore()}
              >
                {s.gifMore}
              </Button>
            )}
          </>
        )}
      </div>
      <p className="text-end text-xs font-semibold text-muted">{s.gifPowered}</p>
    </div>
  );
}
