// Mafia (SPEC §20.4 #52): 5–12 players. Roles are dealt in secret: the
// Mafia (one for every four players), a Doctor, a Detective, and Villagers.
// - Night: the Mafia choose someone to eliminate (they see each other and
//   each other's choices; the most chosen falls, the lowest seat on a tie),
//   the Doctor protects someone (themselves too), the Detective checks
//   whether someone is Mafia (only they learn it), and the Villagers sleep.
//   Everyone alive acts, so nobody can tell the roles apart by who moves.
// - Morning: the narrator says who was eliminated, and their role, unless
//   the Doctor saved them.
// - Day: everyone alive talks (in the room's chat, or aloud on one device),
//   says when they're ready, then votes in secret for someone or for no
//   one. The most votes eliminate that player, role shown, unless "no one"
//   has as many or a tie; then nobody goes. Votes are shown once counted.
// - The town wins when no Mafia is left; the Mafia win when they're as many
//   as everyone else. After 15 days it's a draw.
// Roles, night choices and votes are secret, so online the table holds
// them (ADR-0047).
import { Rng, sameAction, type GameResult, type TurnEngine } from "@kefche/game-sdk";

export type Role = "mafia" | "doctor" | "detective" | "villager";
/** Not shown to this viewer (in a view). */
export const HIDDEN = "hidden";
/** A vote for no one. */
export const NOBODY = -1;
export const MAX_DAYS = 15;

/** How many Mafia for a number of players: one for every four. */
export const mafiaFor = (players: number) => Math.max(1, Math.floor(players / 4));

export type Event =
  | { kind: "killed"; day: number; seat: number; role: Role }
  | { kind: "saved"; day: number }
  | { kind: "executed"; day: number; seat: number; role: Role; votes: number[] }
  | { kind: "spared"; day: number; votes: number[] };

export interface State {
  players: number;
  /** Each seat's role; HIDDEN in a view for the roles the viewer can't know. */
  roles: (Role | typeof HIDDEN)[];
  alive: boolean[];
  day: number;
  phase: "night" | "talk" | "vote";
  /** Tonight's choices: null not yet; HIDDEN in a view where secret. */
  night: (number | null | typeof HIDDEN)[];
  ready: boolean[];
  /** Today's votes: null not yet, HIDDEN in a view until all are in. */
  votes: (number | null | typeof HIDDEN)[];
  /** What the Detective learned: seat and whether they're Mafia (only theirs in a view). */
  checks: { seat: number; mafia: boolean }[];
  /** The narrator's story so far (public). */
  events: Event[];
  winner: "town" | "mafia" | "draw" | null;
  moves: number;
}

export type Action = { target: number } | { sleep: true } | { ready: true } | { vote: number };

function initialState(_config: unknown, seats: number, seed: string): State {
  const rng = Rng.fromSeed(seed);
  const deck: Role[] = [
    ...Array.from({ length: mafiaFor(seats) }, (): Role => "mafia"),
    "doctor",
    "detective",
  ];
  while (deck.length < seats) deck.push("villager");
  return {
    players: seats,
    roles: rng.shuffle(deck),
    alive: Array.from({ length: seats }, () => true),
    day: 1,
    phase: "night",
    night: Array.from({ length: seats }, () => null),
    ready: Array.from({ length: seats }, () => false),
    votes: Array.from({ length: seats }, () => null),
    checks: [],
    events: [],
    winner: null,
    moves: 0,
  };
}

const living = (s: State) => s.alive.flatMap((a, seat) => (a ? [seat] : []));
export const roleOf = (s: State, seat: number) => s.roles[seat];

function legalActions(s: State, seat: number): Action[] {
  if (s.winner !== null || s.alive[seat] !== true) return [];
  const others = living(s).filter((x) => x !== seat);
  if (s.phase === "night") {
    if (s.night[seat] !== null) return [];
    switch (s.roles[seat]) {
      case "mafia":
        return others.filter((x) => s.roles[x] !== "mafia").map((target) => ({ target }));
      case "doctor":
        return living(s).map((target) => ({ target }));
      case "detective":
        return others.map((target) => ({ target }));
      case "villager":
      case HIDDEN:
      case undefined:
        return [{ sleep: true }];
    }
  }
  if (s.phase === "talk") return s.ready[seat] ? [] : [{ ready: true }];
  if (s.votes[seat] !== null) return [];
  return [...others.map((vote) => ({ vote })), { vote: NOBODY }];
}

function finish(s: State): State {
  const alive = living(s);
  const mafia = alive.filter((x) => s.roles[x] === "mafia").length;
  if (mafia === 0) return { ...s, winner: "town" };
  if (mafia >= alive.length - mafia) return { ...s, winner: "mafia" };
  return s;
}

/** The most chosen seat (the lowest on a tie), or null. */
function plurality(picks: readonly number[]): number | null {
  const tally = new Map<number, number>();
  for (const p of picks) tally.set(p, (tally.get(p) ?? 0) + 1);
  let best: number | null = null;
  let most = 0;
  for (const [seat, n] of [...tally].sort((a, b) => a[0] - b[0])) {
    if (n > most) {
      best = seat;
      most = n;
    }
  }
  return best;
}

function dawn(s: State): State {
  const mafiaPicks = living(s).flatMap((x) => {
    const pick = s.night[x];
    return s.roles[x] === "mafia" && typeof pick === "number" ? [pick] : [];
  });
  const target = plurality(mafiaPicks);
  const doctor = living(s).find((x) => s.roles[x] === "doctor");
  const saved = doctor !== undefined && s.night[doctor] === target;
  const detective = living(s).find((x) => s.roles[x] === "detective");
  const checked = detective === undefined ? undefined : s.night[detective];
  const checks =
    typeof checked === "number"
      ? [...s.checks, { seat: checked, mafia: s.roles[checked] === "mafia" }]
      : s.checks;
  const killed = target !== null && !saved ? target : null;
  const role = killed === null ? undefined : s.roles[killed];
  const events: Event[] = [
    ...s.events,
    killed !== null && role !== undefined && role !== HIDDEN
      ? { kind: "killed", day: s.day, seat: killed, role }
      : { kind: "saved", day: s.day },
  ];
  const alive = s.alive.map((a, x) => a && x !== killed);
  return finish({
    ...s,
    alive,
    checks,
    events,
    phase: "talk",
    night: s.night.map(() => null),
    ready: s.ready.map(() => false),
  });
}

function dusk(s: State): State {
  const votes = s.votes.map((v) => (typeof v === "number" ? v : NOBODY));
  const counted = living(s).map((x) => votes[x] ?? NOBODY);
  const tally = new Map<number, number>();
  for (const v of counted) tally.set(v, (tally.get(v) ?? 0) + 1);
  const ranked = [...tally].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const out = top && top[0] !== NOBODY && (!second || second[1] < top[1]) ? top[0] : null;
  const role = out === null ? undefined : s.roles[out];
  const events: Event[] = [
    ...s.events,
    out !== null && role !== undefined && role !== HIDDEN
      ? { kind: "executed", day: s.day, seat: out, role, votes }
      : { kind: "spared", day: s.day, votes },
  ];
  const alive = s.alive.map((a, x) => a && x !== out);
  const next = finish({
    ...s,
    alive,
    events,
    votes: s.votes.map(() => null),
    phase: "night",
    day: s.day + 1,
  });
  if (next.winner === null && next.day > MAX_DAYS) return { ...next, winner: "draw" };
  return next;
}

function applyAction(s: State, seat: number, action: Action): State {
  if (!legalActions(s, seat).some((a) => sameAction(a, action))) return s;
  const moved = { ...s, moves: s.moves + 1 };
  if (s.phase === "night") {
    const night = s.night.map((n, x) =>
      x === seat ? ("target" in action ? action.target : NOBODY) : n,
    );
    const next = { ...moved, night };
    return living(next).every((x) => next.night[x] !== null) ? dawn(next) : next;
  }
  if (s.phase === "talk") {
    const ready = s.ready.map((r, x) => r || x === seat);
    const next = { ...moved, ready };
    return living(next).every((x) => next.ready[x]) ? { ...next, phase: "vote" } : next;
  }
  if (!("vote" in action)) return s;
  const votes = s.votes.map((v, x) => (x === seat ? action.vote : v));
  const next = { ...moved, votes };
  return living(next).every((x) => next.votes[x] !== null) ? dusk(next) : next;
}

function currentSeats(s: State): number[] {
  if (s.winner !== null) return [];
  return living(s).filter((x) =>
    s.phase === "night"
      ? s.night[x] === null
      : s.phase === "talk"
        ? !s.ready[x]
        : s.votes[x] === null,
  );
}

function result(s: State): GameResult | null {
  if (s.winner === null) return null;
  if (s.winner === "draw") return { completed: true, outcome: s.roles.map(() => 0.5) };
  return {
    completed: true,
    outcome: s.roles.map((r) => ((r === "mafia") === (s.winner === "mafia") ? 1 : 0)),
  };
}

/**
 * Your own role; the Mafia see each other; a player's role once they're
 * out. Night choices: your own, and the Mafia see each other's. Votes stay
 * hidden until all are in. The Detective alone sees what they learned.
 */
function view(s: State, seat: number | null): State {
  const mine = seat === null ? undefined : s.roles[seat];
  const mafia = mine === "mafia";
  const knows = (x: number) => x === seat || !s.alive[x] || (mafia && s.roles[x] === "mafia");
  return {
    ...s,
    roles: s.roles.map((r, x) => (knows(x) ? r : HIDDEN)),
    night: s.night.map((n, x) =>
      n === null || x === seat || (mafia && s.roles[x] === "mafia") ? n : HIDDEN,
    ),
    votes: s.votes.map((v, x) => (v === null || x === seat ? v : HIDDEN)),
    checks: mine === "detective" ? s.checks : [],
  };
}

/** Night choices and votes are told only to whoever made them. */
function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return viewer === seat || "ready" in action ? action : null;
}

export const engine: TurnEngine<State, Action, unknown> = {
  initialState,
  legalActions,
  applyAction,
  currentSeats,
  result,
  view,
  viewAction,
};
