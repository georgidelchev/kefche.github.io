// Public entry, loaded lazily by the player when Play is pressed.
import type { GameModule } from "@kefche/game-sdk/browser";

import { mount } from "./renderer/mount";

export const game: GameModule = { mount };
