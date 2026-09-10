# Reliability foundation — September 10, 2026

The first implementation milestone for **“Know what changed before puck drop.”** The accepted [Arena Club design](../design/vision.md), team palettes and Expo Go workflow remain in place. This is a local code and verification milestone; production data repair is still a stage-one exit requirement.

## What changed

| Audit findings | Implemented behavior | Remaining qualification |
| --- | --- | --- |
| 02, 07, 08, 21 — Player periods, details and units | Select an explicit stored regular season; aggregate traded-team splits without double counting total rows; join recent games to their season, type, final state, date and opponent. Normalize career objects. Cards use the selected category's totals and rates. Missing data is unavailable, not zero; capped streaks show `+`. | Existing incorrectly labeled source rows still need repair. A consistency check rejects totals smaller than known game records; this detects contradictions, not every possible upstream error. Leader coverage is explicitly qualified. |
| 04, 24 — Destinations and runtime reads | Team/player/game links retain the selected entity, including games outside today's slate. Invalid links cannot silently retain the previous player or select another game. Team detail reads through a service. | Notification-response routing still belongs to the alert integration milestone. |
| 08, 09 — Comparison units and freshness | Comparisons use one standings season and snapshot. Category data must match games played. Save fractions render as `.905`; unavailable fields have no winner. Both teams' category dates are visible. Forecast freshness uses stored source times and suppresses unverified upcoming probabilities. | No claim of live ingestion latency. Old database snapshot timestamps may themselves have been stamped by the previous producer. |
| 06, 16 — ML rollover and evaluation | July 1 UTC rollover is consistent across TypeScript, Node and Python; historical overrides are validated. Inference selects the game's actual season and excludes preseason. Evaluation uses actual home outcomes, model/version/date cohorts and forecasts published before puck drop. Baselines use the same games. | Local pipeline changes were tested, not deployed, trained or run against production. Historical season aggregates lack full point-in-time history. Missing pregame evidence is excluded from evaluation rather than reconstructed. |
| 12 — Google sign-in | PKCE callback validation, single active attempt, cancellation/failure handling and session restoration are explicit. | Provider redirect allowlisting and physical-device successful sign-in remain unverified. |
| 13, 14 — Misleading legacy forecasts | Removed the unused `LeagueBriefing` / `BriefingHero` / `useTonightData` path, superseded by Arena. Its inconsistent keys, scales and heuristic attribution no longer remain as a second Tonight implementation. | Server ML and the editable device model remain separate systems. This does not add full client-model parity to Arena. |
| 15 — Backtesting | Clearly identifies the four replayed factors and excluded factors. Uses same-season standings strictly before the game date, versions caches/results, and does not save empty evaluations as 0% accuracy. | It remains a four-factor replay, not validation of the complete eleven-factor engine. |
| 20, 23 — Native presentation | Comparison text now consumes Arena palette roles. Detail tables show readable dates/opponents. Historical game pages identify latest season summaries that may include later games. | Full accessibility, Dynamic Type, Android and iPad verification remain open. |

Game Preview applies the same category consistency checks and checked goalie totals. Goalie profiles use current roster membership and explicitly identify all-club season totals; they are not game lineups or starter confirmations. Dressed backups with no appearance evidence are excluded from recent goalie games. Unsupported duplicate team-GA-as-goalie-GAA presentation was removed from the comparison screen.

## Live data finding and required repair

Read-only checks of the configured feed reproduced two source problems:

- Edmonton's `20252026` team summary contained **88 games**, while its regular-season standings contained **82**. The category sync previously omitted the game-type filter. Both Compare and Game Preview now reject this incompatible category row.
- Connor McDavid's stored `20252026` season row contained **1 GP / 0 points**, while five joined regular-season game records contained **12 points**. The old player producer used the `/club-stats/{team}/now` endpoint. The corrected producer requests `/club-stats/{team}/{season}/2` and validates the returned period. Detail now preserves the game log and hides the conflicting season total.

The standings producer now checks every returned `seasonId` and the single source `date`, and stores that source date instead of fetch time. Explicit historical requests use that season's date endpoint.

**No live sync, database cleanup, migration or pipeline job ran in this milestone.** Upserts alone may not remove older incorrectly labeled rows or invalid snapshot dates. The next data-repair step must inventory affected periods, preserve a recoverable copy, rerun exact-period feeds, and reconcile stale or mislabeled rows before enabling paid analytical claims. Then recheck representative skaters, traded players, goalies, comparisons and opening-season predictions against the repaired feed.

## Verification

- `npx tsc --noEmit && npm test -- --runInBand`: **112 suites passed, 1,681 tests passed, 1 skipped**.
- Relevant Python ML suite: **269 passed**, with 16 dependency warnings. Includes season rollover, daily inference, evaluation cohorts, feature periods, scoring, disk cache and Supabase I/O.
- Node sync-period regression suite: **5 passed**.
- `npm run lint`: **0 errors, 93 warnings**, below the 94-warning starting baseline. `git diff --check` passed.
- Independent reviews covered player calculations, navigation/freshness, ML/sync and auth/replay. Material findings were corrected, including traded-player roster matching, capped streaks, empty shot denominators, same-day replay leakage, invalid route replacement, dressed-backup counting and goalie split attribution.
- Expo Go **57**, iPhone 17 Pro Max simulator: verified Edmonton's exact team destination and comparison context; comparison readability; McDavid detail with the conflicting-total state and dated game log; a valid-to-invalid player link clearing the modal; and a historical ANA-at-EDM game link outside the current slate.
- Metro remains on port **8082**, signed into Expo CLI as **zlce**. Local native/Expo identities and dependencies were preserved.

The smaller test count relative to the starting checkout reflects removal of the unused Tonight hook and its obsolete tests, plus replacement of unscoped player-view fixtures with period/coherence regressions. It is not evidence of higher global coverage.

## Native evidence

| Check | Capture |
| --- | --- |
| Exact team and dated standings | [Team detail](screenshots/2026-09-10-reliability/team-detail.png) |
| Same-period comparison and readable text | [Comparison](screenshots/2026-09-10-reliability/team-comparison.png) |
| Conflicting player totals suppressed; game log preserved | [Player detail](screenshots/2026-09-10-reliability/player-detail.png) |
| Invalid replacement link closes the old player | [Invalid player link](screenshots/2026-09-10-reliability/invalid-player-link.png) |
| Exact historical matchup and explicit provenance | [Historical game](screenshots/2026-09-10-reliability/historical-game.png) |
| Unknown game does not substitute another matchup | [Unavailable game](screenshots/2026-09-10-reliability/unavailable-game.png) |

## Remaining roadmap

Finish the production data repair and freshness checks, then complete **follow → personal briefing → game sheet → relevant alert → result/history**. Purchasing, restore, support and mobile analytics follow that usable loop. Real-device OAuth, payments and push, active-game behavior, offline/error recovery, Android and iPad remain release gates. No subscription purchase, push delivery, paid pilot, full audit closure or store readiness is claimed here.

The original audit remains a historical record. Its Stat Sheet recommendation was superseded by the owner's Arena Club decision; the accepted illustration, expressive type, tactile controls and team-dependent color direction remain the design authority.
