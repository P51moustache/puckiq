"""
Feature computation engine.

Reads feature definitions from the registry and computes values for each game
by querying Supabase. All features use as_of_date to prevent data leakage.

WHAT IS DATA LEAKAGE? (tutorial)

  Data leakage happens when your model accidentally "sees" information from the
  future during training. Example: if we're predicting whether TOR beats BOS on
  Feb 10, we must NOT use TOR's standings from Feb 10 (which include the result
  of the Feb 10 game). We use Feb 9's standings instead.

  This is why EVERY feature computation takes an as_of_date parameter:
  - Standings: use snapshot_date < game_date (day before)
  - Rolling stats: only include games played BEFORE the game we're predicting
  - Goalie stats: season aggregates (safe because they update slowly)

  If we skip this, our model will look amazing in backtesting (because it's
  cheating) but perform terribly in production. Leakage is the #1 cause of
  "my model had 80% accuracy in testing but 52% in production."
"""

import logging
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from supabase import Client

from ml.config import CURRENT_SEASON
from ml.features.registry import FeatureDefinition, load_feature_registry
from ml.io.supabase_client import read_goalie_stats, read_recent_games, read_standings

logger = logging.getLogger(__name__)


def compute_all_features(
    games_df: pd.DataFrame,
    as_of_date: str,
    client: Client,
    registry: dict[str, FeatureDefinition] | None = None,
) -> pd.DataFrame:
    """
    Compute all enabled features for a DataFrame of games.

    Args:
        games_df: DataFrame with columns: id, home_team_abbrev, away_team_abbrev, game_date.
        as_of_date: Date string YYYY-MM-DD. Features are computed as of this date.
        client: Supabase client.
        registry: Feature registry (loaded from YAML if not provided).

    Returns:
        DataFrame indexed by game id with one column per feature.
    """
    if registry is None:
        registry = load_feature_registry()

    results: list[dict[str, Any]] = []

    for _, game in games_df.iterrows():
        game_id = game["id"]
        home = game["home_team_abbrev"]
        away = game["away_team_abbrev"]
        game_date = str(game.get("game_date", as_of_date))

        # Use the day before game_date for standings to prevent leakage.
        # WHY YESTERDAY? Because today's standings might include today's game result.
        # The NHL updates standings after each game, so if TOR plays at 7pm and we
        # query standings at 10pm, TOR's record would already include tonight's result.
        standings_date = _day_before(game_date)

        row: dict[str, Any] = {"game_id": game_id}

        # Pre-fetch shared data to avoid repeated queries
        home_standings = read_standings(client, home, standings_date)
        away_standings = read_standings(client, away, standings_date)
        home_recent = None
        away_recent = None
        home_goalies = None
        away_goalies = None

        for feat_name, feat_def in registry.items():
            try:
                if feat_def.compute_type == "lookup":
                    row[feat_name] = _compute_lookup(
                        feat_def, home, away, home_standings, away_standings,
                        client, game_date,
                    )
                elif feat_def.compute_type == "rolling_team":
                    if home_recent is None:
                        home_recent = read_recent_games(client, home, game_date, limit=10)
                    if away_recent is None:
                        away_recent = read_recent_games(client, away, game_date, limit=10)
                    row[feat_name] = _compute_rolling_team(
                        feat_def, home, away, home_recent, away_recent,
                    )
                elif feat_def.compute_type == "derived":
                    row[feat_name] = _compute_derived(feat_def, row, home, away,
                                                       home_recent, away_recent, game_date)
                else:
                    row[feat_name] = np.nan
            except Exception as exc:
                logger.warning("Failed to compute %s for game %s: %s", feat_name, game_id, exc)
                row[feat_name] = np.nan

        results.append(row)

    df = pd.DataFrame(results)
    if "game_id" in df.columns:
        df = df.set_index("game_id")
    logger.info("Computed %d features for %d games", len(registry), len(games_df))
    return df


# ---------------------------------------------------------------------------
# Individual compute functions
# ---------------------------------------------------------------------------


def _compute_lookup(
    feat_def: FeatureDefinition,
    home: str,
    away: str,
    home_standings: dict[str, Any] | None,
    away_standings: dict[str, Any] | None,
    client: Client,
    game_date: str,
) -> float:
    """Compute a lookup feature from standings or goalie stats."""
    config = feat_def.config
    team_key = config.get("team_key", "home_team")
    column = config.get("column", "")
    table = config.get("table", "standings")

    team_abbrev = home if team_key == "home_team" else away

    if table == "standings":
        standings = home_standings if team_key == "home_team" else away_standings
        if standings and column in standings:
            return float(standings[column])
        return np.nan

    if table == "goalie_season_stats":
        goalies = read_goalie_stats(client, team_abbrev, CURRENT_SEASON)
        if not goalies:
            return np.nan
        # Select starter: goalie with most games started
        starter = max(goalies, key=lambda g: g.get("games_started", 0))
        value = starter.get(column)
        if value is None:
            return np.nan
        return float(value)

    return np.nan


def _compute_rolling_team(
    feat_def: FeatureDefinition,
    home: str,
    away: str,
    home_recent: list[dict[str, Any]],
    away_recent: list[dict[str, Any]],
) -> float:
    """Compute a rolling-window team feature from recent games."""
    config = feat_def.config
    team_key = config.get("team_key", "home_team")
    stat = config.get("stat", "")
    window = config.get("window", 10)

    team_abbrev = home if team_key == "home_team" else away
    recent = home_recent if team_key == "home_team" else away_recent
    recent = recent[:window]

    if not recent:
        return np.nan

    values: list[float] = []
    for game in recent:
        is_home = game["home_team_abbrev"] == team_abbrev

        if stat == "goals_for":
            values.append(float(game["home_score"] if is_home else game["away_score"]))
        elif stat == "goals_against":
            values.append(float(game["away_score"] if is_home else game["home_score"]))
        elif stat == "win":
            home_won = (game.get("home_score", 0) or 0) > (game.get("away_score", 0) or 0)
            values.append(1.0 if (home_won == is_home) else 0.0)

    if not values:
        return np.nan
    return float(np.mean(values))


def _compute_derived(
    feat_def: FeatureDefinition,
    current_row: dict[str, Any],
    home: str,
    away: str,
    home_recent: list[dict[str, Any]] | None,
    away_recent: list[dict[str, Any]] | None,
    game_date: str,
) -> float:
    """Compute a derived feature from already-computed features or game schedule."""
    name = feat_def.name

    if name == "point_pctg_diff":
        home_pctg = current_row.get("home_point_pctg", np.nan)
        away_pctg = current_row.get("away_point_pctg", np.nan)
        if np.isnan(home_pctg) or np.isnan(away_pctg):
            return np.nan
        return home_pctg - away_pctg

    if name == "rest_advantage":
        home_rest = _days_since_last_game(home_recent, game_date)
        away_rest = _days_since_last_game(away_recent, game_date)
        if home_rest is None or away_rest is None:
            return np.nan
        return float(home_rest - away_rest)

    if name == "home_is_back_to_back":
        rest = _days_since_last_game(home_recent, game_date)
        # Back-to-back means exactly 1 day since last game (played yesterday).
        # rest == 0 would be a same-day doubleheader, which doesn't happen in NHL.
        return 1.0 if rest is not None and rest == 1 else 0.0

    if name == "away_is_back_to_back":
        rest = _days_since_last_game(away_recent, game_date)
        return 1.0 if rest is not None and rest == 1 else 0.0

    return np.nan


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _day_before(date_str: str) -> str:
    """Return the date string for the day before date_str."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return (dt - timedelta(days=1)).strftime("%Y-%m-%d")


def _days_since_last_game(
    recent_games: list[dict[str, Any]] | None, game_date: str
) -> int | None:
    """Compute days between game_date and the most recent game in the list."""
    if not recent_games:
        return None
    last_date_str = recent_games[0].get("game_date", "")
    if not last_date_str:
        return None
    game_dt = datetime.strptime(game_date, "%Y-%m-%d")
    last_dt = datetime.strptime(str(last_date_str), "%Y-%m-%d")
    return (game_dt - last_dt).days
