// Chess analysis entry, loaded lazily by a finished game's page: the game
// from its PGN, stepped through with Stockfish's view of each position.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import type { AnalysisModule } from "@kefche/game-sdk/browser";

import { Analysis } from "./Analysis";
import { readRecord } from "./model";

export const analysis: AnalysisModule = {
  mount(container, context) {
    const record = readRecord(context.record);
    const root = createRoot(container);
    // A record that doesn't read leaves the page as it is (its PGN still shows).
    if (record) root.render(createElement(Analysis, { record, context }));
    return {
      destroy() {
        root.unmount();
      },
    };
  },
};
