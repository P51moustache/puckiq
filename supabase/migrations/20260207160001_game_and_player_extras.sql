-- ============================================
-- PuckIQ Game & Player Extra Data
-- Migration: 20260207160001
--
-- Adds: play-by-play events, game details (right-rail),
--        and player career data tables.
-- ============================================

-- ============================================
-- 1. PLAY-BY-PLAY EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS game_play_by_play (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  event_id INTEGER,
  period INTEGER,
  period_type TEXT,
  time_in_period TEXT,
  time_remaining TEXT,
  situation_code TEXT,
  event_type TEXT NOT NULL,    -- 'goal', 'shot-on-goal', 'missed-shot', 'blocked-shot', 'hit', 'faceoff', 'giveaway', 'takeaway', 'penalty', 'stoppage'
  type_desc TEXT,
  x_coord REAL,
  y_coord REAL,
  zone_code TEXT,              -- 'O', 'N', 'D'
  player_id INTEGER,
  player_name TEXT,
  team_abbrev TEXT,
  detail JSONB,                -- Full event details (assists, shot type, penalty info, etc.)
  UNIQUE(game_id, event_id)
);
CREATE INDEX idx_pbp_game ON game_play_by_play (game_id);
CREATE INDEX idx_pbp_type ON game_play_by_play (event_type);
CREATE INDEX idx_pbp_player ON game_play_by_play (player_id);
CREATE INDEX idx_pbp_coords ON game_play_by_play (x_coord, y_coord) WHERE x_coord IS NOT NULL;
ALTER TABLE game_play_by_play ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbp_read" ON game_play_by_play FOR SELECT USING (true);
CREATE POLICY "pbp_write" ON game_play_by_play FOR INSERT WITH CHECK (true);

-- ============================================
-- 2. GAME DETAILS (right-rail)
-- ============================================
CREATE TABLE IF NOT EXISTS game_details (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL UNIQUE,
  officials JSONB,             -- referees and linesmen
  coaches JSONB,               -- home and away coaches
  scratches JSONB,             -- healthy scratches
  shots_by_period JSONB,       -- shots breakdown by period
  season_series JSONB,         -- head-to-head series data
  team_game_stats JSONB,       -- team-level game stats comparison
  game_reports JSONB,          -- links to official NHL reports
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_gd_game ON game_details (game_id);
ALTER TABLE game_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gd_read" ON game_details FOR SELECT USING (true);
CREATE POLICY "gd_write" ON game_details FOR INSERT WITH CHECK (true);
CREATE POLICY "gd_update" ON game_details FOR UPDATE USING (true);

-- ============================================
-- 3. PLAYER CAREER DATA
-- ============================================
CREATE TABLE IF NOT EXISTS player_career_data (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL UNIQUE,
  season_totals JSONB,         -- Array of season-by-season stats
  career_totals JSONB,         -- Career aggregate stats
  awards JSONB,                -- NHL awards history
  last_5_games JSONB,          -- Recent form
  featured_stats JSONB,        -- Current season featured stats
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pcd_player ON player_career_data (player_id);
ALTER TABLE player_career_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcd_read" ON player_career_data FOR SELECT USING (true);
CREATE POLICY "pcd_write" ON player_career_data FOR INSERT WITH CHECK (true);
CREATE POLICY "pcd_update" ON player_career_data FOR UPDATE USING (true);
