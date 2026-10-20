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
| Player discovery | `player_search_open`, `player_search_close`, `player_search`, `player_link`, `player_open` (`context` = the card's actions, `source` = where it was opened: tonight, lineup, recap, next_up, first_night, myteam, week, pickups, league, similar); source/list, query length, result count, request time, success/error, legacy linking |
| Paid access | `paywall_view`, `paywall_purchase`, `paywall_restore`; entry point, selected plan, outcome, Pro status |
| Retention and sharing | `release_notice_view`, `release_notice_dismiss`, `loyalty_restore`, `share_card`, `sample_team_cleared`, `reminders_enable` (`granted`, `source`: onboarding / tonight_prompt / recap_prompt / first_night / settings, `live_start`), `reminders_mode` (`only_when_needed`, from the Settings switch); welcome replay, outcome, card kind, reminder permission |
| Feedback | `feedback_opened`, `feedback_sent`; category and delivery channel |
| Live nights | `live_view` (once per game day when games are live), `recap_view` (once per recap), `live_activity_start` / `live_activity_stop` (`phase`) |
| League Room | `room_create`, `room_join` (`source`: link or code), `room_leave`, `room_reaction`, `room_dues_edit`, `trade_finder_open`, `trade_idea_view` — never names, codes or rosters |
| Alerts | `alerts_enable` (`granted`, `supported`, `scratches`, `goals`) |
| Setup and stickiness (3.2) | `roster_import_open` (`source`: onboarding, roster, tonight, sample), `roster_import_result` (`method`: screenshot / paste, row and match counts), `roster_import_add` (`added`); `league_format_set` (`format`: points / categories, `source`: onboarding / settings / tonight_prompt — the one-time question for teams set up before 3.2) and `format` on `team_add`; `host_open` (`host`, `team_page`) when "Make these moves" opens Yahoo, ESPN or Fantrax |
| Engagement (3.2) | `next_up_view` (once per night and kind) / `next_up_tap` (`kind`: fill_slot, hot_player, tomorrow, matchup, week); `first_night_step` (`step`: players, pickup, reminder), `first_night_done`, `first_night_dismiss` (`done`); `reminder_prompt_view` (`moment`: before_lock, after_lock, recap), `reminder_prompt_answer` (`answer`: on, not_now; `moment`); `reminder_prompt_skipped` (`reason`: reminders_on, permission_denied, asked_twice, cooling_down, no_game, call_loading, left_early; `moment`), once per reason a day when a Tonight visit ends without the sheet (3.3.3); `notification_open` (`kind`: lineup, live, goal, scratch) |

Roster events describe committed state changes, including changes restored from backup. They do not promise that every state change was a manual tap. Initial local roster loading is skipped. Screen duration counts active foreground segments and excludes time in the background. Searches log lengths and counts, never search text. Existing telemetry contains screen and selected feature events; this is not a recording of every gesture.

## Questions to answer after release

Open the [PuckIQ app activity dashboard](https://us.posthog.com/project/630435/dashboard/2139475). Its nine charts cover active installations, sessions, checkout access grants, daily activity, active time per screen visit, popular screens, weekly return visits, core actions, and onboarding completion. Production tracking began arriving on October 5, 2026. The checkout chart was renamed on October 13 because successful access grants can include trials and sandbox transactions. Metrics are derived and are not catalog-approved. The connected account lacks Data Catalog read scope, so catalog governance was not changed.

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

## Behavior instrumentation — analytics schema 2 (October 13, 2026)

Implemented in source; new events require an updated app release. This is not a deployed collection or a backfill. All updated PostHog events have `analytics_schema=2`; older events with no schema cannot be retrospectively classified. `environment=production` describes a release build, including TestFlight, and is **not** Apple's transaction environment.

Every event can carry these anonymous, count-based contexts once their providers finish loading:

- `roster_status_ready`, `roster_count`, `linked_roster_count`, `roster_kind` (empty / sample / personal), `league_platform`, `league_format`. Sample classification reuses the existing sample-player heuristic; it is not proof of roster ownership. `roster_state` reports initial loaded state and changes to these counts/categories, including restored state.
- `subscription_status_ready`, `is_pro`, `pro_source` (none / subscription / legacy / loyalty / developer / unknown), `store_environment` (production / sandbox / unknown), `subscription_period` (trial / intro / normal / prepaid / unknown). `subscription_status` reports settled status changes. Exclude unknown/loading access from free-versus-Pro comparisons.

| Decision | Events | Meaning and limits |
|---|---|---|
| Why setup stalls | `onboarding_roster_choice`, `onboarding_quick_pick`, `player_search` | Continue with players or choose the sample (setup no longer allows an empty roster); each face-grid add/remove with the player's position; search success/error, result count and duration by onboarding / roster-search surface. Search text is excluded. Existing completion and step events remain. |
| Where import fails | `roster_import_started`, `roster_import_result`, `roster_import_failure`, `roster_import_cancelled`, `roster_import_close` | Source, method, anonymous attempt ID, matching counts, failure category, elapsed time, and whether Add was pressed before closing. No screenshots, pasted text, names, private URLs, or error messages. |
| Whether personal advice is available | `advice_state` | Tonight / Insights / Lineup state: empty, loading, unavailable/error, quiet night, ready or gated. Counts of available/hidden advice. Fires on focused foreground screens and state changes; **not viewport exposure or proof of reading**. |
| Whether loading loses users | `advice_load_result` | Visible loading interval ends with a ready/error/other state, or `left_loading` when the screen loses focus, backgrounds or unmounts. `wait_ms` excludes time spent hidden after leaving. It measures a foreground wait segment, not backend latency or proof of abandonment from the app. |
| Whether return visits offer useful changes | `roster_brief_available`, `roster_brief_action`, `roster_brief_dismiss` | Change count and action category only. Availability is not proof of viewport exposure. Player IDs and local prior-visit snapshots are not sent to analytics. |
| Whether users explore advice | `advice_open` | Explicitly opening a coach insight, move category and affected-player count. No recommendation text or player IDs. |
| Whether advice leads toward action | `advice_action`, `lineup_action`, `lineup_plan_changed`, existing `pickup_add` | Advice CTA taps; lineup edit/save/reset requests after lock/eligibility checks; committed local plan changes. A gated CTA is not completed value. Plan changes may also come from restore, so pair them with an explicit action. None proves a change in Yahoo/ESPN/Fantrax. |
| Whether the host link works | `host_open`, `host_open_result` | Attempt followed by OS link success/failure, surface, host category and whether a team-page link was configured. Successful opening does not prove a lineup move was made. |
| Where upgrade interest breaks | `paywall_requested`, `paywall_view`, `paywall_plan_select`, `paywall_store_result`, `paywall_trial_eligibility`, `paywall_store_retry`, `paywall_checkout_blocked`, `paywall_checkout_started`, `paywall_purchase`, `paywall_restore_started`, `paywall_restore`, `paywall_dismiss` | CTA, sheet, store availability/loading, eligibility (including unknown), plan changes, checkout/restore start and outcome, and dismissal reason. Anonymous `paywall_visit_id` joins events within a visit. Retrying the store does not emit another view. `elapsed_ms` is wall-clock time, not active foreground dwell time. |

`paywall_purchase.result=purchased` is retained for compatibility and means **access granted after checkout**, never settled paid revenue. New outcomes carry receipt-derived `access_kind` (trial / subscription / sandbox / unknown / none), `store_environment`, `subscription_period`, product ID and safe numeric SDK error code. Missing receipt metadata stays unknown. `listed_price` and `currency` describe the selected store product, not the actual charged amount. Trial-offer eligibility is separate from the actual receipt period.

### Three operating measurements

1. **Personal advice interaction before payment prompts.** Per anonymous installation, examine the ordered sequence from a linked, non-sample roster to `advice_open` or an ungated `advice_action` before its first `paywall_view`. Use `advice_state` to distinguish missing inputs from inaccessible recommendations. Treat interaction as a candidate activation proxy until repeat-use data supports it.
2. **A useful decision loop and repeat use.** Measure how many of those installations save a local lineup plan after an explicit lineup action, add a pickup, or successfully open their fantasy host; then return at least 24 hours later. Use a matured observation window so today's arrivals are not counted as non-returners. These are action proxies, not proven fantasy results.
3. **Paywall progression by prior value.** Compare paywall visit → store available → checkout started → receipt-classified access, split by roster readiness and preceding advice interaction. Report production trial starts, production subscription access and sandbox access separately. Guardrails: roster/import failures, advice availability errors, host-link failures and checkout cancellations.

Do not set numerical success targets from the current 34-install sample. Compare cohorts after the updated release has enough matured users, keeping existing Pro/legacy/loyalty users separate from prospective subscribers. No session recording or new third-party analytics SDK was added; existing opt-out and anonymous-install transport still apply.

### Billing evidence still required

Client events cannot measure renewals or trial-to-paid conversions while the app is closed. A separate authenticated RevenueCat webhook integration is required for deduplicated production billing events, refunds, renewals and trial conversion. It is not implemented or connected in this change. Keep payment/customer/transaction identifiers out of product analytics; reconciling billing requires a separately designed privacy-preserving join, not reuse of account IDs. [RevenueCat webhook events](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [trial lifecycle](https://www.revenuecat.com/docs/integrations/webhooks/event-flows).

### Value before payment — implemented in source

These changes are ready for release validation; they are not yet shipped or demonstrated conversion improvements:

1. **Complete the first free decision.** Tonight's empty-slot action now opens one pickup candidate for the exact date and eligible slot without opening payment. Pickups explains fit and provides a host link before upgrade. Tonight and Lineup provide a saveable start/swap using existing optimizer eligibility and lock rules. Estimated gain is shown only against a saved local plan. Safety warnings remain free alongside one coach decision. The full optimizer, extra alternatives and week planning remain Pro.
2. **Preview the personal opportunity.** Pro sheets show measured gaps or the count of additional decisions supplied by the loaded screen. Empty, unlinked and sample rosters go to personal import first. Importing over a demo preserves matched sample stars and removes unmatched sample players. Settings remains accessible for purchase restoration. A team change cannot reuse another team's open preview. No host waiver availability or automatic host lineup writes are claimed.
3. **Explain changes since the prior visit.** A local per-team snapshot compares confirmed scratches, reported injury changes, same-date goalie outlook changes, and new open slots. First visits, unchanged data, failed loads, malformed snapshots and observations older than 14 days do not create invented changes. Injury reports and goalie estimates carry explicit confidence labels; disappearance of a report never proves recovery. Actions open player details or the exact pickup date/position. Valid data is committed on blur/background/unmount, keeping the prior-visit baseline stable while the current visit refreshes.

Use the operating measurements above to compare free-decision actions, matured return visits and receipt-classified access after release. Keep the initial cohort small and interpret correlations as hypotheses. A simulator cold pickup load took about 131 seconds; this is one development run, not an estimate of production latency. The new wait/result metric will identify visible stalls and departures before a decision becomes available. Pickup loading performance remains an optimization priority.

### Source validation

The combined instrumentation/value changes passed 975 tests across 112 suites, type checking and iOS Hermes export. Scoped lint had no errors (existing test-mock/import and array-style warnings remain). Native review used the current JavaScript in the existing PuckIQ Test iPhone development shell, bundle build 5: setup redirect, a persisted free save, a live free pickup, and a personal Pro preview. The change brief was reviewed with a clearly labeled controlled prior-visit fixture, then verified to stay quiet on an unchanged return. Receipts, logs and captures are outside the repository at `/Users/zach/Documents/Codex/2026-10-13/puckiq-value-before-payment/`. Original simulator data was restored after review. Physical-device checkout, billing reconciliation and an updated app release remain unverified; source/export/native development review do not satisfy those gates.
