# NHL API Reference -- PuckIQ

**Last Updated:** 2026-02-07
**Season Format:** `20252026` (8 digits, start year + end year)
**Game Types:** `1` = preseason, `2` = regular season, `3` = playoffs, `4` = all-star, `9` = international (4 Nations Face-Off)
**Game ID Format:** `SSSSGGNNNN` -- e.g., `2025020874` = 2025-26 season, regular season (02), game 874

## API Base URLs

| Base | URL | Auth | Notes |
|------|-----|------|-------|
| Web API | `https://api-web.nhle.com/v1/` | None | Modern API for games, players, standings, Edge IQ |
| Stats REST | `https://api.nhle.com/stats/rest/en/` | None | Aggregate stats with advanced metrics (Corsi, Fenwick) |

**Important:** Web API `/now` endpoints return 307 redirects. Use `-L` with curl or follow redirects in HTTP clients.

---

## Table of Contents

1. [Games and Schedule](#1-games-and-schedule)
   - 1.1 Score (Daily Scores)
   - 1.2 Schedule (Weekly)
   - 1.3 Schedule Calendar
   - 1.4 Scoreboard
   - 1.5 Gamecenter Landing
   - 1.6 Gamecenter Boxscore
   - 1.7 Gamecenter Play-by-Play
   - 1.8 Gamecenter Right Rail
   - 1.9 WSC Game Story
   - 1.10 Club Schedule Monthly
   - 1.11 Club Schedule Season
2. [Players](#2-players)
   - 2.1 Player Landing
   - 2.2 Player Game Log
   - 2.3 Roster
   - 2.4 Skater Stats Leaders
   - 2.5 Goalie Stats Leaders
   - 2.6 Player Spotlight
3. [Standings and Teams](#3-standings-and-teams)
   - 3.1 Standings
   - 3.2 Standings Seasons
   - 3.3 Season List
   - 3.4 Club Stats
   - 3.5 Club Stats Seasons
4. [Edge IQ (NHL Tracking)](#4-edge-iq)
   - 4.1 Skater Landing
   - 4.2 Skater Detail
   - 4.3 Goalie Landing
   - 4.4 Goalie Detail
   - 4.5 Team Landing
   - 4.6 Team Detail
   - 4.7 By The Numbers
   - 4.8 Zone Time Details
   - 4.9 Top 10 Leaderboards
5. [Draft and Playoffs](#5-draft-and-playoffs)
   - 5.1 Draft Rankings
   - 5.2 Draft Picks
   - 5.3 Playoff Bracket
6. [Media and Meta](#6-media-and-meta)
   - 6.1 Network TV Schedule
   - 6.2 Season Info
7. [Stats REST API -- Teams](#7-stats-rest-api-teams)
   - 7.1 Team List
   - 7.2 Team Summary
   - 7.3 Team Realtime
   - 7.4 Team Percentages (Corsi/Fenwick)
   - 7.5 Team Summary Shooting
   - 7.6 Team Power Play
   - 7.7 Team Power Play Time
   - 7.8 Team Penalty Kill
   - 7.9 Team Penalty Kill Time
   - 7.10 Team Penalties
   - 7.11 Team Faceoff Percentages
   - 7.12 Team Faceoff Wins
   - 7.13 Team Goals By Period
   - 7.14 Team Goals For By Strength
   - 7.15 Team Goals Against By Strength
   - 7.16 Team Goals For By Strength (Goalie Pull)
   - 7.17 Team Goals Against By Strength (Goalie Pull)
   - 7.18 Team Save Percentage
   - 7.19 Team Shot Type
   - 7.20 Team Shootout
   - 7.21 Team Outshoot/Outshot
   - 7.22 Team Score/Trail First
   - 7.23 Team Leading/Trailing
   - 7.24 Team Goal Games
   - 7.25 Team Days Between Games
8. [Stats REST API -- Skaters](#8-stats-rest-api-skaters)
   - 8.1 Skater Summary
   - 8.2 Skater Bios
   - 8.3 Skater Realtime
   - 8.4 Skater Percentages (Corsi/Fenwick)
   - 8.5 Skater Summary Shooting
   - 8.6 Skater Scoring Rates
   - 8.7 Skater Scoring Per Game
   - 8.8 Skater Time On Ice
   - 8.9 Skater Power Play
   - 8.10 Skater Penalty Kill
   - 8.11 Skater Penalties
   - 8.12 Skater Faceoff Percentages
   - 8.13 Skater Faceoff Wins
   - 8.14 Skater Goals For/Against
   - 8.15 Skater Puck Possessions
   - 8.16 Skater Shot Type
   - 8.17 Skater Shootout
9. [Stats REST API -- Goalies](#9-stats-rest-api-goalies)
   - 9.1 Goalie Summary
   - 9.2 Goalie Bios
   - 9.3 Goalie Advanced
   - 9.4 Goalie Days Rest
   - 9.5 Goalie Penalty Shots
   - 9.6 Goalie Saves By Strength
   - 9.7 Goalie Shootout
   - 9.8 Goalie Started vs Relieved
10. [Stats REST API -- Games](#10-stats-rest-api-games)
11. [Reference: Codes and Enums](#11-reference-codes-and-enums)
12. [Endpoints That Return 404/500](#12-endpoints-that-return-404-500)
13. [Endpoint Comparison Matrix](#13-endpoint-comparison-matrix)
14. [PuckIQ Usage Map](#14-puckiq-usage-map)

---

## 1. Games and Schedule

### 1.1 Score (Daily Scores)

**URL:** `GET https://api-web.nhle.com/v1/score/{YYYY-MM-DD}`
**Alt:** `GET https://api-web.nhle.com/v1/score/now` (307 redirect to today)
**Used by PuckIQ:** `useTonightData`, `picks.tsx`, `pickTracking.ts`, `gameResults.ts`, `historicalGames.ts`, `LivePreview.tsx`, `PickResultModal.tsx`

The richest single-date game endpoint. Contains scores, shots on goal, all goals with assists, clock state, betting partners, and video links.

**Response:**
```json
{
  "prevDate": "2026-02-06",
  "currentDate": "2026-02-07",
  "nextDate": "2026-02-08",
  "gameWeek": [
    {
      "date": "2026-02-04",
      "dayAbbrev": "WED",
      "numberOfGames": 6
    }
  ],
  "oddsPartners": [
    {
      "partnerId": 3,
      "country": "US",
      "name": "FanDuel",
      "imageUrl": "https://assets.nhle.com/betting_partner/fanduel.svg",
      "siteUrl": "https://...",
      "bgColor": "#1493FF",
      "textColor": "#FFFFFF",
      "accentColor": "#1493FF"
    }
  ],
  "games": []
}
```

**Game object fields:**

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| id | int | 2025020874 | Game ID (SSSSGGNNNN format) |
| season | int | 20252026 | Season ID |
| gameType | int | 2 | 1=pre, 2=regular, 3=playoff, 4=allstar, 9=intl |
| gameDate | string | "2026-02-01" | Game date |
| venue.default | string | "PNC Arena" | Venue name |
| startTimeUTC | string | "2026-02-02T00:00:00Z" | ISO 8601 start time |
| easternUTCOffset | string | "-05:00" | Eastern timezone offset |
| venueUTCOffset | string | "-05:00" | Venue timezone offset |
| venueTimezone | string | "US/Eastern" | Venue timezone name |
| tvBroadcasts | array | see below | TV broadcast info |
| gameState | string | "OFF" | FUT/PRE/LIVE/CRIT/OFF |
| gameScheduleState | string | "OK" | OK/PPD/SUSP/CNCL |
| neutralSite | boolean | false | Neutral site game |
| period | int | 3 | Current or final period |
| periodDescriptor.number | int | 3 | Period number |
| periodDescriptor.periodType | string | "REG" | REG/OT/SO |
| periodDescriptor.maxRegulationPeriods | int | 3 | Always 3 |
| clock.timeRemaining | string | "00:00" | Time remaining |
| clock.secondsRemaining | int | 0 | Seconds remaining |
| clock.running | boolean | false | Is clock running |
| clock.inIntermission | boolean | false | Is intermission |
| gameOutcome.lastPeriodType | string | "OT" | REG/OT/SO |
| gameOutcome.otPeriods | int | 1 | OT periods played |
| awayTeam | object | see below | Away team with score |
| homeTeam | object | see below | Home team with score |
| goals | array | see below | All goals scored |
| gameCenterLink | string | "/gamecenter/2025020874" | Relative link |
| threeMinRecap | string | "..." | 3-min recap video link |
| condensedGame | string | "..." | Condensed game link |

**ScoreTeam object:**

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| id | int | 12 | Team ID |
| name.default | string | "Hurricanes" | Common name |
| abbrev | string | "CAR" | 3-letter abbreviation |
| score | int | 3 | Goals scored |
| sog | int | 28 | Shots on goal |
| logo | string | "https://assets.nhle.com/logos/nhl/svg/CAR_light.svg" | Logo URL |

**GoalSummary object (in goals array):**

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| period | int | 1 | Period number |
| periodDescriptor | object | {number:1, periodType:"REG"} | Period details |
| timeInPeriod | string | "06:25" | Time of goal |
| playerId | int | 8473533 | Scorer player ID |
| name.default | string | "J. Staal" | Short name |
| firstName.default | string | "Jordan" | First name |
| lastName.default | string | "Staal" | Last name |
| goalModifier | string | "none" | "none" or "empty-net" |
| assists | array | [{playerId, name, assistsToDate}] | 0-2 assists |
| mugshot | string | URL | Headshot image URL |
| teamAbbrev | string | "CAR" | Scoring team |
| goalsToDate | int | 13 | Season goal total |
| awayScore | int | 0 | Away score after goal |
| homeScore | int | 1 | Home score after goal |
| strength | string | "pp" | "ev" / "pp" / "sh" |
| highlightClipSharingUrl | string | URL | Goal highlight video |

**TvBroadcast object:**

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| id | int | 385 | Broadcast ID |
| market | string | "N" | "N" national, "H" home, "A" away |
| countryCode | string | "US" | Country code |
| network | string | "ESPN" | Network name |
| sequenceNumber | int | 1 | Sort order |

---

### 1.2 Schedule (Weekly)

**URL:** `GET https://api-web.nhle.com/v1/schedule/{YYYY-MM-DD}`
**Alt:** `GET https://api-web.nhle.com/v1/schedule/now`
**Used by PuckIQ:** Not currently used

Returns a full week of games. Includes winning goalie and winning goal scorer for completed games. More team metadata but no goals array or clock.

**Response:**
```json
{
  "nextStartDate": "2026-02-14",
  "previousStartDate": "2026-01-31",
  "gameWeek": [
    {
      "date": "2026-02-07",
      "dayAbbrev": "SAT",
      "numberOfGames": 6,
      "games": []
    }
  ]
}
```

**ScheduleGame unique fields (vs /score):**

| Field | Type | Description |
|-------|------|-------------|
| awayTeam.commonName | LocalizedString | e.g., "Avalanche" |
| awayTeam.placeName | LocalizedString | e.g., "Colorado" |
| awayTeam.darkLogo | string | Dark variant logo URL |
| awayTeam.awaySplitSquad | boolean | Split squad flag |
| homeTeam.homeSplitSquad | boolean | Split squad flag |
| winningGoalie.playerId | int | Winning goalie ID |
| winningGoalie.firstInitial.default | string | e.g., "M." |
| winningGoalie.lastName.default | string | Last name |
| winningGoalScorer.playerId | int | GWG scorer ID |
| winningGoalScorer.firstInitial.default | string | First initial |
| winningGoalScorer.lastName.default | string | Last name |

**Not included:** goals array, clock state, sog, odds partners.

---

### 1.3 Schedule Calendar

**URL:** `GET https://api-web.nhle.com/v1/schedule-calendar/{YYYY-MM-DD}`
**Alt:** `GET https://api-web.nhle.com/v1/schedule-calendar/now`
**Used by PuckIQ:** Not currently used

Returns a date range window with all 32 NHL team metadata. No game details -- just team info and date windows. Useful for building team selectors.

**Response:**
```json
{
  "startDate": "2026-01-31",
  "endDate": "2026-02-28",
  "nextStartDate": "2026-02-28",
  "previousStartDate": "2026-01-03",
  "teams": [
    {
      "id": 1,
      "seasonId": 20252026,
      "commonName": {"default": "Devils"},
      "abbrev": "NJD",
      "name": {"default": "New Jersey Devils"},
      "placeName": {"default": "New Jersey"},
      "logo": "https://assets.nhle.com/logos/nhl/svg/NJD_light.svg",
      "darkLogo": "https://assets.nhle.com/logos/nhl/svg/NJD_dark.svg",
      "french": false
    }
  ]
}
```

---

### 1.4 Scoreboard

**URL:** `GET https://api-web.nhle.com/v1/scoreboard/now`
**Team-specific:** `GET https://api-web.nhle.com/v1/scoreboard/{TEAM_ABBREV}/now`
**Used by PuckIQ:** Not currently used

Multi-day scoreboard view (11-14 days). Team-specific variant adds club timezone info and filters to that team's games only.

**Response (league-wide):**
```json
{
  "focusedDate": "2026-02-07",
  "focusedDateCount": 14,
  "gamesByDate": [
    {
      "date": "2026-02-07",
      "games": []
    }
  ]
}
```

**Response (team-specific) adds:**
```json
{
  "clubTimeZone": "America/Toronto",
  "clubUTCOffset": "-05:00",
  "clubScheduleLink": "/mapleleafs/schedule"
}
```

**ScoreboardGame includes:** id, season, gameType, gameDate, venue, startTimeUTC, tvBroadcasts, gameState, awayTeam, homeTeam, ticketsLink, period, periodDescriptor, threeMinRecap.

---

### 1.5 Gamecenter Landing

**URL:** `GET https://api-web.nhle.com/v1/gamecenter/{gameId}/landing`
**Used by PuckIQ:** `PickResultModal.tsx`

Primary game detail page. Most detailed single-game endpoint with scoring (including shot type), three stars, and penalties.

**Response (top-level):**
```json
{
  "id": 2025020874,
  "season": 20252026,
  "gameType": 2,
  "limitedScoring": false,
  "gameDate": "2026-02-01",
  "venue": {"default": "PNC Arena"},
  "venueLocation": {"default": "Raleigh"},
  "startTimeUTC": "2026-02-02T00:00:00Z",
  "gameState": "OFF",
  "gameScheduleState": "OK",
  "shootoutInUse": true,
  "maxPeriods": 5,
  "regPeriods": 3,
  "otInUse": true,
  "tiesInUse": false,
  "awayTeam": {},
  "homeTeam": {},
  "clock": {
    "timeRemaining": "03:35",
    "secondsRemaining": 215,
    "running": false,
    "inIntermission": false
  },
  "summary": {
    "scoring": [],
    "threeStars": [],
    "penalties": []
  }
}
```

**LandingTeam:** id, commonName, abbrev, placeName, score, sog, logo, darkLogo.

**ScoringPeriod.goals[] fields:**

| Field | Type | Description |
|-------|------|-------------|
| situationCode | string | 4-digit strength code (e.g., "1451" = 4v5) |
| strength | string | "ev" / "pp" / "sh" |
| playerId | int | Scorer player ID |
| firstName/lastName/name | LocalizedString | Player names |
| teamAbbrev.default | string | Scoring team |
| headshot | string | Player headshot URL |
| goalsToDate | int | Season goals total |
| awayScore / homeScore | int | Score after goal |
| timeInPeriod | string | "06:25" |
| shotType | string | "tip-in", "wrist", "slap", "snap", "backhand", "deflected" |
| goalModifier | string | "none" or "empty-net" |
| assists | array | [{playerId, firstName, lastName, assistsToDate, sweaterNumber}] |
| highlightClip / discreteClip | int | Clip IDs |
| pptReplayUrl | string | Replay sprite URL |
| homeTeamDefendingSide | string | "left" or "right" |
| isHome | boolean | Whether scorer is home team |

**ThreeStar:** star (1-3), playerId, teamAbbrev, headshot, name, sweaterNo, position, goals, assists, points.

**PenaltyPeriod.penalties[] fields:** timeInPeriod, type (MIN/MAJ/MISC/MATCH/GM), duration, committedByPlayer (firstName, lastName, sweaterNumber), teamAbbrev, drawnBy, descKey ("boarding", "hooking", etc.), servedBy.

---

### 1.6 Gamecenter Boxscore

**URL:** `GET https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore`
**Used by PuckIQ:** Not currently used

Player-level game statistics. Per-player stats broken down by forwards, defense, and goalies.

**Response adds to game metadata:**
```json
{
  "playerByGameStats": {
    "awayTeam": {
      "forwards": [],
      "defense": [],
      "goalies": []
    },
    "homeTeam": {}
  },
  "gameOutcome": {
    "lastPeriodType": "OT",
    "otPeriods": 1
  }
}
```

**SkaterStats fields:**

| Field | Type | Description |
|-------|------|-------------|
| playerId | int | Player ID |
| sweaterNumber | int | Jersey number |
| name.default | string | Player name |
| position | string | C/L/R/D |
| goals | int | Goals |
| assists | int | Assists |
| points | int | Points |
| plusMinus | int | Plus/minus |
| pim | int | Penalty minutes |
| hits | int | Hits |
| powerPlayGoals | int | PP goals |
| sog | int | Shots on goal |
| faceoffWinningPctg | float | FO win % (0.0-1.0) |
| toi | string | Time on ice "MM:SS" |
| blockedShots | int | Blocked shots |
| shifts | int | Number of shifts |
| giveaways | int | Giveaways |
| takeaways | int | Takeaways |

**GoalieStats fields:**

| Field | Type | Description |
|-------|------|-------------|
| playerId | int | Player ID |
| name.default | string | Player name |
| evenStrengthShotsAgainst | string | "X/Y" saves/shots |
| powerPlayShotsAgainst | string | "X/Y" saves/shots |
| shorthandedShotsAgainst | string | "X/Y" saves/shots |
| saveShotsAgainst | string | "X/Y" total saves/shots |
| savePctg | float | Save percentage (0.0-1.0) |
| evenStrengthGoalsAgainst | int | ES goals against |
| powerPlayGoalsAgainst | int | PP goals against |
| shorthandedGoalsAgainst | int | SH goals against |
| goalsAgainst | int | Total goals against |
| toi | string | Time on ice |
| starter | boolean | Whether started |
| decision | string | "W"/"L"/"O" or absent |
| shotsAgainst | int | Total shots faced |
| saves | int | Total saves |

---

### 1.7 Gamecenter Play-by-Play

**URL:** `GET https://api-web.nhle.com/v1/gamecenter/{gameId}/play-by-play`
**Used by PuckIQ:** Not currently used

Every event in the game with coordinates, timestamps, and player IDs. The most granular data source.

**Response adds:**
```json
{
  "plays": [],
  "rosterSpots": []
}
```

**RosterSpot:** teamId, playerId, firstName, lastName, sweaterNumber, positionCode, headshot.

**Play base fields (all events):**

| Field | Type | Description |
|-------|------|-------------|
| eventId | int | Event ID (unique within game) |
| periodDescriptor | object | Period info |
| timeInPeriod | string | Time elapsed "MM:SS" |
| timeRemaining | string | Time remaining |
| situationCode | string | 4-digit strength code |
| homeTeamDefendingSide | string | "left" or "right" |
| typeCode | int | Numeric event type |
| typeDescKey | string | Human-readable type |
| sortOrder | int | Event sort order |
| details | object | Event-specific details |

**Event Types:**

| Code | Key | Detail Fields |
|------|-----|---------------|
| 502 | faceoff | eventOwnerTeamId, winningPlayerId, losingPlayerId, xCoord, yCoord, zoneCode |
| 503 | hit | hittingPlayerId, hitteePlayerId, xCoord, yCoord, zoneCode |
| 504 | giveaway | playerId, xCoord, yCoord, zoneCode |
| 505 | goal | scoringPlayerId, scoringPlayerTotal, assist1PlayerId, assist1PlayerTotal, assist2PlayerId, assist2PlayerTotal, goalieInNetId, shotType, xCoord, yCoord, zoneCode, awayScore, homeScore |
| 506 | shot-on-goal | shootingPlayerId, goalieInNetId, shotType, xCoord, yCoord, zoneCode, awaySOG, homeSOG |
| 507 | missed-shot | shootingPlayerId, goalieInNetId, shotType, reason, xCoord, yCoord, zoneCode |
| 508 | blocked-shot | shootingPlayerId, blockingPlayerId, reason, xCoord, yCoord, zoneCode |
| 509 | penalty | committedByPlayerId, drawnByPlayerId, servedByPlayerId, typeCode, descKey, duration, xCoord, yCoord, zoneCode |
| 516 | stoppage | reason, secondaryReason |
| 520 | period-start | (none) |
| 521 | period-end | (none) |
| 524 | game-end | (none) |
| 525 | takeaway | playerId, xCoord, yCoord, zoneCode |
| 535 | delayed-penalty | eventOwnerTeamId |

**Coordinate system:** xCoord -100 to 100 (center=0), yCoord -42 to 42 (center=0). zoneCode: "O" offensive, "D" defensive, "N" neutral.

**Shot types:** backhand, deflected, slap, snap, tip-in, wrist.

---

### 1.8 Gamecenter Right Rail

**URL:** `GET https://api-web.nhle.com/v1/gamecenter/{gameId}/right-rail`
**Used by PuckIQ:** Not currently used

Sidebar data. The ONLY endpoint with officials, coaches, and scratches.

**Response:**
```json
{
  "seasonSeries": [],
  "seasonSeriesWins": {"awayTeamWins": 0, "homeTeamWins": 2},
  "gameInfo": {
    "referees": [{"default": "Dan O'Rourke"}],
    "linesmen": [{"default": "Devin Berg"}],
    "awayTeam": {
      "headCoach": {"default": "Jim Hiller"},
      "scratches": [{"id": 8477998, "firstName": {"default": "Warren"}, "lastName": {"default": "Foegele"}}]
    },
    "homeTeam": {}
  },
  "linescore": {
    "byPeriod": [{"periodDescriptor": {}, "away": 0, "home": 1}],
    "totals": {"away": 2, "home": 3}
  },
  "shotsByPeriod": [{"periodDescriptor": {}, "away": 4, "home": 4}],
  "teamGameStats": [],
  "gameReports": {}
}
```

**TeamStatCategory values:** sog, faceoffWinningPctg, faceoffWins ("33/66"), powerPlay ("1/4"), powerPlayPctg, pim, hits, blockedShots, giveaways, takeaways.

**GameReports:** gameSummary, eventSummary, playByPlay, faceoffSummary, faceoffComparison, rosters, shotSummary, shiftChart, toiAway, toiHome -- all URLs to official HTML reports.

---

### 1.9 WSC Game Story

**URL:** `GET https://api-web.nhle.com/v1/wsc/game-story/{gameId}`
**Used by PuckIQ:** Not currently used

Alternative game story. Similar to Landing but includes teamGameStats in summary (like right-rail). No penalties section.

---

### 1.10 Club Schedule Monthly

**URL:** `GET https://api-web.nhle.com/v1/club-schedule/{TEAM}/month/{YYYY-MM}`
**Alt:** `GET https://api-web.nhle.com/v1/club-schedule/{TEAM}/month/now`
**Used by PuckIQ:** `teamForm.ts`

All games for a team in a given month. Includes timezone info.

**Response:**
```json
{
  "previousMonth": "2025-12",
  "currentMonth": "2026-01",
  "nextMonth": "2026-02",
  "calendarUrl": "https://nhl.ecal.com/maple-leafs",
  "clubTimezone": "America/Toronto",
  "clubUTCOffset": "-05:00",
  "games": []
}
```

Games use same structure as /schedule (includes winningGoalie, winningGoalScorer, gameCenterLink).

---

### 1.11 Club Schedule Season

**URL:** `GET https://api-web.nhle.com/v1/club-schedule-season/{TEAM}/{SEASON}`
**Alt:** `GET https://api-web.nhle.com/v1/club-schedule-season/{TEAM}/now`
**Used by PuckIQ:** `gameResults.ts` (seed), `recentForm.ts`

Complete season schedule for a team. Returns ALL games (82+ for regular season).

**Response:**
```json
{
  "previousSeason": 20242025,
  "currentSeason": 20252026,
  "clubTimezone": "America/Toronto",
  "clubUTCOffset": "-05:00",
  "games": []
}
```

---

## 2. Players

### 2.1 Player Landing

**URL:** `GET https://api-web.nhle.com/v1/player/{playerId}/landing`
**Used by PuckIQ:** `playerPrediction.ts`, `more.tsx`

Comprehensive player profile with bio, career stats, last 5 games, season totals across all leagues, awards, and current team roster.

**Response top-level fields:**

| Field | Type | Description |
|-------|------|-------------|
| playerId | int | Player ID |
| isActive | boolean | Currently active |
| currentTeamId | int | Current team ID |
| currentTeamAbbrev | string | Current team abbreviation |
| fullTeamName | LocalizedString | Full team name |
| teamCommonName | LocalizedString | Common team name |
| firstName / lastName | LocalizedString | Player names |
| badges | array | Player badges (empty for most) |
| teamLogo | string | Team logo URL |
| sweaterNumber | int | Jersey number |
| position | string | C/L/R/D/G |
| headshot | string | Player headshot URL |
| heroImage | string | Action photo URL |
| heightInInches / heightInCentimeters | int | Height |
| weightInPounds / weightInKilograms | int | Weight |
| birthDate | string | "1997-09-17" |
| birthCity / birthStateProvince / birthCountry | mixed | Birth location |
| shootsCatches | string | "L" or "R" |
| draftDetails | object | {year, teamAbbrev, round, pickInRound, overallPick} |
| playerSlug | string | "auston-matthews-8479318" |
| inTop100AllTime | int | 0 or 1 |
| inHHOF | int | 0 or 1 |

**featuredStats.regularSeason.subSeason (current season):**

| Field | Type |
|-------|------|
| gamesPlayed | int |
| goals | int |
| assists | int |
| points | int |
| plusMinus | int |
| pim | int |
| powerPlayGoals | int |
| powerPlayPoints | int |
| shorthandedGoals | int |
| shorthandedPoints | int |
| gameWinningGoals | int |
| otGoals | int |
| shots | int |
| shootingPctg | float |

**featuredStats.regularSeason.career:** Same fields as subSeason but career totals.

**careerTotals.regularSeason / careerTotals.playoffs** adds: avgToi (string "19:56"), faceoffWinningPctg.

**last5Games[] fields:** gameDate, gameId, gameTypeId, goals, assists, points, plusMinus, pim, powerPlayGoals, shorthandedGoals, shots, shifts, toi, homeRoadFlag, opponentAbbrev, teamAbbrev.

**seasonTotals[]:** Historical entries across all leagues. Fields: gameTypeId, gamesPlayed, leagueAbbrev, points, season, sequence, teamName. NHL entries include full stats (goals, assists, etc.).

**awards[]:** {trophy: {default: "Calder Memorial Trophy"}, seasons: [{seasonId, gamesPlayed, goals, assists, points, ...}]}.

**currentTeamRoster[]:** {playerId, lastName, firstName, playerSlug}.

---

### 2.2 Player Game Log

**URL:** `GET https://api-web.nhle.com/v1/player/{playerId}/game-log/now`
**Alt:** `GET https://api-web.nhle.com/v1/player/{playerId}/game-log/{season}/{gameType}`
**Used by PuckIQ:** Not currently used

Per-game stats for a player across a season.

**Response:**
```json
{
  "seasonId": 20252026,
  "gameTypeId": 2,
  "playerStatsSeasons": [
    {"season": 20252026, "gameTypes": [2]},
    {"season": 20242025, "gameTypes": [2, 3]}
  ],
  "gameLog": []
}
```

**gameLog[] fields (skater):**

| Field | Type | Description |
|-------|------|-------------|
| gameId | int | Game ID |
| teamAbbrev | string | Player's team |
| homeRoadFlag | string | "H" or "R" |
| gameDate | string | Date |
| goals | int | Goals |
| assists | int | Assists |
| points | int | Points |
| plusMinus | int | +/- |
| powerPlayGoals | int | PPG |
| powerPlayPoints | int | PPP |
| gameWinningGoals | int | GWG |
| otGoals | int | OTG |
| shots | int | SOG |
| shifts | int | Shifts |
| shorthandedGoals | int | SHG |
| shorthandedPoints | int | SHP |
| pim | int | PIM |
| toi | string | "21:11" |
| commonName | LocalizedString | Player's team name |
| opponentCommonName | LocalizedString | Opponent name |
| opponentAbbrev | string | Opponent abbreviation |

---

### 2.3 Roster

**URL:** `GET https://api-web.nhle.com/v1/roster/{TEAM}/current`
**Alt:** `GET https://api-web.nhle.com/v1/roster/{TEAM}/{season}`
**Used by PuckIQ:** `playerPrediction.ts`, `more.tsx`

Current team roster. Response contains `forwards`, `defensemen`, `goalies` arrays.

**Player fields:**

| Field | Type | Example |
|-------|------|---------|
| id | int | 8479318 |
| headshot | string | Headshot URL |
| firstName | LocalizedString | "Auston" |
| lastName | LocalizedString | "Matthews" |
| sweaterNumber | int | 34 |
| positionCode | string | "C" |
| shootsCatches | string | "L" |
| heightInInches | int | 75 |
| weightInPounds | int | 215 |
| heightInCentimeters | int | 191 |
| weightInKilograms | int | 98 |
| birthDate | string | "1997-09-17" |
| birthCity | LocalizedString | "San Ramon" |
| birthCountry | string | "USA" |
| birthStateProvince | LocalizedString | "California" |

---

### 2.4 Skater Stats Leaders

**URL:** `GET https://api-web.nhle.com/v1/skater-stats-leaders/current`
**Alt:** `GET https://api-web.nhle.com/v1/skater-stats-leaders/{season}/{gameType}`
**Used by PuckIQ:** Not currently used

League-wide skater leaders across 9 categories: goals, assists, points, goalsPp, goalsSh, plusMinus, faceoffLeaders, penaltyMins, toi. Each category returns top 5 players.

**Each leader entry:**

| Field | Type | Description |
|-------|------|-------------|
| id | int | Player ID |
| firstName / lastName | LocalizedString | Names |
| sweaterNumber | int | Jersey number |
| headshot | string | Headshot URL |
| teamAbbrev | string | Team |
| teamName | LocalizedString | Team name |
| teamLogo | string | Logo URL |
| position | string | Position code |
| value | number | Stat value |

---

### 2.5 Goalie Stats Leaders

**URL:** `GET https://api-web.nhle.com/v1/goalie-stats-leaders/current`
**Alt:** `GET https://api-web.nhle.com/v1/goalie-stats-leaders/{season}/{gameType}`
**Used by PuckIQ:** Not currently used

League-wide goalie leaders in 4 categories: wins, shutouts, savePctg, goalsAgainstAverage. Top 5 per category. Same entry structure as skater leaders.

---

### 2.6 Player Spotlight

**URL:** `GET https://api-web.nhle.com/v1/player-spotlight`
**Used by PuckIQ:** Not currently used

Returns an array of featured/spotlight players. Each entry: playerId, name, playerSlug, position, sweaterNumber, teamId, headshot, teamTriCode, teamLogo, sortId.

---

## 3. Standings and Teams

### 3.1 Standings

**URL:** `GET https://api-web.nhle.com/v1/standings/now`
**Alt:** `GET https://api-web.nhle.com/v1/standings/{YYYY-MM-DD}`
**Used by PuckIQ:** `useTonightData`, `picks.tsx`, `teams.tsx`, `advancedTeamStats.ts`, `teamComparison.ts`, `LivePreview.tsx`, `backtesting.ts`

70+ fields per team. The richest team-level endpoint.

**Response:** `{wildCardIndicator, standingsDateTimeUtc, standings: []}`

**Team standing fields:**

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| teamAbbrev.default | string | "COL" | Team abbreviation |
| teamName.default | string | "Colorado Avalanche" | Full name |
| teamCommonName.default | string | "Avalanche" | Common name |
| teamLogo | string | URL | Team logo |
| conferenceAbbrev | string | "W" | E or W |
| conferenceName | string | "Western" | Full conference |
| divisionAbbrev | string | "C" | A/M/C/P |
| divisionName | string | "Central" | Full division |
| gamesPlayed | int | 55 | GP |
| wins | int | 37 | W |
| losses | int | 9 | L |
| otLosses | int | 9 | OTL |
| points | int | 83 | PTS |
| pointPctg | float | 0.754 | Point % |
| goalFor | int | 212 | GF |
| goalAgainst | int | 138 | GA |
| goalDifferential | int | 74 | GF-GA |
| goalDifferentialPctg | float | 1.345 | GD per game |
| goalsForPctg | float | 3.854 | GF per game |
| regulationWins | int | 34 | REG wins |
| regulationPlusOtWins | int | 36 | ROW |
| regulationWinPctg | float | 0.618 | REG win % |
| regulationPlusOtWinPctg | float | 0.654 | ROW % |
| winPctg | float | 0.672 | Win % |
| shootoutWins / shootoutLosses | int | 1 / 5 | SO record |
| streakCode | string | "W" | W/L/OT |
| streakCount | int | 1 | Streak length |
| homeWins / homeLosses / homeOtLosses | int | 21/3/4 | Home record |
| homePoints | int | 46 | Home points |
| homeGamesPlayed | int | 28 | Home GP |
| homeGoalsFor / homeGoalsAgainst | int | 117/66 | Home goals |
| homeGoalDifferential | int | 51 | Home GD |
| homeRegulationWins | int | 21 | Home REG W |
| roadWins / roadLosses / roadOtLosses | int | 16/6/5 | Road record |
| roadPoints | int | 37 | Road points |
| roadGamesPlayed | int | 27 | Road GP |
| roadGoalsFor / roadGoalsAgainst | int | 95/72 | Road goals |
| roadGoalDifferential | int | 23 | Road GD |
| roadRegulationWins | int | 13 | Road REG W |
| l10GamesPlayed | int | 10 | L10 GP |
| l10Wins / l10Losses / l10OtLosses | int | 4/5/1 | L10 record |
| l10Points | int | 9 | L10 points |
| l10GoalsFor / l10GoalsAgainst | int | 30/35 | L10 goals |
| l10GoalDifferential | int | -5 | L10 GD |
| l10RegulationWins | int | 4 | L10 REG W |
| leagueSequence | int | 1 | League rank |
| conferenceSequence | int | 1 | Conference rank |
| divisionSequence | int | 1 | Division rank |
| wildcardSequence | int | 0 | WC position (0=in div) |
| leagueHomeSequence | int | 1 | League home rank |
| leagueRoadSequence | int | 4 | League road rank |
| leagueL10Sequence | int | 21 | League L10 rank |
| waiversSequence | int | 32 | Waiver priority |
| placeName | LocalizedString | "Colorado" | Place name |
| seasonId | int | 20252026 | Season |
| gameTypeId | int | 2 | Game type |

---

### 3.2 Standings Seasons

**URL:** `GET https://api-web.nhle.com/v1/standings-season`
**Used by PuckIQ:** Not currently used

Returns all available seasons for standings with metadata about rules in effect.

**Each season:** id, conferencesInUse, divisionsInUse, pointForOTlossInUse, regulationWinsInUse, rowInUse, standingsEnd, standingsStart, tiesInUse, wildcardInUse.

---

### 3.3 Season List

**URL:** `GET https://api-web.nhle.com/v1/season`
**Used by PuckIQ:** Not currently used

Simple array of season IDs: `[19171918, 19181919, ..., 20252026]` (108 seasons). Note: 20042005 is missing (lockout).

---

### 3.4 Club Stats

**URL:** `GET https://api-web.nhle.com/v1/club-stats/{TEAM}/now`
**Alt:** `GET https://api-web.nhle.com/v1/club-stats/{TEAM}/{season}/{gameType}`
**Used by PuckIQ:** `playerStats.ts`, `teamComparison.ts`, `teams.tsx`, `TeamPlayerHighlightsCard.tsx`

Season statistics for all players on a team.

**Response:** `{season, gameType, skaters: [], goalies: []}`

**Skater fields:** playerId, headshot, firstName, lastName, positionCode, gamesPlayed, goals, assists, points, plusMinus, penaltyMinutes, powerPlayGoals, shorthandedGoals, gameWinningGoals, overtimeGoals, shots, shootingPctg, avgTimeOnIcePerGame (seconds), avgShiftsPerGame, faceoffWinPctg.

**Goalie fields:** playerId, headshot, firstName, lastName, gamesPlayed, gamesStarted, wins, losses, overtimeLosses, goalsAgainstAverage, savePercentage, shotsAgainst, saves, goalsAgainst, shutouts, goals, assists, points, penaltyMinutes, timeOnIce (seconds).

---

### 3.5 Club Stats Seasons

**URL:** `GET https://api-web.nhle.com/v1/club-stats-season/{TEAM}`
**Used by PuckIQ:** `teams.tsx`

Lists available seasons and game types for a team's stats: `[{season: 20252026, gameTypes: [2]}, ...]`.

---

## 4. Edge IQ (NHL Tracking)

NHL's puck and player tracking system. Uses sensors to capture skating speed, shot speed, distance, zone time, and shot locations.

### 4.1 Skater Landing

**URL:** `GET https://api-web.nhle.com/v1/edge/skater-landing/now`
**Alt:** `GET https://api-web.nhle.com/v1/edge/skater-landing/{season}/{gameType}`
**Used by PuckIQ:** `edgeStats.ts`

Season leaders for skater tracking metrics.

**Response:** `{seasonsWithEdgeStats: [{id, gameTypes}], leaders: {}}`

**leaders categories:** hardestShot, maxSkatingSpeed, totalDistanceSkated, highDangerSOG, offensiveZoneTime, defensiveZoneTime.

Each leader has a `player` object (id, firstName, lastName, sweaterNumber, position, slug, headshot, team) plus category-specific values:

- hardestShot: `shotSpeed: {imperial, metric}` + `overlay` (game context)
- maxSkatingSpeed: `skatingSpeed: {imperial, metric}` + `overlay`
- totalDistanceSkated: `distanceSkated: {imperial, metric}`
- highDangerSOG: `sog` (int) + `shotLocationDetails[]` (area, sog, sogPercentile per 17 rink zones)
- offensiveZoneTime / defensiveZoneTime: `zoneTime` (float, as fraction)

---

### 4.2 Skater Detail

**URL:** `GET https://api-web.nhle.com/v1/edge/skater-detail/{playerId}/now`
**Alt:** `GET https://api-web.nhle.com/v1/edge/skater-detail/{playerId}/{season}/{gameType}`
**Used by PuckIQ:** `edgeStats.ts`

Individual skater tracking metrics with percentiles and league averages.

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| player | object | id, firstName, lastName, birthDate, shootsCatches, sweaterNumber, position, slug, headshot, goals |
| seasonsWithEdgeStats | array | Available seasons |
| topShotSpeed | object | imperial, metric, percentile, leagueAvg, overlay |
| skatingSpeed | object | speedMax, burstsOver20 |
| totalDistanceSkated | object | imperial, metric, percentile, leagueAvg |
| distanceMaxGame | object | imperial, metric, percentile, leagueAvg, overlay |
| sogSummary | array | 4 entries: {locationCode, shots, shotsPercentile, shotsLeagueAvg, goals, goalsPercentile, goalsLeagueAvg, shootingPctg, shootingPctgPercentile, shootingPctgLeagueAvg} |
| sogDetails | array | 17 rink zones: {area, shots, shotsPercentile} |
| zoneTimeDetails | object | offensiveZonePctg/Percentile/LeagueAvg, neutralZone..., defensiveZone... |

---

### 4.3 Goalie Landing

**URL:** `GET https://api-web.nhle.com/v1/edge/goalie-landing/now`
**Used by PuckIQ:** `edgeStats.ts`

Season leaders for goalie tracking metrics.

**Response:** `{seasonsWithEdgeStats, minimumGamesPlayed, leaders: {}}`

**leaders categories:** highDangerSavePctg ({player, savePctg, shotLocationDetails}), highDangerSaves ({player, saves, shotLocationDetails}), highDangerGoalsAgainst ({player, goalsAgainst}), savePctg5v5 ({player, savePctg}), gamesAbove900 ({player, games}).

---

### 4.4 Goalie Detail

**URL:** `GET https://api-web.nhle.com/v1/edge/goalie-detail/{playerId}/now`
**Used by PuckIQ:** `edgeStats.ts`

Individual goalie tracking metrics with save percentages by rink zone.

---

### 4.5 Team Landing

**URL:** `GET https://api-web.nhle.com/v1/edge/team-landing/now`
**Used by PuckIQ:** `edgeStats.ts`

Season leaders for team tracking metrics.

**Response:** `{seasonsWithEdgeStats, leaders: {}}`

**leaders categories:** shotAttemptsOver90 ({team, attempts}), burstsOver22 ({team, bursts}), distancePer60 ({team, distanceSkated}), highDangerSOG ({team, sog, shotLocationDetails}), offensiveZoneTime / neutralZoneTime / defensiveZoneTime ({team, zoneTime}).

---

### 4.6 Team Detail

**URL:** `GET https://api-web.nhle.com/v1/edge/team-detail/{teamId}/now`
**Used by PuckIQ:** `edgeStats.ts`

Individual team tracking data.

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| team | object | id, commonName, abbrev, teamLogo, slug, conference, division, wins, losses |
| seasonsWithEdgeStats | array | Available seasons |
| shotSpeed | object | shotAttemptsOver90, topShotSpeed |
| skatingSpeed | object | burstsOver22, burstsOver20, speedMax |
| distanceSkated | object | total |
| sogSummary | array | 4 zone summaries |
| sogDetails | array | 17 rink zones |
| zoneTimeDetails | object | offensiveZonePctg/Rank/LeagueAvg, neutralZone..., defensiveZone... |

---

### 4.7 By The Numbers

**URL:** `GET https://api-web.nhle.com/v1/edge/by-the-numbers/now`
**Used by PuckIQ:** `edgeStats.ts`

Last game night highlights from Edge tracking.

**Response:**
```json
{
  "games": 7,
  "gameDate": "2026-02-05",
  "hardestShotSkater": {"player": {}, "overlay": {}, "shotSpeed": {"imperial": 103.5, "metric": 166.6}},
  "maxSkatingSpeedSkater": {"player": {}, "overlay": {}, "skatingSpeed": {"imperial": 24.6, "metric": 39.6}},
  "totalDistanceSkatedSkater": {"player": {}, "distanceSkated": {"imperial": 234.5, "metric": 377.4}},
  "totalDistanceSkatedTeam": {"team": {}, "game": {}, "topFiveSkaters": []},
  "totalDistanceSkatedLeague": {"distanceSkated": {}, "topFiveSkaters": []}
}
```

---

### 4.8 Zone Time Details

**URL:** `GET https://api-web.nhle.com/v1/edge/team-zone-time-details/{teamId}/now`
**Used by PuckIQ:** `edgeStats.ts`

Team zone time breakdown by strength situation.

---

### 4.9 Top 10 Leaderboards

Available but not currently used by PuckIQ:

| Endpoint Pattern | Parameters |
|-----------------|------------|
| `/v1/edge/skater-speed-top-10/{positions}/{sort-by}/now` | positions, sort-by |
| `/v1/edge/skater-distance-top-10/{positions}/{strength}/{sort-by}/now` | positions, strength, sort-by |
| `/v1/edge/skater-shot-speed-top-10/{positions}/{sort-by}/now` | positions, sort-by |
| `/v1/edge/skater-shot-location-top-10/{position}/{category}/{sort-by}/now` | position, category, sort-by |
| `/v1/edge/skater-zone-time-top-10/{positions}/{strength}/{sort-by}/now` | positions, strength, sort-by |
| `/v1/edge/goalie-5v5-top-10/{sort-by}/now` | sort-by |
| `/v1/edge/goalie-shot-location-top-10/{category}/{sort-by}/now` | category, sort-by |
| `/v1/edge/goalie-edge-save-pctg-top-10/{sort-by}/now` | sort-by |
| `/v1/edge/team-zone-time-top-10/{strength}/{sort-by}/now` | strength, sort-by |
| `/v1/edge/team-shot-location-top-10/{position}/{category}/{sort-by}/now` | position, category, sort-by |
| `/v1/edge/team-shot-speed-top-10/{positions}/{sort-by}/now` | positions, sort-by |
| `/v1/edge/team-skating-speed-top-10/{positions}/{sort-by}/now` | positions, sort-by |
| `/v1/edge/team-skating-distance-top-10/{positions}/{strength}/{sort-by}/now` | positions, strength, sort-by |

Additional Edge detail endpoints (not currently used):
- `/v1/edge/skater-comparison/{id}/now` -- Skater vs peers
- `/v1/edge/skater-zone-time/{id}/now` -- Skater zone time
- `/v1/edge/skater-shot-speed-detail/{id}/now` -- Shot speed analysis
- `/v1/edge/skater-skating-speed-detail/{id}/now` -- Skating speed breakdowns
- `/v1/edge/skater-skating-distance-detail/{id}/now` -- Distance breakdowns
- `/v1/edge/skater-shot-location-detail/{id}/now` -- Shot locations by rink zone
- `/v1/edge/goalie-comparison/{id}/now` -- Goalie vs peers
- `/v1/edge/goalie-5v5-detail/{id}/now` -- 5v5 performance
- `/v1/edge/goalie-save-percentage-detail/{id}/now` -- Save % by shot type/location
- `/v1/edge/goalie-shot-location-detail/{id}/now` -- Saves by rink location
- `/v1/edge/team-comparison/{id}/now` -- Team vs league averages
- `/v1/edge/team-shot-location-detail/{id}/now` -- Shot locations
- `/v1/edge/team-shot-speed-detail/{id}/now` -- Shot speed distribution
- `/v1/edge/team-skating-speed-detail/{id}/now` -- Skating speed
- `/v1/edge/team-skating-distance-detail/{id}/now` -- Distance analysis

---

## 5. Draft and Playoffs

### 5.1 Draft Rankings

**URL:** `GET https://api-web.nhle.com/v1/draft/rankings/now`
**Alt:** `GET https://api-web.nhle.com/v1/draft/rankings/{year}/{category}`
**Used by PuckIQ:** Not currently used

**Response:**
```json
{
  "draftYear": 2026,
  "categoryId": 1,
  "categoryKey": "north-american-skater",
  "draftYears": [2026, 2025, ...],
  "categories": [
    {"id": 1, "name": "North American Skater", "consumerKey": "north-american-skater"},
    {"id": 2, "name": "International Skater", "consumerKey": "international-skater"},
    {"id": 3, "name": "North American Goalie", "consumerKey": "north-american-goalie"},
    {"id": 4, "name": "International Goalie", "consumerKey": "international-goalie"}
  ],
  "rankings": [
    {
      "lastName": "McKenna", "firstName": "Gavin", "positionCode": "LW",
      "shootsCatches": "L", "heightInInches": 71, "weightInPounds": 170,
      "lastAmateurClub": "PENN STATE", "lastAmateurLeague": "BIG10",
      "birthDate": "2007-12-20", "birthCity": "Whitehorse",
      "birthStateProvince": "YT", "birthCountry": "CAN",
      "midtermRank": 1
    }
  ]
}
```

---

### 5.2 Draft Picks

**URL:** `GET https://api-web.nhle.com/v1/draft/picks/{year}/all`
**Alt:** `GET https://api-web.nhle.com/v1/draft/picks/{year}/{round}`
**Used by PuckIQ:** Not currently used

**Response:** `{broadcastStartTimeUTC, draftYear, draftYears, selectableRounds, state, picks: []}`

**Pick fields:** round, pickInRound, overallPick, teamId, teamAbbrev, teamName, teamCommonName, firstName, lastName, positionCode, countryCode, height, weight, amateurLeague, amateurClubName, teamLogoLight, teamLogoDark.

---

### 5.3 Playoff Bracket

**URL:** `GET https://api-web.nhle.com/v1/playoff-bracket/{year}`
**Used by PuckIQ:** Not currently used

**Response:** `{bracketLogo, bracketTitle, bracketSubTitle, series: []}`

**Series fields:** seriesUrl, seriesTitle, seriesAbbrev, seriesLetter (A-P), playoffRound (1-4), topSeedRank, topSeedRankAbbrev (D1/D2/D3/WC1/WC2), topSeedWins, bottomSeedRank, bottomSeedWins, topSeedTeam (id, abbrev, name, logos), bottomSeedTeam.

---

## 6. Media and Meta

### 6.1 Network TV Schedule

**URL:** `GET https://api-web.nhle.com/v1/network/tv-schedule/now`
**Alt:** `GET https://api-web.nhle.com/v1/network/tv-schedule/{YYYY-MM-DD}`
**Used by PuckIQ:** Not currently used

NHL Network broadcast schedule (shows, not games).

**Response:** `{date, startDate, endDate, broadcasts: [{startTime, endTime, durationSeconds, title, description, broadcastType, broadcastImageUrl}]}`

---

### 6.2 Season Info

**URL:** `GET https://api-web.nhle.com/v1/season`
**Used by PuckIQ:** Not currently used

Simple array: `[19171918, ..., 20252026]` (108 seasons).

---

## 7. Stats REST API -- Teams

**Base URL:** `https://api.nhle.com/stats/rest/en/team/{category}`
**Required:** `?cayenneExp=seasonId=20252026`
**Optional:** `&sort=fieldName&direction=DESC&limit=10&start=0`

**CRITICAL:** Endpoint names MUST be lowercase (e.g., `goalsbyperiod` not `goalsForByPeriod`). Use `/stats/rest/en/config` to discover all valid category names.

All team endpoints return: `{data: [...], total: N}`

Common fields on every team record: `teamFullName` (string), `teamId` (int), `seasonId` (int), `gamesPlayed` (int).

### 7.1 Team List

**URL:** `GET https://api.nhle.com/stats/rest/en/team`
**Used by PuckIQ:** `more.tsx`

All teams (active + historical). Fields: id, franchiseId, fullName, leagueId (133=NHL), rawTricode, triCode.

---

### 7.2 Team Summary

**URL:** `GET https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026`
**Used by PuckIQ:** `teamComparison.ts`, `teamStatsForPrediction.ts`

| Field | Type | Description |
|-------|------|-------------|
| wins / losses / otLosses | int | Record |
| points | int | Points |
| pointPct | float | Point % |
| goalsFor / goalsAgainst | int | Goals |
| goalsForPerGame / goalsAgainstPerGame | float | Goals per game |
| shotsForPerGame / shotsAgainstPerGame | float | Shots per game |
| faceoffWinPct | float | FO% |
| powerPlayPct / powerPlayNetPct | float | PP% |
| penaltyKillPct / penaltyKillNetPct | float | PK% |
| regulationAndOtWins / winsInRegulation / winsInShootout | int | Win types |
| teamShutouts | int | Shutouts |

---

### 7.3 Team Realtime

**URL:** `GET https://api.nhle.com/stats/rest/en/team/realtime?cayenneExp=seasonId=20252026`
**Used by PuckIQ:** Not currently used

| Field | Type | Description |
|-------|------|-------------|
| hits / hitsPer60 | int / float | Hits |
| blockedShots / blockedShotsPer60 | int / float | Blocks |
| giveaways / giveawaysPer60 | int / float | Giveaways |
| takeaways / takeawaysPer60 | int / float | Takeaways |
| missedShots | int | Missed shots |
| emptyNetGoals | int | EN goals |
| satPct | float | Corsi % |
| timeOnIcePerGame5v5 | float | 5v5 TOI/game (seconds) |

---

### 7.4 Team Percentages (Corsi/Fenwick)

**URL:** `GET https://api.nhle.com/stats/rest/en/team/percentages?cayenneExp=seasonId=20252026`
**Used by PuckIQ:** Not currently used

Best endpoint for advanced analytics.

| Field | Type | Description |
|-------|------|-------------|
| satPct | float | **Corsi %** (5v5 shot attempts %) |
| satPctAhead / satPctBehind / satPctClose / satPctTied | float | Corsi % by game state |
| usatPct | float | **Fenwick %** (unblocked shot attempts %) |
| usatPctAhead / usatPctBehind / usatPctClose / usatPctTied | float | Fenwick % by game state |
| zoneStartPct5v5 | float | Offensive zone start % |
| shootingPct5v5 | float | 5v5 shooting % |
| savePct5v5 | float | 5v5 save % |
| shootingPlusSavePct5v5 | float | PDO (luck indicator, regresses to ~1.000) |
| goalsForPct | float | GF% |

**Key:** SAT = Corsi (all shot attempts), USAT = Fenwick (unblocked), PDO = shooting% + save%.

---

### 7.5 Team Summary Shooting

**URL:** `GET https://api.nhle.com/stats/rest/en/team/summaryshooting?cayenneExp=seasonId=20252026`

Raw Corsi/Fenwick counts: satFor, satAgainst, satTotal, satTied, satAhead, satBehind, satClose, usatFor, usatAgainst, usatTotal, usatTied, usatAhead, usatBehind, usatClose, shots5v5.

---

### 7.6 Team Power Play

**URL:** `GET https://api.nhle.com/stats/rest/en/team/powerplay?cayenneExp=seasonId=20252026`

Fields: ppOpportunities, ppOpportunitiesPerGame, powerPlayGoalsFor, ppGoalsPerGame, ppNetGoals, ppNetGoalsPerGame, powerPlayPct, powerPlayNetPct, ppTimeOnIcePerGame, shGoalsAgainst, shGoalsAgainstPerGame.

---

### 7.7 Team Power Play Time

**URL:** `GET https://api.nhle.com/stats/rest/en/team/powerplaytime?cayenneExp=seasonId=20252026`

Breakdown by situation: overallPowerPlayPct, timeOnIcePp, then per strength (5v4, 5v3, 4v3): timeOnIce, opportunities, goals, powerPlayPct.

---

### 7.8 Team Penalty Kill

**URL:** `GET https://api.nhle.com/stats/rest/en/team/penaltykill?cayenneExp=seasonId=20252026`

Fields: timesShorthanded, timesShorthandedPerGame, ppGoalsAgainst, ppGoalsAgainstPerGame, penaltyKillPct, penaltyKillNetPct, shGoalsFor, shGoalsForPerGame, pkNetGoals, pkTimeOnIcePerGame.

---

### 7.9 Team Penalty Kill Time

**URL:** `GET https://api.nhle.com/stats/rest/en/team/penaltykilltime?cayenneExp=seasonId=20252026`

Breakdown by situation (4v5, 3v5, 3v4): timeOnIce, timesShorthanded, goalsAgainst, penaltyKillPct.

---

### 7.10 Team Penalties

**URL:** `GET https://api.nhle.com/stats/rest/en/team/penalties?cayenneExp=seasonId=20252026`

Fields: penalties, penaltyMinutes, penaltySecondsPerGame, minors, majors, misconducts, gameMisconducts, matchPenalties, benchMinorPenalties, totalPenaltiesDrawn, netPenalties, penaltiesDrawnPer60, penaltiesTakenPer60, netPenaltiesPer60.

---

### 7.11 Team Faceoff Percentages

**URL:** `GET https://api.nhle.com/stats/rest/en/team/faceoffpercentages?cayenneExp=seasonId=20252026`

Fields: totalFaceoffs, faceoffWinPct, evFaceoffs/evFaceoffPct, ppFaceoffs/ppFaceoffPct, shFaceoffs/shFaceoffPct, offensiveZoneFaceoffs/offensiveZoneFaceoffPct, neutralZoneFaceoffs/neutralZoneFaceoffPct, defensiveZoneFaceoffs/defensiveZoneFaceoffPct.

---

### 7.12 Team Faceoff Wins

**URL:** `GET https://api.nhle.com/stats/rest/en/team/faceoffwins?cayenneExp=seasonId=20252026`

Raw counts: faceoffsWon/Lost per strength (ev, pp, sh) and zone (offensive, neutral, defensive).

---

### 7.13 Team Goals By Period

**URL:** `GET https://api.nhle.com/stats/rest/en/team/goalsbyperiod?cayenneExp=seasonId=20252026`

Fields: goalsFor, goalsAgainst, evGoalsFor, ppGoalsFor, shGoalsFor, period1GoalsFor/Against, period2GoalsFor/Against, period3GoalsFor/Against, periodOtGoalsFor/Against.

---

### 7.14 Team Goals For By Strength

**URL:** `GET https://api.nhle.com/stats/rest/en/team/goalsforbystrength?cayenneExp=seasonId=20252026`

Every strength combination: goalsFor5On5, 4On4, 3On3, 5On4, 5On3, 4On3, 3On4, 4On5, 3On5, goalsForEmptyNet, goalsForExtraAttacker, goalsForPenaltyShots, goalsForPerGame.

---

### 7.15 Team Goals Against By Strength

**URL:** `GET https://api.nhle.com/stats/rest/en/team/goalsagainstbystrength?cayenneExp=seasonId=20252026`

Same structure as 7.14 but `goalsAgainst*` fields.

---

### 7.16 Team Goals For By Strength (Goalie Pull)

**URL:** `GET https://api.nhle.com/stats/rest/en/team/goalsforbystrengthgoaliepull?cayenneExp=seasonId=20252026`

Goalie-pull situations: goalsForAllPulls, goalsFor6On5/6On4/6On3, goalsFor5On6/4On6/3On6, goalsFor6On6.

---

### 7.17 Team Goals Against By Strength (Goalie Pull)

**URL:** `GET https://api.nhle.com/stats/rest/en/team/goalsagainstbystrengthgoaliepull?cayenneExp=seasonId=20252026`

Same structure as 7.16 but `goalsAgainst*` fields.

---

### 7.18 Team Save Percentage

**URL:** `GET https://api.nhle.com/stats/rest/en/team/savePercentage?cayenneExp=seasonId=20252026`

Fields: shotsAgainst, saves, savePct, goalieGoalsAgainst, emptyNetGoalsAgainst, goalsAgainst, goalsAgainstAverage, goalsAgainstPerGame, shutouts, timeOnIce.

---

### 7.19 Team Shot Type

**URL:** `GET https://api.nhle.com/stats/rest/en/team/shottype?cayenneExp=seasonId=20252026`

Goals, SOG, and shooting % for each shot type: Wrist, Snap, Slap, Backhand, TipIn, Deflected, WrapAround.

---

### 7.20 Team Shootout

**URL:** `GET https://api.nhle.com/stats/rest/en/team/shootout?cayenneExp=seasonId=20252026`

Fields: shootoutGamesPlayed, shootoutWins/Losses, shootoutWinPct, shootoutGoals/Shots, shootoutShootingPct, shootoutGoalsAgainst/ShotsAgainst, shootoutSavePct, shootoutShootingPlusSavePct.

---

### 7.21 Team Outshoot/Outshot

**URL:** `GET https://api.nhle.com/stats/rest/en/team/outshootoutshotby?cayenneExp=seasonId=20252026`

Record when outshooting (wins/losses/otLosses), when outshot, and when even. Plus shotsForPerGame, shotsAgainstPerGame, netShotsPerGame.

---

### 7.22 Team Score/Trail First

**URL:** `GET https://api.nhle.com/stats/rest/en/team/scoretrailfirst?cayenneExp=seasonId=20252026`

Record and win% when scoring first and when trailing first: winsScoringFirst, lossesScoringFirst, winPctScoringFirst, winsTrailingFirst, lossesTrailingFirst, winPctTrailingFirst.

---

### 7.23 Team Leading/Trailing

**URL:** `GET https://api.nhle.com/stats/rest/en/team/leadingtrailing?cayenneExp=seasonId=20252026`

Record when leading/trailing after each period: winsLeadPeriod1, lossLeadPeriod1, winPctLeadPeriod1, winsTrailPeriod1, etc. for both P1 and P2.

---

### 7.24 Team Goal Games

**URL:** `GET https://api.nhle.com/stats/rest/en/team/goalgames?cayenneExp=seasonId=20252026`

Record in 1-goal, 2-goal, and 3+-goal games: winsOneGoalGames, lossesOneGoalGames, winPctOneGoalGames, etc.

---

### 7.25 Team Days Between Games

**URL:** `GET https://api.nhle.com/stats/rest/en/team/daysbetweengames?cayenneExp=seasonId=20252026`

**NOTE:** Returns MULTIPLE rows per team (one per daysRest value: 0, 1, 2, 3+).

Fields per row: daysRest, gamesPlayed, wins, losses, otLosses, pointPct, goalsForPerGame, goalsAgainstPerGame, netGoalsPerGame, shotsForPerGame, shotsAgainstPerGame, shotDifferentialPerGame, faceoffWinPct, powerPlayPct, penaltyKillPct.

---

## 8. Stats REST API -- Skaters

**Base URL:** `https://api.nhle.com/stats/rest/en/skater/{category}`
**Required:** `?cayenneExp=seasonId=20252026`

All return `{data: [...], total: N}`. Common fields: playerId, skaterFullName, lastName, positionCode, shootsCatches, seasonId, teamAbbrevs, gamesPlayed.

### 8.1 Skater Summary

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/summary?cayenneExp=seasonId=20252026`

Fields: assists, evGoals, evPoints, faceoffWinPct, gameWinningGoals, goals, otGoals, penaltyMinutes, plusMinus, points, pointsPerGame, ppGoals, ppPoints, shGoals, shPoints, shootingPct, shots, timeOnIcePerGame.

---

### 8.2 Skater Bios

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/bios?cayenneExp=seasonId=20252026`

Fields: birthCity, birthCountryCode, birthDate, birthStateProvinceCode, currentTeamAbbrev, currentTeamName, draftOverall, draftRound, draftYear, firstSeasonForGameType, height, weight, isInHallOfFameYn, nationalityCode, assists, goals, points.

---

### 8.3 Skater Realtime

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/realtime?cayenneExp=seasonId=20252026`

Fields: blockedShots, blockedShotsPer60, emptyNetAssists, emptyNetGoals, emptyNetPoints, firstGoals, giveaways, giveawaysPer60, hits, hitsPer60, missedShotCrossbar, missedShotGoalpost, missedShotOverNet, missedShotShort, missedShotWideOfNet, missedShots, otGoals, shotAttemptsBlocked, takeaways, takeawaysPer60, timeOnIcePerGame.

---

### 8.4 Skater Percentages (Corsi/Fenwick)

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/percentages?cayenneExp=seasonId=20252026`

Fields: satPercentage (Corsi%), satPercentageAhead/Behind/Close/Tied, satRelative, usatPercentage (Fenwick%), usatPercentageAhead/Behind/Tied, usatPrecentageClose (note: typo in API), usatRelative, shootingPct5v5, skaterSavePct5v5, skaterShootingPlusSavePct5v5 (PDO), timeOnIcePerGame5v5, zoneStartPct5v5.

---

### 8.5 Skater Summary Shooting

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/summaryshooting?cayenneExp=seasonId=20252026`

Raw Corsi/Fenwick: satFor, satAgainst, satAhead, satBehind, satClose, satRelative, satTied, satTotal, usatFor, usatAgainst, usatAhead, usatBehind, usatClose, usatRelative, usatTied, usatTotal, timeOnIcePerGame5v5.

---

### 8.6 Skater Scoring Rates

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/scoringRates?cayenneExp=seasonId=20252026`

Fields: goals5v5, goalsPer605v5, assists5v5, assistsPer605v5, points5v5, pointsPer605v5, primaryAssists5v5, primaryAssistsPer605v5, secondaryAssists5v5, secondaryAssistsPer605v5, netMinorPenaltiesPer60, offensiveZoneStartPct5v5, onIceShootingPct5v5, satPct, satRelative5v5, shootingPct5v5, timeOnIcePerGame5v5.

---

### 8.7 Skater Scoring Per Game

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/scoringpergame?cayenneExp=seasonId=20252026`

Fields: goals, goalsPerGame, assists, assistsPerGame, points, pointsPerGame, shots, shotsPerGame, hits, hitsPerGame, blockedShots, blocksPerGame, penaltyMinutes, penaltyMinutesPerGame, primaryAssistsPerGame, secondaryAssistsPerGame, totalPrimaryAssists, totalSecondaryAssists, timeOnIce, timeOnIcePerGame.

---

### 8.8 Skater Time On Ice

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/timeonice?cayenneExp=seasonId=20252026`

Fields: evTimeOnIce, evTimeOnIcePerGame, ppTimeOnIce, ppTimeOnIcePerGame, shTimeOnIce, shTimeOnIcePerGame, otTimeOnIce, otTimeOnIcePerOtGame, shifts, shiftsPerGame, timeOnIce, timeOnIcePerGame, timeOnIcePerShift.

---

### 8.9 Skater Power Play

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/powerplay?cayenneExp=seasonId=20252026`

Fields: ppGoals, ppGoalsPer60, ppAssists, ppPoints, ppPointsPer60, ppPrimaryAssists, ppPrimaryAssistsPer60, ppSecondaryAssists, ppSecondaryAssistsPer60, ppShots, ppShotsPer60, ppShootingPct, ppIndividualSatFor, ppIndividualSatForPer60, ppGoalsForPer60, ppTimeOnIce, ppTimeOnIcePerGame, ppTimeOnIcePctPerGame.

---

### 8.10 Skater Penalty Kill

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/penaltykill?cayenneExp=seasonId=20252026`

Fields: shGoals, shGoalsPer60, shAssists, shPoints, shPointsPer60, shPrimaryAssists, shPrimaryAssistsPer60, shSecondaryAssists, shSecondaryAssistsPer60, shShots, shShotsPer60, shShootingPct, shIndividualSatFor, shIndividualSatForPer60, ppGoalsAgainstPer60, shTimeOnIce, shTimeOnIcePerGame, shTimeOnIcePctPerGame.

---

### 8.11 Skater Penalties

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/penalties?cayenneExp=seasonId=20252026`

Fields: penalties, penaltiesDrawn, penaltyMinutes, minorPenalties, majorPenalties, misconductPenalties, gameMisconductPenalties, matchPenalties, netPenalties, netPenaltiesPer60, penaltiesDrawnPer60, penaltiesTakenPer60, penaltyMinutesPerTimeOnIce, penaltySecondsPerGame, goals, assists, points, timeOnIcePerGame.

---

### 8.12 Skater Faceoff Percentages

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?cayenneExp=seasonId=20252026`

Fields: faceoffWinPct, totalFaceoffs, evFaceoffs/evFaceoffPct, ppFaceoffs/ppFaceoffPct, shFaceoffs/shFaceoffPct, offensiveZoneFaceoffs/offensiveZoneFaceoffPct, neutralZoneFaceoffs/neutralZoneFaceoffPct, defensiveZoneFaceoffs/defensiveZoneFaceoffPct, timeOnIcePerGame.

---

### 8.13 Skater Faceoff Wins

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/faceoffwins?cayenneExp=seasonId=20252026`

Raw counts: totalFaceoffWins/Losses, evFaceoffsWon/Lost, ppFaceoffsWon/Lost, shFaceoffsWon/Lost, offensiveZoneFaceoffWins/Losses, neutralZoneFaceoffWins/Losses, defensiveZoneFaceoffWins/Losses.

---

### 8.14 Skater Goals For/Against

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?cayenneExp=seasonId=20252026`

Fields: evenStrengthGoalsFor/Against, evenStrengthGoalDifference, evenStrengthGoalsForPct, powerPlayGoalFor, powerPlayGoalsAgainst, shortHandedGoalsFor/Against, evenStrengthTimeOnIcePerGame, powerPlayTimeOnIcePerGame, shortHandedTimeOnIcePerGame, goals, assists, points.

---

### 8.15 Skater Puck Possessions

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/puckPossessions?cayenneExp=seasonId=20252026`

Fields: satPct (Corsi%), usatPct (Fenwick%), goalsPct, individualSatForPer60, individualShotsForPer60, onIceShootingPct, offensiveZoneStartPct, neutralZoneStartPct, defensiveZoneStartPct, offensiveZoneStartRatio, faceoffPct5v5, timeOnIcePerGame5v5.

---

### 8.16 Skater Shot Type

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/shottype?cayenneExp=seasonId=20252026`

Goals, SOG, and shooting % per shot type: Wrist, Snap, Slap, Backhand, TipIn, Deflected, WrapAround, Bat, BetweenLegs, Cradle, Poke.

---

### 8.17 Skater Shootout

**URL:** `GET https://api.nhle.com/stats/rest/en/skater/shootout?cayenneExp=seasonId=20252026`

Fields: shootoutGamesPlayed, shootoutGoals, shootoutShots, shootoutShootingPct, shootoutGameDecidingGoals, career versions of same fields.

---

## 9. Stats REST API -- Goalies

**Base URL:** `https://api.nhle.com/stats/rest/en/goalie/{category}`
**Required:** `?cayenneExp=seasonId=20252026`

Common fields: playerId, goalieFullName, lastName, shootsCatches, seasonId, teamAbbrevs, gamesPlayed.

### 9.1 Goalie Summary

**URL:** `GET https://api.nhle.com/stats/rest/en/goalie/summary?cayenneExp=seasonId=20252026`

Fields: gamesStarted, wins, losses, otLosses, ties, savePct, saves, goalsAgainst, goalsAgainstAverage, shotsAgainst, shutouts, goals, assists, points, penaltyMinutes, timeOnIce.

---

### 9.2 Goalie Bios

**URL:** `GET https://api.nhle.com/stats/rest/en/goalie/bios?cayenneExp=seasonId=20252026`

Fields: birthCity, birthCountryCode, birthDate, birthStateProvinceCode, currentTeamAbbrev, draftOverall, draftRound, draftYear, firstSeasonForGameType, height, weight, isInHallOfFameYn, nationalityCode, wins, losses, otLosses, shutouts.

---

### 9.3 Goalie Advanced

**URL:** `GET https://api.nhle.com/stats/rest/en/goalie/advanced?cayenneExp=seasonId=20252026`

Fields: completeGamePct, completeGames, incompleteGames, goalsFor, goalsForAverage, goalsAgainst, goalsAgainstAverage, savePct, qualityStart, qualityStartsPct, regulationWins, regulationLosses, shotsAgainstPer60, timeOnIce.

---

### 9.4 Goalie Days Rest

**URL:** `GET https://api.nhle.com/stats/rest/en/goalie/daysrest?cayenneExp=seasonId=20252026`

Fields: gamesPlayedDaysRest0/1/2/3/4Plus, savePctDaysRest0/1/2/3/4Plus, gamesStarted, wins, losses, otLosses, savePct.

---

### 9.5 Goalie Penalty Shots

**URL:** `GET https://api.nhle.com/stats/rest/en/goalie/penaltyShots?cayenneExp=seasonId=20252026`

Fields: penaltyShotsAgainst, penaltyShotsGoalsAgainst, penaltyShotsSaves, penaltyShotSavePct, goalsAgainst, saves, savePct, shotsAgainst.

---

### 9.6 Goalie Saves By Strength

**URL:** `GET https://api.nhle.com/stats/rest/en/goalie/savesByStrength?cayenneExp=seasonId=20252026`

Fields: evShotsAgainst/evSaves/evGoalsAgainst/evSavePct, ppShotsAgainst/ppSaves/ppGoalsAgainst/ppSavePct, shShotsAgainst/shSaves/shGoalsAgainst/shSavePct, overall saves/savePct/shotsAgainst/goalsAgainst, wins, losses, otLosses.

---

### 9.7 Goalie Shootout

**URL:** `GET https://api.nhle.com/stats/rest/en/goalie/shootout?cayenneExp=seasonId=20252026`

Fields: shootoutShotsAgainst, shootoutGoalsAgainst, shootoutSaves, shootoutSavePct, shootoutWins, shootoutLosses, career versions of same.

---

### 9.8 Goalie Started vs Relieved

**URL:** `GET https://api.nhle.com/stats/rest/en/goalie/startedVsRelieved?cayenneExp=seasonId=20252026`

Splits for started games (gamesStartedShotsAgainst/Saves/GoalsAgainst/SavePct/Wins/Losses/OtLosses) and relieved games (same prefix gamesRelieved*).

---

## 10. Stats REST API -- Games

**URL pattern:** Add `isGame=true` to any Stats REST endpoint for per-game data.

**Example:** `GET https://api.nhle.com/stats/rest/en/team/summary?isGame=true&cayenneExp=seasonId=20252026 and teamId=10`

**Additional game-level fields:**

| Field | Type | Description |
|-------|------|-------------|
| gameDate | string | Game date (YYYY-MM-DD) |
| gameId | int | Game ID |
| opponentTeamAbbrev | string | Opponent abbreviation |
| homeRoad | string | "H" or "R" |

This works for ALL stat categories (team, skater, goalie). Use `&limit=N&start=M` for pagination.

**Also available:** `GET https://api.nhle.com/stats/rest/en/game` for historical game database (basic records since 1917). Fields: id, easternStartTime, gameDate, gameNumber, gameScheduleStateId, gameStateId, gameType, homeScore, homeTeamId, period, season, visitingScore, visitingTeamId.

---

## 11. Reference: Codes and Enums

### Game States

| Value | Description |
|-------|-------------|
| FUT | Future / Scheduled |
| PRE | Pre-game |
| LIVE | In Progress |
| CRIT | Critical (final minutes / OT) |
| OFF | Official / Final |

### Schedule States

| Value | Description |
|-------|-------------|
| OK | Normal |
| PPD | Postponed |
| SUSP | Suspended |
| CNCL | Cancelled |

### Game Types

| Value | Description |
|-------|-------------|
| 1 | Preseason |
| 2 | Regular season |
| 3 | Playoffs |
| 4 | All-Star |
| 9 | International (4 Nations Face-Off) |

### Situation Code (4-digit)

Format: `AABB` -- A1=away goalie (0/1), A2=away skaters (3-6), B1=home goalie (0/1), B2=home skaters (3-6).

| Code | Meaning |
|------|---------|
| 1551 | 5v5 even strength |
| 1451 | 4v5 (away short, home PP) |
| 1541 | 5v4 (away PP, home short) |
| 1351 | 3v5 (away 2-man short) |
| 0551 | Away goalie pulled, 5v5 |
| 1550 | Home goalie pulled, 5v5 |
| 0651 | Away pulled, 6 skaters vs 5 |

### Position Codes

C = Center, L = Left Wing, R = Right Wing, D = Defense, G = Goalie.

### Shot Types

backhand, deflected, slap, snap, tip-in, wrist (plus bat, between-legs, cradle, poke, wrap-around in Stats REST).

### Division Abbreviations

A = Atlantic, M = Metropolitan, C = Central, P = Pacific.

### Seed Rank Abbreviations (Playoffs)

D1/D2/D3 = Division seeds, WC1/WC2 = Wild Card seeds.

### LocalizedString Pattern

```json
{"default": "English", "fr": "French", "cs": "Czech", "fi": "Finnish", "sk": "Slovak", "sv": "Swedish", "de": "German", "es": "Spanish"}
```

### Asset URL Patterns

| Asset | Pattern |
|-------|---------|
| Team logo (light) | `https://assets.nhle.com/logos/nhl/svg/{ABBREV}_light.svg` |
| Team logo (dark) | `https://assets.nhle.com/logos/nhl/svg/{ABBREV}_dark.svg` |
| Player headshot | `https://assets.nhle.com/mugs/nhl/{SEASON}/{TEAM}/{PLAYER_ID}.png` |
| Player action shot | `https://assets.nhle.com/mugs/actionshots/1296x729/{PLAYER_ID}.jpg` |

---

## 12. Endpoints That Return 404/500

### Web API (404)

- `/v1/where-to-watch`
- `/v1/gamecenter/{id}/story`
- `/v1/gamecenter/{id}/scoreboard`
- `/v1/gamecenter/{id}/status`
- `/v1/gamecenter/{id}/odds`
- `/v1/meta/game` (without game ID)
- `/v1/playoff-bracket/now`
- `/v1/odds/now`

### Stats REST API (500 -- case sensitivity)

**CRITICAL:** The Stats REST API requires lowercase endpoint names. CamelCase variants return 500 errors.

| Broken (CamelCase) | Working (lowercase) |
|--------------------|-------------------|
| `/team/goalsAgainstByPeriod` | Use `/team/goalsbyperiod` |
| `/team/goalsForByPeriod` | Use `/team/goalsbyperiod` |
| `/team/goalsAgainstByStrength` | `/team/goalsagainstbystrength` |
| `/team/goalsForByStrength` | `/team/goalsforbystrength` |
| `/team/leadingTrailing` | `/team/leadingtrailing` |
| `/team/outshootOutshot` | `/team/outshootoutshotby` |
| `/team/daysrest` | `/team/daysbetweengames` (different name!) |
| `/team/scoringfirst` | `/team/scoretrailfirst` |

### Non-existent Stats REST

- `/team/record` (500)
- `/team/scoring` (500)
- `/team/startedgames` (500)

### Config Discovery

**URL:** `GET https://api.nhle.com/stats/rest/en/config`

Returns the authoritative list of all available report types with field names, filters, and sort keys. Use this to discover valid category names.

**24 team categories:** summary, goalsforbystrengthgoaliepull, goalsagainstbystrength, realtime, penaltykilltime, goalgames, powerplaytime, penalties, shootout, shottype, faceoffpercentages, percentages, scoretrailfirst, daysbetweengames, outshootoutshotby, leadingtrailing, goalsbyperiod, summaryshooting, powerplay, savePercentage, penaltykill, goalsagainstbystrengthgoaliepull, faceoffwins, goalsforbystrength.

---

## 13. Endpoint Comparison Matrix

| Data Point | /score | /schedule | /scoreboard | /landing | /boxscore | /play-by-play | /right-rail | /wsc/game-story |
|-----------|--------|-----------|-------------|----------|-----------|---------------|-------------|-----------------|
| Team scores | Y | Y | Y | Y | Y | Y | Y | Y |
| Shots on goal | Y | - | - | Y | Y | - | Y | Y |
| Goals detail | Y | - | - | Y | - | Y | - | Y |
| Shot type on goals | - | - | - | Y | - | Y | - | - |
| Three stars | - | - | - | Y | - | - | - | Y |
| Player game stats | - | - | - | - | Y | - | - | - |
| Play-by-play events | - | - | - | - | - | Y | - | - |
| Shot coordinates | - | - | - | - | - | Y | - | - |
| Team comparison stats | - | - | - | - | - | - | Y | Y |
| Linescore by period | - | - | - | - | - | - | Y | - |
| Shots by period | - | - | - | - | - | - | Y | - |
| Penalties detail | - | - | - | Y | - | Y | - | - |
| Officials/Coaches | - | - | - | - | - | - | Y | - |
| Scratches | - | - | - | - | - | - | Y | - |
| Season series | - | - | - | - | - | - | Y | - |
| Clock state | Y | - | - | Y | Y | Y | - | Y |
| Winning goalie | - | Y | - | - | - | - | - | - |
| Dressed roster | - | - | - | - | - | Y | - | - |
| Game week overview | Y | Y | - | - | - | - | - | - |
| Odds partners | Y | - | - | - | - | - | - | - |
| Ticket links | - | - | Y | - | - | - | - | - |
| Game report URLs | - | - | - | - | - | - | Y | - |

---

## 14. PuckIQ Usage Map

### Endpoints Currently Used (21)

| # | Endpoint | Services/Components |
|---|----------|-------------------|
| 1 | `/v1/score/{date}` | useTonightData, picks.tsx, pickTracking.ts, gameResults.ts, historicalGames.ts, LivePreview.tsx, PickResultModal.tsx |
| 2 | `/v1/standings/now` | useTonightData, picks.tsx, teams.tsx, advancedTeamStats.ts, teamComparison.ts, LivePreview.tsx |
| 3 | `/v1/standings/{date}` | backtesting.ts |
| 4 | `/v1/club-schedule-season/{team}/{season}` | gameResults.ts (seed), recentForm.ts |
| 5 | `/v1/club-schedule/{team}/month/{month}` | teamForm.ts |
| 6 | `/v1/club-stats/{team}/now` | playerStats.ts, teamComparison.ts, teams.tsx, TeamPlayerHighlightsCard.tsx |
| 7 | `/v1/club-stats-season/{team}` | teams.tsx |
| 8 | `/v1/club-stats/{team}/{season}/2` | teams.tsx |
| 9 | `/v1/roster/{team}/current` | playerPrediction.ts, more.tsx |
| 10 | `/v1/player/{id}/landing` | playerPrediction.ts, more.tsx |
| 11 | `/v1/gamecenter/{id}/landing` | PickResultModal.tsx |
| 12 | `/v1/edge/skater-landing/now` | edgeStats.ts |
| 13 | `/v1/edge/goalie-landing/now` | edgeStats.ts |
| 14 | `/v1/edge/team-landing/now` | edgeStats.ts |
| 15 | `/v1/edge/by-the-numbers/now` | edgeStats.ts |
| 16 | `/v1/edge/skater-detail/{id}/now` | edgeStats.ts |
| 17 | `/v1/edge/team-detail/{id}/now` | edgeStats.ts |
| 18 | `/v1/edge/goalie-detail/{id}/now` | edgeStats.ts |
| 19 | `/v1/edge/team-zone-time-details/{id}/now` | edgeStats.ts |
| 20 | `/stats/rest/en/team` | more.tsx |
| 21 | `/stats/rest/en/team/summary` | teamComparison.ts, teamStatsForPrediction.ts |

### High-Value Untapped Endpoints

| Endpoint | Why Valuable |
|----------|-------------|
| `/v1/gamecenter/{id}/boxscore` | Per-player game stats (hits, blocks, FO%, TOI) |
| `/v1/gamecenter/{id}/play-by-play` | Shot coordinates, event-level data for real xG models |
| `/v1/player/{id}/game-log/now` | Per-game player stats (replaces 14 player/landing calls per game) |
| `/v1/skater-stats-leaders/current` | League leaderboards in one call |
| `/v1/goalie-stats-leaders/current` | Goalie leaderboards in one call |
| `/v1/gamecenter/{id}/right-rail` | Officials, scratches, season series, per-period shots |
| `/stats/rest/en/team/percentages` | Real Corsi/Fenwick % (replaces estimated advanced stats) |
| `/stats/rest/en/team/realtime` | Hits, blocks, takeaways per 60 |
| `/v1/edge/team-comparison/{id}/now` | Team Edge vs league averages |
| `/v1/edge/goalie-save-percentage-detail/{id}/now` | Save % by shot type and location |

### API Calls Per Screen

**Tonight Screen:** ~180-200+ calls (standings, scores, Edge x3, player predictions x games, H2H, team stats, team form).

**Picks Screen:** ~90-100+ calls (scores, standings, player predictions per game).

**Teams Screen:** 4-5 calls per team selection (standings, club-stats x3, club-stats-season).

**More Screen:** 3+ calls (team list, roster, player landing).

---

*Generated: 2026-02-07*
*Verified against live API responses*
*Total endpoints documented: 80+ Web API + 24 team + 17 skater + 8 goalie Stats REST categories*
