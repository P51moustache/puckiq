# PuckIQ Database Reference

Complete reference for all Supabase tables, their schema, data sources, and sync schedule.

## Connection Details

- **Provider:** Supabase (PostgreSQL)
- **Client:** `lib/supabase.ts` (React Native app), `scripts/sync/supabase-client.mjs` (sync scripts)
- **Auth:** Row Level Security (RLS) enabled on all tables — public read, service role write
- **Keys:**
  - `EXPO_PUBLIC_SUPABASE_URL` — Project URL (used by app + sync scripts)
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Anonymous key (read-only in app)
  - `SUPABASE_SERVICE_ROLE_KEY` — Service role key (write access for sync scripts, GitHub Actions)

## Schema Overview

The database has 24 core tables organized into 6 groups:

### Reference Data
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `teams` | 32 NHL teams with IDs, names, conference, division, logos | 32 |
| `players` | All rostered players with bio, position, headshot | ~750 |

### Game Data
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `games` | All game data (all states: FUT/LIVE/FINAL) | ~1300/season |
| `game_goals` | Every goal scored (period, time, scorer, assists, strength) | ~5000/season |
| `game_skater_stats` | Per-game boxscore for skaters (goals, assists, TOI, hits) | ~25000/season |
| `game_goalie_stats` | Per-game boxscore for goalies (saves, GAA, decision) | ~2500/season |
| `game_penalties` | Every penalty (type, duration, player) | ~6000/season |
| `game_three_stars` | Three stars of each game | ~2400/season |
| `game_details` | Game right-rail data (officials, scratches, shots by period, season series) | ~1300/season |
| `game_play_by_play` | Full play-by-play event logs per game | ~300k/season |

### Season Stats
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `standings` | Full standings with snapshot_date for historical tracking | 32/snapshot |
| `skater_season_stats` | Aggregated season stats per skater | ~700/season |
| `goalie_season_stats` | Aggregated season stats per goalie | ~70/season |
| `player_career_data` | Player career totals, awards, last 5 games, featured stats | ~750 |

### Tracking Data
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `edge_skater_stats` | NHL Edge IQ: shot speed, skating speed, zone time | ~700 |
| `edge_goalie_stats` | NHL Edge IQ: goalie metrics | ~70 |
| `edge_team_stats` | NHL Edge IQ: team-level tracking | 32 |
| `edge_detailed_stats` | NHL Edge IQ: per-entity detail data (JSONB) | ~800 |
| `edge_leaderboards` | NHL Edge IQ: league-wide landing pages and top-10 lists (JSONB) | ~50 |

### Raw Stats (JSONB bulk storage)
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `team_stat_categories` | Raw NHL stats API team data (24 categories) | ~768 |
| `skater_stat_categories` | Raw NHL stats API skater data (17 categories) | ~12000 |
| `goalie_stat_categories` | Raw NHL stats API goalie data (8 categories) | ~560 |
| `team_game_stats` | Per-game team stat breakdowns | ~25000 |
| `skater_game_categories` | Per-game advanced skater stats (Corsi, Fenwick, PDO) | ~100k/season |
| `goalie_game_categories` | Per-game advanced goalie stats (saves by strength) | ~5k/season |

### Infrastructure
| Table | Purpose |
|-------|---------|
| `sync_log` | Tracks when each data type was last synced |

---

## Table Details

### `teams`

Reference table for all 32 NHL teams.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | NHL team ID (e.g., 10 = TOR) |
| `abbrev` | TEXT UNIQUE | 3-letter code (e.g., 'TOR') |
| `full_name` | TEXT | e.g., 'Toronto Maple Leafs' |
| `common_name` | TEXT | e.g., 'Maple Leafs' |
| `place_name` | TEXT | e.g., 'Toronto' |
| `conference` | TEXT | 'Eastern' or 'Western' |
| `division` | TEXT | 'Atlantic', 'Metropolitan', 'Central', 'Pacific' |
| `logo_url` | TEXT | Light logo URL |
| `dark_logo_url` | TEXT | Dark logo URL |

**Data Source:** NHL API roster endpoints
**Migration:** `20260207140000_comprehensive_nhl_schema.sql`

---

### `players`

All rostered NHL players with bio and team assignment.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | NHL player ID |
| `first_name` | TEXT | First name |
| `last_name` | TEXT | Last name |
| `full_name` | TEXT | Generated: first_name + last_name |
| `position` | TEXT | C, L, R, D, G |
| `shoots_catches` | TEXT | L or R |
| `height_inches` | INTEGER | Height in inches |
| `weight_pounds` | INTEGER | Weight in pounds |
| `birth_date` | DATE | Date of birth |
| `birth_city` | TEXT | Birth city |
| `birth_country` | TEXT | Birth country (ISO) |
| `current_team_id` | INTEGER FK | References teams(id) |
| `current_team_abbrev` | TEXT | Team abbreviation |
| `sweater_number` | INTEGER | Jersey number |
| `is_active` | BOOLEAN | Currently active |
| `headshot_url` | TEXT | Player headshot URL |
| `draft_year` | INTEGER | Draft year |
| `draft_round` | INTEGER | Draft round |
| `draft_pick` | INTEGER | Pick in round |
| `draft_overall` | INTEGER | Overall pick number |

**Data Source:** NHL API — `roster/{team}/current`
**Sync:** `sync-teams.mjs`

---

### `games`

All games including future, live, and completed.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | NHL game ID |
| `season` | INTEGER | e.g., 20252026 |
| `game_type` | INTEGER | 1=preseason, 2=regular, 3=playoffs |
| `game_date` | DATE | Game date |
| `start_time_utc` | TIMESTAMPTZ | Scheduled start time |
| `venue` | TEXT | Arena name |
| `venue_timezone` | TEXT | Venue timezone |
| `game_state` | TEXT | FUT, PRE, LIVE, CRIT, FINAL, OFF |
| `away_team_id` | INTEGER FK | References teams(id) |
| `away_team_abbrev` | TEXT | Away team abbreviation |
| `away_score` | INTEGER | Away team score |
| `away_sog` | INTEGER | Away shots on goal |
| `home_team_id` | INTEGER FK | References teams(id) |
| `home_team_abbrev` | TEXT | Home team abbreviation |
| `home_score` | INTEGER | Home team score |
| `home_sog` | INTEGER | Home shots on goal |
| `period` | INTEGER | Final period number |
| `period_type` | TEXT | REG, OT, SO |
| `winning_goalie_id` | INTEGER | Winning goalie player ID |
| `losing_goalie_id` | INTEGER | Losing goalie player ID |

**Data Source:** NHL API — `club-schedule-season/{team}/{season}` (full) and `score/{date}` (incremental)
**Sync:** `sync-games.mjs`
**Used By:** `services/gameResults.ts`, `services/derivedStats.ts`, `components/model-builder/BacktestPanel.tsx`

---

### `standings`

Daily standings snapshots with full splits and rankings.

| Column | Type | Description |
|--------|------|-------------|
| `team_abbrev` | TEXT | Team abbreviation |
| `season` | INTEGER | Season (e.g., 20252026) |
| `snapshot_date` | DATE | Date of this snapshot |
| `games_played` | INTEGER | Games played |
| `wins` | INTEGER | Total wins |
| `losses` | INTEGER | Regulation losses |
| `ot_losses` | INTEGER | OT/SO losses |
| `points` | INTEGER | Standings points |
| `point_pctg` | REAL | Points percentage |
| `regulation_wins` | INTEGER | Regulation wins only |
| `goals_for/against` | INTEGER | Goals for/against |
| `goal_differential` | INTEGER | Goal differential |
| `streak_code` | TEXT | W, L, OT |
| `streak_count` | INTEGER | Streak length |
| `home_wins/losses/ot_losses` | INTEGER | Home splits |
| `road_wins/losses/ot_losses` | INTEGER | Road splits |
| `l10_wins/losses/ot_losses` | INTEGER | Last 10 games |
| `conference/division` | TEXT | Conference and division |
| `*_sequence` | INTEGER | Ranking positions |

**Unique:** `(team_abbrev, season, snapshot_date)`
**Data Source:** NHL API — `standings/now`
**Sync:** `sync-standings.mjs`

---

### `skater_season_stats`

Aggregated season statistics per skater.

| Column | Type | Description |
|--------|------|-------------|
| `player_id` | INTEGER | NHL player ID |
| `season` | INTEGER | Season |
| `team_abbrev` | TEXT | Team |
| `position` | TEXT | C, L, R, D |
| `games_played` | INTEGER | Games played |
| `goals/assists/points` | INTEGER | Scoring stats |
| `plus_minus` | INTEGER | Plus/minus |
| `pim` | INTEGER | Penalty minutes |
| `power_play_goals` | INTEGER | PP goals |
| `shorthanded_goals` | INTEGER | SH goals |
| `game_winning_goals` | INTEGER | GWG |
| `shots` | INTEGER | Shots on goal |
| `shooting_pctg` | REAL | Shooting percentage |
| `avg_toi_per_game` | REAL | Average TOI (seconds) |
| `faceoff_win_pctg` | REAL | Faceoff win % |

**Unique:** `(player_id, season, team_abbrev)`
**Data Source:** NHL API — `club-stats/{team}/now`
**Sync:** `sync-players.mjs`

---

### `goalie_season_stats`

Aggregated season statistics per goalie.

| Column | Type | Description |
|--------|------|-------------|
| `player_id` | INTEGER | NHL player ID |
| `season` | INTEGER | Season |
| `team_abbrev` | TEXT | Team |
| `games_played/started` | INTEGER | Appearances |
| `wins/losses/ot_losses` | INTEGER | Record |
| `goals_against_avg` | REAL | GAA |
| `save_pctg` | REAL | Save percentage |
| `shots_against/saves` | INTEGER | Shot stats |
| `shutouts` | INTEGER | Shutouts |

**Unique:** `(player_id, season, team_abbrev)`
**Data Source:** NHL API — `club-stats/{team}/now`
**Sync:** `sync-players.mjs`

---

### `sync_log`

Tracks sync operations for monitoring.

| Column | Type | Description |
|--------|------|-------------|
| `sync_type` | TEXT | 'games', 'standings', 'player_stats', etc. |
| `started_at` | TIMESTAMPTZ | Sync start time |
| `completed_at` | TIMESTAMPTZ | Sync completion time |
| `status` | TEXT | 'running', 'completed', 'failed' |
| `records_processed` | INTEGER | Number of records |
| `error_message` | TEXT | Error details if failed |
| `metadata` | JSONB | Extra context |

---

### `edge_detailed_stats`

Per-entity Edge IQ detail data from NHL Edge tracking endpoints. Stores full API responses as JSONB for teams, skaters, and goalies across multiple metric categories.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-incrementing ID |
| `entity_type` | TEXT NOT NULL | 'team', 'skater', or 'goalie' |
| `entity_id` | INTEGER NOT NULL | Team ID or player ID |
| `entity_name` | TEXT | Entity display name |
| `team_abbrev` | TEXT | Team abbreviation |
| `season` | INTEGER | Season (default 20252026) |
| `endpoint_name` | TEXT NOT NULL | API endpoint (e.g., 'team-zone-time-details', 'skater-shot-location-detail') |
| `data` | JSONB NOT NULL | Full API response payload |
| `fetched_at` | TIMESTAMPTZ | When data was fetched |

**Unique:** `(entity_type, entity_id, season, endpoint_name)`
**Indexes:** `(entity_type, endpoint_name)`, `(entity_id, season)`, `(team_abbrev)`, GIN on `data`
**Migration:** `20260207160000_edge_iq_comprehensive.sql`
**Seed:** `scripts/seed-edge-comprehensive.mjs`
**Sync:** `scripts/sync/sync-aggregates.mjs`

---

### `edge_leaderboards`

League-wide Edge IQ landing pages and top-10 leaderboard lists. Stores category-level aggregated data as JSONB.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-incrementing ID |
| `category` | TEXT NOT NULL | 'skater-landing', 'goalie-landing', 'team-landing', 'by-the-numbers' |
| `subcategory` | TEXT | For top-10s: 'skater-speed-top-10', etc. |
| `season` | INTEGER | Season (default 20252026) |
| `data` | JSONB NOT NULL | Full API response payload |
| `fetched_at` | TIMESTAMPTZ | When data was fetched |

**Unique:** `(category, subcategory, season)`
**Indexes:** `(category, season)`, GIN on `data`
**Migration:** `20260207160000_edge_iq_comprehensive.sql`
**Seed:** `scripts/seed-edge-comprehensive.mjs`
**Sync:** `scripts/sync/sync-aggregates.mjs`

---

### `player_career_data`

Player career stats, awards, recent form, and featured stats. Stores multiple JSONB columns for different career data facets per player.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-incrementing ID |
| `player_id` | INTEGER NOT NULL UNIQUE | NHL player ID |
| `season_totals` | JSONB | Array of season-by-season stats |
| `career_totals` | JSONB | Career aggregate stats |
| `awards` | JSONB | NHL awards history |
| `last_5_games` | JSONB | Recent form (last 5 games) |
| `featured_stats` | JSONB | Current season featured stats |
| `fetched_at` | TIMESTAMPTZ | When data was fetched |

**Unique:** `(player_id)`
**Indexes:** `(player_id)`
**Migration:** `20260207160001_game_and_player_extras.sql`
**Seed:** `scripts/seed-player-career.mjs`
**Sync:** `scripts/sync/sync-player-trends.mjs`
**Note:** Only ~22% seeded as of 2026-02-07; `fetchPlayerStats` in `services/playerPrediction.ts` is disabled until full population.

---

### `game_details`

Game right-rail data including officials, coaches, scratches, shots by period, season series, and team game stats. One row per game with JSONB columns for each data facet.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-incrementing ID |
| `game_id` | INTEGER NOT NULL UNIQUE | NHL game ID |
| `officials` | JSONB | Referees and linesmen |
| `coaches` | JSONB | Home and away coaches |
| `scratches` | JSONB | Healthy scratches |
| `shots_by_period` | JSONB | Shots breakdown by period |
| `season_series` | JSONB | Head-to-head series data |
| `team_game_stats` | JSONB | Team-level game stats comparison |
| `game_reports` | JSONB | Links to official NHL reports |
| `fetched_at` | TIMESTAMPTZ | When data was fetched |

**Unique:** `(game_id)`
**Indexes:** `(game_id)`
**Migration:** `20260207160001_game_and_player_extras.sql`
**Seed:** `scripts/seed-game-details.mjs`
**Sync:** `scripts/sync/sync-game-extras.mjs`

---

### `game_play_by_play`

Full play-by-play event logs for each game. One row per event with coordinates, zone, and event-specific details in JSONB.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-incrementing ID |
| `game_id` | INTEGER NOT NULL | NHL game ID |
| `event_id` | INTEGER | Unique event ID within the game |
| `period` | INTEGER | Period number |
| `period_type` | TEXT | REG, OT, SO |
| `time_in_period` | TEXT | Time elapsed in period |
| `time_remaining` | TEXT | Time remaining in period |
| `situation_code` | TEXT | Strength situation code |
| `event_type` | TEXT NOT NULL | 'goal', 'shot-on-goal', 'missed-shot', 'blocked-shot', 'hit', 'faceoff', 'giveaway', 'takeaway', 'penalty', 'stoppage' |
| `type_desc` | TEXT | Event type description |
| `x_coord` | REAL | X coordinate on ice |
| `y_coord` | REAL | Y coordinate on ice |
| `zone_code` | TEXT | 'O' (offensive), 'N' (neutral), 'D' (defensive) |
| `player_id` | INTEGER | Primary player involved |
| `player_name` | TEXT | Player display name |
| `team_abbrev` | TEXT | Team abbreviation |
| `detail` | JSONB | Full event details (assists, shot type, penalty info, etc.) |

**Unique:** `(game_id, event_id)`
**Indexes:** `(game_id)`, `(event_type)`, `(player_id)`, `(x_coord, y_coord)` WHERE x_coord IS NOT NULL
**Migration:** `20260207160001_game_and_player_extras.sql`
**Seed:** `scripts/seed-play-by-play.mjs`
**Sync:** `scripts/sync/sync-game-extras.mjs`

---

### `skater_game_categories`

Per-game advanced skater stats from the NHL Stats REST API (isGame=true). Stores metrics not available from boxscores: Corsi, Fenwick, puck possession, scoring rates per 60, PDO, etc.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-incrementing ID |
| `player_id` | INTEGER NOT NULL | NHL player ID |
| `player_name` | TEXT | Player display name |
| `team_abbrev` | TEXT | Team abbreviation |
| `game_id` | INTEGER | NHL game ID |
| `game_date` | DATE | Game date |
| `opponent_abbrev` | TEXT | Opponent team abbreviation |
| `home_road` | TEXT | 'H' (home) or 'R' (road) |
| `season` | INTEGER | Season (default 20252026) |
| `stat_category` | TEXT NOT NULL | 'puckPossessions', 'percentages', 'scoringRates', 'timeonice' |
| `data` | JSONB NOT NULL | Full Stats REST API row |
| `fetched_at` | TIMESTAMPTZ | When data was fetched |

**Unique:** `(player_id, game_id, stat_category)`
**Indexes:** `(player_id, season)`, `(game_id)`, `(stat_category, season)`, `(team_abbrev, season)`, `(game_date)`, GIN on `data`
**Migration:** `20260207170001_player_game_categories.sql`
**Seed:** `scripts/seed-player-game-stats.mjs`
**Sync:** `scripts/sync/sync-player-trends.mjs`

---

### `goalie_game_categories`

Per-game advanced goalie stats from the NHL Stats REST API (isGame=true). Stores metrics like saves by strength and advanced goalie analytics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-incrementing ID |
| `player_id` | INTEGER NOT NULL | NHL player ID |
| `player_name` | TEXT | Player display name |
| `team_abbrev` | TEXT | Team abbreviation |
| `game_id` | INTEGER | NHL game ID |
| `game_date` | DATE | Game date |
| `opponent_abbrev` | TEXT | Opponent team abbreviation |
| `home_road` | TEXT | 'H' (home) or 'R' (road) |
| `season` | INTEGER | Season (default 20252026) |
| `stat_category` | TEXT NOT NULL | 'advanced', 'savesByStrength' |
| `data` | JSONB NOT NULL | Full Stats REST API row |
| `fetched_at` | TIMESTAMPTZ | When data was fetched |

**Unique:** `(player_id, game_id, stat_category)`
**Indexes:** `(player_id, season)`, `(game_id)`, `(stat_category, season)`, `(team_abbrev, season)`, `(game_date)`, GIN on `data`
**Migration:** `20260207170001_player_game_categories.sql`
**Seed:** `scripts/seed-player-game-stats.mjs`
**Sync:** `scripts/sync/sync-player-trends.mjs`

---

## Dropped Tables

The following tables were created in earlier migrations but dropped in `20260208020000_drop_redundant_tables.sql`:

| Table | Reason Dropped |
|-------|---------------|
| `game_results` | Fully redundant with `games` table (same data, different column names) |
| `supplemental_data` | 0 rows, no app usage, catch-all JSONB bucket |
| `player_game_logs` | 0 rows, derivable from `game_skater_stats` + `game_goalie_stats` |

---

## Data Flow

```
NHL API  -->  Sync Scripts  -->  Supabase  -->  React Native App
                  |                  |
                  |                  +-- RLS: public read
                  |
           GitHub Actions (2x daily)
           + Manual: npm run sync
```

### Sync Schedule
- **Midnight ET (05:00 UTC):** Catches all completed games from the day
- **Noon ET (17:00 UTC):** Updates standings, catches late West Coast games
- **Manual:** `npm run sync` (incremental) or `npm run seed:all` (full)

### Sync Modules
| Module | Tables Written | Time |
|--------|---------------|------|
| `sync-games.mjs` | games | ~60s (full), ~5s (incremental) |
| `sync-standings.mjs` | standings | ~2s |
| `sync-teams.mjs` | players | ~30s |
| `sync-players.mjs` | skater_season_stats, goalie_season_stats | ~30s |
| `sync-player-trends.mjs` | player_career_data, skater_game_categories, goalie_game_categories | ~120s |
| `sync-game-extras.mjs` | game_details, game_play_by_play | ~90s |
| `sync-aggregates.mjs` | edge_detailed_stats, edge_leaderboards | ~60s |

## Feature Mapping

| Feature | Tables Used |
|---------|------------|
| H2H Season Series | games |
| Momentum Index | games (last 5-10 games) |
| Clutch Rating | games (one-goal games) |
| Rest Advantage | games (back-to-back via game_date) |
| Standings Widgets | standings |
| Team Comparison | standings, skater_season_stats |
| Player Spotlight | skater_season_stats, players |
| Prediction Models | games, standings, skater_season_stats, goalie_season_stats |
| Edge Analytics | edge_skater_stats, edge_goalie_stats, edge_team_stats, edge_detailed_stats, edge_leaderboards |
| Game Deep Dive | games, game_goals, game_skater_stats, game_goalie_stats, game_details, game_play_by_play |
| Player Career | player_career_data, players |
| Advanced Per-Game Stats | skater_game_categories, goalie_game_categories |

## Setup Instructions

### GitHub Actions (automated sync)
Add these secrets to your GitHub repository (Settings > Secrets > Actions):
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (Supabase > Settings > API)
- `SUPABASE_ANON_KEY` — Anonymous key

### Local Development
Create a `.env` file in the project root:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Running Migrations
```bash
# Via Supabase CLI
supabase db push

# Or paste SQL from supabase/migrations/20260207140000_comprehensive_nhl_schema.sql
# into the Supabase SQL Editor
```

### Initial Data Load
```bash
npm run seed:all     # Full season sync (all tables)
npm run sync:check   # Verify all tables are populated
```

### npm Scripts
```bash
npm run seed:all          # Full season sync (all tables)
npm run seed:games        # Full game sync only
npm run sync              # Incremental sync (daily)
npm run sync:games        # Incremental games only
npm run sync:standings    # Standings refresh
npm run sync:teams        # Teams + players refresh
npm run sync:players      # Player stats refresh
npm run sync:check        # Health check
npm run sync:check --json # Machine-readable health check
```
