import { authErrorKey, isAuthErrorKey } from "../errors";

import type { AuthStrings } from "../strings";

/**
 * Translators for the forms: `field(errors.x)` turns a validation error whose
 * message is an AuthErrorKey into text, and `thrown(e)` handles anything
 * thrown by Supabase or the network.
 */
export function messagesFor(strings: AuthStrings) {
  return {
    field: (error: { message?: string | undefined } | undefined) =>
      error?.message === undefined
        ? undefined
        : strings.errors[isAuthErrorKey(error.message) ? error.message : "unknown"],
    thrown: (error: unknown) => strings.errors[authErrorKey(error)],
  };
}
