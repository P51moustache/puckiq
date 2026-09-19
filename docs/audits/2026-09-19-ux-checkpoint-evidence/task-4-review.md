# Task 4 independent review — Home, Book, League and navigation

## Important findings

1. **Team Back does not reliably honor the declared Following/League origin on warm entry.** `app/(tabs)/teams.tsx:35-38` calls `router.back()` whenever any router history exists and consults `teamOriginRoute(origin)` only when `canGoBack()` is false. A warm external/deferred team link opened while another route is in history therefore returns to that unrelated route, even though an absent/invalid `from` is normalized to League. The same mismatch can occur if a route is replaced or restored with history unrelated to the supplied `from`. The acceptance criterion is origin-aware behavior for Following/League with safe cold fallback; `canGoBack()` only establishes that some history exists, not that its preceding entry is the intended origin. The route needs either verifiable navigation provenance or an explicit origin destination strategy that cannot create push loops.

2. **The acceptance-critical navigation and UI behavior has no focused screen-level regression coverage.** `services/__tests__/entityReliability.test.ts:21-29` tests only the pure origin parsers, and `services/__tests__/seasonBook.test.ts:49-74` tests storage retry and score formatting. There is no test that mounts the Expo Router screens or proves Home/Book/deep-link cold and warm Back behavior, scroll restoration, League comparison retention across team detail, invalid-entity recovery, removal confirmation/failure UI, actionable compare slots, retry races, or the four-tab accessibility contract. This is material because the first finding cannot be detected by the existing pure-helper assertions. The controller's iOS runtime pass is necessary, but focused automated coverage is still part of Task 4's acceptance criteria.

## Minor findings

1. **A recovered Season Book result request leaves the old error visible.** `components/arena/TonightScreen.tsx:105-117` replaces `results` after success but never clears `bookError`. After one `fetchArenaResults` failure, a later successful request triggered by an entry change continues to show the stale failure note at `components/arena/TonightScreen.tsx:283`.

2. **Team retry guidance is wrong for Following-origin navigation.** `app/(tabs)/teams.tsx:31` always says to retry from League even when `from=following` and the visible Back action correctly says “Back to Following.” This weakens the origin-preserving recovery path.

## Acceptance and quality verdict

**Spec verdict: changes requested.** Immutable Season Book storage behavior, confirmation, valid-zero/invalid-score handling, comparison request invalidation, retry controls, published-model copy, four visible tab labels, and the safe not-found surface are implemented coherently. The warm team-origin behavior does not meet the stated origin contract, and the required focused behavioral coverage is missing.

**Quality verdict: mostly sound with one navigation design flaw.** Data access remains outside UI and the request cancellation patterns are reasonable. The shared `canGoBack()` decision is too weak to encode entity origin, and stale error clearing needs a small correction.
