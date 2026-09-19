# Task 5 independent review — Roster and secondary Arena consistency

## Important findings

1. **A failed roster deletion offers the wrong retry operation.** `components/RosterBuilder.tsx:80-85` maps a `clearRoster()` failure into the shared `saveError` flag. The UI at `components/RosterBuilder.tsx:93` then changes the header action to “Retry,” but that action still calls `save()` at lines 71-79, which invokes `updateRoster()` for an existing roster. It does not retry deletion. The message at line 101 also says the roster “could not be saved,” misdescribing the failed operation. This violates the required failed-write retry and delete semantics and can tell the user recovery succeeded while leaving the roster stored. Track the failed operation separately and retry `clearRoster()` with deletion-specific feedback.

2. **The roster editor is not scroll-safe at the supported 20-player limit or larger iOS text sizes.** `components/RosterBuilder.tsx:95-107` places the format controls, search field, wrapping chip collection, feedback, and results list in one fixed `View`; only the results are a `FlatList`. At 20 chips, especially with long names or Dynamic Type, the chip block can consume the available height and squeeze the results/error controls out of view. The delete action is a fixed sibling below that area. This does not satisfy the explicit scroll-safe-content requirement. The selected roster and controls need a scrolling arrangement that remains usable at the limit and under text scaling.

## Minor findings

1. **Several roster controls remain below the specified 48-point target.** The removable player chips use `minHeight: 44` at `components/RosterBuilder.tsx:113`, and the League-adjacent task wording explicitly requires 48-point targets for controls. The Waiver Wire “See All” control also has only four points of vertical padding at `components/WaiverWireSection.tsx:139-144` if that optional action is supplied.

2. **The Arena migration is incomplete in the rendered My Team subtree.** `components/MyTeamScreen.tsx:388-475`, `components/StartSitCard.tsx:181-233`, `components/WeeklyOutlook.tsx:194-246`, and `components/WaiverWireSection.tsx:184-230` retain many `rinkGlass` text, surface, accent, and semantic colors. On team-dependent light paper/page palettes these fixed legacy colors can lose contrast or ignore the selected club identity. The top-level surfaces were converted, but nested metadata, headings, unavailable cards, badges, dividers, bars, and empty states still bypass Arena roles. This falls short of “complete Arena nested My Team context/contrast/accessibility.”

3. **Focused tests cover only a subset of the roster contract.** `components/__tests__/MyTeamScreen.test.tsx:328-365` covers reopen, Cancel dirty guard, and save failure. It does not exercise `Modal.onRequestClose`, confirmed deletion success/failure and correct retry, new-roster reset, explicit empty-roster behavior, duplicate/max-20 enforcement, first/last/full-name screen behavior, stale search results, search error retry, or accessibility states/targets. `services/__tests__/rosterPlayerSearch.test.ts` verifies query construction and error propagation but cannot establish these UI behaviors.

## Acceptance and quality verdict

**Spec verdict: changes requested.** New/reopen reset, the shared dirty-close callback, save draft retention, stale-search suppression, full-name search service ownership, duplicate/max guards, explicit deletion, and honest optional recommendation copy are present. Failed-delete recovery and scroll safety remain broken, and the Arena/accessibility pass is incomplete.

**Quality verdict: good state-machine direction, incomplete operation modeling and visual conversion.** Moving Supabase access into `services/rosterPlayerSearch.ts` respects the architecture, and request IDs correctly reject out-of-order search responses. Reusing one boolean for save and delete failures creates the recovery bug; typed failure state would make the correct retry and message explicit.
