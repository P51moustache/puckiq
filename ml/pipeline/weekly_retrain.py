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
    HEALTHCHECK_URL,
    MAX_ECE_FOR_PROMOTION,
    MAX_TRAIN_VAL_GAP,
    MIN_BRIER_IMPROVEMENT,
    MIN_GAMES_FOR_PROMOTION,
    ModelType,
)
from ml.evaluation.calibration import compute_ece
from ml.evaluation.overfitting import check_underfitting, detect_overfitting
from ml.evaluation.validation import walk_forward_cv
from ml.features.compute import compute_all_features
from ml.features.registry import get_model_features, load_feature_registry
from ml.io.model_storage import ModelStorage
from ml.io.supabase_client import (
    create_supabase_client,
    read_games,
    write_model_metadata,
)
from ml.models.game_winner import GameWinnerModel
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

    # 1. Get all completed games this season.
    #    We train on finished games only (game_state='OFF') — these have final scores.
    games_df = read_games(client, CURRENT_SEASON, game_state="OFF")
    if games_df.empty:
        logger.warning("No completed games found for season %d", CURRENT_SEASON)
        return

    # Sort chronologically — CRITICAL for walk-forward CV.
    # If games aren't in time order, the model could train on future data.
    games_df = games_df.sort_values("game_date").reset_index(drop=True)
    logger.info("Loaded %d completed games", len(games_df))

    # Compute features for all games.
    # Note: compute_all_features uses each game's game_date as the as_of_date,
    # so standings and rolling stats are always from before the game was played.
    registry = load_feature_registry()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    features_df = compute_all_features(games_df, today, client, registry)

    # Build target variables from actual game results.
    # These are what the models try to predict:
    #   - home_win: did the home team win? (binary: 0 or 1)
    #   - spread: by how much? (home_score - away_score, can be negative)
    #   - total: how many total goals? (home_score + away_score)
    home_win = (games_df["home_score"] > games_df["away_score"]).astype(int)
    spread = games_df["home_score"] - games_df["away_score"]
    total = games_df["home_score"] + games_df["away_score"]

    # 2. Retrain each model type
    _retrain_game_winner(storage, features_df, home_win, games_df, client)
    _retrain_spread(storage, features_df, spread, games_df, client)
    _retrain_totals(storage, features_df, total, games_df, client)

    # 3. Ping healthcheck
    _ping_healthcheck()
    logger.info("=== Weekly retrain complete ===")


def _retrain_game_winner(
    storage: ModelStorage,
    features_df: pd.DataFrame,
    targets: pd.Series,
    games_df: pd.DataFrame,
    client,
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
    X = features_df[available].fillna(0)

    logger.info("Retraining %s with %d features, %d games", model_type.value, len(available), len(X))

    if len(X) < MIN_GAMES_FOR_PROMOTION:
        logger.warning("Not enough games (%d < %d) for promotion", len(X), MIN_GAMES_FOR_PROMOTION)

    # Walk-forward CV: simulate real-world performance
    folds = walk_forward_cv(GameWinnerModel, X, targets)
    if not folds:
        logger.warning("No CV folds completed for %s", model_type.value)
        return

    avg_val_metrics = _average_fold_metrics(folds, "val_metrics")
    avg_train_metrics = _average_fold_metrics(folds, "train_metrics")

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

    # Calibration check (game_winner only): compute ECE from the last CV fold's
    # out-of-sample predictions. We train a fresh model on the last fold's
    # training split and predict on the validation split to get real OOS probs.
    import numpy as np
    from ml.config import VALIDATION_WINDOW
    val_size = min(VALIDATION_WINDOW, len(X) // 4)
    cal_model = GameWinnerModel()
    cal_model.train(X.iloc[:-val_size], targets.iloc[:-val_size])
    cal_preds = cal_model.predict(X.iloc[-val_size:])
    cal_actuals = targets.iloc[-val_size:].values
    ece_value = compute_ece(np.asarray(cal_preds), np.asarray(cal_actuals))
    logger.info("Calibration ECE for %s: %.4f (max allowed: %.4f)", model_type.value, ece_value, MAX_ECE_FOR_PROMOTION)

    if ece_value > MAX_ECE_FOR_PROMOTION:
        logger.warning(
            "Calibration gate FAILED for %s: ECE=%.4f > %.4f — skipping promotion",
            model_type.value, ece_value, MAX_ECE_FOR_PROMOTION,
        )
        return

    # Train final model on ALL data (not just the training folds).
    # Why? Walk-forward CV tells us how well the model generalizes. But for the
    # production model, we want to use all available data to maximize accuracy.
    final_model = GameWinnerModel()
    train_metrics = final_model.train(X, targets)

    # Compute overfit gap for metadata
    overfit_gap = overfit["gaps"].get("accuracy", overfit["gaps"].get("brier_score", 0.0))

    # Compare to current active model and maybe promote
    _maybe_promote(
        storage, client, model_type, final_model,
        val_metrics=avg_val_metrics,
        train_metrics=train_metrics,
        overfit_gap=overfit_gap,
        n_games=len(X),
        features_used=available,
        feature_importance=final_model.get_feature_importance(),
        verification_features=X.iloc[-1:],  # last game for smoke test
        ece=ece_value,
    )


def _retrain_spread(
    storage: ModelStorage,
    features_df: pd.DataFrame,
    targets: pd.Series,
    games_df: pd.DataFrame,
    client,
) -> None:
    """Retrain spread model."""
    model_type = ModelType.SPREAD
    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in features_df.columns]
    X = features_df[available].fillna(0)

    logger.info("Retraining %s with %d features, %d games", model_type.value, len(available), len(X))

    folds = walk_forward_cv(SpreadModel, X, targets)
    if not folds:
        return

    avg_val_metrics = _average_fold_metrics(folds, "val_metrics")
    avg_train_metrics = _average_fold_metrics(folds, "train_metrics")
    overfit = detect_overfitting(avg_train_metrics, avg_val_metrics)
    overfit_gap = overfit["gaps"].get("mae", 0.0)

    # Underfitting check
    underfit = check_underfitting(avg_val_metrics, model_type.value)
    if underfit["is_underfitting"]:
        logger.warning("Underfitting detected for %s: %s — skipping promotion", model_type.value, underfit["reason"])
        return

    final_model = SpreadModel()
    train_metrics = final_model.train(X, targets)

    _maybe_promote(
        storage, client, model_type, final_model,
        val_metrics=avg_val_metrics,
        train_metrics=train_metrics,
        overfit_gap=overfit_gap,
        n_games=len(X),
        features_used=available,
        feature_importance=final_model.get_feature_importance(),
        verification_features=X.iloc[-1:],
    )


def _retrain_totals(
    storage: ModelStorage,
    features_df: pd.DataFrame,
    targets: pd.Series,
    games_df: pd.DataFrame,
    client,
) -> None:
    """Retrain totals model (Poisson + LightGBM ensemble)."""
    model_type = ModelType.TOTALS
    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in features_df.columns]
    X = features_df[available].fillna(0)

    logger.info("Retraining %s with %d features, %d games", model_type.value, len(available), len(X))

    folds = walk_forward_cv(TotalsModel, X, targets)
    if not folds:
        return

    avg_val_metrics = _average_fold_metrics(folds, "val_metrics")
    avg_train_metrics = _average_fold_metrics(folds, "train_metrics")
    overfit = detect_overfitting(avg_train_metrics, avg_val_metrics)
    overfit_gap = overfit["gaps"].get("mae", 0.0)

    # Underfitting check
    underfit = check_underfitting(avg_val_metrics, model_type.value)
    if underfit["is_underfitting"]:
        logger.warning("Underfitting detected for %s: %s — skipping promotion", model_type.value, underfit["reason"])
        return

    final_model = TotalsModel()
    train_metrics = final_model.train(X, targets)

    _maybe_promote(
        storage, client, model_type, final_model,
        val_metrics=avg_val_metrics,
        train_metrics=train_metrics,
        overfit_gap=overfit_gap,
        n_games=len(X),
        features_used=available,
        feature_importance=final_model.get_feature_importance(),
        verification_features=X.iloc[-1:],
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
    #
    # Convert numpy types to native Python — Supabase JSON serialization
    # doesn't understand numpy int32/float64 etc.
    def _to_native(obj):
        """Recursively convert numpy types to Python native for JSON."""
        import numpy as np
        if isinstance(obj, dict):
            return {k: _to_native(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_to_native(v) for v in obj]
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return obj

    write_model_metadata(client, _to_native({
        "model_type": model_type.value,
        "model_version": version,
        "training_games": n_games,
        "val_brier_score": val_metrics.get("brier_score"),
        "val_accuracy": val_metrics.get("accuracy"),
        "val_log_loss": val_metrics.get("log_loss"),
        "val_mae": val_metrics.get("mae"),
        "val_rmse": val_metrics.get("rmse"),
        "train_accuracy": train_metrics.get("train_accuracy"),
        "overfit_gap": overfit_gap,
        "val_ece": ece,
        "feature_importance": feature_importance or None,
        "features_used": features_used,
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

        # Gate 6: Not overfitting
        if overfit_gap > MAX_TRAIN_VAL_GAP:
            _rollback(f"Overfitting detected: train/val gap {overfit_gap:.4f} exceeds {MAX_TRAIN_VAL_GAP}")
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
