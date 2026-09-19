# Task 1 — Players and Following

## Changed files

- `app/(tabs)/players.tsx`
- `app/(tabs)/following.tsx`
- `components/ElevatedPlayerRow.tsx`
- `components/HeroLeaderCard.tsx` (ownership expanded by controller for native accessibility)
- `components/PlayerDetailModal.tsx`
- `components/__tests__/ElevatedPlayerRow.test.tsx`
- `hooks/useWatchlist.ts`
- `services/watchlist.ts`
- `services/playerSearch.ts`
- `services/playerSearchSession.ts`
- `services/playerTrends.ts`
- `services/playerDetail.ts`
- `services/__tests__/watchlist.test.ts`
- `services/__tests__/playerSearchSession.test.ts`

## Behavior delivered

- Search stays mounted for zero/one-character queries until explicit Cancel, keeps the query and keyboard lifecycle, debounces independently, rejects stale out-of-order results, and distinguishes a successful empty response from a failed request with an inline Retry.
- The player feed and player detail have explicit error recovery. Detail closes back to the unchanged search/list state.
- `puckiq_watchlist` now has one serialized persistence service. The shipped key remains a numeric ID array for older binaries, while rich records use `puckiq_watchlist_metadata_v1`. Reads and writes share one queue, so a late refresh cannot overwrite a newer published mutation. Legacy IDs remain openable and Following enriches their labels from player detail when data is available.
- Any searchable, ranked, projected, goalie, or spotlight player can be opened and watched from detail. Elevated rows retain their direct watch action. Failed watch writes leave the previous state and show a visible Retry action.
- Following now renders the saved-player collection, reopens detail, supports removal plus exact-record Undo, exposes storage/read/write recovery, states that the collection is saved on this device, and refreshes on focus.
- Following removal has an immediate same-frame guard and busy semantics. Failed removal retains its target and exposes a labeled Retry control.
- Following includes a discoverable My Team entry. Team links now carry `from=following` for Task 4's origin-aware return handling.
- Player detail uses Arena home-team page/action roles at its top-level and hero, and close/watch/retry controls have explicit labels, state, and 48-point targets.
- Route-facing feed/detail calls now use strict, compatibility-preserving service variants: backend failures reach Retry UI, while a genuine missing player remains distinct. Modal watch errors reset when the visible player changes.
- Search results, stat chips, spotlight cards, leader cards, elevated rows, and search controls now expose action/entity labels and selected/busy semantics where relevant.

## TDD evidence

- Red: `npx jest services/__tests__/watchlist.test.ts --runInBand` failed because `services/watchlist.ts` did not exist.
- Green: the same command passed 4/4 tests after the serialized service was implemented.
- Red: `npx jest services/__tests__/playerSearchSession.test.ts --runInBand` failed because `services/playerSearchSession.ts` did not exist.
- Green: the session tests passed after implementing generation-based stale-result handling and separate success/error outcomes.

## Fresh verification

- Round 1 final focused Jest command covered watchlist, strict feed/detail, search session, player row, Players, and primary-screen regressions — 7 suites passed, 103 tests passed.
- `npx tsc --noEmit` — exit 0, no output.
- Focused ESLint over the final owned production files — exit 0, no output.

## Independent review round 1

- Fixed all four important findings: backend error propagation, stale watchlist refresh ordering, double-remove Undo loss, and deployed numeric-key compatibility.
- Fixed both implementation-level minor findings: modal error reset and explicit Following remove Retry.
- Added regressions for strict/compatibility service outcomes, numeric-key persistence, and a deferred refresh ordered against a newer mutation.

## Independent review round 2

- Players now uses strict variants for leaders, trending-up/down, and tonight's schedule/roster preflight. Selective failures in any route-used feed source reach the visible feed Retry; compatibility APIs retain empty-array behavior for existing consumers.
- Corrupt optional metadata now falls back to valid numeric IDs and honest placeholder labels.
- Added a rendered two-screen journey regression using real Players, PlayerDetailModal, Following, useWatchlist, and watchlist service behavior. It covers one-character search persistence, search retry with query retention, arbitrary-player detail watch, failed-save Retry, Following collection, remove/Undo, and restored reopenability.
- Final Task 1 focused run: 8 suites passed, 108 tests passed. Fresh TypeScript check exited 0.

## Remaining runtime checks

- Native iOS walkthrough, 320-wide layout, 200% Dynamic Type, VoiceOver focus return, keyboard preservation, sheet dismissal, and reduced-motion behavior remain controller-level verification.
- A legacy ID whose player detail is unavailable remains labeled honestly as `Player #<id>` and can still be opened or removed.
