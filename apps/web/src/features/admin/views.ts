// One lazy chunk per admin section, loaded only once the panel knows its
// user is staff, so nobody else downloads admin code. A section without an
// entry isn't built yet. The import paths are literal so Vite can split them.
import type { Supabase } from "@/lib/supabase/client";

import type { AdminSectionId, StaffRole } from "./sections";
import type { ComponentType, LazyExoticComponent } from "react";

export interface AdminViewProps {
  supabase: Supabase;
  /** The staff member using the panel. */
  userId: string;
  roles: readonly StaffRole[];
}

export const ADMIN_VIEWS: Partial<
  Record<AdminSectionId, LazyExoticComponent<ComponentType<AdminViewProps>>>
> = {};
