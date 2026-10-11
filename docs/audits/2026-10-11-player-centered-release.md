# PuckIQ 3.2.0 release audit

User authorized the full audit, fixes and shipping on October 11, 2026. Source branch: `codex/player-centered-dark-update`.

## Style coverage

Shared dark charcoal/red palette, compact headers, 44-point primary controls, readable text and consistent card rounding across Home, Players, Lineup, Insights, More, Week, Pickups, League, Settings, onboarding, paywall and sheets. Reused compact player rows across the optimizer and Home. Generated hockey artwork remains decorative; player portraits and stats come from NHL sources. Off-night schedule columns now use dark cyan tint instead of low-contrast ivory.

## Corrected issues

| Severity | Area | Correction |
| --- | --- | --- |
| P1 | Stats outages | Failed stats loads produce an error; missing estimates withhold actionable lineup recommendations. Real zeroes remain valid. Prior-season estimates remain available and disclosed. |
| P2 | Async resources | Date/team changes hide old results immediately. Disabled, superseded and unmounted requests cannot write stale data. |
| P2 | Saved plans | Retention uses today's date, preserving today's choices when a future date is edited. Deferred swaps check team identity. |
| P2 | Performance charts | Selection follows game identity and disappears safely when history or Pro access changes. |
| P2 | Pickup navigation | The selected optimizer date determines both the exact pickup night and its week, including Sunday boundaries. |
| P2 | Injury news | Undated, stale and future reports are ignored for injury hints. Injury language is limited to the player's own clause; ambiguous and return-from-IR language is excluded. |
| P3 | Scratch insights | A scheduled scratched player is not also described as having no game. |
| P2 | Store prices | Removed fixed fallback prices. Missing products show unavailable prices, disable purchasing and offer retry; trials require actual store eligibility. |
| P2 | Schedule contrast | Off-night columns preserve readable light text on dark cards. |
| P2 | iPad portraits | Player hero cutouts keep their phone scale in wide sheets, preserving the full face instead of cropping to the forehead. |

Independent read-only Bugbot review covered changed navigation/theme, new screens, player outlook/chart, lineup assignment/persistence/locks, resources/loaders, projections, trends, news, trade inputs, Pro guards and team backup parsing. All seven reported findings were corrected; three further visual/data issues were found and corrected during the audit.

## Data honesty

- No random, hardcoded performance, win-probability or purported ML output feeds the production app.
- Sample roster is explicitly identified and excluded from League Room publishing until replaced.
- Player outlooks use real NHL form/schedule inputs and disclose estimates and prior-season basis.
- Goalie probability is an estimate, not a confirmed starter.
- Waiver availability is inferred from league size or known room rosters, not fabricated host-league ownership.
- Preview date/clock/Pro flags are guarded by `__DEV__` and disabled in Release validation.
- Subscription prices/trials use store products and eligibility.

## Validation and delivery

Final checks, simulator evidence, source hashes and App Store submission receipt are recorded with the release candidate. Live NHL smoke tested forms, schedules, night status, coach moves, pickups, matchup and final box scores. Purchase/restore logic is covered by behavioral tests; no paid purchase is executed during QA.

Final source checks: TypeScript clean; 101 Jest suites and 931 tests passed; ESLint has zero errors (198 existing warnings, primarily test mock/import conventions); `git diff --check` clean. Live API smoke: 2 tests passed. Release app compiled with the production EAS profile's public environment and no preview overrides. Widgets and Live Activities use the same updated palette and upright numerals.
