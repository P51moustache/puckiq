"""
Monthly model evaluation pipeline.

Runs once per month to produce a comprehensive "report card" for our models.

HOW MONTHLY EVALUATION WORKS (tutorial):

  The daily pipeline makes predictions. The daily scoring tells us if individual
  predictions were right or wrong. But the monthly evaluation asks bigger questions:

  1. CALIBRATION: When we say "65% chance home wins," does home actually win ~65%
     of the time? A well-calibrated model's predicted probabilities match real-world
     frequencies. If our "65% predictions" only win 50% of the time, we're
     overconfident and need to fix something.

  2. CONFIDENCE ACCURACY: Are we more accurate on "high confidence" picks? If our
     high-confidence picks (>65%) aren't more accurate than low-confidence ones
     (<55%), the confidence system isn't working.

  3. BASELINE COMPARISON: Is our fancy ML model actually better than simple rules?
     If "always pick the home team" beats our LightGBM model, we have a problem.
     Baselines keep us honest.

  4. OVERFITTING TREND: Is the gap between training and validation accuracy growing
     over time? If so, the model is memorizing patterns rather than learning real
     predictive signals. We track this across model versions.

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
from ml.evaluation.overfitting import compute_train_val_gap_history, detect_overfitting
from ml.features.compute import compute_all_features
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

    # Get the active model version for game_winner
    active_version = _get_active_model_version(client, ModelType.GAME_WINNER.value)
    if not active_version:
        logger.warning("No active model version found for %s", ModelType.GAME_WINNER.value)
        return

    # 1. Load all prediction scores for game_winner.
    #    These are the "graded" predictions from the daily scoring pipeline.
    scores_df = _load_scores(client, ModelType.GAME_WINNER.value)
    if scores_df.empty:
        logger.warning("No scores found for %s", ModelType.GAME_WINNER.value)
        return

    # 2. Calibration analysis.
    #    We use home_win_prob (the predicted probability) and was_correct (the outcome)
    #    from the ml_prediction_scores table. These are the actual DB column names.
    #
    #    WHY CALIBRATION MATTERS:
    #    A model can be "accurate" (>50% correct) but poorly calibrated. For example,
    #    if ALL predictions are between 0.48 and 0.52, we'd get ~50% accuracy but
    #    zero useful confidence information. Calibration tells us if the probability
    #    values themselves are meaningful.
    ece_score = None
    if "home_win_prob" in scores_df.columns and "was_correct" in scores_df.columns:
        # For calibration, we need predicted probability and binary outcome.
        # was_correct is already binary (True/False), which numpy treats as 1/0.
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

    # 3. Accuracy by confidence level.
    #    Break down: are high-confidence picks more accurate than low-confidence?
    confidence_breakdown = _accuracy_by_confidence(scores_df)

    # 4. Baselines comparison.
    #    Compute features for all games and run the three baselines to get their
    #    accuracy. We then compare our model's accuracy to these baselines.
    games_df = read_games(client, CURRENT_SEASON, game_state="OFF")
    baseline_results: dict[str, Any] = {}
    vs_naive = None
    vs_simple = None
    vs_rule = None

    if not games_df.empty:
        games_df = games_df.sort_values("game_date").reset_index(drop=True)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        registry = load_feature_registry()
        features_df = compute_all_features(games_df, today, client, registry)
        baseline_results = evaluate_baselines(games_df, features_df)

        # Compare our model accuracy to baselines (delta = how much better we are)
        model_accuracy = float(scores_df["was_correct"].mean()) if "was_correct" in scores_df.columns else 0.0
        if "naive_home" in baseline_results:
            vs_naive = model_accuracy - baseline_results["naive_home"].get("accuracy", 0.0)
        if "logistic" in baseline_results:
            vs_simple = model_accuracy - baseline_results["logistic"].get("accuracy", 0.0)
        if "favorite" in baseline_results:
            vs_rule = model_accuracy - baseline_results["favorite"].get("accuracy", 0.0)

    # 5. Overfitting trend across model versions.
    metadata_list = _load_model_metadata_history(client, ModelType.GAME_WINNER.value)
    gap_history = compute_train_val_gap_history(metadata_list)

    # Check if latest model shows overfitting, and compute per-metric gaps
    is_overfitting = gap_history[-1]["is_overfitting"] if gap_history else False
    per_metric_gaps = gap_history[-1].get("gaps", {}) if gap_history else {}

    # 6. Write evaluation to ml_model_evaluations.
    #    Column names must match the DB schema exactly.
    #    The UNIQUE constraint is (model_type, model_version, evaluation_date).
    evaluation_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

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
        # Store ECE and per-metric gaps inside train_val_gap_history JSONB
        # since ml_model_evaluations doesn't have dedicated columns for these.
    }
    if isinstance(evaluation.get("train_val_gap_history"), dict):
        evaluation["train_val_gap_history"]["ece"] = ece_score
        evaluation["train_val_gap_history"]["per_metric_gaps"] = per_metric_gaps
    elif gap_history is None:
        evaluation["train_val_gap_history"] = {"ece": ece_score, "per_metric_gaps": per_metric_gaps}

    # Match the DB UNIQUE constraint: (model_type, model_version, evaluation_date)
    client.table(ML_MODEL_EVALUATIONS_TABLE).upsert(
        evaluation, on_conflict="model_type,model_version,evaluation_date"
    ).execute()
    logger.info("Wrote monthly evaluation for %s version %s", ModelType.GAME_WINNER.value, active_version)

    _ping_healthcheck()
    logger.info("=== Monthly evaluation complete ===")


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
