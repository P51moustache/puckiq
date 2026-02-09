"""
Backfill predictions + scores using honest out-of-sample predictions.

Instead of using the production model (trained on ALL games), we train
temporary models on the first 70% of games and predict the last 30%.
This gives realistic accuracy/MAE numbers for the dashboard.

Usage:
    ml/.venv/bin/python -m ml.scripts.backfill_predictions
"""

import logging
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from ml.config import (
    CONFIDENCE_HIGH,
    CONFIDENCE_LOW,
    CURRENT_SEASON,
    ModelType,
)
from ml.features.compute import FeatureCache, compute_all_features
from ml.features.registry import get_model_features, load_feature_registry
from ml.io.supabase_client import (
    create_supabase_client,
    read_games,
    write_predictions,
    write_scores,
)
from ml.models.game_winner import GameWinnerModel
from ml.models.spread import SpreadModel
from ml.models.totals import TotalsModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

TRAIN_FRACTION = 0.70  # Train on first 70%, predict last 30%


def _to_native(obj):
    """Recursively convert numpy types to Python native for JSON."""
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_native(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def main() -> None:
    logger.info("=== Backfilling honest OOS predictions + scores ===")
    client = create_supabase_client()

    # Load all completed games
    games_df = read_games(client, CURRENT_SEASON, game_state="OFF")
    if games_df.empty:
        logger.warning("No completed games found")
        return
    games_df = games_df.sort_values("game_date").reset_index(drop=True)
    n_total = len(games_df)
    split_idx = int(n_total * TRAIN_FRACTION)
    logger.info("Loaded %d completed games, split at %d (train=%d, test=%d)",
                n_total, split_idx, split_idx, n_total - split_idx)

    # Compute features for ALL games (cache is shared)
    registry = load_feature_registry()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logger.info("Building FeatureCache...")
    cache = FeatureCache.build(client, games_df)
    features_df = compute_all_features(games_df, today, client, registry, use_cache=True, cache=cache)

    # Targets
    home_win = (games_df["home_score"] > games_df["away_score"]).astype(int)
    spread = games_df["home_score"] - games_df["away_score"]
    total = games_df["home_score"] + games_df["away_score"]

    # Train/test split
    train_games = games_df.iloc[:split_idx]
    test_games = games_df.iloc[split_idx:]
    train_features = features_df.iloc[:split_idx]
    test_features = features_df.iloc[split_idx:]
    train_home_win = home_win.iloc[:split_idx]
    test_home_win = home_win.iloc[split_idx:]
    train_spread = spread.iloc[:split_idx]
    test_spread = spread.iloc[split_idx:]
    train_total = total.iloc[:split_idx]
    test_total = total.iloc[split_idx:]

    # --- Game Winner ---
    gw_probs = _backfill_game_winner(
        train_features, test_features, train_home_win, test_home_win,
        test_games, client
    )

    # Inject cross-model feature for spread/totals test set
    if gw_probs is not None:
        # Also need gw predictions on training data for cross-model feature
        gw_feature_names = get_model_features(ModelType.GAME_WINNER)
        gw_available = [f for f in gw_feature_names if f in features_df.columns]
        gw_model_temp = GameWinnerModel()
        gw_model_temp.train(train_features[gw_available], train_home_win)
        train_gw_probs = gw_model_temp.predict(train_features[gw_available])
        train_features = train_features.copy()
        train_features["gw_home_win_prob"] = train_gw_probs
        test_features = test_features.copy()
        test_features["gw_home_win_prob"] = gw_probs

    # --- Spread ---
    _backfill_spread(
        train_features, test_features, train_spread, test_spread,
        test_games, client
    )

    # --- Totals ---
    _backfill_totals(
        train_features, test_features, train_total, test_total,
        test_games, client
    )

    logger.info("=== Backfill complete ===")


def _backfill_game_winner(train_features, test_features, train_y, test_y,
                          test_games, client) -> np.ndarray | None:
    model_type = ModelType.GAME_WINNER
    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in train_features.columns]

    X_train = train_features[available]
    X_test = test_features[available]

    logger.info("Game winner: training on %d games, predicting %d", len(X_train), len(X_test))
    model = GameWinnerModel()
    model.train(X_train, train_y)
    probs = model.predict(X_test)

    # Evaluate
    from sklearn.metrics import accuracy_score
    preds_binary = (probs >= 0.5).astype(int)
    accuracy = accuracy_score(test_y.values, preds_binary)
    logger.info("Game winner OOS accuracy: %.4f (%d games)", accuracy, len(test_y))

    # Build prediction + score rows
    predictions = []
    scores = []
    version = f"backfill_oos_{datetime.now(timezone.utc).strftime('%Y%m%d')}"

    for i, (_, game) in enumerate(test_games.iterrows()):
        home_win_prob = float(probs[i])
        away_win_prob = 1.0 - home_win_prob
        game_date = game["game_date"]

        if home_win_prob >= 0.5:
            predicted_winner = game["home_team_abbrev"]
            confidence_val = home_win_prob
        else:
            predicted_winner = game["away_team_abbrev"]
            confidence_val = away_win_prob

        if confidence_val >= CONFIDENCE_HIGH:
            confidence = "high"
        elif confidence_val >= CONFIDENCE_LOW:
            confidence = "medium"
        else:
            confidence = "low"

        predictions.append({
            "game_id": int(game["id"]),
            "model_type": model_type.value,
            "model_version": version,
            "game_date": game_date,
            "home_win_prob": home_win_prob,
            "away_win_prob": away_win_prob,
            "predicted_winner": predicted_winner,
            "confidence": confidence,
            "data_quality": "backfill_oos",
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        })

        home_won = game["home_score"] > game["away_score"]
        actual_winner = game["home_team_abbrev"] if home_won else game["away_team_abbrev"]
        was_correct = (home_win_prob >= 0.5) == home_won

        scores.append(_to_native({
            "game_id": int(game["id"]),
            "game_date": game_date,
            "model_type": model_type.value,
            "predicted_winner": predicted_winner,
            "actual_winner": actual_winner,
            "was_correct": was_correct,
            "home_win_prob": home_win_prob,
            "actual_spread": int(game["home_score"] - game["away_score"]),
            "actual_total": int(game["home_score"] + game["away_score"]),
            "scored_at": datetime.now(timezone.utc).isoformat(),
        }))

    BATCH = 200
    for i in range(0, len(predictions), BATCH):
        write_predictions(client, predictions[i:i + BATCH])
    for i in range(0, len(scores), BATCH):
        write_scores(client, scores[i:i + BATCH])

    logger.info("Game winner: wrote %d predictions + %d scores", len(predictions), len(scores))
    return probs


def _backfill_spread(train_features, test_features, train_y, test_y,
                     test_games, client):
    model_type = ModelType.SPREAD
    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in train_features.columns]

    X_train = train_features[available]
    X_test = test_features[available]

    logger.info("Spread: training on %d games, predicting %d", len(X_train), len(X_test))
    model = SpreadModel()
    model.train(X_train, train_y)
    spreads = model.predict(X_test)

    from sklearn.metrics import mean_absolute_error
    mae = mean_absolute_error(test_y.values, spreads)
    logger.info("Spread OOS MAE: %.4f (%d games)", mae, len(test_y))

    predictions = []
    scores = []
    version = f"backfill_oos_{datetime.now(timezone.utc).strftime('%Y%m%d')}"

    for i, (_, game) in enumerate(test_games.iterrows()):
        game_date = game["game_date"]
        predicted_spread = float(spreads[i])
        actual_s = int(test_y.iloc[i])

        predictions.append(_to_native({
            "game_id": int(game["id"]),
            "model_type": model_type.value,
            "model_version": version,
            "game_date": game_date,
            "predicted_spread": predicted_spread,
            "data_quality": "backfill_oos",
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        }))

        actual_winner = (
            game["home_team_abbrev"] if game["home_score"] > game["away_score"]
            else game["away_team_abbrev"]
        )
        scores.append(_to_native({
            "game_id": int(game["id"]),
            "game_date": game_date,
            "model_type": model_type.value,
            "actual_winner": actual_winner,
            "predicted_spread": predicted_spread,
            "actual_spread": actual_s,
            "actual_total": int(game["home_score"] + game["away_score"]),
            "spread_error": abs(predicted_spread - actual_s),
            "scored_at": datetime.now(timezone.utc).isoformat(),
        }))

    BATCH = 200
    for i in range(0, len(predictions), BATCH):
        write_predictions(client, predictions[i:i + BATCH])
    for i in range(0, len(scores), BATCH):
        write_scores(client, scores[i:i + BATCH])

    logger.info("Spread: wrote %d predictions + %d scores", len(predictions), len(scores))


def _backfill_totals(train_features, test_features, train_y, test_y,
                     test_games, client):
    model_type = ModelType.TOTALS
    feature_names = get_model_features(model_type)
    available = [f for f in feature_names if f in train_features.columns]

    X_train = train_features[available].fillna(0)
    X_test = test_features[available].fillna(0)

    logger.info("Totals: training on %d games, predicting %d", len(X_train), len(X_test))
    model = TotalsModel()
    model.train(X_train, train_y)
    totals = model.predict(X_test)

    from sklearn.metrics import mean_absolute_error
    mae = mean_absolute_error(test_y.values, totals)
    logger.info("Totals OOS MAE: %.4f (%d games)", mae, len(test_y))

    predictions = []
    scores = []
    version = f"backfill_oos_{datetime.now(timezone.utc).strftime('%Y%m%d')}"

    for i, (_, game) in enumerate(test_games.iterrows()):
        game_date = game["game_date"]
        predicted_total = float(totals[i])
        actual_t = int(test_y.iloc[i])

        predictions.append(_to_native({
            "game_id": int(game["id"]),
            "model_type": model_type.value,
            "model_version": version,
            "game_date": game_date,
            "predicted_total": predicted_total,
            "data_quality": "backfill_oos",
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        }))

        actual_winner = (
            game["home_team_abbrev"] if game["home_score"] > game["away_score"]
            else game["away_team_abbrev"]
        )
        scores.append(_to_native({
            "game_id": int(game["id"]),
            "game_date": game_date,
            "model_type": model_type.value,
            "actual_winner": actual_winner,
            "predicted_total": predicted_total,
            "actual_total": actual_t,
            "actual_spread": int(game["home_score"] - game["away_score"]),
            "total_error": abs(predicted_total - actual_t),
            "scored_at": datetime.now(timezone.utc).isoformat(),
        }))

    BATCH = 200
    for i in range(0, len(predictions), BATCH):
        write_predictions(client, predictions[i:i + BATCH])
    for i in range(0, len(scores), BATCH):
        write_scores(client, scores[i:i + BATCH])

    logger.info("Totals: wrote %d predictions + %d scores", len(predictions), len(scores))


if __name__ == "__main__":
    main()
