# ML Pipeline Audit Fix — Execution Plan

## Strategy: Maximum Parallelism

9 agents working simultaneously, each owning distinct files to avoid merge conflicts.
Estimated wall-clock time: ~5 minutes for all agents to complete.

---

## Agent Assignments

### Agent 1: Quick Config & Model Fixes
**Files**: `ml/config.py`, `ml/models/totals.py`, `ml/models/baselines.py`
**Tasks**:
- [C5] Tighten `MAX_ECE_FOR_PROMOTION` from 0.35 to 0.15 in config.py
- [H2] Add weight normalization assertion in TotalsModel.__init__ (`assert abs(poisson_weight + lgbm_weight - 1.0) < 1e-6`)
- [C4] Add temporal ordering assertion in baselines.py `evaluate_baselines()` before split
- Run existing tests for these files to verify no breakage

### Agent 2: Feature System Cleanup
**Files**: `ml/features/compute.py`, `ml/features/registry.py`, `ml/features/features.yaml`
**Tasks**:
- [C2] Add compute_type validation in `compute_all_features()` — raise ValueError for unknown types instead of silent NaN
- [C2] Add clear code comments documenting that player_lookup and cross_model are handled outside compute_all_features() (player_lookup by compute_player_features(), cross_model by pipeline injection)
- [M1] Refactor registry.py config extraction from 7-level nested .get() to explicit dict lookup using compute_type name
- [M4] Add warning log in `_compute_rolling_xg()` if >20% of shots have missing coordinates
- Run feature tests to verify no breakage

### Agent 3: Dashboard Fixes
**Files**: `ml/dashboard/pages/6_player_props.py`, `ml/dashboard/pages/4_overfitting.py`, `ml/dashboard/pages/5_prediction_review.py`, `ml/dashboard/pages/7_pipeline_control.py`
**Tasks**:
- [H1] Add prominent "Work in Progress" warning banner to Player Props page explaining UNIQUE constraint limitation
- [M3] Fix overfitting page double-calculation of overfit_gap
- [M3] Add absolute timestamps alongside relative times in Pipeline Control
- [M3] Add "last refreshed" caption with cache TTL info to pages that load data
- Verify dashboard pages still load (syntax check)

### Agent 4: Weekly Retrain Overhaul
**Files**: `ml/pipeline/weekly_retrain.py`, `ml/evaluation/validation.py`
**Tasks**:
- [H3] Wire concept drift detection into weekly retrain — call `detect_concept_drift()` after walk-forward CV, log warnings if drift detected
- [C3] Add quality gates to player props promotion — use similar checks as other models (underfitting threshold, comparison to existing model)
- [C4] Replace player props 80/20 split with walk-forward CV for consistency
- [C4] Use all walk-forward CV fold OOS predictions for ECE calibration instead of just last fold
- [M2] Add comment documenting that train_metrics in metadata are CV-averaged, not final model metrics
- Run pipeline integration tests to verify

### Agent 5: Monthly Eval Expansion
**Files**: `ml/pipeline/monthly_eval.py`
**Tasks**:
- [H4] Refactor `_run()` to loop over all model types (game_winner, spread, totals)
- Add appropriate metrics per model type (accuracy/Brier for game_winner, MAE/RMSE for spread/totals)
- Maintain backwards compatibility with existing evaluation schema
- Add spread and totals baseline comparisons
- Run any existing monthly eval tests

### Agent 6: Test daily_run.py
**Files**: `ml/tests/test_daily_run.py` (NEW)
**Tasks**:
- [C1] Create comprehensive test file for daily_run.py
- Mock Supabase client and model storage
- Test `_predict_game_winners()`, `_predict_spreads()`, `_predict_totals()`
- Test graceful failure when model is missing/corrupted
- Test data freshness check behavior
- Test prediction write operations (mock)
- Test cross-model feature injection failure paths

### Agent 7: Test model_storage.py
**Files**: `ml/tests/test_model_storage_lifecycle.py` (NEW)
**Tasks**:
- [C1] Create comprehensive test file for model_storage.py
- Test full lifecycle: save_model() → load_model() → verify checksum
- Test corrupted artifact detection (should fail loudly)
- Test manifest management: update, version tracking, cleanup old versions
- Test edge cases: missing manifest, empty storage directory
- Use tmp directories for isolation

### Agent 8: Test supabase_client.py
**Files**: `ml/tests/test_supabase_io.py` (NEW)
**Tasks**:
- [C1] Create comprehensive test file for supabase_client.py
- Mock Supabase responses
- Test retry logic with tenacity (simulate failures then success)
- Test `check_data_freshness()` when no recent sync exists
- Test `read_games()`, `read_standings()` on empty/missing tables
- Test pagination handling for >1000 rows
- Test error paths: connection timeout, auth failure, schema mismatch

### Agent 9: Test Goalie Fallback & Pre-Prediction Validation
**Files**: `ml/tests/test_goalie_fallback.py` (NEW), `ml/tests/test_prediction_validation.py` (NEW)
**Tasks**:
- [H5] Test goalie save_pctg NULL fallback computation in compute.py (saves/(saves+goals_against))
- Test edge cases: both saves and goals_against are 0, one is NULL, negative values
- [C1] Create pre-prediction validation tests
- Test that feature matrix has expected columns before predict
- Test NaN handling differences: LightGBM keeps NaN, Poisson fills 0
- Test that mismatched feature columns raise clear errors

---

## Dependency Graph

```
All 9 agents run in PARALLEL (Wave 1)
No cross-agent dependencies — each owns distinct files

Agent 1: config.py, totals.py, baselines.py
Agent 2: compute.py, registry.py, features.yaml
Agent 3: dashboard pages (4, 5, 6, 7)
Agent 4: weekly_retrain.py, validation.py
Agent 5: monthly_eval.py
Agent 6: NEW test_daily_run.py
Agent 7: NEW test_model_storage_lifecycle.py
Agent 8: NEW test_supabase_io.py
Agent 9: NEW test_goalie_fallback.py, test_prediction_validation.py
```

## Post-Completion

After all agents finish:
1. Run full test suite: `ml/.venv/bin/python -m pytest ml/tests/ -x -q`
2. Review any conflicts or issues
3. Single commit with all changes

---

## What's NOT in this plan (deferred)

- Totals model hyperparameter tuning support (M5) — requires design discussion
- Dashboard mobile/responsive optimization — low priority
- Pipeline dry-run mode — nice to have
- Player props UNIQUE constraint DB fix — requires Supabase schema change
- Streamlit column_config migration — cosmetic
- Pre-prediction validation enforcement in production code (tests only for now)

---

*Plan created: 2026-02-18*
*Estimated agents: 9 parallel*
*Estimated wall-clock time: ~5 minutes*
*Files modified: ~15 existing + 4 new test files*
