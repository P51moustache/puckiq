# Real Data Sources

The Archivist (Blueprint Squad) maintains this file. The Fixture Manager (Execution Squad) reads it to create realistic test data and mocks.

---

## NHL API Endpoints

The NHL API is unofficial — no guaranteed uptime, no SLA, no API key required. All endpoints return JSON.

### Scores / Today's Games
- **URL:** `https://api-web.nhle.com/v1/score/{YYYY-MM-DD}`
- **Method:** GET
- **Use:** Get all games for a specific date with scores, game state, period info
- **Response shape:**
```json
{
  "games": [
    {
      "id": 2024020001,
      "season": 20242025,
      "gameType": 2,
      "gameDate": "2025-01-15",
      "startTimeUTC": "2025-01-16T00:00:00Z",
      "gameState": "LIVE|FUT|FINAL|OFF",
      "awayTeam": {
        "id": 10, "abbrev": "TOR", "score": 2,
        "record": "25-15-3"
      },
      "homeTeam": {
        "id": 6, "abbrev": "BOS", "score": 3,
        "record": "28-12-4"
      },
      "period": 3,
      "clock": { "timeRemaining": "05:32", "running": true }
    }
  ]
}
```
- **Rate limits:** Unknown (unofficial API). Use reasonable polling (60s minimum).
- **Notes:** `gameState` values: `FUT` (future/scheduled), `LIVE` (in progress), `FINAL` (complete), `OFF` (official/final).

### Standings
- **URL:** `https://api-web.nhle.com/v1/standings/now`
- **Method:** GET
- **Use:** Current league standings, points, records, streaks, goal differential
- **Response shape:**
```json
{
  "standings": [
    {
      "teamAbbrev": { "default": "WPG" },
      "teamName": { "default": "Jets" },
      "conferenceName": "Western",
      "divisionName": "Central",
      "gamesPlayed": 44,
      "wins": 30, "losses": 10, "otLosses": 4,
      "points": 64,
      "pointPctg": 0.727,
      "goalFor": 155, "goalAgainst": 110, "goalDifferential": 45,
      "streakCode": "W3",
      "homeWins": 16, "homelosses": 4, "homeOtLosses": 2,
      "roadWins": 14, "roadLosses": 6, "roadOtLosses": 2,
      "l10Wins": 7, "l10Losses": 2, "l10OtLosses": 1
    }
  ]
}
```
- **Notes:** Returns ALL teams in a flat array. Sort/filter by conference/division client-side.

### Stat Leaders
- **URL:** `https://api-web.nhle.com/v1/skater-stats-leaders/current`
- **Method:** GET
- **Use:** League-wide skater stat leaders (goals, assists, points, etc.)
- **Response shape:**
```json
{
  "goals": [
    { "id": 8478402, "firstName": { "default": "Connor" }, "lastName": { "default": "McDavid" }, "teamAbbrev": "EDM", "value": 28 }
  ],
  "assists": [ ... ],
  "points": [ ... ]
}
```

### Team Schedule
- **URL:** `https://api-web.nhle.com/v1/club-schedule/{TEAM_CODE}/month/{YYYY-MM}`
- **Method:** GET
- **Use:** Monthly schedule for a specific team
- **Example:** `https://api-web.nhle.com/v1/club-schedule/TOR/month/2025-01`
- **Notes:** `TEAM_CODE` is 3-letter abbreviation (TOR, BOS, NYR, etc.)

### Team Stats (REST)
- **URL:** `https://api.nhle.com/stats/rest/en/team`
- **Method:** GET
- **Use:** Team-level statistics (all teams)
- **Notes:** Different base URL (`api.nhle.com` vs `api-web.nhle.com`)

---

### Club Stats (Player Season Totals) — NEW for Cycle 2
- **URL:** `https://api-web.nhle.com/v1/club-stats/{TEAM}/now`
- **Method:** GET
- **Use:** Get current-season player stats for an entire team (skaters + goalies)
- **Response shape:**
```json
{
  "skaters": [
    {
      "playerId": 8479318,
      "firstName": { "default": "Auston" },
      "lastName": { "default": "Matthews" },
      "positionCode": "C",
      "gamesPlayed": 51,
      "goals": 26,
      "assists": 22,
      "points": 48,
      "plusMinus": 4,
      "penaltyMinutes": 18,
      "powerPlayGoals": 8,
      "shorthandedGoals": 0,
      "gameWinningGoals": 5,
      "shots": 193,
      "shootingPctg": 0.134715,
      "avgToi": "20:15",
      "faceoffWinPctg": 0.524
    }
  ],
  "goalies": [
    {
      "playerId": 8480191,
      "firstName": { "default": "Anthony" },
      "lastName": { "default": "Stolarz" },
      "gamesPlayed": 38,
      "gamesStarted": 36,
      "wins": 22,
      "losses": 10,
      "otLosses": 4,
      "goalsAgainstAvg": 2.45,
      "savePctg": 0.918,
      "shotsAgainst": 1042,
      "saves": 957,
      "goalsAgainst": 85,
      "shutouts": 3,
      "timeOnIce": "2198:30"
    }
  ]
}
```
- **Rate limits:** Unknown (unofficial). One request per team per session is sufficient.
- **Notes:** `firstName` and `lastName` are objects with a `default` key. Sort skaters by `points` descending for "top players" display.

### Club Schedule Season (Full Season) — Used for seeding
- **URL:** `https://api-web.nhle.com/v1/club-schedule-season/{TEAM}/{SEASON}`
- **Method:** GET
- **Use:** Get all games (past + future) for a team in a season. Used to seed Supabase `game_results` table.
- **Example:** `https://api-web.nhle.com/v1/club-schedule-season/TOR/20252026`
- **Response shape:**
```json
{
  "games": [
    {
      "id": 2025020001,
      "gameDate": "2025-10-08",
      "startTimeUTC": "2025-10-09T00:00:00Z",
      "gameState": "FINAL",
      "homeTeam": {
        "id": 10,
        "abbrev": "TOR",
        "score": 4
      },
      "awayTeam": {
        "id": 6,
        "abbrev": "MTL",
        "score": 2
      }
    }
  ]
}
```
- **Notes:** Already used in GameDeepDiveModal for H2H. `score` field only present on completed games (`gameState` = `FINAL` or `OFF`). Each game appears in both teams' schedules — deduplicate by `id` (game_id).

---

## NHL Edge IQ API Endpoints (Verified 2026-02-04)

The Edge IQ API provides puck/player tracking data — shot speed, skating speed, distance, zone time, shot location, and goalie save percentages. All endpoints return JSON and require no authentication.

### Skater Landing (Season Leaders)
- **URL:** `https://api-web.nhle.com/v1/edge/skater-landing/now`
- **Method:** GET
- **Use:** Season leaders for hardest shot, fastest skater, most distance, highest danger SOG
- **Response shape:**
```json
{
  "hardestShot": {
    "player": { "id": 8482671, "firstName": { "default": "Jake" }, "lastName": { "default": "Kleven" }, "team": { "abbrev": "EDM" } },
    "overlay": { "date": "2026-01-04", "awayTeam": { "abbrev": "EDM" }, "homeTeam": { "abbrev": "VAN" } },
    "shotSpeed": { "imperial": { "speed": 103.0 }, "metric": { "speed": 165.8 } }
  },
  "maxSkatingSpeed": {
    "player": { "id": 8478402, ... },
    "skatingSpeed": { "imperial": { "speed": 24.57 } }
  },
  "totalDistanceSkated": {
    "player": { ... },
    "distanceSkated": { "imperial": { "distance": 230.39 } }
  },
  "highDangerSOG": { ... }
}
```
- **Cache:** 5 minutes in-memory
- **Fallback:** Hide Edge Intel leaders section

### Goalie Landing (Season Leaders)
- **URL:** `https://api-web.nhle.com/v1/edge/goalie-landing/now`
- **Method:** GET
- **Use:** Season leaders for high-danger save percentage + shot location breakdown (17 zones)
- **Response shape:**
```json
{
  "highDangerSavePctg": {
    "player": { "id": 8478048, ... },
    "savePctg": { "value": 0.895 },
    "shotLocationDetails": [
      { "zone": "highLeft", "savePctg": 0.923, "percentile": 85 }
    ]
  }
}
```

### Team Landing (Season Leaders)
- **URL:** `https://api-web.nhle.com/v1/edge/team-landing/now`
- **Method:** GET
- **Use:** Team leaders for shot attempts over 90mph, speed bursts over 22mph, distance per 60min
- **Response shape:**
```json
{
  "shotAttemptsOver90": {
    "team": { "id": 1, "abbrev": "NJD" },
    "value": 215, "rank": 1
  },
  "burstsOver22": { "team": { ... }, "value": 174, "rank": 1 },
  "distancePer60": { "team": { ... }, "value": 45.2, "rank": 1 }
}
```

### By-The-Numbers (Last Game Night)
- **URL:** `https://api-web.nhle.com/v1/edge/by-the-numbers/now`
- **Method:** GET
- **Use:** Highlights from the most recent game night — hardest shot, fastest skater, most distance
- **Response shape:**
```json
{
  "games": 6,
  "gameDate": "2026-02-03",
  "hardestShotSkater": {
    "player": { "id": 8481564, "firstName": { "default": "Mikhail" }, "lastName": { "default": "Sergachev" } },
    "shotSpeed": { "imperial": { "speed": 95.46 } }
  },
  "maxSkatingSpeedSkater": { "player": { ... }, "skatingSpeed": { "imperial": { "speed": 23.58 } } },
  "totalDistanceSkatedSkater": { "player": { ... }, "distanceSkated": { "imperial": { "distance": 4.64 } } }
}
```

### Skater Detail (Per-Player Edge Stats)
- **URL:** `https://api-web.nhle.com/v1/edge/skater-detail/{playerId}/now`
- **Method:** GET
- **Use:** Deep Edge analytics for a specific player — shot speed, skating speed, distance, shot locations (17 zones), zone time
- **Key fields:**
  - `topShotSpeed` — { imperial (mph), percentile, leagueAvg }
  - `skatingSpeed.speedMax` — { imperial, percentile, leagueAvg }
  - `skatingSpeed.burstsOver20` — { value, percentile }
  - `totalDistanceSkated` — { imperial (miles), percentile }
  - `sogSummary` — by location (high/mid/long/all): shots, goals, shootingPctg, percentile
  - `sogDetails` — 17 rink zones: area, shots, shotsPercentile
  - `zoneTimeDetails` — offensiveZonePctg, defensiveZonePctg, neutralZonePctg, percentiles

### Team Detail (Per-Team Edge Stats)
- **URL:** `https://api-web.nhle.com/v1/edge/team-detail/{teamId}/now`
- **Method:** GET
- **Use:** Team-level Edge analytics — shot speed, skating speed, distance, shot zones, zone time (all with league rank)
- **Key fields:**
  - `shotSpeed` — topShotSpeed (mph + rank), shotAttemptsOver90 (count + rank)
  - `skatingSpeed` — speedMax (mph + rank), burstsOver22 (count + rank)
  - `distanceSkated` — total (miles + rank)
  - `sogSummary` — by location: shots/goals + rank
  - `sogDetails` — 17 zones: shots + rank
  - `zoneTimeDetails` — off/neutral/def pctg + rank + leagueAvg

### Team Zone Time Details
- **URL:** `https://api-web.nhle.com/v1/edge/team-zone-time-details/{teamId}/now`
- **Method:** GET
- **Use:** Zone time by strength (all, even strength, power play, penalty kill) + shot differential
- **Key fields:**
  - `zoneTimeDetails` — by strength: offPctg, neutPctg, defPctg + rank + leagueAvg
  - `shotDifferential` — attemptDiff, sogDiff + ranks

### Goalie Detail (Per-Goalie Edge Stats)
- **URL:** `https://api-web.nhle.com/v1/edge/goalie-detail/{playerId}/now`
- **Method:** GET
- **Use:** Goalie Edge analytics — GAA, goals above average per 60, save % by 17 zones
- **Key fields:**
  - `stats` — GAA, gamesAbove900, goalDiffPer60 (each with percentile + leagueAvg)
  - `shotLocationSummary` — high/mid/long/all: goalsAgainst, saves, savePctg, percentile
  - `shotLocationDetails` — 17 zones: saves, savePctg, percentile

### Edge API Notes
- **Top-10 endpoints are broken** for 20252026 season (return 307→404/500). Use landing endpoints instead for leader data.
- **IDs**: Skater/goalie endpoints use player ID (e.g., 8478402 for McDavid). Team endpoints use numeric team ID (not abbreviation).
- **No authentication** required. Standard rate limiting applies (unofficial API).

---

## Supplementary Data Sources

### Team Abbreviations (Hardcoded)
All 32 NHL teams are referenced by 3-letter codes throughout the app. These are consistent with the NHL API's `teamAbbrev` field.

### Advanced Stats
Advanced metrics (Corsi, Fenwick, xG) are **calculated client-side** from play-by-play data or approximated from the standings/score endpoints. There is no dedicated advanced stats endpoint in the public NHL API.

---

## Data Refresh Strategy

| Data Type | Refresh Rate | Method |
|-----------|-------------|--------|
| Today's games/scores | Every app open + pull-to-refresh | Fetch on mount |
| Standings | Every app open | Fetch on mount |
| Stat leaders | Every app open | Fetch on mount |
| Team schedule | On demand (when user views team) | Fetch on navigate |
| Historical games (backtest) | Once per season (seeded) | Stored in AsyncStorage |
| Game results (Supabase) | Once (seed) + daily sync | `seedCurrentSeason()` + `syncRecentResults()` on mount |
| Player stats (club-stats) | On demand (per team, cached in memory) | Fetch when game deep-dive opened, cache for session |
| Edge landing (skater/goalie/team) | On mount | 5-min in-memory cache |
| Edge by-the-numbers | On mount | 5-min in-memory cache |
| Edge skater/team/goalie detail | On demand (deep dive, Edge Intel tap) | 5-min in-memory cache |
| Derived stats (momentum/clutch) | After `syncRecentResults()` on mount | Computed from game_results, stored in Supabase `team_rolling_stats` |

**Important:** Use `Promise.allSettled()` for parallel requests. Individual endpoint failures should not break the entire screen — provide fallback/empty states.

---

## Sample Responses

### Empty Game Day (No Games Scheduled)
```json
{
  "games": []
}
```

### Game in Progress
```json
{
  "id": 2024020892,
  "gameState": "LIVE",
  "period": 2,
  "clock": { "timeRemaining": "12:45", "running": false },
  "awayTeam": { "abbrev": "NYR", "score": 1 },
  "homeTeam": { "abbrev": "BOS", "score": 2 }
}
```

### Final Game
```json
{
  "id": 2024020892,
  "gameState": "FINAL",
  "awayTeam": { "abbrev": "NYR", "score": 2 },
  "homeTeam": { "abbrev": "BOS", "score": 4 }
}
```
