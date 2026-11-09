// Links between the admin views.
import type { AdminPaths } from "../views";

/** A player's page in the panel: the Players section with their id. */
export const playerPage =
  (paths: AdminPaths) =>
  (id: string): string =>
    `${paths.users}?player=${encodeURIComponent(id)}`;
