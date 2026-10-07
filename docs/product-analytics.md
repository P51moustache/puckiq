# PuckIQ product analytics

The release build sends anonymous events to [PuckIQ in PostHog](https://us.posthog.com/project/630435). Production and preview capture keys were aligned with that project on October 4, 2026. A tagged `analytics_validation` event was acknowledged by ingestion and read back from this project's events table. Validation events use `environment = validation`; product reports should filter `environment = production`.

## What the release measures

| Area | Events and useful details |
|---|---|
| Visits | `$screen`, `screen_engagement`, `app_foreground`, `app_background`; foreground time per visit, screen name, anonymous install/session IDs, app version, OS, Pro/free |
| Setup | `onboarding_step`, `onboarding_complete`; step, player count, sample-team use, reminder choice |
| Teams and roster | `team_add`, `team_switch`, `team_remove`, `team_rename`, `roster_edit`, `player_settings_edit`, `opponent_rename`; platform, counts, own/opponent list, settings category |
| Planning | `filter_select`; Tonight/Tomorrow, This/Next week, pickup position and time window |
| Pickups | `pickup_add`, `pickup_ownership_filter`, `pickup_availability_edit`; rank, planning window, ownership-filter state, number hidden |
| Player discovery | `player_search_open`, `player_search_close`, `player_search`, `player_link`, `player_open`; source/list, query length, result count, request time, success/error, legacy linking |
| Paid access | `paywall_view`, `paywall_purchase`, `paywall_restore`; entry point, selected plan, outcome, Pro status |
| Retention and sharing | `release_notice_view`, `release_notice_dismiss`, `loyalty_restore`, `share_card`, `sample_team_cleared`, `reminders_enable`; welcome replay, outcome, card kind, reminder permission |
| Feedback | `feedback_opened`, `feedback_sent`; category and delivery channel |
| Live nights | `live_view` (once per game day when games are live), `recap_view` (once per recap), `live_activity_start` / `live_activity_stop` (`phase`) |
| League Room | `room_create`, `room_join` (`source`: link or code), `room_leave`, `room_reaction`, `room_dues_edit`, `trade_finder_open`, `trade_idea_view` — never names, codes or rosters |
| Alerts | `alerts_enable` (`granted`, `supported`, `scratches`, `goals`) |

Roster events describe committed state changes, including changes restored from backup. They do not promise that every state change was a manual tap. Initial local roster loading is skipped. Screen duration counts active foreground segments and excludes time in the background. Searches log lengths and counts, never search text. Existing telemetry contains screen and selected feature events; this is not a recording of every gesture.

## Questions to answer after release

Open the [PuckIQ app activity dashboard](https://us.posthog.com/project/630435/dashboard/2139475). Its nine charts cover active installations, sessions, successful purchase attempts, daily activity, active time per screen visit, popular screens, weekly return visits, core actions, and onboarding completion. All queries ran successfully on October 4, 2026; there is no production activity yet. Metrics are derived and are not catalog-approved. The connected account lacks Data Catalog read scope, so catalog governance was not changed.

- Where do users leave onboarding, and does using the sample team help them finish?
- Which coaching tools do free and Pro users visit, and how much active time do they spend there?
- Do player searches return results, and how often do users add players or edit their opponent?
- Which paywall entry points lead to purchases, cancellations, errors, and successful restores?
- Do welcome-back users return after receiving their loyalty access? Does sharing bring repeat use?

Use the same anonymous install ID for event paths, funnels, and retention. It resets on reinstall. Session IDs are UUIDs with a 30-minute inactivity boundary. Existing opt-out in Settings remains effective; startup events are discarded when a saved opt-out is loaded. Debug builds do not send unless explicitly opted in.

Account identifiers, email, team/player names, roster contents, search text, and feedback text are excluded from these analytics payloads. Optional account/backup, feedback, and purchase validation use their existing separate services and App Privacy disclosures. [PostHog React Native analytics](https://posthog.com/docs/product-analytics/installation/react-native), [user paths](https://posthog.com/docs/product-analytics/paths)

## Validation

44 targeted tests passed across seven suites, including foreground time accounting and roster-data exclusion. Type checking, lint (existing warnings), the privacy-manifest check, and iOS Hermes export passed. A subsequent export check caught and fixed indirect environment-variable access that prevented Expo from embedding the analytics key. The final Hermes bundle contains the correct capture key. The three analytics suites (11 tests) and type checking passed again after this fix. Native build processing and real-device production upgrade/receipt checks are recorded separately in the App Store submission audit.

### Server-side privacy verification — October 4, 2026

PostHog project 630435 now discards incoming raw IP addresses (`anonymize_ips=true`). The default GeoIP enrichment transformation is disabled. A synthetic `analytics_validation` event tagged `environment=validation`, `check=puckiq_privacy_discard` was accepted and read back at 22:56:48 UTC without raw IP, city, or country properties. Activity reporting remains enabled; validation events are excluded from the production dashboard.
