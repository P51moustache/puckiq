-- Create game_results table for H2H season series and game history
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
