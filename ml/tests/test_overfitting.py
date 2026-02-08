"""
Tests for ml/evaluation/overfitting.py — overfitting detection.

Verifies that the gap between training and validation metrics is
correctly computed and flagged when it exceeds the threshold.
"""

import pytest

from ml.config import MAX_TRAIN_VAL_GAP
from ml.evaluation.overfitting import (
    compute_train_val_gap_history,
    detect_overfitting,
)


class TestDetectOverfitting:
    """Tests for detect_overfitting()."""

    def test_no_overfitting_when_gaps_small(self):
        """Train and val metrics are close — no overfitting."""
        train = {"accuracy": 0.60, "brier_score": 0.24}
        val = {"accuracy": 0.58, "brier_score": 0.25}
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is False

    def test_detects_accuracy_overfitting(self):
        """Large accuracy gap (train >> val) should trigger overfitting."""
        train = {"accuracy": 0.85}
        val = {"accuracy": 0.55}
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is True
        assert result["gaps"]["accuracy"] == pytest.approx(0.30)

    def test_detects_brier_overfitting(self):
        """Large Brier gap (val >> train) means model overfit to training data."""
        train = {"brier_score": 0.18}
        val = {"brier_score": 0.30}
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is True
        assert result["gaps"]["brier_score"] == pytest.approx(0.12)

    def test_detects_mae_overfitting(self):
        """Large MAE gap (val >> train) indicates regression overfitting."""
        train = {"mae": 1.0}
        val = {"mae": 3.0}
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is True
        assert result["gaps"]["mae"] == pytest.approx(2.0)

    def test_no_false_alarm_when_train_approx_val(self):
        """When train and val are approximately equal, no overfitting."""
        train = {"accuracy": 0.58, "brier_score": 0.24, "mae": 2.0}
        val = {"accuracy": 0.56, "brier_score": 0.25, "mae": 2.04}
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is False

    def test_custom_threshold(self):
        """Using a tighter threshold should flag smaller gaps."""
        train = {"accuracy": 0.62}
        val = {"accuracy": 0.59}
        # Default threshold (0.05) would not flag 0.03 gap
        result_default = detect_overfitting(train, val)
        assert result_default["is_overfitting"] is False

        # Tighter threshold (0.02) should flag it
        result_tight = detect_overfitting(train, val, threshold=0.02)
        assert result_tight["is_overfitting"] is True

    def test_returns_threshold(self):
        result = detect_overfitting({"accuracy": 0.6}, {"accuracy": 0.55})
        assert result["threshold"] == MAX_TRAIN_VAL_GAP

    def test_custom_threshold_returned(self):
        result = detect_overfitting({"accuracy": 0.6}, {"accuracy": 0.55}, threshold=0.10)
        assert result["threshold"] == 0.10

    def test_gaps_dict_populated(self):
        train = {"accuracy": 0.70, "brier_score": 0.20}
        val = {"accuracy": 0.60, "brier_score": 0.25}
        result = detect_overfitting(train, val)
        assert "accuracy" in result["gaps"]
        assert "brier_score" in result["gaps"]

    def test_empty_metrics_no_overfitting(self):
        """If no common metrics exist, should not flag overfitting."""
        result = detect_overfitting({}, {})
        assert result["is_overfitting"] is False
        assert result["gaps"] == {}

    def test_partial_metrics_only_checks_common(self):
        """Only metrics present in BOTH dicts should be checked."""
        train = {"accuracy": 0.95}
        val = {"brier_score": 0.30}
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is False
        assert result["gaps"] == {}

    def test_negative_accuracy_gap_not_overfitting(self):
        """If val accuracy > train accuracy, that's not overfitting (just noise)."""
        train = {"accuracy": 0.55}
        val = {"accuracy": 0.60}
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is False
        assert result["gaps"]["accuracy"] == pytest.approx(-0.05)

    def test_negative_brier_gap_not_overfitting(self):
        """If train Brier > val Brier, model generalizes well."""
        train = {"brier_score": 0.26}
        val = {"brier_score": 0.24}
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is False
        assert result["gaps"]["brier_score"] == pytest.approx(-0.02)

    def test_exactly_at_threshold_not_overfitting(self):
        """Gap exactly equal to threshold should NOT trigger (> not >=)."""
        threshold = 0.05
        train = {"accuracy": 0.60}
        val = {"accuracy": 0.55}
        result = detect_overfitting(train, val, threshold=threshold)
        assert result["is_overfitting"] is False

    def test_just_above_threshold_is_overfitting(self):
        threshold = 0.05
        train = {"accuracy": 0.606}
        val = {"accuracy": 0.55}
        result = detect_overfitting(train, val, threshold=threshold)
        assert result["is_overfitting"] is True

    def test_multiple_metrics_any_flags_overfitting(self):
        """If ANY metric gap exceeds threshold, is_overfitting should be True."""
        train = {"accuracy": 0.58, "brier_score": 0.15}  # Brier is suspiciously good
        val = {"accuracy": 0.56, "brier_score": 0.28}    # Brier degrades a lot
        result = detect_overfitting(train, val)
        assert result["is_overfitting"] is True


class TestComputeTrainValGapHistory:
    """Tests for compute_train_val_gap_history()."""

    def test_returns_list(self):
        metadata = [
            {
                "version": "v1",
                "train_metrics": {"accuracy": 0.60},
                "val_metrics": {"accuracy": 0.58},
            },
        ]
        history = compute_train_val_gap_history(metadata)
        assert isinstance(history, list)
        assert len(history) == 1

    def test_each_entry_has_required_fields(self):
        metadata = [
            {
                "version": "v1",
                "train_metrics": {"accuracy": 0.60},
                "val_metrics": {"accuracy": 0.58},
            },
            {
                "version": "v2",
                "train_metrics": {"accuracy": 0.65},
                "val_metrics": {"accuracy": 0.55},
            },
        ]
        history = compute_train_val_gap_history(metadata)
        for entry in history:
            assert "version" in entry
            assert "gaps" in entry
            assert "is_overfitting" in entry

    def test_detects_overfitting_in_later_version(self):
        metadata = [
            {
                "version": "v1",
                "train_metrics": {"accuracy": 0.60},
                "val_metrics": {"accuracy": 0.58},
            },
            {
                "version": "v2",
                "train_metrics": {"accuracy": 0.85},
                "val_metrics": {"accuracy": 0.55},
            },
        ]
        history = compute_train_val_gap_history(metadata)
        assert history[0]["is_overfitting"] is False
        assert history[1]["is_overfitting"] is True

    def test_empty_metadata_list(self):
        history = compute_train_val_gap_history([])
        assert history == []

    def test_missing_metrics_handled(self):
        """Metadata without train/val metrics should not crash."""
        metadata = [{"version": "v1"}]
        history = compute_train_val_gap_history(metadata)
        assert len(history) == 1
        assert history[0]["is_overfitting"] is False

    def test_preserves_version_labels(self):
        metadata = [
            {"version": "2025-01-15", "train_metrics": {}, "val_metrics": {}},
            {"version": "2025-01-22", "train_metrics": {}, "val_metrics": {}},
        ]
        history = compute_train_val_gap_history(metadata)
        assert history[0]["version"] == "2025-01-15"
        assert history[1]["version"] == "2025-01-22"
