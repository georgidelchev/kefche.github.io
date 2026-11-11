// Associations bots (SPEC §9.5). They know the pack's common associations
// for each prompt, most common first, and see only finished rounds.
// - Easy: any of the prompt's associations.
// - Medium: one of the three most common.
// - Hard: the most common, unless the other players keep matching on
//   something else; then it follows what they've been writing.
import type { Bot, GameBots } from "@kefche/game-sdk";

import { normalize, type Action, type State } from "../engine";
import { promptsOf } from "../renderer/packs";

function choices(s: State): readonly string[] {
  const prompt = s.prompts[s.history.length];
  return prompt === undefined ? [] : (promptsOf(s.config.pack)[prompt]?.associations ?? []);
}

const pick = (top: number): Bot<State, Action> => ({
  choose(s, _seat, { rng }) {
    const list = choices(s).slice(0, top);
    return { answer: list.length > 0 ? rng.pick(list) : "" };
  },
});

const hard: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    const list = choices(s);
    if (list.length === 0) return { answer: "" };
    // How often the others wrote a pack's first association, and its second.
    let first = 0;
    let second = 0;
    for (const round of s.history) {
      const known = promptsOf(s.config.pack)[round.prompt]?.associations ?? [];
      round.answers.forEach((a, p) => {
        if (p === seat) return;
        if (normalize(a) === normalize(known[0] ?? "")) first++;
        else if (normalize(a) === normalize(known[1] ?? "")) second++;
      });
    }
    const choice = second > first ? list[1] : rng.next() < 0.9 ? list[0] : list[1];
    return { answer: choice ?? list[0] ?? "" };
  },
};

export const bots: GameBots<State, Action> = { easy: pick(6), medium: pick(3), hard };
