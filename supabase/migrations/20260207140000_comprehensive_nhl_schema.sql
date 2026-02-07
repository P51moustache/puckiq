-- ============================================
-- PuckIQ Comprehensive NHL Data Schema
-- Migration: 20260207140000
--
-- Seeds ALL NHL data from the 2025-26 season into Supabase.
-- Tables: teams, players, games (expanded), standings, player stats,
--         goalie stats, game boxscores, and Edge IQ tracking data.
-- ============================================

-- ============================================
-- 1. TEAMS
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY,                    -- NHL team ID (e.g., 10 = TOR)
  abbrev TEXT UNIQUE NOT NULL,               -- 3-letter code (e.g., 'TOR')
  full_name TEXT NOT NULL,                   -- e.g., 'Toronto Maple Leafs'
  common_name TEXT NOT NULL,                 -- e.g., 'Maple Leafs'
  place_name TEXT NOT NULL,                  -- e.g., 'Toronto'
  conference TEXT,                           -- 'Eastern' or 'Western'
  division TEXT,                             -- e.g., 'Atlantic'
  logo_url TEXT,
  dark_logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_public_read" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_write" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "teams_update" ON teams FOR UPDATE USING (true);

-- ============================================
-- 2. PLAYERS
-- ============================================
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,                    -- NHL player ID
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  position TEXT,                             -- C, L, R, D, G
  shoots_catches TEXT,                       -- L or R
  height_inches INTEGER,
  weight_pounds INTEGER,
  birth_date DATE,
  birth_city TEXT,
  birth_country TEXT,
  current_team_id INTEGER REFERENCES teams(id),
  current_team_abbrev TEXT,
  sweater_number INTEGER,
  is_active BOOLEAN DEFAULT true,
  headshot_url TEXT,
  draft_year INTEGER,
  draft_round INTEGER,
  draft_pick INTEGER,
  draft_overall INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_team ON players (current_team_id);
CREATE INDEX IF NOT EXISTS idx_players_team_abbrev ON players (current_team_abbrev);
CREATE INDEX IF NOT EXISTS idx_players_position ON players (position);
CREATE INDEX IF NOT EXISTS idx_players_name ON players (last_name, first_name);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_public_read" ON players FOR SELECT USING (true);
CREATE POLICY "players_write" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "players_update" ON players FOR UPDATE USING (true);

-- ============================================
-- 3. GAMES (expanded from game_results)
-- ============================================
-- Keep existing game_results table, add new comprehensive games table
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY,                    -- NHL game ID (e.g., 2025020001)
  season INTEGER NOT NULL,                   -- e.g., 20252026
  game_type INTEGER NOT NULL DEFAULT 2,      -- 1=preseason, 2=regular, 3=playoffs
  game_date DATE NOT NULL,
  start_time_utc TIMESTAMPTZ,
  venue TEXT,
  venue_timezone TEXT,
  game_state TEXT NOT NULL DEFAULT 'FUT',    -- FUT, PRE, LIVE, CRIT, FINAL, OFF
  game_schedule_state TEXT DEFAULT 'OK',

  -- Away team
  away_team_id INTEGER REFERENCES teams(id),
  away_team_abbrev TEXT NOT NULL,
  away_score INTEGER DEFAULT 0,
  away_sog INTEGER,                          -- shots on goal

  -- Home team
  home_team_id INTEGER REFERENCES teams(id),
  home_team_abbrev TEXT NOT NULL,
  home_score INTEGER DEFAULT 0,
  home_sog INTEGER,                          -- shots on goal

  -- Game outcome
  period INTEGER,                            -- final period number
  period_type TEXT,                           -- REG, OT, SO

  -- Winning/Losing goalies (from schedule data)
  winning_goalie_id INTEGER,
  losing_goalie_id INTEGER,

  -- Links
  game_center_link TEXT,
  three_min_recap TEXT,

  neutral_site BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_date ON games (game_date);
CREATE INDEX IF NOT EXISTS idx_games_season ON games (season, game_type);
CREATE INDEX IF NOT EXISTS idx_games_away_team ON games (away_team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_games_home_team ON games (home_team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_games_state ON games (game_state);
CREATE INDEX IF NOT EXISTS idx_games_h2h ON games (season, away_team_abbrev, home_team_abbrev);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_public_read" ON games FOR SELECT USING (true);
CREATE POLICY "games_write" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "games_update" ON games FOR UPDATE USING (true);

-- ============================================
-- 4. GAME SCORING (goals per game)
-- ============================================
CREATE TABLE IF NOT EXISTS game_goals (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  period INTEGER NOT NULL,
  period_type TEXT NOT NULL,                 -- REG, OT, SO
  time_in_period TEXT NOT NULL,              -- e.g., '01:46'
  scorer_player_id INTEGER,
  scorer_name TEXT,
  team_abbrev TEXT NOT NULL,
  away_score INTEGER NOT NULL,               -- running score after goal
  home_score INTEGER NOT NULL,               -- running score after goal
  strength TEXT,                             -- ev, pp, sh, en
  shot_type TEXT,                            -- wrist, slap, snap, backhand, deflected, tip-in
  goal_modifier TEXT,                        -- none, empty-net, penalty-shot
  assist1_player_id INTEGER,
  assist1_name TEXT,
  assist2_player_id INTEGER,
  assist2_name TEXT,
  highlight_clip_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, period, time_in_period, scorer_player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_goals_game ON game_goals (game_id);
CREATE INDEX IF NOT EXISTS idx_game_goals_scorer ON game_goals (scorer_player_id);
CREATE INDEX IF NOT EXISTS idx_game_goals_team ON game_goals (team_abbrev);

ALTER TABLE game_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_goals_public_read" ON game_goals FOR SELECT USING (true);
CREATE POLICY "game_goals_write" ON game_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "game_goals_update" ON game_goals FOR UPDATE USING (true);

-- ============================================
-- 5. GAME SKATER STATS (per-game boxscore for skaters)
-- ============================================
CREATE TABLE IF NOT EXISTS game_skater_stats (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL,
  team_abbrev TEXT NOT NULL,
  position TEXT,                              -- C, L, R, D
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  plus_minus INTEGER DEFAULT 0,
  pim INTEGER DEFAULT 0,                     -- penalty minutes
  hits INTEGER DEFAULT 0,
  blocked_shots INTEGER DEFAULT 0,
  power_play_goals INTEGER DEFAULT 0,
  shots_on_goal INTEGER DEFAULT 0,
  faceoff_win_pctg REAL,
  toi TEXT,                                   -- time on ice as 'MM:SS'
  toi_seconds INTEGER,                        -- time on ice in seconds
  shifts INTEGER DEFAULT 0,
  giveaways INTEGER DEFAULT 0,
  takeaways INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_gss_game ON game_skater_stats (game_id);
CREATE INDEX IF NOT EXISTS idx_gss_player ON game_skater_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_gss_team ON game_skater_stats (team_abbrev);

ALTER TABLE game_skater_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gss_public_read" ON game_skater_stats FOR SELECT USING (true);
CREATE POLICY "gss_write" ON game_skater_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "gss_update" ON game_skater_stats FOR UPDATE USING (true);

-- ============================================
-- 6. GAME GOALIE STATS (per-game boxscore for goalies)
-- ============================================
CREATE TABLE IF NOT EXISTS game_goalie_stats (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL,
  team_abbrev TEXT NOT NULL,
  decision TEXT,                              -- W, L, O (OT loss)
  starter BOOLEAN DEFAULT false,
  goals_against INTEGER DEFAULT 0,
  shots_against INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  save_pctg REAL,
  even_strength_shots_against INTEGER,
  even_strength_goals_against INTEGER,
  power_play_shots_against INTEGER,
  power_play_goals_against INTEGER,
  shorthanded_shots_against INTEGER,
  shorthanded_goals_against INTEGER,
  pim INTEGER DEFAULT 0,
  toi TEXT,                                   -- time on ice as 'MM:SS'
  toi_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_ggs_game ON game_goalie_stats (game_id);
CREATE INDEX IF NOT EXISTS idx_ggs_player ON game_goalie_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_ggs_team ON game_goalie_stats (team_abbrev);

ALTER TABLE game_goalie_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ggs_public_read" ON game_goalie_stats FOR SELECT USING (true);
CREATE POLICY "ggs_write" ON game_goalie_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "ggs_update" ON game_goalie_stats FOR UPDATE USING (true);

-- ============================================
-- 7. SKATER SEASON STATS (aggregated from club-stats)
-- ============================================
CREATE TABLE IF NOT EXISTS skater_season_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL,                   -- e.g., 20252026
  team_abbrev TEXT NOT NULL,
  position TEXT,
  games_played INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  plus_minus INTEGER DEFAULT 0,
  pim INTEGER DEFAULT 0,
  power_play_goals INTEGER DEFAULT 0,
  shorthanded_goals INTEGER DEFAULT 0,
  game_winning_goals INTEGER DEFAULT 0,
  overtime_goals INTEGER DEFAULT 0,
  shots INTEGER DEFAULT 0,
  shooting_pctg REAL,
  avg_toi_per_game REAL,                     -- seconds
  avg_shifts_per_game REAL,
  faceoff_win_pctg REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season, team_abbrev)
);

CREATE INDEX IF NOT EXISTS idx_sss_season ON skater_season_stats (season);
CREATE INDEX IF NOT EXISTS idx_sss_team ON skater_season_stats (team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_sss_player ON skater_season_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_sss_points ON skater_season_stats (season, points DESC);

ALTER TABLE skater_season_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sss_public_read" ON skater_season_stats FOR SELECT USING (true);
CREATE POLICY "sss_write" ON skater_season_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "sss_update" ON skater_season_stats FOR UPDATE USING (true);

-- ============================================
-- 8. GOALIE SEASON STATS (aggregated from club-stats)
-- ============================================
CREATE TABLE IF NOT EXISTS goalie_season_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
  team_abbrev TEXT NOT NULL,
  games_played INTEGER DEFAULT 0,
  games_started INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ot_losses INTEGER DEFAULT 0,
  goals_against_avg REAL,
  save_pctg REAL,
  shots_against INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  shutouts INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  pim INTEGER DEFAULT 0,
  toi_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season, team_abbrev)
);

CREATE INDEX IF NOT EXISTS idx_gss2_season ON goalie_season_stats (season);
CREATE INDEX IF NOT EXISTS idx_gss2_team ON goalie_season_stats (team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_gss2_player ON goalie_season_stats (player_id);

ALTER TABLE goalie_season_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gss2_public_read" ON goalie_season_stats FOR SELECT USING (true);
CREATE POLICY "gss2_write" ON goalie_season_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "gss2_update" ON goalie_season_stats FOR UPDATE USING (true);

-- ============================================
-- 9. STANDINGS
-- ============================================
CREATE TABLE IF NOT EXISTS standings (
  id BIGSERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  team_abbrev TEXT NOT NULL,
  season INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,               -- date this standings snapshot was taken

  -- Record
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ot_losses INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  point_pctg REAL,
  regulation_wins INTEGER DEFAULT 0,
  regulation_plus_ot_wins INTEGER DEFAULT 0,

  -- Goals
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  goal_differential INTEGER DEFAULT 0,
  goals_for_pctg REAL,                       -- per game

  -- Streaks
  streak_code TEXT,                           -- W, L, OT
  streak_count INTEGER DEFAULT 0,

  -- Home/Road splits
  home_wins INTEGER DEFAULT 0,
  home_losses INTEGER DEFAULT 0,
  home_ot_losses INTEGER DEFAULT 0,
  home_goals_for INTEGER DEFAULT 0,
  home_goals_against INTEGER DEFAULT 0,
  road_wins INTEGER DEFAULT 0,
  road_losses INTEGER DEFAULT 0,
  road_ot_losses INTEGER DEFAULT 0,
  road_goals_for INTEGER DEFAULT 0,
  road_goals_against INTEGER DEFAULT 0,

  -- Last 10
  l10_wins INTEGER DEFAULT 0,
  l10_losses INTEGER DEFAULT 0,
  l10_ot_losses INTEGER DEFAULT 0,
  l10_points INTEGER DEFAULT 0,
  l10_goal_differential INTEGER DEFAULT 0,

  -- Shootout
  shootout_wins INTEGER DEFAULT 0,
  shootout_losses INTEGER DEFAULT 0,

  -- Rankings
  conference TEXT,
  conference_sequence INTEGER,
  division TEXT,
  division_sequence INTEGER,
  league_sequence INTEGER,
  wildcard_sequence INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_abbrev, season, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_standings_season ON standings (season, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_standings_team ON standings (team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_standings_league ON standings (season, league_sequence);

ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "standings_public_read" ON standings FOR SELECT USING (true);
CREATE POLICY "standings_write" ON standings FOR INSERT WITH CHECK (true);
CREATE POLICY "standings_update" ON standings FOR UPDATE USING (true);

-- ============================================
-- 10. EDGE SKATER STATS
-- ============================================
CREATE TABLE IF NOT EXISTS edge_skater_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,

  -- Shot speed
  top_shot_speed_mph REAL,
  top_shot_speed_percentile REAL,
  top_shot_speed_rank INTEGER,

  -- Skating speed
  max_skating_speed_mph REAL,
  max_skating_speed_percentile REAL,
  max_skating_speed_rank INTEGER,
  bursts_over_20 INTEGER,
  bursts_over_20_percentile REAL,

  -- Distance
  total_distance_miles REAL,
  total_distance_percentile REAL,
  total_distance_rank INTEGER,

  -- Zone time
  offensive_zone_pctg REAL,
  neutral_zone_pctg REAL,
  defensive_zone_pctg REAL,

  -- Shot location summary (JSON for flexibility)
  shot_location_summary JSONB,

  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season)
);

CREATE INDEX IF NOT EXISTS idx_ess_player ON edge_skater_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_ess_team ON edge_skater_stats (team_abbrev);
CREATE INDEX IF NOT EXISTS idx_ess_speed ON edge_skater_stats (season, max_skating_speed_mph DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ess_shot ON edge_skater_stats (season, top_shot_speed_mph DESC NULLS LAST);

ALTER TABLE edge_skater_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ess_public_read" ON edge_skater_stats FOR SELECT USING (true);
CREATE POLICY "ess_write" ON edge_skater_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "ess_update" ON edge_skater_stats FOR UPDATE USING (true);

-- ============================================
-- 11. EDGE GOALIE STATS
-- ============================================
CREATE TABLE IF NOT EXISTS edge_goalie_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,

  -- Goalie metrics
  gaa REAL,
  gaa_percentile REAL,
  games_above_900 INTEGER,
  games_above_900_percentile REAL,
  goal_diff_per_60 REAL,
  goal_diff_per_60_percentile REAL,

  -- Save location summary (JSON)
  shot_location_summary JSONB,
  shot_location_details JSONB,

  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season)
);

CREATE INDEX IF NOT EXISTS idx_egs_player ON edge_goalie_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_egs_team ON edge_goalie_stats (team_abbrev);

ALTER TABLE edge_goalie_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "egs_public_read" ON edge_goalie_stats FOR SELECT USING (true);
CREATE POLICY "egs_write" ON edge_goalie_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "egs_update" ON edge_goalie_stats FOR UPDATE USING (true);

-- ============================================
-- 12. EDGE TEAM STATS
-- ============================================
CREATE TABLE IF NOT EXISTS edge_team_stats (
  id BIGSERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  team_abbrev TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 20252026,

  -- Shot speed
  top_shot_speed_mph REAL,
  top_shot_speed_rank INTEGER,
  shot_attempts_over_90 INTEGER,
  shot_attempts_over_90_rank INTEGER,

  -- Skating speed
  max_skating_speed_mph REAL,
  max_skating_speed_rank INTEGER,
  bursts_over_22 INTEGER,
  bursts_over_22_rank INTEGER,

  -- Distance
  total_distance_miles REAL,
  total_distance_rank INTEGER,

  -- Zone time
  offensive_zone_pctg REAL,
  neutral_zone_pctg REAL,
  defensive_zone_pctg REAL,
  offensive_zone_rank INTEGER,
  defensive_zone_rank INTEGER,

  -- Shot location summary (JSON)
  shot_location_summary JSONB,

  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, season)
);

CREATE INDEX IF NOT EXISTS idx_ets_team ON edge_team_stats (team_abbrev, season);

ALTER TABLE edge_team_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ets_public_read" ON edge_team_stats FOR SELECT USING (true);
CREATE POLICY "ets_write" ON edge_team_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "ets_update" ON edge_team_stats FOR UPDATE USING (true);

-- ============================================
-- 13. GAME PENALTIES
-- ============================================
CREATE TABLE IF NOT EXISTS game_penalties (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  period INTEGER NOT NULL,
  time_in_period TEXT NOT NULL,
  player_id INTEGER,
  player_name TEXT,
  team_abbrev TEXT NOT NULL,
  penalty_type TEXT,                          -- e.g., 'Tripping', 'Hooking'
  duration INTEGER,                           -- minutes (2, 4, 5, 10)
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gp_game ON game_penalties (game_id);
CREATE INDEX IF NOT EXISTS idx_gp_player ON game_penalties (player_id);

ALTER TABLE game_penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gp_public_read" ON game_penalties FOR SELECT USING (true);
CREATE POLICY "gp_write" ON game_penalties FOR INSERT WITH CHECK (true);
CREATE POLICY "gp_update" ON game_penalties FOR UPDATE USING (true);

-- ============================================
-- 14. THREE STARS (per game)
-- ============================================
CREATE TABLE IF NOT EXISTS game_three_stars (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  star_number INTEGER NOT NULL,               -- 1, 2, or 3
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT NOT NULL,
  position TEXT,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, star_number)
);

CREATE INDEX IF NOT EXISTS idx_gts_game ON game_three_stars (game_id);
CREATE INDEX IF NOT EXISTS idx_gts_player ON game_three_stars (player_id);

ALTER TABLE game_three_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gts_public_read" ON game_three_stars FOR SELECT USING (true);
CREATE POLICY "gts_write" ON game_three_stars FOR INSERT WITH CHECK (true);
CREATE POLICY "gts_update" ON game_three_stars FOR UPDATE USING (true);

-- ============================================
-- 15. SYNC LOG (track when each data type was last synced)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,                    -- 'games', 'standings', 'player_stats', 'edge_stats', etc.
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',              -- 'running', 'completed', 'failed'
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB                              -- extra context
);

CREATE INDEX IF NOT EXISTS idx_sync_log_type ON sync_log (sync_type, completed_at DESC);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_log_public_read" ON sync_log FOR SELECT USING (true);
CREATE POLICY "sync_log_write" ON sync_log FOR INSERT WITH CHECK (true);
CREATE POLICY "sync_log_update" ON sync_log FOR UPDATE USING (true);

-- ============================================
-- HELPER: auto-update updated_at on row change
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables that have it
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'teams', 'players', 'games',
        'skater_season_stats', 'goalie_season_stats', 'standings',
        'edge_skater_stats', 'edge_goalie_stats', 'edge_team_stats'
    ])
    LOOP
        EXECUTE format(
            'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            tbl, tbl
        );
    END LOOP;
END;
$$;
