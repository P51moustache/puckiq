"""
Tests for pre-prediction data validation.

Validates feature alignment, NaN handling differences between model types,
prediction output ranges, and all-identical predictions detection.

Key insight documented in tests:
- LightGBM (GameWinnerModel, SpreadModel, LGBMComponent) handles NaN natively.
- Poisson GLM (PoissonComponent in TotalsModel) requires fillna(0) -- NaN causes errors.
"""

import numpy as np
import pandas as pd
import pytest

from ml.features.registry import generate_synthetic_features, get_model_features
from ml.models.game_winner import GameWinnerModel
from ml.models.spread import SpreadModel
from ml.models.totals import LGBMComponent, PoissonComponent, TotalsModel


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def small_features():
    """Small synthetic feature matrix for fast training (50 rows)."""
    return generate_synthetic_features(n=50, model_type="game_winner", seed=99)


@pytest.fixture
def small_binary_targets(small_features):
    """Binary targets matching small_features."""
    np.random.seed(99)
    return pd.Series(
        np.random.choice([0, 1], len(small_features), p=[0.45, 0.55]),
        name="home_win",
    )


@pytest.fixture
def small_spread_targets(small_features):
    """Continuous spread targets matching small_features."""
    np.random.seed(99)
    return pd.Series(
        np.random.normal(0.2, 2.5, len(small_features)),
        name="spread",
    )


@pytest.fixture
def small_total_targets(small_features):
    """Count targets matching small_features."""
    np.random.seed(99)
    return pd.Series(
        np.random.poisson(5.5, len(small_features)),
        name="total_goals",
    )


@pytest.fixture
def totals_features():
    """Feature matrix specifically for totals model."""
    return generate_synthetic_features(n=50, model_type="totals", seed=99)


@pytest.fixture
def totals_targets(totals_features):
    """Count targets matching totals_features."""
    np.random.seed(99)
    return pd.Series(
        np.random.poisson(5.5, len(totals_features)),
        name="total_goals",
    )


@pytest.fixture
def trained_gw_model(small_features, small_binary_targets):
    """A trained GameWinnerModel for prediction tests."""
    model = GameWinnerModel()
    model.train(small_features, small_binary_targets)
    return model


@pytest.fixture
def trained_spread_model(small_features, small_spread_targets):
    """A trained SpreadModel for prediction tests."""
    model = SpreadModel()
    model.train(small_features, small_spread_targets)
    return model


@pytest.fixture
def trained_totals_model(totals_features, totals_targets):
    """A trained TotalsModel (ensemble) for prediction tests."""
    model = TotalsModel()
    # Poisson GLM needs fillna(0) -- totals model expects clean data at train time
    features_clean = totals_features.fillna(0)
    model.train(features_clean, totals_targets)
    return model


# ---------------------------------------------------------------------------
# Test 1: Feature column alignment
# ---------------------------------------------------------------------------


class TestFeatureColumnAlignment:
    """Test behavior when prediction features don't match training features."""

    def test_predict_with_missing_column(self, trained_gw_model, small_features):
        """Predicting with fewer columns than training -- LightGBM uses positional
        indexing (.values), so this produces predictions from misaligned data
        rather than raising an error. This documents the actual behavior:
        LightGBM does NOT validate column names, only shape.
        """
        # Drop one column to create misaligned features
        reduced = small_features.drop(columns=[small_features.columns[-1]])
        # LightGBM predict_proba uses .values, so column count mismatch raises ValueError
        with pytest.raises(ValueError):
            trained_gw_model.predict(reduced)

    def test_predict_with_extra_column(self, trained_gw_model, small_features):
        """Predicting with more columns than training -- LightGBM raises ValueError
        because the internal feature count doesn't match.
        """
        extra = small_features.copy()
        extra["extra_feature_D"] = np.random.rand(len(extra))
        with pytest.raises(ValueError):
            trained_gw_model.predict(extra)

    def test_predict_with_matching_columns(self, trained_gw_model, small_features):
        """Predicting with matching columns should work fine."""
        probs = trained_gw_model.predict(small_features)
        assert len(probs) == len(small_features)
        assert all(0.0 <= p <= 1.0 for p in probs)

    def test_spread_model_column_mismatch(self, trained_spread_model, small_features):
        """SpreadModel (also LightGBM) should reject mismatched columns too."""
        reduced = small_features.drop(columns=[small_features.columns[0]])
        with pytest.raises(ValueError):
            trained_spread_model.predict(reduced)

    def test_totals_poisson_column_mismatch(self, totals_features, totals_targets):
        """PoissonComponent should fail with wrong number of columns
        because it adds a constant column and the matrix shape won't match."""
        poisson_model = PoissonComponent()
        features_clean = totals_features.fillna(0)
        poisson_model.train(features_clean, totals_targets)

        reduced = features_clean.drop(columns=[features_clean.columns[0]])
        # Poisson GLM also uses positional indexing -- wrong column count
        # means wrong matrix shape after adding constant
        with pytest.raises(ValueError):
            poisson_model.predict(reduced)


# ---------------------------------------------------------------------------
# Test 2: NaN handling differences
# ---------------------------------------------------------------------------


class TestNanHandlingDifferences:
    """Test NaN handling differences between LightGBM and Poisson GLM.

    LightGBM handles NaN natively -- it learns optimal split directions for
    missing values during training. NaN features just go left or right at
    each split node, so predictions always succeed.

    Poisson GLM (statsmodels) does NOT handle NaN -- any NaN in the feature
    matrix causes the linear algebra to produce NaN predictions. The fix is
    to call fillna(0) before passing data to the Poisson component.

    This difference is critical for the TotalsModel ensemble, which must
    fillna(0) for the Poisson path while LightGBM is fine without it.
    """

    def test_lightgbm_classifier_accepts_nan(self, small_features, small_binary_targets):
        """GameWinnerModel (LightGBM classifier) should handle NaN features."""
        # Inject NaN into ~10% of cells
        features_with_nan = small_features.copy()
        rng = np.random.default_rng(42)
        mask = rng.random(features_with_nan.shape) < 0.1
        features_with_nan[mask] = np.nan

        model = GameWinnerModel()
        model.train(features_with_nan, small_binary_targets)
        probs = model.predict(features_with_nan)

        assert len(probs) == len(features_with_nan)
        assert not np.any(np.isnan(probs)), "LightGBM predictions should not contain NaN"
        assert all(0.0 <= p <= 1.0 for p in probs)

    def test_lightgbm_regressor_accepts_nan(self, small_features, small_spread_targets):
        """SpreadModel (LightGBM regressor) should handle NaN features."""
        features_with_nan = small_features.copy()
        rng = np.random.default_rng(42)
        mask = rng.random(features_with_nan.shape) < 0.1
        features_with_nan[mask] = np.nan

        model = SpreadModel()
        model.train(features_with_nan, small_spread_targets)
        preds = model.predict(features_with_nan)

        assert len(preds) == len(features_with_nan)
        assert not np.any(np.isnan(preds)), "LightGBM predictions should not contain NaN"

    def test_poisson_glm_fails_on_nan(self, totals_features, totals_targets):
        """PoissonComponent produces NaN predictions when given NaN features.

        This documents WHY fillna(0) is required before the Poisson component.
        statsmodels GLM doesn't error -- it silently produces NaN coefficients
        which cascade to NaN predictions.
        """
        features_with_nan = totals_features.copy()
        rng = np.random.default_rng(42)
        mask = rng.random(features_with_nan.shape) < 0.1
        features_with_nan[mask] = np.nan

        # Train on clean data, predict on NaN data
        model = PoissonComponent()
        clean = totals_features.fillna(0)
        model.train(clean, totals_targets)

        preds = model.predict(features_with_nan)
        # Predictions will contain NaN because X * beta has NaN terms
        assert np.any(np.isnan(preds)), (
            "Poisson GLM should produce NaN predictions from NaN features"
        )

    def test_poisson_glm_works_after_fillna(self, totals_features, totals_targets):
        """PoissonComponent works correctly when NaN is filled with 0."""
        features_with_nan = totals_features.copy()
        rng = np.random.default_rng(42)
        mask = rng.random(features_with_nan.shape) < 0.1
        features_with_nan[mask] = np.nan

        model = PoissonComponent()
        clean_train = totals_features.fillna(0)
        model.train(clean_train, totals_targets)

        clean_predict = features_with_nan.fillna(0)
        preds = model.predict(clean_predict)
        assert not np.any(np.isnan(preds)), (
            "Poisson GLM should produce valid predictions after fillna(0)"
        )
        assert all(p > 0 for p in preds), "Poisson predictions should be positive"

    def test_totals_ensemble_handles_nan_via_fillna(
        self, totals_features, totals_targets
    ):
        """TotalsModel ensemble: both components work when trained on clean data
        and predicting on clean data. This validates the intended workflow where
        the pipeline calls fillna(0) before training and prediction."""
        model = TotalsModel()
        clean = totals_features.fillna(0)
        model.train(clean, totals_targets)

        preds = model.predict(clean)
        assert len(preds) == len(clean)
        assert not np.any(np.isnan(preds))
        assert all(p > 0 for p in preds), "Total goals predictions should be positive"


# ---------------------------------------------------------------------------
# Test 3: Prediction output ranges
# ---------------------------------------------------------------------------


class TestPredictionOutputRanges:
    """Test that model predictions fall within expected ranges."""

    def test_game_winner_probabilities_in_0_1(
        self, trained_gw_model, small_features
    ):
        """Game winner P(home_win) must be in [0, 1]."""
        probs = trained_gw_model.predict(small_features)
        assert all(0.0 <= p <= 1.0 for p in probs), (
            f"Probabilities out of range: min={probs.min()}, max={probs.max()}"
        )

    def test_game_winner_binary_predictions(
        self, trained_gw_model, small_features
    ):
        """Binary predictions should be exactly 0 or 1."""
        preds = trained_gw_model.predict_class(small_features)
        unique_vals = set(preds)
        assert unique_vals.issubset({0, 1}), f"Unexpected values: {unique_vals}"

    def test_spread_predictions_reasonable_range(
        self, trained_spread_model, small_features
    ):
        """Spread predictions should be in a reasonable range (not extreme values).

        Real NHL spreads rarely exceed +/-10. With synthetic data the model
        should produce values in a plausible range -- definitely not +/-100.
        """
        preds = trained_spread_model.predict(small_features)
        assert all(abs(p) < 100 for p in preds), (
            f"Spread predictions unreasonably large: min={preds.min()}, max={preds.max()}"
        )
        # Most predictions should be within a reasonable hockey range
        assert np.mean(np.abs(preds) < 10) > 0.9, (
            "At least 90% of spread predictions should be within +/-10 goals"
        )

    def test_totals_predictions_positive(
        self, trained_totals_model, totals_features
    ):
        """Total goals predictions must be positive (can't have negative total goals)."""
        clean = totals_features.fillna(0)
        preds = trained_totals_model.predict(clean)
        assert all(p > 0 for p in preds), (
            f"Totals predictions contain non-positive values: min={preds.min()}"
        )

    def test_totals_predictions_reasonable_range(
        self, trained_totals_model, totals_features
    ):
        """Total goals should be in a reasonable range for hockey (roughly 2-15)."""
        clean = totals_features.fillna(0)
        preds = trained_totals_model.predict(clean)
        assert all(0 < p < 20 for p in preds), (
            f"Totals predictions out of plausible range: min={preds.min()}, max={preds.max()}"
        )

    def test_poisson_distribution_sums_to_near_one(
        self, trained_totals_model, totals_features
    ):
        """Poisson probability distribution should sum to close to 1.0 for each game.

        It won't be exactly 1.0 because we truncate at MAX_GOALS=12. For typical
        NHL lambda values (~5.5), truncation captures >99% of the distribution.
        With synthetic data, lambda can vary more, so we use a looser threshold
        (>0.70) while still verifying the distribution is valid.
        """
        clean = totals_features.fillna(0)
        dist = trained_totals_model.predict_distribution(clean)
        row_sums = dist.sum(axis=1)
        assert all(s > 0.70 for s in row_sums), (
            f"Distribution row sums too low: min={row_sums.min()}"
        )
        # Most rows should still be close to 1.0
        assert np.mean(row_sums > 0.90) > 0.5, (
            "At least half the distribution sums should exceed 0.90"
        )

    def test_poisson_distribution_non_negative(
        self, trained_totals_model, totals_features
    ):
        """All probabilities in the distribution should be non-negative."""
        clean = totals_features.fillna(0)
        dist = trained_totals_model.predict_distribution(clean)
        assert np.all(dist >= 0), "Poisson probabilities should be non-negative"


# ---------------------------------------------------------------------------
# Test 4: All-identical predictions detection
# ---------------------------------------------------------------------------


class TestIdenticalPredictionsDetection:
    """Test behavior with degenerate inputs where all features are identical.

    The weekly_retrain quality gate checks "predictions not all identical" to
    detect broken models. But if all inputs are the SAME, identical outputs are
    EXPECTED and correct. These tests verify that distinction.
    """

    def test_identical_inputs_produce_identical_gw_predictions(self):
        """When all rows have the same features, predictions must be identical.
        This is mathematically correct, not a model bug."""
        features = generate_synthetic_features(n=10, model_type="game_winner", seed=42)
        # Make all rows identical
        single_row = features.iloc[0].values
        for i in range(len(features)):
            features.iloc[i] = single_row

        targets = pd.Series([0, 1, 0, 1, 0, 1, 0, 1, 0, 1], name="home_win")
        model = GameWinnerModel()
        model.train(features, targets)
        probs = model.predict(features)

        # All predictions should be the same
        assert np.all(probs == probs[0]), (
            "Identical inputs should produce identical predictions"
        )

    def test_varied_inputs_produce_varied_gw_predictions(self):
        """With varied inputs, predictions should NOT all be identical.
        This is the quality gate's intended check."""
        features = generate_synthetic_features(n=200, model_type="game_winner", seed=42)
        np.random.seed(42)
        targets = pd.Series(
            np.random.choice([0, 1], len(features)), name="home_win"
        )
        model = GameWinnerModel()
        model.train(features, targets)
        probs = model.predict(features)

        # With varied input, we expect varied output
        assert not np.all(probs == probs[0]), (
            "Varied inputs should produce varied predictions"
        )

    def test_identical_inputs_produce_identical_spread_predictions(self):
        """Spread model with identical inputs should give identical predictions."""
        features = generate_synthetic_features(n=10, model_type="game_winner", seed=42)
        single_row = features.iloc[0].values
        for i in range(len(features)):
            features.iloc[i] = single_row

        np.random.seed(42)
        targets = pd.Series(np.random.normal(0, 2, len(features)), name="spread")
        model = SpreadModel()
        model.train(features, targets)
        preds = model.predict(features)

        assert np.all(preds == preds[0]), (
            "Identical inputs should produce identical spread predictions"
        )

    def test_identical_inputs_produce_identical_totals_predictions(self):
        """Totals model with identical inputs should give identical predictions."""
        features = generate_synthetic_features(n=10, model_type="totals", seed=42)
        single_row = features.iloc[0].values
        for i in range(len(features)):
            features.iloc[i] = single_row
        features = features.fillna(0)

        np.random.seed(42)
        targets = pd.Series(np.random.poisson(5.5, len(features)), name="total_goals")
        model = TotalsModel()
        model.train(features, targets)
        preds = model.predict(features)

        assert np.all(preds == preds[0]), (
            "Identical inputs should produce identical totals predictions"
        )
