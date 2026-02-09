"""
YAML-driven feature registry.

Features are defined in features.yaml with metadata about how to compute them,
which model types use them, and whether they are enabled.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml

from ml.config import ModelType

logger = logging.getLogger(__name__)

_DEFAULT_YAML = Path(__file__).parent / "features.yaml"


@dataclass
class FeatureDefinition:
    """A single feature's metadata from the registry."""

    name: str
    description: str
    compute_type: str  # "lookup", "rolling_team", "jsonb_lookup", "derived"
    config: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    tier: int = 1


def load_feature_registry(
    yaml_path: str | Path = _DEFAULT_YAML,
) -> dict[str, FeatureDefinition]:
    """
    Parse features.yaml and return a dict of feature name -> FeatureDefinition.

    Only returns features where enabled=true.
    """
    path = Path(yaml_path)
    if not path.exists():
        raise FileNotFoundError(f"Feature registry not found at {path}")

    with open(path) as f:
        raw = yaml.safe_load(f)

    features: dict[str, FeatureDefinition] = {}
    for name, spec in raw.get("features", {}).items():
        if not spec.get("enabled", True):
            continue
        features[name] = FeatureDefinition(
            name=name,
            description=spec.get("description", ""),
            compute_type=spec.get("compute", "lookup"),
            config=spec.get("lookup", spec.get("rolling", spec.get("jsonb", spec.get("derived", {})))),
            enabled=True,
            tier=spec.get("tier", 1),
        )

    logger.info("Loaded %d enabled features from %s", len(features), path.name)
    return features


def get_model_features(
    model_type: str | ModelType,
    yaml_path: str | Path = _DEFAULT_YAML,
) -> list[str]:
    """
    Return the list of feature names used by a specific model type.

    Reads the model_features section of features.yaml.
    """
    path = Path(yaml_path)
    with open(path) as f:
        raw = yaml.safe_load(f)

    model_key = model_type.value if isinstance(model_type, ModelType) else model_type
    feature_names = raw.get("model_features", {}).get(model_key, [])
    logger.debug("Model %s uses %d features", model_key, len(feature_names))
    return feature_names


# ---------------------------------------------------------------------------
# Synthetic data generator (for tests, baselines, and offline work)
# ---------------------------------------------------------------------------

# Sensible ranges per feature name pattern — used to generate realistic synthetic data.
_SYNTHETIC_RANGES: dict[str, tuple[float, float]] = {
    "point_pctg": (0.30, 0.80),
    "win_pct": (0.20, 0.90),
    "goal_diff": (-30.0, 30.0),
    "goals_for": (2.0, 4.5),
    "goals_against": (2.0, 4.0),
    "save_pctg": (0.88, 0.94),
    "pp_pct": (10.0, 35.0),
    "pk_pct": (70.0, 95.0),
    "sog": (25.0, 40.0),
    "rest_advantage": (-2.0, 2.0),
    "back_to_back": (0.0, 1.0),
}


def _range_for_feature(name: str) -> tuple[float, float]:
    """Find the best matching range for a feature name."""
    for pattern, rng in _SYNTHETIC_RANGES.items():
        if pattern in name:
            return rng
    return (0.0, 1.0)


def generate_synthetic_features(
    n: int = 200,
    model_type: str = "game_winner",
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate a DataFrame of synthetic features for a given model type.

    Reads model_features from features.yaml, so adding a feature there
    automatically includes it in synthetic data — no test changes needed.

    Args:
        n: Number of rows.
        model_type: Which model's feature set to generate.
        seed: Random seed for reproducibility.

    Returns:
        DataFrame with n rows and one column per model feature.
    """
    rng = np.random.default_rng(seed)
    feature_names = get_model_features(model_type)

    data: dict[str, np.ndarray] = {}
    for name in feature_names:
        low, high = _range_for_feature(name)
        if "back_to_back" in name:
            data[name] = rng.choice([0.0, 1.0], n, p=[0.8, 0.2])
        elif "rest_advantage" in name:
            data[name] = rng.choice([-1.0, 0.0, 1.0, 2.0], n).astype(float)
        else:
            data[name] = rng.uniform(low, high, n)

    return pd.DataFrame(data)
