# PUCK-IQ Decision Log

<!-- Strategy Squad appends decisions here after each "Greenlight" meeting -->
<!-- Format: ## [Date] Decision Title -->
<!-- Options Presented: Safe / Bold / Scrappy -->
<!-- Approved Option: -->
<!-- Rationale: -->

## 2026-02-03 - Persona-First App Reorganization: Stats + Predictions Core
- **Request**: "This app is all over the place, make it more focused on the personas and come up with a plan to make this app exactly what the personas need"
- **CEO Clarification**: Find what's COMMON between all three personas. The core value is stats and predictions — everything else supports that or gets cut. Every prediction should be visually bold (Homer), backed by real math (Shark), and shareable (Debater).
- **Approved Option**: B - BOLD — "Stats App, Day One"
- **Rationale**: CEO wants the full vision in Cycle 1, not incremental. The app should feel like a completely different product after this cycle. All three personas are excited.
- **Key Requirements**:
  - Restructure to 3 tabs: Today | Stats | My Picks
  - Today: Yesterday's Results, Lock of Day with confidence badges (LOCK/STRONG/LEAN/TOSS-UP), All Games grid with shareable cards, team color accent on favorite team, animated matchup reveals
  - Stats: Explore teams/players + Factor Leaderboard + advanced stat tooltips, team comparison tool
  - My Picks: real pickTracking data, accuracy by factor, accuracy over time chart, shareable stat card
  - ShareableCard component with share button on every prediction and stat
  - Confidence badges replace raw percentages everywhere
  - Delete: Learn tab, My IQ tab, Profile tab (→ gear icon), Models (→ sub-screen from model picker)
- **Persona Scorecard**:
  - Shark: excited — full stats depth from day one, factor analysis front and center, transparent prediction math
  - Debater: excited — share flow and bold takes from day one, shareable accuracy stats, screenshot-optimized cards
  - Homer: excited — team colors, confidence badges feel emotional, animated matchups, favorite team prominent
- **Future Cycles**:
  - Cycle 2: Model Builder improvements (model vs PuckIQ on cards), onboarding (pick team), push notifications
  - Cycle 3: Prediction accuracy streaks, season-long trends, social sharing templates
- **Next Squad**: Blueprint Squad

## 2026-02-03 - Competitive Positioning: MVP Prediction Companion
- **Request**: "I want to figure out the main value proposition of this app, give me suggestions on what it should be"
- **CEO Clarification**: Wants competitive positioning focused around users of prediction apps like Kalshi and Sleeper — without explicitly saying it's for those apps. Should provide tools, utilities, and predictions using in-depth data. Supabase integrations, historical data, etc. "We're thinking too small right now."
- **Context**: NHL has officially partnered with Kalshi and Polymarket for prediction markets. Sleeper Markets launching in 2026. Rithmm charges $30/mo for custom AI models. BetQL/Action Network charge premium for analytics. PuckIQ already has a free model builder and confidence-rated predictions — unique in the market.
- **Approved Option**: C - SCRAPPY — "MVP Companion with Quick Wins"
- **Rationale**: Option B (full data companion with multi-year historical pipeline, player-level predictions, prop analysis) is the correct long-term vision but multi-cycle. Option C ships the companion positioning with real product substance in ONE cycle: current-season H2H records, key player context, Supabase data foundation, companion-style share cards, and positioning overhaul. Validates the direction with real features, then B extends it in Cycle 3+.
- **Key Requirements**:
  - Supabase table for current-season game results (foundation for future historical data)
  - Head-to-head (H2H) season series records on game cards
  - Key Players section in game deep-dive (tonight's top players + season stats)
  - Share cards include H2H record and player context
  - MISSION.md + App Store copy reframed as prediction companion ("Your Edge Before Every Pick")
  - In-app copy positions PuckIQ as a research/companion tool for prediction platforms
- **Persona Scorecard**:
  - Shark: neutral-excited — current-season H2H and player context is useful, full historical depth comes in future cycles
  - Debater: excited — H2H records on share cards are immediately useful ammunition for arguments
  - Homer: excited — "we're 3-1 against MTL this season" adds emotional context to every game
- **Future Cycles**:
  - Cycle 3: Full historical data pipeline (multi-year), player-level prop predictions, enhanced model builder with historical backtesting
  - Cycle 4: User accounts, synced models across devices, premium tier consideration
- **Next Squad**: Blueprint Squad

## 2026-02-03 - The War Room: Insider Terminal Rework
- **Request**: "PuckIQ merges professional-grade analytics with high-fidelity design, creating an insider's terminal where the Shark uncovers predictive ROI to beat the market, the Debater wields visualized data to dominate group chats, and the Homer experiences every stat through a cinematic lens that feels less like a spreadsheet and more like the game itself."
- **CEO Clarification**: "You're using too many of the existing components. I want a rework. Picks aren't necessary." The app should be an analytics terminal, not a picks tracker. The user researches in PuckIQ, then acts on Kalshi/Sleeper. Picks are the output of analysis, not the feature.
- **Approved Option**: B - BOLD — "The War Room"
- **Rationale**: CEO explicitly rejected incremental options and existing component reuse. Option B is the only approach that fully reworks the app identity from picks tracker to analytics terminal. Three new component systems replace all existing pick cards. Zero infrastructure cost — purely component-level work on existing data layer.
- **Key Requirements**:
  - DELETE all existing pick card components (TopPickCard, SmartPickCard, PickCard, LockOfTheDayCard, ConfirmPickModal, YesterdayResultsCard)
  - BUILD HeroMatchup: Full-width cinematic game card with team color gradient split, animated probability arc (curved gauge), 3 key insight chips (H2H, rest advantage, streak), share button, tap for deep dive
  - BUILD GameTicker: Horizontal scrollable strip of remaining games — compact capsules with team abbreviations, probability micro-bars, confidence dot, 1-line insight
  - BUILD InsightFeed: Vertical feed of shareable analytical nuggets with team color accents — "TOR is 0-4 on back-to-backs", "COL goalie .940 SV% in last 5" — each is a shareable card
  - Restructure to 2 tabs: Tonight + Explore
  - Tonight: HeroMatchup + GameTicker + InsightFeed
  - Explore: Merge Teams + Players + Factors + Team Comparison + Models into one deep tab
  - My Picks tab removed (model accuracy accessible in Explore → Models)
  - Profile/Settings via gear icon
  - Remove lock-in flow, pick confirmation, yesterday's results tracking
  - Keep: GameDeepDiveModal, ShareableCard, ConfidenceBadge, SeasonSeriesBadge, prediction engine, model switcher, team colors, all services
- **Screen-by-Screen Impact**:
  - **Tonight (replaces Today)**: HeroMatchup (full-width team color gradient, animated probability arc, insight chips, share) + GameTicker (horizontal scroll) + InsightFeed (shareable nuggets)
  - **Explore (replaces Stats)**: Merged Teams + Players + Factors + Comparison + Models
  - **My Picks**: REMOVED as tab. Model accuracy in Explore → Models.
  - **Profile/Settings**: Gear icon only
  - **Removals**: TopPickCard, SmartPickCard, PickCard, LockOfTheDayCard, ConfirmPickModal, YesterdayResultsCard, lock-in flow, My Picks tab
- **Persona Scorecard**:
  - Shark: excited — InsightFeed is pure edge content, probability arc shows math visually, deep dive one tap away, sorted by edge strength
  - Debater: excited — Hero Matchup is visually stunning for sharing, InsightFeed nuggets are perfectly screenshot-sized shareable cards
  - Homer: excited — team color gradient split is cinematic, animated arcs have energy, InsightFeed has personality
- **Next Squad**: Blueprint Squad

## 2026-02-03 - The Full Terminal: Tonight Tab Buildout
- **Request**: "We need to build out the tonight tab, it's much too bare and there need to be way more features and components on the screen."
- **Approved Option**: B - BOLD — "The Full Terminal"
- **Rationale**: CEO wants "way more features." Option B delivers 5 new content zones, transforming the screen from 3 widgets to a dense analytics terminal. Data is mostly already fetched — cost is UI work, not infrastructure. All three personas excited.
- **Key Requirements**:
  - ADD Quick Stats Bar (horizontal stat pills below header)
  - ADD All Games Cards (full-width vertical cards for every game, replacing GameTicker as primary browser)
  - ADD Hot Players Tonight (horizontal scroll of player cards with stats)
  - ADD Shareable Stat of the Night (bold single-stat card with share)
  - ADD Standings Snapshot (division leaders table)
  - MODIFY GameTicker → "LIVE NOW" bar (only visible during live games)
  - MOVE InsightFeed below game cards
- **Screen-by-Screen Impact**:
  - **Tonight (top to bottom)**: Header → Quick Stats Bar → HeroMatchup → LIVE NOW bar (when live) → All Games Cards → Hot Players Tonight → InsightFeed → Stat of the Night → Standings
  - **Removals**: GameTicker in current form (replaced by LIVE NOW + All Games Cards)
- **Persona Scorecard**:
  - Shark: excited — Full game cards with probability bars, player data surfaced, standings visible. "Now THIS is a terminal."
  - Debater: excited — Stat of the Night is screenshot bait, every game card is shareable. "I can screenshot any card."
  - Homer: excited — 5+ card styles, team color gradients everywhere, hot players feels like SportsCenter. "This app has VIBES."
- **Next Squad**: Blueprint Squad

## 2026-02-03 - The Analytics Engine: Enhanced Stats Overhaul
- **Request**: "The stats that are shown are boring, come up with a list of enhanced and interesting stats for teams and players that can be integrated into the app. Think what would be cool or interesting first, then explore how we can do this in a creative way if an endpoint isn't available. We can also set up Supabase and seed the database with historical data if needed."
- **Context**: The NHL Edge API (puck/player tracking) has 50+ endpoints for shot speed, skating speed, skating distance, zone time, shot location, goalie save %, 5v5 splits, and comparison data — none of which PuckIQ currently uses. Current stats shown are basic (W-L-OTL, total points, generic counters) — ESPN-level data in a Bloomberg Terminal shell.
- **Approved Option**: B - BOLD — "The Analytics Engine"
- **Rationale**: CEO explicitly said current stats are "boring." Option A (just surface Edge API) is too incremental. Option C skips the most visually impressive features (heat maps, rink diagrams). Option B transforms PuckIQ from "app that shows NHL scores with win probabilities" to "the only app that surfaces NHL Edge tracking data with rich visualizations." The Edge API is PuckIQ's competitive moat. Supabase additions are modest (2 tables + nightly seed) and enable derived stats.
- **Key Requirements**:
  - **NHL Edge API Stats (Available Now — just not used)**:
    1. Shot Speed Leaders — speedometer gauge per player, tonight's hardest shots
    2. Fastest Skaters Tonight — race-style horizontal bars with mph
    3. Zone Time Breakdown — % of time in O/N/D zone per team, rink diagram visualization
    4. Shot Location Heat Maps — rink overlay with hot/cold shooting zones per team/player
    5. Goalie Save % by Zone — net diagram showing save % by location (glove high, blocker low, etc.)
  - **Derived/Calculated Stats (Supabase + NHL API)**:
    6. Momentum Index — rolling 5-game trend (goal diff + shot quality), sparkline with trend arrow
    7. Clutch Rating — 1-goal game record, 3rd period scoring, OT record → badge (ICE COLD / CLUTCH / CLOSER)
    8. xG vs Actual Goals — divergence chart ("lucky or good?")
    9. Power Play Trend — 10-game rolling PP% sparkline with hot/cold indicator
    10. Rest/Fatigue Advantage Score — days rest + travel + B2B impact → fatigue gauge
  - **Supabase Additions**:
    - game_edge_stats table (shot speed, skating speed, distance per player per game)
    - team_rolling_stats table (5-game and 10-game rolling averages)
    - Nightly seed to pull Edge data after each game day
- **Screen-by-Screen Impact**:
  - **Tonight Tab**:
    - QuickStatsBar: REPLACE generic counters with dynamic Edge stats ("Fastest Shot: 98mph (Ovi)" / "Hottest Team: +12 Momentum" / "Biggest Mismatch: Fatigue 72%")
    - HeroMatchup: Add momentum sparklines for both teams below probability arc. Add fatigue gauge chips. Add clutch badge if applicable.
    - AllGamesCard: Add momentum arrows (↑↗→↘↓) next to team names. Add rest advantage indicator.
    - HotPlayers: REPLACE total season points with "Last 5 Games" stats + shooting speed + HOT/COLD trend badge based on momentum index.
    - NEW "EDGE INTEL" section: 2-column grid of 4 visual stat cards (shot speed leaderboard, skating speed leaderboard, zone time comparison, shot location mini heat map). Each tappable for full detail.
    - InsightFeed: Upgrade insights to reference Edge data ("McDavid averaging 22.1 mph top speed, 15% faster than league average")
    - StandingsSnapshot: ADD xGF% column and momentum arrow per team. Overperforming teams get "lucky" indicator, underperforming get "unlucky."
  - **Deep Dive Modal**:
    - New "Edge Analytics" tab: Player-by-player shot speed, skating speed, distance, zone time breakdown.
    - Shot location heat maps for both teams on rink diagram.
    - Goalie net diagram showing save % by zone.
    - Momentum chart (5-game rolling) for both teams.
    - xG vs Actual divergence chart.
  - **Explore Tab**:
    - Teams: Add Edge stats to team detail (shot speed avg, skating speed, zone time %). Add momentum trend chart.
    - New "Edge Leaderboards" segment with league-wide top 10s: hardest shots, fastest skaters, most distance, best zone time.
    - Replace basic Factors explainers with live data examples.
  - **Removals/Replacements**:
    - QuickStatsBar: 3 generic counters → 3 dynamic Edge-powered stats
    - HotPlayers: Season points total → Last 5 games rolling stats + speed data
    - StandingsSnapshot: Pure W-L-OTL → adds xGF% and momentum indicators
- **Persona Scorecard**:
  - Shark: excited — "Momentum index, xG divergence, zone time — this is a real analytics platform. Nobody else has Edge data surfaced like this."
  - Debater: excited — "Heat maps, speed gauges, clutch badges — every one is a screenshot moment. Group chat is going to love this."
  - Homer: excited — "Speedometers with team colors, rink heat maps, momentum arrows — this feels like watching a broadcast with telestration graphics."
- **Next Squad**: Blueprint Squad

## 2026-02-06 - The Personal Terminal: Tonight Tab Overhaul
- **Request**: Brainstorm improvements to the Today tab, then build the approved direction.
- **CEO Process**: Full brainstorm with UX audit (layout/interaction/scroll fatigue), PM Persona Gauntlet (Shark/Debater/Homer deep analysis), and CEO strategic synthesis. 9 improvement themes identified, 4 Universal Wins, 4 Cross-Persona Conflicts with resolutions, 3 redundancies, 4 dead interaction bugs.
- **Approved Option**: B - BOLD -- "The Personal Terminal"
- **Rationale**: Option A (Safe: "Clean the House") cleans up but doesn't add value -- all personas neutral. Option C (Scrappy: "Ship the Feel") looks different but leaves architectural debt and Shark underserved. Option B delivers the full vision: cleaner AND smarter. All data pipelines already exist (momentumMap, restMap, h2hMap, selectedTeam, NHL logo CDN) -- this is primarily presentation layer work.
- **Key Requirements**:
  - Dev sample games data (devData/sampleGames.ts + __DEV__ fallback) -- foundation for testing
  - Remove StatOfTheNight (redundant with InsightFeed), StandingsSnapshot (move to Explore), standalone InsightFeed (insights already inline on game cards)
  - Compact header: 36pt title to slim bar (date + model pill + settings), reclaim 60-80pt above-the-fold
  - Tonight's Headline: Auto-generate editorial subtitle from game data ("Divisional Showdown Night")
  - Favorite team personalization: Read selectedTeam from AsyncStorage, show YOUR TEAM card, team color tinting
  - Factor Split on AllGamesCards: MTM/REST/H2H colored dots below probability bar
  - Merge HotPlayers + EdgeIntel into "Edge Spotlight" horizontal scroll (max 5 + "See all")
  - Team logos: 24x24 from NHL CDN on HeroMatchup, AllGamesCards, Edge Spotlight
  - Extract useTonightData() hook + ModelPickerModal to reduce index.tsx from 848 to ~300 lines
  - Richer empty state: favorite team's next game + standings position + fun stat
  - Promote game insights from 11px italic to bold, team-colored text
  - Fix 4 dead interactions (QuickStatsBar, EdgeIntel, HotPlayers, InsightFeed)
- **Screen-by-Screen Impact**:
  - **Tonight (top to bottom)**: Compact Header (with headline) -> YOUR TEAM card (if playing) -> HeroMatchup (with logos) -> LiveNowBar -> AllGames (with logos, factor splits, bold insights) -> Edge Spotlight (merged horizontal scroll)
  - Scroll depth: ~2910pt reduced to ~1600pt (45% reduction)
  - **Removals**: StatOfTheNight, StandingsSnapshot, InsightFeed standalone, oversized header, QuickStatsBar (absorbed into header)
  - **New files**: devData/sampleGames.ts, hooks/useTonightData.ts, components/ModelPickerModal.tsx, components/YourTeamCard.tsx, components/EdgeSpotlight.tsx, components/EmptyNightCard.tsx, utils/headlineGenerator.ts
- **Persona Scorecard**:
  - Shark: excited -- "Factor splits on game cards! I can see disagreement at a glance. Edge Spotlight connects data to tonight."
  - Debater: excited -- "Team logos make screenshots 10x better. Tonight's Headline is an instant conversation starter."
  - Homer: excited -- "MY TEAM is front and center! Logos! The headline makes tonight feel special. Empty state keeps me engaged."
- **Deferred to Cycle 7**: Visual share cards (image generation), time-awareness (pre-game vs live phase), daily continuity ("how did yesterday go?")
- **Next Squad**: Blueprint Squad

## 2026-02-06 - The Opening Shot: Hero Zone + PuckIQ Branding
- **Request**: "The top of the Tonight screen seems cluttered and doesn't capture a user's attention" + "There's no name of the app so the branding sucks"
- **CEO Process**: PM brainstormed 8 hero zone concepts with full Persona Gauntlet scoring. UX audited current top-of-screen layout and proposed 3 visual concept directions. CEO synthesized into Greenlight Menu. Discovery: 8 unused NHL action photos already bundled in `assets/images/topimages/`.
- **Approved Option**: B - BOLD -- "The Opening Shot"
- **Rationale**: Only option where all 3 personas are excited. Uses 8 bundled action photos (zero API dependency). Solves both problems at once: visual clutter (merges header + hero into one immersive zone) AND branding (PuckIQ wordmark prominently placed). No new library dependencies. Fallback to team color gradient if photos fail.
- **Key Requirements**:
  - PuckIQ wordmark (22pt, bold, white) + tagline "YOUR EDGE BEFORE EVERY PICK" at top-left
  - Bundled NHL action photo background with dark gradient overlay (randomly selected per session)
  - Team logos (48x48) flanking VS divider, large probability numbers (32pt)
  - Frosted glass insight chip bar (H2H, rest, streak) at bottom
  - Confidence badge, game time, share button
  - Animated entry: photo fade-in 800ms, content FadeInDown 400ms staggered
  - Settings gear top-right (existing SettingsButton)
  - Tap opens GameDeepDiveModal
  - Replaces current plain text header AND HeroMatchup card
- **Screen-by-Screen Impact**:
  - **Tonight (top to bottom)**: HeroBanner (photo + branding + matchup) -> LIVE NOW bar -> YOUR TEAM card -> More Games -> Standings -> Compact Games -> Edge Spotlight -> Intel Feed
  - Net scroll savings: ~100pt (merges header + hero into one zone)
  - **Removals**: Plain text header block, HeroMatchup card (absorbed into HeroBanner)
  - **New files**: components/HeroBanner.tsx
  - **Modified files**: app/(tabs)/index.tsx
- **Persona Scorecard**:
  - Shark: excited -- "Data overlay on photo is clean. Probability, H2H, confidence at a glance. Branding = serious platform."
  - Debater: excited -- "Cinematic hockey photo with PuckIQ branding and probabilities. Group chat upgrade. People will ask 'what app is that?'"
  - Homer: excited -- "ACTION PHOTOS! NHL.com meets Apple Sports. PuckIQ branding makes it feel REAL. Opening shot of Hockey Night."
- **Next**: Frontend builds HeroBanner.tsx, integrates into index.tsx, UX verifies with screenshots
