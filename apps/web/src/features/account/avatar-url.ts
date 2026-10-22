/** The avatar fields of a profile row. */
export interface AvatarFields {
  avatar_kind: string;
  avatar_preset: string | null;
  avatar_path: string | null;
}

/**
 * Image URL for a profile's avatar, or null for the initials avatar (SPEC
 * §7.2). Presets are static files in public/avatars/; uploads live in the
 * public `avatars` Storage bucket.
 */
export function avatarUrl(profile: AvatarFields, supabaseUrl: string): string | null {
  if (profile.avatar_kind === "preset" && profile.avatar_preset) {
    return `/avatars/${profile.avatar_preset}.svg`;
  }
  if (profile.avatar_kind === "upload" && profile.avatar_path) {
    const path = profile.avatar_path.split("/").map(encodeURIComponent).join("/");
    return `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;
  }
  return null;
}
