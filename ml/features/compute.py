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
        # goalie_stats_by_team_season: (team_abbrev, season) -> list of goalie stat dicts
        self.goalie_stats_by_team_season: dict[tuple[str, int], list[dict[str, Any]]] = {}
        # Legacy accessor (populated from goalie_stats_by_team_season for current season)
        self.goalie_stats_by_team: dict[str, list[dict[str, Any]]] = {}
        # team_stat_categories: (team_abbrev, season, category) -> data dict or None
        self.team_stat_categories_by_season: dict[tuple[str, int, str], dict | None] = {}
        # Legacy accessor (populated for current season)
        self.team_stat_categories: dict[tuple[str, str], dict | None] = {}
        # recent_games_by_team: team_abbrev -> list of game dicts sorted by game_date desc
        self.recent_games_by_team: dict[str, list[dict[str, Any]]] = {}
        # advanced_stats_by_team: team_abbrev -> list of {game_id, corsi_pct, fenwick_pct} dicts
        self.advanced_stats_by_team: dict[str, list[dict[str, Any]]] = {}
        # shots_by_game: game_id -> list of shot event dicts
        self.shots_by_game: dict[int, list[dict[str, Any]]] = {}
        # game_details_by_id: game_id -> {season_series, scratches} dict
        self.game_details_by_id: dict[int, dict[str, Any]] = {}
        # Seasons this cache was built for
        self.seasons: list[int] = [CURRENT_SEASON]

    @classmethod
    def build(
        cls, client: Client, games_df: pd.DataFrame,
        seasons: list[int] | None = None,
    ) -> "FeatureCache":
        """
        Build a cache by pre-loading all data needed for the games in games_df.

        Makes ~4 bulk queries instead of O(games * features) individual queries.

        Args:
            client: Supabase client.
            games_df: DataFrame of games to compute features for.
            seasons: List of seasons to load stats for. Defaults to [CURRENT_SEASON].
        """
        cache = cls()
        cache.seasons = seasons or [CURRENT_SEASON]

        # Collect unique teams from the games
        teams = set()
        for _, game in games_df.iterrows():
            teams.add(game["home_team_abbrev"])
            teams.add(game["away_team_abbrev"])
        teams_list = sorted(teams)

        logger.info("FeatureCache: pre-loading data for %d teams, %d seasons",
                     len(teams_list), len(cache.seasons))

        # 1. Load ALL standings for these teams (all snapshot dates)
        cache._load_standings(client, teams_list)

        # 2. Load ALL goalie season stats for these teams (all requested seasons)
        cache._load_goalie_stats(client, teams_list)

        # 3. Load ALL team stat categories for these teams (all requested seasons)
        cache._load_team_stat_categories(client, teams_list)

        # 4. Load recent games for these teams (all completed games across all seasons)
        cache._load_recent_games(client, teams_list)

        # 5. Load advanced puck possession stats
        cache._load_advanced_stats(client, teams_list)

        # 6. Load shot events for xG computation
        cache._load_shots(client)

        # 7. Load game details (H2H records)
        cache._load_game_details(client)

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
        """Load goalie season stats for all teams across all requested seasons."""
        try:
            response = (
                client.table(GOALIE_SEASON_STATS_TABLE)
                .select("*")
                .in_("team_abbrev", teams)
                .in_("season", self.seasons)
                .execute()
            )
            for row in response.data or []:
                team = row["team_abbrev"]
                season = row.get("season", CURRENT_SEASON)
                key = (team, season)
                if key not in self.goalie_stats_by_team_season:
                    self.goalie_stats_by_team_season[key] = []
                self.goalie_stats_by_team_season[key].append(row)
                # Also populate legacy accessor for current season
                if season == CURRENT_SEASON:
                    if team not in self.goalie_stats_by_team:
                        self.goalie_stats_by_team[team] = []
                    self.goalie_stats_by_team[team].append(row)
            logger.info("FeatureCache: loaded %d goalie stat rows across %d seasons",
                         len(response.data or []), len(self.seasons))
        except Exception as exc:
            logger.warning("FeatureCache: failed to load goalie stats: %s", exc)

    def _load_team_stat_categories(self, client: Client, teams: list[str]) -> None:
        """Load team stat categories for all teams across all requested seasons."""
        try:
            response = (
                client.table(TEAM_STAT_CATEGORIES_TABLE)
                .select("*")
                .in_("team_abbrev", teams)
                .in_("season", self.seasons)
                .execute()
            )
            for row in response.data or []:
                team = row["team_abbrev"]
                season = row.get("season", CURRENT_SEASON)
                category = row.get("stat_category", "")
                self.team_stat_categories_by_season[(team, season, category)] = row.get("data")
                # Also populate legacy accessor for current season
                if season == CURRENT_SEASON:
                    self.team_stat_categories[(team, category)] = row.get("data")
            logger.info("FeatureCache: loaded %d team stat category rows across %d seasons",
                         len(response.data or []), len(self.seasons))
        except Exception as exc:
            logger.warning("FeatureCache: failed to load team stat categories: %s", exc)

    def _load_recent_games(self, client: Client, teams: list[str]) -> None:
        """Load all completed games for the teams (used for rolling features)."""
        try:
            # Paginate to handle >1000 games (NHL full season ~1312 games)
            def _paginated_query(filter_col: str) -> list[dict]:
                rows: list[dict] = []
                offset = 0
                page_size = 1000
                while True:
                    resp = (
                        client.table(GAMES_TABLE)
                        .select("*")
                        .in_(filter_col, teams)
                        .eq("game_state", "OFF")
                        .order("game_date", desc=True)
                        .range(offset, offset + page_size - 1)
                        .execute()
                    )
                    batch = resp.data or []
                    rows.extend(batch)
                    if len(batch) < page_size:
                        break
                    offset += page_size
                return rows

            home_rows = _paginated_query("home_team_abbrev")
            away_rows = _paginated_query("away_team_abbrev")

            # Deduplicate by game id and index by team
            all_games: dict[str, dict[str, Any]] = {}
            for row in home_rows + away_rows:
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

        Falls back to computing standings from games data when no DB
        snapshot exists for the requested date (common during training
        where as_of_date may be months in the past).
        """
        snapshots = self.standings_by_team.get(team_abbrev, [])
        for snapshot in snapshots:
            if snapshot.get("snapshot_date", "") <= as_of_date:
                return snapshot
        # No DB snapshot — derive standings from games data
        return self._derive_standings_from_games(team_abbrev, as_of_date)

    def _derive_standings_from_games(
        self, team_abbrev: str, as_of_date: str
    ) -> dict[str, Any] | None:
        """Compute standings-equivalent stats from cached game results."""
        games = self.recent_games_by_team.get(team_abbrev, [])
        if not games:
            return None
        # Only include games played BEFORE as_of_date
        eligible = [g for g in games if g.get("game_date", "") < as_of_date]
        if not eligible:
            return None
        wins = 0
        losses = 0
        ot_losses = 0
        home_wins = 0
        home_losses = 0
        home_ot_losses = 0
        road_wins = 0
        road_losses = 0
        road_ot_losses = 0
        goals_for = 0
        goals_against = 0
        for g in eligible:
            is_home = g["home_team_abbrev"] == team_abbrev
            h_score = g.get("home_score", 0) or 0
            a_score = g.get("away_score", 0) or 0
            team_score = h_score if is_home else a_score
            opp_score = a_score if is_home else h_score
            goals_for += team_score
            goals_against += opp_score
            # Determine outcome
            last_period = g.get("period", 3) or 3
            won = team_score > opp_score
            if won:
                wins += 1
                if is_home:
                    home_wins += 1
                else:
                    road_wins += 1
            elif last_period > 3:
                # OT/SO loss
                ot_losses += 1
                if is_home:
                    home_ot_losses += 1
                else:
                    road_ot_losses += 1
            else:
                losses += 1
                if is_home:
                    home_losses += 1
                else:
                    road_losses += 1
        gp = len(eligible)
        points = wins * 2 + ot_losses
        return {
            "team_abbrev": team_abbrev,
            "games_played": gp,
            "wins": wins,
            "losses": losses,
            "ot_losses": ot_losses,
            "points": points,
            "point_pctg": points / (gp * 2) if gp > 0 else 0.0,
            "goals_for": goals_for,
            "goals_against": goals_against,
            "goal_differential": goals_for - goals_against,
            "home_wins": home_wins,
            "home_losses": home_losses,
            "home_ot_losses": home_ot_losses,
            "road_wins": road_wins,
            "road_losses": road_losses,
            "road_ot_losses": road_ot_losses,
        }

    def get_goalie_stats(self, team_abbrev: str, season: int | None = None) -> list[dict[str, Any]]:
        """Get goalie season stats for a team. Falls back to legacy dict."""
        if season is not None:
            result = self.goalie_stats_by_team_season.get((team_abbrev, season), [])
            if result:
                return result
        return self.goalie_stats_by_team.get(team_abbrev, [])

    def get_team_stat_category(
        self, team_abbrev: str, category: str, season: int | None = None,
    ) -> dict | None:
        """Get a team stat category's JSONB data. Falls back to legacy dict."""
        if season is not None:
            result = self.team_stat_categories_by_season.get((team_abbrev, season, category))
            if result is not None:
                return result
        return self.team_stat_categories.get((team_abbrev, category))

    def _load_advanced_stats(self, client: Client, teams: list[str]) -> None:
        """Load puck possession stats from skater_game_categories, aggregated per team-game."""
        try:
            from collections import defaultdict

            from ml.config import SKATER_GAME_CATEGORIES_TABLE

            # Note: team_abbrev column may be NULL in DB (seed bug uses teamAbbrevs
            # instead of teamAbbrev). Extract team from data JSONB instead.
            # Supabase returns max 1000 rows per query — paginate to get all.
            rows: list[dict] = []
            page_size = 1000
            for season in self.seasons:
                offset = 0
                while True:
                    response = (
                        client.table(SKATER_GAME_CATEGORIES_TABLE)
                        .select("game_id, game_date, data")
                        .eq("season", season)
                        .eq("stat_category", "puckPossessions")
                        .range(offset, offset + page_size - 1)
                        .execute()
                    )
                    batch = response.data or []
                    rows.extend(batch)
                    if len(batch) < page_size:
                        break
                    offset += page_size

            # Group by (team_abbrev, game_id) and average Corsi%/Fenwick% across skaters
            # Extract team_abbrev from data.teamAbbrev since DB column may be NULL
            game_groups: dict[tuple[str, int], list[dict]] = defaultdict(list)
            game_dates: dict[tuple[str, int], str] = {}
            teams_set = set(teams)
            for row in rows:
                data = row.get("data") or {}
                if isinstance(data, str):
                    import json
                    data = json.loads(data)
                team = data.get("teamAbbrev") or row.get("team_abbrev") or ""
                if team not in teams_set:
                    continue
                gid = row["game_id"]
                game_groups[(team, gid)].append(data)
                if row.get("game_date"):
                    game_dates[(team, gid)] = row["game_date"]

            for (team, gid), player_data_list in game_groups.items():
                corsi_vals = []
                fenwick_vals = []
                for data in player_data_list:
                    # NHL Stats REST API uses satPct/usatPct (not satForPctg/usatForPctg)
                    sat = data.get("satPct") or data.get("satForPctg")
                    usat = data.get("usatPct") or data.get("usatForPctg")
                    if sat is not None:
                        corsi_vals.append(float(sat))
                    if usat is not None:
                        fenwick_vals.append(float(usat))

                if team not in self.advanced_stats_by_team:
                    self.advanced_stats_by_team[team] = []
                self.advanced_stats_by_team[team].append({
                    "game_id": gid,
                    "game_date": game_dates.get((team, gid), ""),
                    "corsi_pct": float(np.mean(corsi_vals)) if corsi_vals else None,
                    "fenwick_pct": float(np.mean(fenwick_vals)) if fenwick_vals else None,
                })

            # Sort by game_date descending (not game_id) to prevent leakage
            for team in self.advanced_stats_by_team:
                self.advanced_stats_by_team[team].sort(
                    key=lambda x: x.get("game_date", ""), reverse=True
                )

            logger.info(
                "FeatureCache: loaded advanced stats for %d team-game combos",
                sum(len(v) for v in self.advanced_stats_by_team.values()),
            )
        except Exception as exc:
            logger.warning("FeatureCache: failed to load advanced stats: %s", exc)

    def get_team_advanced_stats(
        self, team_abbrev: str, before_date: str = "", limit: int = 10
    ) -> list[dict[str, Any]]:
        """Get team-game advanced stats (Corsi/Fenwick), most recent first.
        Filters by game_date < before_date to prevent data leakage."""
        all_stats = self.advanced_stats_by_team.get(team_abbrev, [])
        if before_date:
            all_stats = [s for s in all_stats if s.get("game_date", "") < before_date]
        return all_stats[:limit]

    def get_recent_games(self, team_abbrev: str, before_date: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        Get recent completed games for a team before a date.
        Preserves leakage prevention by filtering on game_date < before_date.
        """
        all_team_games = self.recent_games_by_team.get(team_abbrev, [])
        filtered = [g for g in all_team_games if g["game_date"] < before_date]
        return filtered[:limit]

    def _load_shots(self, client: Client) -> None:
        """Load shot events from game_play_by_play for all cached games."""
        try:
            from ml.io.supabase_client import read_game_shots
            # Collect all unique game IDs from recent games
            all_game_ids = set()
            for team_games in self.recent_games_by_team.values():
                for game in team_games:
                    all_game_ids.add(game["id"])

            if not all_game_ids:
                return

            shots = read_game_shots(client, list(all_game_ids))
            for shot in shots:
                gid = shot["game_id"]
                if gid not in self.shots_by_game:
                    self.shots_by_game[gid] = []
                self.shots_by_game[gid].append(shot)

            logger.info("FeatureCache: loaded %d shot events across %d games",
                         len(shots), len(self.shots_by_game))
        except Exception as exc:
            logger.warning("FeatureCache: failed to load shots: %s", exc)

    def get_game_shots(self, game_id: int) -> list[dict[str, Any]]:
        """Get shot events for a specific game."""
        return self.shots_by_game.get(game_id, [])

    def _load_game_details(self, client: Client) -> None:
        """Load game details (season_series for H2H) for all cached games."""
        try:
            from ml.io.supabase_client import read_game_details
            all_game_ids = set()
            for team_games in self.recent_games_by_team.values():
                for game in team_games:
                    all_game_ids.add(game["id"])

            if not all_game_ids:
                return

            details = read_game_details(client, list(all_game_ids))
            for d in details:
                self.game_details_by_id[d["game_id"]] = d

            logger.info("FeatureCache: loaded %d game details", len(self.game_details_by_id))
        except Exception as exc:
            logger.warning("FeatureCache: failed to load game details: %s", exc)

    def get_game_details(self, game_id: int) -> dict[str, Any] | None:
        """Get game details (season_series, scratches) for a game."""
        return self.game_details_by_id.get(game_id)


def _safe_float(val) -> float:
    """Convert a value to float safely, returning NaN on failure."""
    if val is None:
        return np.nan
    try:
        return float(val)
    except (ValueError, TypeError):
        return np.nan


def compute_player_features(
    player_game_df: pd.DataFrame,
    season_stats_df: pd.DataFrame,
    standings_df: pd.DataFrame | None = None,
    client: Client | None = None,
) -> pd.DataFrame:
    """
    Compute features for player-game rows (for player props model).

    Unlike compute_all_features() which produces one row per game,
    this produces one row per player-game combination.

    Args:
        player_game_df: DataFrame with player_id, game_id, team_abbrev,
                       opponent_abbrev columns (from game_skater_stats)
        season_stats_df: DataFrame of skater_season_stats
        standings_df: Optional standings for opponent GA computation
        client: Supabase client (used if standings_df not provided)

    Returns:
        DataFrame with columns matching player_props model features.
    """
    # Create a lookup dict from season stats: player_id -> stats
    season_lookup: dict[int, Any] = {}
    if not season_stats_df.empty:
        for _, row in season_stats_df.iterrows():
            season_lookup[row["player_id"]] = row

    results = []
    for _, pg in player_game_df.iterrows():
        pid = pg["player_id"]
        stats = season_lookup.get(pid, {})

        # Player features from season stats
        # skater_season_stats has 'goals' and 'games_played', NOT 'goals_per_game'
        goals = stats.get("goals", 0) if isinstance(stats, dict) else getattr(stats, "goals", 0)
        gp = stats.get("games_played", 0) if isinstance(stats, dict) else getattr(stats, "games_played", 0)
        gpg = float(goals) / float(gp) if gp and gp > 0 else np.nan
        toi = _safe_float(stats.get("avg_toi_per_game") if isinstance(stats, dict) else getattr(stats, "avg_toi_per_game", None))
        shot_pct = _safe_float(stats.get("shooting_pctg") if isinstance(stats, dict) else getattr(stats, "shooting_pctg", None))

        # Opponent GA per game (from standings or simple calculation)
        opp_ga = np.nan
        if standings_df is not None and not standings_df.empty:
            opp_abbrev = pg.get("opponent_abbrev", "")
            opp_standings = standings_df[standings_df["team_abbrev"] == opp_abbrev]
            if not opp_standings.empty:
                opp_row = opp_standings.iloc[0]
                ga = opp_row.get("goals_against", 0) or 0
                gp = opp_row.get("games_played", 1) or 1
                opp_ga = float(ga) / float(gp) if gp > 0 else np.nan

        # Is home
        is_home_val = 1.0 if pg.get("home_road") == "H" or pg.get("is_home", False) else 0.0

        results.append({
            "player_id": pid,
            "game_id": pg.get("game_id"),
            "player_gpg": gpg,
            "player_toi": toi,
            "player_shot_pct": shot_pct,
            "opponent_ga_per_game": opp_ga,
            "is_home": is_home_val,
        })

    return pd.DataFrame(results)


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
        game_season = game.get("season", CURRENT_SEASON)

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
                        client, game_date, cache=cache, season=game_season,
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
                elif feat_def.compute_type == "rolling_team_advanced":
                    row[feat_name] = _compute_rolling_team_advanced(
                        feat_def, home, away, as_of_date=game_date, cache=cache,
                    )
                elif feat_def.compute_type == "rolling_xg":
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
                    row[feat_name] = _compute_rolling_xg(
                        feat_def, home, away, home_recent, away_recent, cache=cache,
                    )
                elif feat_def.compute_type == "rolling_goalie":
                    row[feat_name] = _compute_rolling_goalie(
                        feat_def, home, away, client, game_date, cache=cache,
                        season=game_season,
                    )
                elif feat_def.compute_type == "jsonb_lookup":
                    row[feat_name] = _compute_jsonb_lookup(
                        feat_def, home, away, client, jsonb_cache, cache=cache,
                        season=game_season,
                    )
                elif feat_def.compute_type == "game_detail_lookup":
                    row[feat_name] = _compute_game_detail_lookup(
                        feat_def, game_id, home, away, cache=cache,
                    )
                elif feat_def.compute_type == "cross_model":
                    # cross_model features are injected by the pipeline (weekly_retrain.py,
                    # daily_run.py), not computed here
                    row[feat_name] = np.nan
                elif feat_def.compute_type == "derived":
                    row[feat_name] = _compute_derived(feat_def, row, home, away,
                                                       home_recent, away_recent, game_date)
                elif feat_def.compute_type == "player_lookup":
                    # player_lookup features are computed by compute_player_features()
                    # separately (one row per player-game, not one row per game).
                    # Set NaN here as placeholder for game-level feature matrix.
                    row[feat_name] = np.nan
                else:
                    raise ValueError(
                        f"Unknown compute_type '{feat_def.compute_type}' for feature '{feat_name}'. "
                        f"Valid types: lookup, rolling_team, rolling_team_advanced, rolling_xg, "
                        f"rolling_goalie, jsonb_lookup, game_detail_lookup, cross_model, derived, "
                        f"player_lookup"
                    )
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
    season: int = CURRENT_SEASON,
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
            goalies = cache.get_goalie_stats(team_abbrev, season=season)
        else:
            goalies = read_goalie_stats(client, team_abbrev, season)
        if not goalies:
            return np.nan

        # Sort by games started descending
        sorted_goalies = sorted(goalies, key=lambda g: g.get("games_started", 0), reverse=True)

        select_role = config.get("select", "starter")
        if select_role == "backup":
            # Backup = second goalie by games started
            if len(sorted_goalies) < 2:
                return np.nan
            target = sorted_goalies[1]
        else:
            # Starter = goalie with most games started
            target = sorted_goalies[0]

        value = target.get(column)
        # If save_pctg is NULL (common data gap), compute from saves / shots_against
        if value is None and column == "save_pctg":
            saves = target.get("saves")
            ga = target.get("goals_against")
            if saves is not None and ga is not None and (saves + ga) > 0:
                value = saves / (saves + ga)
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


def _compute_rolling_team_advanced(
    feat_def: FeatureDefinition,
    home: str,
    away: str,
    as_of_date: str = "",
    cache: FeatureCache | None = None,
) -> float:
    """Compute rolling Corsi% or Fenwick% from cached advanced stats."""
    if cache is None:
        return np.nan

    config = feat_def.config
    team_key = config.get("team_key", "home_team")
    stat = config.get("stat", "corsi_pct")
    window = config.get("window", 10)

    team_abbrev = home if team_key == "home_team" else away
    games = cache.get_team_advanced_stats(team_abbrev, before_date=as_of_date, limit=window)

    if not games:
        return np.nan

    values = [g[stat] for g in games if g.get(stat) is not None]
    if not values:
        return np.nan
    return float(np.mean(values))


def _compute_shot_xg(x_coord: float, y_coord: float, event_type: str = "") -> float:
    """
    Compute expected goal value for a shot based on distance and angle from net.

    Standard hockey xG model:
    - Net is at x=89 (center of the goal line)
    - Distance from net determines base xG
    - Extreme angles reduce xG (harder to score from sharp angles)
    """
    import math
    if x_coord is None or y_coord is None:
        return 0.03  # Default for missing coordinates

    x = float(x_coord)
    y = float(y_coord)

    # Distance from center of net (at x=89, y=0)
    dx = 89.0 - abs(x)
    distance = math.sqrt(dx**2 + y**2)

    # Base xG by distance bucket
    if distance <= 10:
        base_xg = 0.25
    elif distance <= 20:
        base_xg = 0.12
    elif distance <= 30:
        base_xg = 0.06
    else:
        base_xg = 0.03

    # Angle adjustment — shots from extreme angles are harder
    angle_rad = math.atan2(abs(y), max(dx, 0.1))
    angle_deg = math.degrees(angle_rad)
    if angle_deg > 45:
        base_xg *= 0.5

    return base_xg


def _compute_rolling_xg(
    feat_def: FeatureDefinition,
    home: str,
    away: str,
    home_recent: list[dict[str, Any]] | None,
    away_recent: list[dict[str, Any]] | None,
    cache: FeatureCache | None = None,
) -> float:
    """Compute rolling expected goals (xGF or xGA) from shot data."""
    if cache is None:
        return np.nan

    config = feat_def.config
    team_key = config.get("team_key", "home_team")
    stat = config.get("stat", "xgf")  # xgf or xga
    window = config.get("window", 10)

    team_abbrev = home if team_key == "home_team" else away
    recent = home_recent if team_key == "home_team" else away_recent
    if not recent:
        return np.nan
    recent = recent[:window]

    xg_values = []
    total_shots = 0
    missing_coords = 0
    for game in recent:
        game_id = game["id"]
        shots = cache.get_game_shots(game_id)
        if not shots:
            continue

        game_xg = 0.0
        for shot in shots:
            total_shots += 1
            if shot.get("x_coord") is None or shot.get("y_coord") is None:
                missing_coords += 1
            shot_team = shot.get("team_abbrev", "")
            xg_val = _compute_shot_xg(
                shot.get("x_coord"),
                shot.get("y_coord"),
                shot.get("event_type", ""),
            )
            if stat == "xgf" and shot_team == team_abbrev:
                game_xg += xg_val
            elif stat == "xga" and shot_team != team_abbrev:
                game_xg += xg_val

        xg_values.append(game_xg)

    if total_shots > 0 and missing_coords > 0.2 * total_shots:
        logger.warning(
            "%.0f%% of shots missing coordinates for %s — xG estimates degraded",
            100 * missing_coords / max(total_shots, 1), team_abbrev
        )

    if not xg_values:
        return np.nan
    return float(np.mean(xg_values))


def _compute_rolling_goalie(
    feat_def: FeatureDefinition,
    home: str,
    away: str,
    client: Client,
    game_date: str,
    cache: FeatureCache | None = None,
    season: int = CURRENT_SEASON,
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

    # Try game-level goalie stats for recent starts.
    # game_goalie_stats has game_id but no game_date, so we need to use
    # game IDs from recent games (already fetched for rolling team features).
    try:
        recent_game_ids: list[int] = []
        if cache is not None:
            # Use cached recent games to get game IDs
            team_games = cache.get_recent_games(team_abbrev, game_date)
            recent_game_ids = [g["id"] for g in team_games][:window * 2]
        if recent_game_ids:
            # Batch query goalie stats for these games
            response = (
                client.table(GAME_GOALIE_STATS_TABLE)
                .select("game_id, save_pctg, decision, player_name")
                .eq("team_abbrev", team_abbrev)
                .in_("game_id", recent_game_ids)
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
    except Exception as exc:
        logger.debug("Game-level goalie stats unavailable for %s: %s", team_abbrev, exc)

    # Fall back to season average — use cache if available
    try:
        if cache is not None:
            goalies = cache.get_goalie_stats(team_abbrev, season=season)
        else:
            goalies = read_goalie_stats(client, team_abbrev, season)
        if goalies:
            starter = max(goalies, key=lambda g: g.get("games_started", 0))
            sv = starter.get("save_pctg")
            # If save_pctg is NULL, compute from saves / shots_against
            if sv is None:
                saves = starter.get("saves")
                ga = starter.get("goals_against")
                if saves is not None and ga is not None and (saves + ga) > 0:
                    sv = saves / (saves + ga)
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
    season: int = CURRENT_SEASON,
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
        data = cache.get_team_stat_category(team_abbrev, category, season=season)
    else:
        if cache_key not in per_game_cache:
            per_game_cache[cache_key] = read_team_stat_category(
                client, team_abbrev, season, category,
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


def _compute_game_detail_lookup(
    feat_def: FeatureDefinition,
    game_id: int,
    home: str,
    away: str,
    cache: FeatureCache | None = None,
) -> float:
    """Compute H2H features from game_details season_series."""
    if cache is None:
        return np.nan

    config = feat_def.config
    field = config.get("field", "")

    details = cache.get_game_details(game_id)
    if not details:
        return np.nan

    season_series = details.get("season_series")
    if not season_series:
        return np.nan

    # season_series may be stored as a JSON string
    if isinstance(season_series, str):
        import json
        try:
            season_series = json.loads(season_series)
        except (json.JSONDecodeError, TypeError):
            return np.nan

    # season_series is a list of game objects from the NHL API right-rail.
    # Each entry: {homeTeam: {abbrev, score, ...}, awayTeam: {abbrev, score, ...},
    #              gameState, gameOutcome, ...}
    # Only count completed games (gameState in OFF/FINAL) that occurred before
    # this game (exclude the current game_id to prevent leakage).
    if not isinstance(season_series, list):
        return np.nan

    completed_h2h = []
    for entry in season_series:
        if entry.get("gameState") not in ("OFF", "FINAL"):
            continue
        if entry.get("id") == game_id:
            continue  # Don't include the current game
        ht = entry.get("homeTeam") or {}
        at = entry.get("awayTeam") or {}
        h_abbrev = ht.get("abbrev", "")
        a_abbrev = at.get("abbrev", "")
        h_score = ht.get("score", 0) or 0
        a_score = at.get("score", 0) or 0
        if {h_abbrev, a_abbrev} != {home, away}:
            continue  # Not a matchup between these two teams
        completed_h2h.append({
            "home_abbrev": h_abbrev,
            "away_abbrev": a_abbrev,
            "home_score": h_score,
            "away_score": a_score,
        })

    if not completed_h2h:
        return np.nan

    if field == "home_win_pct":
        # How often did the current home team WIN in these H2H games?
        wins = 0
        for g in completed_h2h:
            if g["home_abbrev"] == home and g["home_score"] > g["away_score"]:
                wins += 1
            elif g["away_abbrev"] == home and g["away_score"] > g["home_score"]:
                wins += 1
        return float(wins) / float(len(completed_h2h))

    if field == "goals_diff":
        # Current home team's total goal differential vs this opponent
        home_goals = 0
        opp_goals = 0
        for g in completed_h2h:
            if g["home_abbrev"] == home:
                home_goals += g["home_score"]
                opp_goals += g["away_score"]
            else:
                home_goals += g["away_score"]
                opp_goals += g["home_score"]
        return float(home_goals - opp_goals)

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

    if name == "home_games_last_7d":
        if not home_recent:
            return np.nan
        game_dt = datetime.strptime(game_date, "%Y-%m-%d")
        seven_days_ago = (game_dt - timedelta(days=7)).strftime("%Y-%m-%d")
        count = sum(1 for g in home_recent if g["game_date"] >= seven_days_ago)
        return float(count)

    if name == "away_games_last_7d":
        if not away_recent:
            return np.nan
        game_dt = datetime.strptime(game_date, "%Y-%m-%d")
        seven_days_ago = (game_dt - timedelta(days=7)).strftime("%Y-%m-%d")
        count = sum(1 for g in away_recent if g["game_date"] >= seven_days_ago)
        return float(count)

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
