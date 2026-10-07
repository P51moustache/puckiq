# PuckIQ 3.1 — "Season two" release checklist

What ships: the full nightly loop (live scoreboard, morning recap, hindsight grade, share
cards), League Room (multiplayer), scratch and goal alerts, Home Screen + Lock Screen widgets and
a Live Activity, the Week tyre-strategy grid, grouped coach moves, the "How PuckIQ decides" sheet,
Settings behind a header gear with a new League tab, and the 6 AM ET game-day rollover.
Design and contracts: [docs/plans/2026-10-06-season-two.md](plans/2026-10-06-season-two.md).

## Urgent on its own: the game-day rollover

3.0.0 (live since Oct 5) switches Tonight to the next day at midnight Eastern, in the middle of
every 10:30 PM ET puck drop. The fix is self-contained (`services/nhlDate.ts`,
`services/nhl/dates.ts`, `services/__tests__/nhlDate.test.ts`) and can go out as 3.0.1 ahead of
the rest if 3.1 needs more review time.

## Steps that need you

1. **Supabase (League Room + alerts).** Apply the three `20261006*` migrations, deploy
   `register-alerts` and `live-poller` (both with JWT verification off), then run
   `supabase/cron/live-poller.sql` in the SQL editor to schedule the poller and the daily retention
   cleanup. `scripts/supabase/deploy-season-two.sh` does the CLI part. No secret is involved: each
   cron call carries a single-use ticket minted in Postgres. Until this is done the app degrades
   gracefully: League shows "almost here" and alerts don't register.
2. **App Group + widget signing** (Apple Developer portal, team LY4Y98UN7L): register App Group
   `group.com.zlce.hockeystats`, then enable App Groups with that group on `com.zlce.hockeystats`
   and on `com.zlce.hockeystats.widgets` (register that App ID if EAS hasn't). Alternatively run the
   first `eas build` interactively and sign in with your Apple ID — with only the App Store Connect
   API key, EAS enables the capability but can't create and link the group. Changing capabilities
   invalidates the current App Store profile; EAS makes a new one. `eas.json` needs no change.
3. **App Privacy (App Store Connect, web).** New data: League Room team names, rosters and
   reactions (linked to the Apple account, visible to room members), and the push token + followed
   NHL player ids for alerts (not linked to identity). Update the questionnaire and publish
   `site/privacy.html` to the gh-pages branch.
4. **Version.** Bump `package.json`, `app.config.js` and the native project to 3.1.0 with a new
   build number before `eas build`.
5. **Optional later: APNs key** for server-pushed Live Activity updates (the app updates it
   while it runs today).
6. **Submit for review** — only with your go-ahead.

## Native notes

- Widget extension `PuckIQWidgets` (iOS 16.2+): small, medium, Lock Screen rectangular and inline.
  States: set up, stale, no games, first-lock countdown (ticks on its own, red inside an hour),
  underway, live points, final. Reads the `tonightSnapshot` JSON from the App Group; the app writes
  it whenever what Tonight would show changes (`hooks/useNightLive.ts`).
- Live Activity `PuckIQNightAttributes`: Lock Screen + Dynamic Island. Starts when someone taps
  "Follow on Lock Screen" during live games (remembered for later nights), updates while the app
  runs, ends at the final horn. Goes stale after 15 minutes without an update ("Open PuckIQ to
  refresh"). Server-pushed updates need an APNs key later.
- `PuckIQNative` bridge (Swift + `RCT_EXTERN_MODULE`) through the New Architecture interop layer;
  every method is a no-op below iOS 16.2. A DEBUG-only self-test runs with `-PuckIQSelfTest YES`.
- `project.pbxproj`: +267 lines (extension target, embed phase, shared sources); no `pod install`.
- Release device build verified unsigned (`CODE_SIGNING_ALLOWED=NO`); ActivityKit is weak-linked,
  so iOS 15.1 devices still launch.
- When bumping the version, bump `CFBundleShortVersionString` in both Info.plists together; EAS
  sets the build number in both.

## Verified (2026-10-06)

- `tsc --noEmit`: clean. Jest: 59 suites, 599 tests pass. ESLint: no errors in new code; the two
  repo errors are the pre-existing `Buffer` globals in `scripts/store/asc.mjs`, and new-code
  warnings are the `jest.mock` import-order pattern the existing tests already use.
- Backend: both migrations applied twice in PGlite (Postgres 18) with 140/140 RLS + RPC checks;
  alert logic 68 tests against real NHL payloads; edge functions type-checked (no Deno here).
- Native: Debug simulator build and unsigned Release device build succeed with the widget
  extension embedded; the bridge, widget snapshot and Live Activity were exercised at runtime.
- Simulator QA on real NHL data (Oct 5 opening night, Oct 6 slate): morning recap with hindsight,
  pre-lock hero, grouped moves, final-state hero with live points on the lineup board, Week
  tyre-strategy grid, Pickups, League pitch, `puckiq://join/ABC234` invite sheet, and the Tonight
  → App Group widget snapshot.
- Not yet exercised: a live game in progress on device (first chance: tonight's 7 PM ET games),
  League Room create/join against a deployed backend, and push delivery.
