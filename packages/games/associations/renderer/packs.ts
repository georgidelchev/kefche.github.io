// The prompt packs (SPEC §5 content packs), one per language the game is
// offered in: each prompt with its most common associations, most common
// first (the bots draw on them). Each must list PACK_SIZE prompts; the
// engine only knows their numbers.
import bg from "../content/bg.json";
import en from "../content/en.json";
import { PACK_SIZE, type Pack } from "../engine";

export interface Prompt {
  word: string;
  associations: readonly string[];
}

const PACKS: Record<Pack, readonly Prompt[]> = { en: en.prompts, bg: bg.prompts };

for (const [pack, list] of Object.entries(PACKS)) {
  if (list.length !== PACK_SIZE)
    throw new Error(`Pack ${pack} has ${String(list.length)} prompts, not ${String(PACK_SIZE)}`);
}

export const promptsOf = (pack: Pack): readonly Prompt[] => PACKS[pack];
