# Task 2 — Personal models and replay

## Files

- `app/(tabs)/models.tsx`
- `components/DataSeedingModal.tsx`
- `components/ModelAccuracyCard.tsx`
- `components/model-builder/BacktestPanel.tsx`
- `components/model-builder/FactorEditor.tsx`
- `components/model-builder/ModelEditScreen.tsx`
- `components/model-builder/ModelList.tsx`
- `components/model-builder/WeightSlider.tsx`
- `components/model-builder/submissionGate.ts` (new)
- `components/model-builder/replayRunGuard.ts` (new)
- `components/model-builder/sliderAdjustment.ts` (new)
- `components/model-builder/modelNavigation.ts` (new)
- `components/model-builder/__tests__/ModelEditScreen.behavior.test.tsx` (new)
- `components/model-builder/__tests__/submissionGate.test.ts` (new)
- `components/model-builder/__tests__/replayRunGuard.test.ts` (new)
- `components/model-builder/__tests__/sliderAdjustment.test.ts` (new)
- `components/model-builder/__tests__/modelNavigation.test.ts` (new)
- `services/replayAvailability.ts` (new)
- `services/__tests__/replayAvailability.test.ts` (new)

## Acceptance evidence

- F04: Models now presents a separate, read-only “Published PuckIQ AI” provenance card. It states that Arena forecasts retain their published source/time and are unaffected by personal weights. Persisted model loading is unchanged and no AI entry is inserted into storage. Local models are headed “My model experiments” and described as device-local preview/four-factor replay inputs.
- F06: `ModelEditScreen` exposes one `requestClose()` contract. Both its Cancel action and the parent full-screen modal's Android `onRequestClose` use the same dirty guard with Keep editing and explicit Discard. A component regression changes the draft and invokes the external close contract. Save failure retains the mounted draft and reenables Save. A synchronous ref gate prevents two save calls before React state commits.
- F12: Removed global/current-season and all-season count checks. `checkReplayAvailability(range)` filters the exact selected start/end period, completed regular-season games, reports exact count and latest included date, and throws a retryable error. Backtest range changes recheck that exact range and discard stale outcomes. The dialog says “Check availability,” “Available records,” and explicitly says it is read-only and downloads nothing. Closing invalidates in-flight request IDs, including close/reopen races. Replay copy discloses its four factors and all excluded sliders.
- Duplicate submission: duplicate-model writes run through a tested single-flight gate and render a disabled busy state.
- F15/F18: Models page, provenance, editor header, and replay dialog consume Arena palette/type roles; newly light Arena paper surfaces explicitly use Arena ink/muted/link colors. Primary actions use action/actionInk. Model list/edit/duplicate/delete, editor save/cancel, range controls, replay run, dialog controls, category toggles, slider/help/reset controls have roles/labels/state where applicable; primary rows and controls have 48-point minimum targets.

## League interface/copy

Task 4 should label Arena probabilities **Published PuckIQ AI** and use: “Arena forecasts are published by PuckIQ AI with their source and publication time. Changing a personal model never changes those published probabilities.” Link the models destination as **My model experiments** and describe it as: “Choose local weights for previews and four-factor historical replay. These experiments stay on this device.” Do not construct or persist a PuckIQ AI `PredictionModel`.

## Commands and results

- Red: `npx jest services/__tests__/replayAvailability.test.ts components/model-builder/__tests__/ModelEditScreen.behavior.test.tsx --runInBand` — failed because the scoped service and imperative close contract did not exist.
- Red: `npx jest components/model-builder/__tests__/submissionGate.test.ts --runInBand` — failed because the gate did not exist.
- `npx jest services/__tests__/replayAvailability.test.ts services/__tests__/backtesting.test.ts components/model-builder/__tests__ --runInBand` — 9 suites passed, 167 tests passed.
- `npx tsc --noEmit` — exit 0.
- Scoped ESLint across every owned production file — exit 0, no output.
- `git diff --check` — exit 0.
- `npm test -- --runInBand` — exit 0. Output contains the repository's existing React 19 renderer/act and intentional error-path console noise and was truncated by the command transport.

## Gaps / review notes

- Native model/replay interaction was not independently rendered in this task. Controller's native pass should verify small-screen wrapping, keyboard behavior, home-team palettes, slider accessibility announcements, and Android hardware-back behavior.
- No live backend mutation occurs: availability is a read-only Supabase count/latest-date query.
- Full app tests ran while other agents were actively editing the shared worktree. Controller should rerun the complete gate after freezing all tasks.

## Independent review fix round 1

- Added an explicit 48-point Models Back control. It returns through router history and replaces with League as a cold-entry fallback. The light Arena page now requests dark iOS status-bar content.
- Added a synchronous replay-run token keyed to the launching four-factor weights and range. Duplicate starts are rejected. Weight/range changes and unmount invalidate the token; progress, results and `onSaveResults` are ignored unless the token and launch key remain current.
- Availability now runs the same replay engine with Classic four-factor weights and cache bypassed. Its count is therefore the exact set retained after pregame standings/team eligibility checks. Replay game mapping rejects missing/non-finite final scores while retaining valid zero scores.
- Completed Arena conversion through `ModelAccuracyCard`, `ModelEditScreen`, `FactorEditor`, `WeightSlider` and help modal, `BacktestPanel` and results, `LivePreview`, availability states, and duplicate dialog. Light surfaces use paper/soft with ink/muted/link; team actions use action/actionInk; borders use edge/frame. Removed remaining legacy theme colors from this nested model UI.
- Model activation is now a distinct labeled button outside the card's edit/duplicate/delete controls, with selected/disabled state. Added missing labels/roles/states to resets, range choices, availability controls, dialog close/cancel, preview disclosure and comparison switch. Native slider accessibility actions increment/decrement exactly one step with clamping; visible slider/help/close/action frames are at least 48 points.

### Fix-round regressions and verification

- Red: `npx jest components/model-builder/__tests__/replayRunGuard.test.ts --runInBand` failed because the run token did not exist.
- Red: scoped backtesting test failed because score-validating `mapReplayGames` did not exist.
- Red: `npx jest components/model-builder/__tests__/modelNavigation.test.ts --runInBand` failed because the history/fallback navigation contract did not exist.
- `npx jest services/__tests__/replayAvailability.test.ts services/__tests__/backtesting.test.ts components/model-builder/__tests__ --runInBand` — 12 suites passed, 171 tests passed.
- `npx eslint 'app/(tabs)/models.tsx' components/DataSeedingModal.tsx components/ModelAccuracyCard.tsx components/model-builder/BacktestPanel.tsx components/model-builder/FactorEditor.tsx components/model-builder/LivePreview.tsx components/model-builder/ModelEditScreen.tsx components/model-builder/ModelList.tsx components/model-builder/WeightSlider.tsx components/model-builder/modelNavigation.ts components/model-builder/replayRunGuard.ts components/model-builder/sliderAdjustment.ts components/model-builder/submissionGate.ts services/backtesting.ts services/replayAvailability.ts && git diff --check && npx tsc --noEmit` — exit 0, no output.
- Native iOS rerender remains for the controller's scoped rereview; no simulator result is claimed here.
