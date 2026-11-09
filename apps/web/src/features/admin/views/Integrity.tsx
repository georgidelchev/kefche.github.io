// The Leaderboards and integrity section (SPEC §14, Phase 10 step 7), for
// admins: results set aside for review (accept or reject), one match by id
// (annul a counted one), a board's entries (remove one), and a player's
// ratings and board places (start a rating again, remove their places on a
// game's boards). Every change goes through an audited RPC; one status line
// says how each went, and the sections load again after it.
import { ShieldCheck } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Badge } from "@kefche/ui/components/badge";
import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";
import { EmptyState } from "@kefche/ui/components/states";

import { fill } from "@/features/auth/strings";
import type { Supabase } from "@/lib/supabase/client";

import { ConfirmDialog } from "./ConfirmDialog";
import {
  annulMatch,
  boardValue,
  decideMatch,
  fetchBoard,
  fetchBoards,
  fetchMatch,
  fetchRatings,
  fetchReview,
  findPlayer,
  integrityFromUrl,
  removeEntry,
  resetPlayerBoards,
  resetRating,
  weekPeriod,
  type Board,
  type Entry,
  type Match,
  type Rating,
} from "./integrity-data";
import { playerPage } from "./links";
import { errorText } from "./PlayerActions";
import { dateTime, Field, linkClass, selectClass } from "./ui";

import type { IntegrityStrings, PlayersStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: IntegrityStrings; players: PlayersStrings };

/** An action waiting for confirmation. */
interface Pending {
  title: string;
  body: string;
  confirm: string;
  danger: boolean;
  run: () => Promise<string | null>;
}

/** Shared by the sections: ask for confirmation, and the version to reload on. */
interface Shared {
  ask: (pending: Pending) => void;
  version: number;
}

type Section = Props & Shared;

export function Integrity(props: Props) {
  const { strings: s, players } = props;
  const [pending, setPending] = useState<Pending | null>(null);
  const [opened, setOpened] = useState(0);
  const [version, setVersion] = useState(0);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const shared: Shared = {
    ask: (next) => {
      setOutcome(null);
      setOpened((n) => n + 1);
      setPending(next);
    },
    version,
  };

  return (
    <div className="grid gap-10">
      {/* Always in the page, so screen readers hear each outcome. */}
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted empty:hidden"}
      >
        {outcome?.text ?? ""}
      </p>
      <Part id="integrity-review" title={s.reviewTitle} body={s.reviewBody}>
        <Review {...props} {...shared} />
      </Part>
      <Part id="integrity-match" title={s.matchTitle} body={s.matchBody}>
        <MatchLookup {...props} {...shared} />
      </Part>
      <Part id="integrity-boards" title={s.boardsTitle} body={s.boardsBody}>
        <Boards {...props} {...shared} />
      </Part>
      <Part id="integrity-player" title={s.playerTitle} body={s.playerBody}>
        <PlayerTools {...props} {...shared} />
      </Part>
      {pending !== null && (
        <ConfirmDialog
          key={opened}
          title={pending.title}
          body={pending.body}
          confirm={pending.confirm}
          danger={pending.danger}
          strings={players.act}
          onClose={() => {
            setPending(null);
          }}
          onConfirm={async () => {
            const error = await pending.run();
            setPending(null);
            setVersion((n) => n + 1);
            setOutcome(
              error === null
                ? { ok: true, text: s.done }
                : { ok: false, text: errorText(error, players.act) },
            );
          }}
        />
      )}
    </div>
  );
}

function Part({
  id,
  title,
  body,
  children,
}: {
  id: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <div className="grid gap-1">
        <h2 id={id} className="text-xl">
          {title}
        </h2>
        <p className="max-w-prose text-muted">{body}</p>
      </div>
      {children}
    </section>
  );
}

const Loading = ({ text }: { text: string }) => (
  <p className="text-muted" aria-busy="true">
    {text}
  </p>
);

function Review(props: Section) {
  const { supabase, strings: s, version } = props;
  const [matches, setMatches] = useState<Match[] | null | "failed">(null);
  useEffect(() => {
    void fetchReview(supabase).then((next) => {
      setMatches(next ?? "failed");
    });
  }, [supabase, version]);
  if (matches === null) return <Loading text={s.loading} />;
  if (matches === "failed") return <p role="alert">{s.failed}</p>;
  if (matches.length === 0) return <EmptyState icon={<ShieldCheck />} title={s.reviewEmpty} />;
  return (
    <ul className="grid gap-3">
      {matches.map((match) => (
        <li key={match.id}>
          <MatchCard {...props} match={match} />
        </li>
      ))}
    </ul>
  );
}

function MatchLookup(props: Section) {
  const { supabase, paths, strings: s, version } = props;
  const id = useId();
  const [wanted] = useState(() => integrityFromUrl(location.search).match);
  const [match, setMatch] = useState<Match | null | undefined | "loading">(
    wanted ? "loading" : null,
  );
  useEffect(() => {
    if (!wanted) return;
    void fetchMatch(supabase, wanted).then(setMatch);
  }, [supabase, wanted, version]);
  return (
    <div className="grid gap-4">
      <form
        method="get"
        action={paths.integrity}
        aria-label={s.matchTitle}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4"
      >
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Field id={`${id}-match`} label={s.matchId} hint={s.matchIdHint}>
            <Input
              id={`${id}-match`}
              name="match"
              defaultValue={wanted ?? ""}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${id}-match-hint`}
            />
          </Field>
        </div>
        <Button type="submit">{s.find}</Button>
      </form>
      {match === "loading" && <Loading text={s.loading} />}
      {match === undefined && <p role="alert">{s.failed}</p>}
      {wanted && match === null && <p>{s.matchNotFound}</p>}
      {match !== null && match !== undefined && match !== "loading" && (
        <MatchCard {...props} match={match} />
      )}
    </div>
  );
}

function MatchCard({
  match,
  supabase,
  bcp47,
  paths,
  strings: s,
  players,
  ask,
}: Section & { match: Match }) {
  const playerHref = playerPage(paths);
  const game = players.games[match.gameId] ?? match.gameId;
  const outcome = (value: number | null) =>
    value === null
      ? null
      : value === 1
        ? players.outcomes.win
        : value === 0
          ? players.outcomes.loss
          : players.outcomes.draw;
  return (
    <article className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-lg">{game}</h3>
        <Badge variant={match.status === "counted" ? "neutral" : "accent"}>
          {s.statuses[match.status] ?? match.status}
        </Badge>
        {match.rated && <Badge>{players.rated}</Badge>}
        <span className="text-sm text-muted">
          {s.modes[match.mode] ?? match.mode} · {fill(s.reason, { reason: match.reason })}
        </span>
        <time dateTime={match.endedAt} className="ms-auto text-sm text-muted">
          {dateTime(match.endedAt, bcp47)}
        </time>
      </header>
      <ul className="grid gap-1">
        {match.players.map((seat) => (
          <li key={seat.seat} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {seat.userId === null ? (
              <span>{players.noProfile}</span>
            ) : (
              <a href={playerHref(seat.userId)} className={linkClass}>
                {seat.nickname ?? players.noNickname}
              </a>
            )}
            {outcome(seat.outcome) !== null && <span>{outcome(seat.outcome)}</span>}
            {seat.score !== null && (
              <span className="text-sm text-muted">
                {fill(s.score, { score: seat.score.toLocaleString(bcp47) })}
              </span>
            )}
            {seat.timeMs !== null && (
              <span className="text-sm text-muted">
                {fill(s.time, { time: boardValue(seat.timeMs, true, bcp47) })}
              </span>
            )}
            {seat.assisted && <span className="text-sm text-muted">{s.assisted}</span>}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        <code>{match.id}</code>
      </p>
      {match.status === "review" && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              ask({
                title: fill(s.acceptTitle, { game }),
                body: s.acceptBody,
                confirm: s.accept,
                danger: false,
                run: () => decideMatch(supabase, match.id, true),
              });
            }}
          >
            {s.accept}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              ask({
                title: fill(s.rejectTitle, { game }),
                body: s.rejectBody,
                confirm: s.reject,
                danger: true,
                run: () => decideMatch(supabase, match.id, false),
              });
            }}
          >
            {s.reject}
          </Button>
        </div>
      )}
      {match.status === "counted" && (
        <div>
          <Button
            variant="danger"
            onClick={() => {
              ask({
                title: fill(s.annulTitle, { game }),
                body: match.rated ? `${s.annulBody} ${s.annulRated}` : s.annulBody,
                confirm: s.annul,
                danger: true,
                run: () => annulMatch(supabase, match.id),
              });
            }}
          >
            {s.annul}
          </Button>
        </div>
      )}
    </article>
  );
}

const boardLabel = (board: Board, s: IntegrityStrings, players: PlayersStrings) =>
  board.game_id
    ? `${players.games[board.game_id] ?? board.game_id} · ${board.id.slice(board.game_id.length + 1)}`
    : board.id === "xp"
      ? s.xpBoard
      : board.id;

function Boards(props: Section) {
  const { supabase, bcp47, paths, strings: s, players, ask, version } = props;
  const id = useId();
  const [wanted] = useState(() => integrityFromUrl(location.search));
  const [boards, setBoards] = useState<Board[] | null | "failed">(null);
  const [entries, setEntries] = useState<Entry[] | null | "failed">(null);
  const period = wanted.week ? weekPeriod() : "all";
  const playerHref = playerPage(paths);

  useEffect(() => {
    void fetchBoards(supabase).then((next) => {
      setBoards(next ?? "failed");
    });
  }, [supabase]);
  useEffect(() => {
    if (!wanted.board) return;
    void fetchBoard(supabase, wanted.board, period, null).then((next) => {
      setEntries(next ?? "failed");
    });
  }, [supabase, wanted.board, period, version]);

  if (boards === null) return <Loading text={s.loading} />;
  if (boards === "failed") return <p role="alert">{s.failed}</p>;
  // The XP board is the profiles' XP, not entries: it has nothing to remove here.
  const gameBoards = boards.filter((b) => b.game_id !== null);
  const board = gameBoards.find((b) => b.id === wanted.board);
  return (
    <div className="grid gap-4">
      <form
        method="get"
        action={paths.integrity}
        aria-label={s.boardsTitle}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4"
      >
        <div className="min-w-56 flex-1 sm:flex-none">
          <Field id={`${id}-board`} label={s.board}>
            <select
              id={`${id}-board`}
              name="board"
              defaultValue={board?.id ?? ""}
              required
              className={selectClass}
            >
              <option value="" disabled>
                {s.chooseBoard}
              </option>
              {gameBoards.map((b) => (
                <option key={b.id} value={b.id}>
                  {boardLabel(b, s, players)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="min-w-40 flex-1 sm:flex-none">
          <Field id={`${id}-period`} label={s.period}>
            <select
              id={`${id}-period`}
              name="period"
              defaultValue={wanted.week ? "week" : "all"}
              className={selectClass}
            >
              <option value="all">{s.allTime}</option>
              <option value="week">{s.thisWeek}</option>
            </select>
          </Field>
        </div>
        <Button type="submit">{s.show}</Button>
      </form>
      {board &&
        (entries === null ? (
          <Loading text={s.loading} />
        ) : entries === "failed" ? (
          <p role="alert">{s.failed}</p>
        ) : entries.length === 0 ? (
          <p className="text-muted">{s.boardEmpty}</p>
        ) : (
          <ol className="grid gap-2">
            {entries.map((entry, index) => (
              <li
                key={entry.user_id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface p-3"
              >
                <span className="w-8 font-semibold tabular-nums">{index + 1}</span>
                <a href={playerHref(entry.user_id)} className={linkClass}>
                  {entry.nickname ?? players.noNickname}
                </a>
                <span className="font-semibold tabular-nums">
                  {boardValue(entry.value, board.lower_is_better, bcp47)}
                </span>
                {!entry.shown && <Badge>{s.notShown}</Badge>}
                <time dateTime={entry.achieved_at} className="text-sm text-muted">
                  {dateTime(entry.achieved_at, bcp47)}
                </time>
                <Button
                  variant="outline"
                  className="ms-auto"
                  aria-label={fill(s.removeEntryLabel, {
                    name: entry.nickname ?? players.noNickname,
                  })}
                  onClick={() => {
                    ask({
                      title: fill(s.removeEntryTitle, {
                        name: entry.nickname ?? players.noNickname,
                      }),
                      body: s.removeEntryBody,
                      confirm: s.remove,
                      danger: true,
                      run: () => removeEntry(supabase, board.id, period, entry.user_id),
                    });
                  }}
                >
                  {s.remove}
                </Button>
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}

interface PlayerState {
  id: string;
  nickname: string | null;
  ratings: Rating[];
  /** Their all-time entries, by game. */
  games: { game: string; entries: { board: Board; entry: Entry }[] }[];
}

async function loadPlayer(
  supabase: Supabase,
  query: string,
): Promise<PlayerState | null | "failed"> {
  const found = await findPlayer(supabase, query);
  if (!found) return null;
  const [ratings, boards] = await Promise.all([
    fetchRatings(supabase, found.id),
    fetchBoards(supabase),
  ]);
  if (!ratings || !boards) return "failed";
  const games = new Map<string, { board: Board; entry: Entry }[]>();
  for (const board of boards) {
    if (board.game_id === null) continue;
    const entries = await fetchBoard(supabase, board.id, "all", found.id);
    if (!entries) return "failed";
    for (const entry of entries) {
      const list = games.get(board.game_id) ?? [];
      list.push({ board, entry });
      games.set(board.game_id, list);
    }
  }
  return {
    ...found,
    ratings,
    games: [...games].map(([game, entries]) => ({ game, entries })),
  };
}

function PlayerTools(props: Section) {
  const { supabase, bcp47, paths, strings: s, players, ask, version } = props;
  const id = useId();
  const [query] = useState(() => integrityFromUrl(location.search).player);
  const [player, setPlayer] = useState<PlayerState | null | "failed" | "loading">(
    query ? "loading" : null,
  );
  useEffect(() => {
    if (!query) return;
    void loadPlayer(supabase, query).then(setPlayer);
  }, [supabase, query, version]);
  const name = (p: PlayerState) => p.nickname ?? players.noNickname;

  return (
    <div className="grid gap-4">
      <form
        method="get"
        action={paths.integrity}
        aria-label={s.playerTitle}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4"
      >
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Field id={`${id}-player`} label={s.player} hint={s.playerHint}>
            <Input
              id={`${id}-player`}
              name="player"
              defaultValue={query ?? ""}
              autoComplete="off"
              aria-describedby={`${id}-player-hint`}
            />
          </Field>
        </div>
        <Button type="submit">{s.find}</Button>
      </form>
      {player === "loading" && <Loading text={s.loading} />}
      {player === "failed" && <p role="alert">{s.failed}</p>}
      {query && player === null && <p>{s.playerNotFound}</p>}
      {player !== null && player !== "loading" && player !== "failed" && (
        <div className="grid gap-4 rounded-2xl border border-border bg-surface p-4">
          <a href={playerPage(paths)(player.id)} className={`${linkClass} justify-self-start`}>
            {name(player)}
          </a>
          <div className="grid gap-2">
            <h3 className="text-base">{s.ratings}</h3>
            {player.ratings.length === 0 ? (
              <p className="text-muted">{s.noRatings}</p>
            ) : (
              <ul className="grid gap-2">
                {player.ratings.map((rating) => {
                  const label = `${players.games[rating.game_id] ?? rating.game_id} · ${rating.pool}`;
                  return (
                    <li key={label} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="font-semibold">{label}</span>
                      <span className="tabular-nums">
                        {fill(s.ratingValue, {
                          rating: Math.round(rating.rating).toLocaleString(bcp47),
                          rd: Math.round(rating.rd).toLocaleString(bcp47),
                          games: rating.games.toLocaleString(bcp47),
                        })}
                      </span>
                      <Button
                        variant="outline"
                        className="ms-auto"
                        aria-label={fill(s.resetRatingLabel, { rating: label })}
                        onClick={() => {
                          ask({
                            title: fill(s.resetRatingTitle, { name: name(player), rating: label }),
                            body: s.resetRatingBody,
                            confirm: s.reset,
                            danger: true,
                            run: () => resetRating(supabase, player.id, rating),
                          });
                        }}
                      >
                        {s.reset}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="grid gap-2">
            <h3 className="text-base">{s.places}</h3>
            {player.games.length === 0 ? (
              <p className="text-muted">{s.noPlaces}</p>
            ) : (
              <ul className="grid gap-3">
                {player.games.map(({ game, entries }) => {
                  const gameName = players.games[game] ?? game;
                  return (
                    <li key={game} className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="font-semibold">{gameName}</span>
                        <Button
                          variant="outline"
                          className="ms-auto"
                          aria-label={fill(s.resetBoardsLabel, { game: gameName })}
                          onClick={() => {
                            ask({
                              title: fill(s.resetBoardsTitle, {
                                name: name(player),
                                game: gameName,
                              }),
                              body: s.resetBoardsBody,
                              confirm: s.remove,
                              danger: true,
                              run: () => resetPlayerBoards(supabase, player.id, game),
                            });
                          }}
                        >
                          {s.resetBoards}
                        </Button>
                      </div>
                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        {entries.map(({ board, entry }) => (
                          <li key={board.id}>
                            {board.id.slice(game.length + 1)}:{" "}
                            {boardValue(entry.value, board.lower_is_better, bcp47)}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
