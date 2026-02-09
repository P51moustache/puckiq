"""
Run baseline models on historical NHL game data.

This is the FIRST step before any ML work -- establish what accuracy
"dumb" models achieve so we know what bar the ML models must clear.

Usage:
    python -m ml.scripts.run_baselines
    python -m ml.scripts.run_baselines --dry-run   # synthetic data, no Supabase needed

The 3 baselines:
  1. Naive -- Home team always wins (~55% in NHL historically)
  2. Favorite -- Higher points% team wins (~56-57%)
  3. Simple Logistic -- Logistic regression with 5 features (~56-58%)

WHY BASELINES MATTER:
  If your fancy ML model gets 57% accuracy, that sounds decent until you
  realize "just pick the home team" gets 55%. Your model only adds 2% over
  the dumbest possible strategy. Baselines keep ML models honest.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, brier_score_loss

from ml.config import CURRENT_SEASON, MIN_TRAINING_GAMES, STEP_SIZE, VALIDATION_WINDOW
from ml.models.baselines import (
    FavoriteBaseline,
    NaiveBaseline,
    SimpleLogisticBaseline,
)

logger = logging.getLogger(__name__)

# Output location for JSON results
RESULTS_PATH = Path(__file__).resolve().parent.parent / "baselines_results.json"


# ---------------------------------------------------------------------------
# Walk-forward CV adapter for SimpleLogisticBaseline
# ---------------------------------------------------------------------------
# The walk_forward_cv() function in ml.evaluation.validation expects a model
# with train() + evaluate() methods (TrainableModel protocol). Our
# SimpleLogisticBaseline has fit() + evaluate(). Rather than modifying the
# baseline class (which is also used elsewhere), we create a thin adapter.
# ---------------------------------------------------------------------------


class _LogisticWalkForwardAdapter:
    """Adapter so SimpleLogisticBaseline works with walk_forward_cv."""

    def __init__(self) -> None:
        self._model = SimpleLogisticBaseline()

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
    ) -> dict[str, float]:
        self._model.fit(features_df, targets)
        return self._model.evaluate(features_df, targets)

    def evaluate(
        self, features_df: pd.DataFrame, targets: pd.Series
    ) -> dict[str, float]:
        return self._model.evaluate(features_df, targets)


# ---------------------------------------------------------------------------
# Synthetic data generator (for --dry-run without Supabase)
# ---------------------------------------------------------------------------


def _generate_synthetic_data(n_games: int = 300) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generate synthetic NHL game data for testing the pipeline without Supabase.

    Returns:
        (games_df, features_df) matching the shapes expected by baselines.
    """
    rng = np.random.default_rng(42)

    teams = ["TOR", "BOS", "MTL", "NYR", "FLA", "TBL", "CAR", "NJD",
             "EDM", "COL", "VGK", "WPG", "DAL", "MIN", "VAN", "LAK"]

    # Generate games with realistic-ish scores
    home_teams = rng.choice(teams, n_games)
    away_teams = rng.choice(teams, n_games)
    # Avoid same-team matchups
    for i in range(n_games):
        while away_teams[i] == home_teams[i]:
            away_teams[i] = rng.choice(teams)

    # Home teams win ~55% of the time (realistic NHL home advantage)
    home_advantage = 0.55
    home_wins = rng.random(n_games) < home_advantage

    home_scores = np.where(home_wins, rng.poisson(3.2, n_games), rng.poisson(2.3, n_games))
    away_scores = np.where(home_wins, rng.poisson(2.3, n_games), rng.poisson(3.2, n_games))
    # Ensure winner actually has more goals
    for i in range(n_games):
        if home_wins[i] and home_scores[i] <= away_scores[i]:
            home_scores[i] = away_scores[i] + 1
        elif not home_wins[i] and away_scores[i] <= home_scores[i]:
            away_scores[i] = home_scores[i] + 1

    # Create date range spanning a season
    dates = pd.date_range("2025-10-10", periods=n_games, freq="D")

    games_df = pd.DataFrame({
        "id": [f"2025020{i:04d}" for i in range(n_games)],
        "home_team_abbrev": home_teams,
        "away_team_abbrev": away_teams,
        "home_score": home_scores,
        "away_score": away_scores,
        "game_date": dates.strftime("%Y-%m-%d"),
        "game_state": "OFF",
        "season": CURRENT_SEASON,
    })

    # Generate synthetic features auto-discovered from features.yaml
    from ml.features.registry import generate_synthetic_features
    n = len(games_df)
    features_df = generate_synthetic_features(n=n, model_type="game_winner", seed=42)
    features_df.index = games_df["id"]

    return games_df, features_df


# ---------------------------------------------------------------------------
# Live data loading (Supabase)
# ---------------------------------------------------------------------------


def _load_live_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Load completed games and compute features from Supabase.

    Returns:
        (games_df, features_df) for the current season.
    """
    from ml.features.compute import compute_all_features
    from ml.io.supabase_client import create_supabase_client, read_games

    client = create_supabase_client()

    logger.info("Loading completed games for season %d...", CURRENT_SEASON)
    games_df = read_games(client, season=CURRENT_SEASON, game_state="OFF")

    if games_df.empty:
        logger.error("No completed games found for season %d", CURRENT_SEASON)
        sys.exit(1)

    # Sort chronologically -- essential for walk-forward CV
    games_df = games_df.sort_values("game_date").reset_index(drop=True)
    logger.info("Loaded %d completed games", len(games_df))

    # Compute features for all games
    # Use the most recent game date as as_of_date (features are computed
    # per-game with leakage protection inside compute_all_features)
    latest_date = games_df["game_date"].max()
    logger.info("Computing features (as_of_date=%s)...", latest_date)
    features_df = compute_all_features(games_df, as_of_date=latest_date, client=client)

    return games_df, features_df


# ---------------------------------------------------------------------------
# Baseline evaluation runners
# ---------------------------------------------------------------------------


def _run_naive(games_df: pd.DataFrame) -> dict[str, Any]:
    """Run naive (home team always wins) baseline."""
    model = NaiveBaseline()
    result = model.evaluate(games_df)
    return {
        "model": "naive_home",
        "description": "Always pick the home team",
        "method": "full_dataset",
        **result,
    }


def _run_favorite(
    games_df: pd.DataFrame, features_df: pd.DataFrame
) -> dict[str, Any]:
    """Run favorite (higher point%) baseline."""
    model = FavoriteBaseline()
    result = model.evaluate(games_df, features_df)
    return {
        "model": "favorite",
        "description": "Pick team with higher season point%",
        "method": "full_dataset",
        **result,
    }


def _run_logistic_walkforward(
    games_df: pd.DataFrame, features_df: pd.DataFrame
) -> dict[str, Any]:
    """
    Run simple logistic baseline with walk-forward CV.

    Walk-forward gives a fair (not overfit) accuracy estimate because the model
    never sees future games during training.
    """
    from ml.evaluation.validation import walk_forward_cv

    targets = (games_df["home_score"] > games_df["away_score"]).astype(int)

    n_games = len(games_df)

    # Check if we have enough games for walk-forward
    if n_games < MIN_TRAINING_GAMES + VALIDATION_WINDOW:
        logger.warning(
            "Only %d games available. Need %d for walk-forward CV. "
            "Falling back to 70/30 train/test split.",
            n_games,
            MIN_TRAINING_GAMES + VALIDATION_WINDOW,
        )
        return _run_logistic_simple_split(games_df, features_df, targets)

    # Walk-forward CV for fair estimate
    folds = walk_forward_cv(
        model_class=_LogisticWalkForwardAdapter,
        features_df=features_df,
        targets=targets,
        min_train=MIN_TRAINING_GAMES,
        val_window=VALIDATION_WINDOW,
        step_size=STEP_SIZE,
    )

    if not folds:
        logger.warning("Walk-forward CV produced 0 folds. Falling back to simple split.")
        return _run_logistic_simple_split(games_df, features_df, targets)

    # Aggregate across folds (weighted by fold size for correctness)
    total_games = sum(f.val_size for f in folds)
    avg_accuracy = sum(f.val_metrics["accuracy"] * f.val_size for f in folds) / total_games
    avg_brier = sum(f.val_metrics["brier_score"] * f.val_size for f in folds) / total_games

    return {
        "model": "logistic",
        "description": "Logistic regression (5 features, walk-forward CV)",
        "method": "walk_forward_cv",
        "accuracy": round(avg_accuracy, 4),
        "brier_score": round(avg_brier, 4),
        "n_games": total_games,
        "n_folds": len(folds),
        "fold_details": [
            {
                "fold": f.fold_idx,
                "train_size": f.train_size,
                "val_size": f.val_size,
                "val_accuracy": round(f.val_metrics["accuracy"], 4),
                "val_brier": round(f.val_metrics["brier_score"], 4),
            }
            for f in folds
        ],
    }


def _run_logistic_simple_split(
    games_df: pd.DataFrame,
    features_df: pd.DataFrame,
    targets: pd.Series,
) -> dict[str, Any]:
    """Fallback: train/test split when not enough games for walk-forward CV."""
    split = int(len(games_df) * 0.7)
    if split < 20:
        logger.warning("Too few games (%d) even for simple split.", len(games_df))
        return {
            "model": "logistic",
            "description": "Logistic regression (5 features) -- INSUFFICIENT DATA",
            "method": "insufficient_data",
            "accuracy": 0.0,
            "brier_score": 1.0,
            "n_games": 0,
        }

    model = SimpleLogisticBaseline()
    model.fit(features_df.iloc[:split], targets.iloc[:split])
    result = model.evaluate(features_df.iloc[split:], targets.iloc[split:])

    return {
        "model": "logistic",
        "description": "Logistic regression (5 features, 70/30 split)",
        "method": "train_test_split",
        **result,
    }


# ---------------------------------------------------------------------------
# Results formatting
# ---------------------------------------------------------------------------


def _print_results_table(results: list[dict[str, Any]], is_dry_run: bool) -> None:
    """Print a clear, readable results table to stdout."""
    print()
    print("=" * 72)
    if is_dry_run:
        print("  BASELINE RESULTS (DRY RUN -- synthetic data)")
    else:
        print("  BASELINE RESULTS (season %d)" % CURRENT_SEASON)
    print("=" * 72)
    print()

    # Table header
    print(f"  {'Baseline':<45} {'Accuracy':>8}  {'Brier':>8}  {'Games':>6}")
    print(f"  {'-' * 45} {'-' * 8}  {'-' * 8}  {'-' * 6}")

    for r in results:
        name = r["description"]
        acc = r["accuracy"]
        brier = r["brier_score"]
        n = r["n_games"]

        acc_str = f"{acc:.1%}" if acc > 0 else "N/A"
        brier_str = f"{brier:.4f}" if acc > 0 else "N/A"
        n_str = str(n) if n > 0 else "N/A"

        print(f"  {name:<45} {acc_str:>8}  {brier_str:>8}  {n_str:>6}")

    print()

    # Interpretation guide
    best = max(results, key=lambda r: r["accuracy"])
    print("  Key takeaways:")
    print(f"  - Best baseline: {best['description']} at {best['accuracy']:.1%}")
    print(f"  - Any ML model MUST beat {best['accuracy']:.1%} accuracy to be useful")
    print(f"  - Target Brier score: < {best['brier_score']:.4f} (lower is better)")
    print()

    # Logistic fold details if available
    logistic = next((r for r in results if r["model"] == "logistic"), None)
    if logistic and logistic.get("fold_details"):
        print("  Walk-forward CV fold details (logistic):")
        print(f"    {'Fold':>4}  {'Train':>6}  {'Val':>4}  {'Accuracy':>8}  {'Brier':>8}")
        print(f"    {'-' * 4}  {'-' * 6}  {'-' * 4}  {'-' * 8}  {'-' * 8}")
        for fold in logistic["fold_details"]:
            print(
                f"    {fold['fold']:>4}  {fold['train_size']:>6}  "
                f"{fold['val_size']:>4}  {fold['val_accuracy']:>7.1%}  "
                f"{fold['val_brier']:>8.4f}"
            )
        print()

    if is_dry_run:
        print("  NOTE: These results are from synthetic data.")
        print("  Run without --dry-run to evaluate on real Supabase data.")
        print()

    print("=" * 72)
    print()


def _save_results(results: list[dict[str, Any]], is_dry_run: bool) -> None:
    """Save results to JSON for reference by weekly retrain pipeline."""
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "season": CURRENT_SEASON,
        "is_dry_run": is_dry_run,
        "baselines": {},
    }

    for r in results:
        # Remove fold_details from top-level to keep the summary clean
        summary = {k: v for k, v in r.items() if k != "fold_details"}
        output["baselines"][r["model"]] = summary

        # Store fold details separately if present
        if "fold_details" in r:
            output["baselines"][r["model"]]["fold_details"] = r["fold_details"]

    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(output, f, indent=2, default=str)

    logger.info("Results saved to %s", RESULTS_PATH)
    print(f"  Results saved to: {RESULTS_PATH}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    """Run all baselines and report results."""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Check for --dry-run flag
    is_dry_run = "--dry-run" in sys.argv

    # Load data
    if is_dry_run:
        logger.info("DRY RUN mode -- using synthetic data")
        games_df, features_df = _generate_synthetic_data(n_games=300)
    else:
        games_df, features_df = _load_live_data()

    n_games = len(games_df)
    logger.info("Running baselines on %d games...", n_games)

    # Warn if dataset is small
    if n_games < 100:
        logger.warning(
            "Only %d games available. Results will be noisy. "
            "Ideally need 200+ games for stable baseline estimates.",
            n_games,
        )

    # Align indices: features_df is indexed by game_id, games_df has 'id' column.
    # Ensure they are in the same order.
    if "id" in games_df.columns:
        games_df = games_df.set_index("id")
        # Reindex features_df to match games_df order
        common_ids = games_df.index.intersection(features_df.index)
        if len(common_ids) < len(games_df):
            logger.warning(
                "Features missing for %d/%d games. Using %d games with features.",
                len(games_df) - len(common_ids),
                len(games_df),
                len(common_ids),
            )
        games_df = games_df.loc[common_ids]
        features_df = features_df.loc[common_ids]

    # --- Run baselines ---
    results: list[dict[str, Any]] = []

    # 1. Naive baseline (no features needed)
    logger.info("Running naive baseline (always pick home team)...")
    results.append(_run_naive(games_df))

    # 2. Favorite baseline (needs point percentages)
    logger.info("Running favorite baseline (pick higher point%%)...")
    results.append(_run_favorite(games_df, features_df))

    # 3. Simple logistic baseline (walk-forward CV)
    logger.info("Running simple logistic baseline (walk-forward CV)...")
    results.append(_run_logistic_walkforward(games_df, features_df))

    # --- Output ---
    _print_results_table(results, is_dry_run)
    _save_results(results, is_dry_run)


if __name__ == "__main__":
    main()
