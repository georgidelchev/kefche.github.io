// The location packs (SPEC §5 content packs), one per language the game is
// offered in. Each must list PACK_SIZE places; the engine only knows their
// numbers.
import bg from "../content/bg.json";
import en from "../content/en.json";
import { PACK_SIZE, type Pack } from "../engine";

const PACKS: Record<Pack, readonly string[]> = { en: en.locations, bg: bg.locations };

for (const [pack, list] of Object.entries(PACKS)) {
  if (list.length !== PACK_SIZE)
    throw new Error(`Pack ${pack} has ${String(list.length)} locations, not ${String(PACK_SIZE)}`);
}

export const locationsOf = (pack: Pack): readonly string[] => PACKS[pack];
