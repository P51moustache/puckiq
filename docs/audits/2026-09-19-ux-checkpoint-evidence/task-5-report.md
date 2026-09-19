# Task 5 — Roster and secondary visual consistency

## Changed files

- `components/RosterBuilder.tsx`: resets every opening from current roster props; guards dirty cancel and iOS request-close; preserves failed saves with visible Retry; offers explicit confirmed roster deletion; enforces duplicate and 20-player limits; separates search loading, empty, and failure states; ignores stale search responses; uses Arena roles, readable type, control roles/states/labels, and 48-point primary controls.
- `services/rosterPlayerSearch.ts`: owns active-player Supabase search across first, last, and full name fields so UI code no longer accesses the database.
- `components/MyTeamScreen.tsx`: adopts Arena page/action roles, enlarges and labels roster actions, removes fabricated teaser player names and projections, and removes legacy entry animation.
- `components/StartSitCard.tsx`, `components/WeeklyOutlook.tsx`, `components/WaiverWireSection.tsx`: adopt Arena paper/edge/frame/type roles on rendered My Team cards and remove legacy entry animations. Waiver Wire also removes the decorative emoji and labels its action.
- `components/__tests__/MyTeamScreen.test.tsx`: covers fresh roster state on reopen, dirty-close confirmation, retained draft and retry on save failure, plus honest empty-state content.
- `services/__tests__/rosterPlayerSearch.test.ts`: covers the three-field active-player query and preserves database failure as an error rather than an empty result.
- `constants/arenaTeamPalettes.json`: darkens only ANA `link` from `#B05D31` to `#AC592E` for paper contrast; all other palette roles remain unchanged.

## Commands and results

- RED: `npx jest services/__tests__/rosterPlayerSearch.test.ts --runInBand` — failed because `rosterPlayerSearch` did not exist.
- GREEN: same command — 1 suite, 2 tests passed.
- `npx tsc --noEmit --pretty false` — exit 0.
- `npx jest components/__tests__/MyTeamScreen.test.tsx services/__tests__/rosterPlayerSearch.test.ts --runInBand --silent` — 2 suites, 18 tests passed.
- Final `git diff --check` — exit 0. A concurrent final typecheck is currently blocked by Task 2's in-progress `services/__tests__/backtesting.test.ts` reference to missing `mapReplayGames`; the Task 5-focused tests still pass 18/18.

## Gaps / handoff

- Controller owns the iPhone runtime walkthrough and complete repository verification gate.
- `WaiverWireScout.tsx` is not rendered by the current My Team route; the rendered `WaiverWireSection` was updated. No route or navigation ownership was expanded.

## Fix round 1 after independent review

- Replaced the shared write-error boolean with a typed failed operation. A failed delete now reports that the roster is unchanged and its visible `Retry delete` action invokes `clearRoster` again; it cannot fall through to `updateRoster`.
- Moved the full editable body and delete action into one keyboard-avoiding `ScrollView`. The header Save and Cancel remain outside it, while `keyboardShouldPersistTaps="handled"` and interactive iOS keyboard dismissal keep search results and actions reachable.
- Raised removable chips and optional Waiver Wire See All to 48-point minimum targets. Long player names can wrap to two lines.
- Finished rendered nested Arena-role overrides for My Team headings, metadata, unavailable cards, progress tracks, dividers, neutral recommendation states, and card surfaces. Semantic green/red/amber remain data-only. Removed the unsubstantiated `HOT` badge.
- Expanded focused UI coverage for failed-delete retry dispatch, dirty Cancel and modal request-close, Keep/Discard choices, existing and new-roster reopen reset, duplicate and 20-player enforcement, stale search suppression, and keyboard-safe scroll configuration.

Fresh fix-round verification:

- `npx tsc --noEmit --pretty false` — exit 0.
- `npx jest components/__tests__/MyTeamScreen.test.tsx services/__tests__/rosterPlayerSearch.test.ts --runInBand --silent` — 2 suites, 23 tests passed.
- `git diff --check` — exit 0.
