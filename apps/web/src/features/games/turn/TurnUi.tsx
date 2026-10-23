// The setup screen and the HUD for turn-based games (Phase 4). Loaded by the
// player only for games of kind "turn", so other game pages don't carry it.
import { Bot, LoaderCircle } from "lucide-react";
import { useId, type RefObject } from "react";

import type { Seat, TimerPreset } from "@kefche/game-sdk";
import type { TurnReport } from "@kefche/game-sdk/browser";
import { Button } from "@kefche/ui/components/button";
import { PlayerMarker, type PlayerSlot } from "@kefche/ui/components/player-marker";

import { fill, formatClock, seatName, timerLabel, type TurnStrings } from "./labels";
import {
  seatsFor,
  type SeatChoice,
  type SetupChoice,
  type TurnConfig,
  type TurnMode,
} from "./match-setup";

const slot = (seat: number) => ((seat % 8) + 1) as PlayerSlot;

interface Option<T> {
  value: T;
  label: string;
}

function Segmented<T extends string | number>({
  legend,
  hideLegend = false,
  value,
  options,
  onChange,
}: {
  legend: string;
  hideLegend?: boolean;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const groupId = useId();
  return (
    <fieldset className="grid gap-1.5">
      <legend className={hideLegend ? "sr-only" : "mb-1.5 text-sm font-semibold"}>{legend}</legend>
      <div className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
        {options.map((option) => (
          <label key={String(option.value)} className="min-w-11 flex-1">
            <input
              type="radio"
              name={groupId}
              className="peer sr-only"
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-3 text-center text-sm font-semibold text-muted peer-checked:bg-surface peer-checked:text-text peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface SetupProps {
  mode: TurnMode;
  config: TurnConfig;
  choice: SetupChoice;
  strings: TurnStrings;
  locale: string;
  /** The game's code is still loading; Start waits for it. */
  loading: boolean;
  startRef: RefObject<HTMLButtonElement | null>;
  onChange: (choice: SetupChoice) => void;
  onStart: () => void;
}

export function TurnSetup({
  mode,
  config,
  choice,
  strings: s,
  locale,
  loading,
  startRef,
  onChange,
  onStart,
}: SetupProps) {
  const humans = choice.seats.filter((seat) => seat.kind === "human").length;
  const setSeat = (index: number, seat: SeatChoice) => {
    onChange({ ...choice, seats: choice.seats.map((old, i) => (i === index ? seat : old)) });
  };
  const counts = Array.from(
    { length: config.players.max - Math.max(config.players.min, 2) + 1 },
    (_, i) => Math.max(config.players.min, 2) + i,
  );
  const difficulty = config.difficulties.includes("medium")
    ? "medium"
    : (config.difficulties[0] ?? "easy");

  return (
    <form
      className="mx-auto grid w-full max-w-md gap-5 rounded-2xl border border-border bg-surface p-5 shadow-lg"
      onSubmit={(e) => {
        e.preventDefault();
        onStart();
      }}
    >
      <h3 className="text-2xl">{s.setupTitle[mode]}</h3>

      {counts.length > 1 && (
        <Segmented
          legend={s.players}
          value={choice.players}
          options={counts.map((n) => ({ value: n, label: n.toLocaleString(locale) }))}
          onChange={(players) => {
            onChange({ ...choice, players, seats: seatsFor(players, mode, config, choice.seats) });
          }}
        />
      )}

      <ol className="grid gap-3">
        {choice.seats.map((seat, i) => {
          const label =
            i === 0 && humans === 1 ? s.you : fill(s.player, { n: (i + 1).toLocaleString(locale) });
          return (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- seats are positional: the index is the seat
            <li key={i} className="grid gap-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 font-semibold">
                <PlayerMarker player={slot(i)} className="size-7" />
                {seat.kind === "bot" ? s.bot : label}
              </div>
              {i > 0 && config.difficulties.length > 0 && (
                <Segmented
                  legend={label}
                  hideLegend
                  value={seat.kind}
                  options={[
                    { value: "human", label: s.person },
                    { value: "bot", label: s.bot },
                  ]}
                  onChange={(kind) => {
                    setSeat(i, kind === "bot" ? { kind: "bot", difficulty } : { kind: "human" });
                  }}
                />
              )}
              {seat.kind === "bot" && (
                <Segmented
                  legend={s.difficulty}
                  hideLegend
                  value={seat.difficulty}
                  options={config.difficulties.map((d) => ({ value: d, label: s.difficulties[d] }))}
                  onChange={(d) => {
                    setSeat(i, { kind: "bot", difficulty: d });
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {config.timers.length > 1 && (
        <Segmented
          legend={s.timer}
          value={choice.timer}
          options={config.timers.map((preset, i) => ({
            value: i,
            label: timerLabel(preset, s, locale),
          }))}
          onChange={(timer) => {
            onChange({ ...choice, timer });
          }}
        />
      )}

      <Button ref={startRef} type="submit" size="lg" disabled={loading}>
        {loading && (
          <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        )}
        {s.begin}
      </Button>
    </form>
  );
}

interface HudProps {
  seats: readonly Seat[];
  timer: TimerPreset;
  report: TurnReport | null;
  strings: TurnStrings;
}

export function TurnHud({ seats, timer, report, strings: s }: HudProps) {
  const moving = report?.toMove[0];
  const mover = moving === undefined ? undefined : seats[moving];
  const announcement =
    mover === undefined
      ? ""
      : report?.thinking
        ? fill(s.thinking, { name: seatName(mover, s) })
        : fill(s.toMove, { name: seatName(mover, s) });

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border bg-surface px-3 py-2">
      <ol className="flex flex-wrap items-center justify-center gap-2">
        {seats.map((seat, i) => {
          const active = report?.toMove.includes(i) ?? false;
          const clock = report?.clocks[i] ?? null;
          const showClock = clock !== null && (timer.kind === "clock" || active);
          const low = report?.lowTime[i] ?? false;
          const name = seatName(seat, s);
          return (
            <li
              // eslint-disable-next-line @eslint-react/no-array-index-key -- seats are positional: the index is the seat
              key={i}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-full border-2 py-1 ps-1 pe-3 text-sm ${
                active ? "border-text bg-surface-2 font-semibold" : "border-transparent text-muted"
              }`}
            >
              <PlayerMarker player={slot(i)} className="size-7" />
              <span className="max-w-32 truncate">{name}</span>
              {seat.kind === "bot" && (
                <span
                  className="flex items-center gap-1 text-xs text-muted"
                  title={fill(s.botBadge, { difficulty: s.difficulties[seat.difficulty] })}
                >
                  <Bot aria-hidden="true" className="size-4" />
                  <span className="sr-only">
                    {fill(s.botBadge, { difficulty: s.difficulties[seat.difficulty] })}
                  </span>
                  <span aria-hidden="true">{s.difficulties[seat.difficulty]}</span>
                </span>
              )}
              {active && report?.thinking && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              )}
              {showClock && (
                <span
                  className={`rounded-md px-1.5 font-mono tabular-nums ${low ? "bg-danger text-on-danger" : "bg-bg"}`}
                  aria-label={fill(s.clockLabel, {
                    name,
                    time: formatClock(clock),
                  })}
                  role="timer"
                >
                  {formatClock(clock)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
