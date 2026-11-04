// Safe links in chat text (SPEC §8.2): `https://` addresses become links
// that open in a new tab, marked as user content (rel="nofollow ugc
// noopener"); everything else stays text. Built as React elements: no user
// content is ever rendered as HTML.
import type { ReactNode } from "react";

const ADDRESS = /https:\/\/[^\s<>"'`]+/gu;
// Punctuation that ends a sentence rather than the address.
const TRAILING = /[.,;:!?)\]}»”’'"]+$/u;

/** The text with its `https://` addresses as links. */
export function Linkified({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const raw = match[0];
    const address = raw.slice(0, raw.length - (TRAILING.exec(raw)?.[0].length ?? 0));
    let href: string | null = null;
    try {
      const url = new URL(address);
      if (url.protocol === "https:" && url.hostname !== "") href = url.href;
    } catch {
      // Not an address after all: left as text.
    }
    if (!href) continue;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="nofollow ugc noopener"
        className="break-all text-link underline underline-offset-2"
      >
        {address}
      </a>,
    );
    last = match.index + address.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
