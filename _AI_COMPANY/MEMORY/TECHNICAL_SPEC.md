## TECHNICAL SPECIFICATION

### Feature: The Analytics Engine — Enhanced Stats Overhaul
### Approved Option: B (Bold) — "The Analytics Engine"
### Cycle: 5

---

## Architecture Overview

This cycle introduces NHL Edge IQ puck/player tracking data into PuckIQ. The NHL Edge API provides real data on shot speed (mph), skating speed (mph), skating distance (miles), zone time (%), shot location (by rink zone), and goalie save % by zone — all with league-average comparisons and percentile rankings.

**Key architectural decisions:**
1. **New service layer**: `services/edgeStats.ts` — centralized Edge API client with caching
2. **New derived stats service**: `services/derivedStats.ts` — momentum, clutch, xG approximation from existing data
3. **Supabase table**: `team_rolling_stats` for derived stat persistence (momentum, clutch ratings computed from game_results)
4. **No game_edge_stats table** (revised from strategy) — Edge API provides current-season data directly via `/now` endpoints. No need to store per-game Edge data in Supabase since the API serves season aggregates with percentiles.
5. **New types**: `types/edgeStats.ts` — TypeScript interfaces for all Edge API responses
6. **New components**: `EdgeIntelSection`, `SpeedGauge`, `ZoneTimeChart`, `ShotLocationMap`, `MomentumSparkline`, `ClutchBadge`

---

## Data Source Analysis (Archivist Report)

### Working Edge API Endpoints (Verified 2026-02-04)

**Landing/Overview endpoints (return league leaders + season overview):**
| Endpoint | Status | Returns |
|----------|--------|---------|
| `/v1/edge/skater-landing/now` | 200 | Season leaders: hardestShot, maxSkatingSpeed, totalDistanceSkated, highDangerSOG — each with player info, overlay (game context), and imperial/metric values |
| `/v1/edge/goalie-landing/now` | 200 | Season leaders: highDangerSavePctg — with shotLocationDetails (17 zones with savePctg + percentile) |
| `/v1/edge/team-landing/now` | 200 | Team leaders: shotAttemptsOver90, burstsOver22, distancePer60 — with team info, rank |
| `/v1/edge/by-the-numbers/now` | 200 | Last game night: hardestShotSkater, maxSkatingSpeedSkater, totalDistanceSkatedSkater — per-night highlights |

**Detail endpoints (per-player/per-team deep stats):**
| Endpoint | Status | Returns |
|----------|--------|---------|
| `/v1/edge/skater-detail/{playerId}/now` | 200 | topShotSpeed (mph + percentile + leagueAvg), skatingSpeed.speedMax, burstsOver20, totalDistanceSkated, sogSummary (by location: high/mid/long/all with shots+goals+shootingPctg+percentile), sogDetails (17 rink zones), zoneTimeDetails (off/neutral/def % + percentile) |
| `/v1/edge/team-detail/{teamId}/now` | 200 | shotSpeed (topShotSpeed + shotAttemptsOver90 + rank), skatingSpeed (burstsOver22 + speedMax + rank), distanceSkated (total + rank), sogSummary (by location + rank), sogDetails (17 zones + rank), zoneTimeDetails (off/neutral/def % + rank + leagueAvg) |
| `/v1/edge/team-zone-time-details/{teamId}/now` | 200 | zoneTimeDetails by strength (all, es, pp, pk) with pctg + rank + leagueAvg; shotDifferential (attemptDiff + sogDiff + ranks) |
| `/v1/edge/goalie-detail/{playerId}/now` | 200 | stats (GAA, gamesAbove900, goalDiffPer60 — each with percentile + leagueAvg), shotLocationSummary (high/mid/long/all — goalsAgainst + saves + savePctg + percentile), shotLocationDetails (17 zones — saves + savePctg + percentile) |

**Top-10 endpoints (currently broken for 20252026):**
| Endpoint | Status | Notes |
|----------|--------|-------|
| `/v1/edge/skater-shot-speed-top-10/F/avgShotSpeed/now` | 404 | Redirects to season-specific URL that 404s |
| `/v1/edge/skater-speed-top-10/F/topSpeed/now` | 404 | Same issue |
| `/v1/edge/team-zone-time-top-10/EV/offZoneTimePctg/now` | 500 | Server error |

**Workaround**: Use `/v1/edge/skater-landing/now` and `/v1/edge/team-landing/now` for season leaders. Use `/v1/edge/by-the-numbers/now` for per-game-night leaders.

### Edge API Response Shapes (Key Fields)

**Skater Detail (`/v1/edge/skater-detail/{id}/now`):**
```typescript
{
  player: { id, firstName, lastName, position, team: { abbrev, teamLogo }, goals, assists, points, gamesPlayed },
  topShotSpeed: { imperial: number, metric: number, percentile: number, leagueAvg: { imperial, metric } },
  skatingSpeed: {
    speedMax: { imperial: number, percentile: number, leagueAvg: { imperial } },
    burstsOver20: { value: number, percentile: number, leagueAvg: { value } }
  },
  totalDistanceSkated: { imperial: number, metric: number, percentile: number, leagueAvg: { imperial } },
  sogSummary: [{ locationCode: 'all'|'high'|'mid'|'long', shots, goals, shootingPctg, percentiles }],
  sogDetails: [{ area: string, shots: number, shotsPercentile: number }],  // 17 rink zones
  zoneTimeDetails: { offensiveZonePctg, defensiveZonePctg, neutralZonePctg, percentiles }
}
```

**Team Detail (`/v1/edge/team-detail/{id}/now`):**
```typescript
{
  team: { id, abbrev, wins, losses, otLosses, gamesPlayed, points },
  shotSpeed: { topShotSpeed: { imperial, rank, leagueAvg }, shotAttemptsOver90: { value, rank } },
  skatingSpeed: { speedMax: { imperial, rank, leagueAvg }, burstsOver22: { value, rank } },
  distanceSkated: { total: { imperial, rank, leagueAvg } },
  sogSummary: [{ locationCode, shots, shotsRank, shootingPctg, shootingPctgRank, goals, goalsRank }],
  sogDetails: [{ area: string, shots: number, shotsRank: number }],  // 17 zones
  zoneTimeDetails: { offensiveZonePctg, offensiveZoneRank, defensiveZonePctg, defensiveZoneRank, leagueAvg }
}
```

**By-The-Numbers (`/v1/edge/by-the-numbers/now`):**
```typescript
{
  games: number,
  gameDate: string,
  hardestShotSkater: { player: {...}, shotSpeed: { imperial, metric } },
  maxSkatingSpeedSkater: { player: {...}, skatingSpeed: { imperial, metric } },
  totalDistanceSkatedSkater: { player: {...}, distanceSkated: { imperial, metric } }
}
```

---

## Screen Design Specs

### 1. Tonight Tab — Design Spec

**Current State**: 8 sections (Header → QuickStatsBar → HeroMatchup → LiveNow → AllGamesCards → HotPlayers → InsightFeed → StatOfTheNight → Standings). Stats are generic (game count, close matchups, total season points).

**Target State**: Same structure but with Edge-powered stats replacing generic ones. New "EDGE INTEL" section. Momentum arrows and fatigue indicators on game cards. HotPlayers shows recency + speed data.

**Layout (top to bottom):**
```
┌─────────────────────────────────┐
│ Header: "PuckIQ" + model pill   │
│ Settings gear + streak badge    │
├─────────────────────────────────┤
│ QUICK STATS BAR (UPGRADED)      │
│ ┌─────────┐┌─────────┐┌──────┐ │
│ │⚡98 mph  ││🔥+12 MTM││💪72% │ │
│ │Top Shot  ││Momentum ││Rest  │ │
│ └─────────┘└─────────┘└──────┘ │
├─────────────────────────────────┤
│ HERO MATCHUP                    │
│ [Team gradient + ProbabilityArc]│
│ [Momentum sparklines ↗ ↘]      │
│ [H2H · Rest · Clutch badges]   │
│ [TOP EDGE + ConfidenceBadge]    │
├─────────────────────────────────┤
│ LIVE NOW BAR (when applicable)  │
├─────────────────────────────────┤
│ ALL GAMES                       │
│ ┌─────────────────────────────┐ │
│ │ TOR↗ @ BOS↘     7:00 PM    │ │
│ │ [Prob bar] [Badge] [Rest🌙] │ │
│ │ H2H: TOR leads 3-1 · Ins.  │ │
│ └─────────────────────────────┘ │
│ (repeat for each game)          │
├─────────────────────────────────┤
│ HOT PLAYERS TONIGHT (UPGRADED)  │
│ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │Player│ │Player│ │Player│ →   │
│ │Last5 │ │Last5 │ │Last5 │     │
│ │97mph │ │94mph │ │91mph │     │
│ │🔥HOT │ │      │ │❄COLD │     │
│ └──────┘ └──────┘ └──────┘     │
├─────────────────────────────────┤
│ EDGE INTEL (NEW SECTION)        │
│ ┌──────────────┐┌─────────────┐│
│ │ ⚡ SHOT SPEED ││ 🏃 SKATING  ││
│ │ Kleven 103mph││ McDavid 24.6││
│ └──────────────┘└─────────────┘│
│ ┌──────────────┐┌─────────────┐│
│ │ 🏒 ZONE TIME ││ 🎯 SHOT MAP ││
│ │ COL 45.2%    ││ Low slot 88 ││
│ └──────────────┘└─────────────┘│
├─────────────────────────────────┤
│ INTEL FEED (UPGRADED)           │
│ [Insights now reference Edge    │
│  data: speed, zone time, etc.]  │
├─────────────────────────────────┤
│ STAT OF THE NIGHT               │
│ (unchanged — boldest insight)   │
├─────────────────────────────────┤
│ STANDINGS (UPGRADED)            │
│ Division | W | L | OTL | PTS |↗│
│ (momentum arrow column added)   │
└─────────────────────────────────┘
```

**Component Specifications:**

| Component | Change | Size | Spacing | Colors |
|-----------|--------|------|---------|--------|
| QuickStatsBar | REPLACE props — dynamic Edge stats | Same (3 pills row) | gap: 8 | `theme.colors.surface` bg, `theme.colors.accent` icons |
| HeroMatchup | ADD momentum sparklines, clutch badge | +40px height for sparkline row | padding: 16, sparkline margin-top: 8 | Team gradient unchanged, sparkline `theme.colors.textSecondary` |
| AllGamesCard | ADD momentum arrow, rest icon | Same height | Arrow inline with team name | Green ↑, yellow →, red ↓ |
| HotPlayersSection | REPLACE season pts with Last 5 + shot speed | Card: 160×150 (was 140×120) | Extra row for speed | Shot speed in `theme.colors.accent` |
| EdgeIntelSection (NEW) | NEW section | 2-col grid, cards 160×120 | section gap: 24, card gap: 12 | `theme.colors.surface` bg |
| StandingsSnapshot | ADD momentum arrow column | +24px per row for arrow | Arrow right of PTS | Green/yellow/red |

**Copy Guide:**

| Element | Current Text | New Text | Rationale |
|---------|-------------|----------|-----------|
| QuickStatsBar pill 1 | "{N} Games" | "⚡ {speed} mph" + "Top Shot" | Edge data more interesting than game count |
| QuickStatsBar pill 2 | "{N} Close" | "🔥 {momentum}" + "Hottest" | Momentum replaces generic close count |
| QuickStatsBar pill 3 | "{N} Division" | "💪 {fatigue}%" + "Rest Edge" | Rest advantage more actionable |
| EdgeIntelSection header | (new) | "EDGE INTEL" | Consistent with "INTEL FEED" naming |
| EdgeIntel cards | (new) | "SHOT SPEED" / "SKATING SPEED" / "ZONE TIME" / "SHOT MAP" | Clear category labels |
| HotPlayers stat | "{pts} pts" | "Last 5: {g}G {a}A" | Recency > season totals |
| HotPlayers speed | (new) | "{speed} mph shot" | Edge adds unique value |
| Momentum arrows | (new) | "↑ / ↗ / → / ↘ / ↓" | Visual trend indicators |
| ClutchBadge | (new) | "CLUTCH / CLOSER / ICE COLD" | Narrative performance badges |

**States:**
- **Loading**: Skeleton placeholders for Edge Intel cards
- **Error/Unavailable**: Edge Intel section hidden if API fails. Other sections render with existing data.
- **Empty (no games)**: Existing empty state unchanged

**Interactions:**
- Tap EdgeIntel card → GameDeepDiveModal opens to Edge tab
- Long-press EdgeIntel card → share via ShareableCard

**Animations:**
- EdgeIntelSection: FadeInUp with 400ms delay
- Momentum sparklines: animated line draw (800ms, ease-in-out)
- SpeedGauge: animated number count-up (600ms, ease-out)
- ClutchBadge: subtle pulse on entry (scale 0.95→1.0, 300ms)

---

### 2. Deep Dive Modal — Design Spec

**Current State**: 5 tabs (Overview, Form, H2H, Players, Stats). No Edge data.

**Target State**: New "Edge" tab between Players and Stats.

**New "Edge" tab layout:**
```
┌─────────────────────────────────┐
│ SHOT SPEED COMPARISON           │
│ Away: 95.2 mph ████████░░ 72%   │
│ Home: 98.7 mph ██████████ 85%   │
│ League Avg: 83.3 mph            │
├─────────────────────────────────┤
│ SKATING SPEED                   │
│ Away: 23.4 mph (Rank #12)      │
│ Home: 24.1 mph (Rank #4)       │
│ Bursts >22mph: 56 vs 89        │
├─────────────────────────────────┤
│ ZONE TIME                       │
│ [Stacked bar: OFF|NEUT|DEF]    │
│ Away: 40% | 18% | 42%          │
│ Home: 45% | 17% | 38%          │
├─────────────────────────────────┤
│ MOMENTUM (5-GAME)               │
│ Away: [sparkline] ↗ Trending up │
│ Home: [sparkline] ↘ Cooling off │
├─────────────────────────────────┤
│ CLUTCH PERFORMANCE              │
│ Away: [CLUTCH] 1-goal: 8-3     │
│ Home: [ICE COLD] 1-goal: 3-7   │
└─────────────────────────────────┘
```

**Tab bar**: Overview | Form | H2H | Players | **Edge** | Stats

---

### 3. Explore Tab — Design Spec

**Current State**: 4 segments (Teams, Players, Factors, Models).

**Target State**: 5 segments — new "Edge" between Players and Factors.

**New "Edge" segment:**
```
┌─────────────────────────────────┐
│ 🏆 SEASON LEADERS               │
│ Hardest Shot: Kleven 103 mph    │
│ Fastest: McDavid 24.6 mph      │
│ Most Distance: McDavid 230 mi  │
├─────────────────────────────────┤
│ 📊 LAST GAME NIGHT              │
│ Hardest: Sergachev 95.5 mph    │
│ Fastest: Cozens 23.6 mph       │
├─────────────────────────────────┤
│ 🏒 TEAM EDGE RANKINGS           │
│ Most Speed Bursts >22mph       │
│ #1 EDM 174 | #2 COL 168        │
│ Best O-Zone Time               │
│ #1 COL 45.2% | #2 TBL 44.8%   │
└─────────────────────────────────┘
```

**Segment bar**: Teams | Players | **Edge** | Factors | Models

---

## Task Breakdown (Phased)

### Phase 1: Foundation — Types, Services, Data Layer

1. [ ] **Create `types/edgeStats.ts`** — TypeScript interfaces for all Edge API responses
   - `SkaterEdgeDetail`, `TeamEdgeDetail`, `GoalieEdgeDetail`, `EdgeByTheNumbers`, `EdgeSkaterLanding`, `EdgeGoalieLanding`, `EdgeTeamLanding`
   - `ShotLocationZone`, `ZoneTimeDetail`, `SpeedStat`, `DistanceStat`
   - `MomentumData`, `ClutchRating`, `DerivedTeamStats`
   - **AC**: All types compile. Each type maps 1:1 to verified API response shape.

2. [ ] **Create `services/edgeStats.ts`** — Edge API client with in-memory cache
   - Functions: `fetchSkaterEdge`, `fetchTeamEdge`, `fetchGoalieEdge`, `fetchTeamZoneTime`, `fetchEdgeByTheNumbers`, `fetchEdgeSkaterLanding`, `fetchEdgeGoalieLanding`, `fetchEdgeTeamLanding`, `clearEdgeCache`
   - Cache: 5-minute TTL, Map<string, { data, timestamp }>
   - All fetches return null on error
   - **AC**: Service compiles. Fetches correct endpoints. Cache prevents duplicate calls. Errors return null.

3. [ ] **Create `services/derivedStats.ts`** — Momentum, clutch, rest calculations
   - `calculateMomentum(teamAbbrev, gameResults[])` → MomentumData (score -10 to +10, trend arrow)
   - `calculateClutchRating(teamAbbrev, gameResults[])` → ClutchRating (ICE COLD / CLUTCH / CLOSER)
   - `calculateRestAdvantage(team, games, schedule)` → number (0-100%)
   - `calculateXGApprox(teamEdge, standings)` → { xGF, actual, delta }
   - **AC**: All functions compile and return correct types. Momentum categorizes trends. Clutch assigns badges. Rest returns 0-100.

4. [ ] **Add `team_rolling_stats` table to Supabase** — Schema + seed script
   - SQL from Schema Changes section
   - `computeAndStoreRollingStats(teamAbbrev)` in derivedStats.ts
   - Compute on app mount after syncRecentResults
   - **AC**: Table created. Rolling stats computed for 32 teams. Data queryable.

5. [ ] **Write tests for edgeStats.ts** — Mock fetch, cache, errors
   - **AC**: 15+ tests covering all functions, cache TTL, error handling.

6. [ ] **Write tests for derivedStats.ts** — Momentum/clutch/rest calculations
   - **AC**: 20+ tests covering edge cases.

→ **CHECKPOINT**: `npm test` passes. Edge service fetches live data (manual check). Derived stats compute from game_results.

### Phase 2: Core UI — New Components

7. [ ] **Create `components/SpeedGauge.tsx`** — Speed value display with animation
   - Props: `{ value, unit, label, percentile?, leagueAvg? }`
   - Animated number count-up (600ms). Percentile bar.
   - **AC**: Renders 0-110 mph. Animation plays. Percentile shows.

8. [ ] **Create `components/MomentumSparkline.tsx`** — 5-game trend sparkline
   - Props: `{ data: number[], trend, teamAbbrev, compact? }`
   - SVG path line. Compact (80×24) and full (100%×40) modes.
   - Animated line draw (800ms).
   - **AC**: Both modes render. Trend arrow correct. Team-colored.

9. [ ] **Create `components/ClutchBadge.tsx`** — Performance badge
   - Props: `{ rating: 'CLUTCH'|'CLOSER'|'ICE COLD'|null, compact? }`
   - CLUTCH=#22c55e, CLOSER=#eab308, ICE COLD=#94a3b8. Null returns null.
   - **AC**: All 3 states + null render correctly.

10. [ ] **Create `components/ZoneTimeChart.tsx`** — Stacked bar
    - Props: `{ offPctg, neutPctg, defPctg, leagueAvg? }`
    - Green=offense, gray=neutral, red=defense. League avg comparison line.
    - **AC**: Segments sum to 100%. Colors correct.

11. [ ] **Create `components/ShotLocationMap.tsx`** — Rink zone heat map
    - Props: `{ zones: Array<{ area, shots, rank?, percentile? }> }`
    - Simplified half-rink SVG, 17 zones. Hot=red, cold=blue. Tap for tooltip.
    - **AC**: 17 zones render. Colors reflect data. Tap shows tooltip.

12. [ ] **Create `components/EdgeIntelSection.tsx`** — 2×2 grid
    - Props: `{ skaterLanding, teamLanding, byTheNumbers, onCardPress }`
    - Header "EDGE INTEL". 4 cards with leader data. FadeInUp.
    - **AC**: 4 cards render. Tap fires callback. Handles null data.

13. [ ] **Write tests for new components** — 28+ tests total
    - **AC**: All component tests passing.

→ **CHECKPOINT**: Components render in isolation. `npm test` passes. Visual inspection.

### Phase 3: Integration — Wire into Screens

14. [ ] **Update `app/(tabs)/index.tsx`** — Edge data fetching + component wiring
    - Add Edge API calls parallel with existing NHL calls
    - Compute derived stats from game_results
    - Pass edgeStats to QuickStatsBar, edgePlayerData to HotPlayers
    - Add EdgeIntelSection between HotPlayers and InsightFeed
    - Pass momentum to AllGamesCard and HeroMatchup
    - **AC**: Edge-powered QuickStatsBar. EdgeIntelSection visible. Momentum arrows on games. Graceful fallback.

15. [ ] **Update `components/QuickStatsBar.tsx`** — Edge stats with fallback
    - New `edgeStats?` prop. Show Edge when available, generic when not.
    - **AC**: Edge stats when available, generic fallback. No visual regression.

16. [ ] **Update `components/HeroMatchup.tsx`** — Momentum + clutch
    - New props: `awayMomentum?`, `homeMomentum?`, `awayClutch?`, `homeClutch?`
    - Compact MomentumSparkline below arc. ClutchBadge in chips.
    - **AC**: Sparklines below arc. Clutch badge when applicable. No change when props absent.

17. [ ] **Update `components/AllGamesCard.tsx`** — Momentum arrows + rest
    - New props: `awayMomentum?`, `homeMomentum?`, `restAdvantage?`
    - Arrow inline with team abbrev. Rest icon when advantage > 20%.
    - **AC**: Arrows next to names. Rest icon shows. No change when absent.

18. [ ] **Update `components/HotPlayersSection.tsx`** — Last 5 + speed
    - New `edgePlayerData?` prop. Show Last 5 stats + shot speed. Cards 160×150.
    - **AC**: Last-5 stats shown. Shot speed when present. Cards larger.

19. [ ] **Update `components/StandingsSnapshot.tsx`** — Momentum arrows
    - New `momentumMap` prop. Arrow column after PTS. Green/gray/red.
    - **AC**: Momentum column visible. Arrows colored.

20. [ ] **Update `services/insightGenerator.ts`** — Edge insights
    - New `edgeData?` parameter. New 'edge' category insights.
    - **AC**: 2+ Edge insights when data available. Existing insights still work.

21. [ ] **Update `components/GameDeepDiveModal.tsx`** — "Edge" tab
    - New tab between Players and Stats. Fetch team Edge on tab activation.
    - Sections: Shot Speed, Skating Speed, Zone Time, Momentum, Clutch.
    - **AC**: Tab appears. Data loads on activation. All sections render. Loading state.

22. [ ] **Update `app/(tabs)/stats.tsx`** — "Edge" segment
    - New segment. Season leaders, last night, team rankings.
    - **AC**: Segment in control. 3 sections with real data.

23. [ ] **Write integration tests** — 10+ tests
    - **AC**: Screen-level data flow verified.

→ **CHECKPOINT**: Screenshot Tonight tab. Edge QuickStatsBar, momentum arrows, EdgeIntelSection, HotPlayers last-5+speed. Deep Dive Edge tab works. Explore Edge segment works. `npm test` passes. Persona spot-check.

### Phase 4: Polish & Cleanup

24. [ ] **Add animations** — Sparkline draw, speed count-up, EdgeIntel stagger
    - **AC**: Smooth animations. No jank.

25. [ ] **Polish copy + empty states** — Text review, number formatting (1 decimal)
    - **AC**: All text matches spec. Numbers formatted.

26. [ ] **Update MEMORY files** — FILE_MAP, CURRENT_STATE, MISSION
    - **AC**: All MEMORY files current.

→ **CHECKPOINT**: Final screenshot. Visual quality. Persona validation.

---

## Schema Changes

```sql
CREATE TABLE IF NOT EXISTS team_rolling_stats (
  id BIGSERIAL PRIMARY KEY,
  team_abbrev TEXT NOT NULL,
  season TEXT NOT NULL,
  momentum_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  momentum_trend TEXT NOT NULL DEFAULT '→',
  momentum_data JSONB,
  clutch_rating TEXT,
  clutch_one_goal_record TEXT,
  clutch_ot_record TEXT,
  xg_approx NUMERIC(5,2),
  actual_goals INTEGER,
  xg_delta NUMERIC(5,2),
  pp_pctg_rolling NUMERIC(5,4),
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_abbrev, season)
);

CREATE INDEX IF NOT EXISTS idx_team_rolling_stats_lookup
  ON team_rolling_stats (team_abbrev, season);

ALTER TABLE team_rolling_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read rolling stats" ON team_rolling_stats FOR SELECT USING (true);
CREATE POLICY "Service write rolling stats" ON team_rolling_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update rolling stats" ON team_rolling_stats FOR UPDATE USING (true);
```

Storage: 32 teams × ~200 bytes = ~6.4KB/season (negligible).

---

## Data Sources (New Endpoints)

| Endpoint | Frequency | Cache | Fallback |
|----------|-----------|-------|----------|
| `/v1/edge/skater-landing/now` | On mount | 5 min | Hide Edge Intel leaders |
| `/v1/edge/goalie-landing/now` | On mount | 5 min | Hide goalie Edge data |
| `/v1/edge/team-landing/now` | On mount | 5 min | Hide team rankings |
| `/v1/edge/by-the-numbers/now` | On mount | 5 min | Hide "last night" |
| `/v1/edge/skater-detail/{id}/now` | On demand | 5 min | "Edge data unavailable" |
| `/v1/edge/team-detail/{id}/now` | On demand | 5 min | Omit Edge from cards |
| `/v1/edge/goalie-detail/{id}/now` | On demand | 5 min | "Edge data unavailable" |
| `/v1/edge/team-zone-time-details/{id}/now` | On demand | 5 min | Hide zone chart |

API budget: ~4 landing + N team detail (N = games today, max ~16) = ~20 calls/session.

---

## Dependencies

No new npm packages. Existing cover all needs: `react-native-svg`, `react-native-reanimated`, `react-native-chart-kit`, `@supabase/supabase-js`.

---

## File Plan

### New Files (17)
| File | Purpose |
|------|---------|
| `types/edgeStats.ts` | Edge API type definitions |
| `services/edgeStats.ts` | Edge API client + cache |
| `services/derivedStats.ts` | Momentum, clutch, rest, xG |
| `components/SpeedGauge.tsx` | Speed display + animation |
| `components/MomentumSparkline.tsx` | 5-game trend sparkline |
| `components/ClutchBadge.tsx` | Clutch performance badge |
| `components/ZoneTimeChart.tsx` | Zone time stacked bar |
| `components/ShotLocationMap.tsx` | Rink zone heat map |
| `components/EdgeIntelSection.tsx` | 2×2 Edge stat cards |
| `services/__tests__/edgeStats.test.ts` | Edge service tests |
| `services/__tests__/derivedStats.test.ts` | Derived stats tests |
| `components/__tests__/SpeedGauge.test.tsx` | Tests |
| `components/__tests__/MomentumSparkline.test.tsx` | Tests |
| `components/__tests__/ClutchBadge.test.tsx` | Tests |
| `components/__tests__/ZoneTimeChart.test.tsx` | Tests |
| `components/__tests__/ShotLocationMap.test.tsx` | Tests |
| `components/__tests__/EdgeIntelSection.test.tsx` | Tests |

### Modified Files (10)
| File | Changes |
|------|---------|
| `app/(tabs)/index.tsx` | Edge data fetching, EdgeIntelSection, pass Edge props |
| `app/(tabs)/stats.tsx` | Add "Edge" segment |
| `components/QuickStatsBar.tsx` | Accept edgeStats prop |
| `components/HeroMatchup.tsx` | Momentum sparklines + clutch |
| `components/AllGamesCard.tsx` | Momentum arrows + rest |
| `components/HotPlayersSection.tsx` | Last 5 + shot speed |
| `components/StandingsSnapshot.tsx` | Momentum arrow column |
| `components/GameDeepDiveModal.tsx` | "Edge" tab |
| `services/insightGenerator.ts` | Edge-powered insights |
| `services/derivedStats.ts` | Supabase rolling stats compute |

### No Deletions
Purely additive cycle.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Edge API down/changed | All Edge data optional. Components hide when null. Existing features unaffected. |
| Edge API rate limiting | 5-min cache. Promise.allSettled for parallel calls. |
| ShotLocationMap SVG perf | Simplified 17-rectangle rink. React.memo. |
| Too many API calls | Landing data parallel with existing calls. Detail calls deferred to on-demand. |
| Rolling stats slow first run | Incremental compute (only teams with new results). |
| No game_results for new users | "Seed data" prompt. Fallback to standings-based approximation. |
