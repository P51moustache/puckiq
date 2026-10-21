# PuckIQ 3.3.4 release receipt

Submitted on October 20, 2026 at 2026-10-21T06:39:29.643Z, with Zach's go-ahead ("Yes, create the 3.3.4 version in App Store Connect, attach build 49 when it's processed, and submit it for review"), after 3.3.3 was approved and live. Apple reports **WAITING_FOR_REVIEW**. The release mode is **AFTER_APPROVAL**, so it goes live as soon as Apple approves it.

3.3.4 ships the work merged after 3.3.3:

- `93b1d87` The lineup call card shows up to three reasons for its pick.
- `5041d12`, `d57ff8f`, `fef9902` Roster import is guided through the league app; the photo picker shows screenshots only (native); setup is honest about tiny rosters.
- `49a0de8` "Enjoying PuckIQ?" after a good night: "Loving it" calls StoreKit's review request (expo-store-review, native), "Not really" opens feedback.
- `0c19c28` Lineup and live reminders use the checklist layout (docs/design/notifications). The goal and scratch pushes were already live from the live-poller deploy.
- Release commit `2cea2ed` bumps the version.

Checks: typecheck passes, and Jest passes 132 suites (1,150 tests).

- EAS build: [6e37aa00](https://expo.dev/accounts/zlce/projects/learning-project/builds/6e37aa00-f223-443b-8803-448697f2b4fe), version 3.3.4 (49), auto-submitted ([0f083934](https://expo.dev/accounts/zlce/projects/learning-project/submissions/0f083934-b03c-4eaf-b418-1af903fd5142)).
- Processed build `8ba376fc-53a4-463f-b7bb-cb9438c17369` is **VALID**. Export compliance: no non-exempt encryption.
- App Store version `61413f0b-51e8-46e8-b580-87441e751f5c` (3.3.4) has build 49 attached. Review submission `d35df143-abb2-4b2d-8972-20ad2a0bfb6f`.
- What's New: `whats-new.txt`. Review notes: `review-notes.txt` (3,979 of 4,000 characters). Description and keywords carried over from 3.3.3.

After release, PostHog: watch `review_prompt_view` / `review_prompt_answer` / `review_prompt_skipped`, `roster_import_return`, and reminder opens with the new copy.
