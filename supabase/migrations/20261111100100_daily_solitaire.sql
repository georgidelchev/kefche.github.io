-- Phase 12 step 26: the daily challenge rotates through Klondike (a
-- winnable deal, drawing one) and Spider (one suit) as well (13 games).
-- Each is played with every option set, as submit-match requires. Days
-- already made keep their game; the rotation from here on follows the new
-- length.
insert into private.daily_rotation (position, game_id, game_version, config) values
  (11, 'klondike', 1, '{"draw": 1, "deal": "winnable"}'),
  (12, 'spider', 1, '{"suits": 1}');
