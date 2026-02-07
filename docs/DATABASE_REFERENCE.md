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

The database has 15 tables organized into 4 groups:

### Reference Data
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `teams` | 32 NHL teams with IDs, names, conference, division, logos | 32 |
| `players` | All rostered players with bio, position, headshot | ~750 |

### Game Data
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `game_results` | Legacy completed games (TEXT season) — used by existing services | ~800/season |
| `games` | Comprehensive game data (all states: FUT/LIVE/FINAL) | ~1300/season |
| `game_goals` | Every goal scored (period, time, scorer, assists, strength) | ~5000/season |
| `game_skater_stats` | Per-game boxscore for skaters (goals, assists, TOI, hits) | ~25000/season |
| `game_goalie_stats` | Per-game boxscore for goalies (saves, GAA, decision) | ~2500/season |
| `game_penalties` | Every penalty (type, duration, player) | ~6000/season |
| `game_three_stars` | Three stars of each game | ~2400/season |

### Season Stats
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `standings` | Full standings with snapshot_date for historical tracking | 32/snapshot |
| `skater_season_stats` | Aggregated season stats per skater | ~700/season |
| `goalie_season_stats` | Aggregated season stats per goalie | ~70/season |

### Tracking Data
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `edge_skater_stats` | NHL Edge IQ: shot speed, skating speed, zone time | ~700 |
| `edge_goalie_stats` | NHL Edge IQ: goalie metrics | ~70 |
| `edge_team_stats` | NHL Edge IQ: team-level tracking | 32 |

### Raw Stats (JSONB bulk storage)
| Table | Purpose | Rows (approx) |
|-------|---------|----------------|
| `team_stat_categories` | Raw NHL stats API team data (24 categories) | ~768 |
| `skater_stat_categories` | Raw NHL stats API skater data (17 categories) | ~12000 |
| `goalie_stat_categories` | Raw NHL stats API goalie data (8 categories) | ~560 |
| `team_game_stats` | Per-game team stat breakdowns | ~25000 |

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

### `game_results` (legacy)

Completed game results. Used by existing `services/gameResults.ts`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-increment |
| `game_id` | BIGINT UNIQUE | NHL game ID |
| `season` | TEXT | Season string, e.g. '20252026' |
| `game_date` | DATE | Game date |
| `home_team` | TEXT | Home team abbreviation |
| `away_team` | TEXT | Away team abbreviation |
| `home_score` | INTEGER | Home final score |
| `away_score` | INTEGER | Away final score |
| `game_state` | TEXT | 'FINAL' or 'OFF' |

**Data Source:** NHL API — `club-schedule-season/{team}/{season}` (full) and `score/{date}` (incremental)
**Sync:** `sync-games.mjs`
**Used By:** `services/gameResults.ts`, `services/derivedStats.ts`, `hooks/useTonightData.ts`

---

### `games` (comprehensive)

All games including future, live, and completed. Replaces game_results for new features.

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

**Data Source:** NHL API — same as game_results
**Sync:** `sync-games.mjs` (writes to both tables)

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
| `sync-games.mjs` | game_results, games | ~60s (full), ~5s (incremental) |
| `sync-standings.mjs` | standings | ~2s |
| `sync-teams.mjs` | players | ~30s |
| `sync-players.mjs` | skater_season_stats, goalie_season_stats | ~30s |

## Feature Mapping

| Feature | Tables Used |
|---------|------------|
| H2H Season Series | game_results |
| Momentum Index | game_results (last 5-10 games) |
| Clutch Rating | game_results (one-goal games) |
| Rest Advantage | game_results (back-to-back via game_date) |
| Standings Widgets | standings |
| Team Comparison | standings, skater_season_stats |
| Player Spotlight | skater_season_stats, players |
| Prediction Models | game_results, standings, skater_season_stats, goalie_season_stats |
| Edge Analytics | edge_skater_stats, edge_goalie_stats, edge_team_stats |
| Game Deep Dive | games, game_goals, game_skater_stats, game_goalie_stats |

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
