-- Fantasy Command Center Migration
-- Creates all new tables needed for PuckIQ Pro v3.0.0

-- 1. User data sync table
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data_key TEXT NOT NULL,
  data_value JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, data_key)
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON user_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own data" ON user_data
  FOR ALL USING (auth.uid() = user_id);

-- 2. ML player fantasy projections
CREATE TABLE IF NOT EXISTS ml_player_projections (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL,
  player_id BIGINT NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  position TEXT,
  format TEXT NOT NULL CHECK (format IN ('yahoo', 'espn')),
  fantasy_points REAL NOT NULL,
  floor REAL,
  ceiling REAL,
  pred_goals REAL,
  pred_assists REAL,
  pred_points REAL,
  pred_sog REAL DEFAULT 0,
  pred_hits REAL DEFAULT 0,
  pred_blocks REAL DEFAULT 0,
  game_date DATE,
  model_version TEXT,
  data_quality TEXT DEFAULT 'fresh',
  predicted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_id, player_id, format)
);

ALTER TABLE ml_player_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON ml_player_projections
  FOR SELECT USING (true);

CREATE INDEX idx_ml_player_proj_game ON ml_player_projections(game_id);
CREATE INDEX idx_ml_player_proj_date ON ml_player_projections(game_date);
CREATE INDEX idx_ml_player_proj_player ON ml_player_projections(player_id);

-- 3. Push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- 4. Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fantasy_prefs JSONB DEFAULT '{"morningBrief": true, "goalieConfirmed": true, "injuryAlerts": true, "gameReminder": false, "waiverAlerts": false}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own prefs" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 5. Global leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  total_picks INT DEFAULT 0,
  correct_picks INT DEFAULT 0,
  accuracy REAL DEFAULT 0,
  streak INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON leaderboard
  FOR SELECT USING (true);

CREATE POLICY "Users update own" ON leaderboard
  FOR ALL USING (auth.uid() = user_id);

-- 6. Referrals tracking
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  redeemed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  redeemed_at TIMESTAMPTZ
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can create referrals" ON referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);
