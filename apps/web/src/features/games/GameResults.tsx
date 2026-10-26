// One results screen for every game (SPEC §12.6, Phase 7 step 9): the
// result, then what the game gave an account (the best so far, the XP with
// the level bar, its leaderboard places, the achievements it unlocked, with a toast each), any rating
// change, the game's own actions (play again, rematch…) and Share. Guests
// are asked to sign in instead. Loaded lazily by the players.
import {
  Compass,
  Crown,
  Flame,
  Gamepad2,
  LoaderCircle,
  Medal,
  Repeat,
  Share2,
  Star,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  levelForXp,
  levelProgress,
  type AchievementIcon,
  type AchievementTier,
  type GameResult,
} from "@kefche/game-sdk";
import { formatDuration } from "@kefche/game-sdk/browser";
import { Button } from "@kefche/ui/components/button";
import { toast, Toaster } from "@kefche/ui/components/toast";

import { Overlay } from "./player-parts";
import { fill } from "./turn/labels";

import type { RewardsState } from "./rewards";

export interface ResultsStrings {
  /** "Best: {value}" */
  best: string;
  newBest: string;
  /** "+{xp} XP" */
  xp: string;
  /** "Level {level}" */
  level: string;
  /** "Level up! You're now level {level}." */
  levelUp: string;
  /** "{into} of {span} XP to level {next}" */
  xpToNext: string;
  /** "{board}: #{all} all time, #{week} this week" */
  place: string;
  /** "Today's challenge: #{rank}" */
  dailyPlace: string;
  /** This game's boards by id ("<game>.<board>"): each one's name and page. */
  boards: Record<string, { name: string; href: string }>;
  achievements: string;
  /** The toast's title. */
  unlocked: string;
  saving: string;
  guest: string;
  signIn: string;
  /** The sign-in page; the player comes back here afterwards. */
  signInHref: string;
  share: string;
  copied: string;
  /** "{result} · {game} on kefche" */
  shareText: string;
  notifications: string;
  close: string;
  tiers: Record<AchievementTier, string>;
  /** This game's achievements and the site-wide ones, by "<scope>.<id>". */
  achievementNames: Record<string, { name: string; icon: AchievementIcon }>;
}

const ICONS: Record<AchievementIcon, typeof Trophy> = {
  trophy: Trophy,
  crown: Crown,
  flame: Flame,
  timer: Timer,
  target: Target,
  compass: Compass,
  gamepad: Gamepad2,
  star: Star,
  medal: Medal,
  repeat: Repeat,
};
const MEDAL: Record<AchievementTier, string> = {
  bronze: "bg-tier-bronze text-tier-bronze-ink",
  silver: "bg-tier-silver text-tier-silver-ink",
  gold: "bg-tier-gold text-tier-gold-ink",
};

interface Props {
  /** "You win!", "Game over", "3rd of 5"… announced when the screen opens. */
  headline: string;
  /** Drawn before the headline (a race winner's trophy). */
  headlineIcon?: ReactNode;
  /** Lines under it: the score, the time, who ran out of time… */
  details?: ReactNode;
  /** The finished game's own result, to tell a new best. */
  result: GameResult | null;
  rewards: RewardsState;
  /** A rated game's rating change. */
  rating?: ReactNode;
  game: string;
  locale: string;
  dir: "ltr" | "rtl";
  strings: ResultsStrings;
  /** Board games keep the final position in view, with the results below it. */
  placement: "cover" | "bottom";
  /** Play again, rematch, leave… */
  children: ReactNode;
}

export default function GameResults({
  headline,
  headlineIcon,
  details,
  result,
  rewards,
  rating,
  game,
  locale,
  dir,
  strings: s,
  placement,
  children,
}: Props) {
  const number = (n: number) => n.toLocaleString(locale);
  const done = rewards.kind === "done" ? rewards.rewards : null;

  // A toast for each achievement, once.
  const toastedRef = useRef(false);
  useEffect(() => {
    if (!done || toastedRef.current) return;
    toastedRef.current = true;
    for (const unlock of done.achievements) {
      const known = s.achievementNames[unlock.achievement];
      if (!known) continue;
      toast({
        title: s.unlocked,
        description: `${known.name} · ${s.tiers[unlock.tier]}`,
        variant: "success",
      });
    }
  }, [done, s]);

  return (
    <>
      <Overlay placement={placement}>
        <p role="status" className="flex items-center gap-2 text-3xl font-semibold">
          {headlineIcon}
          {headline}
        </p>
        {details}
        {done && <Best result={result} best={done.best} strings={s} number={number} />}
        {done && <Experience gained={done.xpGained} total={done.xp} strings={s} number={number} />}
        {done?.places?.map((place) => {
          const board = s.boards[place.board];
          // The daily challenge's board has a place for its day; others, all time and this week.
          const text =
            typeof place.day === "number"
              ? fill(s.dailyPlace, { rank: number(place.day) })
              : typeof place.all === "number" && typeof place.week === "number"
                ? fill(s.place, {
                    board: board?.name ?? place.board,
                    all: number(place.all),
                    week: number(place.week),
                  })
                : null;
          if (!board || !text) return null;
          return (
            <a
              key={place.board}
              href={board.href}
              className="font-semibold text-link underline-offset-4 hover:underline"
            >
              {text}
            </a>
          );
        })}
        {done && done.achievements.length > 0 && (
          <section aria-label={s.achievements} className="grid w-full max-w-md gap-2">
            <h3 className="text-base font-semibold">{s.achievements}</h3>
            <ul className="grid gap-2">
              {done.achievements.map((unlock) => {
                const known = s.achievementNames[unlock.achievement];
                if (!known) return null;
                const Icon = ICONS[known.icon];
                return (
                  <li
                    key={`${unlock.achievement}.${unlock.tier}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2 text-start"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-border-strong ${MEDAL[unlock.tier]}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="grid">
                      <span className="font-semibold">{known.name}</span>
                      <span className="text-sm text-muted">{s.tiers[unlock.tier]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {rewards.kind === "saving" && (
          <p className="flex items-center gap-2 text-muted">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {s.saving}
          </p>
        )}
        {rewards.kind === "guest" && <GuestNudge strings={s} />}
        {rating}
        {children}
        <ShareButton text={fill(s.shareText, { result: headline, game })} strings={s} />
      </Overlay>
      {/* Outside the centred overlay, so the toasts keep their own alignment. */}
      <Toaster label={s.notifications} closeLabel={s.close} dir={dir} />
    </>
  );
}

/** "Best: 2,048", or "New best!" when this game set it. */
function Best({
  result,
  best,
  strings: s,
  number,
}: {
  result: GameResult | null;
  best: { score: number | null; timeMs: number | null } | null;
  strings: ResultsStrings;
  number: (n: number) => string;
}) {
  if (!best || !result) return null;
  if (result.score !== undefined && best.score !== null) {
    const isNew = result.score > 0 && result.score >= best.score;
    return (
      <p className="font-semibold tabular-nums">
        {isNew ? s.newBest : fill(s.best, { value: number(best.score) })}
      </p>
    );
  }
  if (result.timeMs !== undefined && result.completed && best.timeMs !== null) {
    const isNew = result.timeMs <= best.timeMs;
    return (
      <p className="font-semibold tabular-nums">
        {isNew ? s.newBest : fill(s.best, { value: formatDuration(best.timeMs) })}
      </p>
    );
  }
  return null;
}

/** "+30 XP", the level with its bar, and "Level up!" when the game crossed one. */
function Experience({
  gained,
  total,
  strings: s,
  number,
}: {
  gained: number;
  total: number;
  strings: ResultsStrings;
  number: (n: number) => string;
}) {
  const now = levelProgress(total);
  const before = levelForXp(total - gained);
  return (
    <div className="grid w-full max-w-xs gap-1.5">
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{fill(s.level, { level: number(now.level) })}</span>
        {gained > 0 && (
          <span className="font-semibold text-brand-strong tabular-nums">
            {fill(s.xp, { xp: number(gained) })}
          </span>
        )}
      </p>
      <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full bg-brand-strong transition-[width] duration-700 motion-reduce:transition-none"
          style={{ width: `${String(Math.round(now.fraction * 100))}%` }}
        />
      </span>
      <p className="text-sm text-muted">
        {now.level > before
          ? fill(s.levelUp, { level: number(now.level) })
          : fill(s.xpToNext, {
              into: number(now.into),
              span: number(now.span),
              next: number(now.level + 1),
            })}
      </p>
    </div>
  );
}

/** A guest's nudge to sign in, coming back to this game afterwards. */
function GuestNudge({ strings: s }: { strings: ResultsStrings }) {
  const href = `${s.signInHref}?next=${encodeURIComponent(location.pathname + location.search)}`;
  return (
    <p className="text-muted">
      {s.guest}{" "}
      <a href={href} className="font-semibold text-link underline-offset-4 hover:underline">
        {s.signIn}
      </a>
    </p>
  );
}

/** The system's share sheet where there is one; otherwise the link is copied. */
function ShareButton({ text, strings: s }: { text: string; strings: ResultsStrings }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = location.origin + location.pathname;
    if (typeof navigator.share === "function") {
      // A dismissed share sheet rejects: nothing to do.
      await navigator.share({ text, url }).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      // No clipboard either: the button stays as it is.
    }
  }
  return (
    <Button variant="ghost" onClick={() => void share()}>
      <Share2 aria-hidden="true" />
      <span aria-live="polite">{copied ? s.copied : s.share}</span>
    </Button>
  );
}
