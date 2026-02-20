"""
Weekly model retraining pipeline.

Runs once per week (Monday 6am ET) via GitHub Actions.

HOW RETRAINING WORKS (tutorial):

  Unlike the daily pipeline which just runs inference, this pipeline actually
  trains new models. Think of it as the "learning" step:

  1. Load ALL completed games this season (not just today's)
  2. Compute features for every game (using as_of_date per game to prevent leakage)
  3. For each model type (game_winner, spread, totals):
     a. Run walk-forward cross-validation to estimate how well the model will
        perform on future games
     b. Train a final model on ALL available data
     c. Compare the new model to the currently active model
     d. If it's meaningfully better (MIN_BRIER_IMPROVEMENT), promote it
     e. If not, keep the old model — we don't want to ship regressions

  WHY WALK-FORWARD CV INSTEAD OF RANDOM K-FOLD?
  Sports data is temporal — game 500 depends on the outcomes of games 1-499.
  Random k-fold would let the model "peek" at future games during training,
  producing inflated accuracy estimates. Walk-forward CV simulates the real-world
  scenario: train on past games, predict future games, expand the window, repeat.
  This gives us a realistic estimate of how the model will perform in production.

  WHY NOT RETRAIN DAILY?
  Retraining is expensive (computes features for 1000+ games) and models don't
  change much day-to-day with only 5-15 new games. Weekly retraining gives enough
  new data to potentially improve the model while keeping compute costs low.
"""

import logging
import sys
from datetime import datetime, timezone

import httpx
import pandas as pd

from ml.config import (
    CURRENT_SEASON,
    DISCORD_WEBHOOK_URL,
    ENABLE_TUNING,
    HEALTHCHECK_URL,
    MAX_ECE_FOR_PROMOTION,
    MAX_TRAIN_VAL_GAP,
    MIN_BRIER_IMPROVEMENT,
    MIN_GAMES_FOR_PROMOTION,
    ModelType,
    SEASON_WEIGHTS,
    TRAINING_SEASONS,
    TUNING_N_TRIALS,
)
from ml.tuning.optuna_tuner import tune_model
from ml.evaluation.calibration import compute_ece
from ml.evaluation.overfitting import check_underfitting, detect_overfitting
from ml.evaluation.validation import detect_concept_drift, walk_forward_cv
from ml.features.compute import compute_player_features
from ml.features.disk_cache import compute_features_with_cache
from ml.features.registry import get_model_features, load_feature_registry
from ml.io.model_storage import ModelStorage
from ml.io.supabase_client import (
    create_supabase_client,
    read_games,
    read_games_multi,
    write_model_metadata,
)
from ml.io.supabase_client import (
    read_player_game_stats,
    read_player_season_stats,
)
from ml.models.game_winner import GameWinnerModel
from ml.models.player_props import PlayerPropsModel
from ml.models.spread import SpreadModel
from ml.models.totals import TotalsModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    """Weekly retrain pipeline."""
    logger.info("=== PuckIQ Weekly Retrain Pipeline ===")
    try:
        _run()
    except Exception as exc:
        logger.error("Retrain failed: %s", exc, exc_info=True)
        _notify_discord(f"Weekly retrain FAILED: {exc}")
        sys.exit(1)


def _run() -> None:
    client = create_supabase_client()
    storage = ModelStorage(client)

    # 1. Get all completed games across training seasons.
    #    We train on finished games (OFF = officially closed, FINAL = just ended).
    #    Both have valid final scores.
    games_df = read_games_multi(client, TRAINING_SEASONS, game_state=["OFF", "FINAL"])
    if games_df.empty:
        logger.warning("No completed games found for seasons %s", TRAINING_SEASONS)
        return

    # Sort chronologically — CRITICAL for walk-forward CV.
    # If games aren't in time order, the model could train on future data.
    games_df = games_df.sort_values("game_date").reset_index(drop=True)
    logger.info("Loaded %d completed games across %d seasons", len(games_df), len(TRAINING_SEASONS))

    # Compute sample weights from season (prior seasons weighted less)
    sample_weights = games_df["season"].map(SEASON_WEIGHTS).fillna(1.0)

    # Compute features for all games using disk cache for incremental runs.
    # First run computes all features (~40 min). Subsequent runs only compute
    # features for new games (~5-30s) because the rest are cached on disk.
    registry = load_feature_registry()
    logger.info("Computing features for %d games (with disk cache)...", len(games_df))
    features_df = compute_features_with_cache(
        games_df, client, registry=registry, seasons=TRAINING_SEASONS,
    )

    # Build target variables from actual game results.
    # These are what the models try to predict:
    #   - home_win: did the home team win? (binary: 0 or 1)
    #   - spread: by how much? (home_score - away_score, can be negative)
    #   - total: how many total goals? (home_score + away_score)
    home_win = (games_df["home_score"] > games_df["away_score"]).astype(int)
    spread = games_df["home_score"] - games_df["away_score"]
    total = games_df["home_score"] + games_df["away_score"]

    # 2. Retrain each model type (pass sample_weights for multi-season weighting)
    _retrain_game_winner(storage, features_df, home_win, games_df, client, sample_weights)

    # --- Cross-model feature: inject game_winner predictions for spread/totals ---
    try:
        gw_model = storage.load_model(ModelType.GAME_WINNER.value)
        if gw_model is not None:
            gw_feature_names = get_model_features(ModelType.GAME_WINNER)
            gw_available = [f for f in gw_feature_names if f in features_df.columns]
            X_gw = features_df[gw_available]
            gw_probs = gw_model.predict(X_gw)
            features_df["gw_home_win_prob"] = gw_probs
            logger.info("Injected gw_home_win_prob cross-model feature (%d values)", len(gw_probs))
    except Exception as exc:
        logger.warning("Could not inject cross-model feature: %s", exc)

    _retrain_spread(storage, features_df, spread, games_df, client, sample_weights)
    _retrain_totals(storage, features_df, total, games_df, client, sample_weights)
    _retrain_player_props(storage, games_df, client)

    # 3. Ping healthcheck
    _ping_healthcheck()
    logger.info("=== Weekly retrain complete ===")


def _retrain_game_winner(
    storage: ModelStorage,
    features_df: pd.DataFrame,
    targets: pd.Series,
    games_df: pd.DataFrame,
    client,
    sample_weights: pd.Series | None = None,
) -> None:
    """
    Retrain game winner model with walk-forward CV.

    WHY LIGHTGBM FOR GAME WINNER?
    LightGBM is a gradient-boosted decision tree — it builds many small decision
    trees that each correct the errors of the previous ones. It handles mixed
    feature types well, is fast to train, and naturally captures non-linear
    relationships (e.g., home ice advantage matters more for some teams than others).
    """
    model_type = ModelType.GAME_WINNER
    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in features_df.columns]
    X = features_df[available]

    logger.info("Retraining %s with %d features, %d games", model_type.value, len(available), len(X))

    if len(X) < MIN_GAMES_FOR_PROMOTION:
        logger.warning("Not enough games (%d < %d) for promotion", len(X), MIN_GAMES_FOR_PROMOTION)

    # Optuna hyperparameter tuning
    best_params = None
    if ENABLE_TUNING:
        logger.info("Tuning hyperparameters for %s (%d trials)...", model_type.value, TUNING_N_TRIALS)
        tuning_result = tune_model(model_type, X, targets, n_trials=TUNING_N_TRIALS)
        best_params = tuning_result["best_params"]
        logger.info("Best params for %s: %s (best %s=%.4f)",
                     model_type.value, best_params,
                     tuning_result["metric_name"], tuning_result["best_value"])

    model_kwargs = {"params": best_params} if best_params else {}

    # Walk-forward CV: simulate real-world performance.
    # collect_predictions=True so we can compute ECE from all OOS predictions.
    folds = walk_forward_cv(
        GameWinnerModel, X, targets,
        model_kwargs=model_kwargs, sample_weights=sample_weights,
        collect_predictions=True,
    )
    if not folds:
        logger.warning("No CV folds completed for %s", model_type.value)
        return

    avg_val_metrics = _average_fold_metrics(folds, "val_metrics")
    avg_train_metrics = _average_fold_metrics(folds, "train_metrics")

    # Concept drift detection (informational only — does NOT block promotion).
    # Analyzes metric trends across CV folds to warn if model performance is
    # degrading on more recent data, which could indicate the data distribution
    # is shifting (e.g., rule changes, mid-season roster overhauls).
    drift_result = detect_concept_drift(folds)
    if drift_result.get("drift_detected"):
        logger.warning(
            "Concept drift detected for %s: %s",
            model_type.value, drift_result.get("reasons", "unknown"),
        )

    # Overfitting check: if training accuracy is much higher than validation
    # accuracy, the model is memorizing patterns instead of learning them.
    # We still train the model but log a warning. The gap is stored in metadata
    # so we can track the trend over time.
    overfit = detect_overfitting(avg_train_metrics, avg_val_metrics)
    if overfit["is_overfitting"]:
        logger.warning("Overfitting detected for %s -- proceeding with caution", model_type.value)

    # Underfitting check: is the model too weak to be useful?
    underfit = check_underfitting(avg_val_metrics, model_type.value)
    if underfit["is_underfitting"]:
        logger.warning("Underfitting detected for %s: %s — skipping promotion", model_type.value, underfit["reason"])
        return

    # Calibration check (game_winner only): compute ECE from ALL walk-forward CV
    # fold OOS predictions. Each fold produces honest out-of-sample predictions
    # (trained only on past data), so concatenating them gives a much larger sample
    # than using a single fold. More data = more reliable ECE estimate.
    import numpy as np
    all_oos_preds = []
    all_oos_actuals = []
    for fold in folds:
        if fold.val_predictions is not None and fold.val_actuals is not None:
            all_oos_preds.extend(fold.val_predictions)
            all_oos_actuals.extend(fold.val_actuals)

    if len(all_oos_preds) == 0:
        logger.warning("No OOS predictions collected — falling back to last-fold calibration")
        from ml.config import VALIDATION_WINDOW
        val_size = min(VALIDATION_WINDOW, len(X) // 4)
        cal_model = GameWinnerModel(**model_kwargs)
        cal_model.train(X.iloc[:-val_size], targets.iloc[:-val_size])
        cal_preds = cal_model.predict(X.iloc[-val_size:])
        cal_actuals = targets.iloc[-val_size:].values
        ece_value = compute_ece(np.asarray(cal_preds), np.asarray(cal_actuals))
    else:
        ece_value = compute_ece(np.asarray(all_oos_preds), np.asarray(all_oos_actuals))

    logger.info(
        "Calibration ECE for %s: %.4f (from %d OOS predictions, max allowed: %.4f)",
        model_type.value, ece_value, len(all_oos_preds), MAX_ECE_FOR_PROMOTION,
    )

    if ece_value > MAX_ECE_FOR_PROMOTION:
        logger.warning(
            "Calibration gate FAILED for %s: ECE=%.4f > %.4f — skipping promotion",
            model_type.value, ece_value, MAX_ECE_FOR_PROMOTION,
        )
        return

    # Train final model on ALL data (not just the training folds).
    # Why? Walk-forward CV tells us how well the model generalizes. But for the
    # production model, we want to use all available data to maximize accuracy.
    final_model = GameWinnerModel(**model_kwargs)
    train_metrics = final_model.train(X, targets, sample_weight=sample_weights)

    # Compute overfit gap for metadata
    overfit_gap = overfit["gaps"].get("accuracy", overfit["gaps"].get("brier_score", 0.0))

    # Compare to current active model and maybe promote.
    #
    # NOTE: train_metrics here are CV-fold averages, NOT final model metrics.
    # The final model trains on ALL data, so its train accuracy would be ~1.0 for LightGBM.
    # CV-averaged metrics are more informative for overfitting detection.
    _maybe_promote(
        storage, client, model_type, final_model,
        val_metrics=avg_val_metrics,
        train_metrics=avg_train_metrics,
        overfit_gap=overfit_gap,
        n_games=len(X),
        features_used=available,
        feature_importance=final_model.get_feature_importance(),
        verification_features=X.iloc[-1:],  # last game for smoke test
        ece=ece_value,
        tuned_params=best_params,
        training_date_range=f"{games_df['game_date'].min()} to {games_df['game_date'].max()}",
    )


def _retrain_spread(
    storage: ModelStorage,
    features_df: pd.DataFrame,
    targets: pd.Series,
    games_df: pd.DataFrame,
    client,
    sample_weights: pd.Series | None = None,
) -> None:
    """Retrain spread model."""
    model_type = ModelType.SPREAD
    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in features_df.columns]
    X = features_df[available]

    logger.info("Retraining %s with %d features, %d games", model_type.value, len(available), len(X))

    # Optuna hyperparameter tuning
    best_params = None
    if ENABLE_TUNING:
        logger.info("Tuning hyperparameters for %s (%d trials)...", model_type.value, TUNING_N_TRIALS)
        tuning_result = tune_model(model_type, X, targets, n_trials=TUNING_N_TRIALS)
        best_params = tuning_result["best_params"]
        logger.info("Best params for %s: %s (best %s=%.4f)",
                     model_type.value, best_params,
                     tuning_result["metric_name"], tuning_result["best_value"])

    model_kwargs = {"params": best_params} if best_params else {}

    folds = walk_forward_cv(SpreadModel, X, targets, model_kwargs=model_kwargs, sample_weights=sample_weights)
    if not folds:
        return

    avg_val_metrics = _average_fold_metrics(folds, "val_metrics")
    avg_train_metrics = _average_fold_metrics(folds, "train_metrics")

    # Concept drift detection (informational only — does NOT block promotion)
    drift_result = detect_concept_drift(folds, metric_name="mae")
    if drift_result.get("drift_detected"):
        logger.warning(
            "Concept drift detected for %s: %s",
            model_type.value, drift_result.get("reasons", "unknown"),
        )

    overfit = detect_overfitting(avg_train_metrics, avg_val_metrics)
    overfit_gap = overfit["gaps"].get("mae", 0.0)

    # Underfitting check
    underfit = check_underfitting(avg_val_metrics, model_type.value)
    if underfit["is_underfitting"]:
        logger.warning("Underfitting detected for %s: %s — skipping promotion", model_type.value, underfit["reason"])
        return

    final_model = SpreadModel(**model_kwargs)
    train_metrics = final_model.train(X, targets, sample_weight=sample_weights)

    # NOTE: train_metrics here are CV-fold averages, NOT final model metrics.
    # The final model trains on ALL data, so its train accuracy would be ~1.0 for LightGBM.
    # CV-averaged metrics are more informative for overfitting detection.
    _maybe_promote(
        storage, client, model_type, final_model,
        val_metrics=avg_val_metrics,
        train_metrics=avg_train_metrics,
        overfit_gap=overfit_gap,
        n_games=len(X),
        features_used=available,
        feature_importance=final_model.get_feature_importance(),
        verification_features=X.iloc[-1:],
        tuned_params=best_params,
        training_date_range=f"{games_df['game_date'].min()} to {games_df['game_date'].max()}",
    )


def _retrain_totals(
    storage: ModelStorage,
    features_df: pd.DataFrame,
    targets: pd.Series,
    games_df: pd.DataFrame,
    client,
    sample_weights: pd.Series | None = None,
) -> None:
    """Retrain totals model (Poisson + LightGBM ensemble)."""
    model_type = ModelType.TOTALS
    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in features_df.columns]
    # TotalsModel has a Poisson GLM component (statsmodels) which cannot handle NaN.
    # LightGBM handles NaN natively, but Poisson GLM requires clean input.
    X = features_df[available].fillna(0)

    logger.info("Retraining %s with %d features, %d games", model_type.value, len(available), len(X))

    # Tuning not supported for totals — TotalsModel is a Poisson+LightGBM ensemble
    # that doesn't accept a params kwarg in its constructor.
    if ENABLE_TUNING:
        logger.info("Tuning not supported for %s (Poisson+LightGBM ensemble) — using defaults", model_type.value)

    folds = walk_forward_cv(TotalsModel, X, targets, sample_weights=sample_weights)
    if not folds:
        return

    avg_val_metrics = _average_fold_metrics(folds, "val_metrics")
    avg_train_metrics = _average_fold_metrics(folds, "train_metrics")

    # Concept drift detection (informational only — does NOT block promotion)
    drift_result = detect_concept_drift(folds, metric_name="mae")
    if drift_result.get("drift_detected"):
        logger.warning(
            "Concept drift detected for %s: %s",
            model_type.value, drift_result.get("reasons", "unknown"),
        )

    overfit = detect_overfitting(avg_train_metrics, avg_val_metrics)
    overfit_gap = overfit["gaps"].get("mae", 0.0)

    # Underfitting check
    underfit = check_underfitting(avg_val_metrics, model_type.value)
    if underfit["is_underfitting"]:
        logger.warning("Underfitting detected for %s: %s — skipping promotion", model_type.value, underfit["reason"])
        return

    final_model = TotalsModel()
    train_metrics = final_model.train(X, targets, sample_weight=sample_weights)

    # NOTE: train_metrics here are CV-fold averages, NOT final model metrics.
    # The final model trains on ALL data, so its train accuracy would be ~1.0 for LightGBM.
    # CV-averaged metrics are more informative for overfitting detection.
    _maybe_promote(
        storage, client, model_type, final_model,
        val_metrics=avg_val_metrics,
        train_metrics=avg_train_metrics,
        overfit_gap=overfit_gap,
        n_games=len(X),
        features_used=available,
        feature_importance=final_model.get_feature_importance(),
        verification_features=X.iloc[-1:],
        training_date_range=f"{games_df['game_date'].min()} to {games_df['game_date'].max()}",
    )


def _retrain_player_props(
    storage: ModelStorage,
    games_df: pd.DataFrame,
    client,
) -> None:
    """Retrain player props model (Poisson GLMs for goals/assists/points)."""
    model_type = ModelType.PLAYER_PROPS
    logger.info("Retraining %s", model_type.value)

    # Load player-game stats across all training seasons
    game_ids = games_df["id"].tolist()
    player_game_df = read_player_game_stats(client, CURRENT_SEASON, game_ids)
    if player_game_df.empty:
        logger.warning("No player game stats found — skipping player_props retrain")
        return

    # Load season stats across all training seasons
    season_frames = []
    for season in TRAINING_SEASONS:
        sdf = read_player_season_stats(client, season)
        if not sdf.empty:
            season_frames.append(sdf)
    season_stats_df = pd.concat(season_frames, ignore_index=True) if season_frames else pd.DataFrame()

    # Load standings for opponent GA
    standings_df = None
    try:
        resp = client.table("standings").select("*").execute()
        standings_df = pd.DataFrame(resp.data) if resp.data else None
    except Exception:
        pass

    # Compute features
    features_df = compute_player_features(player_game_df, season_stats_df, standings_df)

    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in features_df.columns]
    X = features_df[available].fillna(0)  # Poisson GLM cannot handle NaN

    if len(X) < 100:
        logger.warning("Not enough player-game rows (%d) for player_props", len(X))
        return

    # Extract targets from player_game_df
    goals = player_game_df["goals"].astype(float) if "goals" in player_game_df.columns else pd.Series([0] * len(X))
    assists = player_game_df["assists"].astype(float) if "assists" in player_game_df.columns else pd.Series([0] * len(X))
    points = player_game_df["points"].astype(float) if "points" in player_game_df.columns else pd.Series([0] * len(X))

    # Align indices
    goals = goals.iloc[:len(X)].reset_index(drop=True)
    assists = assists.iloc[:len(X)].reset_index(drop=True)
    points = points.iloc[:len(X)].reset_index(drop=True)

    # --- Walk-forward CV for player props ---
    # PlayerPropsModel has a non-standard train() signature (goals, assists, points
    # as separate args), so we can't use the generic walk_forward_cv(). Instead,
    # we implement the same expanding-window logic inline, ensuring validation
    # data is always chronologically AFTER training data.
    from ml.config import MIN_TRAINING_GAMES, VALIDATION_WINDOW, STEP_SIZE
    min_train = max(MIN_TRAINING_GAMES, 100)
    val_window = VALIDATION_WINDOW
    step_size = STEP_SIZE
    n = len(X)
    fold_val_metrics_list: list[dict] = []
    fold_train_metrics_list: list[dict] = []
    train_end = min_train
    fold_idx = 0

    while train_end + val_window <= n:
        val_start = train_end
        val_end = val_start + val_window

        X_train_fold = X.iloc[:train_end]
        X_val_fold = X.iloc[val_start:val_end]
        g_train_fold = goals.iloc[:train_end]
        g_val_fold = goals.iloc[val_start:val_end]
        a_train_fold = assists.iloc[:train_end]
        a_val_fold = assists.iloc[val_start:val_end]
        p_train_fold = points.iloc[:train_end]
        p_val_fold = points.iloc[val_start:val_end]

        fold_model = PlayerPropsModel()
        fold_train_m = fold_model.train(X_train_fold, g_train_fold, a_train_fold, p_train_fold)
        fold_val_m = fold_model.evaluate(X_val_fold, g_val_fold, a_val_fold, p_val_fold)

        fold_train_metrics_list.append(fold_train_m)
        fold_val_metrics_list.append(fold_val_m)

        logger.info(
            "Player props fold %d: train=%d, val=%d, val_goals_mae=%.4f, val_assists_mae=%.4f, val_points_mae=%.4f",
            fold_idx, train_end, val_window,
            fold_val_m["goals"]["mae"], fold_val_m["assists"]["mae"], fold_val_m["points"]["mae"],
        )

        fold_idx += 1
        train_end += step_size

    if not fold_val_metrics_list:
        logger.warning("No CV folds completed for player_props — falling back to 80/20 split")
        split_idx = int(n * 0.8)
        X_train, X_val = X.iloc[:split_idx], X.iloc[split_idx:]
        g_train, g_val = goals.iloc[:split_idx], goals.iloc[split_idx:]
        a_train, a_val = assists.iloc[:split_idx], assists.iloc[split_idx:]
        p_train, p_val = points.iloc[:split_idx], points.iloc[split_idx:]

        model = PlayerPropsModel()
        train_metrics = model.train(X_train, g_train, a_train, p_train)
        val_metrics = model.evaluate(X_val, g_val, a_val, p_val)
    else:
        # Average validation metrics across all folds
        avg_goals_mae = sum(m["goals"]["mae"] for m in fold_val_metrics_list) / len(fold_val_metrics_list)
        avg_assists_mae = sum(m["assists"]["mae"] for m in fold_val_metrics_list) / len(fold_val_metrics_list)
        avg_points_mae = sum(m["points"]["mae"] for m in fold_val_metrics_list) / len(fold_val_metrics_list)

        val_metrics = {
            "goals": {"mae": avg_goals_mae},
            "assists": {"mae": avg_assists_mae},
            "points": {"mae": avg_points_mae},
        }

        # Train final model on ALL data
        model = PlayerPropsModel()
        train_metrics = model.train(X, goals, assists, points)

    logger.info("Player props train metrics: %s", train_metrics)
    logger.info("Player props val metrics: %s", val_metrics)

    # --- Quality gates for player props ---
    # Check 1: Model can produce predictions (not broken)
    import numpy as np
    try:
        test_preds = model.predict(X.iloc[-5:])
        for prop_name in ("goals", "assists", "points"):
            preds_arr = np.asarray(test_preds[prop_name])
            if np.any(np.isnan(preds_arr)):
                logger.error("Player props quality gate FAILED: NaN predictions for %s — skipping promotion", prop_name)
                return
            if len(preds_arr) > 1 and np.all(preds_arr == preds_arr[0]):
                logger.warning("Player props quality gate WARNING: identical predictions for %s", prop_name)
    except Exception as exc:
        logger.error("Player props quality gate FAILED: prediction error: %s — skipping promotion", exc)
        return

    # Check 2: Validation MAE sanity check — if average MAE is unreasonably high,
    # the model is not learning anything useful. Threshold: avg MAE > 2.0 means
    # predictions are off by 2+ goals/assists/points per game on average.
    avg_mae = (
        val_metrics["goals"]["mae"]
        + val_metrics["assists"]["mae"]
        + val_metrics["points"]["mae"]
    ) / 3.0
    MAX_PLAYER_PROPS_MAE = 2.0
    if avg_mae > MAX_PLAYER_PROPS_MAE:
        logger.warning(
            "Player props quality gate WARNING: avg MAE %.4f > %.1f — model may be too weak",
            avg_mae, MAX_PLAYER_PROPS_MAE,
        )
        # Informational warning, not a hard block — player props are inherently noisy

    # --- Promote ---
    version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    storage.save_model(model, model_type.value, version,
                       {"goals_mae": val_metrics["goals"]["mae"],
                        "assists_mae": val_metrics["assists"]["mae"],
                        "points_mae": val_metrics["points"]["mae"]})

    # Write metadata — store per-stat MAE in hyperparameters JSONB
    # (ml_model_metadata has val_mae but not val_goals_mae etc.)
    # Compute training date range from the games
    date_min = games_df["game_date"].min() if "game_date" in games_df.columns else None
    date_max = games_df["game_date"].max() if "game_date" in games_df.columns else None
    training_date_range = f"{date_min} to {date_max}" if date_min and date_max else None

    n_training_games = len(X) if fold_val_metrics_list else int(len(X) * 0.8)

    write_model_metadata(client, {
        "model_type": model_type.value,
        "model_version": version,
        "training_games": n_training_games,
        "training_date_range": training_date_range,
        "val_mae": round(avg_mae, 4),
        "hyperparameters": {
            "goals_mae": round(val_metrics["goals"]["mae"], 4),
            "assists_mae": round(val_metrics["assists"]["mae"], 4),
            "points_mae": round(val_metrics["points"]["mae"], 4),
            "cv_folds": len(fold_val_metrics_list) if fold_val_metrics_list else 0,
        },
        "features_used": available,
        "is_active": True,
        "promoted_at": datetime.now(timezone.utc).isoformat(),
    })

    # Deactivate old model
    from ml.config import ML_MODEL_METADATA_TABLE
    client.table(ML_MODEL_METADATA_TABLE).update(
        {"is_active": False}
    ).eq("model_type", model_type.value).eq(
        "is_active", True
    ).neq("model_version", version).execute()

    logger.info(
        "Player props model promoted: %s/%s (avg_mae=%.4f, cv_folds=%d)",
        model_type.value, version, avg_mae, len(fold_val_metrics_list) if fold_val_metrics_list else 0,
    )


def _maybe_promote(
    storage: ModelStorage,
    client,
    model_type: ModelType,
    new_model,
    val_metrics: dict[str, float],
    train_metrics: dict[str, float],
    overfit_gap: float,
    n_games: int,
    features_used: list[str],
    feature_importance: dict[str, float],
    verification_features: pd.DataFrame | None = None,
    ece: float | None = None,
    tuned_params: dict[str, float] | None = None,
    training_date_range: str | None = None,
) -> None:
    """
    Compare new model to current active and promote if better.

    SAFE PROMOTION PATTERN (important ML ops lesson):
    Always verify the new model before deactivating the old one. A brief period
    with two active models is safer than any period with zero. The sequence is:

      1. Save new artifact to storage
      2. Write new metadata with is_active=True
      3. Verify: load model back from storage, run a test prediction
      4. Only after verification: deactivate the OLD model
      5. If verification fails: delete new metadata, keep old model active

    WHY REQUIRE MIN_BRIER_IMPROVEMENT?
    Small improvements in metrics might just be noise. By requiring at least a 0.02
    Brier score improvement, we avoid constantly swapping models for marginal gains.
    This makes the system more stable and easier to debug.
    """
    version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    # Check if there's an existing model to compare against
    manifest = storage.get_manifest(model_type.value)
    if manifest and manifest.get("metrics"):
        old_metrics = manifest["metrics"]
        if ModelStorage.should_promote(old_metrics, val_metrics, MIN_BRIER_IMPROVEMENT):
            logger.info("Promoting %s: new metrics beat old", model_type.value)
        else:
            logger.info("Skipping promotion for %s: new metrics not better", model_type.value)
            return
    else:
        logger.info("No existing model for %s -- promoting first version", model_type.value)

    # === SAFE MODEL PROMOTION ===
    # The old model stays active until the new one is proven to work.
    # A brief period with two active models is safer than any period with
    # zero active models. If the new model fails to load or predict, the
    # old one is still there as a fallback.

    # Step 1: Save new model artifact to Supabase Storage
    storage.save_model(new_model, model_type.value, version, val_metrics)

    # Step 2: Write new model metadata with is_active=True
    # (Briefly, two models may be active — that's intentional and safe)
    from ml.io.supabase_client import _to_native

    write_model_metadata(client, _to_native({
        "model_type": model_type.value,
        "model_version": version,
        "training_games": n_games,
        "training_date_range": training_date_range,
        "val_brier_score": val_metrics.get("brier_score"),
        "val_accuracy": val_metrics.get("accuracy"),
        "val_log_loss": val_metrics.get("log_loss"),
        "val_mae": val_metrics.get("mae"),
        "val_rmse": val_metrics.get("rmse"),
        "train_accuracy": train_metrics.get("accuracy"),
        "overfit_gap": overfit_gap,
        "feature_importance": feature_importance or None,
        "features_used": features_used,
        "hyperparameters": tuned_params,  # Optuna tuned params stored here
        "is_active": True,
        "promoted_at": datetime.now(timezone.utc).isoformat(),
    }))

    # Step 3: Verify the new model passes ALL quality gates before going live.
    #
    # WHY QUALITY GATES?
    # A model can "improve" over the previous version (lower Brier score) but
    # still be worse than trivial baselines like always picking the home team.
    # Quality gates are absolute thresholds that every model must clear before
    # users ever see its predictions. Think of it like a minimum GPA to graduate
    # — you can improve your grades each semester, but you still need to meet
    # the overall bar.
    #
    # We check:
    #   1. Can it load from storage? (basic health)
    #   2. Can it produce predictions? (not broken)
    #   3. Are predictions reasonable? (probabilities in [0,1], not all identical)
    #   4. Is Brier score below MAX_BRIER_SCORE? (better than random)
    #   5. Is accuracy above MIN_ACCURACY? (better than coin flip)
    #   6. Is train/val gap below MAX_TRAIN_VAL_GAP? (not overfitting)
    from ml.config import (
        MAX_BRIER_SCORE, MIN_ACCURACY, MAX_TRAIN_VAL_GAP,
        ML_MODEL_METADATA_TABLE,
    )

    def _rollback(reason: str) -> None:
        """Delete new metadata row and keep old model active."""
        logger.error("QUALITY GATE FAILED for %s/%s: %s", model_type.value, version, reason)
        client.table(ML_MODEL_METADATA_TABLE).delete().eq(
            "model_type", model_type.value
        ).eq("model_version", version).execute()
        logger.warning("Rolled back promotion — old model remains active")

    try:
        # Gate 1: Can the model load from storage?
        # Brief pause to allow Supabase Storage CDN cache to propagate the
        # manifest update from save_model() — without this, the read can
        # return a stale (pre-upload) version of manifest.json.
        import time
        time.sleep(2)
        verified_model = storage.load_model(model_type.value)
        if verified_model is None:
            raise RuntimeError("Model loaded as None")

        # Gate 2: Can it produce predictions? (run on a few sample features)
        if verification_features is not None and len(verification_features) > 0:
            test_preds = verified_model.predict(verification_features)
            if test_preds is None or len(test_preds) == 0:
                _rollback("Model produced no predictions on test data")
                return

            # Gate 3: Are predictions reasonable?
            if hasattr(test_preds, '__iter__'):
                import numpy as np
                preds_array = np.array(test_preds)
                if np.any(np.isnan(preds_array)):
                    _rollback(f"Model produced NaN predictions")
                    return
                if np.all(preds_array == preds_array[0]) and len(preds_array) > 1:
                    _rollback(f"Model produced identical predictions for all games: {preds_array[0]:.4f}")
                    return
                # For classification models, probabilities should be in [0, 1]
                if model_type == ModelType.GAME_WINNER:
                    if np.any(preds_array < 0) or np.any(preds_array > 1):
                        _rollback(f"Game winner probabilities outside [0,1]: min={preds_array.min():.4f}, max={preds_array.max():.4f}")
                        return

        # Gate 4: Brier score within acceptable range
        brier = val_metrics.get("brier_score")
        if brier is not None and brier > MAX_BRIER_SCORE:
            _rollback(f"Brier score {brier:.4f} exceeds maximum {MAX_BRIER_SCORE} (worse than baseline)")
            return

        # Gate 5: Accuracy above minimum
        accuracy = val_metrics.get("accuracy")
        if accuracy is not None and accuracy < MIN_ACCURACY:
            _rollback(f"Accuracy {accuracy:.4f} below minimum {MIN_ACCURACY} (worse than coin flip)")
            return

        # Gate 6: Not overfitting — use per-metric threshold so regression models
        # (MAE in goal units) aren't compared against the accuracy threshold.
        from ml.config import OVERFITTING_THRESHOLDS
        if model_type == ModelType.GAME_WINNER:
            gap_threshold = OVERFITTING_THRESHOLDS.get("accuracy", MAX_TRAIN_VAL_GAP)
        else:
            gap_threshold = OVERFITTING_THRESHOLDS.get("mae", MAX_TRAIN_VAL_GAP)
        if overfit_gap > gap_threshold:
            _rollback(f"Overfitting detected: train/val gap {overfit_gap:.4f} exceeds {gap_threshold}")
            return

        logger.info(
            "New model %s/%s passed all quality gates: brier=%.4f, accuracy=%.4f, overfit_gap=%.4f",
            model_type.value, version,
            brier or 0, accuracy or 0, overfit_gap,
        )

    except Exception as e:
        _rollback(f"Verification error: {e}")
        return

    # Step 4: Only NOW deactivate the old model (new one is proven to work)
    client.table(ML_MODEL_METADATA_TABLE).update(
        {"is_active": False}
    ).eq("model_type", model_type.value).eq(
        "is_active", True
    ).neq("model_version", version).execute()

    storage.cleanup_old_versions(model_type.value)
    logger.info("Promotion complete: %s/%s is now the active model", model_type.value, version)


def _average_fold_metrics(folds, metrics_key: str) -> dict[str, float]:
    """Average a specific metrics dict across all CV folds."""
    if not folds:
        return {}
    all_keys: set[str] = set()
    for fold in folds:
        all_keys.update(getattr(fold, metrics_key, {}).keys())

    averaged: dict[str, float] = {}
    for key in all_keys:
        values = [
            getattr(fold, metrics_key, {}).get(key)
            for fold in folds
            if getattr(fold, metrics_key, {}).get(key) is not None
        ]
        if values:
            averaged[key] = sum(values) / len(values)
    return averaged


def _ping_healthcheck() -> None:
    if HEALTHCHECK_URL:
        try:
            httpx.get(HEALTHCHECK_URL, timeout=10)
        except Exception as exc:
            logger.warning("Healthcheck ping failed: %s", exc)


def _notify_discord(message: str) -> None:
    if DISCORD_WEBHOOK_URL:
        try:
            httpx.post(DISCORD_WEBHOOK_URL, json={"content": message}, timeout=10)
        except Exception as exc:
            logger.warning("Discord notification failed: %s", exc)


if __name__ == "__main__":
    main()
