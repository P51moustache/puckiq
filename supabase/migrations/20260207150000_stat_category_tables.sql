-- ============================================
-- PuckIQ Stat Category JSONB Tables
-- Migration: 20260207150000
--
-- Stores ALL NHL stats REST API categories as raw JSONB.
-- Covers 24 team, 17 skater, and 8 goalie stat categories,
-- plus per-game team stat breakdowns.
-- ============================================

-- ============================================
-- 1. TEAM STAT CATEGORIES (season-level)
-- ============================================
CREATE TABLE IF NOT EXISTS team_stat_categories (
  id BIGSERIAL PRIMARY KEY,
  team_abbrev TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 20252026,
  stat_category TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_abbrev, season, stat_category)
);

CREATE INDEX IF NOT EXISTS idx_tsc_season_cat ON team_stat_categories (season, stat_category);
CREATE INDEX IF NOT EXISTS idx_tsc_team ON team_stat_categories (team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_tsc_data_gin ON team_stat_categories USING GIN (data);

ALTER TABLE team_stat_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tsc_public_read" ON team_stat_categories FOR SELECT USING (true);
CREATE POLICY "tsc_write" ON team_stat_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "tsc_update" ON team_stat_categories FOR UPDATE USING (true);

-- ============================================
-- 2. SKATER STAT CATEGORIES (season-level)
-- ============================================
CREATE TABLE IF NOT EXISTS skater_stat_categories (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,
  stat_category TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season, stat_category)
);

CREATE INDEX IF NOT EXISTS idx_ssc_season_cat ON skater_stat_categories (season, stat_category);
CREATE INDEX IF NOT EXISTS idx_ssc_player ON skater_stat_categories (player_id, season);
CREATE INDEX IF NOT EXISTS idx_ssc_team ON skater_stat_categories (team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_ssc_data_gin ON skater_stat_categories USING GIN (data);

ALTER TABLE skater_stat_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ssc_public_read" ON skater_stat_categories FOR SELECT USING (true);
CREATE POLICY "ssc_write" ON skater_stat_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "ssc_update" ON skater_stat_categories FOR UPDATE USING (true);

-- ============================================
-- 3. GOALIE STAT CATEGORIES (season-level)
-- ============================================
CREATE TABLE IF NOT EXISTS goalie_stat_categories (
  id BIGSERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,
  stat_category TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season, stat_category)
);

CREATE INDEX IF NOT EXISTS idx_gsc_season_cat ON goalie_stat_categories (season, stat_category);
CREATE INDEX IF NOT EXISTS idx_gsc_player ON goalie_stat_categories (player_id, season);
CREATE INDEX IF NOT EXISTS idx_gsc_team ON goalie_stat_categories (team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_gsc_data_gin ON goalie_stat_categories USING GIN (data);

ALTER TABLE goalie_stat_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsc_public_read" ON goalie_stat_categories FOR SELECT USING (true);
CREATE POLICY "gsc_write" ON goalie_stat_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "gsc_update" ON goalie_stat_categories FOR UPDATE USING (true);

-- ============================================
-- 4. TEAM GAME STATS (per-game breakdowns)
-- ============================================
CREATE TABLE IF NOT EXISTS team_game_stats (
  id BIGSERIAL PRIMARY KEY,
  team_abbrev TEXT NOT NULL,
  game_id INTEGER,
  opponent_abbrev TEXT,
  game_date DATE,
  home_road TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,
  stat_category TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_abbrev, game_id, stat_category)
);

CREATE INDEX IF NOT EXISTS idx_tgs_season_cat ON team_game_stats (season, stat_category);
CREATE INDEX IF NOT EXISTS idx_tgs_team ON team_game_stats (team_abbrev, season);
CREATE INDEX IF NOT EXISTS idx_tgs_game ON team_game_stats (game_id);
CREATE INDEX IF NOT EXISTS idx_tgs_data_gin ON team_game_stats USING GIN (data);

ALTER TABLE team_game_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tgs_public_read" ON team_game_stats FOR SELECT USING (true);
CREATE POLICY "tgs_write" ON team_game_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "tgs_update" ON team_game_stats FOR UPDATE USING (true);

-- ============================================
-- Apply updated_at triggers (reuse existing function)
-- ============================================
-- Note: team_stat_categories, skater_stat_categories, goalie_stat_categories,
-- and team_game_stats use fetched_at instead of updated_at, so no trigger needed.
-- The UNIQUE constraint + ON CONFLICT UPDATE handles freshness via fetched_at.
