-- ============================================================
-- Drop redundant tables and broken view
-- ============================================================
--
-- game_results: fully redundant with `games` table (same data, different column names)
-- supplemental_data: 0 rows, no app usage, catch-all JSONB bucket
-- player_game_logs: 0 rows, derivable from game_skater_stats + game_goalie_stats
-- skater_trend_summary: view that times out (joins 4 heavy window-function views)
-- ============================================================

DROP TABLE IF EXISTS game_results CASCADE;
DROP TABLE IF EXISTS supplemental_data CASCADE;
DROP TABLE IF EXISTS player_game_logs CASCADE;
DROP VIEW IF EXISTS skater_trend_summary;
