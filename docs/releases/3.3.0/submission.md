# PuckIQ 3.3.0 release receipt

Submitted on October 15, 2026 at 2026-10-16T04:17:56.489Z. Apple reports **WAITING_FOR_REVIEW**. The release mode is **AFTER_APPROVAL**, so it goes live as soon as Apple approves it.

## Exact candidate

- Source: [2f0cfffb85ab19d2f00c481d39293776f85347ff](https://github.com/P51moustache/puckiq/commit/2f0cfffb85ab19d2f00c481d39293776f85347ff) on `main`.
- App and widget: **3.3.0 (45)**.
- EAS build: [3ccd734d](https://expo.dev/accounts/zlce/projects/learning-project/builds/3ccd734d), **FINISHED**. Auto-submit [4a479d00-9aa9-412a-8dcc-820cb579f0a1](https://expo.dev/accounts/zlce/projects/learning-project/submissions/4a479d00-9aa9-412a-8dcc-820cb579f0a1) is **FINISHED**.
- Processed App Store Connect build `41c6b478-70fa-46bf-888e-cfbd9d6330b9` is **VALID**. Export compliance: no non-exempt encryption.
- Review submission: `ac23e74e-be7c-48c9-ab5b-d5265896b76c`. Version: `44a49a66-6d03-479d-8a22-55a4a75330fa`. Both are **WAITING_FOR_REVIEW**.

## What changed

- Quick-pick roster during setup, built as concept A: a face grid with F/D/G tabs, with screenshot import on top. Picks start loading on the welcome screen.
- A reminder sheet on Tonight after the first lineup call. The copy offers the next game night when puck drop is closer than the reminder lead time.
- Crash and unhandled-error reporting to PostHog Error tracking.
- The free lineup call and pickup come before the paywall.

## Checks

- Concept A was checked in the iOS Simulator: the roster step, the import and the reminder sheet.
- Behaviour tests cover the roster step, the reminder sheet and `reminderOfferLine`.
- Not exercised: paid transactions and physical-device performance.

## App Store metadata

The [description](./description.txt) carries over from 3.2.0. [What's New](./whats-new.txt) and the [review notes](./review-notes.txt) are published as committed. 3.2.0's screenshots and support, privacy and contact settings carry over.

Follow-up: 3.3.0 sends crash data to PostHog. Confirm that App Privacy lists **Crash Data**, not linked to the user.
