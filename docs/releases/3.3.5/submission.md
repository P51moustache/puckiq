# PuckIQ 3.3.5 release receipt

Submitted on October 22, 2026 at 2026-10-23T06:00:53.832Z, with Zach's go-ahead ("push it and submit"), after 3.3.4 was approved and live. Apple reports **WAITING_FOR_REVIEW**. The release mode is **AFTER_APPROVAL**, so it goes live as soon as Apple approves it.

3.3.5 ships the work merged after 3.3.4:

- `720e4df` "Pro is on": after a purchase or trial starts on the paywall, Tonight greets the new subscriber once with the first move Pro unlocked tonight, a one-tap switch for reminders and alerts, and the trial end date and price (docs/design/trial-welcome, concept A).
- Release commit `ff55c72` bumps the version.

Checks: typecheck passes, and Jest passes 133 suites (1,167 tests). The sheet was checked on the iOS simulator with developer Pro and a seeded record. The real purchase-to-welcome handoff was not tried on a device, because TestFlight would not install on Zach's phone.

- EAS build: [a748a91e](https://expo.dev/accounts/zlce/projects/learning-project/builds/a748a91e-f10f-41b0-8c44-7edae3688b1c), version 3.3.5 (50), auto-submitted ([c3bd8861](https://expo.dev/accounts/zlce/projects/learning-project/submissions/c3bd8861-b7b0-4345-a5a9-082e5c301251)).
- Processed build `ff059343-a4dc-4a9d-aaff-6c47169cb28d` is **VALID**. Export compliance: no non-exempt encryption.
- App Store version `d6352498-e844-454f-8913-d69677c08e77` (3.3.5) has build 50 attached. Review submission `dfe7cdae-9801-4390-94ba-336cfde85098`.
- What's New: `whats-new.txt`. Review notes: `review-notes.txt` (3,978 of 4,000 characters). Description and keywords carried over from 3.3.4.

After release, PostHog: watch `trial_welcome_view` and `trial_welcome_answer`, and `reminders_enable` with source `trial_welcome`. The first real purchase that fires `trial_welcome_view` confirms the paywall-to-Tonight handoff.
