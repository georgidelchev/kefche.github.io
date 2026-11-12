// Dev-only gallery island (pages/[locale]/dev/ui.astro): the speed kit's
// clock. The pad turns green after a random wait; the time shown runs from
// the frame that drew the green to the press's own timestamp.
import { useState } from "react";

import { humanReaction } from "@kefche/game-sdk";
import { KIT_CSS, SPEED_CSS, SpeedPad, useCountdown, useStimulus } from "@kefche/game-sdk/react";

type Phase = "idle" | "counting" | "waiting" | "go" | "done";

export function DevSpeed() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [result, setResult] = useState("");
  const clock = useStimulus(phase === "go" ? round : null);
  const count = useCountdown(phase === "counting" ? round : null, 3, () => {
    setPhase("waiting");
    setTimeout(
      () => {
        setPhase((p) => (p === "waiting" ? "go" : p));
      },
      500 + Math.random() * 1500,
    );
  });
  const press = (at: number) => {
    if (phase === "idle" || phase === "done") {
      setRound((r) => r + 1);
      setPhase("counting");
    } else if (phase === "waiting") {
      setResult("Too soon");
      setPhase("done");
    } else if (phase === "go") {
      const ms = clock.since(at);
      setResult(ms === null ? "?" : `${String(ms)} ms${humanReaction(ms) ? "" : " (a guess)"}`);
      setPhase("done");
    }
  };
  return (
    <div className="grid gap-2" data-phase={phase}>
      <style>{KIT_CSS + SPEED_CSS}</style>
      <SpeedPad
        onPress={press}
        style={
          phase === "go"
            ? { background: "var(--tile-good)", color: "var(--tile-good-ink)" }
            : undefined
        }
      >
        {count !== null ? (
          <span className="gk-count">{count}</span>
        ) : phase === "go" ? (
          "Now!"
        ) : phase === "waiting" ? (
          "Wait…"
        ) : (
          "Press to start"
        )}
      </SpeedPad>
      <p className="gk-big" data-result>
        {result}
      </p>
    </div>
  );
}
