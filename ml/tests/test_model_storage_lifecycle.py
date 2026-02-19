"""
Tests for ml/io/model_storage.py — ModelStorage lifecycle.

Covers save/load round-trips, checksum validation, manifest management,
version rotation/cleanup, edge cases, and promotion logic.

Uses a fake in-memory Supabase Storage backend so tests run offline.
"""

import hashlib
import json
from typing import Any
from unittest.mock import MagicMock

import joblib
import numpy as np
import pandas as pd
import pytest

from ml.io.model_storage import ModelStorage


# ---------------------------------------------------------------------------
# Fake in-memory Supabase Storage — simulates upload/download/remove
# ---------------------------------------------------------------------------


class FakeBucketStore:
    """In-memory store keyed by path -> bytes, mimicking Supabase Storage."""

    def __init__(self) -> None:
        self._files: dict[str, bytes] = {}

    def upload(self, *, path: str, file: bytes, file_options: dict | None = None) -> None:
        self._files[path] = file

    def download(self, path: str) -> bytes:
        if path not in self._files:
            raise Exception(f"Object not found: {path}")
        return self._files[path]

    def remove(self, paths: list[str]) -> None:
        for p in paths:
            self._files.pop(p, None)


class FakeStorage:
    """Fake ``client.storage`` with per-bucket stores."""

    def __init__(self) -> None:
        self._buckets: dict[str, FakeBucketStore] = {}

    def from_(self, bucket: str) -> FakeBucketStore:
        if bucket not in self._buckets:
            self._buckets[bucket] = FakeBucketStore()
        return self._buckets[bucket]


def _make_client() -> MagicMock:
    """Return a MagicMock Supabase Client with a working fake storage backend."""
    client = MagicMock()
    client.storage = FakeStorage()
    return client


# ---------------------------------------------------------------------------
# Tiny model helper
# ---------------------------------------------------------------------------


def _train_tiny_model(seed: int = 42) -> Any:
    """Train a minimal LightGBM classifier on 20 synthetic rows."""
    import lightgbm as lgb

    rng = np.random.RandomState(seed)
    X = rng.rand(20, 3)
    y = (X[:, 0] > 0.5).astype(int)
    clf = lgb.LGBMClassifier(n_estimators=5, num_leaves=4, verbose=-1)
    clf.fit(X, y)
    return clf


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    return _make_client()


@pytest.fixture
def storage(client):
    return ModelStorage(client, bucket="test-bucket")


@pytest.fixture
def tiny_model():
    return _train_tiny_model(seed=42)


@pytest.fixture
def another_tiny_model():
    return _train_tiny_model(seed=99)


# ===================================================================
# 1. Save and load lifecycle
# ===================================================================


class TestSaveAndLoadLifecycle:
    """Save a model, load it back, verify predictions match."""

    def test_save_returns_storage_path(self, storage, tiny_model):
        path = storage.save_model(tiny_model, "game_winner", "v1")
        assert path == "game_winner/v1.joblib"

    def test_load_returns_model(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        loaded = storage.load_model("game_winner")
        assert loaded is not None

    def test_loaded_model_produces_same_predictions(self, storage, tiny_model):
        rng = np.random.RandomState(123)
        X_test = pd.DataFrame(rng.rand(5, 3), columns=["f0", "f1", "f2"])

        original_preds = tiny_model.predict_proba(X_test.values)[:, 1]

        storage.save_model(tiny_model, "game_winner", "v1")
        loaded = storage.load_model("game_winner")
        loaded_preds = loaded.predict_proba(X_test.values)[:, 1]

        np.testing.assert_array_almost_equal(original_preds, loaded_preds)

    def test_save_with_metrics(self, storage, tiny_model):
        metrics = {"accuracy": 0.85, "brier_score": 0.18}
        storage.save_model(tiny_model, "game_winner", "v1", metrics=metrics)
        manifest = storage.get_manifest("game_winner")
        assert manifest["metrics"] == metrics

    def test_save_without_metrics_stores_empty_dict(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        manifest = storage.get_manifest("game_winner")
        assert manifest["metrics"] == {}

    def test_multiple_saves_last_is_active(self, storage, tiny_model, another_tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        storage.save_model(another_tiny_model, "game_winner", "v2")
        loaded = storage.load_model("game_winner")
        # The active model should be v2 — verify via manifest
        manifest = storage.get_manifest("game_winner")
        assert manifest["active_version"] == "v2"


# ===================================================================
# 2. Checksum validation
# ===================================================================


class TestChecksumValidation:
    """Verify SHA-256 checksum storage and validation on load."""

    def test_checksum_stored_in_manifest(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        manifest = storage.get_manifest("game_winner")
        assert "checksum" in manifest
        assert len(manifest["checksum"]) == 64  # SHA-256 hex length

    def test_checksum_matches_artifact(self, storage, client, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        manifest = storage.get_manifest("game_winner")
        expected = manifest["checksum"]

        # Download the raw artifact and compute checksum independently
        raw = client.storage.from_("test-bucket").download("game_winner/v1.joblib")
        actual = hashlib.sha256(raw).hexdigest()
        assert actual == expected

    def test_version_entry_has_checksum(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        manifest = storage.get_manifest("game_winner")
        assert len(manifest["versions"]) == 1
        assert manifest["versions"][0]["checksum"] == manifest["checksum"]

    def test_corrupted_artifact_raises_value_error(self, storage, client, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")

        # Corrupt the stored artifact by flipping bytes
        bucket = client.storage.from_("test-bucket")
        original = bucket.download("game_winner/v1.joblib")
        corrupted = bytes([b ^ 0xFF for b in original[:100]]) + original[100:]
        bucket.upload(path="game_winner/v1.joblib", file=corrupted)

        with pytest.raises(ValueError, match="Checksum mismatch"):
            storage.load_model("game_winner")

    def test_empty_checksum_skips_validation(self, storage, client, tiny_model):
        """If checksum field is empty string, load should not fail."""
        storage.save_model(tiny_model, "game_winner", "v1")

        # Manually clear the checksum in the manifest
        manifest = storage.get_manifest("game_winner")
        manifest["checksum"] = ""
        bucket = client.storage.from_("test-bucket")
        bucket.upload(
            path="game_winner/manifest.json",
            file=json.dumps(manifest).encode("utf-8"),
        )

        # Should load without error since empty checksum is skipped
        loaded = storage.load_model("game_winner")
        assert loaded is not None


# ===================================================================
# 3. Manifest management
# ===================================================================


class TestManifestManagement:
    """Verify manifest tracks versions, active version, and structure."""

    def test_get_manifest_returns_none_when_missing(self, storage):
        assert storage.get_manifest("nonexistent_model") is None

    def test_manifest_created_on_first_save(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        manifest = storage.get_manifest("game_winner")
        assert manifest is not None
        assert manifest["model_type"] == "game_winner"

    def test_manifest_tracks_all_versions(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        storage.save_model(tiny_model, "game_winner", "v2")
        storage.save_model(tiny_model, "game_winner", "v3")

        manifest = storage.get_manifest("game_winner")
        versions = [v["version"] for v in manifest["versions"]]
        assert versions == ["v1", "v2", "v3"]

    def test_active_version_is_latest(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        storage.save_model(tiny_model, "game_winner", "v2")

        manifest = storage.get_manifest("game_winner")
        assert manifest["active_version"] == "v2"

    def test_manifest_metrics_update_with_each_save(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1", metrics={"accuracy": 0.80})
        storage.save_model(tiny_model, "game_winner", "v2", metrics={"accuracy": 0.85})

        manifest = storage.get_manifest("game_winner")
        # Top-level metrics reflect the latest save
        assert manifest["metrics"]["accuracy"] == 0.85
        # Version history preserves each version's metrics
        assert manifest["versions"][0]["metrics"]["accuracy"] == 0.80
        assert manifest["versions"][1]["metrics"]["accuracy"] == 0.85

    def test_manifest_checksum_matches_active_version(self, storage, tiny_model, another_tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        storage.save_model(another_tiny_model, "game_winner", "v2")

        manifest = storage.get_manifest("game_winner")
        # Top-level checksum should match the v2 version entry
        assert manifest["checksum"] == manifest["versions"][1]["checksum"]

    def test_separate_model_types_have_separate_manifests(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        storage.save_model(tiny_model, "spread", "v1")

        gw_manifest = storage.get_manifest("game_winner")
        sp_manifest = storage.get_manifest("spread")

        assert gw_manifest["model_type"] == "game_winner"
        assert sp_manifest["model_type"] == "spread"
        assert len(gw_manifest["versions"]) == 1
        assert len(sp_manifest["versions"]) == 1


# ===================================================================
# 4. Version rotation / cleanup
# ===================================================================


class TestVersionRotation:
    """Verify cleanup_old_versions removes old artifacts and keeps the newest N."""

    def test_cleanup_when_under_limit_removes_nothing(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1")
        storage.save_model(tiny_model, "game_winner", "v2")
        removed = storage.cleanup_old_versions("game_winner", keep=5)
        assert removed == 0

    def test_cleanup_at_exact_limit_removes_nothing(self, storage, tiny_model):
        for i in range(5):
            storage.save_model(tiny_model, "game_winner", f"v{i}")
        removed = storage.cleanup_old_versions("game_winner", keep=5)
        assert removed == 0

    def test_cleanup_removes_oldest_versions(self, storage, client, tiny_model):
        for i in range(7):
            storage.save_model(tiny_model, "game_winner", f"v{i}")

        removed = storage.cleanup_old_versions("game_winner", keep=3)
        assert removed == 4  # 7 - 3 = 4 removed

        # Verify the oldest artifacts are gone from storage
        bucket = client.storage.from_("test-bucket")
        for i in range(4):
            with pytest.raises(Exception):
                bucket.download(f"game_winner/v{i}.joblib")

        # Verify the newest artifacts still exist
        for i in range(4, 7):
            data = bucket.download(f"game_winner/v{i}.joblib")
            assert len(data) > 0

    def test_cleanup_updates_manifest_versions_list(self, storage, tiny_model):
        for i in range(7):
            storage.save_model(tiny_model, "game_winner", f"v{i}")

        storage.cleanup_old_versions("game_winner", keep=3)
        manifest = storage.get_manifest("game_winner")

        versions = [v["version"] for v in manifest["versions"]]
        assert versions == ["v4", "v5", "v6"]

    def test_cleanup_preserves_active_version(self, storage, tiny_model):
        for i in range(7):
            storage.save_model(tiny_model, "game_winner", f"v{i}")

        storage.cleanup_old_versions("game_winner", keep=3)
        manifest = storage.get_manifest("game_winner")
        assert manifest["active_version"] == "v6"

    def test_cleanup_with_keep_one(self, storage, tiny_model):
        for i in range(4):
            storage.save_model(tiny_model, "game_winner", f"v{i}")

        removed = storage.cleanup_old_versions("game_winner", keep=1)
        assert removed == 3

        manifest = storage.get_manifest("game_winner")
        assert len(manifest["versions"]) == 1
        assert manifest["versions"][0]["version"] == "v3"

    def test_cleanup_no_manifest_returns_zero(self, storage):
        removed = storage.cleanup_old_versions("nonexistent", keep=3)
        assert removed == 0

    def test_cleanup_uses_default_keep(self, storage, tiny_model):
        """Default keep value is MODEL_VERSIONS_TO_KEEP (5)."""
        for i in range(8):
            storage.save_model(tiny_model, "game_winner", f"v{i}")

        removed = storage.cleanup_old_versions("game_winner")
        assert removed == 3  # 8 - 5 = 3

        manifest = storage.get_manifest("game_winner")
        assert len(manifest["versions"]) == 5


# ===================================================================
# 5. Edge cases
# ===================================================================


class TestEdgeCases:
    """Edge cases: missing data, missing artifacts, empty storage."""

    def test_load_from_empty_storage_raises(self, storage):
        with pytest.raises(FileNotFoundError, match="No active model"):
            storage.load_model("game_winner")

    def test_load_manifest_exists_but_no_active_version(self, storage, client):
        """Manifest exists but active_version is missing/empty."""
        manifest = {"model_type": "game_winner", "versions": []}
        bucket = client.storage.from_("test-bucket")
        bucket.upload(
            path="game_winner/manifest.json",
            file=json.dumps(manifest).encode("utf-8"),
        )
        with pytest.raises(FileNotFoundError, match="No active model"):
            storage.load_model("game_winner")

    def test_load_manifest_exists_but_artifact_missing(self, storage, client, tiny_model):
        """Manifest points to a version whose artifact was deleted."""
        storage.save_model(tiny_model, "game_winner", "v1")

        # Delete the artifact but leave the manifest
        bucket = client.storage.from_("test-bucket")
        bucket.remove(["game_winner/v1.joblib"])

        with pytest.raises(Exception):
            storage.load_model("game_winner")

    def test_save_creates_bucket_implicitly(self, tiny_model):
        """Save should work even if the bucket hasn't been used before."""
        client = _make_client()
        storage = ModelStorage(client, bucket="brand-new-bucket")
        path = storage.save_model(tiny_model, "game_winner", "v1")
        assert path == "game_winner/v1.joblib"

        # Should be loadable
        loaded = storage.load_model("game_winner")
        assert loaded is not None

    def test_load_with_none_active_version(self, storage, client):
        """Manifest has active_version=None."""
        manifest = {"model_type": "game_winner", "active_version": None, "versions": []}
        bucket = client.storage.from_("test-bucket")
        bucket.upload(
            path="game_winner/manifest.json",
            file=json.dumps(manifest).encode("utf-8"),
        )
        with pytest.raises(FileNotFoundError, match="No active model"):
            storage.load_model("game_winner")

    def test_save_same_version_twice_overwrites(self, storage, tiny_model, another_tiny_model):
        """Saving with the same version string should overwrite (upsert)."""
        storage.save_model(tiny_model, "game_winner", "v1", metrics={"accuracy": 0.80})
        storage.save_model(another_tiny_model, "game_winner", "v1", metrics={"accuracy": 0.85})

        manifest = storage.get_manifest("game_winner")
        assert manifest["active_version"] == "v1"
        # Note: both saves append to versions list (no deduplication)
        assert len(manifest["versions"]) == 2

        # The loaded model should be the second one (overwritten artifact)
        loaded = storage.load_model("game_winner")
        assert loaded is not None


# ===================================================================
# 6. Model metadata in manifest
# ===================================================================


class TestModelMetadataStorage:
    """Verify metrics and metadata round-trip through the manifest."""

    def test_metrics_round_trip(self, storage, tiny_model):
        metrics = {
            "accuracy": 0.82,
            "brier_score": 0.19,
            "log_loss": 0.55,
            "n_games": 200,
        }
        storage.save_model(tiny_model, "game_winner", "v1", metrics=metrics)

        manifest = storage.get_manifest("game_winner")
        assert manifest["metrics"] == metrics
        assert manifest["versions"][0]["metrics"] == metrics

    def test_metrics_with_float_precision(self, storage, tiny_model):
        metrics = {"accuracy": 0.123456789012345}
        storage.save_model(tiny_model, "game_winner", "v1", metrics=metrics)

        manifest = storage.get_manifest("game_winner")
        assert manifest["metrics"]["accuracy"] == pytest.approx(0.123456789012345)

    def test_empty_metrics(self, storage, tiny_model):
        storage.save_model(tiny_model, "game_winner", "v1", metrics={})
        manifest = storage.get_manifest("game_winner")
        assert manifest["metrics"] == {}

    def test_version_history_preserves_all_metrics(self, storage, tiny_model):
        for i in range(3):
            storage.save_model(
                tiny_model, "game_winner", f"v{i}",
                metrics={"accuracy": 0.80 + i * 0.02},
            )

        manifest = storage.get_manifest("game_winner")
        for i in range(3):
            assert manifest["versions"][i]["metrics"]["accuracy"] == pytest.approx(
                0.80 + i * 0.02
            )

    def test_manifest_model_type_field(self, storage, tiny_model):
        storage.save_model(tiny_model, "spread", "v1")
        manifest = storage.get_manifest("spread")
        assert manifest["model_type"] == "spread"


# ===================================================================
# 7. Promotion decision logic (static method)
# ===================================================================


class TestShouldPromote:
    """Tests for ModelStorage.should_promote() static method."""

    def test_brier_improvement_promotes(self):
        old = {"brier_score": 0.25}
        new = {"brier_score": 0.20}
        assert ModelStorage.should_promote(old, new, min_improvement=0.02) is True

    def test_brier_insufficient_improvement_rejects(self):
        old = {"brier_score": 0.25}
        new = {"brier_score": 0.24}
        assert ModelStorage.should_promote(old, new, min_improvement=0.02) is False

    def test_brier_regression_rejects(self):
        old = {"brier_score": 0.20}
        new = {"brier_score": 0.25}
        assert ModelStorage.should_promote(old, new, min_improvement=0.02) is False

    def test_mae_improvement_promotes(self):
        old = {"mae": 2.5}
        new = {"mae": 2.3}
        assert ModelStorage.should_promote(old, new, min_improvement=0.1) is True

    def test_mae_insufficient_improvement_rejects(self):
        old = {"mae": 2.5}
        new = {"mae": 2.45}
        assert ModelStorage.should_promote(old, new, min_improvement=0.1) is False

    def test_accuracy_improvement_promotes(self):
        old = {"accuracy": 0.52}
        new = {"accuracy": 0.55}
        assert ModelStorage.should_promote(old, new, min_improvement=0.02) is True

    def test_accuracy_insufficient_improvement_rejects(self):
        old = {"accuracy": 0.52}
        new = {"accuracy": 0.53}
        assert ModelStorage.should_promote(old, new, min_improvement=0.02) is False

    def test_brier_takes_priority_over_accuracy(self):
        """When both brier and accuracy are present, brier wins."""
        old = {"brier_score": 0.25, "accuracy": 0.80}
        new = {"brier_score": 0.20, "accuracy": 0.70}  # Accuracy worse, but brier better
        assert ModelStorage.should_promote(old, new, min_improvement=0.02) is True

    def test_mae_takes_priority_over_accuracy(self):
        old = {"mae": 2.5, "accuracy": 0.80}
        new = {"mae": 2.3, "accuracy": 0.70}
        assert ModelStorage.should_promote(old, new, min_improvement=0.1) is True

    def test_no_comparable_metrics_rejects(self):
        old = {"some_metric": 0.5}
        new = {"other_metric": 0.6}
        assert ModelStorage.should_promote(old, new) is False

    def test_empty_metrics_rejects(self):
        assert ModelStorage.should_promote({}, {}) is False

    def test_exact_threshold_promotes(self):
        old = {"brier_score": 0.50}
        new = {"brier_score": 0.25}
        # Improvement = 0.25, threshold = 0.25 -> exactly meets threshold
        assert ModelStorage.should_promote(old, new, min_improvement=0.25) is True

    def test_just_under_threshold_rejects(self):
        old = {"brier_score": 0.25}
        new = {"brier_score": 0.2301}
        assert ModelStorage.should_promote(old, new, min_improvement=0.02) is False
