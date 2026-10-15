# PuckIQ App Store submission audit

Checked October 4, 2026 against App Store Connect, the public US listing, local assets, and the app source. Build 34 was processed as VALID, but a subsequent sandbox-receipt audit found that Apple’s fixed 2013 original-download date would incorrectly grant legacy Pro and hide the purchase path. Build 35 fixes that regression, compiled successfully, was delivered to Apple, and is VALID and selected. The app, Pro subscription group, Monthly and Season plans were submitted together on October 4, 2026 at 8:52 PM CDT. Both the app version and submission are WAITING_FOR_REVIEW; release is AFTER_APPROVAL.

## Current listing

| Item | Verified result |
|---|---|
| Current public version | 2.2.0, free since September 27; the new coach listing takes effect with 3.0 |
| Replacement binary | Corrected 3.0.0 (35), Apple VALID and selected |
| Source | Shipping commit `5269a4a5e3ae99c039e4f8f40cb7c1ac61d84f65`; all 185 runtime and configuration files matched the tested working files |
| Name and subtitle | 28 and 30 characters; saved in the pending listing |
| Promotional text and keywords | 169 and 98 characters; saved and read back |
| Description and release notes | Prepared files match App Store Connect; roster ownership estimates and manual setup are described accurately |
| Screenshots | 8 iPhone 1320 × 2868 and 5 iPad 2064 × 2752; all complete and matched to local checksums |
| Screenshot content | Real UI, readable benefit headlines, consistent styling, sample roster and Pro disclosures |
| Phone previews | Suno coach tour uploaded first with matching checksum and 3-second poster; asset COMPLETE, video PROCESSING without errors; existing Pickups and Share Card COMPLETE |
| iPad preview | Existing tour complete |
| Public URLs | Marketing, support, and privacy returned HTTP 200 and describe the new product |
| App Privacy | Published and browser-verified, 8 data types, aligned with the app and native manifest |
| Subscriptions | Monthly $4.99 and annual $19.99 in the US; both products and their group submitted together with app build 35 |
| Service level | Both plans share level 1 because they unlock identical features |
| Annual introductory offer | One-week free trial in 175 territories; displayed only when eligible |
| Review information | No sign-in required; sample-team path, optional backup and account deletion, receipt migration and loyalty gift documented |
| Release | Automatic release after approval, all users immediately, existing rating retained |

## Preview

The final uploaded copy is `puckiq-coach-preview-15s-suno-x264.mp4` (1,031,912 bytes). It holds six actual captured feature screens for readability with explanatory headlines, Pro disclosures, a progress animation and the user-supplied Suno track with an ending fade. Scenes: Tonight, Best Lineup, Week, Matchup, Pickups and the closing brand message. It preserves 886 × 1920, 30 fps, H.264 High 4.0 and stereo AAC. Every decoded frame was compared with the held-screen master: average PSNR 49.12 dB, minimum 46.65 dB. The matching 3-second poster was visually inspected for readable UI. The larger masters are retained. Order: coach tour, Pickups, Share Card.

The prepared formats satisfy the relevant limits. Processing success does not establish App Review approval. [Apple product page guidance](https://developer.apple.com/app-store/product-page/), [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications), [preview specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications).

## Analytics and validation

The replacement build contains foreground sessions, screen visits and engagement time, onboarding, searches and outcomes, roster and team changes, filters, sharing, reminders, purchases, restores, and release-notice activity. It uses a random installation identifier without account IDs, email, player names, rosters, or search text in the new events. This is event tracking; it does not record a video of every gesture.

The PuckIQ PostHog capture key was verified through a synthetic event that was ingested and read back. The production export was checked for all five client configuration values. PostHog now discards raw IP addresses and has GeoIP enrichment disabled; a new synthetic event verified absent IP and location properties. The activity dashboard has nine validated queries, filtered to production events. It is waiting for actual usage of the release.

Validation: 44 targeted tests in seven suites passed. After the static Expo environment-variable fix, 11 analytics tests in three suites and TypeScript passed. The clean production Hermes export succeeded. Lint reported no errors and 25 existing warnings. EAS compiled the signed iOS release and delivered it to Apple successfully. The sandbox-date regression was checked with 32 tests in four suites and TypeScript. Apple’s fixed sandbox date is ignored for paid and loyalty eligibility, while active sandbox purchases still unlock Pro. [Apple original purchase date documentation](https://developer.apple.com/documentation/storekit/apptransaction/originalpurchasedate). Actual production-receipt migration and real-device upgrade tests remain unverified.

## Existing users

Returning users see an in-app welcome-back notice when they open the update after setup, with replay in Settings. Confirmed original paid downloads before the paid-to-free cutover retain permanent Pro. Eligible existing free downloads before October 4 receive the 30-day campaign gift, without initiating an IAP or changing subscription billing. See `loyalty-release-plan.md` for eligibility, timing and receipt limitations.

The current app has local lineup reminders, no active remote push-token registration, and no explicit marketing-push opt-in. It cannot broadcast to every previously installed device before those users open the update. [Apple notification rules](https://developer.apple.com/app-store/review/guidelines/#apple-sites-and-services).

Exact listing text is in `listing/`; build, media, metadata, dashboard and privacy verification are in `review/`. Final submission is verified in `review/submission-receipt.json` and `review/submission-confirmed.png`. Apple accepted the preview file and checksum, and allowed final submission; server-side video conversion remains PROCESSING without reported errors. App Review approval is pending.
