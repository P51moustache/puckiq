-- ============================================
-- PuckIQ Per-Game Player Stat Categories (JSONB)
-- Migration: 20260207170000
--
-- Stores per-game advanced stats from the Stats REST API
-- (isGame=true) for skaters and goalies. These provide
-- metrics NOT available from boxscores: Corsi, Fenwick,
-- puck possession, scoring rates per 60, PDO, etc.
--
-- Also stores player game logs from the Web API for
-- a clean per-player chronological view.
-- ============================================

-- ============================================
-- 1. SKATER PER-GAME CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS skater_game_categories (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  game_id INTEGER,
  game_date DATE,
  opponent_abbrev TEXT,
  home_road TEXT,                   -- 'H' or 'R'
  season INTEGER NOT NULL DEFAULT 20252026,
  stat_category TEXT NOT NULL,      -- 'puckPossessions', 'percentages', 'scoringRates', 'timeonice'
  data JSONB NOT NULL,              -- full Stats REST API row for this player+game
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, game_id, stat_category)
);

CREATE INDEX idx_sgc_player_season ON skater_game_categories (player_id, season);
CREATE INDEX idx_sgc_game ON skater_game_categories (game_id);
CREATE INDEX idx_sgc_category ON skater_game_categories (stat_category, season);
CREATE INDEX idx_sgc_team ON skater_game_categories (team_abbrev, season);
CREATE INDEX idx_sgc_date ON skater_game_categories (game_date);
CREATE INDEX idx_sgc_data_gin ON skater_game_categories USING GIN (data);

ALTER TABLE skater_game_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sgc_read" ON skater_game_categories FOR SELECT USING (true);
CREATE POLICY "sgc_write" ON skater_game_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "sgc_update" ON skater_game_categories FOR UPDATE USING (true);

-- ============================================
-- 2. GOALIE PER-GAME CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS goalie_game_categories (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  game_id INTEGER,
  game_date DATE,
  opponent_abbrev TEXT,
  home_road TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,
  stat_category TEXT NOT NULL,      -- 'advanced', 'savesByStrength'
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, game_id, stat_category)
);

CREATE INDEX idx_ggc_player_season ON goalie_game_categories (player_id, season);
CREATE INDEX idx_ggc_game ON goalie_game_categories (game_id);
CREATE INDEX idx_ggc_category ON goalie_game_categories (stat_category, season);
CREATE INDEX idx_ggc_team ON goalie_game_categories (team_abbrev, season);
CREATE INDEX idx_ggc_date ON goalie_game_categories (game_date);
CREATE INDEX idx_ggc_data_gin ON goalie_game_categories USING GIN (data);

ALTER TABLE goalie_game_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ggc_read" ON goalie_game_categories FOR SELECT USING (true);
CREATE POLICY "ggc_write" ON goalie_game_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "ggc_update" ON goalie_game_categories FOR UPDATE USING (true);

-- ============================================
-- 3. PLAYER GAME LOGS (from Web API)
-- ============================================
CREATE TABLE IF NOT EXISTS player_game_logs (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL DEFAULT 20252026,
  game_type INTEGER NOT NULL DEFAULT 2,  -- 2=regular, 3=playoffs
  data JSONB NOT NULL,                   -- Full game log array from /player/{id}/game-log
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season, game_type)
);

CREATE INDEX idx_pgl_player ON player_game_logs (player_id, season);

ALTER TABLE player_game_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pgl_read" ON player_game_logs FOR SELECT USING (true);
CREATE POLICY "pgl_write" ON player_game_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "pgl_update" ON player_game_logs FOR UPDATE USING (true);
