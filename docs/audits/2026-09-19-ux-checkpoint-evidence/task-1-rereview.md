# Task 1 recovery re-review — Players and Following

## Verdict

**Recovery is incomplete.** The watchlist queue, same-frame removal guard, rollback-compatible numeric key, detail error distinction, and explicit failed-remove retry address most implementation findings. Feed failures are still only strict for the leaders path, the metadata sidecar can prevent recovery from a valid numeric key, and the required screen-level search/detail/watch/Following journey assertions are still absent.

## Prior important findings

1. **Backend failures shown as empty/not-found — NOT ADDRESSED for the whole feed; ADDRESSED for detail.** Players uses `getLeagueLeadersStrict()` and renders Retry when that call rejects (`app/(tabs)/players.tsx:131-189`; `services/playerTrends.ts:263-268`). However, after leaders succeed, trending players still catch every failure and return `[]` (`services/playerTrends.ts:293-301`), tonight players still convert query/roster failures to empty results (`services/playerTrends.ts:324-347`), and the feed calls those compatibility APIs (`app/(tabs)/players.tsx:145-157`). A selective failure in those dependencies still looks like valid empty sections and never reaches the feed Retry state. Detail now treats `PGRST116` as not found and throws other backend errors (`services/playerDetail.ts:234-252`); the modal renders separate Retry and not-found states through `getPlayerDetailStrict()` (`components/PlayerDetailModal.tsx:80-91,142-160`).

2. **Late refresh overwriting a newer mutation — ADDRESSED.** Reads and mutations append to the same module-level promise chain (`services/watchlist.ts:7,33-46`), and every hook refresh goes through that service (`hooks/useWatchlist.ts:16-28`). A read started before a mutation must finish before the mutation reads, persists, and publishes its newer snapshot. The deferred-read regression verifies the ordering at the service contract (`services/__tests__/watchlist.test.ts:54-67`).

3. **Double remove destroys Undo — ADDRESSED.** `removingRef` is set synchronously before the first await and rejects a second same-frame invocation (`app/(tabs)/following.tsx:49-64`). The row also exposes busy/disabled state while removal is pending (`app/(tabs)/following.tsx:145-150`), and a null removal no longer clears the existing Undo snapshot (`app/(tabs)/following.tsx:58-60`).

4. **Rollback compatibility of the shipped numeric key — ADDRESSED.** The established `puckiq_watchlist` key remains a numeric ID array, while rich records are stored in `puckiq_watchlist_metadata_v1` (`services/watchlist.ts:2-3,29-31`). The regression asserts both representations (`services/__tests__/watchlist.test.ts:48-51`).

## Prior minor findings

1. **Detail watch failure leaking to another player — ADDRESSED.** The modal resets loading, detail, detail error, watch error, and watch busy state when the visible player session changes (`components/PlayerDetailModal.tsx:68-78`).

2. **Failed remove lacks an actionable retry target — ADDRESSED.** Following retains `failedRemove`, labels the affected row as Retry, and renders a separate retry control bound to that exact player (`app/(tabs)/following.tsx:48,60-63,149,173`).

3. **Actual journey coverage — NOT ADDRESSED.** The active Players test still describes itself as a scaffold/manual mock test and directly calls obsolete `playerLeaders` mocks rather than rendering the current screen flow (`app/(tabs)/__tests__/players.test.tsx:1-9,74-85,235-255`). Repository test search found no behavioral test that types one character, retries while preserving the query, opens a real search result, watches it in detail, finds it in Following, removes/undoes it, or reopens and unwatches it. The new strict and queue tests validate service helpers, not the acceptance journey.

## New important gap introduced by the recovery

- **Malformed metadata defeats the numeric compatibility fallback.** `readRaw()` parses the sidecar with an unguarded `JSON.parse(metadataRaw)` before building records (`services/watchlist.ts:16-23`). If the metadata write is corrupt while `puckiq_watchlist` still contains valid numeric IDs, the whole read rejects and Following cannot show placeholder records from the valid compatibility key. Parse/validate the sidecar independently and fall back to numeric placeholders; add a regression with valid IDs and malformed metadata. This is also the remaining metadata-failure consistency gap named for this recovery.

## Evidence limits

No source files, index, or git state were changed. Per assignment, I did not run the broad test gate or native iOS checks; the controller owns those checks.
