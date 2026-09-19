# AGENTS.md

## What this is

**PuckIQ** is an NHL analytics app for hockey fans who want an edge before puck drop: model-backed
win probabilities per game, goalie-confirmed and injury push alerts, a morning start/sit brief,
team/standings pages, and player leaders. It targets **both iOS and Android** from one Expo codebase
(Expo 54, React Native 0.81, expo-router, TypeScript strict) with committed native projects and EAS
build profiles for each. `README.md` says it is published on the Apple App Store; it covers the
feature list, and this file covers what you cannot infer from the tree.

**The directory name is wrong and you must not "fix" it.** The folder is `learning-project`, and so
are `package.json` `name`, the Expo `slug`, the URL scheme (`learningproject`), and the referral deep
link prefix (`exp+learning-project://` in `services/referrals.ts`). Only `app.config.js` `name` says
`PuckIQ`. The slug is bound to the EAS project (`extra.eas.projectId`) and the scheme is bound to
links already shipped in the store build. Renaming either breaks EAS builds and live deep links.

Related trap: `package.json` says `version: 2.2.0`, `app.config.js` says `version: "3.0.0"`. They
have drifted. EAS `production` uses `appVersionSource: "remote"`, so the store version comes from
EAS, not from either file. Don't "reconcile" them without asking.

## Commands

```bash
npm install
npm start          # EXPO_UNSTABLE_MCP_SERVER=1 expo start --ios  (iOS only, see below)
npm run ios        # expo run:ios      — native build, not the JS dev server
npm run android    # expo run:android  — native build, not the JS dev server
npx tsc --noEmit   # typecheck (~45s cold)
npm run lint       # expo lint
npm test           # jest
```

**To verify a change, run `npx tsc --noEmit && npm test`.** Both are green on
`fix/ci-tests-cleanup-2026-06` as of 2026-09-09:

```
$ npx tsc --noEmit
(no output, exit 0)

$ npm test
Test Suites: 103 passed, 103 total
Tests:       1 skipped, 1660 passed, 1661 total
Time:        10.643 s
```

Two verification commands are **expected to fail** and are not a regression you caused:

- `npm run test:coverage` fails the global thresholds in `jest.config.js` (70/60/70/70). Actual is
  `44.41%` statements, `36.13%` branches, `37.07%` functions, `44.56%` lines — all 103 suites pass,
  the thresholds just aren't met. `npm run test:all` (`lint && test:coverage`) therefore also fails.
  Use plain `npm test` as the gate unless you are deliberately raising coverage.
- `npm run lint` exits 0 but prints **96 warnings, 0 errors** (mostly `no-require-imports` in test
  files and `react-hooks/exhaustive-deps`). Warnings are the existing baseline; don't mass-fix them
  as a side quest, but don't add new ones either.

`npm start` is iOS-only and sets `EXPO_UNSTABLE_MCP_SERVER=1` — Expo's experimental MCP-server flag,
paired with the `expo-mcp` devDependency. It is deliberate, not a stray env var. If you want a plain
dev server, or Android/web, run `npx expo start` directly instead of the npm script.

## Architecture

`app/` is expo-router with typed routes (`experiments.typedRoutes`). Only **four** tabs are visible —
`index`, `players`, `stats`, `hub`. `myteam`, `models`, and `teams` are real routes registered with
`href: null` in `app/(tabs)/_layout.tsx`, so they exist and are navigable but have no tab button.
If a screen seems "missing" from the UI, check there before adding one.

**There are two independent prediction systems.** Confusing them is the easiest way to break this app.

1. **Client-side weighted model** (runs on device, user-tunable).
   `utils/predictionUtils.ts` holds the `CONFIDENCE_WEIGHTS` / `PLAYER_WEIGHTS` defaults.
   `services/modelPrediction.ts` is the engine: it scores a game from a base of 50 across 11 factors
   (standings, home ice, streak, goal diff, recent form, back-to-back, rest, special teams, shot diff,
   goalie matchup, hot players), clamps to 0–100, and `calculateFactorBreakdown()` produces the
   per-factor "why" shown in the UI. Inputs come from `utils/recentForm.ts`,
   `utils/situationalFactors.ts`, `utils/teamStatsForPrediction.ts`, and `services/playerPrediction.ts`.
   Saved models live in AsyncStorage under `puckiq_prediction_models` via `services/modelStorage.ts`
   (which enforces "exactly one active model" and "Classic can't be deleted"). `components/model-builder/`
   is the editor; `services/backtesting.ts` replays models over historical `games` rows;
   `utils/weightCalibration.ts` suggests weight changes from tracked pick outcomes and refuses to
   suggest anything under 20 completed picks.

2. **Server-side ML** (runs in CI, read-only in the app).
   Python lives in `ml/` (`ml/models/`, `ml/pipeline/daily_run.py`, `weekly_retrain.py`,
   `monthly_eval.py`) and is driven by the `ml-daily` / `ml-weekly` / `ml-monthly` GitHub Actions.
   It writes to Supabase `ml_predictions`, `ml_model_metadata`, `ml_player_projections`. The app only
   reads, via `services/mlPredictions.ts` and `hooks/useMLPredictions.ts`. It appears in the model
   picker as `ml_lightgbm_v1` / "PuckIQ AI", a **synthetic entry injected at runtime and never
   persisted**, whose `weights` are placeholders that are not used for anything.

`services/` owns all data access and domain logic — nothing in `app/` or `components/` should call
Supabase directly. `hooks/` wraps services for screens (`useDashboardData`, `useTonightData`,
`useMyTeamData`, `useAuth`, `useAnalytics`). `utils/` is pure computation. `constants/` holds theme,
team colors, glossary, and factor metadata.

**Data flow.** The app reads **exclusively from Supabase at runtime** and never calls the NHL API
directly. NHL data is loaded by the Node scripts in `scripts/sync/*.mjs` (service-role key), run on a
schedule by the `nhl-data-sync` workflow or locally via `npm run sync*` / `npm run seed:*`. Schema
lives in `supabase/migrations/`.

**Push notifications** are three Supabase Edge Functions in `supabase/functions/` —
`goalie-confirmed`, `injury-alert`, `morning-brief`. These are **Deno**, and `tsconfig.json`
explicitly excludes `supabase/` and `supabase/functions`, so `npx tsc --noEmit` does **not** check
them. A green typecheck says nothing about the edge functions.

**Local state** is AsyncStorage under `puckiq_*` keys (`puckiq_daily_picks`, `puckiq_favorite_teams`,
`puckiq_prediction_models`, `puckiq_watchlist`, `puckiq_fantasy_roster`, `puckiq_notification_settings`,
and others). On first login `services/userSync.ts` does a **one-time** migration of three of those keys
into the Supabase `user_data` table and records completion in `puckiq_user_sync_completed`; it will not
re-run for that user. There is no continuous two-way sync — don't assume writes propagate to Supabase.

Note both `puckiq_dashboard_modules` and `puckiq_dashboard_modules_v2` exist in
`services/dashboardModules.ts`: `_v2` is `STORAGE_KEY` (live), the unsuffixed one is `LEGACY_KEY`.

## Config and secrets

Supabase credentials are **plain environment variables in a gitignored `.env`**, read as
`process.env.EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `lib/supabase.ts` and
inlined by Expo at bundle time. They are **not** in `app.config.js` `extra` and not wired through EAS
secrets in `eas.json` — so an EAS build needs them provided in the build environment. `.env.example`
documents the shape; copy it, never commit a filled `.env`, and never paste a key value into a file,
a commit, or a chat.

Other env vars in use: `SUPABASE_SERVICE_ROLE_KEY` (Node sync/seed scripts only — never the app),
`EXPO_PUBLIC_FIREBASE_*` (`lib/firebase.ts`, analytics), `EXPO_PUBLIC_REVENUECAT_IOS_KEY` /
`_ANDROID_KEY` (`services/subscription.ts`), `EXPO_PUBLIC_SCHEME` and `EXPO_PUBLIC_DEV_EMAILS`
(`components/auth/AuthProvider.tsx`). A signed-in email on the `EXPO_PUBLIC_DEV_EMAILS` list sets
`isDeveloper`, and `hasFullAccess` is currently just `isDeveloper` — so that list bypasses every
feature gate. It defaults to `dev@puckiq.test` when unset; keep real addresses out of production builds.

`lib/supabase.ts` **throws at import time** if the URL or anon key is missing. A missing `.env`
presents as an immediate crash on app launch, not as a failed network call.

## Gotchas

- **This is a bare (prebuild) workflow, not managed.** `android/` (48 tracked files) and `ios/`
  (20 tracked files) are committed. Editing `app.config.js` plugins, permissions, icons, `infoPlist`,
  or the bundle identifier changes **nothing** on device until `npx expo prebuild` regenerates the
  native projects — and prebuild can overwrite hand edits already made inside `android/` and `ios/`.
  Check whether a native change belongs in the config or in the native project before touching either.
- **Jest does not use `jest-expo`,** even though it is installed. `jest.config.js` runs `ts-jest` with
  `testEnvironment: 'node'`, and `jest.setup.js` hand-mocks every native module (AsyncStorage,
  the Supabase client, Firebase, expo-image, expo-blur, expo-haptics, expo-notifications, vector-icons,
  chart-kit, view-shot, RevenueCat, the Expo winter runtime). **Adding a new Expo/native dependency
  usually means adding a mock to `jest.setup.js`,** or unrelated suites start failing on import.
- **`jest.config.js` sets no `testPathIgnorePatterns`.** A git worktree created *inside* the repo
  (e.g. `.claude/worktrees/<name>`) gets its tests collected too. Observed live on 2026-09-09: test
  discovery went from 103 suites to **207**, reporting 43 failed suites / 99 failed tests — every one
  of them from a stale worktree checkout pinned to an older commit, none from the working tree. If you
  see a suite count above 103, run `git worktree list` first and check whether one lives under the
  repo root. Sibling worktrees outside the root (`../puckiq-230-tf`, `../puckiq-230-build4`,
  `../puckiq-pr15-worktree`) are fine and are not collected.
- **`CLAUDE.md`, `.claude/`, `.cursor/`, and `.env` are all in `.gitignore`.** Files you add there
  will never show up in `git status` or a diff. That is intentional; don't "fix" it.
- **The working branch is `fix/ci-tests-cleanup-2026-06`, not `main`** (remote default is `main`).
  Confirm the intended base before branching or opening a PR.
- **`SETUP_SUMMARY.md` is stale and actively misleading.** It describes v2.1.0, claims "zero test
  coverage" (there are 103 suites), and points at `services/streakTracking.ts`, which no longer
  exists. Treat it as history, not instructions.
- `docs/design/vision.md` ("Stat Sheet", adopted 2026-04-26, superseding "Rink Glass") is the live
  design law: one card surface, cyan `#4cc9f0` as the only decorative accent with green/red/amber
  reserved strictly for data direction, no emojis, no editorial copy, rationed display-bold. **Read it
  before any UI change** rather than inferring style from whichever screen you happen to open.

## Don't do this

- Don't rename the `learning-project` slug, scheme, or package name, and don't rename the directory.
- Don't call Supabase from `app/` or `components/`; add or extend a service in `services/`.
- Don't add a native/Expo dependency without a matching mock in `jest.setup.js`.
- Don't edit `android/` or `ios/` by hand without checking whether `app.config.js` + prebuild is the
  right lever — and don't run `npx expo prebuild` casually, since it can clobber committed native files.
- Don't treat `npx tsc --noEmit` as covering `supabase/functions/` (Deno, excluded from tsconfig).
- Don't use `npm run test:coverage` or `npm run test:all` as your pass/fail gate; they fail on
  pre-existing coverage thresholds. Use `npx tsc --noEmit && npm test`.
- Don't commit `.env`, and don't echo, log, or paste any key value anywhere.
- Don't assume AsyncStorage writes reach Supabase. `userSync.ts` runs once per user, for three keys.
- Don't give the synthetic `ml_lightgbm_v1` model real client-side weights; its predictions come from
  Supabase, and its local `weights` are placeholders.
