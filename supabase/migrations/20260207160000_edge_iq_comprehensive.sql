-- ============================================
-- PuckIQ Edge IQ Comprehensive JSONB Tables
-- Migration: 20260207160000
--
-- Stores ALL Edge IQ endpoint data as raw JSONB.
-- Two tables:
--   edge_detailed_stats  — per-entity (team/skater/goalie) endpoint data
--   edge_leaderboards    — league-wide landing pages and top-10 lists
-- ============================================

-- ============================================
-- 1. EDGE DETAILED STATS (per-entity)
-- ============================================
CREATE TABLE IF NOT EXISTS edge_detailed_stats (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,        -- 'team', 'skater', 'goalie'
  entity_id INTEGER NOT NULL,       -- team ID or player ID
  entity_name TEXT,
  team_abbrev TEXT,
  season INTEGER NOT NULL DEFAULT 20252026,
  endpoint_name TEXT NOT NULL,      -- e.g., 'team-zone-time-details', 'skater-shot-location-detail'
  data JSONB NOT NULL,              -- full API response
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, season, endpoint_name)
);

CREATE INDEX idx_edge_detailed_type ON edge_detailed_stats (entity_type, endpoint_name);
CREATE INDEX idx_edge_detailed_entity ON edge_detailed_stats (entity_id, season);
CREATE INDEX idx_edge_detailed_team ON edge_detailed_stats (team_abbrev);
CREATE INDEX idx_edge_detailed_data_gin ON edge_detailed_stats USING GIN (data);

ALTER TABLE edge_detailed_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edge_detailed_read" ON edge_detailed_stats FOR SELECT USING (true);
CREATE POLICY "edge_detailed_write" ON edge_detailed_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "edge_detailed_update" ON edge_detailed_stats FOR UPDATE USING (true);

-- ============================================
-- 2. EDGE LEADERBOARDS (league-wide)
-- ============================================
CREATE TABLE IF NOT EXISTS edge_leaderboards (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,           -- 'skater-landing', 'goalie-landing', 'team-landing', 'by-the-numbers'
  subcategory TEXT,                 -- for top-10s: 'skater-speed-top-10', etc.
  season INTEGER NOT NULL DEFAULT 20252026,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, subcategory, season)
);

CREATE INDEX idx_edge_lb_category ON edge_leaderboards (category, season);
CREATE INDEX idx_edge_lb_data_gin ON edge_leaderboards USING GIN (data);

ALTER TABLE edge_leaderboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edge_lb_read" ON edge_leaderboards FOR SELECT USING (true);
CREATE POLICY "edge_lb_write" ON edge_leaderboards FOR INSERT WITH CHECK (true);
CREATE POLICY "edge_lb_update" ON edge_leaderboards FOR UPDATE USING (true);
