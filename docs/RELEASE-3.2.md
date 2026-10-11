# PuckIQ 3.2.0 — player-centered dark update

Version **3.2.0 (44)** was submitted on October 11, 2026 and is **Waiting for Review**, with automatic release after Apple approval. It is not yet available on the App Store. Zach authorized the audit, fixes and shipping in this chat.

The exact source, build, validation and store asset receipts are in [the release receipt](releases/3.2.0/submission.md). The [whole-app audit](audits/2026-10-11-player-centered-release.md) records the corrected defects and style coverage.

## Included in this release

- Player scouting with faded portraits, recent-performance graphs, upcoming schedule assessments and estimated rest-of-season outlooks.
- A lineup optimizer that compares recommendations with locally saved start/bench plans by date; pickup navigation follows that exact date.
- Clickable insights with the full reason, affected players and a next action.
- Shared compact dark/red styling across all screens, onboarding, paywall and sheets; matching widget and Live Activity colors.
- Category leagues, roster import from screenshots or pasted names, Yahoo defaults, goalie back-to-back outlooks, reminders that name swaps and links to the fantasy host.
- Fixes for stats outages, stale async results, saved-plan retention, chart selection, injury-news attribution, scratch/no-game distinctions, purchase-price fallbacks, schedule contrast and iPad portrait cropping.

## Data and access

Schedules, stats and player portraits use public NHL sources. Projections, goalie start outlooks and availability are labeled estimates. Sample players are explicitly identified. Decorative generated hockey artwork supplies the visual atmosphere. Development preview date/clock/Pro flags do not unlock or alter Release.

PuckIQ saves a local plan; users make the corresponding moves in Yahoo, ESPN or Fantrax. Subscription prices and eligible trials come from actual App Store products.

## Release metadata

Canonical App Store text: [description](releases/3.2.0/description.txt), [What's New](releases/3.2.0/whats-new.txt), [review notes](releases/3.2.0/review-notes.txt). All match the submitted version. Five fresh screenshots per device class are processed. Old-design previews were removed from this draft.

No backend migration, new entitlement or App Privacy declaration is required. Roster screenshot recognition stays on-device using PHPicker and Vision. Prior feature research and contracts remain in [stickiness research](research/2026-10-10-stickiness.md), [stickiness plan](plans/2026-10-10-stickiness.md) and [engagement plan](plans/2026-10-10-engagement.md).
