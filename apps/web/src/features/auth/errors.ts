/** Every user-facing auth error; each has a translation under `auth:errors.*`. */
export const AUTH_ERROR_KEYS = [
  "required",
  "emailInvalid",
  "passwordWeak",
  "samePassword",
  "invalidCredentials",
  "emailNotConfirmed",
  "rateLimited",
  "linkExpired",
  "ageRestricted",
  "birthDateInvalid",
  "nicknameLength",
  "nicknameCharacters",
  "nicknameReserved",
  "nicknameBlocked",
  "nicknameTaken",
  "network",
  "unknown",
] as const;
export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

export const isAuthErrorKey = (value: unknown): value is AuthErrorKey =>
  (AUTH_ERROR_KEYS as readonly unknown[]).includes(value);

// Codes from Supabase Auth (error.code), our auth hook and RPCs (error
// message or return value), and check_nickname's bare codes.
const SERVER_CODES = new Map<string, AuthErrorKey>([
  ["invalid_credentials", "invalidCredentials"],
  ["email_not_confirmed", "emailNotConfirmed"],
  ["weak_password", "passwordWeak"],
  ["same_password", "samePassword"],
  ["over_request_rate_limit", "rateLimited"],
  ["over_email_send_rate_limit", "rateLimited"],
  ["rate_limited", "rateLimited"],
  ["otp_expired", "linkExpired"],
  ["flow_state_expired", "linkExpired"],
  ["flow_state_not_found", "linkExpired"],
  ["bad_code_verifier", "linkExpired"],
  ["age_restricted", "ageRestricted"],
  ["birth_date_invalid", "birthDateInvalid"],
  ["nickname_length", "nicknameLength"],
  ["nickname_characters", "nicknameCharacters"],
  ["nickname_reserved", "nicknameReserved"],
  ["nickname_blocked", "nicknameBlocked"],
  ["nickname_taken", "nicknameTaken"],
  ["length", "nicknameLength"],
  ["characters", "nicknameCharacters"],
  ["reserved", "nicknameReserved"],
  ["blocked", "nicknameBlocked"],
  ["taken", "nicknameTaken"],
]);

/** Maps a Supabase error, an RPC result code or a thrown value to a message key. */
export function authErrorKey(error: unknown): AuthErrorKey {
  if (typeof error === "string") return SERVER_CODES.get(error) ?? "unknown";
  // fetch() rejects with a TypeError when the network is down.
  if (error instanceof TypeError) return "network";
  if (typeof error === "object" && error !== null) {
    const { message, code, name } = error as { message?: unknown; code?: unknown; name?: unknown };
    if (typeof message === "string" && SERVER_CODES.has(message)) {
      return SERVER_CODES.get(message) ?? "unknown";
    }
    if (typeof code === "string" && SERVER_CODES.has(code))
      return SERVER_CODES.get(code) ?? "unknown";
    if (name === "AuthRetryableFetchError") return "network";
  }
  return "unknown";
}
