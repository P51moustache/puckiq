"""
Tests for ml/evaluation/calibration.py — calibration bucket computation.

Verifies that predictions are correctly binned and that average predicted
probabilities are compared against actual outcomes per bucket.
"""

import numpy as np
import pytest

from ml.evaluation.calibration import CalibrationBucket, compute_calibration_buckets


class TestComputeCalibrationBuckets:
    """Tests for compute_calibration_buckets()."""

    def test_returns_list_of_buckets(self):
        preds = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
        actuals = np.array([0, 0, 1, 1, 1])
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=5)
        assert isinstance(buckets, list)
        for b in buckets:
            assert isinstance(b, CalibrationBucket)

    def test_correct_number_of_buckets(self):
        preds = np.random.uniform(0, 1, 100)
        actuals = np.random.choice([0, 1], 100)
        for n in [5, 10, 20]:
            buckets = compute_calibration_buckets(preds, actuals, n_buckets=n)
            assert len(buckets) == n

    def test_bucket_boundaries(self):
        """Buckets should span [0, 1] in equal widths."""
        preds = np.random.uniform(0, 1, 100)
        actuals = np.random.choice([0, 1], 100)
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)

        assert abs(buckets[0].bucket_low - 0.0) < 1e-9
        assert abs(buckets[-1].bucket_high - 1.0) < 1e-9

        for i in range(len(buckets) - 1):
            assert abs(buckets[i].bucket_high - buckets[i + 1].bucket_low) < 1e-9

    def test_bucket_width_uniform(self):
        preds = np.random.uniform(0, 1, 100)
        actuals = np.random.choice([0, 1], 100)
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)
        expected_width = 0.1
        for b in buckets:
            width = b.bucket_high - b.bucket_low
            assert abs(width - expected_width) < 1e-9

    def test_perfectly_calibrated_data(self):
        """When predicted probabilities exactly match outcomes, calibration gaps are 0."""
        preds = np.array([0.0] * 50 + [1.0] * 50)
        actuals = np.array([0] * 50 + [1] * 50)
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=2)

        non_empty = [b for b in buckets if b.count > 0]
        for b in non_empty:
            assert abs(b.predicted_avg - b.actual_avg) < 1e-9

    def test_all_predictions_in_one_bucket(self):
        """If all predictions are 0.5, they should all land in one bucket."""
        preds = np.full(100, 0.5)
        actuals = np.random.choice([0, 1], 100)
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)

        non_empty = [b for b in buckets if b.count > 0]
        assert len(non_empty) == 1
        assert non_empty[0].count == 100

    def test_empty_buckets_have_zero_count(self):
        """Buckets with no predictions should have count=0."""
        preds = np.array([0.05, 0.95])
        actuals = np.array([0, 1])
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)

        empty = [b for b in buckets if b.count == 0]
        assert len(empty) > 0
        for b in empty:
            assert b.count == 0
            assert b.actual_avg == 0.0

    def test_predicted_avg_within_bucket(self):
        """The average predicted value should be within the bucket boundaries."""
        np.random.seed(42)
        preds = np.random.uniform(0, 1, 1000)
        actuals = np.random.choice([0, 1], 1000)
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)

        for b in buckets:
            if b.count > 0:
                assert b.predicted_avg >= b.bucket_low - 1e-9
                assert b.predicted_avg <= b.bucket_high + 1e-9

    def test_actual_avg_in_valid_range(self):
        """Actual average (proportion of true positives) should be between 0 and 1."""
        np.random.seed(42)
        preds = np.random.uniform(0, 1, 200)
        actuals = np.random.choice([0, 1], 200)
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)

        for b in buckets:
            if b.count > 0:
                assert 0.0 <= b.actual_avg <= 1.0

    def test_total_count_equals_input_length(self):
        """Sum of all bucket counts should equal the number of predictions."""
        np.random.seed(42)
        preds = np.random.uniform(0, 1, 150)
        actuals = np.random.choice([0, 1], 150)
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)

        total = sum(b.count for b in buckets)
        assert total == 150


class TestCalibrationEdgeCases:
    """Edge cases for calibration computation."""

    def test_empty_input(self):
        preds = np.array([])
        actuals = np.array([])
        buckets = compute_calibration_buckets(preds, actuals)
        assert buckets == []

    def test_single_prediction(self):
        preds = np.array([0.7])
        actuals = np.array([1])
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)
        assert len(buckets) == 10
        non_empty = [b for b in buckets if b.count > 0]
        assert len(non_empty) == 1
        assert non_empty[0].count == 1

    def test_mismatched_lengths_raises(self):
        preds = np.array([0.5, 0.6])
        actuals = np.array([1])
        with pytest.raises(ValueError, match="same length"):
            compute_calibration_buckets(preds, actuals)

    def test_extreme_predictions_at_boundaries(self):
        """Predictions at exactly 0.0 and 1.0 should be handled correctly."""
        preds = np.array([0.0, 1.0])
        actuals = np.array([0, 1])
        buckets = compute_calibration_buckets(preds, actuals, n_buckets=10)
        total = sum(b.count for b in buckets)
        assert total == 2


class TestCalibrationBucketDataclass:
    """Tests for the CalibrationBucket dataclass."""

    def test_create_bucket(self):
        b = CalibrationBucket(
            bucket_low=0.0,
            bucket_high=0.1,
            predicted_avg=0.05,
            actual_avg=0.08,
            count=20,
        )
        assert b.bucket_low == 0.0
        assert b.bucket_high == 0.1
        assert b.predicted_avg == 0.05
        assert b.actual_avg == 0.08
        assert b.count == 20
