// Client-side mirrors of the server rules (supabase/migrations, config.toml),
// for instant feedback. The server stays authoritative. Error messages are
// AuthErrorKey values, translated by the forms. zod/mini: ships to the browser.
import * as z from "zod/mini";

import type { AuthErrorKey } from "./errors";

const err = (key: AuthErrorKey) => ({ error: key });

export const emailField = z
  .string()
  .check(z.trim(), z.minLength(1, err("required")), z.email(err("emailInvalid")));

// config.toml: minimum_password_length = 10, password_requirements = "letters_digits".
export const passwordField = z
  .string()
  .check(
    z.minLength(1, err("required")),
    z.minLength(10, err("passwordWeak")),
    z.regex(/[A-Za-z]/, err("passwordWeak")),
    z.regex(/\d/, err("passwordWeak")),
  );

// private.nickname_problem(): 3–20 characters; letters, digits, _ and .; no dot
// at either end or two in a row. Reserved and blocked words are server-only.
export const nicknameField = z.string().check(
  z.trim(),
  z.minLength(1, err("required")),
  // Counted in code points, like Postgres char_length().
  z.refine((v) => {
    const length = Array.from(v.normalize("NFC")).length;
    return length >= 3 && length <= 20;
  }, err("nicknameLength")),
  z.regex(/^[\p{L}\p{N}_.]+$/u, err("nicknameCharacters")),
  z.refine((v) => !/^\.|\.$|\.\./.test(v), err("nicknameCharacters")),
);

/** Age in whole years; the birth month counts as not yet reached (as on the server). */
export function ageFrom(year: number, month: number, now = new Date()): number {
  return now.getFullYear() - year - (month >= now.getMonth() + 1 ? 1 : 0);
}

/** Month and year arrive from <select>s as strings ("" when unset). */
export const birthDateShape = {
  birthMonth: z.string().check(z.minLength(1, err("required"))),
  birthYear: z.string().check(z.minLength(1, err("required"))),
};

interface BirthDateValues {
  birthMonth: string;
  birthYear: string;
}

/**
 * Cross-field birth date checks for any object containing `birthDateShape`
 * (Zod can't extend an object that already has refinements, so forms add
 * these to their own object). Errors land on `birthYear`.
 */
export function birthDateChecks<T extends BirthDateValues>() {
  // Empty selects are reported by `required` above.
  const filled = (v: T) => v.birthMonth !== "" && v.birthYear !== "";
  const valid = (v: T) => {
    const month = Number(v.birthMonth);
    const year = Number(v.birthYear);
    return (
      Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year) && year >= 1900
    );
  };
  return [
    z.refine<T>((v) => !filled(v) || valid(v), { ...err("birthDateInvalid"), path: ["birthYear"] }),
    z.refine<T>(
      (v) => !filled(v) || !valid(v) || ageFrom(Number(v.birthYear), Number(v.birthMonth)) >= 13,
      {
        ...err("ageRestricted"),
        path: ["birthYear"],
      },
    ),
  ] as const;
}
