# Task 2 independent review — personal models and replay

## Verdict

**Needs revision.** Provenance and published-versus-local copy are sound, and the editor save gate and availability-request invalidation are credible. The implementation does not yet satisfy the iOS navigation, replay concurrency, replay eligibility, Arena continuity, or accessibility portions of Task 2.

## Provenance

- Reviewed only `/Users/zach/Projects/active/puckiq-ux-flow-completion` against baseline `7cc6791`.
- `task-2-review.diff` contains the seven tracked Task 2 file diffs and verbatim sections for all four new Task 2 files/tests (2,207 lines total). Its scope agrees with `task-2-report.md`; no provenance mismatch found.
- Inspected outside the Task 2 diff only for named risks: `services/backtesting.ts` (availability/replay eligibility and async behavior), `components/ModelAccuracyCard.tsx` (the screenshot's legacy stats bar), `app/(tabs)/_layout.tsx` and `app/(tabs)/stats.tsx` (F08 entry/exit behavior).
- Reviewed native evidence `/tmp/puckiq-ux-models.jpg`. No source, index, or git state was changed. No broad test suite was rerun.

## Findings

### Important — F08: Models has no explicit iOS exit

`models` is a hidden tab route (`app/(tabs)/_layout.tsx:22`) pushed from League (`app/(tabs)/stats.tsx:118`), but the Models screen renders only a list and editor modal (`app/(tabs)/models.tsx:72-100`). It has no Back control or header. The iOS screenshot confirms this and also shows white status-bar content over the light page; source hard-codes `light-content` (`app/(tabs)/models.tsx:73-75`). A user who enters from League has no visible, dependable route back. Add an Arena header/back action that returns to the origin (with a safe fallback) and choose status-bar content from the light page role.

### Important — replay results can become stale and be saved onto a different draft state

`handleRunBacktest` has no synchronous single-flight/request token and unconditionally applies progress, results, weight hash, and `onSaveResults` after awaiting (`components/model-builder/BacktestPanel.tsx:138-195`). The rest of the editor remains interactive during the run (`components/model-builder/ModelEditScreen.tsx:265-380`), and Cancel can close the editor because it is disabled only while saving (`components/model-builder/ModelEditScreen.tsx:235-244`). Thus a user can start a replay, change weights, or discard/close; the late run still calls `onSaveResults` and associates the old run with the current draft. Two rapid Run presses can also pass the state-based guard before `isRunning` commits. Use a ref-backed run ID/single-flight gate, invalidate it on weight/range change and unmount/close, and accept progress/results only when the request still matches the model weights and range that launched it.

### Important — “Available records” does not represent replay-eligible records

Availability counts every completed regular-season game in the date range (`services/replayAvailability.ts:16-35`). The actual replay later discards every date without a pregame standings snapshot and every game whose teams are absent from that snapshot (`services/backtesting.ts:520-583`), then reports only retained results (`services/backtesting.ts:604-614`). The dialog can therefore promise, for example, “Available records: 12” (`components/DataSeedingModal.tsx:117-127`) while Run replay produces zero usable games. Scope the check to actual replay eligibility, or label the count as completed games and separately determine/report usable replay records. Add a regression where completed games exist but no eligible pregame standings do.

### Important — Arena styling stops at wrappers; nested model UI remains legacy dark

The list shell and model-card paper were recolored, but `ModelAccuracyCard` still renders the dark `theme.factbox` empty/stats strip (`components/ModelAccuracyCard.tsx:245-285`), exactly visible as the dark “No picks yet” bar in the iOS screenshot. The editor body retains legacy colors for its text/input/card surfaces (`components/model-builder/ModelEditScreen.tsx:468-529`); FactorEditor uses legacy cards, factboxes, ink, accent, and category colors (`components/model-builder/FactorEditor.tsx:341-470`); BacktestPanel does the same (`components/model-builder/BacktestPanel.tsx:441-570`); WeightSlider and its help modal are entirely static-theme (`components/model-builder/WeightSlider.tsx:203-311`). This creates dark islands on the Arena light page and ignores home-team palette roles. Thread Arena roles through these actual nested views, including help and replay states, rather than styling only their containers.

### Important — several claimed accessible controls are incomplete

The entire model card is a tappable activation control but has no role, label, or selected state and contains three nested touchables (`components/model-builder/ModelList.tsx:156-279`), producing ambiguous focus/action semantics. FactorEditor’s Reset All and per-category Reset controls lack roles/labels/state (`components/model-builder/FactorEditor.tsx:255-265,309-332`). The replay range controls expose selected state but no explicit labels, and the unavailable-state Check availability control lacks a role/label (`components/model-builder/BacktestPanel.tsx:204-266,336-354`). Data-check Cancel and secondary Close controls also omit roles/labels (`components/DataSeedingModal.tsx:145-150,160-165,187-193`). Add explicit activation controls/state and avoid nesting independent actions inside the model activation touch target.

### Minor — modal styling and touch targets remain inconsistent

The duplicate dialog uses unadapted legacy modal styles after an Arena list (`components/model-builder/ModelList.tsx:348-392` and styles following line 580). The data-check close icon is only 28×28 (`components/DataSeedingModal.tsx:239-246`), and WeightSlider’s visible slider height is 40 (`components/model-builder/WeightSlider.tsx:234-237`), below the 48-point target stated in the task report. Apply Arena paper/ink/edge/action roles and make the interactive frames at least 48 points.

## Satisfied evidence

- Published AI provenance is presented separately from persisted local models, with truthful copy that local selection does not change published forecasts (`components/model-builder/ModelList.tsx:309-323`). No synthetic AI model is persisted in this path.
- Cancel and modal request-close share the same dirty-draft guard (`app/(tabs)/models.tsx:83-96`; `components/model-builder/ModelEditScreen.tsx:154-170`). Save uses a synchronous ref gate, preserves the mounted draft on failure, and reenables Save (`components/model-builder/ModelEditScreen.tsx:172-224`), with focused coverage in `components/model-builder/__tests__/ModelEditScreen.behavior.test.tsx:54-97`.
- Availability queries use the selected exact date range and regular-season/final-state filters (`services/replayAvailability.ts:16-25`). The availability modal invalidates late requests when explicitly closed (`components/DataSeedingModal.tsx:55-93`).
- Four-factor replay copy names the included factors and excluded sliders and avoids claiming full-model validation (`components/model-builder/BacktestPanel.tsx:372-387`).

## Quality assessment

The change has a solid product-copy foundation and useful focused tests, but its quality is below merge-ready because the acceptance report overstates visual and accessibility completion and does not cover the most consequential replay race. The four Important implementation findings and the F08 cross-task gap should be fixed and checked on native iOS before Task 2 is accepted.
