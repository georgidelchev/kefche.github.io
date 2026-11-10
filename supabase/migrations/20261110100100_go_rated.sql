-- Rated Go (Phase 11 step 3, owner decision Q2): one pool, 9 × 9, on the
-- clocks 5 + 3, 10 + 5 and 20 + 10 (packages/games/go/manifest.ts, timers
-- 3–5). The pool names its board size, so a 13 × 13 lobby has no rated pool
-- (rated_clock_for finds none, and making it rated is refused).
insert into private.rated_clocks (game_id, timer, pool, base, increment, config) values
  ('go', 3, 'board9', 300, 3, '{"size": 9}'),
  ('go', 4, 'board9', 600, 5, '{"size": 9}'),
  ('go', 5, 'board9', 1200, 10, '{"size": 9}');
