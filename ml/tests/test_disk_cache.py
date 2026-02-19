"""Tests for ml.features.disk_cache — disk-based feature caching."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from ml.features.disk_cache import (
    _compute_schema_hash,
    compute_features_with_cache,
    invalidate_cache,
    load_cached_features,
    save_cached_features,
)


# ---------------------------------------------------------------------------
# Schema hash
# ---------------------------------------------------------------------------


class TestSchemaHash:
    def test_deterministic(self):
        """Schema hash returns the same value on repeated calls."""
        h1 = _compute_schema_hash()
        h2 = _compute_schema_hash()
        assert h1 == h2

    def test_length(self):
        """Schema hash is 12 hex characters."""
        h = _compute_schema_hash()
        assert len(h) == 12
        assert all(c in "0123456789abcdef" for c in h)


# ---------------------------------------------------------------------------
# Save / Load roundtrip
# ---------------------------------------------------------------------------


class TestSaveLoad:
    def test_roundtrip(self, tmp_path: Path):
        """Save then load preserves the DataFrame exactly."""
        df = pd.DataFrame(
            {"feat_a": [1.0, 2.0, 3.0], "feat_b": [4.0, 5.0, 6.0]},
            index=pd.Index([100, 200, 300], name="game_id"),
        )
        save_cached_features(df, cache_dir=tmp_path)
        loaded = load_cached_features(cache_dir=tmp_path)
        assert loaded is not None
        pd.testing.assert_frame_equal(loaded, df)

    def test_load_returns_none_when_empty(self, tmp_path: Path):
        """Load returns None when no cache file exists."""
        result = load_cached_features(cache_dir=tmp_path)
        assert result is None

    def test_old_schema_files_cleaned(self, tmp_path: Path):
        """Saving creates a new file and removes files with different hashes."""
        # Create a fake old-schema file
        old_file = tmp_path / "features_v000000000000.parquet"
        old_file.write_text("dummy")
        assert old_file.exists()

        df = pd.DataFrame({"a": [1.0]}, index=pd.Index([1], name="game_id"))
        save_cached_features(df, cache_dir=tmp_path)

        # Old file should be gone
        assert not old_file.exists()
        # New file should exist
        parquet_files = list(tmp_path.glob("features_v*.parquet"))
        assert len(parquet_files) == 1

    def test_nan_values_preserved(self, tmp_path: Path):
        """NaN values survive the Parquet roundtrip."""
        df = pd.DataFrame(
            {"feat": [1.0, np.nan, 3.0]},
            index=pd.Index([10, 20, 30], name="game_id"),
        )
        save_cached_features(df, cache_dir=tmp_path)
        loaded = load_cached_features(cache_dir=tmp_path)
        assert loaded is not None
        assert np.isnan(loaded.loc[20, "feat"])


# ---------------------------------------------------------------------------
# Invalidate
# ---------------------------------------------------------------------------


class TestInvalidate:
    def test_removes_all_parquet(self, tmp_path: Path):
        """invalidate_cache deletes all features_v*.parquet files."""
        (tmp_path / "features_vaaa.parquet").write_text("a")
        (tmp_path / "features_vbbb.parquet").write_text("b")
        removed = invalidate_cache(cache_dir=tmp_path)
        assert removed == 2
        assert list(tmp_path.glob("features_v*.parquet")) == []

    def test_returns_zero_when_no_cache(self, tmp_path: Path):
        """invalidate_cache returns 0 when there's nothing to delete."""
        removed = invalidate_cache(cache_dir=tmp_path)
        assert removed == 0


# ---------------------------------------------------------------------------
# compute_features_with_cache integration (mocked Supabase)
# ---------------------------------------------------------------------------


def _make_games_df(game_ids: list[int]) -> pd.DataFrame:
    """Helper to build a minimal games DataFrame."""
    return pd.DataFrame({
        "id": game_ids,
        "game_date": ["2025-01-01"] * len(game_ids),
        "home_team_abbrev": ["TOR"] * len(game_ids),
        "away_team_abbrev": ["BOS"] * len(game_ids),
        "home_score": [3] * len(game_ids),
        "away_score": [2] * len(game_ids),
        "season": [20242025] * len(game_ids),
    })


def _make_features_df(game_ids: list[int]) -> pd.DataFrame:
    """Helper to build a minimal features DataFrame indexed by game_id."""
    return pd.DataFrame(
        {"feat_a": np.random.rand(len(game_ids))},
        index=pd.Index(game_ids, name="game_id"),
    )


class TestComputeFeaturesWithCache:
    @patch("ml.features.disk_cache.compute_all_features")
    @patch("ml.features.disk_cache.FeatureCache")
    def test_full_recompute_when_no_cache(
        self, mock_cache_cls, mock_compute, tmp_path: Path
    ):
        """With no cache on disk, all games are computed."""
        games_df = _make_games_df([1, 2, 3])
        expected = _make_features_df([1, 2, 3])
        mock_compute.return_value = expected
        mock_cache_cls.build.return_value = MagicMock()

        result = compute_features_with_cache(
            games_df, MagicMock(), cache_dir=tmp_path
        )

        # compute_all_features called with all 3 games
        call_args = mock_compute.call_args
        computed_games = call_args[0][0]
        assert set(computed_games["id"].tolist()) == {1, 2, 3}
        assert len(result) == 3

    @patch("ml.features.disk_cache.compute_all_features")
    @patch("ml.features.disk_cache.FeatureCache")
    def test_incremental_only_new_games(
        self, mock_cache_cls, mock_compute, tmp_path: Path
    ):
        """With a cache, only new game_ids are passed to compute_all_features."""
        # Pre-populate cache with games 1, 2
        cached = _make_features_df([1, 2])
        save_cached_features(cached, cache_dir=tmp_path)

        # Now request games 1, 2, 3 — only game 3 is new
        games_df = _make_games_df([1, 2, 3])
        new_features = _make_features_df([3])
        mock_compute.return_value = new_features
        mock_cache_cls.build.return_value = MagicMock()

        result = compute_features_with_cache(
            games_df, MagicMock(), cache_dir=tmp_path
        )

        # compute_all_features called only with game 3
        call_args = mock_compute.call_args
        computed_games = call_args[0][0]
        assert set(computed_games["id"].tolist()) == {3}
        assert len(result) == 3

    @patch("ml.features.disk_cache.compute_all_features")
    @patch("ml.features.disk_cache.FeatureCache")
    def test_all_cached_skips_compute(
        self, mock_cache_cls, mock_compute, tmp_path: Path
    ):
        """When all games are cached, compute_all_features is NOT called."""
        cached = _make_features_df([1, 2, 3])
        save_cached_features(cached, cache_dir=tmp_path)

        games_df = _make_games_df([1, 2, 3])
        result = compute_features_with_cache(
            games_df, MagicMock(), cache_dir=tmp_path
        )

        mock_compute.assert_not_called()
        assert len(result) == 3

    @patch("ml.features.disk_cache.compute_all_features")
    @patch("ml.features.disk_cache.FeatureCache")
    def test_force_recompute_bypasses_cache(
        self, mock_cache_cls, mock_compute, tmp_path: Path
    ):
        """force_recompute=True ignores existing cache."""
        cached = _make_features_df([1, 2, 3])
        save_cached_features(cached, cache_dir=tmp_path)

        games_df = _make_games_df([1, 2, 3])
        expected = _make_features_df([1, 2, 3])
        mock_compute.return_value = expected
        mock_cache_cls.build.return_value = MagicMock()

        result = compute_features_with_cache(
            games_df, MagicMock(), cache_dir=tmp_path, force_recompute=True
        )

        # Should recompute all 3 games
        call_args = mock_compute.call_args
        computed_games = call_args[0][0]
        assert set(computed_games["id"].tolist()) == {1, 2, 3}

    @patch("ml.features.disk_cache.compute_all_features")
    @patch("ml.features.disk_cache.FeatureCache")
    def test_cache_filters_to_requested_games(
        self, mock_cache_cls, mock_compute, tmp_path: Path
    ):
        """Cache may contain extra games; result only includes requested ones."""
        # Cache has games 1-5
        cached = _make_features_df([1, 2, 3, 4, 5])
        save_cached_features(cached, cache_dir=tmp_path)

        # Only request games 2, 4
        games_df = _make_games_df([2, 4])
        result = compute_features_with_cache(
            games_df, MagicMock(), cache_dir=tmp_path
        )

        mock_compute.assert_not_called()
        assert set(result.index.tolist()) == {2, 4}
