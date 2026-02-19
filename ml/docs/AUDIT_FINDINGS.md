# ML Pipeline Full Audit — February 2026

## Executive Summary

Five parallel audit agents examined the entire ML pipeline: models/training, feature engineering, dashboard UI/UX, pipeline infrastructure, and test coverage. The pipeline is **production-ready** with solid architecture, but has notable gaps in test coverage, feature system inconsistencies, and a few silent failure risks.

**Overall Grade: B+ (85/100)**

---

## Audit Scores by Area

| Area | Score | Status |
|------|-------|--------|
| Pipeline Architecture | 9/10 | Excellent |
| Model Implementations | 8/10 | Good |
| Feature Engineering | 7/10 | Good (inconsistencies) |
| FeatureCache Design | 9/10 | Excellent |
| Data Leakage Prevention | 9/10 | Excellent |
| Dashboard UI/UX | 7/10 | Good (one dead page) |
| Dashboard Architecture | 8/10 | Good |
| Pipeline Infrastructure | 9/10 | Excellent |
| GitHub Actions | 10/10 | Excellent |
| Dependencies | 10/10 | Minimal, pinned |
| Unit Test Quality | 8/10 | Good assertions |
| Integration Test Coverage | 3/10 | Poor — massive gaps |
| Error Path Testing | 3/10 | Poor — 7 of 366 tests |
| Data Validation | 4/10 | Weak — ad-hoc |
| Directory Structure | 10/10 | Clean, no dead files |

---

## CRITICAL Issues

### C1. Silent Failure Risk — Pipeline Paths Untested
- **Files**: `daily_run.py` (19 functions, 0 tests), `monthly_eval.py` (0 tests), `model_storage.py` (0 tests), `supabase_client.py` (30+ functions, 2 tests)
- **Risk**: If daily prediction pipeline breaks, users get stale predictions with no alert
- **Evidence**: Only 7 `pytest.raises()` across 366 tests — error paths almost completely untested
- **Fix**: Add dedicated test files for each untested module

### C2. Feature System Inconsistencies
- **Files**: `features.yaml`, `compute.py`, `registry.py`
- **Issue 1**: `player_lookup` features (5 features) defined in YAML but `compute_all_features()` has no handler — computed by separate `compute_player_features()`. If used in game model, silent NaN.
- **Issue 2**: `cross_model` feature (`gw_home_win_prob`) defined in YAML but set to NaN in compute.py, then manually injected by pipeline. Misleading architecture.
- **Issue 3**: No compute_type validation — a typo like `"rolling_tam"` in YAML would silently produce NaN features.
- **Fix**: Add validation, document architectural decisions, raise errors for unknown types

### C3. Player Props Has No Quality Gates
- **File**: `weekly_retrain.py` lines 448-491
- **Issue**: Always promotes player_props — no comparison, no quality gates, no underfitting check
- **Fix**: Apply `_maybe_promote()` or equivalent gates

### C4. Data Leakage Risks
- **Player props**: Simple 80/20 split instead of walk-forward CV
- **Logistic baseline**: Chronological split without temporal ordering assertion
- **ECE calibration**: Computed on ~50 games from last fold only (small, noisy)
- **Fix**: Walk-forward CV for player props, add assertion in baselines, use all CV folds for ECE

### C5. MAX_ECE_FOR_PROMOTION Discrepancy
- **File**: `config.py` line 94
- **Current**: 0.35 (allows 35% miscalibration)
- **Expected**: 0.15 (per memory notes, standard practice)
- **Fix**: Change to 0.15

---

## HIGH Priority Issues

### H1. Dashboard Page 6 (Player Props) is Dead Code
- **File**: `ml/dashboard/pages/6_player_props.py`
- **Issue**: UNIQUE constraint on `ml_predictions(game_id, model_type, model_version)` blocks multiple player predictions per game. Backfill can't populate data.
- **Fix**: Add "Work in Progress" banner, or remove from navigation

### H2. Ensemble Weight Normalization Missing
- **File**: `ml/models/totals.py` line 150
- **Issue**: `poisson_weight * pred + lgbm_weight * pred` doesn't assert weights sum to 1.0
- **Fix**: Add assertion in `__init__`

### H3. Concept Drift Detection — Built but Never Called
- **Files**: `validation.py` lines 138-227, `weekly_retrain.py`
- **Issue**: 90 lines of well-implemented drift detection, never invoked
- **Fix**: Wire into weekly retrain or delete

### H4. Monthly Eval Only Covers game_winner
- **File**: `monthly_eval.py`
- **Issue**: Hardcoded to evaluate only game_winner. Spread/totals get no monthly calibration.
- **Fix**: Loop over all model types

### H5. Goalie save_pctg NULL Fallback Untested
- **File**: `compute.py`
- **Issue**: Computes `saves/(saves+goals_against)` when save_pctg is NULL (which is always). Zero test coverage.
- **Fix**: Add unit test for this critical computation

---

## MEDIUM Priority Issues

### M1. Registry Config Extraction Fragile
- **File**: `registry.py` line 59
- **Issue**: 7-level nested `.get()` chain. Adding 8th compute type requires finding and extending chain.
- **Fix**: Refactor to explicit lookup

### M2. Train Metrics Mismatch in Metadata
- **File**: `weekly_retrain.py`
- **Issue**: Promotion uses CV average train metrics, but final model trains on ALL data. Metadata misleading.
- **Fix**: Document clearly in metadata or store both

### M3. Dashboard UI Polish
- No "last refreshed" timestamp
- Pre-formatted columns disable sorting in Prediction Review
- Overfitting page recalculates gap twice
- Pipeline Control shows relative time but no absolute timestamp
- Version history timestamps as strings break sorting

### M4. xG Computation Silently Degrades
- **File**: `compute.py`
- **Issue**: Returns 0.03 default when coordinates missing, no warning if 50%+ shots lack data
- **Fix**: Log warning when data quality degrades

### M5. Totals Model Can't Be Hyperparameter Tuned
- **File**: `weekly_retrain.py` lines 342-345
- **Issue**: Optuna tuning silently skips TotalsModel
- **Fix**: Add params support to TotalsModel constructor

---

## What's Working Well

- **Walk-forward CV**: Correctly prevents data leakage with expanding window
- **Quality gates**: Comprehensive for game_winner/spread/totals (Brier, accuracy, gap, calibration)
- **Safe model promotion**: Brief dual-active overlap, rollback on failure
- **FeatureCache**: Reduces computation from ~20min to ~2s
- **Feature YAML**: Single source of truth, auto-discovery everywhere
- **Directory structure**: Clean, no dead files, logical hierarchy
- **Dependencies**: 14 ML + 5 dashboard packages, all pinned, no bloat
- **GitHub Actions**: Proper scheduling, concurrency, notifications
- **Dashboard data.py**: Clean separation of concerns, 5-min caching
- **Unit test quality**: Meaningful assertions, edge cases, temporal ordering verified
- **IO layer**: Retry logic, pagination, checksums, manifest versioning
- **Sample weighting**: Prior seasons 0.7x, current 1.0x

---

## Detailed Findings by Audit Area

### Models & Training (Agent 1)
- GameWinnerModel: LightGBM classifier, correct for binary classification
- SpreadModel: LightGBM regressor, correct for continuous output
- TotalsModel: Poisson GLM + LightGBM ensemble, theoretically well-motivated
- PlayerPropsModel: Three independent Poisson GLMs (goals/assists/points), appropriate for counts
- BaseLGBMModel: Clean abstract base class with proper interface
- Walk-forward CV implementation is correct and well-documented
- Hyperparameter tuning with Optuna properly gated
- 3 ML anti-patterns found: CV train metrics in promotion, random split for baseline, 80/20 for player props

### Feature Engineering (Agent 2)
- 46 features well-defined in YAML with descriptions, compute types, tiers
- 40 features handled in compute.py, 5 in separate player function, 1 in pipeline injection
- FeatureCache: Smart pre-loading in ~4 bulk queries, correct leakage prevention
- _derive_standings_from_games() handles missing DB snapshots correctly
- 2 major inconsistencies: player_lookup orphaned, cross_model orphaned
- No compute_type handler validation (silent NaN on typo)
- H2H features can silently become NaN if game_details fail to load

### Dashboard UI/UX (Agent 3)
- 7 pages, logical progression (Overview → Performance → Features → Overfitting → Review → Player Props → Control)
- Clean data.py layer with 5-min caching and singleton Supabase client
- Page 6 (Player Props) is dead code due to UNIQUE constraint
- Good visualizations: reliability diagram, trend charts with alert zones, confidence breakdowns
- Pipeline Control has proper safeguards: auth, rate limiting, confirmation checkboxes
- Various UI polish items: missing timestamps, disabled sorting, inconsistent error messages

### Pipeline Infrastructure (Agent 4)
- weekly_retrain.py: Excellent flow with walk-forward CV, quality gates, safe promotion
- daily_run.py: Clean 10-step flow with data freshness checks
- monthly_eval.py: Good calibration analysis but only covers game_winner
- All utility scripts serve clear purposes (backfill, report, baselines)
- GitHub Actions properly scheduled with concurrency control
- Dependencies minimal and well-pinned
- No unnecessary infrastructure found

### Test Coverage (Agent 5)
- 366 tests passing across 19 test files
- Strong unit tests with meaningful assertions and edge cases
- Massive integration test gaps: daily pipeline, model storage, Supabase IO
- Only 7 exception tests out of 366 — error paths nearly untested
- Goalie save_pctg NULL fallback has zero coverage
- No centralized data validation before ML operations
- conftest.py auto-discovers features from YAML — excellent

---

## File Reference

| File | Issues Found |
|------|-------------|
| `ml/config.py` | C5 (ECE threshold) |
| `ml/features/compute.py` | C2 (validation), H5 (goalie), M4 (xG) |
| `ml/features/registry.py` | M1 (fragile config extraction) |
| `ml/features/features.yaml` | C2 (orphaned feature types) |
| `ml/models/totals.py` | H2 (weight normalization) |
| `ml/models/baselines.py` | C4 (temporal assertion) |
| `ml/pipeline/weekly_retrain.py` | C3, C4, H3, M2, M5 |
| `ml/pipeline/monthly_eval.py` | H4 (only game_winner) |
| `ml/evaluation/validation.py` | H3 (drift unused) |
| `ml/dashboard/pages/6_player_props.py` | H1 (dead code) |
| `ml/tests/` (missing) | C1 (daily_run, storage, supabase, goalie) |

---

*Audit conducted: 2026-02-18*
*Audited by: 5 parallel Claude agents*
*Total analysis time: ~2 minutes wall clock*
*Files examined: All 50+ ML source files*
