"""
YAML-driven feature registry.

Features are defined in features.yaml with metadata about how to compute them,
which model types use them, and whether they are enabled.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

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
