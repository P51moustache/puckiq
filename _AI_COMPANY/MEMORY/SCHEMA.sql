-- PUCK-IQ Database Schema
-- Target: Supabase (PostgreSQL)
-- Database Architect writes schema definitions here

-- ============================================
-- CURRENT STATE (as of 2026-02-03)
-- ============================================

-- NO CUSTOM SUPABASE TABLES EXIST YET.
-- All user data is stored client-side in AsyncStorage:
--
--   puckiq_daily_picks       → Pick history by date (JSON blob)
--   puckiq_streak_data       → Streak tracking (currentStreak, longestStreak, lastVisitDate)
--   puckiq_last_visit        → Last visit date string
--   puckiq_last_check_date   → Last yesterday-results check date
--   puckiq_prediction_models → User's custom prediction models (JSON array)
--   selectedTeam             → User's favorite team abbreviation
--   analytics_user_id        → Anonymous analytics user ID
--   analytics_events         → Offline event queue (last 1000 events)
--   notification_settings    → Notification preferences (JSON)
--   favorite_teams           → Array of favorite team abbreviations
--
-- Supabase is configured for AUTH ONLY (email + Apple Sign-In).
-- No RLS policies, no custom tables, no server-side data yet.

-- ============================================
-- CYCLE 2: MVP Prediction Companion (2026-02-03)
-- ============================================

-- Game results table: stores completed NHL game scores.
-- Seeded from NHL API club-schedule-season endpoint (32 team fetches).
-- Synced daily from score/{date} endpoint.
-- Foundation for H2H season series display and future multi-year history.
CREATE TABLE IF NOT EXISTS game_results (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT UNIQUE NOT NULL,        -- NHL API game ID (e.g., 2025020001)
  season TEXT NOT NULL,                   -- e.g., '20252026'
  game_date DATE NOT NULL,
  home_team TEXT NOT NULL,                -- 3-letter abbreviation (e.g., 'TOR')
  away_team TEXT NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  game_state TEXT NOT NULL DEFAULT 'FUT', -- FINAL, OFF, FUT, LIVE
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for H2H queries: WHERE (home_team = X AND away_team = Y) OR vice versa
CREATE INDEX IF NOT EXISTS idx_game_results_h2h ON game_results (season, home_team, away_team);

-- Index for date-range queries (daily sync: fetch by game_date)
CREATE INDEX IF NOT EXISTS idx_game_results_date ON game_results (game_date);

-- Index for team schedule queries
CREATE INDEX IF NOT EXISTS idx_game_results_team ON game_results (season, home_team);

-- RLS: Public read (anon key can SELECT), service role can write
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON game_results FOR SELECT USING (true);
CREATE POLICY "Service role write" ON game_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role update" ON game_results FOR UPDATE USING (true);

-- Storage estimate: ~1,312 rows/season × ~50 bytes/row = ~65KB (negligible vs 500MB limit)
-- Bandwidth: H2H query returns 2-8 rows. Even 1000 daily users = trivial bandwidth.

-- ============================================
-- FUTURE SCHEMA (Blueprint Squad adds tables below)
-- ============================================
-- When designing new tables, consider:
--   1. Supabase RLS policies for row-level security
--   2. Migration from AsyncStorage → Supabase for existing data
--   3. Free-tier limits: 500MB database, 2GB bandwidth
--   4. Indexes on frequently queried columns (user_id, date, team_abbrev)
