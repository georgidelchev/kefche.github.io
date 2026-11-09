// Small pieces the admin views share: a labelled field, and the classes of a
// native select (there's no Select component) and of an inline link.
import type { ReactNode } from "react";

export const selectClass =
  "min-h-11 w-full min-w-0 cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const linkClass =
  "rounded font-semibold text-text underline decoration-border-strong underline-offset-4 hover:decoration-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** A label above its control, with an optional hint (`${id}-hint`) below. */
export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Sorts a label map by label, for a select's options. */
export const byLabel = (labels: Record<string, string>, bcp47: string) =>
  Object.entries(labels).sort(([, a], [, b]) => a.localeCompare(b, bcp47));

/** A date and time in the page's language. */
export const dateTime = (iso: string, bcp47: string) =>
  new Intl.DateTimeFormat(bcp47, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
