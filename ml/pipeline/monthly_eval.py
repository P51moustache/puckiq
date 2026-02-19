"""
Monthly model evaluation pipeline.

Runs once per month to produce a comprehensive "report card" for our models.

HOW MONTHLY EVALUATION WORKS (tutorial):

  The daily pipeline makes predictions. The daily scoring tells us if individual
  predictions were right or wrong. But the monthly evaluation asks bigger questions:

  1. CALIBRATION (game_winner only): When we say "65% chance home wins," does home
     actually win ~65% of the time? A well-calibrated model's predicted probabilities
     match real-world frequencies.

  2. CONFIDENCE ACCURACY (game_winner only): Are we more accurate on "high confidence"
     picks? If our high-confidence picks (>65%) aren't more accurate than low-confidence
     ones (<55%), the confidence system isn't working.

  3. REGRESSION METRICS (spread & totals): How far off are our point predictions?
     MAE and RMSE tell us the average error magnitude. Lower is better.

  4. BASELINE COMPARISON (game_winner only): Is our fancy ML model actually better
     than simple rules? Baselines keep us honest.

  5. OVERFITTING TREND (all models): Is the gap between training and validation
     metrics growing over time? We track this across model versions per model type.

  WHY MONTHLY INSTEAD OF WEEKLY?
  These evaluations require enough scored predictions to be statistically meaningful.
  With ~5-15 games per day, a month gives us 150-450 scored predictions — enough
  to fill calibration buckets and compute reliable accuracy numbers.
"""

import logging
import sys
from datetime import datetime, timezone
from typing import Any

import httpx
import numpy as np
import pandas as pd
from supabase import Client

from ml.config import (
    CURRENT_SEASON,
    DISCORD_WEBHOOK_URL,
    HEALTHCHECK_URL,
    ML_MODEL_EVALUATIONS_TABLE,
    ML_MODEL_METADATA_TABLE,
    ML_SCORES_TABLE,
    ModelType,
)
from ml.evaluation.calibration import compute_calibration_buckets, compute_ece
from ml.evaluation.overfitting import compute_train_val_gap_history
from ml.features.disk_cache import compute_features_with_cache
from ml.features.registry import load_feature_registry
from ml.io.supabase_client import create_supabase_client, read_games
from ml.models.baselines import evaluate_baselines

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    """Monthly evaluation pipeline."""
    logger.info("=== PuckIQ Monthly Evaluation ===")
    try:
        _run()
    except Exception as exc:
        logger.error("Monthly eval failed: %s", exc, exc_info=True)
        _notify_discord(f"Monthly eval FAILED: {exc}")
        sys.exit(1)


def _run() -> None:
    client = create_supabase_client()
    evaluation_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Pre-compute baselines once (shared across model evaluations, only used by game_winner).
    # We do this outside the loop to avoid re-computing features for each model type.
    games_df = read_games(client, CURRENT_SEASON, game_state=["OFF", "FINAL"])
    baseline_results: dict[str, Any] = {}
    if not games_df.empty:
        games_df = games_df.sort_values("game_date").reset_index(drop=True)
        registry = load_feature_registry()
        features_df = compute_features_with_cache(
            games_df, client, registry=registry,
        )
        baseline_results = evaluate_baselines(games_df, features_df)

    # Evaluate each model type: game_winner, spread, totals.
    # Each gets its own row in ml_model_evaluations via UPSERT on
    # (model_type, model_version, evaluation_date).
    model_types_to_eval = [ModelType.GAME_WINNER, ModelType.SPREAD, ModelType.TOTALS]
    evaluated_count = 0

    for model_type in model_types_to_eval:
        logger.info("--- Evaluating %s ---", model_type.value)

        active_version = _get_active_model_version(client, model_type.value)
        if not active_version:
            logger.warning("No active model version found for %s — skipping", model_type.value)
            continue

        scores_df = _load_scores(client, model_type.value)
        if scores_df.empty:
            logger.warning("No scores found for %s — skipping", model_type.value)
            continue

        # Build the evaluation row based on model type
        if model_type == ModelType.GAME_WINNER:
            evaluation = _evaluate_game_winner(
                client, scores_df, active_version, evaluation_date, baseline_results
            )
        elif model_type == ModelType.SPREAD:
            evaluation = _evaluate_spread(
                client, scores_df, active_version, evaluation_date
            )
        elif model_type == ModelType.TOTALS:
            evaluation = _evaluate_totals(
                client, scores_df, active_version, evaluation_date
            )
        else:
            continue

        # UPSERT to ml_model_evaluations
        client.table(ML_MODEL_EVALUATIONS_TABLE).upsert(
            evaluation, on_conflict="model_type,model_version,evaluation_date"
        ).execute()
        logger.info(
            "Wrote monthly evaluation for %s version %s",
            model_type.value, active_version,
        )
        evaluated_count += 1

    if evaluated_count == 0:
        logger.warning("No models were evaluated — no active versions or scores found")
        return

    _ping_healthcheck()
    logger.info("=== Monthly evaluation complete (%d models evaluated) ===", evaluated_count)


# ---------------------------------------------------------------------------
# Per-model-type evaluation builders
# ---------------------------------------------------------------------------


def _evaluate_game_winner(
    client: Client,
    scores_df: pd.DataFrame,
    active_version: str,
    evaluation_date: str,
    baseline_results: dict[str, Any],
) -> dict[str, Any]:
    """
    Build evaluation row for game_winner model.

    Metrics: accuracy, Brier score, ECE, calibration buckets, confidence
    breakdown, baseline comparisons, overfitting trend.

    This is the original evaluation logic, preserved exactly as-is.
    """
    # Calibration analysis.
    #   We use home_win_prob (the predicted probability) and was_correct (the outcome)
    #   from the ml_prediction_scores table.
    #
    #   WHY CALIBRATION MATTERS:
    #   A model can be "accurate" (>50% correct) but poorly calibrated. For example,
    #   if ALL predictions are between 0.48 and 0.52, we'd get ~50% accuracy but
    #   zero useful confidence information. Calibration tells us if the probability
    #   values themselves are meaningful.
    ece_score = None
    if "home_win_prob" in scores_df.columns and "was_correct" in scores_df.columns:
        predictions = scores_df["home_win_prob"].values
        actuals = scores_df["was_correct"].astype(float).values
        buckets = compute_calibration_buckets(predictions, actuals)
        calibration_data = [
            {
                "bucket": f"{b.bucket_low:.1f}-{b.bucket_high:.1f}",
                "predicted_avg": b.predicted_avg,
                "actual_avg": b.actual_avg,
                "count": b.count,
            }
            for b in buckets
        ]
        ece_score = compute_ece(predictions, actuals)
    else:
        calibration_data = []

    # Accuracy by confidence level.
    confidence_breakdown = _accuracy_by_confidence(scores_df)

    # Baselines comparison.
    vs_naive = None
    vs_simple = None
    vs_rule = None
    model_accuracy = float(scores_df["was_correct"].mean()) if "was_correct" in scores_df.columns else 0.0
    if "naive_home" in baseline_results:
        vs_naive = model_accuracy - baseline_results["naive_home"].get("accuracy", 0.0)
    if "logistic" in baseline_results:
        vs_simple = model_accuracy - baseline_results["logistic"].get("accuracy", 0.0)
    if "favorite" in baseline_results:
        vs_rule = model_accuracy - baseline_results["favorite"].get("accuracy", 0.0)

    # Overfitting trend across model versions.
    metadata_list = _load_model_metadata_history(client, ModelType.GAME_WINNER.value)
    gap_history = compute_train_val_gap_history(metadata_list)

    is_overfitting = gap_history[-1]["is_overfitting"] if gap_history else False
    per_metric_gaps = gap_history[-1].get("gaps", {}) if gap_history else {}

    evaluation = {
        "model_type": ModelType.GAME_WINNER.value,
        "model_version": active_version,
        "evaluation_date": evaluation_date,
        "calibration_buckets": calibration_data,
        "accuracy_by_confidence": confidence_breakdown,
        "vs_naive_baseline": vs_naive,
        "vs_simple_baseline": vs_simple,
        "vs_rule_based": vs_rule,
        "train_val_gap_history": gap_history,
        "is_overfitting": is_overfitting,
    }

    # Store ECE and per-metric gaps inside train_val_gap_history JSONB
    # since ml_model_evaluations doesn't have dedicated columns for these.
    if isinstance(evaluation.get("train_val_gap_history"), list):
        evaluation["train_val_gap_history"].append({
            "version": "_summary",
            "ece": ece_score,
            "per_metric_gaps": per_metric_gaps,
        })
    elif gap_history is None:
        evaluation["train_val_gap_history"] = [{
            "version": "_summary",
            "ece": ece_score,
            "per_metric_gaps": per_metric_gaps,
        }]

    return evaluation


def _evaluate_spread(
    client: Client,
    scores_df: pd.DataFrame,
    active_version: str,
    evaluation_date: str,
) -> dict[str, Any]:
    """
    Build evaluation row for spread model.

    Metrics: MAE, RMSE (from spread_error column in ml_prediction_scores).

    Spread is a regression model, so calibration buckets and confidence
    breakdowns don't apply. We store regression metrics in the JSONB fields.
    """
    # Compute MAE and RMSE from spread_error.
    mae = None
    rmse = None
    n_scored = 0
    if "spread_error" in scores_df.columns:
        errors = scores_df["spread_error"].dropna()
        n_scored = len(errors)
        if n_scored > 0:
            mae = float(errors.mean())
            rmse = float(np.sqrt((errors ** 2).mean()))
            logger.info(
                "Spread metrics: MAE=%.3f, RMSE=%.3f (n=%d)",
                mae, rmse, n_scored,
            )

    # Overfitting trend.
    metadata_list = _load_model_metadata_history(client, ModelType.SPREAD.value)
    gap_history = compute_train_val_gap_history(metadata_list)
    is_overfitting = gap_history[-1]["is_overfitting"] if gap_history else False
    per_metric_gaps = gap_history[-1].get("gaps", {}) if gap_history else {}

    # Store regression metrics in train_val_gap_history JSONB (same pattern
    # as game_winner stores ECE there — no dedicated columns in the table).
    gap_history_with_summary = list(gap_history) if gap_history else []
    gap_history_with_summary.append({
        "version": "_summary",
        "mae": mae,
        "rmse": rmse,
        "n_scored": n_scored,
        "per_metric_gaps": per_metric_gaps,
    })

    return {
        "model_type": ModelType.SPREAD.value,
        "model_version": active_version,
        "evaluation_date": evaluation_date,
        # Calibration and confidence don't apply to regression models.
        "calibration_buckets": None,
        "accuracy_by_confidence": None,
        # No baseline comparisons for spread (yet).
        "vs_naive_baseline": None,
        "vs_simple_baseline": None,
        "vs_rule_based": None,
        "train_val_gap_history": gap_history_with_summary,
        "is_overfitting": is_overfitting,
    }


def _evaluate_totals(
    client: Client,
    scores_df: pd.DataFrame,
    active_version: str,
    evaluation_date: str,
) -> dict[str, Any]:
    """
    Build evaluation row for totals model.

    Metrics: MAE, RMSE (from total_error column in ml_prediction_scores).

    Like spread, totals is a regression model. Calibration and confidence
    breakdowns don't apply.
    """
    # Compute MAE and RMSE from total_error.
    mae = None
    rmse = None
    n_scored = 0
    if "total_error" in scores_df.columns:
        errors = scores_df["total_error"].dropna()
        n_scored = len(errors)
        if n_scored > 0:
            mae = float(errors.mean())
            rmse = float(np.sqrt((errors ** 2).mean()))
            logger.info(
                "Totals metrics: MAE=%.3f, RMSE=%.3f (n=%d)",
                mae, rmse, n_scored,
            )

    # Overfitting trend.
    metadata_list = _load_model_metadata_history(client, ModelType.TOTALS.value)
    gap_history = compute_train_val_gap_history(metadata_list)
    is_overfitting = gap_history[-1]["is_overfitting"] if gap_history else False
    per_metric_gaps = gap_history[-1].get("gaps", {}) if gap_history else {}

    gap_history_with_summary = list(gap_history) if gap_history else []
    gap_history_with_summary.append({
        "version": "_summary",
        "mae": mae,
        "rmse": rmse,
        "n_scored": n_scored,
        "per_metric_gaps": per_metric_gaps,
    })

    return {
        "model_type": ModelType.TOTALS.value,
        "model_version": active_version,
        "evaluation_date": evaluation_date,
        "calibration_buckets": None,
        "accuracy_by_confidence": None,
        "vs_naive_baseline": None,
        "vs_simple_baseline": None,
        "vs_rule_based": None,
        "train_val_gap_history": gap_history_with_summary,
        "is_overfitting": is_overfitting,
    }


def _get_active_model_version(client: Client, model_type: str) -> str | None:
    """Get the active model version from metadata."""
    response = (
        client.table(ML_MODEL_METADATA_TABLE)
        .select("model_version")
        .eq("model_type", model_type)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]["model_version"]
    return None


def _load_scores(client: Client, model_type: str) -> pd.DataFrame:
    """Load all prediction scores for a model type."""
    response = (
        client.table(ML_SCORES_TABLE)
        .select("*")
        .eq("model_type", model_type)
        .execute()
    )
    return pd.DataFrame(response.data) if response.data else pd.DataFrame()


def _load_model_metadata_history(
    client: Client, model_type: str
) -> list[dict[str, Any]]:
    """
    Load historical model metadata for overfitting trend analysis.

    Each row has train_accuracy and overfit_gap columns that we use
    to track whether overfitting is getting worse over model versions.
    """
    response = (
        client.table(ML_MODEL_METADATA_TABLE)
        .select("*")
        .eq("model_type", model_type)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []


def _accuracy_by_confidence(scores_df: pd.DataFrame) -> list[dict[str, Any]]:
    """
    Break down accuracy by predicted confidence level.

    WHY THIS MATTERS:
    If a model says "70% chance home wins" and "52% chance home wins," the 70%
    prediction should be right more often. If both have the same accuracy, the
    model's probability outputs don't carry useful information beyond the binary
    pick, and we should investigate feature quality or calibration issues.
    """
    if "home_win_prob" not in scores_df.columns or "was_correct" not in scores_df.columns:
        return []

    breakdowns = []
    bins = [(0.5, 0.55), (0.55, 0.60), (0.60, 0.65), (0.65, 0.70), (0.70, 1.0)]

    for low, high in bins:
        # Use max(prob, 1-prob) as confidence regardless of pick direction.
        # A 0.3 home_win_prob means 0.7 confidence in the away team.
        probs = scores_df["home_win_prob"].values
        confidence = np.maximum(probs, 1 - probs)
        mask = (confidence >= low) & (confidence < high)
        subset = scores_df[mask]

        if len(subset) > 0:
            breakdowns.append({
                "confidence_range": f"{low:.2f}-{high:.2f}",
                "accuracy": float(subset["was_correct"].mean()),
                "count": int(len(subset)),
            })

    return breakdowns


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
