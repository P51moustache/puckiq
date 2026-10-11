# PuckIQ 3.2 — release checklist

The player-centered dark update, whole-app audit, source snapshot and final shipping receipt are documented in [the October 11 audit](audits/2026-10-11-player-centered-release.md). Store metadata is in `docs/releases/3.2.0/`. Zach authorized shipping on October 11, 2026.

What ships since 3.1.0, by topic:

- **Engagement:**
  - Tonight's "Up next" card, a guided first night, and the game-night reminder offer.
  - Deeper player cards: a verdict, an opponent-tinted week, and similar players.
- **Roster import:** from screenshots or pasted names.
- **Yahoo defaults:** Yahoo teams start on Yahoo's default scoring and lineup.
- **Stickiness round:**
  - Category leagues.
  - Reminders that name the swaps.
  - Goalie back-to-back outlook.
  - "Make these moves in Yahoo".
  - Live points that count power-play assists.
  - A one-time "Points or categories?" question for existing teams.

Research and contracts:
[docs/research/2026-10-10-stickiness.md](research/2026-10-10-stickiness.md),
[docs/plans/2026-10-10-stickiness.md](plans/2026-10-10-stickiness.md),
[docs/plans/2026-10-10-engagement.md](plans/2026-10-10-engagement.md).

## What changes outside the app

- **Backend:** none. No migrations or edge functions.
- **App Privacy:** none.
  - Screenshots are read on the phone (PHPicker plus Vision, with no photo-library permission), and nothing is uploaded.
  - The team page link stays on the device.
  - The new analytics events fall in the same anonymous product-interaction category as before.
- **Native:** the widget and Live Activity gain an optional `headline` field (category leagues), and the roster
  scanner is new. Both are in the committed `ios/` project. No new capabilities or entitlements.

## Steps

1. Version 3.2.0. Done in `package.json`, `package-lock.json`, `app.config.js` and both Info.plists; EAS sets the
   build number.
2. `eas build --platform ios --profile production --auto-submit` from a clean worktree. This uploads the build to
   App Store Connect and TestFlight.
3. App Store Connect: create version 3.2.0 (release after approval, no phased release), set What's New and the review
   notes below, and attach the build.
4. **Submit for review: only with Zach's go-ahead.**

## What's New (App Store)

Category leagues: tell PuckIQ your league scores by categories, and Tonight shows your night category by category
(G, A, +/-, PPP, SOG, HIT, W, GAA, SV%, SO). Every category counts when it ranks players.

Smarter reminders: your lineup reminder names the swaps to make, and stays quiet on nights your lineup already
works.

Goalie outlook: back-to-back nights flagged, with who's likely to start.

Import your roster from screenshots of your Yahoo, ESPN or Fantrax team.

Make the moves in Yahoo, ESPN or Fantrax with one tap.

Plus: an "Up next" step at the end of Tonight, player cards with the week ahead and similar players, Yahoo's
default scoring for Yahoo teams, and live points that count power-play assists.

## Review notes (prepended to the 3.1 notes)

NEW IN 3.2 (all optional):

- **Roster import.** On the setup players step (or Roster > scan icon), "Import from screenshots" opens the system
  photo picker (PHPicker, so no photo-library permission). It reads player names on the device with Vision, and
  nothing is uploaded. "Paste or type names" works without photos.
- **Category leagues.** Setup asks "Points or Categories". To switch later, use League settings (Roster > the
  league rules card) or the one-time question on Tonight. Tonight then shows category totals.
- **Lineup reminders** name the swaps to make. Settings > Game-night reminders > "Only when my lineup needs a
  change".
- **Goalie start outlook** on Tonight and the Week grid. These are estimates from public NHL schedules and box
  scores, never "confirmed".
- **"Make these moves in Yahoo"** opens the Yahoo, ESPN or Fantrax website or app, or the team page the user pasted
  in League settings. PuckIQ still never signs in to or changes a fantasy league.

## Verified (2026-10-10)

- `tsc --noEmit` is clean; Jest passes 90 suites, 870 tests.
- Simulator QA with live NHL games on Oct 10:
  - Category scoreboard, goalie back-to-back tags, League settings, setup question.
  - Reminder copy and "Make these moves".
  - Week B2B marks.
- Native Debug build succeeds, and the widget and Live Activity self-test renders both points and category layouts.
