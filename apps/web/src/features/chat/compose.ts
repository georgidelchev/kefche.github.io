/**
 * `added` put into an input at its caret (replacing any selection), within
 * `max` characters: the new value and where the caret goes, or null when
 * it wouldn't fit.
 */
export function insertText(
  input: HTMLInputElement | null,
  value: string,
  added: string,
  max: number,
): { value: string; caret: number } | null {
  const start = input?.selectionStart ?? value.length;
  const end = input?.selectionEnd ?? start;
  const next = value.slice(0, start) + added + value.slice(end);
  return next.length > max ? null : { value: next, caret: start + added.length };
}
