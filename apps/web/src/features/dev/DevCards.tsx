// Dev-only gallery island (pages/[locale]/dev/ui.astro): the card kit's deck
// in both colourings, face-down cards and a playable hand. Card names come
// from the real translations (cardKitUi), so screen readers can be checked.
import { useState } from "react";

import { ACE, card, HIDDEN, SUITS, sortHand, type Card, type Rank } from "@kefche/game-sdk";
import {
  CARD_CSS,
  CardBacks,
  cardText,
  FourColourToggle,
  Hand,
  KIT_CSS,
  PlayingCard,
  useFourColour,
} from "@kefche/game-sdk/react";

const RANKS = Array.from({ length: 13 }, (_, i) => (i + 2) as Rank);
const START: Card[] = sortHand([
  card("spades", ACE),
  card("hearts", 12),
  card("hearts", 7),
  card("clubs", 10),
  card("clubs", 2),
  card("diamonds", 13),
  card("diamonds", 11),
  card("spades", 9),
]);

export function DevCards({ ui }: { ui: Record<string, string> }) {
  const text = cardText((key, values) =>
    (ui[key] ?? key).replace(/\{(\w+)\}/g, (m, k: string) => String(values?.[k] ?? m)),
  );
  const [four] = useFourColour();
  const [hand, setHand] = useState(START);
  const [played, setPlayed] = useState<Card[]>([]);
  return (
    <div className="grid gap-4">
      <style>{KIT_CSS + CARD_CSS}</style>
      <div className="flex items-center gap-3">
        <FourColourToggle label={text.fourColour} />
        <span className="text-sm text-muted">{text.fourColour}</span>
      </div>
      {SUITS.map((suit) => (
        <div
          key={suit}
          className="flex flex-wrap gap-1"
          style={{ ["--card-w" as string]: "3.5rem" }}
        >
          {RANKS.map((rank) => (
            <PlayingCard
              key={rank}
              card={card(suit, rank)}
              four={four}
              label={text.name(card(suit, rank))}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-4">
        <PlayingCard card={HIDDEN} label={text.faceDown} />
        <CardBacks count={7} label="7" />
      </div>
      <div className="flex min-h-24 gap-1">
        {played.map((c) => (
          <PlayingCard key={c} card={c} four={four} label={text.name(c)} />
        ))}
      </div>
      <Hand
        cards={hand}
        text={text}
        label="Hand"
        four={four}
        canPlay={(c) => c !== card("spades", 9)}
        onPlay={(c) => {
          setHand((h) => h.filter((x) => x !== c));
          setPlayed((p) => [...p, c]);
        }}
      />
    </div>
  );
}
