# PuckIQ 3.2.0 release receipt

Submitted on October 11, 2026 at 2026-10-11T17:45:46.766Z. Apple reports **WAITING_FOR_REVIEW**. The release mode is **AFTER_APPROVAL**: it is not yet available on the App Store.

## Exact candidate

- Source: [6d88a5fee9563fde4bc7a9bf54ed94f4c013a47a](https://github.com/P51moustache/puckiq/commit/6d88a5fee9563fde4bc7a9bf54ed94f4c013a47a) on `codex/player-centered-dark-update`.
- App and widget: **3.2.0 (44)**, confirmed inside the exported production IPA.
- EAS build: [e6f266ad-cfbd-44a0-98e0-0835be5190c6](https://expo.dev/accounts/zlce/projects/learning-project/builds/e6f266ad-cfbd-44a0-98e0-0835be5190c6), **FINISHED**.
- Apple upload: **FINISHED**; processed App Store Connect build `edd782e5-237f-493d-81ed-1bc675c0d37d` is **VALID**.
- Review submission: `45e28e98-b008-4237-aa6b-d47c73fbc1b5`; version `721d086d-ee76-4bad-a506-3b2cb2ccfceb`. Both are **WAITING_FOR_REVIEW**.
- IPA SHA-256: `99197d21578abe96843d2422440bf313728dfb7964ef51ef669091b58bcf440b`.
- Build 43 was superseded before review submission to correct the iPad portrait crop. Only build 44 is attached to this version.

## Quality gates

- Full source audit and independent Bugbot review: all seven reported findings fixed, plus purchase fallback pricing, schedule contrast and iPad portrait cropping. Details: [audit](../../audits/2026-10-11-player-centered-release.md).
- TypeScript clean. Jest: **101 suites / 931 tests passed**. The final portrait styling change also passed the player-sheet suite (**15 tests**) and TypeScript again.
- ESLint: **0 errors / 198 warnings**. Diff whitespace check clean.
- Live NHL smoke: **2 tests passed**, including real schedules, stats, recommendations and final box scores.
- Native Release simulator build succeeded using production public environment and no preview overrides. The existing 21-player roster survived the upgrade. Free access and real App Store product prices/trial eligibility were verified.
- Native iPhone/iPad visual and interaction checks covered player portraits, charts/outlooks, start/bench actions, saved plans, date changes, exact-date pickups, insight details/navigation, onboarding and compact schedule contrast.
- Paid transactions, physical-device upgrade performance and signed-in cloud flows were not exercised during this audit. Behavioral tests cover purchase/restore and account/team logic; simulator and build results do not establish physical-device acceptance.

## App Store assets and metadata

Five new native screenshots for iPhone (1320 × 2868) and five for iPad (2064 × 2752); all ten Apple assets are **COMPLETE**, with no processing errors. They show a labeled sample roster and Pro features using public NHL stats/estimates. A local development preview clock demonstrates a pregame date; Release uses real time. Cinematic background artwork is decorative. Old-design previews were removed from the 3.2 draft.

The published description, What's New and review notes match [the committed release text](./description.txt), [release notes](./whats-new.txt) and [review notes](./review-notes.txt). Existing support, privacy, product and reviewer-contact configuration is preserved.

Local detailed evidence: `design/updates/2026-10-11-release-audit/` contains the tracked-source hash manifest, IPA verification, build/submission receipts, screenshot upload/processing receipts, actual screenshots and validation logs. Generated evidence and unrelated marketing work are not in the app build.
