// A chat message's content in every chat: its GIF (from GIPHY's media
// domain, by id) and its text with safe links.
import { gifUrl } from "./gifs";
import { Linkified } from "./linkify";

export function MessageBody({
  body,
  gifId,
  gifAlt,
}: {
  body: string | null;
  gifId?: string | null;
  gifAlt: string;
}) {
  const src = gifId ? gifUrl(gifId) : null;
  return (
    <>
      {src && (
        <img
          src={src}
          alt={gifAlt}
          height={200}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="block h-auto max-h-48 max-w-full rounded-xl bg-surface-2"
        />
      )}
      {body !== null && body !== "" && (
        <span className="break-words whitespace-pre-wrap" dir="auto">
          <Linkified text={body} />
        </span>
      )}
    </>
  );
}
