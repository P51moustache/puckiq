"""
Tests for ml/features/registry.py — YAML-driven feature registry.

Verifies that features.yaml loads correctly, features are well-defined,
and model_features mapping returns correct feature lists.
"""

from pathlib import Path

import pytest

from ml.config import ModelType
from ml.features.registry import (
    FeatureDefinition,
    get_model_features,
    load_feature_registry,
)


class TestLoadFeatureRegistry:
    """Tests for load_feature_registry()."""

    def test_loads_without_error(self):
        registry = load_feature_registry()
        assert isinstance(registry, dict)

    def test_returns_non_empty(self):
        registry = load_feature_registry()
        assert len(registry) > 0

    def test_all_values_are_feature_definitions(self):
        registry = load_feature_registry()
        for name, feat in registry.items():
            assert isinstance(feat, FeatureDefinition)
            assert feat.name == name

    def test_all_features_are_enabled(self):
        """load_feature_registry only returns enabled features."""
        registry = load_feature_registry()
        for feat in registry.values():
            assert feat.enabled is True

    def test_all_features_have_description(self):
        registry = load_feature_registry()
        for feat in registry.values():
            assert isinstance(feat.description, str)
            assert len(feat.description) > 0

    def test_all_features_have_valid_compute_type(self):
        valid_types = {"lookup", "rolling_team", "jsonb_lookup", "derived"}
        registry = load_feature_registry()
        for feat in registry.values():
            assert feat.compute_type in valid_types, (
                f"Feature '{feat.name}' has invalid compute_type '{feat.compute_type}'"
            )

    def test_all_features_have_tier(self):
        registry = load_feature_registry()
        for feat in registry.values():
            assert isinstance(feat.tier, int)
            assert feat.tier >= 1

    def test_known_features_present(self):
        """Spot-check that known features from features.yaml are loaded."""
        registry = load_feature_registry()
        expected = [
            "home_point_pctg",
            "away_point_pctg",
            "home_goal_diff",
            "point_pctg_diff",
            "rest_advantage",
            "home_is_back_to_back",
        ]
        for name in expected:
            assert name in registry, f"Expected feature '{name}' not found in registry"

    def test_lookup_features_have_config(self):
        """Lookup features should have table and column in config."""
        registry = load_feature_registry()
        for feat in registry.values():
            if feat.compute_type == "lookup":
                assert "table" in feat.config, f"Lookup feature '{feat.name}' missing 'table'"
                assert "column" in feat.config, f"Lookup feature '{feat.name}' missing 'column'"

    def test_rolling_features_have_config(self):
        """Rolling features should have stat and team_key in config."""
        registry = load_feature_registry()
        for feat in registry.values():
            if feat.compute_type == "rolling_team":
                assert "stat" in feat.config, f"Rolling feature '{feat.name}' missing 'stat'"
                assert "team_key" in feat.config, f"Rolling feature '{feat.name}' missing 'team_key'"

    def test_nonexistent_yaml_raises_error(self):
        with pytest.raises(FileNotFoundError):
            load_feature_registry(yaml_path="/nonexistent/path.yaml")


class TestGetModelFeatures:
    """Tests for get_model_features()."""

    def test_game_winner_features_non_empty(self):
        features = get_model_features("game_winner")
        assert isinstance(features, list)
        assert len(features) > 0

    def test_spread_features_non_empty(self):
        features = get_model_features("spread")
        assert isinstance(features, list)
        assert len(features) > 0

    def test_totals_features_non_empty(self):
        features = get_model_features("totals")
        assert isinstance(features, list)
        assert len(features) > 0

    def test_player_props_features_non_empty(self):
        features = get_model_features("player_props")
        assert isinstance(features, list)
        assert len(features) > 0

    def test_accepts_model_type_enum(self):
        """Should work with ModelType enum values too."""
        features = get_model_features(ModelType.GAME_WINNER)
        assert isinstance(features, list)
        assert len(features) > 0

    def test_unknown_model_returns_empty(self):
        features = get_model_features("nonexistent_model")
        assert features == []

    def test_feature_names_are_strings(self):
        for model in ["game_winner", "spread", "totals"]:
            features = get_model_features(model)
            for name in features:
                assert isinstance(name, str)
                assert len(name) > 0

    def test_game_winner_contains_key_features(self):
        """Game winner model should include point percentage and rest features."""
        features = get_model_features("game_winner")
        assert "home_point_pctg" in features
        assert "away_point_pctg" in features
        assert "rest_advantage" in features
        assert "point_pctg_diff" in features

    def test_totals_contains_goals_features(self):
        """Totals model should include goals-related features."""
        features = get_model_features("totals")
        assert "home_goals_for_l10" in features
        assert "away_goals_for_l10" in features

    def test_game_winner_has_more_features_than_totals(self):
        """Game winner uses more features than the simpler totals model."""
        gw = get_model_features("game_winner")
        totals = get_model_features("totals")
        assert len(gw) > len(totals)

    def test_all_model_features_exist_in_registry(self):
        """Every feature referenced by a model should be in the registry."""
        registry = load_feature_registry()
        for model in ["game_winner", "spread", "totals"]:
            features = get_model_features(model)
            for name in features:
                assert name in registry, (
                    f"Model '{model}' references feature '{name}' "
                    f"which is not in the registry"
                )


class TestFeatureDefinitionDataclass:
    """Tests for the FeatureDefinition dataclass itself."""

    def test_create_with_defaults(self):
        fd = FeatureDefinition(name="test", description="A test feature", compute_type="lookup")
        assert fd.name == "test"
        assert fd.enabled is True
        assert fd.tier == 1
        assert fd.config == {}

    def test_create_with_custom_values(self):
        fd = FeatureDefinition(
            name="custom",
            description="Custom",
            compute_type="derived",
            config={"formula": "a + b"},
            enabled=False,
            tier=3,
        )
        assert fd.enabled is False
        assert fd.tier == 3
        assert fd.config["formula"] == "a + b"
