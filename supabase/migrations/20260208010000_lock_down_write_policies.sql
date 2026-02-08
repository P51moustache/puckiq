-- ============================================================
-- Lock down RLS: remove permissive write/update policies
-- ============================================================
--
-- BEFORE: All tables had USING(true) / WITH CHECK(true) on
--         INSERT and UPDATE, meaning the anon key (embedded in
--         the app bundle) could write to any table.
--
-- AFTER:  Only SELECT policies remain (public read).
--         INSERT/UPDATE/DELETE are denied for anon/authenticated.
--         The service_role key (used by sync pipeline + seed
--         scripts) bypasses RLS entirely, so writes still work
--         for authorized server-side operations.
--
-- This is the standard Supabase pattern for read-only public data.
-- ============================================================

-- game_results — table dropped in 20260208020000_drop_redundant_tables.sql

-- teams
DROP POLICY IF EXISTS "teams_write" ON teams;
DROP POLICY IF EXISTS "teams_update" ON teams;

-- players
DROP POLICY IF EXISTS "players_write" ON players;
DROP POLICY IF EXISTS "players_update" ON players;

-- games
DROP POLICY IF EXISTS "games_write" ON games;
DROP POLICY IF EXISTS "games_update" ON games;

-- game_goals
DROP POLICY IF EXISTS "game_goals_write" ON game_goals;
DROP POLICY IF EXISTS "game_goals_update" ON game_goals;

-- game_skater_stats
DROP POLICY IF EXISTS "gss_write" ON game_skater_stats;
DROP POLICY IF EXISTS "gss_update" ON game_skater_stats;

-- game_goalie_stats
DROP POLICY IF EXISTS "ggs_write" ON game_goalie_stats;
DROP POLICY IF EXISTS "ggs_update" ON game_goalie_stats;

-- skater_season_stats
DROP POLICY IF EXISTS "sss_write" ON skater_season_stats;
DROP POLICY IF EXISTS "sss_update" ON skater_season_stats;

-- goalie_season_stats
DROP POLICY IF EXISTS "gss2_write" ON goalie_season_stats;
DROP POLICY IF EXISTS "gss2_update" ON goalie_season_stats;

-- standings
DROP POLICY IF EXISTS "standings_write" ON standings;
DROP POLICY IF EXISTS "standings_update" ON standings;

-- edge_skater_stats
DROP POLICY IF EXISTS "ess_write" ON edge_skater_stats;
DROP POLICY IF EXISTS "ess_update" ON edge_skater_stats;

-- edge_goalie_stats
DROP POLICY IF EXISTS "egs_write" ON edge_goalie_stats;
DROP POLICY IF EXISTS "egs_update" ON edge_goalie_stats;

-- edge_team_stats
DROP POLICY IF EXISTS "ets_write" ON edge_team_stats;
DROP POLICY IF EXISTS "ets_update" ON edge_team_stats;

-- game_penalties
DROP POLICY IF EXISTS "gp_write" ON game_penalties;
DROP POLICY IF EXISTS "gp_update" ON game_penalties;

-- game_three_stars
DROP POLICY IF EXISTS "gts_write" ON game_three_stars;
DROP POLICY IF EXISTS "gts_update" ON game_three_stars;

-- sync_log
DROP POLICY IF EXISTS "sync_log_write" ON sync_log;
DROP POLICY IF EXISTS "sync_log_update" ON sync_log;

-- team_stat_categories
DROP POLICY IF EXISTS "tsc_write" ON team_stat_categories;
DROP POLICY IF EXISTS "tsc_update" ON team_stat_categories;

-- skater_stat_categories
DROP POLICY IF EXISTS "ssc_write" ON skater_stat_categories;
DROP POLICY IF EXISTS "ssc_update" ON skater_stat_categories;

-- goalie_stat_categories
DROP POLICY IF EXISTS "gsc_write" ON goalie_stat_categories;
DROP POLICY IF EXISTS "gsc_update" ON goalie_stat_categories;

-- team_game_stats
DROP POLICY IF EXISTS "tgs_write" ON team_game_stats;
DROP POLICY IF EXISTS "tgs_update" ON team_game_stats;

-- edge_detailed_stats
DROP POLICY IF EXISTS "edge_detailed_write" ON edge_detailed_stats;
DROP POLICY IF EXISTS "edge_detailed_update" ON edge_detailed_stats;

-- edge_leaderboards
DROP POLICY IF EXISTS "edge_lb_write" ON edge_leaderboards;
DROP POLICY IF EXISTS "edge_lb_update" ON edge_leaderboards;

-- game_play_by_play
DROP POLICY IF EXISTS "pbp_write" ON game_play_by_play;

-- game_details
DROP POLICY IF EXISTS "gd_write" ON game_details;
DROP POLICY IF EXISTS "gd_update" ON game_details;

-- player_career_data
DROP POLICY IF EXISTS "pcd_write" ON player_career_data;
DROP POLICY IF EXISTS "pcd_update" ON player_career_data;

-- supplemental_data — table dropped in 20260208020000_drop_redundant_tables.sql

-- skater_game_categories
DROP POLICY IF EXISTS "sgc_write" ON skater_game_categories;
DROP POLICY IF EXISTS "sgc_update" ON skater_game_categories;

-- goalie_game_categories
DROP POLICY IF EXISTS "ggc_write" ON goalie_game_categories;
DROP POLICY IF EXISTS "ggc_update" ON goalie_game_categories;

-- player_game_logs — table dropped in 20260208020000_drop_redundant_tables.sql
