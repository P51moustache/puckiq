"""
Supabase client for the ML pipeline.

Mirrors the pattern from scripts/sync/supabase-client.mjs:
  - Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment
  - All writes use UPSERT for idempotency
  - Retry logic via tenacity
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
from supabase import Client, create_client
from tenacity import retry, stop_after_attempt, wait_exponential

from ml.config import (
    GAMES_TABLE,
    GOALIE_SEASON_STATS_TABLE,
    MAX_STALENESS_HOURS,
    ML_MODEL_METADATA_TABLE,
    ML_PREDICTIONS_TABLE,
    ML_SCORES_TABLE,
    STANDINGS_TABLE,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    SYNC_LOG_TABLE,
    TEAM_STAT_CATEGORIES_TABLE,
)

logger = logging.getLogger(__name__)


def create_supabase_client() -> Client:
    """Create and return a Supabase client using service role credentials."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Missing Supabase credentials. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
        )
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    logger.info("Connected to Supabase at %s (service_role)", SUPABASE_URL)
    return client


# ---------------------------------------------------------------------------
# Retry decorator for all Supabase operations
# ---------------------------------------------------------------------------

_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=4, max=30),
    reraise=True,
)


# ---------------------------------------------------------------------------
# Data freshness check
# ---------------------------------------------------------------------------


@_retry
def check_data_freshness(client: Client) -> bool:
    """
    Verify the NHL data sync ran within MAX_STALENESS_HOURS.

    Returns True if data is fresh, False if stale.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_STALENESS_HOURS)

    response = (
        client.table(SYNC_LOG_TABLE)
        .select("completed_at")
        .eq("status", "completed")
        .gte("completed_at", cutoff.isoformat())
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )

    if response.data:
        logger.info("Data is fresh (last sync: %s)", response.data[0]["completed_at"])
        return True

    logger.warning("Data may be stale — no sync completed in the last %d hours", MAX_STALENESS_HOURS)
    return False


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------


@_retry
def read_games(client: Client, season: int, game_state: str | None = None) -> pd.DataFrame:
    """
    Read games from the games table.

    Args:
        season: Season integer (e.g. 20252026).
        game_state: Optional filter (FUT, LIVE, FINAL, OFF).

    Returns:
        DataFrame of game rows.
    """
    query = client.table(GAMES_TABLE).select("*").eq("season", season)
    if game_state:
        query = query.eq("game_state", game_state)
    response = query.execute()
    return pd.DataFrame(response.data) if response.data else pd.DataFrame()


@_retry
def read_standings(
    client: Client, team_abbrev: str, as_of_date: str
) -> dict[str, Any] | None:
    """
    Read the latest standings snapshot for a team on or before as_of_date.

    Args:
        team_abbrev: 3-letter team code (e.g. 'TOR').
        as_of_date: Date string YYYY-MM-DD. Uses the most recent snapshot <= this date.

    Returns:
        Dict of standings columns, or None if not found.
    """
    response = (
        client.table(STANDINGS_TABLE)
        .select("*")
        .eq("team_abbrev", team_abbrev)
        .lte("snapshot_date", as_of_date)
        .order("snapshot_date", desc=True)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


@_retry
def read_team_stats(client: Client, team_abbrev: str) -> list[dict[str, Any]]:
    """
    Read team stat categories for a team.

    Returns:
        List of stat category rows (each has stat_category + data JSONB).
    """
    response = (
        client.table(TEAM_STAT_CATEGORIES_TABLE)
        .select("*")
        .eq("team_abbrev", team_abbrev)
        .execute()
    )
    return response.data or []


@_retry
def read_goalie_stats(
    client: Client, team_abbrev: str, season: int
) -> list[dict[str, Any]]:
    """
    Read goalie season stats for a team.

    Returns:
        List of goalie stat rows.
    """
    response = (
        client.table(GOALIE_SEASON_STATS_TABLE)
        .select("*")
        .eq("team_abbrev", team_abbrev)
        .eq("season", season)
        .execute()
    )
    return response.data or []


@_retry
def read_team_stat_category(
    client: Client, team_abbrev: str, season: int, category: str
) -> dict[str, Any] | None:
    """
    Read a single stat category from team_stat_categories.

    Returns the JSONB `data` dict, or None if not found.
    """
    response = (
        client.table(TEAM_STAT_CATEGORIES_TABLE)
        .select("data")
        .eq("team_abbrev", team_abbrev)
        .eq("season", season)
        .eq("stat_category", category)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0].get("data")
    return None


@_retry
def read_recent_games(
    client: Client, team_abbrev: str, before_date: str, limit: int = 10
) -> list[dict[str, Any]]:
    """
    Read recent completed games for a team (home or away) before a date.

    Used for rolling window features.
    """
    # Home games
    home_resp = (
        client.table(GAMES_TABLE)
        .select("*")
        .eq("home_team_abbrev", team_abbrev)
        .eq("game_state", "OFF")
        .lt("game_date", before_date)
        .order("game_date", desc=True)
        .limit(limit)
        .execute()
    )
    # Away games
    away_resp = (
        client.table(GAMES_TABLE)
        .select("*")
        .eq("away_team_abbrev", team_abbrev)
        .eq("game_state", "OFF")
        .lt("game_date", before_date)
        .order("game_date", desc=True)
        .limit(limit)
        .execute()
    )

    all_games = (home_resp.data or []) + (away_resp.data or [])
    all_games.sort(key=lambda g: g["game_date"], reverse=True)
    return all_games[:limit]


# ---------------------------------------------------------------------------
# Write operations (all UPSERT for idempotency)
# ---------------------------------------------------------------------------


@_retry
def write_predictions(client: Client, predictions: list[dict[str, Any]]) -> int:
    """
    UPSERT predictions to ml_predictions.

    Each prediction must include: game_id, model_type, model_version (at minimum).
    The UNIQUE constraint is (game_id, model_type, model_version), so we can store
    predictions from multiple model versions for the same game.

    Returns number of rows written.
    """
    if not predictions:
        return 0
    # Match the DB UNIQUE constraint: (game_id, model_type, model_version)
    response = client.table(ML_PREDICTIONS_TABLE).upsert(
        predictions, on_conflict="game_id,model_type,model_version"
    ).execute()
    count = len(response.data) if response.data else 0
    logger.info("Wrote %d predictions to %s", count, ML_PREDICTIONS_TABLE)
    return count


@_retry
def write_scores(client: Client, scores: list[dict[str, Any]]) -> int:
    """
    UPSERT prediction scores to ml_prediction_scores.

    Each score must include: game_id, model_type (at minimum).
    Returns number of rows written.
    """
    if not scores:
        return 0
    response = client.table(ML_SCORES_TABLE).upsert(
        scores, on_conflict="game_id,model_type"
    ).execute()
    count = len(response.data) if response.data else 0
    logger.info("Wrote %d scores to %s", count, ML_SCORES_TABLE)
    return count


@_retry
def write_model_metadata(client: Client, metadata: dict[str, Any]) -> None:
    """
    UPSERT model metadata to ml_model_metadata.

    Must include: model_type and model_version (the UNIQUE constraint pair).
    Each retrain creates a new row (different model_version), so the full
    history of model versions is preserved.
    """
    # Match the DB UNIQUE constraint: (model_type, model_version)
    client.table(ML_MODEL_METADATA_TABLE).upsert(
        metadata, on_conflict="model_type,model_version"
    ).execute()
    logger.info(
        "Updated metadata for model_type=%s version=%s",
        metadata.get("model_type"), metadata.get("model_version"),
    )
