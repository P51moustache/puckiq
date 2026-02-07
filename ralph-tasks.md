# PuckIQ Transformation - Ralph Loop Tasks (Final Revision)

---

## Production Readiness Standards (Apply to ALL Tasks)

Every task MUST include these production-ready behaviors. If a task doesn't explicitly mention them, the implementer should add them:

### Loading States
- Show skeleton loaders or spinners during async operations
- Use existing `SkeletonLoader.tsx` component pattern
- Disable buttons while operations are in progress

### Error Handling
- Wrap all API calls in try-catch
- Show user-friendly error messages (not raw errors)
- Log errors with descriptive prefixes: `[MODEL_STORAGE]`, `[BACKTEST]`, etc.
- Provide retry option for recoverable errors

### Empty States
- Show helpful message when lists are empty
- Provide action button where appropriate ("Create your first model")
- Use consistent empty state styling

### Confirmation Dialogs
- Confirm before delete operations
- Confirm before discarding unsaved changes
- Show what will be affected

### Input Validation
- Validate all user inputs before saving
- Show inline validation errors
- Prevent saving invalid data

### Cancellation
- Long operations (>2 seconds) must be cancellable
- Show cancel button with confirmation
- Clean up partial state on cancel

### Network Resilience
- Retry failed network requests (3 attempts with exponential backoff)
- Handle offline state gracefully
- Cache data where appropriate

---

## Key Discovery: Existing Prediction System

The codebase already has a sophisticated prediction engine in `utils/predictionUtils.ts`:
- `CONFIDENCE_WEIGHTS` - 9 configurable weight factors
- `calculateConfidenceScore()` - multi-factor scoring with all inputs
- `calculateWinProbabilityEnhanced()` - full probability calculation
- `getLockOfTheDayEnhanced()` / `getSmartPicksEnhanced()` - async prediction functions

Supporting services:
- `services/playerPrediction.ts` - goalie matchups, hot/cold players
- `utils/recentForm.ts` - recency-weighted form calculation
- `utils/situationalFactors.ts` - back-to-back, rest days
- `utils/teamStatsForPrediction.ts` - real NHL PP%, PK%, shots data

**The model builder should let users customize the existing CONFIDENCE_WEIGHTS, not create a parallel system.**

---

## Phase 0: Foundation (Map to Existing System)

### 0.1 Create Model Types
/ralph-loop "Add to types/predictions.ts: PredictionModel interface {id, name, createdAt, updatedAt, weights: ConfidenceWeights, playerWeights: {goalieMatchupImpact, hotPlayersImpact}, isActive, isDefault, backtestResults?}. Add ModelBacktestResults {period: {start, end}, totalGames, correctPicks, accuracy, baselineAccuracy, ranAt}. The weights field uses the EXISTING ConfidenceWeights interface. This ensures models are directly compatible with calculateConfidenceScore(). Output <promise>MODEL_TYPES_COMPLETE</promise> when types compile." --completion-promise "MODEL_TYPES_COMPLETE" --max-iterations 8

### 0.2 Create Model Factor Definitions
/ralph-loop "Create constants/modelFactors.ts that documents each factor from CONFIDENCE_WEIGHTS in utils/predictionUtils.ts. Export FACTOR_DEFINITIONS array with objects: {key (matching ConfidenceWeights key), name, description, category (team|situational|specialTeams|playerBased), defaultValue (from CONFIDENCE_WEIGHTS), min, max, step, higherIsBetter}. Include all 9 factors: standingsDifferential, homeIceAdvantage, streakImpact, goalDifferentialImpact, recentFormImpact, backToBackPenalty, restAdvantage, specialTeamsImpact, shotDifferentialImpact. Plus 2 player factors from PLAYER_WEIGHTS. Output <promise>FACTOR_DEFINITIONS_COMPLETE</promise> when all factors documented." --completion-promise "FACTOR_DEFINITIONS_COMPLETE" --max-iterations 10

### 0.3 Create Model Storage Service
/ralph-loop "Create services/modelStorage.ts. Functions: createDefaultModel() returns PredictionModel with weights copied from CONFIDENCE_WEIGHTS and PLAYER_WEIGHTS in utils/predictionUtils.ts, isDefault:true, name:'PuckIQ Classic'. saveModel(), loadModels(), deleteModel(id), getActiveModel(), setActiveModel(id). Use AsyncStorage key 'puckiq_prediction_models'. On loadModels(), if empty, create and save the Classic model. The Classic model cannot be deleted. Output <promise>MODEL_STORAGE_COMPLETE</promise> when models persist and Classic auto-creates." --completion-promise "MODEL_STORAGE_COMPLETE" --max-iterations 12

---

## Phase 1: Model Engine Integration

### 1.1 Create Model-Aware Prediction Wrapper
/ralph-loop "Create services/modelPrediction.ts that wraps existing prediction functions. Functions: predictWithModel(model, game, standings) calls calculateConfidenceScore() from utils/predictionUtils.ts but passes model.weights instead of CONFIDENCE_WEIGHTS. Also passes playerWeights to the player factors calculation. getLockWithModel(model, games, standings) wraps getLockOfTheDayEnhanced but uses model weights. getSmartPicksWithModel(model, games, standings, count) wraps getSmartPicksEnhanced. Write tests verifying Classic model produces IDENTICAL results to calling original functions. Output <promise>MODEL_PREDICTION_COMPLETE</promise> when wrapper works and tests pass." --completion-promise "MODEL_PREDICTION_COMPLETE" --max-iterations 15

### 1.2 Add Factor Breakdown to Predictions
/ralph-loop "Extend services/modelPrediction.ts to return factor breakdown with predictions. Create PredictionWithBreakdown interface extending EnrichedGame with factorBreakdown: {factorKey, factorName, homeValue, awayValue, impact, favoredTeam}[]. Modify predictWithModel to calculate and return each factor's individual contribution to the score. This shows users WHY a prediction was made. Output <promise>FACTOR_BREAKDOWN_COMPLETE</promise> when predictions include detailed breakdown." --completion-promise "FACTOR_BREAKDOWN_COMPLETE" --max-iterations 12

### 1.3 Integrate Model Predictions into Home Screen
/ralph-loop "Update app/(tabs)/index.tsx to use services/modelPrediction.ts instead of directly calling utils/predictionUtils.ts functions. On load, get active model from modelStorage. Pass to getLockWithModel() and getSmartPicksWithModel(). Add factorBreakdown to game card expansion (collapsible section). Test that with Classic model, predictions are identical to before. Output <promise>HOME_MODEL_INTEGRATION_COMPLETE</promise> when home screen uses model-based predictions." --completion-promise "HOME_MODEL_INTEGRATION_COMPLETE" --max-iterations 15

---

## Phase 2: Model Builder UI

### 2.1 Create Weight Slider Component
/ralph-loop "Create components/model-builder/WeightSlider.tsx. Props: factorKey, label, description, value, min, max, step, onChange. Displays slider with current value, factor name, and info tooltip with description. Use theme colors. Green tint when above default, red when below. Shows 'Default: X' hint. Output <promise>WEIGHT_SLIDER_COMPLETE</promise> when slider works with all factor types." --completion-promise "WEIGHT_SLIDER_COMPLETE" --max-iterations 10

### 2.2 Create Factor Editor Component
/ralph-loop "Create components/model-builder/FactorEditor.tsx. Uses FACTOR_DEFINITIONS from constants/modelFactors.ts. Groups factors by category with collapsible sections. Each factor shows WeightSlider. Props: weights (ConfidenceWeights + playerWeights), onChange. Shows 'Reset to Defaults' button per category and globally. Add weight distribution visualization: pie chart or horizontal stacked bar showing relative weight of each category (use react-native-svg). Output <promise>FACTOR_EDITOR_COMPLETE</promise> when all factors editable by category with weight distribution chart." --completion-promise "FACTOR_EDITOR_COMPLETE" --max-iterations 12

### 2.3 Create Live Preview Component
/ralph-loop "Create components/model-builder/LivePreview.tsx. Props: weights (current editor state), shows predictions for today's games using predictWithModel() with a temporary model object. Each game shows: teams, probability, confidence tier, mini breakdown (top 3 factors). 'vs Classic' toggle showing side-by-side comparison. Debounce updates to avoid excessive API calls. Output <promise>LIVE_PREVIEW_COMPLETE</promise> when preview shows live predictions as weights change." --completion-promise "LIVE_PREVIEW_COMPLETE" --max-iterations 15

### 2.4 Create Model List Component
/ralph-loop "Create components/model-builder/ModelList.tsx. Loads models from modelStorage.loadModels(). Each card shows: name, active indicator, accuracy (if backtested), 'Classic' badge if isDefault. Actions: Activate, Edit, Duplicate, Delete (disabled for Classic). Pull-to-refresh. FAB button for 'New Model'. Output <promise>MODEL_LIST_COMPLETE</promise> when list shows all models with actions working." --completion-promise "MODEL_LIST_COMPLETE" --max-iterations 12

### 2.5 Create Model Edit Screen
/ralph-loop "Create components/model-builder/ModelEditScreen.tsx (modal or separate screen). Shows: name input, FactorEditor, LivePreview (collapsible on mobile). Save button validates name not empty, calls modelStorage.saveModel(). Cancel discards changes. For new models, copy Classic weights as starting point. Output <promise>MODEL_EDIT_COMPLETE</promise> when full edit flow works." --completion-promise "MODEL_EDIT_COMPLETE" --max-iterations 15

### 2.6 Create Models Tab
/ralph-loop "Create app/(tabs)/models.tsx. Shows ModelList. When editing/creating, shows ModelEditScreen. Update app/(tabs)/_layout.tsx to add Models tab with sliders icon. Restructure tab order to: Today, Explore, Models, Profile (4 tabs total - consider merging Picks functionality into Today or Profile if currently separate). Track analytics: screen_view, model_created, model_edited. Output <promise>MODELS_TAB_COMPLETE</promise> when Models tab is accessible with clean 4-tab structure." --completion-promise "MODELS_TAB_COMPLETE" --max-iterations 12

### 2.7 Add Model Preset Templates
/ralph-loop "Add to services/modelStorage.ts: MODEL_PRESETS constant array with 3 preset configurations. 'Goalie Focus': high goalie-related weights (increase goalieMatchupImpact to 25, others proportionally lower). 'Recent Form': high recentFormImpact (30), streakImpact (20), lower static factors. 'Advanced Stats': high specialTeamsImpact (25), shotDifferentialImpact (20), goalDifferentialImpact (15). Each preset is {id, name, description, weights}. Update ModelEditScreen: when creating new model, show 'Start from:' picker with options: 'Blank', 'PuckIQ Classic', and all MODEL_PRESETS. Selected preset populates initial weights. Output <promise>MODEL_PRESETS_COMPLETE</promise> when presets selectable and populate weights correctly." --completion-promise "MODEL_PRESETS_COMPLETE" --max-iterations 12

---

## Phase 3: Historical Data for Backtesting

### 3.1 Create Historical Games Service
/ralph-loop "Create services/historicalGames.ts. Store game results in AsyncStorage (key: puckiq_historical_games_{season}). Schema: {games: [{id, date, homeTeam, awayTeam, homeScore, awayScore, winner, homeGoalie?, awayGoalie?}]}. Include starting goalies when available from game data. Functions: seedSeason(seasonId) fetches all dates from Oct 1 to today using /v1/score/{date} API (same pattern as utils/recentForm.ts). getGamesInRange(start, end) queries stored games. isSeasonSeeded(seasonId). Compress JSON to save space. Output <promise>HISTORICAL_GAMES_COMPLETE</promise> when 2024-25 season can be seeded and queried." --completion-promise "HISTORICAL_GAMES_COMPLETE" --max-iterations 18

### 3.2 Create Seeding UI
/ralph-loop "Create components/DataSeedingModal.tsx shown when user first tries to backtest and data isn't seeded. Shows progress: current date, games loaded, estimated time. 'Seed Data' button starts process, 'Skip' closes modal. Store seeding_complete_{season} flag. Add to Models tab - show banner if not seeded prompting user to seed for backtesting. Output <promise>SEEDING_UI_COMPLETE</promise> when seeding modal works with progress display." --completion-promise "SEEDING_UI_COMPLETE" --max-iterations 12

### 3.3 Create Backtest Engine
/ralph-loop "Create services/backtesting.ts. runBacktest(model, dateRange): for each historical game, reconstruct standings AS OF that date (fetch /v1/standings/{date}), run predictWithModel(), compare to actual winner. Track: correctPicks, totalGames. Calculate baseline using Classic model for same games. Return: {accuracy, baselineAccuracy, totalGames, improvement, results[]}. Add progress callback. Cache standings fetches in AsyncStorage (key: puckiq_standings_cache_{date}). Cache backtest results (key: puckiq_backtest_cache). Performance target: 1000+ games should complete in <10 seconds using cached data. Output <promise>BACKTEST_ENGINE_COMPLETE</promise> when backtests produce accurate results and meet performance target." --completion-promise "BACKTEST_ENGINE_COMPLETE" --max-iterations 20

### 3.4 Create Backtest UI
/ralph-loop "Create components/model-builder/BacktestPanel.tsx. Date range selector: 'Last 30 days', 'Last 3 months', '2024-25 Season'. 'Run Backtest' button (disabled if not seeded, shows seed prompt). Results display: games tested, your model accuracy %, Classic accuracy %, difference with +/- color. 'Save Results' updates model.backtestResults. Add to ModelEditScreen below LivePreview. Output <promise>BACKTEST_UI_COMPLETE</promise> when users can run and view backtest results." --completion-promise "BACKTEST_UI_COMPLETE" --max-iterations 15

---

## Phase 4: Enhanced UI Integration

### 4.1 Add Model Indicator to Lock Card
/ralph-loop "Update components/LockOfTheDayCard.tsx to show which model generated the pick. If not Classic, show model name badge. Add expandable factor breakdown section showing top 5 factors. If prediction differs from Classic, show 'Classic would pick: X' note. Output <promise>LOTD_MODEL_INDICATOR_COMPLETE</promise> when Lock card shows model info." --completion-promise "LOTD_MODEL_INDICATOR_COMPLETE" --max-iterations 10

### 4.2 Add Model Switcher to Home
/ralph-loop "Add model quick-switcher to app/(tabs)/index.tsx header area. Small pill/dropdown showing active model name. Tap to see list of models, tap to switch. On switch: update via modelStorage.setActiveModel(), refresh predictions. Show brief toast on switch. Output <promise>HOME_MODEL_SWITCHER_COMPLETE</promise> when users can switch models from home screen." --completion-promise "HOME_MODEL_SWITCHER_COMPLETE" --max-iterations 12

### 4.3 Track Picks by Model
/ralph-loop "Update services/pickTracking.ts: add modelId field to Pick interface. Update saveLockOfTheDay, saveSmartPicks to accept and store modelId from active model. Add getPickStatsByModel(modelId) to filter stats. Backward compatible: existing picks without modelId treated as Classic. Output <promise>PICK_MODEL_TRACKING_COMPLETE</promise> when picks track which model made them." --completion-promise "PICK_MODEL_TRACKING_COMPLETE" --max-iterations 10

### 4.4 Per-Model Accuracy Display
/ralph-loop "Create components/ModelAccuracyCard.tsx showing real-world accuracy for each model. Uses getPickStatsByModel(). Shows: model name, picks made, wins, losses, accuracy %. Add to Models tab showing accuracy for each model (if has picks). Add to ModelList cards. Output <promise>MODEL_ACCURACY_DISPLAY_COMPLETE</promise> when users see real accuracy per model." --completion-promise "MODEL_ACCURACY_DISPLAY_COMPLETE" --max-iterations 12

### 4.5 Historical Accuracy Charts
/ralph-loop "Create components/ModelAccuracyChart.tsx showing accuracy over time for each model. Use react-native-svg or victory-native for line chart. X-axis: dates, Y-axis: rolling 7-day accuracy %. Show multiple models on same chart with different colors. Add model leaderboard section ranking models by accuracy (minimum 10 picks to qualify). Add to Models tab below ModelList. Output <promise>ACCURACY_CHARTS_COMPLETE</promise> when charts display historical accuracy trends and model rankings." --completion-promise "ACCURACY_CHARTS_COMPLETE" --max-iterations 15

---

## Phase 5: Data Explorer Enhancement

### 5.1 Add Goalies Tab to Explore
/ralph-loop "Update app/(tabs)/explore.tsx to add 'Goalies' as third tab. Create goalie leaderboard content fetching from /v1/goalie-stats-leaders/current (skater-stats-leaders pattern but for goalies). Show top goalies by: Wins, Save%, GAA, Shutouts. Tap goalie for detail card with season stats. Output <promise>GOALIES_EXPLORE_TAB_COMPLETE</promise> when Goalies tab shows real data." --completion-promise "GOALIES_EXPLORE_TAB_COMPLETE" --max-iterations 15

### 5.2 Add Edge Stats Tab to Explore
/ralph-loop "Update app/(tabs)/explore.tsx to add 'Edge' as fourth tab. Fetch from /v1/edge/skater-speed-top-10, /v1/edge/skater-shot-speed-top-10, /v1/edge/team-skating-distance-top-10 per api_description.wadl. Show leaderboards: Fastest Skaters (skating speed), Hardest Shots (shot speed), Team Distance. Brief explanation of each metric. Add 'This stat predicts...' insight text under each leaderboard explaining correlation to winning. Output <promise>EDGE_EXPLORE_TAB_COMPLETE</promise> when Edge tab shows NHL tracking data with insights." --completion-promise "EDGE_EXPLORE_TAB_COMPLETE" --max-iterations 15

### 5.3 Add Player Search & Profiles
/ralph-loop "Add 'Players' tab to app/(tabs)/explore.tsx as fifth tab. Create components/explore/PlayerSearch.tsx with text input searching /v1/player-search/{query} endpoint. Create components/explore/PlayerProfile.tsx modal showing: header with photo (use NHL headshot URL pattern), name, team, position. Season stats card with key metrics. Recent 5 games from /v1/player/{id}/game-log/now. If available, edge stats from /v1/edge/skater-detail/{id}/now. Trend chart: mini line graph showing points/goals over last 10 games using react-native-svg (hot=green uptrend, cold=red downtrend). Use existing theme colors and Card component. Output <promise>PLAYER_PROFILES_COMPLETE</promise> when player search returns results and profiles display full data with trend charts." --completion-promise "PLAYER_PROFILES_COMPLETE" --max-iterations 18

### 5.4 Enhance Team Comparison with Visualizations
/ralph-loop "Enhance team comparison in app/(tabs)/explore.tsx. Add radar chart using react-native-svg showing 6 axes: Points%, PP%, PK%, Goals/Game, Goals Against/Game, Shot%. Add H2H section: fetch last 5 matchups between selected teams using /v1/score/{date} for recent dates, display as mini game cards with scores. Add 'Model Factors' section showing how selected teams compare on each CONFIDENCE_WEIGHTS factor. Output <promise>TEAM_COMPARISON_ENHANCED</promise> when radar chart renders and H2H games display." --completion-promise "TEAM_COMPARISON_ENHANCED" --max-iterations 15

### 5.5 Stats Browser with Model Integration
/ralph-loop "Create components/explore/StatsBrowser.tsx accessible from Explore tab header. Shows browsable list of all available stats organized by category: Team Stats, Player Stats, Goalie Stats, Situational, Edge. Each stat card shows: name, description, league average, top 3 leaders, mini distribution chart (histogram or bell curve showing league distribution using react-native-svg). Add 'Use in Model' button on each stat that navigates to Models tab with that factor highlighted. Store stat definitions in constants/statDefinitions.ts. Output <promise>STATS_BROWSER_COMPLETE</promise> when stats browsable with distribution charts and 'Use in Model' navigation works." --completion-promise "STATS_BROWSER_COMPLETE" --max-iterations 15

---

## Phase 6: Polish & Analytics

### 6.1 Model Builder Analytics
/ralph-loop "Add analytics events using existing AnalyticsService pattern: model_created (factor_count, based_on), model_edited (factors_changed[]), model_deleted, model_activated, backtest_started (date_range), backtest_completed (accuracy, baseline, improvement), model_shared. Output <promise>MODEL_ANALYTICS_COMPLETE</promise> when all model interactions are tracked." --completion-promise "MODEL_ANALYTICS_COMPLETE" --max-iterations 10

### 6.2 Model Sharing via Code
/ralph-loop "Add to services/modelStorage.ts: exportModelCode(model) returns base64-encoded JSON of weights only (not id/dates). importModelFromCode(code, name) creates new model with those weights. Add 'Share' button to ModelEditScreen that copies code to clipboard. Add 'Import' button to ModelList that prompts for code. Output <promise>MODEL_SHARING_COMPLETE</promise> when models shareable via codes." --completion-promise "MODEL_SHARING_COMPLETE" --max-iterations 12

### 6.3 Model Builder Onboarding
/ralph-loop "Create components/model-builder/OnboardingTour.tsx - 4-step tooltip tour on first Models tab visit. Steps: 1) 'Your models' pointing at list, 2) 'Customize factors' pointing at editor, 3) 'Preview predictions' pointing at preview, 4) 'Test with backtesting' pointing at backtest. Store tour_complete flag. Skip button. Output <promise>ONBOARDING_COMPLETE</promise> when tour shows on first visit." --completion-promise "ONBOARDING_COMPLETE" --max-iterations 10

---

## Phase 7: Production Hardening

### 7.1 Add Global Error Boundary
/ralph-loop "Create components/ErrorBoundary.tsx wrapping the app. Catches unhandled errors, shows friendly 'Something went wrong' screen with 'Try Again' button. Log errors to AnalyticsService with stack trace. Add specific error boundaries around: ModelEditScreen, BacktestPanel, LivePreview. Each shows contextual error message and recovery action. Output <promise>ERROR_BOUNDARIES_COMPLETE</promise> when errors are caught gracefully and logged." --completion-promise "ERROR_BOUNDARIES_COMPLETE" --max-iterations 10

### 7.2 Add Network Status Handling
/ralph-loop "Create hooks/useNetworkStatus.ts using @react-native-community/netinfo. Show banner when offline: 'You're offline - some features unavailable'. Disable: Live Preview, Backtest (if not seeded), Explorer API tabs. Keep working: Model editing (local), viewing cached data. Add to services/modelPrediction.ts: queue predictions when offline, sync when back online. Output <promise>NETWORK_HANDLING_COMPLETE</promise> when app gracefully handles offline state." --completion-promise "NETWORK_HANDLING_COMPLETE" --max-iterations 12

### 7.3 Add Confirmation Dialogs
/ralph-loop "Create components/ConfirmDialog.tsx reusable component. Add to: ModelList delete action ('Delete model? This cannot be undone.'), ModelEditScreen cancel with unsaved changes ('Discard changes?'), Clear backtest cache in settings. All dialogs have Cancel/Confirm buttons with destructive action in red. Output <promise>CONFIRM_DIALOGS_COMPLETE</promise> when all destructive actions require confirmation." --completion-promise "CONFIRM_DIALOGS_COMPLETE" --max-iterations 10

### 7.4 Add Retry Logic to API Calls
/ralph-loop "Create utils/apiRetry.ts with fetchWithRetry(url, options, maxRetries=3). Implements exponential backoff (1s, 2s, 4s delays). Returns last error if all retries fail. Update: historicalGames.ts seedSeason(), backtesting.ts standings fetches, explore.tsx API calls. Add progress indicator showing retry attempt. Output <promise>RETRY_LOGIC_COMPLETE</promise> when API calls retry on failure with user feedback." --completion-promise "RETRY_LOGIC_COMPLETE" --max-iterations 12

### 7.5 Add Cancellation to Long Operations
/ralph-loop "Update DataSeedingModal.tsx: add Cancel button, use AbortController to cancel fetch requests, save progress so seeding can resume. Update BacktestPanel.tsx: add Cancel button during backtest, abort and show partial results. Both show 'Are you sure?' confirmation before canceling. Output <promise>CANCELLATION_COMPLETE</promise> when long operations are cancellable with resume capability." --completion-promise "CANCELLATION_COMPLETE" --max-iterations 12

### 7.6 Add Empty States
/ralph-loop "Create components/EmptyState.tsx with props: icon, title, description, actionLabel, onAction. Add to: ModelList ('No custom models yet' + 'Create Model' button), ModelAccuracyChart ('Not enough data' when <10 picks), LivePreview ('No games today'), PlayerSearch ('No players found'), BacktestPanel ('Seed data first' when not seeded). Use consistent styling matching theme. Output <promise>EMPTY_STATES_COMPLETE</promise> when all lists/views have helpful empty states." --completion-promise "EMPTY_STATES_COMPLETE" --max-iterations 12

### 7.7 Add Data Migration Support
/ralph-loop "Create services/dataMigration.ts. Store schema version in AsyncStorage (puckiq_schema_version). On app start, check version and run migrations if needed. Migrations: v1→v2 example (add modelId to existing picks as 'classic'). Add migrateModels(), migratePicks(), migrateHistoricalData() functions. Log migration success/failure. Output <promise>DATA_MIGRATION_COMPLETE</promise> when migration system works and existing data is preserved on updates." --completion-promise "DATA_MIGRATION_COMPLETE" --max-iterations 12

### 7.8 Add Comprehensive Loading States
/ralph-loop "Audit all screens and add missing loading states. ModelList: skeleton cards while loading. ModelEditScreen: skeleton for LivePreview section. BacktestPanel: progress bar with percentage during backtest. Explorer tabs: skeleton loaders for leaderboards. Profile accuracy charts: skeleton while calculating. Use existing SkeletonLoader.tsx pattern. All async operations show loading indicator. Output <promise>LOADING_STATES_COMPLETE</promise> when no screen shows blank/jumpy content during loading." --completion-promise "LOADING_STATES_COMPLETE" --max-iterations 15

---

## Execution Order

**Foundation (must be sequential):**
1. 0.1 Model Types
2. 0.2 Factor Definitions
3. 0.3 Model Storage

**Engine (sequential, depends on 0.x):**
4. 1.1 Model Prediction Wrapper
5. 1.2 Factor Breakdown
6. 1.3 Home Integration

**UI (sequential, depends on 1.x):**
7. 2.1 Weight Slider
8. 2.2 Factor Editor (with weight distribution chart)
9. 2.3 Live Preview
10. 2.4 Model List
11. 2.5 Model Edit Screen
12. 2.6 Models Tab (with 4-tab restructure)
13. 2.7 Model Presets (after 2.5, enhances edit screen)

**Backtesting (can start after 1.1):**
14. 3.1 Historical Games Service (with goalie data)
15. 3.2 Seeding UI
16. 3.3 Backtest Engine (with caching, <10s performance)
17. 3.4 Backtest UI

**Enhanced UI (after 2.6):**
18. 4.1 Lock Card Model Indicator
19. 4.2 Home Model Switcher
20. 4.3 Pick Model Tracking
21. 4.4 Per-Model Accuracy
22. 4.5 Historical Accuracy Charts & Model Leaderboard

**Explorer (independent, can run in parallel with Phases 3-4):**
23. 5.1 Goalies Tab
24. 5.2 Edge Stats Tab (with insights)
25. 5.3 Player Search & Profiles (with trend charts)
26. 5.4 Team Comparison Enhancements (radar chart, H2H)
27. 5.5 Stats Browser (with distribution charts, Model Integration)

**Polish (after core complete):**
28. 6.1 Model Analytics
29. 6.2 Model Sharing
30. 6.3 Model Builder Onboarding

**Production Hardening (after features complete, before release):**
31. 7.1 Global Error Boundary
32. 7.2 Network Status Handling
33. 7.3 Confirmation Dialogs
34. 7.4 Retry Logic for API Calls
35. 7.5 Cancellation for Long Operations
36. 7.6 Empty States
37. 7.7 Data Migration Support
38. 7.8 Comprehensive Loading States

**Total: 38 tasks**

---

## Parallel Execution Opportunities

Tasks that can run concurrently to speed up development:

**Parallel Group A (after Phase 1 complete):**
- Phase 2 (Model Builder UI) - sequential within
- Phase 3 (Historical Data) - sequential within
- Phase 5.1-5.2 (Goalies, Edge tabs) - independent

**Parallel Group B (after Phase 2 complete):**
- Phase 4.1-4.4 (Enhanced UI Integration)
- Phase 5.3-5.5 (Player Profiles, Team Comparison, Stats Browser)

**Parallel Group C (after Phase 4.4 complete):**
- Task 4.5 (Accuracy Charts) - depends on 4.4 data
- All Phase 6 tasks can run in parallel

**Parallel Group D (Phase 7 - all can run in parallel):**
- 7.1, 7.3, 7.6 can start immediately after features complete
- 7.2, 7.4, 7.5 require specific feature code to exist
- 7.7 should run early to establish migration patterns
- 7.8 is a final audit task, run last

---

## Critical Implementation Notes

1. **Use existing CONFIDENCE_WEIGHTS** - models customize these values, don't create parallel system
2. **Classic model = current behavior** - must produce IDENTICAL predictions
3. **Factor breakdown** - show users exactly why predictions are made
4. **Backward compatible** - existing picks work, old code paths still function
5. **Backtest baseline** - always compare to Classic model, not arbitrary baseline
6. **Test thoroughly** - Classic model MUST match existing `getLockOfTheDayEnhanced()` output
7. **Follow Production Standards** - every task must implement loading, error, and empty states per the standards section above
8. **Write tests for critical paths** - Model prediction, backtest engine, and pick tracking require unit tests
