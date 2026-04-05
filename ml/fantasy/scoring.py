"""Fantasy scoring format definitions for Yahoo and ESPN platforms."""

from typing import Dict

# Nested dict: format_name -> player_type -> stat -> weight
SCORING_FORMATS: Dict[str, Dict[str, Dict[str, float]]] = {
    "yahoo": {
        "skater": {
            "goals": 3.0,
            "assists": 2.0,
            "plus_minus": 1.0,
            "ppp": 1.0,
            "sog": 0.5,
            "hits": 0.5,
            "blocks": 0.5,
        },
        "goalie": {
            "wins": 5.0,
            "saves": 0.2,
            "goals_against": -1.0,
            "shutouts": 3.0,
        },
    },
    "espn": {
        "skater": {
            "goals": 3.0,
            "assists": 2.0,
            "plus_minus": 1.0,
            "ppp": 1.0,
            "sog": 0.3,
            "hits": 0.3,
            "blocks": 0.5,
        },
        "goalie": {
            "wins": 5.0,
            "saves": 0.2,
            "goals_against": -1.0,
            "shutouts": 3.0,
        },
    },
}


def compute_fantasy_points(
    stats: dict, format_name: str, player_type: str
) -> float:
    """Compute fantasy points as dot product of stats and scoring weights.

    Args:
        stats: Dict of stat_name -> value (e.g. {"goals": 2, "assists": 1}).
        format_name: Scoring format ("yahoo" or "espn").
        player_type: Player type ("skater" or "goalie").

    Returns:
        Total fantasy points. Missing stat keys default to 0.

    Raises:
        ValueError: If format_name or player_type is not recognized.
    """
    if format_name not in SCORING_FORMATS:
        raise ValueError(
            f"Unknown format '{format_name}'. "
            f"Available: {list(SCORING_FORMATS.keys())}"
        )

    format_weights = SCORING_FORMATS[format_name]
    if player_type not in format_weights:
        raise ValueError(
            f"Unknown player_type '{player_type}' for format '{format_name}'. "
            f"Available: {list(format_weights.keys())}"
        )

    weights = format_weights[player_type]
    total = 0.0
    for stat, weight in weights.items():
        total += stats.get(stat, 0) * weight
    return total
