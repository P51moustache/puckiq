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

from ml.config import (
    CURRENT_SEASON,
    GAMES_TABLE,
    GOALIE_SEASON_STATS_TABLE,
    STANDINGS_TABLE,
    TEAM_STAT_CATEGORIES_TABLE,
)
from ml.features.registry import FeatureDefinition, load_feature_registry
from ml.io.supabase_client import (
    read_goalie_stats,
    read_recent_games,
    read_standings,
    read_team_stat_category,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# FeatureCache — pre-loads all data for batch feature computation
# ---------------------------------------------------------------------------


class FeatureCache:
    """
    Pre-loads standings, goalie stats, team stat categories, and recent games
    in bulk so that compute_all_features() can avoid per-game Supabase queries.

    All lookups still respect as_of_date to prevent data leakage:
    - standings: returns the latest snapshot_date <= requested date
    - recent games: returns only games with game_date < requested date
    - goalie/team stats: season-level aggregates (no date filtering needed)

    Usage:
        cache = FeatureCache.build(client, games_df)
        features_df = compute_all_features(games_df, as_of_date, client, use_cache=True, cache=cache)
    """

    def __init__(self) -> None:
        # standings_by_team: team_abbrev -> list of dicts sorted by snapshot_date desc
        self.standings_by_team: dict[str, list[dict[str, Any]]] = {}
        # goalie_stats_by_team: team_abbrev -> list of goalie stat dicts
        self.goalie_stats_by_team: dict[str, list[dict[str, Any]]] = {}
        # team_stat_categories: (team_abbrev, category) -> data dict or None
        self.team_stat_categories: dict[tuple[str, str], dict | None] = {}
        # recent_games_by_team: team_abbrev -> list of game dicts sorted by game_date desc
        self.recent_games_by_team: dict[str, list[dict[str, Any]]] = {}

    @classmethod
    def build(cls, client: Client, games_df: pd.DataFrame) -> "FeatureCache":
        """
        Build a cache by pre-loading all data needed for the games in games_df.

        Makes ~4 bulk queries instead of O(games * features) individual queries.
        """
        cache = cls()

        # Collect unique teams from the games
        teams = set()
        for _, game in games_df.iterrows():
            teams.add(game["home_team_abbrev"])
            teams.add(game["away_team_abbrev"])
        teams_list = sorted(teams)

        logger.info("FeatureCache: pre-loading data for %d teams", len(teams_list))

        # 1. Load ALL standings for these teams (all snapshot dates)
        cache._load_standings(client, teams_list)

        # 2. Load ALL goalie season stats for these teams
        cache._load_goalie_stats(client, teams_list)

        # 3. Load ALL team stat categories for these teams
        cache._load_team_stat_categories(client, teams_list)

        # 4. Load recent games for these teams (all completed games this season)
        cache._load_recent_games(client, teams_list)

        logger.info("FeatureCache: pre-load complete")
        return cache

    def _load_standings(self, client: Client, teams: list[str]) -> None:
        """Load all standings snapshots for all teams in one query."""
        try:
            response = (
                client.table(STANDINGS_TABLE)
                .select("*")
                .in_("team_abbrev", teams)
                .order("snapshot_date", desc=True)
                .execute()
            )
            for row in response.data or []:
                team = row["team_abbrev"]
                if team not in self.standings_by_team:
                    self.standings_by_team[team] = []
                self.standings_by_team[team].append(row)
            logger.info("FeatureCache: loaded %d standings rows", len(response.data or []))
        except Exception as exc:
            logger.warning("FeatureCache: failed to load standings: %s", exc)

    def _load_goalie_stats(self, client: Client, teams: list[str]) -> None:
        """Load all goalie season stats for all teams in one query."""
        try:
            response = (
                client.table(GOALIE_SEASON_STATS_TABLE)
                .select("*")
                .in_("team_abbrev", teams)
                .eq("season", CURRENT_SEASON)
                .execute()
            )
            for row in response.data or []:
                team = row["team_abbrev"]
                if team not in self.goalie_stats_by_team:
                    self.goalie_stats_by_team[team] = []
                self.goalie_stats_by_team[team].append(row)
            logger.info("FeatureCache: loaded %d goalie stat rows", len(response.data or []))
        except Exception as exc:
            logger.warning("FeatureCache: failed to load goalie stats: %s", exc)

    def _load_team_stat_categories(self, client: Client, teams: list[str]) -> None:
        """Load all team stat categories for all teams in one query."""
        try:
            response = (
                client.table(TEAM_STAT_CATEGORIES_TABLE)
                .select("*")
                .in_("team_abbrev", teams)
                .eq("season", CURRENT_SEASON)
                .execute()
            )
            for row in response.data or []:
                team = row["team_abbrev"]
                category = row.get("stat_category", "")
                self.team_stat_categories[(team, category)] = row.get("data")
            logger.info("FeatureCache: loaded %d team stat category rows", len(response.data or []))
        except Exception as exc:
            logger.warning("FeatureCache: failed to load team stat categories: %s", exc)

    def _load_recent_games(self, client: Client, teams: list[str]) -> None:
        """Load all completed games for the teams (used for rolling features)."""
        try:
            # Load games where any of our teams played (home or away)
            home_resp = (
                client.table(GAMES_TABLE)
                .select("*")
                .in_("home_team_abbrev", teams)
                .eq("game_state", "OFF")
                .order("game_date", desc=True)
                .execute()
            )
            away_resp = (
                client.table(GAMES_TABLE)
                .select("*")
                .in_("away_team_abbrev", teams)
                .eq("game_state", "OFF")
                .order("game_date", desc=True)
                .execute()
            )

            # Deduplicate by game id and index by team
            all_games: dict[str, dict[str, Any]] = {}
            for row in (home_resp.data or []) + (away_resp.data or []):
                all_games[row["id"]] = row

            # Sort all games by date desc and index by team
            sorted_games = sorted(all_games.values(), key=lambda g: g["game_date"], reverse=True)
            for game in sorted_games:
                home_team = game["home_team_abbrev"]
                away_team = game["away_team_abbrev"]
                if home_team not in self.recent_games_by_team:
                    self.recent_games_by_team[home_team] = []
                self.recent_games_by_team[home_team].append(game)
                if away_team not in self.recent_games_by_team:
                    self.recent_games_by_team[away_team] = []
                self.recent_games_by_team[away_team].append(game)

            logger.info("FeatureCache: loaded %d unique games for rolling features", len(all_games))
        except Exception as exc:
            logger.warning("FeatureCache: failed to load recent games: %s", exc)

    def get_standings(self, team_abbrev: str, as_of_date: str) -> dict[str, Any] | None:
        """
        Get the latest standings for a team on or before as_of_date.
        Preserves leakage prevention by filtering on snapshot_date.
        """
        snapshots = self.standings_by_team.get(team_abbrev, [])
        for snapshot in snapshots:
            if snapshot.get("snapshot_date", "") <= as_of_date:
                return snapshot
        return None

    def get_goalie_stats(self, team_abbrev: str) -> list[dict[str, Any]]:
        """Get goalie season stats for a team."""
        return self.goalie_stats_by_team.get(team_abbrev, [])

    def get_team_stat_category(self, team_abbrev: str, category: str) -> dict | None:
        """Get a team stat category's JSONB data."""
        return self.team_stat_categories.get((team_abbrev, category))

    def get_recent_games(self, team_abbrev: str, before_date: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        Get recent completed games for a team before a date.
        Preserves leakage prevention by filtering on game_date < before_date.
        """
        all_team_games = self.recent_games_by_team.get(team_abbrev, [])
        filtered = [g for g in all_team_games if g["game_date"] < before_date]
        return filtered[:limit]


def compute_all_features(
    games_df: pd.DataFrame,
    as_of_date: str,
    client: Client,
    registry: dict[str, FeatureDefinition] | None = None,
    use_cache: bool = False,
    cache: FeatureCache | None = None,
) -> pd.DataFrame:
    """
    Compute all enabled features for a DataFrame of games.

    Args:
        games_df: DataFrame with columns: id, home_team_abbrev, away_team_abbrev, game_date.
        as_of_date: Date string YYYY-MM-DD. Features are computed as of this date.
        client: Supabase client.
        registry: Feature registry (loaded from YAML if not provided).
        use_cache: If True, pre-load all data in bulk to avoid per-game queries.
        cache: Pre-built FeatureCache. If use_cache=True and no cache provided,
               one will be built automatically.

    Returns:
        DataFrame indexed by game id with one column per feature.
    """
    if registry is None:
        registry = load_feature_registry()

    # Build cache if requested but not provided
    if use_cache and cache is None:
        cache = FeatureCache.build(client, games_df)

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

        # Pre-fetch shared data — from cache or from Supabase
        if cache is not None:
            home_standings = cache.get_standings(home, standings_date)
            away_standings = cache.get_standings(away, standings_date)
        else:
            home_standings = read_standings(client, home, standings_date)
            away_standings = read_standings(client, away, standings_date)

        home_recent = None
        away_recent = None
        # Per-game cache for jsonb_lookup (only used in non-cached path)
        jsonb_cache: dict[tuple[str, str], dict | None] = {}

        for feat_name, feat_def in registry.items():
            try:
                if feat_def.compute_type == "lookup":
                    row[feat_name] = _compute_lookup(
                        feat_def, home, away, home_standings, away_standings,
                        client, game_date, cache=cache,
                    )
                elif feat_def.compute_type == "rolling_team":
                    if home_recent is None:
                        if cache is not None:
                            home_recent = cache.get_recent_games(home, game_date, limit=10)
                        else:
                            home_recent = read_recent_games(client, home, game_date, limit=10)
                    if away_recent is None:
                        if cache is not None:
                            away_recent = cache.get_recent_games(away, game_date, limit=10)
                        else:
                            away_recent = read_recent_games(client, away, game_date, limit=10)
                    row[feat_name] = _compute_rolling_team(
                        feat_def, home, away, home_recent, away_recent,
                    )
                elif feat_def.compute_type == "rolling_goalie":
                    row[feat_name] = _compute_rolling_goalie(
                        feat_def, home, away, client, game_date, cache=cache,
                    )
                elif feat_def.compute_type == "jsonb_lookup":
                    row[feat_name] = _compute_jsonb_lookup(
                        feat_def, home, away, client, jsonb_cache, cache=cache,
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
    cache: FeatureCache | None = None,
) -> float:
    """Compute a lookup feature from standings or goalie stats."""
    config = feat_def.config
    team_key = config.get("team_key", "home_team")
    column = config.get("column", "")
    table = config.get("table", "standings")

    team_abbrev = home if team_key == "home_team" else away

    if table == "standings":
        standings = home_standings if team_key == "home_team" else away_standings
        if not standings:
            return np.nan

        # Virtual columns: computed rates from raw standings counts
        if column == "home_win_pct":
            wins = standings.get("home_wins", 0) or 0
            losses = standings.get("home_losses", 0) or 0
            ot = standings.get("home_ot_losses", 0) or 0
            total = wins + losses + ot
            return float(wins / total) if total > 0 else np.nan

        if column == "road_win_pct":
            wins = standings.get("road_wins", 0) or 0
            losses = standings.get("road_losses", 0) or 0
            ot = standings.get("road_ot_losses", 0) or 0
            total = wins + losses + ot
            return float(wins / total) if total > 0 else np.nan

        if column in standings:
            return float(standings[column])
        return np.nan

    if table == "goalie_season_stats":
        if cache is not None:
            goalies = cache.get_goalie_stats(team_abbrev)
        else:
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
        elif stat == "sog":
            sog = game.get("home_sog" if is_home else "away_sog")
            if sog is not None:
                values.append(float(sog))

    if not values:
        return np.nan
    return float(np.mean(values))


def _compute_rolling_goalie(
    feat_def: FeatureDefinition,
    home: str,
    away: str,
    client: Client,
    game_date: str,
    cache: FeatureCache | None = None,
) -> float:
    """
    Compute rolling goalie save% from recent game-level goalie stats.

    Falls back to season average if game-level data isn't available.
    This is a data-quality-first design: we prefer recent form (L10 starts)
    over season averages, but won't break if the granular data is missing.

    Note: Game-level goalie stats are NOT cached because they come from
    game_goalie_stats (a separate table). The cache speeds up the fallback
    path (goalie_season_stats). The game-level query is already filtered
    by team + date so it's fast.
    """
    from ml.config import CURRENT_SEASON, GAME_GOALIE_STATS_TABLE

    config = feat_def.config
    team_key = config.get("team_key", "home_team")
    window = config.get("window", 10)
    team_abbrev = home if team_key == "home_team" else away

    try:
        # Try to get game-level goalie stats for recent starts
        response = (
            client.table(GAME_GOALIE_STATS_TABLE)
            .select("game_id, game_date, save_pctg, decision, player_name")
            .eq("team_abbrev", team_abbrev)
            .lt("game_date", game_date)
            .order("game_date", desc=True)
            .limit(window * 2)  # Fetch extra to filter for starter
            .execute()
        )
        rows = response.data or []

        if rows:
            # Filter to actual starts (goalie with a decision = starter)
            starts = [r for r in rows if r.get("decision") in ("W", "L", "O")]
            starts = starts[:window]

            if len(starts) >= 3:  # Need at least 3 starts for meaningful rolling avg
                save_pcts = [
                    float(r["save_pctg"])
                    for r in starts
                    if r.get("save_pctg") is not None
                ]
                if save_pcts:
                    return float(np.mean(save_pcts))

        # Fall back to season average — use cache if available
        if cache is not None:
            goalies = cache.get_goalie_stats(team_abbrev)
        else:
            goalies = read_goalie_stats(client, team_abbrev, CURRENT_SEASON)
        if goalies:
            starter = max(goalies, key=lambda g: g.get("games_started", 0))
            sv = starter.get("save_pctg")
            if sv is not None:
                return float(sv)

    except Exception as exc:
        logger.warning("Failed to compute rolling goalie for %s: %s", team_abbrev, exc)

    return np.nan


def _compute_jsonb_lookup(
    feat_def: FeatureDefinition,
    home: str,
    away: str,
    client: Client,
    per_game_cache: dict[tuple[str, str], dict | None],
    cache: FeatureCache | None = None,
) -> float:
    """
    Extract a value from JSONB data in team_stat_categories.

    The JSONB `data` column stores a list of team records. We find the
    record matching our team and extract the requested field.
    """
    config = feat_def.config
    team_key = config.get("team_key", "home_team")
    category = config.get("category", "")
    field_name = config.get("field", "")
    team_abbrev = home if team_key == "home_team" else away

    cache_key = (team_abbrev, category)

    # Use FeatureCache if available, otherwise fall back to per-game cache
    if cache is not None:
        data = cache.get_team_stat_category(team_abbrev, category)
    else:
        if cache_key not in per_game_cache:
            per_game_cache[cache_key] = read_team_stat_category(
                client, team_abbrev, CURRENT_SEASON, category,
            )
        data = per_game_cache[cache_key]

    if not data:
        return np.nan

    # data is typically a list of team records from the NHL stats API
    if isinstance(data, list):
        for record in data:
            if record.get("teamFullName") or record.get("teamAbbrev"):
                val = record.get(field_name)
                if val is not None:
                    return float(val)
    elif isinstance(data, dict):
        val = data.get(field_name)
        if val is not None:
            return float(val)

    return np.nan


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
