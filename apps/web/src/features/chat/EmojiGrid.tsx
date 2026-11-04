// The emoji picker's grid and search (frimousse), loaded only when the
// picker opens. Its data is this site's copy of Emojibase in the page's
// language (pages/emoji/), so searching works in that language where
// Emojibase has it.
import {
  EmojiPicker,
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
} from "frimousse";

import type { ChatToolsStrings } from "./strings";

function CategoryHeader({ category, ...props }: EmojiPickerListCategoryHeaderProps) {
  return (
    <div {...props} className="bg-surface px-3 pt-2 pb-1 text-xs font-semibold text-muted">
      {category.label}
    </div>
  );
}

function Row({ children, ...props }: EmojiPickerListRowProps) {
  return (
    <div {...props} className="px-2">
      {children}
    </div>
  );
}

function EmojiCell({ emoji, ...props }: EmojiPickerListEmojiProps) {
  return (
    <button
      type="button"
      {...props}
      className="flex size-8 items-center justify-center rounded-lg text-xl data-[active]:bg-surface-2"
    >
      {emoji.emoji}
    </button>
  );
}

const LIST = { CategoryHeader, Row, Emoji: EmojiCell };

export default function EmojiGrid({
  strings: s,
  onPick,
}: {
  strings: ChatToolsStrings;
  onPick: (emoji: string) => void;
}) {
  return (
    <EmojiPicker.Root
      locale={s.emojiLocale}
      emojibaseUrl="/emoji"
      columns={8}
      onEmojiSelect={({ emoji }) => {
        onPick(emoji);
      }}
      className="flex h-80 w-[min(18.5rem,calc(100vw-1rem))] flex-col"
    >
      <EmojiPicker.Search
        aria-label={s.emojiSearch}
        placeholder={s.emojiSearch}
        className="m-2 min-h-11 rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-focus"
      />
      <EmojiPicker.Viewport className="relative flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          {s.loading}
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          {s.emojiEmpty}
        </EmojiPicker.Empty>
        <EmojiPicker.List className="pb-2 select-none" components={LIST} />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
