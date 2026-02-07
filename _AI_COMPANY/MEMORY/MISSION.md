# PUCK-IQ Mission

## What We're Building
PuckIQ is a free NHL analytics terminal — the insider's command center you open before acting on Kalshi, Sleeper, or any prediction platform. We deliver cinematic, data-driven game analysis with real depth: probability arcs, head-to-head season series, key player stats, custom prediction models, and shareable analytical nuggets.

## Tagline
**Your Edge Before Every Pick**

## Target User
People who use prediction markets and fantasy platforms for hockey. They want real data — not just "trust me" picks. They want to see the math, compare models, and share their edge. PuckIQ is the analytics terminal that gives them confidence before they commit anywhere else.

## Core Value Props
1. **Full Analytics Terminal** — Tonight screen with 8+ content zones: QuickStatsBar, HeroMatchup, LiveNowBar, AllGamesCards, HotPlayers, InsightFeed, StatOfTheNight, StandingsSnapshot
2. **Probability Arc** — Animated SVG gauge showing win probabilities with team color energy
3. **Season Series & H2H Data** — Supabase-powered historical matchup records on every game card
4. **Intel Feed** — Shareable analytical nuggets (streaks, H2H edges, player highlights, standings insights)
5. **Custom Models** — Build and backtest your own prediction models with adjustable factor weights
6. **Deep Dive** — One tap from any game card opens full analysis modal
7. **Hot Players** — Real-time player highlights for teams playing tonight with HOT badges
8. **Live Scores** — Pulsing live score bar for games in progress

## Positioning
PuckIQ is NOT a betting app and NOT a prediction market. It's the free analytics terminal that makes you smarter before you pick. Think of it as the research layer that sits between you and wherever you make your predictions.

**Competitors we complement (not compete with):**
- Kalshi (NHL prediction markets)
- Sleeper (fantasy + markets)
- DraftKings / FanDuel (DFS + markets)

**Competitors we replace:**
- Manual stat research (NHL.com, hockey-reference)
- Paid AI prediction tools ($30+/mo like Rithmm)
- Generic sports prediction apps with no hockey depth

## Design Philosophy
- Dark mode, premium feel (think Bloomberg Terminal meets Apple Sports)
- Cinematic — team color gradients, animated probability arcs, energy and motion
- Data-dense but not overwhelming — every number has context
- Every element leads to depth — tap anything for the full breakdown
- Mobile-first, works on web

## Business Constraints
- Zero budget: free-tier everything (Supabase, Firebase, NHL API)
- No gambling features or explicit betting language
- NHL API is unofficial — no guaranteed uptime or SLA
- Solo developer — scope must stay manageable

## Brand Voice
- **Confident, not cocky.** We show the edge and the math behind it.
- **Terminal, not spreadsheet.** Cinematic visuals with analytical substance.
- **Companion, not competitor.** We help you make better picks wherever you pick.
- **Transparent.** Every prediction shows its factor breakdown. No black boxes.
- **Concise.** If it takes a paragraph, it should be a chart.

## Emotional Promise
After using PuckIQ, the user should feel: **prepared and confident before making any pick**. The app should feel like an insider's analytics terminal — cinematic and energetic, showing you the edge before anyone else sees it.

## Anti-Patterns (Never Ship)
- Spreadsheet energy — walls of numbers with no hierarchy or opinion
- "Just scores" — if ESPN already shows it better, don't duplicate it
- Explicit betting/gambling language — we say "edge" and "confidence", not "odds" and "locks"
- Black box predictions — every analysis must show why
- Feature bloat — if it doesn't sharpen the user's edge, cut it
- Pick-centric language — we say "analysis" and "intel", not "picks" and "lock it in"

## Current Version: 6.0.0
- 2 tabs: Tonight, Explore
- Tonight: Streamlined personal analytics terminal (Cycle 6 overhaul)
  - Compact header (date + auto-generated editorial headline + model picker pill + settings gear)
  - YourTeamCard (favorite team personalization with team color gradient, logo, probability — shows when team is playing)
  - HeroMatchup (cinematic top-edge game with team logos, team color gradients + probability arc + MomentumSparkline + ClutchBadge)
  - LiveNowBar (pulsing red live score bar for in-progress games)
  - AllGamesCards (full-width game cards with team logos, probability bars, factor split indicators, H2H, bold team-colored insights, momentum arrows, rest icons)
  - EdgeSpotlight (merged horizontal scroll of tonight's hot players + Edge leaders with team logos)
  - EmptyNightCard (enhanced empty state with favorite team standings, next game, fun stat)
  - ModelPickerModal + Toast for model switching
- Explore: Teams, Players, Edge, Factors, Models — 5 segments
- Prediction engine with custom model support
- NHL Edge IQ API integration (shot speed, skating speed, zone time, shot location)
- Derived stats: Momentum Index (-10..+10), Clutch Rating (CLUTCH/CLOSER/ICE COLD), Rest Advantage (0-100), xG Approximation
- Tonight's Headline auto-generator (rivalry, division, streak, rest, momentum themes)
- Team logos via NHL CDN (SVG, 24x24)
- useTonightData hook (566 lines) — all Tonight screen data fetching, state, predictions extracted from index.tsx
- Supabase game results with H2H season series
- Key player stats via NHL API (in-memory cached)
- Deep-dive modal with Overview, Recent Form, H2H, Key Players, Edge IQ, Schedule tabs
- 6 analytics components: SpeedGauge, MomentumSparkline, ClutchBadge, ZoneTimeChart, ShotLocationMap, EdgeIntelSection
- Dev sample games data for offline development (devData/sampleGames.ts)
- Firebase analytics
- Supabase auth
