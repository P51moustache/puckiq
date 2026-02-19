"""
Tests for ml/io/supabase_client.py — Supabase IO operations.

Covers read operations, write operations, retry logic, pagination,
data freshness checks, and error paths. All tests use mocked Supabase
clients to avoid real network calls.

Mock strategy:
  - Patch `_retry` to be a no-op (identity decorator) so retries don't
    add delays in tests.
  - For retry-specific tests, patch tenacity directly.
  - Mock the Supabase Client and its PostgREST chain pattern.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, call, patch

import numpy as np
import pandas as pd
import pytest
from tenacity import RetryError

from ml.config import (
    GAMES_TABLE,
    GOALIE_SEASON_STATS_TABLE,
    MAX_STALENESS_HOURS,
    ML_MODEL_METADATA_TABLE,
    ML_PREDICTIONS_TABLE,
    ML_SCORES_TABLE,
    STANDINGS_TABLE,
    SYNC_LOG_TABLE,
    TEAM_STAT_CATEGORIES_TABLE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_client():
    """Create a MagicMock that mimics Supabase client chaining."""
    client = MagicMock()
    # Allow arbitrary chaining: client.table("x").select("*").eq("a", "b").execute()
    # MagicMock does this by default — each attribute/call returns a new MagicMock.
    return client


def _set_query_response(client, data):
    """Configure mock so any chained query returns the given data.

    Works for both .table().select()...execute() and .table().upsert().execute() chains.
    The trick: MagicMock's __getattr__ always returns the same child mock for the same attr,
    so we just set execute()'s return_value at the deepest level.
    """
    mock_response = MagicMock()
    mock_response.data = data
    # For read chains (select, eq, gte, lte, lt, order, limit, range, in_)
    # every method in the chain returns the same table mock, so .execute()
    # at the end always hits the same object.
    table_mock = client.table.return_value
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.gte.return_value = table_mock
    table_mock.lte.return_value = table_mock
    table_mock.lt.return_value = table_mock
    table_mock.order.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.range.return_value = table_mock
    table_mock.in_.return_value = table_mock
    table_mock.execute.return_value = mock_response
    # For write chains (upsert)
    table_mock.upsert.return_value = table_mock
    return mock_response


# ---------------------------------------------------------------------------
# 1. Read operations
# ---------------------------------------------------------------------------


class TestReadGames:
    """Test read_games() returns DataFrame with correct columns."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_dataframe_with_game_rows(self):
        from ml.io.supabase_client import read_games

        client = _make_mock_client()
        game_rows = [
            {
                "id": 2025020001,
                "season": 20252026,
                "game_date": "2025-10-08",
                "home_team_abbrev": "TOR",
                "away_team_abbrev": "MTL",
                "home_score": 4,
                "away_score": 2,
                "game_state": "OFF",
            },
            {
                "id": 2025020002,
                "season": 20252026,
                "game_date": "2025-10-09",
                "home_team_abbrev": "BOS",
                "away_team_abbrev": "NYR",
                "home_score": 3,
                "away_score": 1,
                "game_state": "OFF",
            },
        ]
        _set_query_response(client, game_rows)

        result = read_games(client, season=20252026)

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 2
        assert "id" in result.columns
        assert "game_date" in result.columns
        assert "home_team_abbrev" in result.columns
        assert "away_team_abbrev" in result.columns

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_dataframe_for_no_data(self):
        from ml.io.supabase_client import read_games

        client = _make_mock_client()
        _set_query_response(client, [])

        result = read_games(client, season=20252026)

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_filters_by_game_state_when_provided(self):
        from ml.io.supabase_client import read_games

        client = _make_mock_client()
        _set_query_response(client, [])

        read_games(client, season=20252026, game_state="FINAL")

        # Verify eq was called with game_state
        table_mock = client.table.return_value
        eq_calls = table_mock.eq.call_args_list
        # Should have at least 2 eq calls: season and game_state
        eq_args = [(c.args if c.args else c[0]) for c in eq_calls]
        assert ("season", 20252026) in eq_args
        assert ("game_state", "FINAL") in eq_args

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_no_game_state_filter_when_none(self):
        from ml.io.supabase_client import read_games

        client = _make_mock_client()
        _set_query_response(client, [])

        read_games(client, season=20252026, game_state=None)

        table_mock = client.table.return_value
        eq_calls = table_mock.eq.call_args_list
        eq_args = [(c.args if c.args else c[0]) for c in eq_calls]
        # Should only have season filter, not game_state
        assert ("season", 20252026) in eq_args
        game_state_calls = [a for a in eq_args if a[0] == "game_state"]
        assert len(game_state_calls) == 0

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_none_response_as_empty_dataframe(self):
        """If response.data is None, should still return empty DataFrame."""
        from ml.io.supabase_client import read_games

        client = _make_mock_client()
        _set_query_response(client, None)

        result = read_games(client, season=20252026)

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0


class TestReadStandings:
    """Test read_standings() returns dict or None."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_standings_dict(self):
        from ml.io.supabase_client import read_standings

        client = _make_mock_client()
        standings_row = {
            "team_abbrev": "TOR",
            "snapshot_date": "2025-12-01",
            "wins": 20,
            "losses": 10,
            "points": 45,
            "games_played": 30,
        }
        _set_query_response(client, [standings_row])

        result = read_standings(client, team_abbrev="TOR", as_of_date="2025-12-15")

        assert isinstance(result, dict)
        assert result["team_abbrev"] == "TOR"
        assert result["wins"] == 20

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_none_when_no_data(self):
        from ml.io.supabase_client import read_standings

        client = _make_mock_client()
        _set_query_response(client, [])

        result = read_standings(client, team_abbrev="TOR", as_of_date="2020-01-01")

        assert result is None

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_queries_correct_table_and_filters(self):
        from ml.io.supabase_client import read_standings

        client = _make_mock_client()
        _set_query_response(client, [])

        read_standings(client, team_abbrev="BOS", as_of_date="2025-11-15")

        client.table.assert_called_with(STANDINGS_TABLE)


class TestReadGoalieStats:
    """Test read_goalie_stats() returns list of dicts."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_goalie_stats_list(self):
        from ml.io.supabase_client import read_goalie_stats

        client = _make_mock_client()
        goalie_rows = [
            {
                "player_id": 8479361,
                "team_abbrev": "TOR",
                "season": 20252026,
                "games_played": 25,
                "wins": 15,
                "saves": 600,
                "goals_against": 50,
                "save_pctg": None,  # Known to be NULL in DB
            },
        ]
        _set_query_response(client, goalie_rows)

        result = read_goalie_stats(client, team_abbrev="TOR", season=20252026)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["player_id"] == 8479361
        assert result[0]["save_pctg"] is None  # Reflects known DB state

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_list_for_no_data(self):
        from ml.io.supabase_client import read_goalie_stats

        client = _make_mock_client()
        _set_query_response(client, [])

        result = read_goalie_stats(client, team_abbrev="TOR", season=20252026)

        assert isinstance(result, list)
        assert len(result) == 0

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_queries_correct_table(self):
        from ml.io.supabase_client import read_goalie_stats

        client = _make_mock_client()
        _set_query_response(client, [])

        read_goalie_stats(client, team_abbrev="TOR", season=20252026)

        client.table.assert_called_with(GOALIE_SEASON_STATS_TABLE)


class TestReadTeamStats:
    """Test read_team_stats() returns list of stat category dicts."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_team_stats_list(self):
        from ml.io.supabase_client import read_team_stats

        client = _make_mock_client()
        rows = [
            {"stat_category": "powerPlay", "data": {"pctg": 0.25}},
            {"stat_category": "penaltyKill", "data": {"pctg": 0.80}},
        ]
        _set_query_response(client, rows)

        result = read_team_stats(client, team_abbrev="TOR")

        assert isinstance(result, list)
        assert len(result) == 2

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_list_when_no_data(self):
        from ml.io.supabase_client import read_team_stats

        client = _make_mock_client()
        _set_query_response(client, [])

        result = read_team_stats(client, team_abbrev="TOR")

        assert result == []


class TestReadTeamStatCategory:
    """Test read_team_stat_category() returns JSONB data dict or None."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_jsonb_data(self):
        from ml.io.supabase_client import read_team_stat_category

        client = _make_mock_client()
        _set_query_response(client, [{"data": {"pctg": 0.25, "goals": 50}}])

        result = read_team_stat_category(
            client, team_abbrev="TOR", season=20252026, category="powerPlay"
        )

        assert isinstance(result, dict)
        assert result["pctg"] == 0.25

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_none_when_not_found(self):
        from ml.io.supabase_client import read_team_stat_category

        client = _make_mock_client()
        _set_query_response(client, [])

        result = read_team_stat_category(
            client, team_abbrev="TOR", season=20252026, category="nonexistent"
        )

        assert result is None


class TestReadRecentGames:
    """Test read_recent_games() returns merged home+away games sorted by date."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_combined_home_and_away(self):
        from ml.io.supabase_client import read_recent_games

        client = _make_mock_client()

        home_games = [
            {"id": 1, "game_date": "2025-12-10", "home_team_abbrev": "TOR"},
            {"id": 2, "game_date": "2025-12-05", "home_team_abbrev": "TOR"},
        ]
        away_games = [
            {"id": 3, "game_date": "2025-12-08", "away_team_abbrev": "TOR"},
        ]

        # read_recent_games makes TWO queries (home + away).
        # The mock table chain's execute() returns the same response each time,
        # so we need side_effect to alternate.
        home_resp = MagicMock()
        home_resp.data = home_games
        away_resp = MagicMock()
        away_resp.data = away_games

        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.in_.return_value = table_mock
        table_mock.lt.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        table_mock.execute.side_effect = [home_resp, away_resp]

        result = read_recent_games(client, team_abbrev="TOR", before_date="2025-12-15", limit=10)

        assert isinstance(result, list)
        assert len(result) == 3
        # Should be sorted by game_date descending
        assert result[0]["game_date"] == "2025-12-10"
        assert result[1]["game_date"] == "2025-12-08"
        assert result[2]["game_date"] == "2025-12-05"

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_respects_limit(self):
        from ml.io.supabase_client import read_recent_games

        client = _make_mock_client()
        # Return 5 home games and 5 away games, but limit=3
        home_games = [{"id": i, "game_date": f"2025-12-{10-i:02d}"} for i in range(5)]
        away_games = [{"id": i + 10, "game_date": f"2025-12-{10-i:02d}"} for i in range(5)]

        home_resp = MagicMock()
        home_resp.data = home_games
        away_resp = MagicMock()
        away_resp.data = away_games

        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.in_.return_value = table_mock
        table_mock.lt.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        table_mock.execute.side_effect = [home_resp, away_resp]

        result = read_recent_games(client, team_abbrev="TOR", before_date="2025-12-15", limit=3)

        assert len(result) == 3

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_when_no_games(self):
        from ml.io.supabase_client import read_recent_games

        client = _make_mock_client()
        home_resp = MagicMock()
        home_resp.data = []
        away_resp = MagicMock()
        away_resp.data = []

        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.in_.return_value = table_mock
        table_mock.lt.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        table_mock.execute.side_effect = [home_resp, away_resp]

        result = read_recent_games(client, team_abbrev="TOR", before_date="2025-12-15")

        assert result == []


class TestReadGamesMulti:
    """Test read_games_multi() concatenates multiple seasons."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    @patch("ml.io.supabase_client.read_games")
    def test_concatenates_seasons(self, mock_read_games):
        from ml.io.supabase_client import read_games_multi

        season1 = pd.DataFrame({
            "id": [1, 2],
            "game_date": ["2024-10-10", "2024-10-11"],
            "season": [20242025, 20242025],
        })
        season2 = pd.DataFrame({
            "id": [3, 4],
            "game_date": ["2025-10-10", "2025-10-11"],
            "season": [20252026, 20252026],
        })
        mock_read_games.side_effect = [season1, season2]

        client = _make_mock_client()
        result = read_games_multi(client, seasons=[20242025, 20252026])

        assert len(result) == 4
        assert list(result["game_date"]) == sorted(result["game_date"])

    @patch("ml.io.supabase_client._retry", lambda f: f)
    @patch("ml.io.supabase_client.read_games")
    def test_returns_empty_when_all_seasons_empty(self, mock_read_games):
        from ml.io.supabase_client import read_games_multi

        mock_read_games.return_value = pd.DataFrame()

        client = _make_mock_client()
        result = read_games_multi(client, seasons=[20242025, 20252026])

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0

    @patch("ml.io.supabase_client._retry", lambda f: f)
    @patch("ml.io.supabase_client.read_games")
    def test_deduplicates_by_id(self, mock_read_games):
        from ml.io.supabase_client import read_games_multi

        # Same game_id in both seasons (edge case)
        season1 = pd.DataFrame({
            "id": [1, 2],
            "game_date": ["2024-10-10", "2024-10-11"],
        })
        season2 = pd.DataFrame({
            "id": [2, 3],  # id=2 duplicated
            "game_date": ["2024-10-11", "2025-10-12"],
        })
        mock_read_games.side_effect = [season1, season2]

        client = _make_mock_client()
        result = read_games_multi(client, seasons=[20242025, 20252026])

        assert len(result) == 3  # Deduped
        assert sorted(result["id"].tolist()) == [1, 2, 3]


class TestReadPlayerGameStats:
    """Test read_player_game_stats() with batching and column rename."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_dataframe_with_renamed_column(self):
        from ml.io.supabase_client import read_player_game_stats

        client = _make_mock_client()
        rows = [
            {"player_id": 100, "game_id": 1, "team_abbrev": "TOR",
             "goals": 2, "assists": 1, "points": 3, "toi": "18:30", "shots_on_goal": 5},
        ]
        _set_query_response(client, rows)

        result = read_player_game_stats(client, season=20252026, game_ids=[1])

        assert isinstance(result, pd.DataFrame)
        assert "shots" in result.columns  # Renamed from shots_on_goal
        assert "shots_on_goal" not in result.columns

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_when_no_game_ids(self):
        from ml.io.supabase_client import read_player_game_stats

        client = _make_mock_client()

        result = read_player_game_stats(client, season=20252026, game_ids=None)

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_when_empty_game_ids(self):
        from ml.io.supabase_client import read_player_game_stats

        client = _make_mock_client()

        result = read_player_game_stats(client, season=20252026, game_ids=[])

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0


class TestReadPlayerSeasonStats:
    """Test read_player_season_stats()."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_dataframe(self):
        from ml.io.supabase_client import read_player_season_stats

        client = _make_mock_client()
        rows = [
            {"player_id": 100, "team_abbrev": "TOR", "goals": 20, "games_played": 40},
        ]
        _set_query_response(client, rows)

        result = read_player_season_stats(client, season=20252026)

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 1

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_when_no_data(self):
        from ml.io.supabase_client import read_player_season_stats

        client = _make_mock_client()
        _set_query_response(client, None)

        result = read_player_season_stats(client, season=20252026)

        assert isinstance(result, pd.DataFrame)
        assert len(result) == 0


class TestReadGameDetails:
    """Test read_game_details() with batching."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_list_of_dicts(self):
        from ml.io.supabase_client import read_game_details

        client = _make_mock_client()
        rows = [
            {"game_id": 1, "season_series": [{"wins": 2}], "scratches": []},
        ]
        _set_query_response(client, rows)

        result = read_game_details(client, game_ids=[1])

        assert isinstance(result, list)
        assert len(result) == 1

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_when_no_ids(self):
        from ml.io.supabase_client import read_game_details

        client = _make_mock_client()

        result = read_game_details(client, game_ids=[])

        assert result == []


class TestReadGameShots:
    """Test read_game_shots() with small batch sizes."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_shot_events(self):
        from ml.io.supabase_client import read_game_shots

        client = _make_mock_client()
        rows = [
            {"game_id": 1, "x_coord": 50, "y_coord": 20,
             "event_type": "shot-on-goal", "team_abbrev": "TOR", "detail": {}},
        ]
        _set_query_response(client, rows)

        result = read_game_shots(client, game_ids=[1])

        assert isinstance(result, list)
        assert len(result) == 1

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_empty_for_empty_ids(self):
        from ml.io.supabase_client import read_game_shots

        client = _make_mock_client()

        result = read_game_shots(client, game_ids=[])

        assert result == []


# ---------------------------------------------------------------------------
# 2. Retry logic
# ---------------------------------------------------------------------------


class TestRetryLogic:
    """Test the tenacity retry decorator behavior."""

    def test_retries_on_failure_then_succeeds(self):
        """Mock function that fails twice, succeeds on 3rd try."""
        from tenacity import retry, stop_after_attempt, wait_none

        call_count = 0

        @retry(stop=stop_after_attempt(3), wait=wait_none(), reraise=True)
        def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("Supabase unreachable")
            return "success"

        result = flaky_func()

        assert result == "success"
        assert call_count == 3

    def test_raises_after_max_retries(self):
        """All 3 attempts fail — should re-raise the exception."""
        from tenacity import retry, stop_after_attempt, wait_none

        @retry(stop=stop_after_attempt(3), wait=wait_none(), reraise=True)
        def always_fails():
            raise ConnectionError("Supabase unreachable")

        with pytest.raises(ConnectionError, match="Supabase unreachable"):
            always_fails()

    def test_retry_decorator_configured_correctly(self):
        """Verify the module-level _retry has stop_after_attempt(3)."""
        from ml.io.supabase_client import _retry

        # _retry is a tenacity.retry decorator instance; verify it wraps correctly.
        # The simplest test: apply it to a function and check it retries.
        call_count = 0

        @_retry
        def flaky():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("fail")
            return "ok"

        result = flaky()
        assert result == "ok"
        assert call_count == 3

    def test_retry_decorator_reraises_after_exhaustion(self):
        """Module-level _retry re-raises after 3 failed attempts."""
        from ml.io.supabase_client import _retry

        @_retry
        def always_fails():
            raise ConnectionError("permanent failure")

        with pytest.raises(ConnectionError, match="permanent failure"):
            always_fails()


# ---------------------------------------------------------------------------
# 3. Data freshness check
# ---------------------------------------------------------------------------


class TestCheckDataFreshness:
    """Test check_data_freshness() logic."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_true_when_data_is_fresh(self):
        from ml.io.supabase_client import check_data_freshness

        client = _make_mock_client()
        recent_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        _set_query_response(client, [{"completed_at": recent_time}])

        result = check_data_freshness(client)

        assert result is True

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_false_when_data_is_stale(self):
        from ml.io.supabase_client import check_data_freshness

        client = _make_mock_client()
        # No recent sync found (empty response means stale)
        _set_query_response(client, [])

        result = check_data_freshness(client)

        assert result is False

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_false_when_no_sync_data(self):
        from ml.io.supabase_client import check_data_freshness

        client = _make_mock_client()
        _set_query_response(client, None)

        result = check_data_freshness(client)

        assert result is False

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_queries_sync_log_table(self):
        from ml.io.supabase_client import check_data_freshness

        client = _make_mock_client()
        _set_query_response(client, [])

        check_data_freshness(client)

        client.table.assert_called_with(SYNC_LOG_TABLE)


# ---------------------------------------------------------------------------
# 4. Pagination
# ---------------------------------------------------------------------------


class TestPagination:
    """Test read_games() pagination for large datasets."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_paginates_when_first_batch_is_full(self):
        """When first batch returns exactly 1000 rows, should fetch next page."""
        from ml.io.supabase_client import read_games

        client = _make_mock_client()

        # First batch: 1000 rows (full page, might be more)
        batch1 = [{"id": i, "game_date": f"2025-10-{(i % 28) + 1:02d}"} for i in range(1000)]
        # Second batch: 312 rows (partial page, done)
        batch2 = [{"id": 1000 + i, "game_date": f"2025-12-{(i % 28) + 1:02d}"} for i in range(312)]

        resp1 = MagicMock()
        resp1.data = batch1
        resp2 = MagicMock()
        resp2.data = batch2

        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.range.return_value = table_mock
        table_mock.execute.side_effect = [resp1, resp2]

        result = read_games(client, season=20252026)

        assert len(result) == 1312
        # Verify range was called twice (two pages)
        range_calls = table_mock.range.call_args_list
        assert len(range_calls) == 2
        # First page: range(0, 999)
        assert range_calls[0].args == (0, 999)
        # Second page: range(1000, 1999)
        assert range_calls[1].args == (1000, 1999)

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_no_pagination_when_under_limit(self):
        """When batch returns fewer than 1000 rows, no second query needed."""
        from ml.io.supabase_client import read_games

        client = _make_mock_client()

        batch = [{"id": i, "game_date": f"2025-10-{(i % 28) + 1:02d}"} for i in range(500)]
        _set_query_response(client, batch)

        result = read_games(client, season=20252026)

        assert len(result) == 500
        # execute should be called only once
        table_mock = client.table.return_value
        assert table_mock.execute.call_count == 1

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_three_pages_of_data(self):
        """Test pagination across 3 full pages."""
        from ml.io.supabase_client import read_games

        client = _make_mock_client()

        batch1 = [{"id": i} for i in range(1000)]
        batch2 = [{"id": 1000 + i} for i in range(1000)]
        batch3 = [{"id": 2000 + i} for i in range(200)]

        resp1 = MagicMock()
        resp1.data = batch1
        resp2 = MagicMock()
        resp2.data = batch2
        resp3 = MagicMock()
        resp3.data = batch3

        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.range.return_value = table_mock
        table_mock.execute.side_effect = [resp1, resp2, resp3]

        result = read_games(client, season=20252026)

        assert len(result) == 2200
        assert table_mock.execute.call_count == 3


class TestBatchedReads:
    """Test functions that batch by game_ids (read_player_game_stats, read_game_details, read_game_shots)."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_player_game_stats_batches_by_20(self):
        """read_player_game_stats uses batch_size=20 for game_ids."""
        from ml.io.supabase_client import read_player_game_stats

        client = _make_mock_client()

        # 25 game_ids should produce 2 batches (20 + 5)
        game_ids = list(range(1, 26))
        rows = [{"player_id": 1, "game_id": gid, "team_abbrev": "TOR",
                 "goals": 0, "assists": 0, "points": 0, "toi": "15:00",
                 "shots_on_goal": 2} for gid in game_ids]

        batch1_resp = MagicMock()
        batch1_resp.data = rows[:20]
        batch2_resp = MagicMock()
        batch2_resp.data = rows[20:]

        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.in_.return_value = table_mock
        table_mock.execute.side_effect = [batch1_resp, batch2_resp]

        result = read_player_game_stats(client, season=20252026, game_ids=game_ids)

        assert len(result) == 25
        assert table_mock.execute.call_count == 2

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_game_details_batches_by_200(self):
        """read_game_details uses batch_size=200."""
        from ml.io.supabase_client import read_game_details

        client = _make_mock_client()

        # 250 game_ids should produce 2 batches (200 + 50)
        game_ids = list(range(1, 251))
        rows_batch1 = [{"game_id": gid, "season_series": [], "scratches": []} for gid in game_ids[:200]]
        rows_batch2 = [{"game_id": gid, "season_series": [], "scratches": []} for gid in game_ids[200:]]

        resp1 = MagicMock()
        resp1.data = rows_batch1
        resp2 = MagicMock()
        resp2.data = rows_batch2

        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.in_.return_value = table_mock
        table_mock.execute.side_effect = [resp1, resp2]

        result = read_game_details(client, game_ids=game_ids)

        assert len(result) == 250
        assert table_mock.execute.call_count == 2

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_game_shots_batches_by_3(self):
        """read_game_shots uses batch_size=3 due to ~300 shots per game."""
        from ml.io.supabase_client import read_game_shots

        client = _make_mock_client()

        # 5 game_ids should produce 2 batches (3 + 2)
        game_ids = [1, 2, 3, 4, 5]

        resp1 = MagicMock()
        resp1.data = [{"game_id": 1, "event_type": "goal"}] * 3
        resp2 = MagicMock()
        resp2.data = [{"game_id": 4, "event_type": "goal"}] * 2

        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.in_.return_value = table_mock
        table_mock.execute.side_effect = [resp1, resp2]

        result = read_game_shots(client, game_ids=game_ids)

        assert len(result) == 5
        assert table_mock.execute.call_count == 2


# ---------------------------------------------------------------------------
# 5. Write operations
# ---------------------------------------------------------------------------


class TestWritePredictions:
    """Test write_predictions() upsert behavior."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_writes_correct_data_shape(self):
        from ml.io.supabase_client import write_predictions

        client = _make_mock_client()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}, {"game_id": 2}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        predictions = [
            {
                "game_id": 1,
                "model_type": "game_winner",
                "model_version": "v3_20260215",
                "game_date": "2026-02-15",
                "home_win_prob": 0.65,
                "away_win_prob": 0.35,
                "predicted_winner": "TOR",
                "confidence": 0.65,
            },
            {
                "game_id": 2,
                "model_type": "game_winner",
                "model_version": "v3_20260215",
                "game_date": "2026-02-15",
                "home_win_prob": 0.45,
                "away_win_prob": 0.55,
                "predicted_winner": "BOS",
                "confidence": 0.55,
            },
        ]

        count = write_predictions(client, predictions)

        assert count == 2
        client.table.assert_called_with(ML_PREDICTIONS_TABLE)
        # Verify upsert was called with on_conflict
        upsert_call = client.table.return_value.upsert.call_args
        assert "game_id,model_type,model_version,player_id" in str(upsert_call)

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_injects_player_id_zero_when_missing(self):
        from ml.io.supabase_client import write_predictions

        client = _make_mock_client()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        predictions = [
            {"game_id": 1, "model_type": "game_winner", "model_version": "v1"},
        ]

        write_predictions(client, predictions)

        # Check the data actually passed to Supabase upsert
        upserted = client.table.return_value.upsert.call_args[0][0]
        assert upserted[0]["player_id"] == 0

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_preserves_existing_player_id(self):
        from ml.io.supabase_client import write_predictions

        client = _make_mock_client()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        predictions = [
            {"game_id": 1, "model_type": "player_props", "model_version": "v1", "player_id": 8478402},
        ]

        write_predictions(client, predictions)

        upserted = client.table.return_value.upsert.call_args[0][0]
        assert upserted[0]["player_id"] == 8478402

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_zero_for_empty_input(self):
        from ml.io.supabase_client import write_predictions

        client = _make_mock_client()

        count = write_predictions(client, [])

        assert count == 0
        # Should not call Supabase at all
        client.table.assert_not_called()

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_handles_none_response_data(self):
        from ml.io.supabase_client import write_predictions

        client = _make_mock_client()
        mock_response = MagicMock()
        mock_response.data = None
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        predictions = [
            {"game_id": 1, "model_type": "game_winner", "model_version": "v1"},
        ]

        count = write_predictions(client, predictions)

        assert count == 0


class TestWriteScores:
    """Test write_scores() upsert behavior."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_writes_scores_with_correct_on_conflict(self):
        from ml.io.supabase_client import write_scores

        client = _make_mock_client()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        scores = [
            {
                "game_id": 1,
                "model_type": "game_winner",
                "predicted_winner": "TOR",
                "actual_winner": "TOR",
                "was_correct": True,
                "home_win_prob": 0.65,
            },
        ]

        count = write_scores(client, scores)

        assert count == 1
        client.table.assert_called_with(ML_SCORES_TABLE)
        upsert_call = client.table.return_value.upsert.call_args
        assert "game_id,model_type,player_id" in str(upsert_call)

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_returns_zero_for_empty_scores(self):
        from ml.io.supabase_client import write_scores

        client = _make_mock_client()

        count = write_scores(client, [])

        assert count == 0
        client.table.assert_not_called()

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_injects_player_id_zero(self):
        from ml.io.supabase_client import write_scores

        client = _make_mock_client()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        scores = [{"game_id": 1, "model_type": "game_winner"}]
        write_scores(client, scores)

        # Check the data actually passed to Supabase upsert
        upserted = client.table.return_value.upsert.call_args[0][0]
        assert upserted[0]["player_id"] == 0


class TestWriteModelMetadata:
    """Test write_model_metadata() upsert behavior."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_writes_metadata_with_correct_on_conflict(self):
        from ml.io.supabase_client import write_model_metadata

        client = _make_mock_client()
        client.table.return_value.upsert.return_value.execute.return_value = MagicMock()

        metadata = {
            "model_type": "game_winner",
            "model_version": "v3_20260215",
            "training_games": 908,
            "training_date_range": "2023-10-10 to 2026-02-01",
            "hyperparameters": {"num_leaves": 31},
            "val_brier_score": 0.245,
            "val_accuracy": 0.55,
            "val_log_loss": 0.68,
            "val_mae": None,
            "val_rmse": None,
            "train_accuracy": 0.58,
            "overfit_gap": 0.03,
            "feature_importance": {"home_win_pctg": 0.15},
            "features_used": ["home_win_pctg", "away_win_pctg"],
            "is_active": True,
        }

        write_model_metadata(client, metadata)

        client.table.assert_called_with(ML_MODEL_METADATA_TABLE)
        upsert_call = client.table.return_value.upsert.call_args
        assert "model_type,model_version" in str(upsert_call)
        # Verify the actual metadata was passed
        passed_data = upsert_call.args[0] if upsert_call.args else upsert_call[0][0]
        assert passed_data["model_type"] == "game_winner"
        assert passed_data["training_games"] == 908


class TestNumpyTypeConversion:
    """Test that numpy types must be converted before writing to Supabase.

    The _to_native() helper in the codebase converts numpy types to Python
    native types. These tests verify that numpy types would cause issues
    if not converted, reinforcing the need for the conversion.
    """

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_write_predictions_accepts_native_types(self):
        """Verify write works fine with Python native types."""
        from ml.io.supabase_client import write_predictions

        client = _make_mock_client()
        mock_response = MagicMock()
        mock_response.data = [{"game_id": 1}]
        client.table.return_value.upsert.return_value.execute.return_value = mock_response

        # All native Python types — should work fine
        predictions = [
            {
                "game_id": 1,
                "model_type": "game_winner",
                "model_version": "v1",
                "home_win_prob": 0.65,  # Python float
                "confidence": 0.65,  # Python float
                "predicted_winner": "TOR",  # Python str
            },
        ]

        count = write_predictions(client, predictions)
        assert count == 1

    def test_numpy_types_are_not_json_serializable(self):
        """Demonstrate why _to_native() is needed: numpy types fail JSON serialization."""
        import json

        numpy_data = {
            "value_float": np.float64(0.65),
            "value_int": np.int64(42),
            "value_bool": np.bool_(True),
        }

        with pytest.raises(TypeError):
            json.dumps(numpy_data)

    def test_native_conversion_makes_serializable(self):
        """After converting numpy types to native Python, JSON serialization works."""
        import json

        numpy_data = {
            "value_float": float(np.float64(0.65)),
            "value_int": int(np.int64(42)),
            "value_bool": bool(np.bool_(True)),
        }

        # Should not raise
        result = json.dumps(numpy_data)
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# 6. Error paths
# ---------------------------------------------------------------------------


class TestErrorPaths:
    """Test error handling in various failure scenarios."""

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_read_games_handles_exception(self):
        """When Supabase raises an exception, it should propagate."""
        from ml.io.supabase_client import read_games

        client = _make_mock_client()
        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.range.return_value = table_mock
        table_mock.execute.side_effect = Exception("Connection refused")

        with pytest.raises(Exception, match="Connection refused"):
            read_games(client, season=20252026)

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_write_predictions_handles_exception(self):
        """When upsert raises, the exception propagates."""
        from ml.io.supabase_client import write_predictions

        client = _make_mock_client()
        client.table.return_value.upsert.return_value.execute.side_effect = Exception(
            "Row too large"
        )

        predictions = [
            {"game_id": 1, "model_type": "game_winner", "model_version": "v1"},
        ]

        with pytest.raises(Exception, match="Row too large"):
            write_predictions(client, predictions)

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_check_data_freshness_handles_exception(self):
        from ml.io.supabase_client import check_data_freshness

        client = _make_mock_client()
        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.gte.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        table_mock.execute.side_effect = TimeoutError("Request timed out")

        with pytest.raises(TimeoutError, match="Request timed out"):
            check_data_freshness(client)

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_read_standings_handles_exception(self):
        from ml.io.supabase_client import read_standings

        client = _make_mock_client()
        table_mock = client.table.return_value
        table_mock.select.return_value = table_mock
        table_mock.eq.return_value = table_mock
        table_mock.lte.return_value = table_mock
        table_mock.order.return_value = table_mock
        table_mock.limit.return_value = table_mock
        table_mock.execute.side_effect = ConnectionError("Network error")

        with pytest.raises(ConnectionError, match="Network error"):
            read_standings(client, team_abbrev="TOR", as_of_date="2025-12-15")

    @patch("ml.io.supabase_client._retry", lambda f: f)
    def test_write_model_metadata_handles_exception(self):
        from ml.io.supabase_client import write_model_metadata

        client = _make_mock_client()
        client.table.return_value.upsert.return_value.execute.side_effect = Exception(
            "Schema mismatch: column 'bad_col' does not exist"
        )

        metadata = {
            "model_type": "game_winner",
            "model_version": "v1",
            "bad_col": "this_should_fail",
        }

        with pytest.raises(Exception, match="Schema mismatch"):
            write_model_metadata(client, metadata)

    def test_retry_kicks_in_on_network_timeout(self):
        """Verify retry logic retries on timeout exceptions."""
        from ml.io.supabase_client import _retry

        call_count = 0

        @_retry
        def timeout_then_success():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise TimeoutError("Request timed out")
            return "recovered"

        result = timeout_then_success()
        assert result == "recovered"
        assert call_count == 2


class TestCreateSupabaseClient:
    """Test create_supabase_client() credential validation."""

    @patch("ml.io.supabase_client.SUPABASE_URL", "")
    @patch("ml.io.supabase_client.SUPABASE_SERVICE_ROLE_KEY", "some-key")
    def test_raises_when_url_missing(self):
        from ml.io.supabase_client import create_supabase_client

        with pytest.raises(RuntimeError, match="Missing Supabase credentials"):
            create_supabase_client()

    @patch("ml.io.supabase_client.SUPABASE_URL", "https://example.supabase.co")
    @patch("ml.io.supabase_client.SUPABASE_SERVICE_ROLE_KEY", "")
    def test_raises_when_key_missing(self):
        from ml.io.supabase_client import create_supabase_client

        with pytest.raises(RuntimeError, match="Missing Supabase credentials"):
            create_supabase_client()

    @patch("ml.io.supabase_client.SUPABASE_URL", "")
    @patch("ml.io.supabase_client.SUPABASE_SERVICE_ROLE_KEY", "")
    def test_raises_when_both_missing(self):
        from ml.io.supabase_client import create_supabase_client

        with pytest.raises(RuntimeError, match="Missing Supabase credentials"):
            create_supabase_client()
