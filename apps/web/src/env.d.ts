// Astro's built-in declarations (astro:* modules, import.meta.glob/env,
// ?raw imports). Referenced here so ESLint and editors resolve them on a fresh
// checkout too; otherwise they only arrive with the generated .astro/types.d.ts.
/// <reference types="astro/client" />

// Raw, unvalidated shape. Server code reads them through `getSupabaseEnv()` in
// `@/lib/env`; client code through `supabaseConfig` in `@/lib/supabase/config`.
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
