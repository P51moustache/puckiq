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
    # Paginate to handle >1000 games per season (NHL has ~1312 regular season games)
    all_rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        query = client.table(GAMES_TABLE).select("*").eq("season", season)
        if game_state:
            query = query.eq("game_state", game_state)
        query = query.range(offset, offset + page_size - 1)
        response = query.execute()
        batch = response.data or []
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return pd.DataFrame(all_rows) if all_rows else pd.DataFrame()


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
def read_team_game_advanced_stats(
    client: Client, team_abbrev: str, season: int, limit: int = 20
) -> list[dict[str, Any]]:
    """Read per-game advanced puck possession stats for a team from skater_game_categories."""
    from ml.config import SKATER_GAME_CATEGORIES_TABLE

    response = (
        client.table(SKATER_GAME_CATEGORIES_TABLE)
        .select("game_id, player_id, team_abbrev, data")
        .eq("team_abbrev", team_abbrev)
        .eq("season", season)
        .eq("stat_category", "puckPossessions")
        .order("game_id", desc=True)
        .limit(limit * 20)  # Each game has ~18 skaters
        .execute()
    )
    return response.data or []


@_retry
def read_player_game_stats(
    client: Client, season: int, game_ids: list[int] | None = None
) -> pd.DataFrame:
    """
    Read game-level skater stats for training player props.

    Returns DataFrame with columns: player_id, game_id, game_date,
    team_abbrev, goals, assists, points, toi, shots.
    """
    from ml.config import GAME_SKATER_STATS_TABLE
    # game_skater_stats has no 'season' column — filter by game_ids instead.
    if not game_ids:
        logger.warning("read_player_game_stats called without game_ids — returning empty")
        return pd.DataFrame()
    all_rows: list[dict[str, Any]] = []
    # ~40 players per game → batch of 25 games = ~1000 rows, at Supabase limit
    batch_size = 20
    for i in range(0, len(game_ids), batch_size):
        batch = game_ids[i:i + batch_size]
        response = (
            client.table(GAME_SKATER_STATS_TABLE)
            .select("player_id, game_id, team_abbrev, goals, assists, points, toi, shots_on_goal")
            .in_("game_id", batch)
            .execute()
        )
        all_rows.extend(response.data or [])
    df = pd.DataFrame(all_rows) if all_rows else pd.DataFrame()
    # Normalize column names for downstream consumers
    if "shots_on_goal" in df.columns:
        df = df.rename(columns={"shots_on_goal": "shots"})
    return df


@_retry
def read_player_season_stats(
    client: Client, season: int
) -> pd.DataFrame:
    """
    Read skater season stats for player feature computation.

    Returns DataFrame with columns: player_id, team_abbrev,
    goals_per_game, avg_toi_per_game, shooting_pctg, etc.
    """
    from ml.config import SKATER_SEASON_STATS_TABLE
    response = (
        client.table(SKATER_SEASON_STATS_TABLE)
        .select("*")
        .eq("season", season)
        .execute()
    )
    return pd.DataFrame(response.data) if response.data else pd.DataFrame()


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
def read_game_details(client: Client, game_ids: list[int]) -> list[dict[str, Any]]:
    """Read game_details for given game IDs (season_series, scratches)."""
    from ml.config import GAME_DETAILS_TABLE
    if not game_ids:
        return []
    all_rows: list[dict[str, Any]] = []
    batch_size = 200
    for i in range(0, len(game_ids), batch_size):
        batch_ids = game_ids[i:i + batch_size]
        response = (
            client.table(GAME_DETAILS_TABLE)
            .select("game_id, season_series, scratches")
            .in_("game_id", batch_ids)
            .execute()
        )
        all_rows.extend(response.data or [])
    return all_rows


@_retry
def read_game_shots(client: Client, game_ids: list[int]) -> list[dict[str, Any]]:
    """Read shot events from game_play_by_play for given game IDs.

    NOTE: Each game has ~300 shot events. Supabase returns max 1000 rows per
    query by default, so we use small batches (3 games) to stay under the limit.
    """
    from ml.config import GAME_PLAY_BY_PLAY_TABLE
    if not game_ids:
        return []
    all_rows: list[dict[str, Any]] = []
    # ~300 shots per game → batch of 3 games = ~900 rows, safely under 1000 limit
    batch_size = 3
    for i in range(0, len(game_ids), batch_size):
        batch_ids = game_ids[i:i + batch_size]
        response = (
            client.table(GAME_PLAY_BY_PLAY_TABLE)
            .select("game_id, x_coord, y_coord, event_type, team_abbrev, detail")
            .in_("game_id", batch_ids)
            .in_("event_type", ["goal", "shot-on-goal", "missed-shot"])
            .execute()
        )
        all_rows.extend(response.data or [])
    logger.info("read_game_shots: fetched %d shot events for %d games", len(all_rows), len(game_ids))
    return all_rows


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
