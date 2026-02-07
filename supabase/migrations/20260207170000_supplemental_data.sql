-- ============================================
-- PuckIQ Supplemental NHL Data
-- Migration: 20260207170000
--
-- Catch-all JSONB table for NHL API data that
-- doesn't fit structured tables: draft picks,
-- stat leaders, rosters, schedule meta, etc.
-- ============================================

CREATE TABLE IF NOT EXISTS supplemental_data (
  id BIGSERIAL PRIMARY KEY,
  data_type TEXT NOT NULL,          -- 'draft_picks', 'stat_leaders', 'roster', 'schedule_meta', etc.
  data_key TEXT NOT NULL,           -- year, team abbrev, or other identifier
  season INTEGER,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data_type, data_key, season)
);

CREATE INDEX idx_supp_type ON supplemental_data (data_type, season);
CREATE INDEX idx_supp_key ON supplemental_data (data_key);
CREATE INDEX idx_supp_data_gin ON supplemental_data USING GIN (data);

ALTER TABLE supplemental_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supp_public_read" ON supplemental_data FOR SELECT USING (true);
CREATE POLICY "supp_write" ON supplemental_data FOR INSERT WITH CHECK (true);
CREATE POLICY "supp_update" ON supplemental_data FOR UPDATE USING (true);
