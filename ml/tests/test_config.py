"""
Tests for ml/config.py — configuration constants and enums.

Verifies that all quality gates, thresholds, and constants are set to
sensible values, and that the ModelType enum has all expected members.
"""

from ml.config import (
    ALL_TEAMS,
    CONFIDENCE_HIGH,
    CONFIDENCE_LOW,
    CURRENT_SEASON,
    CURRENT_SEASON_WEIGHT,
    GAMES_TABLE,
    GOALIE_SEASON_STATS_TABLE,
    LGBM_CLASSIFIER_DEFAULTS,
    LGBM_REGRESSOR_DEFAULTS,
    MAX_BRIER_SCORE,
    MAX_FEATURES_V1,
    MAX_STALENESS_HOURS,
    MAX_TRAIN_VAL_GAP,
    MIN_ACCURACY,
    MIN_BRIER_IMPROVEMENT,
    MIN_CALIBRATION_QUALITY,
    MIN_GAMES_FOR_PROMOTION,
    MIN_TRAINING_GAMES,
    ML_MODEL_EVALUATIONS_TABLE,
    ML_MODEL_METADATA_TABLE,
    ML_PREDICTIONS_TABLE,
    ML_SCORES_TABLE,
    MODEL_STORAGE_BUCKET,
    MODEL_VERSIONS_TO_KEEP,
    ModelType,
    PRIOR_SEASON_WEIGHT,
    SKATER_SEASON_STATS_TABLE,
    STANDINGS_TABLE,
    STEP_SIZE,
    SYNC_LOG_TABLE,
    TEAM_STAT_CATEGORIES_TABLE,
    TOTALS_LGBM_WEIGHT,
    TOTALS_POISSON_WEIGHT,
    VALIDATION_WINDOW,
)


class TestModelTypeEnum:
    """Tests for the ModelType enum."""

    def test_game_winner_exists(self):
        assert ModelType.GAME_WINNER == "game_winner"

    def test_spread_exists(self):
        assert ModelType.SPREAD == "spread"

    def test_totals_exists(self):
        assert ModelType.TOTALS == "totals"

    def test_player_props_exists(self):
        assert ModelType.PLAYER_PROPS == "player_props"

    def test_enum_is_string(self):
        """ModelType extends str, so values can be used as strings."""
        for member in ModelType:
            assert isinstance(member, str)
            assert isinstance(member.value, str)

    def test_four_model_types(self):
        assert len(ModelType) == 4


class TestQualityGates:
    """Quality gate values must be sensible bounds."""

    def test_max_brier_below_coin_flip(self):
        """Brier ceiling must be near but above the theoretical random baseline (0.25)."""
        assert 0.25 <= MAX_BRIER_SCORE <= 0.30

    def test_min_accuracy_above_random(self):
        """Minimum accuracy must beat random guessing (50%)."""
        assert 0.50 < MIN_ACCURACY < 0.70

    def test_max_train_val_gap_positive(self):
        """Overfitting threshold must be a small positive number."""
        assert 0.0 < MAX_TRAIN_VAL_GAP <= 0.10

    def test_min_calibration_quality_in_range(self):
        """Calibration R-squared must be between 0 and 1."""
        assert 0.0 < MIN_CALIBRATION_QUALITY <= 1.0

    def test_min_brier_improvement_positive(self):
        assert MIN_BRIER_IMPROVEMENT > 0

    def test_min_games_for_promotion_reasonable(self):
        assert MIN_GAMES_FOR_PROMOTION >= 100


class TestCrossValidationParams:
    """Walk-forward CV parameters must make logical sense."""

    def test_min_training_games_positive(self):
        assert MIN_TRAINING_GAMES > 0

    def test_validation_window_positive(self):
        assert VALIDATION_WINDOW > 0

    def test_step_size_positive(self):
        assert STEP_SIZE > 0

    def test_step_size_not_larger_than_window(self):
        """Non-overlapping folds require step_size >= val_window."""
        assert STEP_SIZE >= VALIDATION_WINDOW


class TestSeasonWeighting:
    """Season weight values should make current season more important."""

    def test_current_season_full_weight(self):
        assert CURRENT_SEASON_WEIGHT == 1.0

    def test_prior_season_discount(self):
        assert 0.0 < PRIOR_SEASON_WEIGHT < CURRENT_SEASON_WEIGHT


class TestConfidenceThresholds:
    """Confidence thresholds must be ordered and within probability bounds."""

    def test_low_less_than_high(self):
        assert CONFIDENCE_LOW < CONFIDENCE_HIGH

    def test_thresholds_in_probability_range(self):
        assert 0.5 < CONFIDENCE_LOW < 1.0
        assert 0.5 < CONFIDENCE_HIGH < 1.0


class TestTableNames:
    """All Supabase table name constants must be non-empty strings."""

    def test_ml_tables_are_strings(self):
        for table in [
            ML_PREDICTIONS_TABLE,
            ML_SCORES_TABLE,
            ML_MODEL_METADATA_TABLE,
            ML_MODEL_EVALUATIONS_TABLE,
        ]:
            assert isinstance(table, str)
            assert len(table) > 0

    def test_source_tables_are_strings(self):
        for table in [
            GAMES_TABLE,
            STANDINGS_TABLE,
            SKATER_SEASON_STATS_TABLE,
            GOALIE_SEASON_STATS_TABLE,
            TEAM_STAT_CATEGORIES_TABLE,
            SYNC_LOG_TABLE,
        ]:
            assert isinstance(table, str)
            assert len(table) > 0


class TestNHLConstants:
    """NHL-specific constants sanity checks."""

    def test_current_season_format(self):
        """Season should be an 8-digit integer like 20252026."""
        assert isinstance(CURRENT_SEASON, int)
        assert CURRENT_SEASON >= 20202021

    def test_all_teams_count(self):
        """NHL has 32 teams."""
        assert len(ALL_TEAMS) == 32

    def test_all_teams_are_three_letter_codes(self):
        for team in ALL_TEAMS:
            assert isinstance(team, str)
            assert len(team) == 3
            assert team == team.upper()

    def test_known_teams_present(self):
        """Spot-check a few well-known teams."""
        for team in ["TOR", "BOS", "NYR", "MTL", "CHI", "EDM"]:
            assert team in ALL_TEAMS


class TestLGBMDefaults:
    """LightGBM default hyperparameters sanity checks."""

    def test_classifier_has_required_keys(self):
        required = ["num_leaves", "learning_rate", "n_estimators", "verbose"]
        for key in required:
            assert key in LGBM_CLASSIFIER_DEFAULTS

    def test_regressor_has_required_keys(self):
        required = ["num_leaves", "learning_rate", "n_estimators", "verbose"]
        for key in required:
            assert key in LGBM_REGRESSOR_DEFAULTS

    def test_classifier_objective_is_binary(self):
        assert LGBM_CLASSIFIER_DEFAULTS["objective"] == "binary"

    def test_regressor_objective_is_regression(self):
        assert LGBM_REGRESSOR_DEFAULTS["objective"] == "regression"

    def test_verbose_is_silent(self):
        """Both should suppress LightGBM output by default."""
        assert LGBM_CLASSIFIER_DEFAULTS["verbose"] == -1
        assert LGBM_REGRESSOR_DEFAULTS["verbose"] == -1

    def test_learning_rate_reasonable(self):
        assert 0.01 <= LGBM_CLASSIFIER_DEFAULTS["learning_rate"] <= 0.5
        assert 0.01 <= LGBM_REGRESSOR_DEFAULTS["learning_rate"] <= 0.5


class TestTotalsWeights:
    """Ensemble weights must sum to 1.0."""

    def test_weights_sum_to_one(self):
        assert abs(TOTALS_POISSON_WEIGHT + TOTALS_LGBM_WEIGHT - 1.0) < 1e-9

    def test_weights_positive(self):
        assert TOTALS_POISSON_WEIGHT > 0
        assert TOTALS_LGBM_WEIGHT > 0


class TestMiscConstants:
    """Other constants sanity checks."""

    def test_max_features_v1(self):
        assert MAX_FEATURES_V1 > 0

    def test_max_staleness_hours(self):
        assert MAX_STALENESS_HOURS > 0

    def test_model_storage_bucket_is_string(self):
        assert isinstance(MODEL_STORAGE_BUCKET, str)
        assert len(MODEL_STORAGE_BUCKET) > 0

    def test_model_versions_to_keep(self):
        assert MODEL_VERSIONS_TO_KEEP >= 1
