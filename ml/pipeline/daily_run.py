"""
Daily ML pipeline entry point.

Runs every day via GitHub Actions after the NHL data sync completes.

HOW THIS PIPELINE WORKS (tutorial):

  The daily pipeline is the "inference" step — it takes today's games and
  produces predictions using models that were trained during the weekly retrain.
  Think of it like this: the weekly pipeline is "study time" and the daily
  pipeline is "test day."

  The 10 steps below run in sequence because each depends on the previous:

  1. Connect to Supabase (our database)
  2. Check that NHL data was synced recently (stale data = bad predictions)
  3. Get today's scheduled games from the games table
  4. Compute features for each game (team stats, recent form, goalie stats)
  5. Load the trained models from Supabase Storage
  6. Run each model to produce predictions
  7. Write predictions to ml_predictions table
  8. Score yesterday's predictions now that those games are final
  9. Ping a healthcheck URL so we know the pipeline ran
  10. On failure: send a Discord alert

  WHY SCORE YESTERDAY, NOT TODAY?
  When we make predictions in the morning, those games haven't been played yet.
  Yesterday's games are now final (game_state = 'OFF'), so we can compare our
  predictions to actual results. This one-day lag is standard in sports ML.
"""

import logging
import sys
from datetime import datetime, timezone

import httpx

from ml.config import (
    CONFIDENCE_HIGH,
    CONFIDENCE_LOW,
    CURRENT_SEASON,
    DISCORD_WEBHOOK_URL,
    HEALTHCHECK_URL,
    ModelType,
)
from ml.evaluation.scoring import score_yesterdays_predictions
import pandas as pd

from ml.features.compute import compute_all_features, compute_player_features
from ml.features.registry import get_model_features, load_feature_registry
from ml.io.model_storage import ModelStorage
from ml.io.supabase_client import (
    check_data_freshness,
    create_supabase_client,
    read_games,
    read_player_season_stats,
    write_predictions,
)
from ml.models.player_props import PlayerPropsModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    """Daily prediction pipeline."""
    logger.info("=== PuckIQ Daily ML Pipeline ===")
    try:
        _run()
    except Exception as exc:
        logger.error("Pipeline failed: %s", exc, exc_info=True)
        _notify_discord(f"Daily ML pipeline FAILED: {exc}")
        sys.exit(1)


def _run() -> None:
    # 1. Initialize Supabase (uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars)
    client = create_supabase_client()

    # 2. Check that the NHL data sync ran recently.
    #    If data is stale (sync hasn't run in MAX_STALENESS_HOURS), we still make
    #    predictions but flag them with data_quality='stale' so the app can show
    #    a warning to users. Stale predictions are better than no predictions.
    is_fresh = check_data_freshness(client)
    data_quality = "fresh" if is_fresh else "stale"

    # 3. Get today's future (unplayed) games
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    games_df = read_games(client, CURRENT_SEASON, game_state="FUT")
    todays_games = games_df[games_df["game_date"] == today] if not games_df.empty else games_df

    if todays_games.empty:
        logger.info("No games scheduled for today (%s)", today)
    else:
        logger.info("Found %d games for today", len(todays_games))

        # 4. Compute features for today's games.
        #    CRITICAL: as_of_date=today means standings use yesterday's snapshot
        #    and rolling stats only include games played before today. This prevents
        #    "data leakage" — using information we wouldn't have at prediction time.
        registry = load_feature_registry()
        features_df = compute_all_features(todays_games, today, client, registry)

        # 5. Load active models from Supabase Storage
        storage = ModelStorage(client)

        # 6 + 7. Run inference for each model type and write predictions.
        #    Each _predict_* function loads one model, runs it on today's features,
        #    and writes results to the ml_predictions table. If a model hasn't been
        #    trained yet (no artifact in storage), we skip it gracefully.
        gw_probs = _predict_game_winners(storage, features_df, todays_games, today, client, data_quality)
        # Inject cross-model feature for spread/totals
        if gw_probs is not None and len(gw_probs) == len(features_df):
            features_df["gw_home_win_prob"] = gw_probs
            logger.info("Injected gw_home_win_prob for spread/totals (%d values)", len(gw_probs))
        _predict_spreads(storage, features_df, todays_games, today, client, data_quality)
        _predict_totals(storage, features_df, todays_games, today, client, data_quality)
        _predict_player_props(storage, todays_games, today, client, data_quality)

    # 8. Score yesterday's predictions (now that those games are final)
    scored = score_yesterdays_predictions(client)
    logger.info("Scored %d predictions from yesterday", scored)

    # 9. Ping healthcheck (e.g. Healthchecks.io or Betteruptime)
    _ping_healthcheck()
    logger.info("=== Daily pipeline complete ===")


def _predict_game_winners(
    storage: ModelStorage,
    features_df,
    games_df,
    today: str,
    client,
    data_quality: str,
) -> list[float] | None:
    """
    Run game winner model and write predictions.

    WHY GAME WINNER IS OUR PRIMARY MODEL:
    Binary classification (home win yes/no) is the simplest prediction to evaluate
    and the most intuitive for users. It also produces a probability (0-1) that we
    can use for confidence levels and calibration analysis.
    """
    feature_names = get_model_features(ModelType.GAME_WINNER)
    available = [f for f in feature_names if f in features_df.columns]

    try:
        model = storage.load_model(ModelType.GAME_WINNER.value)
    except FileNotFoundError:
        logger.warning("No active game_winner model -- skipping inference")
        return None

    # Get the model version from the manifest (needed for the DB UNIQUE constraint)
    manifest = storage.get_manifest(ModelType.GAME_WINNER.value)
    model_version = manifest["active_version"] if manifest else "unknown"

    X = features_df[available]
    probs = model.predict(X)

    predictions = []
    for i, (_, game) in enumerate(games_df.iterrows()):
        home_win_prob = float(probs[i])
        away_win_prob = 1.0 - home_win_prob

        # Determine predicted winner and confidence level
        if home_win_prob >= 0.5:
            predicted_winner = game["home_team_abbrev"]
            confidence_val = home_win_prob
        else:
            predicted_winner = game["away_team_abbrev"]
            confidence_val = away_win_prob

        # Map probability to confidence label for the UI
        if confidence_val >= CONFIDENCE_HIGH:
            confidence = "high"
        elif confidence_val >= CONFIDENCE_LOW:
            confidence = "medium"
        else:
            confidence = "low"

        predictions.append({
            "game_id": int(game["id"]),
            "model_type": ModelType.GAME_WINNER.value,
            "model_version": model_version,
            "game_date": today,
            "home_win_prob": home_win_prob,
            "away_win_prob": away_win_prob,
            "predicted_winner": predicted_winner,
            "confidence": confidence,
            "data_quality": data_quality,
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        })

    write_predictions(client, predictions)
    return list(probs)


def _predict_spreads(
    storage: ModelStorage,
    features_df,
    games_df,
    today: str,
    client,
    data_quality: str,
) -> None:
    """
    Run spread model and write predictions.

    WHAT IS A SPREAD?
    The spread is (home_score - away_score). A predicted spread of +1.5 means
    we expect the home team to win by about 1.5 goals. Negative = away team favored.
    This is useful for comparing against Vegas lines.
    """
    feature_names = get_model_features(ModelType.SPREAD)
    available = [f for f in feature_names if f in features_df.columns]

    try:
        model = storage.load_model(ModelType.SPREAD.value)
    except FileNotFoundError:
        logger.warning("No active spread model -- skipping inference")
        return

    manifest = storage.get_manifest(ModelType.SPREAD.value)
    model_version = manifest["active_version"] if manifest else "unknown"

    X = features_df[available]
    spreads = model.predict(X)

    predictions = []
    for i, (_, game) in enumerate(games_df.iterrows()):
        predictions.append({
            "game_id": int(game["id"]),
            "model_type": ModelType.SPREAD.value,
            "model_version": model_version,
            "game_date": today,
            "predicted_spread": float(spreads[i]),
            "data_quality": data_quality,
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        })

    write_predictions(client, predictions)


def _predict_totals(
    storage: ModelStorage,
    features_df,
    games_df,
    today: str,
    client,
    data_quality: str,
) -> None:
    """
    Run totals model and write predictions.

    WHAT IS A TOTAL?
    The total is (home_score + away_score). Sports betting uses "over/under" lines
    (e.g., O/U 5.5 goals). Our model predicts the expected total, which users can
    compare to betting lines.

    WHY POISSON + LIGHTGBM ENSEMBLE?
    Goal scoring in hockey follows a Poisson distribution (rare discrete events).
    The Poisson model captures this statistical property and gives us a probability
    distribution (e.g., "12% chance of exactly 7 goals"). LightGBM captures complex
    feature interactions the Poisson model misses. Ensembling both gives us the
    best of both worlds.
    """
    feature_names = get_model_features(ModelType.TOTALS)
    available = [f for f in feature_names if f in features_df.columns]

    try:
        model = storage.load_model(ModelType.TOTALS.value)
    except FileNotFoundError:
        logger.warning("No active totals model -- skipping inference")
        return

    manifest = storage.get_manifest(ModelType.TOTALS.value)
    model_version = manifest["active_version"] if manifest else "unknown"

    # TotalsModel has a Poisson GLM component that cannot handle NaN
    X = features_df[available].fillna(0)
    totals = model.predict(X)

    predictions = []
    for i, (_, game) in enumerate(games_df.iterrows()):
        predictions.append({
            "game_id": int(game["id"]),
            "model_type": ModelType.TOTALS.value,
            "model_version": model_version,
            "game_date": today,
            "predicted_total": float(totals[i]),
            "data_quality": data_quality,
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        })

    write_predictions(client, predictions)


def _predict_player_props(
    storage: ModelStorage,
    games_df,
    today: str,
    client,
    data_quality: str,
) -> None:
    """Run player props model for tonight's skaters."""
    try:
        model = storage.load_model(ModelType.PLAYER_PROPS.value)
    except FileNotFoundError:
        logger.warning("No active player_props model -- skipping inference")
        return

    manifest = storage.get_manifest(ModelType.PLAYER_PROPS.value)
    model_version = manifest["active_version"] if manifest else "unknown"

    # Load season stats for feature computation
    season_stats_df = read_player_season_stats(client, CURRENT_SEASON)
    if season_stats_df.empty:
        logger.warning("No season stats available for player props")
        return

    # Get team abbreviations from tonight's games
    home_teams = set(games_df["home_team_abbrev"].tolist())
    away_teams = set(games_df["away_team_abbrev"].tolist())
    all_teams = home_teams | away_teams

    # Filter season stats to players on tonight's teams
    tonight_players = season_stats_df[season_stats_df["team_abbrev"].isin(all_teams)]

    if tonight_players.empty:
        logger.warning("No players found for tonight's teams")
        return

    # Build player-game rows for each player on each team's game
    player_game_rows = []
    for _, game in games_df.iterrows():
        home_team = game["home_team_abbrev"]
        away_team = game["away_team_abbrev"]

        # Home team players
        home_players = tonight_players[tonight_players["team_abbrev"] == home_team]
        for _, player in home_players.iterrows():
            player_game_rows.append({
                "player_id": player["player_id"],
                "game_id": int(game["id"]),
                "team_abbrev": home_team,
                "opponent_abbrev": away_team,
                "home_road": "H",
            })

        # Away team players
        away_players = tonight_players[tonight_players["team_abbrev"] == away_team]
        for _, player in away_players.iterrows():
            player_game_rows.append({
                "player_id": player["player_id"],
                "game_id": int(game["id"]),
                "team_abbrev": away_team,
                "opponent_abbrev": home_team,
                "home_road": "R",
            })

    if not player_game_rows:
        return

    player_game_df = pd.DataFrame(player_game_rows)

    # Load standings for opponent GA
    standings_df = None
    try:
        resp = client.table("standings").select("*").execute()
        standings_df = pd.DataFrame(resp.data) if resp.data else None
    except Exception:
        pass

    # Compute features
    features_df = compute_player_features(player_game_df, season_stats_df, standings_df)

    feature_names = get_model_features(ModelType.PLAYER_PROPS)
    available = [f for f in feature_names if f in features_df.columns]
    X = features_df[available].fillna(0)  # Poisson GLM cannot handle NaN

    if X.empty:
        return

    # Predict
    preds = model.predict(X)

    # Build prediction rows
    predictions = []
    for i, (_, row) in enumerate(features_df.iterrows()):
        predictions.append({
            "game_id": int(row.get("game_id", 0)),
            "model_type": ModelType.PLAYER_PROPS.value,
            "model_version": model_version,
            "game_date": today,
            "player_predictions": {
                "player_id": int(row.get("player_id", 0)),
                "expected_goals": float(preds["goals"][i]),
                "expected_assists": float(preds["assists"][i]),
                "expected_points": float(preds["points"][i]),
            },
            "data_quality": data_quality,
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        })

    # Write in batches (may be many player predictions)
    BATCH_SIZE = 100
    for i in range(0, len(predictions), BATCH_SIZE):
        batch = predictions[i:i + BATCH_SIZE]
        write_predictions(client, batch)

    logger.info("Wrote %d player prop predictions", len(predictions))


def _ping_healthcheck() -> None:
    """Ping the healthcheck URL if configured."""
    if HEALTHCHECK_URL:
        try:
            httpx.get(HEALTHCHECK_URL, timeout=10)
            logger.info("Healthcheck pinged: %s", HEALTHCHECK_URL)
        except Exception as exc:
            logger.warning("Healthcheck ping failed: %s", exc)


def _notify_discord(message: str) -> None:
    """Send an error notification to Discord if configured."""
    if DISCORD_WEBHOOK_URL:
        try:
            httpx.post(
                DISCORD_WEBHOOK_URL,
                json={"content": message},
                timeout=10,
            )
        except Exception as exc:
            logger.warning("Discord notification failed: %s", exc)


if __name__ == "__main__":
    main()
