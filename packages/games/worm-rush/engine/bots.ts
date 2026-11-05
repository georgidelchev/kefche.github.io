// Worm Rush bots (SPEC §9.5: steering with reaction delays and imperfect aim
// per difficulty). Each heads for the richest orbs nearby and checks a few
// headings ahead for bodies and the edge; better bots look further, react
// sooner, aim truer, and the hard ones cut in front of smaller worms.
import {
  detAtan2,
  detCos,
  detSin,
  wrapAngle,
  type ArenaBot,
  type ArenaBots,
  type Rng,
} from "@kefche/game-sdk";

import { ARENA_RADIUS, wormRadius, type World, type Worm } from "./world";

import type { Input } from "./rules";

interface Style {
  thinkEvery: number;
  /** How far it looks for orbs. */
  sight: number;
  /** How far ahead it checks for danger (0: only the edge). */
  caution: number;
  /** Radians of error in its aim. */
  wobble: number;
  hunts: boolean;
}

const STYLES = {
  easy: { thinkEvery: 12, sight: 220, caution: 0, wobble: 0.7, hunts: false },
  medium: { thinkEvery: 6, sight: 450, caution: 120, wobble: 0.25, hunts: false },
  hard: { thinkEvery: 4, sight: 650, caution: 180, wobble: 0.08, hunts: true },
} satisfies Record<string, Style>;

/** Headings tried, nearest to the wanted one first. */
const TURNS = [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2, -2, 2.8];

function wanted(world: World, me: Worm, style: Style): { heading: number; boost: boolean } {
  const toCentre = detAtan2(-me.y, -me.x);
  const fromCentre = Math.sqrt(me.x * me.x + me.y * me.y);
  if (fromCentre > ARENA_RADIUS - 250) return { heading: toCentre, boost: false };

  if (style.hunts && me.mass > 120) {
    // A much smaller worm's head close by: get in front of it.
    let prey: Worm | null = null;
    let nearest = 400 * 400;
    for (const other of world.worms.values()) {
      if (!other.alive || other.id === me.id || other.mass * 1.6 > me.mass) continue;
      const d2 = (other.x - me.x) ** 2 + (other.y - me.y) ** 2;
      if (d2 < nearest) {
        nearest = d2;
        prey = other;
      }
    }
    if (prey) {
      const ahead = 60 + wormRadius(prey.mass) * 4;
      const tx = prey.x + detCos(prey.heading) * ahead;
      const ty = prey.y + detSin(prey.heading) * ahead;
      return {
        heading: detAtan2(ty - me.y, tx - me.x),
        boost: nearest < 220 * 220 && me.mass > 150,
      };
    }
  }

  // The orb worth most for the way there.
  let best = -1;
  let heading = me.heading;
  world.orbGrid.forEach(me.x, me.y, style.sight, (id, x, y, d2) => {
    const orb = world.orbs.get(id);
    if (!orb) return;
    const worth = orb.value / (Math.sqrt(d2) + 40);
    if (worth > best) {
      best = worth;
      heading = detAtan2(y - me.y, x - me.x);
    }
  });
  // Nothing in sight: drift back toward the middle.
  if (best < 0) heading = wrapAngle(toCentre + 0.6);
  return { heading, boost: false };
}

/** Whether heading along `heading` for `distance` runs into a body or the edge. */
function blocked(world: World, me: Worm, heading: number, distance: number): boolean {
  const mine = wormRadius(me.mass);
  for (const step of [0.5, 1]) {
    const x = me.x + detCos(heading) * distance * step;
    const y = me.y + detSin(heading) * distance * step;
    if (x * x + y * y > (ARENA_RADIUS - mine - 40) ** 2) return true;
    if (world.bodies.query(x, y, mine + 40).some((id) => id !== me.id)) return true;
  }
  return false;
}

function bot(style: Style): ArenaBot<World, Input> {
  return {
    thinkEvery: style.thinkEvery,
    steer(world, id, { rng }: { rng: Rng }) {
      const me = world.worms.get(id);
      if (!me?.alive) return { heading: 0, boost: false };
      const goal = wanted(world, me, style);
      let heading = goal.heading;
      let swerved = false;
      if (style.caution > 0) {
        const index = TURNS.findIndex(
          (t) =>
            !blocked(
              world,
              me,
              wrapAngle(goal.heading + t),
              style.caution + wormRadius(me.mass) * 2,
            ),
        );
        heading = wrapAngle(goal.heading + (TURNS[Math.max(0, index)] ?? 0));
        swerved = index > 0;
      }
      heading = wrapAngle(heading + (rng.next() - 0.5) * style.wobble);
      // No boosting while swerving away from danger.
      return { heading, boost: goal.boost && !swerved };
    },
  };
}

export const bots: ArenaBots<World, Input> = {
  easy: bot(STYLES.easy),
  medium: bot(STYLES.medium),
  hard: bot(STYLES.hard),
};
