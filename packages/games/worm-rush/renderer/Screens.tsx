// The screens before and around play: choosing a skin and the online or the
// solo arena, joining, and why the online arena can't be played (with the
// way on).
import { useEffect, useRef, type ComponentProps } from "react";

import type { GameContext } from "@kefche/game-sdk/browser";

import { SkinPicker } from "./SkinPicker";

type T = GameContext["t"];

export type Mode = "online" | "solo";

/** Why the online arena isn't playing. */
export type Problem = "unavailable" | "suspended" | "outdated" | "nickname" | "replaced";

const PROBLEM_KEYS = {
  unavailable: "unavailable",
  suspended: "suspendedOnline",
  outdated: "outdated",
  nickname: "needsName",
  replaced: "replaced",
} as const satisfies Record<Problem, string>;

function useFocusFirst<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

/** The setup: the skin, then the online arena (when this build has one) or the solo arena. */
export function ModeScreen({
  t,
  online,
  skins,
  onPick,
}: {
  t: T;
  online: boolean;
  skins: Omit<ComponentProps<typeof SkinPicker>, "t">;
  onPick: (mode: Mode) => void;
}) {
  const first = useFocusFirst<HTMLButtonElement>();
  return (
    <div className="gwr-screen">
      <section className="gwr-card" aria-labelledby="gwr-mode-title">
        <h2 id="gwr-mode-title">{t(online ? "modeTitle" : "soloTitle")}</h2>
        <SkinPicker t={t} {...skins} />
        <div className="gwr-modes">
          {online && (
            <button
              ref={first}
              type="button"
              className="gwr-mode"
              data-main=""
              // The site hides it while an admin has online arenas off (Phase 10).
              data-flag="online_arenas"
              onClick={() => {
                onPick("online");
              }}
            >
              <strong>{t("online")}</strong>
              <span>{t("onlineHint")}</span>
            </button>
          )}
          <button
            ref={online ? undefined : first}
            type="button"
            className="gwr-mode"
            data-main={online ? undefined : ""}
            onClick={() => {
              onPick("solo");
            }}
          >
            <strong>{t("solo")}</strong>
            <span>{t("soloHint")}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function Joining({ t }: { t: T }) {
  return (
    <div className="gwr-screen">
      <section className="gwr-card">
        <p className="gwr-joining" role="status">
          <span className="gwr-spinner" aria-hidden="true" />
          {t("connecting")}
        </p>
      </section>
    </div>
  );
}

export function ProblemScreen({
  t,
  problem,
  onRetry,
  onSolo,
}: {
  t: T;
  problem: Problem;
  onRetry: () => void;
  onSolo: () => void;
}) {
  const solo = useFocusFirst<HTMLButtonElement>();
  return (
    <div className="gwr-screen">
      <section className="gwr-card" role="alert">
        <p>{t(PROBLEM_KEYS[problem])}</p>
        <div className="gwr-actions">
          {problem !== "suspended" && problem !== "outdated" && (
            <button type="button" className="gwr-secondary" onClick={onRetry}>
              {t("tryAgain")}
            </button>
          )}
          <button ref={solo} type="button" className="gwr-primary" onClick={onSolo}>
            {t("playSolo")}
          </button>
        </div>
      </section>
    </div>
  );
}
