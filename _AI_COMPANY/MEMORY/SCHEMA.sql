-- PUCK-IQ Database Schema
-- Target: Supabase (PostgreSQL)
-- Last Updated: 2026-02-07 (Comprehensive NHL Data Sprint)

-- ============================================
-- OVERVIEW
-- ============================================
-- PuckIQ stores ALL NHL data from the 2025-26 season in Supabase.
-- Services use "Supabase-first with NHL API fallback" pattern.
-- Data is seeded via scripts/seed-*.mjs and synced twice daily.
--
-- AsyncStorage keys remain for client-only data:
--   puckiq_daily_picks, puckiq_streak_data, puckiq_last_visit,
--   puckiq_last_check_date, selectedTeam, analytics_user_id,
--   analytics_events, notification_settings, favorite_teams
--
-- Supabase is configured for AUTH (email + Apple Sign-In) + DATA.
-- All tables have RLS enabled with public read + service write.

-- ============================================
-- 1. TEAMS (32 rows)
-- Source: NHL Standings API + schedule
-- Updated: On season start, rarely changes
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

-- ============================================
-- 2. PLAYERS (~875 rows)
-- Source: NHL club-stats + player landing APIs
-- Updated: Weekly or when roster changes occur
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

-- ============================================
-- 3. GAMES (1312 rows for 2025-26 season)
-- Source: NHL club-schedule-season + score APIs
-- Updated: Twice daily (sync recent results)
-- ============================================
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
  away_team_id INTEGER REFERENCES teams(id),
  away_team_abbrev TEXT NOT NULL,
  away_score INTEGER DEFAULT 0,
  away_sog INTEGER,                          -- shots on goal
  home_team_id INTEGER REFERENCES teams(id),
  home_team_abbrev TEXT NOT NULL,
  home_score INTEGER DEFAULT 0,
  home_sog INTEGER,                          -- shots on goal
  period INTEGER,                            -- final period number
  period_type TEXT,                           -- REG, OT, SO
  winning_goalie_id INTEGER,
  losing_goalie_id INTEGER,
  game_center_link TEXT,
  three_min_recap TEXT,
  neutral_site BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. GAME_RESULTS (legacy, 1012 rows)
-- Source: Original seeding from club-schedule-season
-- NOTE: Still used by gameResults.ts service for H2H queries.
-- Consider migrating to use 'games' table instead.
-- ============================================
CREATE TABLE IF NOT EXISTS game_results (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT UNIQUE NOT NULL,
  season TEXT NOT NULL,
  game_date DATE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  game_state TEXT NOT NULL DEFAULT 'FUT',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. GAME_GOALS (~5663 rows)
-- Source: NHL gamecenter/{id}/landing scoring data
-- Updated: With game results sync
-- ============================================
CREATE TABLE IF NOT EXISTS game_goals (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  period INTEGER NOT NULL,
  period_type TEXT NOT NULL,                 -- REG, OT, SO
  time_in_period TEXT NOT NULL,
  scorer_player_id INTEGER,
  scorer_name TEXT,
  team_abbrev TEXT NOT NULL,
  away_score INTEGER NOT NULL,
  home_score INTEGER NOT NULL,
  strength TEXT,                             -- ev, pp, sh, en
  shot_type TEXT,                            -- wrist, slap, snap, backhand, etc.
  goal_modifier TEXT,                        -- none, empty-net, penalty-shot
  assist1_player_id INTEGER,
  assist1_name TEXT,
  assist2_player_id INTEGER,
  assist2_name TEXT,
  highlight_clip_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, period, time_in_period, scorer_player_id)
);

-- ============================================
-- 6. GAME_SKATER_STATS (~1008+ rows per 28 games)
-- Source: NHL gamecenter/{id}/boxscore playerByGameStats
-- Updated: With game results sync
-- ============================================
CREATE TABLE IF NOT EXISTS game_skater_stats (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL,
  team_abbrev TEXT NOT NULL,
  position TEXT,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  plus_minus INTEGER DEFAULT 0,
  pim INTEGER DEFAULT 0,
  hits INTEGER DEFAULT 0,
  blocked_shots INTEGER DEFAULT 0,
  power_play_goals INTEGER DEFAULT 0,
  shots_on_goal INTEGER DEFAULT 0,
  faceoff_win_pctg REAL,
  toi TEXT,
  toi_seconds INTEGER,
  shifts INTEGER DEFAULT 0,
  giveaways INTEGER DEFAULT 0,
  takeaways INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- ============================================
-- 7. GAME_GOALIE_STATS (~112+ rows)
-- Source: NHL gamecenter/{id}/boxscore playerByGameStats
-- Updated: With game results sync
-- ============================================
CREATE TABLE IF NOT EXISTS game_goalie_stats (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL,
  team_abbrev TEXT NOT NULL,
  decision TEXT,                              -- W, L, O
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
  toi TEXT,
  toi_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- ============================================
-- 8. SKATER_SEASON_STATS (~726 rows)
-- Source: NHL club-stats/{team}/now
-- Updated: Twice daily
-- ============================================
CREATE TABLE IF NOT EXISTS skater_season_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
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
  avg_toi_per_game REAL,
  avg_shifts_per_game REAL,
  faceoff_win_pctg REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season, team_abbrev)
);

-- ============================================
-- 9. GOALIE_SEASON_STATS (~75 rows)
-- Source: NHL club-stats/{team}/now
-- Updated: Twice daily
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

-- ============================================
-- 10. STANDINGS (32 rows per snapshot)
-- Source: NHL standings/now
-- Updated: Twice daily (snapshot-based)
-- ============================================
CREATE TABLE IF NOT EXISTS standings (
  id BIGSERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  team_abbrev TEXT NOT NULL,
  season INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ot_losses INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  point_pctg REAL,
  regulation_wins INTEGER DEFAULT 0,
  regulation_plus_ot_wins INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  goal_differential INTEGER DEFAULT 0,
  goals_for_pctg REAL,
  streak_code TEXT,
  streak_count INTEGER DEFAULT 0,
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
  l10_wins INTEGER DEFAULT 0,
  l10_losses INTEGER DEFAULT 0,
  l10_ot_losses INTEGER DEFAULT 0,
  l10_points INTEGER DEFAULT 0,
  l10_goal_differential INTEGER DEFAULT 0,
  shootout_wins INTEGER DEFAULT 0,
  shootout_losses INTEGER DEFAULT 0,
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

-- ============================================
-- 11. EDGE_SKATER_STATS (~200 rows)
-- Source: NHL Edge skater-detail/{id}/now
-- Updated: Twice daily for top players
-- ============================================
CREATE TABLE IF NOT EXISTS edge_skater_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,
  top_shot_speed_mph REAL,
  top_shot_speed_percentile REAL,
  top_shot_speed_rank INTEGER,
  max_skating_speed_mph REAL,
  max_skating_speed_percentile REAL,
  max_skating_speed_rank INTEGER,
  bursts_over_20 INTEGER,
  bursts_over_20_percentile REAL,
  total_distance_miles REAL,
  total_distance_percentile REAL,
  total_distance_rank INTEGER,
  offensive_zone_pctg REAL,
  neutral_zone_pctg REAL,
  defensive_zone_pctg REAL,
  shot_location_summary JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season)
);

-- ============================================
-- 12. EDGE_GOALIE_STATS (~60 rows)
-- Source: NHL Edge goalie-detail/{id}/now
-- Updated: Twice daily
-- ============================================
CREATE TABLE IF NOT EXISTS edge_goalie_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,
  gaa REAL,
  gaa_percentile REAL,
  games_above_900 INTEGER,
  games_above_900_percentile REAL,
  goal_diff_per_60 REAL,
  goal_diff_per_60_percentile REAL,
  shot_location_summary JSONB,
  shot_location_details JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season)
);

-- ============================================
-- 13. EDGE_TEAM_STATS (32 rows)
-- Source: NHL Edge team-detail/{id}/now
-- Updated: Twice daily
-- ============================================
CREATE TABLE IF NOT EXISTS edge_team_stats (
  id BIGSERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  team_abbrev TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 20252026,
  top_shot_speed_mph REAL,
  top_shot_speed_rank INTEGER,
  shot_attempts_over_90 INTEGER,
  shot_attempts_over_90_rank INTEGER,
  max_skating_speed_mph REAL,
  max_skating_speed_rank INTEGER,
  bursts_over_22 INTEGER,
  bursts_over_22_rank INTEGER,
  total_distance_miles REAL,
  total_distance_rank INTEGER,
  offensive_zone_pctg REAL,
  neutral_zone_pctg REAL,
  defensive_zone_pctg REAL,
  offensive_zone_rank INTEGER,
  defensive_zone_rank INTEGER,
  shot_location_summary JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, season)
);

-- ============================================
-- 14. GAME_PENALTIES (~6751 rows)
-- Source: NHL gamecenter/{id}/landing penalties
-- Updated: With game results sync
-- ============================================
CREATE TABLE IF NOT EXISTS game_penalties (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  period INTEGER NOT NULL,
  time_in_period TEXT NOT NULL,
  player_id INTEGER,
  player_name TEXT,
  team_abbrev TEXT NOT NULL,
  penalty_type TEXT,
  duration INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 15. GAME_THREE_STARS (~2724 rows)
-- Source: NHL gamecenter/{id}/landing threeStars
-- Updated: With game results sync
-- ============================================
CREATE TABLE IF NOT EXISTS game_three_stars (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  star_number INTEGER NOT NULL,
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

-- ============================================
-- 16. SYNC_LOG (tracking table)
-- Source: Internal — written by seed/sync scripts
-- ============================================
CREATE TABLE IF NOT EXISTS sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB
);

-- ============================================
-- STORAGE ESTIMATES (2025-26 season)
-- ============================================
-- teams:               32 rows × ~200B = ~6KB
-- players:            875 rows × ~300B = ~260KB
-- games:            1,312 rows × ~400B = ~525KB
-- game_results:     1,012 rows × ~100B = ~101KB
-- game_goals:       5,663 rows × ~300B = ~1.7MB
-- game_skater_stats: ~33K rows × ~200B = ~6.6MB (all boxscores)
-- game_goalie_stats: ~3.6K rows × ~250B = ~900KB
-- game_penalties:    6,751 rows × ~200B = ~1.4MB
-- game_three_stars:  2,724 rows × ~150B = ~409KB
-- skater_season_stats: 726 rows × ~200B = ~145KB
-- goalie_season_stats:  75 rows × ~200B = ~15KB
-- standings:           32 rows × ~400B = ~13KB
-- edge_skater_stats:  200 rows × ~300B = ~60KB
-- edge_goalie_stats:   60 rows × ~300B = ~18KB
-- edge_team_stats:     32 rows × ~300B = ~10KB
-- TOTAL: ~12MB (well within 500MB free tier)
