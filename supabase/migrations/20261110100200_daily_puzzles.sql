-- Phase 11 step 21: the daily challenge rotates through the 8 new puzzles
-- as well (11 games). Each is played with every option set, as submit-match
-- requires, at a middle setting. Days already made keep their game; the
-- rotation from here on follows the new length.
insert into private.daily_rotation (position, game_id, game_version, config) values
  (3, 'minesweeper', 1, '{"level": "intermediate"}'),
  (4, 'nonogram', 1, '{"size": 10}'),
  (5, 'pipe-link', 1, '{"size": 7}'),
  (6, 'fifteen', 1, '{"size": 4}'),
  (7, 'box-pusher', 1, '{"difficulty": "medium", "level": 0}'),
  (8, 'lights-off', 1, '{"size": 5}'),
  (9, 'memory-match', 1, '{"cards": 20}'),
  (10, 'hanoi', 1, '{"discs": 5}');
