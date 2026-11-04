// The emoji button beside a chat's input: a picker in a popover; a picked
// emoji goes in at the caret.
import { Smile } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Button } from "@kefche/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@kefche/ui/components/popover";

import type { ChatToolsStrings } from "./strings";

const EmojiGrid = lazy(() => import("./EmojiGrid"));

export function EmojiButton({
  strings: s,
  dir,
  onPick,
}: {
  strings: ChatToolsStrings;
  dir: "ltr" | "rtl";
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={s.emoji}>
          <Smile aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" dir={dir} aria-label={s.emoji}>
        <Suspense fallback={<p className="p-4 text-sm text-muted">{s.loading}</p>}>
          <EmojiGrid
            strings={s}
            onPick={(emoji) => {
              setOpen(false);
              onPick(emoji);
            }}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
