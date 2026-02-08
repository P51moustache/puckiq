# PuckIQ Data Gaps

Comprehensive list of missing, stale, or incomplete Supabase data that affects the Upcoming tab and its supporting services. This document is the single source of truth for what data needs to be added, synced, or fixed.

Last updated: 2026-02-07

---

## Status Legend

| Priority | Meaning |
|----------|---------|
| P0 | Blocks core functionality - user sees broken/empty UI |
| P1 | Degrades experience - feature works but data is stale or incomplete |
| P2 | Nice-to-have - data exists elsewhere or feature is non-critical |

---

## P0: Critical Gaps (Blocks Core UI)

_No P0 gaps remaining. All critical sync scripts have been created._

---

## P1: Experience Degradation

### 3. No game clock / live play data in Supabase

**Table:** `games` (missing columns: `clock_time_remaining`, `clock_in_intermission`, `clock_running`)
**Service:** `hooks/useTonightData.ts` (game state display)
**Component:** `AllGamesCard.tsx` (`formatGameTime()` -- shows "LIVE P2 12:34")
**User Impact:** When a game is LIVE, the clock data (`game.clock?.timeRemaining`) comes from the initial `games` table row which was written when the game was in FUT state. The sync pipeline would need to update live games more frequently (every few minutes during game hours) to show accurate clock data. Currently, a LIVE game would show `LIVE P0 ` with no clock.
**Current State:** The `games` table has `game_state`, `period`, and `period_type` columns but no `clock` column. Live clock data was previously fetched in real-time from the NHL score API.
**Fix Required:** Either: (a) add a `clock_json` JSONB column to `games` and create a more frequent sync for in-progress games (e.g., every 2 minutes during game hours), or (b) accept that live clock data is not available and show "LIVE" without a clock, or (c) allow a single NHL API call for live game clock data only.

---

## P2: Low Priority / Deprecated Tab Data

All services below are marked `@deprecated` and only affect deprecated tabs. They still contain NHL API calls which violate the Supabase-only directive but have zero impact on the active Upcoming tab.

### 4. `services/teamComparison.ts` still calls NHL API

**Service:** `services/teamComparison.ts` (lines 100-102)
**Component:** Team comparison features (Explore tab -- DEPRECATED)
**User Impact:** None for Upcoming tab. Only affects deprecated Explore tab.
**Fix Required:** No action needed unless Explore tab is revived. Can be cleaned up in a future deprecation sweep.

### 5. `services/backtesting.ts` calls NHL standings API

**Service:** `services/backtesting.ts` (line 277)
**Component:** Model backtesting (Models tab -- DEPRECATED)
**User Impact:** None for Upcoming tab.
**Fix Required:** No action needed.

### 6. `utils/recentForm.ts` calls NHL API

**Service:** `utils/recentForm.ts` (line 53)
**Component:** Legacy form calculation (superseded by `services/teamForm.ts` which is Supabase-only)
**User Impact:** None -- the Upcoming tab uses `services/teamForm.ts`.
**Fix Required:** Can be deleted in a deprecation sweep. `services/teamForm.ts` is the canonical replacement.

### 7. `utils/teamStatsForPrediction.ts` calls NHL stats API

**Service:** `utils/teamStatsForPrediction.ts` (line 66)
**Component:** Team stats for prediction calculations
**User Impact:** Not directly used by the Upcoming tab's main data flow.
**Fix Required:** Verify whether this util is called during prediction calculation. If so, migrate to Supabase query against `team_stat_categories` or `standings`.

---

## Documentation Gaps

_No documentation gaps remaining. DATABASE_REFERENCE.md has been updated with all tables._

---

## Resolved Gaps (Previously Tracked)

These gaps have been fixed and are documented here for reference only.

| # | Gap | Resolution |
|---|-----|------------|
| ~~1~~ | `player_career_data` has no sync script | **Fixed.** `scripts/sync/sync-player-career.mjs` created and added to `sync-all.mjs` (weekly schedule). |
| ~~2~~ | `edge_detailed_stats` has no sync script | **Fixed.** `scripts/sync/sync-edge-details.mjs` created and added to `sync-all.mjs` (weekly schedule). |
| ~~3~~ | `game_results` seeding uses NHL API from app code | **Fixed.** `seedCurrentSeason()` and `syncRecentResults()` have been removed from `services/gameResults.ts`. The service is now fully Supabase-only with no NHL API calls. |
| ~~5~~ | `edge_leaderboards` sync only covers landing pages | **Fixed.** `sync-aggregates.mjs` syncs all 17 categories including `by-the-numbers`, `skater-landing`, `goalie-landing`, and `team-landing`. |
| ~~8~~ | DATABASE_REFERENCE.md is incomplete | **Fixed.** All 24 tables now documented in `docs/DATABASE_REFERENCE.md` including dropped tables section. |
| ~~10~~ | `services/pickTracking.ts` calls NHL score API | **Fixed.** `checkAndUpdateYesterdaysGames()` now queries Supabase `games` table directly with `game_state IN ('FINAL', 'OFF')`. No NHL API calls remain. |

---

## Summary

| Priority | Count | Action |
|----------|-------|--------|
| P0 | 0 | All resolved |
| P1 | 1 | Decide on live clock strategy |
| P2 | 4 | Clean up deprecated utils with NHL API calls (`recentForm.ts`, `teamStatsForPrediction.ts`) + deprecated services |
| Docs | 0 | All resolved |
| **Total** | **5** | (down from 11 -- 6 resolved) |

## Sync Pipeline Coverage

Current `scripts/sync/sync-all.mjs` runs 9 modules:

| Module | Tables Synced | Schedule |
|--------|--------------|----------|
| `sync-games.mjs` | `games` | Daily (midnight + noon ET) |
| `sync-standings.mjs` | `standings` | Daily |
| `sync-teams.mjs` | `teams`, player roster data | Daily |
| `sync-players.mjs` | `skater_season_stats`, `goalie_season_stats` | Daily |
| `sync-game-extras.mjs` | `game_details`, `game_play_by_play` | Daily |
| `sync-aggregates.mjs` | `edge_leaderboards`, `edge_detailed_stats` | Daily |
| `sync-player-trends.mjs` | `skater_game_categories`, `goalie_game_categories` | Daily |
| `sync-player-career.mjs` | `player_career_data` | Weekly |
| `sync-edge-details.mjs` | `edge_detailed_stats` | Weekly |

**All tables now have sync coverage.** No remaining sync gaps.

## Upcoming Tab Service Audit (Supabase-only Verification)

All services used by the Upcoming tab (`hooks/useTonightData.ts`) are confirmed Supabase-only:

| Service | Data Source | Confirmed |
|---------|------------|-----------|
| Direct Supabase queries (games, standings) | `supabase.from('games')`, `supabase.from('standings')` | Yes |
| `services/edgeStats.ts` | `supabase.from('edge_leaderboards')`, `supabase.from('edge_detailed_stats')` | Yes |
| `services/gameResults.ts` | `supabase.from('game_results')`, `supabase.from('games')` | Yes |
| `services/derivedStats.ts` | Pure computation (no API calls) | Yes |
| `services/playerPrediction.ts` | `supabase.from('players')`, `supabase.from('player_career_data')` | Yes |
| `services/playerStats.ts` | `supabase.from('skater_season_stats')`, `supabase.from('goalie_season_stats')` | Yes |
| `services/teamForm.ts` | `supabase.from('games')` | Yes |
| `services/insightGenerator.ts` | Pure computation | Yes |
| `services/modelStorage.ts` | AsyncStorage (local) | Yes |

**Conclusion:** The Upcoming tab makes ZERO NHL API calls at runtime. All data comes from Supabase or local computation.
