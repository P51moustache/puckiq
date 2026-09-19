# Task 1 final review — round 2

## Verdict

**Needs one important service-contract fix and one test completion.** The round-two patch fixes strict trending calls and malformed metadata recovery, and it adds a real rendered search/detail/watch/Following test. The projections path still re-enters a compatibility API that suppresses backend errors, and the rendered journey still does not exercise opening a saved player from Following and unwatching in detail.

## Round-one findings

1. **Feed backend failure distinction — NOT FULLY ADDRESSED (important).** Leaders and trending now use strict route-facing APIs (`app/(tabs)/players.tsx:136-150`; `services/playerTrends.ts:263-268,303-306`). Tonight is first checked through `getPlayersPlayingTonightStrict()` (`app/(tabs)/players.tsx:156-157`; `services/playerTrends.ts:329-350`). Immediately afterward, however, `getPlayerProjections()` performs a second tonight query through `getPlayersPlayingTonight()` (`services/playerTrends.ts:428-437`), whose wrapper catches every failure and returns `[]` (`services/playerTrends.ts:351-352`); `getPlayerProjections()` also catches every downstream failure and returns `[]` (`services/playerTrends.ts:493-496`). A failure between the strict preflight and this duplicate query still becomes a valid-looking empty projections section rather than feed Retry. Add a strict projection API or calculate projections from the already verified strict result, and make the route consume that contract.

2. **Detail backend error versus not found — ADDRESSED.** Non-`PGRST116` bio failures throw while a genuine missing row returns `null` (`services/playerDetail.ts:234-252`), and the modal renders separate error/Retry and not-found states (`components/PlayerDetailModal.tsx:80-91,142-160`).

3. **Serialized reactive refresh — ADDRESSED.** Reads and mutations share one module-level chain (`services/watchlist.ts:7,37-50`), preventing a pre-mutation read from publishing after the newer mutation notification. The deferred read test covers that order (`services/__tests__/watchlist.test.ts:60-73`).

4. **Double remove and Undo preservation — ADDRESSED.** The synchronous ref gate rejects repeated removal before React state commits, rows expose busy/disabled state, and a null second removal does not clear the saved Undo record (`app/(tabs)/following.tsx:49-64,145-150`).

5. **Numeric-key rollback compatibility — ADDRESSED.** IDs remain numeric in `puckiq_watchlist`; metadata lives in a sidecar (`services/watchlist.ts:2-3,33-35`).

6. **Malformed metadata fallback — ADDRESSED.** Sidecar parsing now catches malformed JSON and falls back to valid numeric IDs with placeholder records (`services/watchlist.ts:16-27`). The regression supplies malformed metadata beside a valid numeric key (`services/__tests__/watchlist.test.ts:28-33`).

7. **Modal error reset and exact failed-remove retry — ADDRESSED.** Player session state resets when the visible player changes (`components/PlayerDetailModal.tsx:68-78`), and Following retains and retries the exact failed record (`app/(tabs)/following.tsx:48,60-63,149,173`).

8. **Rendered journey assertions — PARTLY ADDRESSED (minor test gap).** The new test renders the real Players and Following screens, keeps a one-character search active, opens a search result, watches from detail, verifies numeric persistence, removes from Following, and performs Undo (`app/(tabs)/__tests__/playerWatchJourney.test.tsx:45-70`). Its second case verifies query-preserving search Retry and rendered watch-write recovery (`app/(tabs)/__tests__/playerWatchJourney.test.tsx:72-89`). It only finds the saved-player detail action after Undo; it never presses that action, verifies the detail, or unwatches from the reopened detail. Extend the first case through that final acceptance path and assert storage/Following update.

## Regression risks

- The strict tonight preflight followed by a second full tonight query doubles backend work and creates the failure window described above (`app/(tabs)/players.tsx:156-159`; `services/playerTrends.ts:428-437`).
- The rendered journey mocks all feed services as successful empty responses (`app/(tabs)/__tests__/playerWatchJourney.test.tsx:31-32`), so it cannot detect route-level strict/compatibility regressions.

## Evidence limits

Read-only source review only. I did not run the full test gate or native iOS checks.
