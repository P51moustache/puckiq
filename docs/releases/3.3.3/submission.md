# PuckIQ 3.3.3 release receipt

Submitted on October 19, 2026 at 2026-10-20T05:58:42.038Z, with Zach's go-ahead ("ship it, don't wait for my approval" once verified). Apple reports **WAITING_FOR_REVIEW**. The release mode is **AFTER_APPROVAL**, so it goes live as soon as Apple approves it.

3.3.3 widens the Tonight reminder offer. In the week before, only 4 people saw it: it asked only before puck drop, it waited 4 s, and it never asked from the morning recap.

- Commit `ac0a641` on main adds three offer moments (before lock, after lock, recap), shortens the delay to 1 s, adds the `recap_prompt` source, and adds `reminder_prompt_skipped` with a reason and moment. Release commit `413e8d0` bumps the version.
- Checks: typecheck and lint pass, and Jest passes 123 suites (1,078 tests).
- Simulator: tested on the PuckIQ Test iPhone with a production bundle and reminders off. On a night with all games final, the after-lock sheet "Catch the next lock" appeared. "Not now" saved the dismissal, and the sheet stayed away after a relaunch.
- EAS build: [ea27f2fe](https://expo.dev/accounts/zlce/projects/learning-project/builds/ea27f2fe-9382-464c-be2c-da63a21f571d), version 3.3.3 (48), auto-submitted ([d5f485a7](https://expo.dev/accounts/zlce/projects/learning-project/submissions/d5f485a7-a4b8-4163-85ea-41c8175d39fb)).
- Processed build `06719f25-ca34-459b-91c9-15b03ce633e8` is **VALID**. Export compliance: no non-exempt encryption.
- App Store version `ba93b452-c7f8-4702-ae09-83efd8a78489` (3.3.3) has build 48 attached. Review submission `78e5fcdf-ed72-4f13-85c1-0c743dd564fe`.
- What's New: `whats-new.txt`. Review notes: `review-notes.txt` (3,902 of 4,000 characters). Description and keywords carried over from 3.3.2.

After release, PostHog: watch `reminder_prompt_view` by `moment`, `reminder_prompt_skipped` by `reason`, and `reminders_enable` with source `recap_prompt`.
