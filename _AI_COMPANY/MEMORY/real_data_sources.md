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
