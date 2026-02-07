-- ============================================
-- PuckIQ Player Trend Analysis Views
-- Migration: 20260207180000
--
-- SQL views that compute rolling averages, hot/cold
-- detection, and pace projections from per-game data.
-- These read from game_skater_stats, game_goalie_stats,
-- skater_game_categories, and player_game_logs.
--
-- No data duplication — views query existing tables
-- and compute trends on the fly.
-- ============================================

-- ============================================
-- 1. SKATER ROLLING AVERAGES (last 5, 10, 20 games)
-- ============================================
-- Uses game_skater_stats (from boxscores) for basic stats:
-- goals, assists, points, shots, TOI, hits, blocks
CREATE OR REPLACE VIEW skater_rolling_stats AS
WITH numbered AS (
  SELECT
    s.player_id,
    s.team_abbrev,
    s.game_id,
    g.game_date,
    s.goals,
    s.assists,
    s.points,
    s.plus_minus,
    s.shots_on_goal,
    s.hits,
    s.blocked_shots,
    s.pim,
    s.toi,
    s.shifts,
    s.giveaways,
    s.takeaways,
    s.power_play_goals,
    s.faceoff_win_pctg,
    ROW_NUMBER() OVER (PARTITION BY s.player_id ORDER BY g.game_date DESC) AS game_num
  FROM game_skater_stats s
  JOIN games g ON s.game_id = g.id
  WHERE g.game_state IN ('FINAL', 'OFF')
)
SELECT
  player_id,
  team_abbrev,
  -- Last 5 games
  ROUND(AVG(goals) FILTER (WHERE game_num <= 5), 2) AS avg_goals_5g,
  ROUND(AVG(assists) FILTER (WHERE game_num <= 5), 2) AS avg_assists_5g,
  ROUND(AVG(points) FILTER (WHERE game_num <= 5), 2) AS avg_points_5g,
  ROUND(AVG(shots_on_goal) FILTER (WHERE game_num <= 5), 2) AS avg_shots_5g,
  ROUND(AVG(hits) FILTER (WHERE game_num <= 5), 2) AS avg_hits_5g,
  ROUND(AVG(plus_minus) FILTER (WHERE game_num <= 5), 2) AS avg_pm_5g,
  SUM(goals) FILTER (WHERE game_num <= 5) AS total_goals_5g,
  SUM(points) FILTER (WHERE game_num <= 5) AS total_points_5g,

  -- Last 10 games
  ROUND(AVG(goals) FILTER (WHERE game_num <= 10), 2) AS avg_goals_10g,
  ROUND(AVG(assists) FILTER (WHERE game_num <= 10), 2) AS avg_assists_10g,
  ROUND(AVG(points) FILTER (WHERE game_num <= 10), 2) AS avg_points_10g,
  ROUND(AVG(shots_on_goal) FILTER (WHERE game_num <= 10), 2) AS avg_shots_10g,
  ROUND(AVG(hits) FILTER (WHERE game_num <= 10), 2) AS avg_hits_10g,
  ROUND(AVG(plus_minus) FILTER (WHERE game_num <= 10), 2) AS avg_pm_10g,
  SUM(goals) FILTER (WHERE game_num <= 10) AS total_goals_10g,
  SUM(points) FILTER (WHERE game_num <= 10) AS total_points_10g,

  -- Last 20 games
  ROUND(AVG(goals) FILTER (WHERE game_num <= 20), 2) AS avg_goals_20g,
  ROUND(AVG(assists) FILTER (WHERE game_num <= 20), 2) AS avg_assists_20g,
  ROUND(AVG(points) FILTER (WHERE game_num <= 20), 2) AS avg_points_20g,
  ROUND(AVG(shots_on_goal) FILTER (WHERE game_num <= 20), 2) AS avg_shots_20g,
  ROUND(AVG(hits) FILTER (WHERE game_num <= 20), 2) AS avg_hits_20g,
  ROUND(AVG(plus_minus) FILTER (WHERE game_num <= 20), 2) AS avg_pm_20g,
  SUM(goals) FILTER (WHERE game_num <= 20) AS total_goals_20g,
  SUM(points) FILTER (WHERE game_num <= 20) AS total_points_20g,

  -- Season totals
  COUNT(*) AS games_played,
  SUM(goals) AS season_goals,
  SUM(assists) AS season_assists,
  SUM(points) AS season_points,
  ROUND(AVG(goals), 2) AS season_avg_goals,
  ROUND(AVG(points), 2) AS season_avg_points,

  -- Most recent game date
  MAX(game_date) AS last_game_date
FROM numbered
GROUP BY player_id, team_abbrev;

-- ============================================
-- 2. SKATER HOT/COLD DETECTION
-- ============================================
-- Compares recent 5-game pace to season average.
-- hot_cold_score > 0 means trending up, < 0 means trending down.
-- Magnitude indicates how far from average (in standard deviations).
CREATE OR REPLACE VIEW skater_hot_cold AS
WITH game_points AS (
  SELECT
    s.player_id,
    s.team_abbrev,
    g.game_date,
    s.points,
    s.goals,
    s.shots_on_goal,
    ROW_NUMBER() OVER (PARTITION BY s.player_id ORDER BY g.game_date DESC) AS game_num
  FROM game_skater_stats s
  JOIN games g ON s.game_id = g.id
  WHERE g.game_state IN ('FINAL', 'OFF')
),
stats AS (
  SELECT
    player_id,
    team_abbrev,
    COUNT(*) AS games_played,
    ROUND(AVG(points), 3) AS season_ppg,
    ROUND(STDDEV_POP(points), 3) AS season_ppg_stddev,
    ROUND(AVG(goals), 3) AS season_gpg,
    ROUND(AVG(points) FILTER (WHERE game_num <= 5), 3) AS recent_ppg,
    ROUND(AVG(goals) FILTER (WHERE game_num <= 5), 3) AS recent_gpg,
    ROUND(AVG(shots_on_goal) FILTER (WHERE game_num <= 5), 3) AS recent_shots,
    ROUND(AVG(shots_on_goal), 3) AS season_shots,
    -- Point streak: count consecutive games with a point from most recent
    (SELECT COUNT(*)
     FROM game_points gp2
     WHERE gp2.player_id = game_points.player_id
       AND gp2.game_num <= 82
       AND gp2.points > 0
       AND gp2.game_num <= (
         SELECT COALESCE(MIN(gp3.game_num) - 1, 82)
         FROM game_points gp3
         WHERE gp3.player_id = game_points.player_id
           AND gp3.points = 0
       )
    ) AS point_streak
  FROM game_points
  GROUP BY player_id, team_abbrev
  HAVING COUNT(*) >= 10  -- Need at least 10 games for meaningful comparison
)
SELECT
  player_id,
  team_abbrev,
  games_played,
  season_ppg,
  recent_ppg,
  season_gpg,
  recent_gpg,
  point_streak,
  -- Hot/cold score: how many stddevs above/below season average
  CASE
    WHEN season_ppg_stddev > 0
    THEN ROUND((recent_ppg - season_ppg) / season_ppg_stddev, 2)
    ELSE 0
  END AS hot_cold_score,
  -- Human-readable label
  CASE
    WHEN season_ppg_stddev > 0 AND (recent_ppg - season_ppg) / season_ppg_stddev >= 1.5 THEN 'HOT'
    WHEN season_ppg_stddev > 0 AND (recent_ppg - season_ppg) / season_ppg_stddev >= 0.5 THEN 'WARM'
    WHEN season_ppg_stddev > 0 AND (recent_ppg - season_ppg) / season_ppg_stddev <= -1.5 THEN 'COLD'
    WHEN season_ppg_stddev > 0 AND (recent_ppg - season_ppg) / season_ppg_stddev <= -0.5 THEN 'COOL'
    ELSE 'STEADY'
  END AS trend_label,
  -- Shooting % trend
  CASE
    WHEN recent_shots > 0 THEN ROUND(recent_gpg / recent_shots * 100, 1)
    ELSE 0
  END AS recent_shooting_pct,
  CASE
    WHEN season_shots > 0 THEN ROUND(season_gpg / season_shots * 100, 1)
    ELSE 0
  END AS season_shooting_pct
FROM stats;

-- ============================================
-- 3. SKATER PACE PROJECTIONS (82-game pace)
-- ============================================
-- Projects season totals based on current per-game rate.
CREATE OR REPLACE VIEW skater_pace_projections AS
SELECT
  s.player_id,
  s.team_abbrev,
  s.season,
  s.games_played,
  s.goals,
  s.assists,
  s.points,
  s.shots,
  s.pim,
  s.power_play_goals,
  s.game_winning_goals,
  -- 82-game projections
  CASE WHEN s.games_played > 0
    THEN ROUND(s.goals::NUMERIC / s.games_played * 82, 0)
    ELSE 0
  END AS projected_goals_82,
  CASE WHEN s.games_played > 0
    THEN ROUND(s.assists::NUMERIC / s.games_played * 82, 0)
    ELSE 0
  END AS projected_assists_82,
  CASE WHEN s.games_played > 0
    THEN ROUND(s.points::NUMERIC / s.games_played * 82, 0)
    ELSE 0
  END AS projected_points_82,
  CASE WHEN s.games_played > 0
    THEN ROUND(s.shots::NUMERIC / s.games_played * 82, 0)
    ELSE 0
  END AS projected_shots_82,
  CASE WHEN s.games_played > 0
    THEN ROUND(s.power_play_goals::NUMERIC / s.games_played * 82, 0)
    ELSE 0
  END AS projected_ppg_82,
  -- Per-game rates
  CASE WHEN s.games_played > 0
    THEN ROUND(s.goals::NUMERIC / s.games_played, 2)
    ELSE 0
  END AS goals_per_game,
  CASE WHEN s.games_played > 0
    THEN ROUND(s.points::NUMERIC / s.games_played, 2)
    ELSE 0
  END AS points_per_game,
  s.shooting_pctg
FROM skater_season_stats s
WHERE s.games_played > 0;

-- ============================================
-- 4. GOALIE ROLLING STATS
-- ============================================
CREATE OR REPLACE VIEW goalie_rolling_stats AS
WITH numbered AS (
  SELECT
    g_stat.player_id,
    g_stat.team_abbrev,
    g_stat.game_id,
    gm.game_date,
    g_stat.goals_against,
    g_stat.shots_against,
    g_stat.saves,
    g_stat.save_pctg,
    g_stat.decision,
    g_stat.starter,
    ROW_NUMBER() OVER (PARTITION BY g_stat.player_id ORDER BY gm.game_date DESC) AS game_num
  FROM game_goalie_stats g_stat
  JOIN games gm ON g_stat.game_id = gm.id
  WHERE gm.game_state IN ('FINAL', 'OFF')
    AND g_stat.starter = true  -- Only count starts for goalie trends
)
SELECT
  player_id,
  team_abbrev,

  -- Last 5 starts
  ROUND(AVG(goals_against) FILTER (WHERE game_num <= 5), 2) AS avg_ga_5g,
  CASE WHEN SUM(shots_against) FILTER (WHERE game_num <= 5) > 0
    THEN ROUND(SUM(saves)::NUMERIC FILTER (WHERE game_num <= 5) / SUM(shots_against) FILTER (WHERE game_num <= 5), 3)
    ELSE NULL
  END AS save_pct_5g,
  COUNT(*) FILTER (WHERE game_num <= 5 AND decision = 'W') AS wins_5g,

  -- Last 10 starts
  ROUND(AVG(goals_against) FILTER (WHERE game_num <= 10), 2) AS avg_ga_10g,
  CASE WHEN SUM(shots_against) FILTER (WHERE game_num <= 10) > 0
    THEN ROUND(SUM(saves)::NUMERIC FILTER (WHERE game_num <= 10) / SUM(shots_against) FILTER (WHERE game_num <= 10), 3)
    ELSE NULL
  END AS save_pct_10g,
  COUNT(*) FILTER (WHERE game_num <= 10 AND decision = 'W') AS wins_10g,

  -- Season
  COUNT(*) AS starts,
  SUM(goals_against) AS season_ga,
  SUM(shots_against) AS season_sa,
  CASE WHEN SUM(shots_against) > 0
    THEN ROUND(SUM(saves)::NUMERIC / SUM(shots_against), 3)
    ELSE NULL
  END AS season_save_pct,
  ROUND(AVG(goals_against), 2) AS season_avg_ga,
  COUNT(*) FILTER (WHERE decision = 'W') AS season_wins,
  COUNT(*) FILTER (WHERE goals_against = 0) AS season_shutouts,

  MAX(game_date) AS last_start_date
FROM numbered
GROUP BY player_id, team_abbrev;

-- ============================================
-- 5. ADVANCED STATS TRENDS (from skater_game_categories)
-- ============================================
-- Rolling Corsi%, Fenwick%, PDO from per-game advanced data.
-- Only available after weekly sync populates skater_game_categories.
CREATE OR REPLACE VIEW skater_advanced_trends AS
WITH poss AS (
  SELECT
    sgc.player_id,
    sgc.team_abbrev,
    sgc.game_date,
    -- Extract Corsi/Fenwick from the JSONB data
    (sgc.data->>'satPctg')::NUMERIC AS corsi_pct,
    (sgc.data->>'usatPctg')::NUMERIC AS fenwick_pct,
    (sgc.data->>'satFor')::INTEGER AS corsi_for,
    (sgc.data->>'satAgainst')::INTEGER AS corsi_against,
    (sgc.data->>'offensiveZoneStartPctg')::NUMERIC AS oz_start_pct,
    ROW_NUMBER() OVER (PARTITION BY sgc.player_id ORDER BY sgc.game_date DESC) AS game_num
  FROM skater_game_categories sgc
  WHERE sgc.stat_category = 'puckPossessions'
),
pct AS (
  SELECT
    sgc.player_id,
    sgc.game_date,
    (sgc.data->>'shootingPctg5v5')::NUMERIC AS shooting_pct_5v5,
    (sgc.data->>'onIceSavePctg5v5')::NUMERIC AS on_ice_save_pct_5v5,
    -- PDO = on-ice shooting% + on-ice save% (usually hovers around 100)
    COALESCE((sgc.data->>'shootingPctg5v5')::NUMERIC, 0) +
    COALESCE((sgc.data->>'onIceSavePctg5v5')::NUMERIC, 0) AS pdo,
    ROW_NUMBER() OVER (PARTITION BY sgc.player_id ORDER BY sgc.game_date DESC) AS game_num
  FROM skater_game_categories sgc
  WHERE sgc.stat_category = 'percentages'
)
SELECT
  p.player_id,
  p.team_abbrev,

  -- Last 5 games advanced
  ROUND(AVG(p.corsi_pct) FILTER (WHERE p.game_num <= 5), 1) AS avg_corsi_pct_5g,
  ROUND(AVG(p.fenwick_pct) FILTER (WHERE p.game_num <= 5), 1) AS avg_fenwick_pct_5g,
  ROUND(AVG(p.oz_start_pct) FILTER (WHERE p.game_num <= 5), 1) AS avg_oz_start_5g,
  ROUND(AVG(pc.pdo) FILTER (WHERE pc.game_num <= 5), 1) AS avg_pdo_5g,

  -- Last 10 games advanced
  ROUND(AVG(p.corsi_pct) FILTER (WHERE p.game_num <= 10), 1) AS avg_corsi_pct_10g,
  ROUND(AVG(p.fenwick_pct) FILTER (WHERE p.game_num <= 10), 1) AS avg_fenwick_pct_10g,
  ROUND(AVG(p.oz_start_pct) FILTER (WHERE p.game_num <= 10), 1) AS avg_oz_start_10g,
  ROUND(AVG(pc.pdo) FILTER (WHERE pc.game_num <= 10), 1) AS avg_pdo_10g,

  -- Last 20 games advanced
  ROUND(AVG(p.corsi_pct) FILTER (WHERE p.game_num <= 20), 1) AS avg_corsi_pct_20g,
  ROUND(AVG(p.fenwick_pct) FILTER (WHERE p.game_num <= 20), 1) AS avg_fenwick_pct_20g,
  ROUND(AVG(p.oz_start_pct) FILTER (WHERE p.game_num <= 20), 1) AS avg_oz_start_20g,
  ROUND(AVG(pc.pdo) FILTER (WHERE pc.game_num <= 20), 1) AS avg_pdo_20g,

  -- Season averages
  ROUND(AVG(p.corsi_pct), 1) AS season_corsi_pct,
  ROUND(AVG(p.fenwick_pct), 1) AS season_fenwick_pct,
  ROUND(AVG(pc.pdo), 1) AS season_pdo,
  COUNT(*) AS games_with_advanced

FROM poss p
LEFT JOIN pct pc ON p.player_id = pc.player_id AND p.game_date = pc.game_date
GROUP BY p.player_id, p.team_abbrev;

-- ============================================
-- 6. TOP TRENDING SKATERS (convenience view)
-- ============================================
-- Combines rolling stats + hot/cold to surface the most interesting players.
-- Query this view with ORDER BY hot_cold_score DESC/ASC LIMIT 10 for hot/cold lists.
CREATE OR REPLACE VIEW skater_trend_summary AS
SELECT
  r.player_id,
  p.first_name || ' ' || p.last_name AS player_name,
  r.team_abbrev,
  p.position,
  p.headshot_url,
  r.games_played,
  r.season_goals,
  r.season_assists,
  r.season_points,

  -- Rolling 5-game
  r.avg_goals_5g,
  r.avg_points_5g,
  r.total_points_5g,

  -- Rolling 10-game
  r.avg_goals_10g,
  r.avg_points_10g,
  r.total_points_10g,

  -- Hot/cold
  hc.hot_cold_score,
  hc.trend_label,
  hc.point_streak,
  hc.recent_ppg,
  hc.season_ppg,
  hc.recent_shooting_pct,
  hc.season_shooting_pct,

  -- Pace
  pp.projected_goals_82,
  pp.projected_points_82,
  pp.goals_per_game,
  pp.points_per_game,

  -- Advanced (may be NULL if weekly sync hasn't run)
  at.avg_corsi_pct_5g,
  at.avg_corsi_pct_10g,
  at.season_corsi_pct,
  at.avg_pdo_5g,
  at.season_pdo,

  r.last_game_date
FROM skater_rolling_stats r
LEFT JOIN players p ON r.player_id = p.id
LEFT JOIN skater_hot_cold hc ON r.player_id = hc.player_id
LEFT JOIN skater_pace_projections pp ON r.player_id = pp.player_id AND r.team_abbrev = pp.team_abbrev
LEFT JOIN skater_advanced_trends at ON r.player_id = at.player_id
ORDER BY r.season_points DESC;

-- ============================================
-- 7. SCORING RATE TRENDS (goals/60, points/60 per game)
-- ============================================
-- Per-game scoring rates from Stats REST API — only available after weekly sync.
CREATE OR REPLACE VIEW skater_scoring_rate_trends AS
SELECT
  sgc.player_id,
  sgc.player_name,
  sgc.team_abbrev,
  sgc.game_id,
  sgc.game_date,
  (sgc.data->>'goalsPer60')::NUMERIC AS goals_per_60,
  (sgc.data->>'assistsPer60')::NUMERIC AS assists_per_60,
  (sgc.data->>'pointsPer60')::NUMERIC AS points_per_60,
  (sgc.data->>'shotsPer60')::NUMERIC AS shots_per_60,
  ROUND(AVG((sgc.data->>'pointsPer60')::NUMERIC) OVER w5, 2) AS points_per_60_avg_5,
  ROUND(AVG((sgc.data->>'pointsPer60')::NUMERIC) OVER w10, 2) AS points_per_60_avg_10,
  ROW_NUMBER() OVER (PARTITION BY sgc.player_id ORDER BY sgc.game_date, sgc.game_id) AS game_number
FROM skater_game_categories sgc
WHERE sgc.stat_category = 'scoringRates'
WINDOW
  w5  AS (PARTITION BY sgc.player_id ORDER BY sgc.game_date, sgc.game_id ROWS BETWEEN 4 PRECEDING AND CURRENT ROW),
  w10 AS (PARTITION BY sgc.player_id ORDER BY sgc.game_date, sgc.game_id ROWS BETWEEN 9 PRECEDING AND CURRENT ROW)
ORDER BY sgc.player_id, sgc.game_date;

-- ============================================
-- 8. TEAM ROLLING PERFORMANCE
-- ============================================
-- Win rate, GF/GA trends over last 5/10 games per team.
CREATE OR REPLACE VIEW team_rolling_performance AS
WITH team_games AS (
  SELECT
    g.id AS game_id,
    g.game_date,
    CASE WHEN g.home_team_abbrev = t.abbrev THEN 'home' ELSE 'away' END AS venue,
    t.abbrev AS team_abbrev,
    CASE
      WHEN g.home_team_abbrev = t.abbrev AND g.home_score > g.away_score THEN 1
      WHEN g.away_team_abbrev = t.abbrev AND g.away_score > g.home_score THEN 1
      ELSE 0
    END AS win,
    CASE WHEN g.home_team_abbrev = t.abbrev THEN g.home_score ELSE g.away_score END AS goals_for,
    CASE WHEN g.home_team_abbrev = t.abbrev THEN g.away_score ELSE g.home_score END AS goals_against
  FROM games g
  CROSS JOIN (
    SELECT DISTINCT home_team_abbrev AS abbrev FROM games WHERE season = 20252026
    UNION
    SELECT DISTINCT away_team_abbrev FROM games WHERE season = 20252026
  ) t
  WHERE g.season = 20252026
    AND g.game_state IN ('FINAL', 'OFF')
    AND (g.home_team_abbrev = t.abbrev OR g.away_team_abbrev = t.abbrev)
)
SELECT
  team_abbrev,
  game_id,
  game_date,
  venue,
  win,
  goals_for,
  goals_against,
  ROUND(AVG(win)::NUMERIC OVER w5, 3) AS win_pct_5,
  ROUND(AVG(goals_for) OVER w5, 2) AS gf_avg_5,
  ROUND(AVG(goals_against) OVER w5, 2) AS ga_avg_5,
  SUM(win) OVER w5 AS wins_last_5,
  ROUND(AVG(win)::NUMERIC OVER w10, 3) AS win_pct_10,
  ROUND(AVG(goals_for) OVER w10, 2) AS gf_avg_10,
  ROUND(AVG(goals_against) OVER w10, 2) AS ga_avg_10,
  SUM(win) OVER w10 AS wins_last_10,
  SUM(win) OVER season_w AS season_wins,
  ROW_NUMBER() OVER (PARTITION BY team_abbrev ORDER BY game_date, game_id) AS game_number
FROM team_games
WINDOW
  w5       AS (PARTITION BY team_abbrev ORDER BY game_date, game_id ROWS BETWEEN 4 PRECEDING AND CURRENT ROW),
  w10      AS (PARTITION BY team_abbrev ORDER BY game_date, game_id ROWS BETWEEN 9 PRECEDING AND CURRENT ROW),
  season_w AS (PARTITION BY team_abbrev ORDER BY game_date, game_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
ORDER BY team_abbrev, game_date;

-- ============================================
-- RLS: All views inherit RLS from base tables.
-- No additional policies needed.
-- ============================================
