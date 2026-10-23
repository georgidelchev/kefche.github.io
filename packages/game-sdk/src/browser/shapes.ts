// Player shapes as SVG path data in a 24 × 24 box, for pieces drawn by games
// (discs, markers on edges). The same shapes as `PlayerMarker` in
// `@kefche/ui`, so a seat looks the same in the HUD and on the board.

import type { PlayerShape } from "../seats";

export const SHAPE_PATHS: Readonly<Record<PlayerShape, string>> = {
  circle: "M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z",
  square: "M7.5 6.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z",
  triangle: "M12 5.5 18.5 17.5h-13z",
  diamond: "M12 4.5 19.5 12 12 19.5 4.5 12z",
  star: "m12 4.5 2.2 4.6 5 .7-3.6 3.5.9 5L12 16l-4.5 2.3.9-5-3.6-3.5 5-.7z",
  hexagon: "M12 4.5 18.5 8.25v7.5L12 19.5l-6.5-3.75v-7.5z",
  cross: "M10 5.5h4v4.5h4.5v4H14v4.5h-4V14H5.5v-4H10z",
  heart: "M12 19s-7-4.4-7-9.2a3.6 3.6 0 0 1 7-1.6 3.6 3.6 0 0 1 7 1.6C19 14.6 12 19 12 19z",
};
