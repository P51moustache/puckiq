# Task: Arena team identity foundation

Read docs/design/vision.md and Task 1 of docs/superpowers/plans/2026-09-09-arena-club-native.md for the exact public interface. The user explicitly selected Arena Club and asked to implement it in Expo. This is a multi-file integration task. Work only on constants/arenaTheme.ts, constants/arenaTeamPalettes.json, services/homeTeam.ts, services/teamFavorites.ts, components/arena/ArenaProvider.tsx and their tests. Do not edit app layouts or other screen files; root handles those.

Use the 32 exact palettes in docs/design/arena-team-palettes.json; production must not import documentation. Introduce ARENA_TEAMS, getArenaTeam, getArenaPalette and ArenaPalette/ArenaTeam types. Include a neutral fallback and case-normalized lookups. Home team persists under puckiq_home_team. Unknown or legacy ARI codes cannot be a new home team. Followed-team records remain under the existing key/shape. Preserve existing behavior and tests for teamFavorites.

The provider's chooseHomeTeam accepts a followed active team; selecting an unfollowed team should reject without mutating storage. followTeam(abbrev) validates an active team, follows it using its full name, and chooses it only when no valid home team exists. First/earliest followed-team fallback is deterministic. AddedAt tie uses existing array order. Removing the current home team selects the earliest remaining active favorite. Empty follows use neutral colors.

Use event subscriptions to observe teamFavorites changes made by existing components. Reload on app resume. Guard async hydration against stale results and concurrent mutations. Persist before publishing a successful UI state, and surface failures through returned promises. Hook defaults must permit isolated existing components to render without a provider.

Write focused behavior tests first, run them and then implement. Do not add native dependencies. Do not spawn subagents. Do not commit; root will review and commit the integrated work. Report changed files, exact tests/results, and concerns in .codex/arena-club/task-theme-report.md, and return a short status.
