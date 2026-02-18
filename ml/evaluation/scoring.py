"""
Daily prediction scoring.

After games complete, compare predictions to actual results and write scores
to the ml_prediction_scores table.

WHY DAILY SCORING?
We score predictions the day after games are played rather than in real-time
because NHL games can end in OT/SO, and the final result isn't confirmed until
the game_state changes to "OFF" in our sync. Running this the next morning
ensures all games from yesterday are finalized.

The scores table (ml_prediction_scores) is our ground truth for tracking model
performance over time. Each row answers: "For this game, what did we predict,
and what actually happened?"
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from supabase import Client

from ml.config import (
    GAME_SKATER_STATS_TABLE,
    GAMES_TABLE,
    ML_PREDICTIONS_TABLE,
    ModelType,
)
from ml.io.supabase_client import write_scores

logger = logging.getLogger(__name__)


def score_yesterdays_predictions(client: Client) -> int:
    """
    Score all predictions from yesterday against actual game results.

    Workflow:
      1. Get yesterday's date
      2. Query ml_predictions for that date
      3. Query games table for actual results
      4. Compute score for each prediction
      5. UPSERT scores to ml_prediction_scores

    Returns:
        Number of predictions scored.
    """
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    logger.info("Scoring predictions for %s", yesterday)

    # Get predictions for yesterday
    response = (
        client.table(ML_PREDICTIONS_TABLE)
        .select("*")
        .eq("game_date", yesterday)
        .execute()
    )
    predictions = response.data or []
    if not predictions:
        logger.info("No predictions found for %s", yesterday)
        return 0

    # Get actual game results
    game_ids = list({p["game_id"] for p in predictions})
    games_resp = (
        client.table(GAMES_TABLE)
        .select("id, home_team_abbrev, away_team_abbrev, home_score, away_score, game_state, period_type")
        .in_("id", game_ids)
        .execute()
    )
    games_by_id = {g["id"]: g for g in (games_resp.data or [])}

    # Pre-fetch actual player stats for player_props scoring
    player_props_preds = [p for p in predictions if p.get("model_type") == ModelType.PLAYER_PROPS and p.get("player_id")]
    actual_player_stats: dict[tuple[int, int], dict[str, Any]] = {}
    if player_props_preds:
        try:
            pp_game_ids = list({p["game_id"] for p in player_props_preds})
            # Batch query game_skater_stats
            batch_size = 20
            for i in range(0, len(pp_game_ids), batch_size):
                batch = pp_game_ids[i:i + batch_size]
                resp = (
                    client.table(GAME_SKATER_STATS_TABLE)
                    .select("player_id, game_id, goals, assists, points")
                    .in_("game_id", batch)
                    .execute()
                )
                for row in resp.data or []:
                    actual_player_stats[(row["game_id"], row["player_id"])] = row
        except Exception as exc:
            logger.warning("Failed to fetch player stats for scoring: %s", exc)

    scores: list[dict[str, Any]] = []
    for pred in predictions:
        game = games_by_id.get(pred["game_id"])
        if not game or game["game_state"] not in ("FINAL", "OFF"):
            continue

        model_type = pred["model_type"]

        # Inject actual player stats for player_props scoring
        if model_type == ModelType.PLAYER_PROPS and pred.get("player_id"):
            key = (pred["game_id"], pred["player_id"])
            pred["_actual_player_stats"] = actual_player_stats.get(key)

        score_row = _compute_score(pred, game, model_type)
        if score_row:
            scores.append(score_row)

    written = write_scores(client, scores)
    logger.info("Scored %d predictions for %s", written, yesterday)
    return written


def _compute_score(
    prediction: dict[str, Any],
    actual: dict[str, Any],
    model_type: str,
) -> dict[str, Any] | None:
    """
    Compute a score row for a single prediction.

    The returned dict must match the ml_prediction_scores table columns exactly.
    """
    game_id = prediction["game_id"]
    game_date = prediction.get("game_date")
    home_score = actual.get("home_score")
    away_score = actual.get("away_score")
    if home_score is None or away_score is None:
        logger.warning(
            "Skipping game %s: missing score (home=%s, away=%s)",
            game_id, home_score, away_score,
        )
        return None
    home_won = home_score > away_score
    actual_spread = home_score - away_score
    actual_total = home_score + away_score

    # Determine actual winner abbreviation
    actual_winner = (
        actual.get("home_team_abbrev") if home_won
        else actual.get("away_team_abbrev")
    )

    # Base fields shared by all model types (must match DB columns)
    base = {
        "game_id": game_id,
        "game_date": game_date,
        "model_type": model_type,
        "actual_winner": actual_winner,
        "actual_spread": actual_spread,
        "actual_total": actual_total,
        "scored_at": datetime.now(timezone.utc).isoformat(),
    }

    if model_type == ModelType.GAME_WINNER:
        return _score_game_winner(prediction, home_won, actual_winner, base)
    elif model_type == ModelType.SPREAD:
        return _score_spread(prediction, actual_spread, base)
    elif model_type == ModelType.TOTALS:
        return _score_totals(prediction, actual_total, base)
    elif model_type == ModelType.PLAYER_PROPS:
        return _score_player_props(prediction, base)

    return None


def _score_game_winner(
    prediction: dict[str, Any],
    home_won: bool,
    actual_winner: str | None,
    base: dict[str, Any],
) -> dict[str, Any]:
    """
    Score a game winner prediction.

    DB columns used: predicted_winner, was_correct, home_win_prob.
    """
    home_win_prob = prediction.get("home_win_prob", 0.5)
    predicted_winner = prediction.get("predicted_winner", "")

    # If predicted_winner wasn't stored, infer from probability
    if not predicted_winner:
        predicted_winner = "home" if home_win_prob >= 0.5 else "away"

    was_correct = (home_win_prob >= 0.5) == home_won

    return {
        **base,
        "predicted_winner": predicted_winner,
        "was_correct": was_correct,
        "home_win_prob": home_win_prob,
    }


def _score_spread(
    prediction: dict[str, Any], actual_spread: int, base: dict[str, Any]
) -> dict[str, Any]:
    """
    Score a spread prediction.

    DB columns used: predicted_spread, actual_spread, spread_error.
    """
    predicted_spread = prediction.get("predicted_spread", 0.0)
    spread_error = abs(predicted_spread - actual_spread)

    return {
        **base,
        "predicted_spread": predicted_spread,
        "spread_error": spread_error,
    }


def _score_totals(
    prediction: dict[str, Any], actual_total: int, base: dict[str, Any]
) -> dict[str, Any]:
    """
    Score a totals prediction.

    DB columns used: predicted_total, actual_total, total_error.
    """
    predicted_total = prediction.get("predicted_total", 0.0)
    total_error = abs(predicted_total - actual_total)

    return {
        **base,
        "predicted_total": predicted_total,
        "total_error": total_error,
    }


def _score_player_props(
    prediction: dict[str, Any],
    base: dict[str, Any],
) -> dict[str, Any] | None:
    """
    Score a player props prediction.

    Player props predictions have a player_id column and player_predictions JSONB
    with expected_goals/assists/points. Actual stats must be looked up separately
    by the caller (score_yesterdays_predictions) and injected into _actual_player_stats.

    Returns score row with player_scores JSONB containing per-stat errors.
    """
    player_id = prediction.get("player_id", 0)
    if not player_id:
        return None

    preds_jsonb = prediction.get("player_predictions") or {}
    actual = prediction.get("_actual_player_stats") or {}

    if not actual:
        return None

    expected_goals = preds_jsonb.get("expected_goals", 0.0)
    expected_assists = preds_jsonb.get("expected_assists", 0.0)
    expected_points = preds_jsonb.get("expected_points", 0.0)

    actual_goals = actual.get("goals", 0)
    actual_assists = actual.get("assists", 0)
    actual_points = actual.get("points", 0)

    player_scores = {
        "player_id": player_id,
        "expected_goals": expected_goals,
        "actual_goals": actual_goals,
        "goals_error": abs(expected_goals - actual_goals),
        "expected_assists": expected_assists,
        "actual_assists": actual_assists,
        "assists_error": abs(expected_assists - actual_assists),
        "expected_points": expected_points,
        "actual_points": actual_points,
        "points_error": abs(expected_points - actual_points),
    }

    return {
        **base,
        "player_id": player_id,
        "player_scores": player_scores,
    }
