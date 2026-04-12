"""Fantasy points projection layer with floor/ceiling ranges."""

import pandas as pd

from ml.fantasy.scoring import compute_fantasy_points

# Standard deviation values for each stat, used for floor/ceiling calculation
STAT_VARIANCE: dict[str, float] = {
    # Skater stats
    "goals": 0.5,
    "assists": 0.6,
    "sog": 1.5,
    "hits": 1.0,
    "blocks": 0.8,
    "ppp": 0.3,
    "plus_minus": 1.0,
    # Goalie stats
    "wins": 0.3,
    "saves": 5.0,
    "goals_against": 1.0,
    "shutouts": 0.1,
}

# Mapping from prediction column names to stat names used in scoring
_SKATER_PRED_COLS = {
    "pred_goals": "goals",
    "pred_assists": "assists",
    "pred_sog": "sog",
    "pred_hits": "hits",
    "pred_blocks": "blocks",
    "pred_ppp": "ppp",
    "pred_plus_minus": "plus_minus",
}

_GOALIE_PRED_COLS = {
    "pred_wins": "wins",
    "pred_saves": "saves",
    "pred_goals_against": "goals_against",
    "pred_shutouts": "shutouts",
}


def _extract_stats(row: pd.Series, col_map: dict[str, str]) -> dict[str, float]:
    """Extract stat values from a row using the column mapping."""
    return {
        stat_name: row[pred_col]
        for pred_col, stat_name in col_map.items()
        if pred_col in row.index
    }


def _apply_variance(
    stats: dict[str, float], direction: int
) -> dict[str, float]:
    """Apply variance to stats. direction: -1 for floor, +1 for ceiling.

    Floor values are clamped to 0 minimum (except plus_minus which can be negative).
    """
    adjusted = {}
    for stat, value in stats.items():
        variance = STAT_VARIANCE.get(stat, 0.0)
        new_val = value + direction * variance
        # Clamp floor to 0 for all stats except plus_minus
        if direction == -1 and stat != "plus_minus":
            new_val = max(0.0, new_val)
        adjusted[stat] = new_val
    return adjusted


def project_fantasy_points(
    predictions: pd.DataFrame, format_name: str
) -> pd.DataFrame:
    """Convert raw stat predictions into fantasy point projections with floor/ceiling.

    Args:
        predictions: DataFrame with columns player_id, position, and pred_* stat columns.
        format_name: Scoring format ("yahoo" or "espn").

    Returns:
        DataFrame with columns: player_id, fantasy_points, floor, ceiling, format.
    """
    results = []

    for _, row in predictions.iterrows():
        position = row["position"]
        is_goalie = position == "G"
        player_type = "goalie" if is_goalie else "skater"
        col_map = _GOALIE_PRED_COLS if is_goalie else _SKATER_PRED_COLS

        stats = _extract_stats(row, col_map)
        floor_stats = _apply_variance(stats, direction=-1)
        ceiling_stats = _apply_variance(stats, direction=+1)

        fp = compute_fantasy_points(stats, format_name, player_type)
        floor = compute_fantasy_points(floor_stats, format_name, player_type)
        ceiling = compute_fantasy_points(ceiling_stats, format_name, player_type)

        results.append(
            {
                "player_id": row["player_id"],
                "fantasy_points": round(fp, 2),
                "floor": round(floor, 2),
                "ceiling": round(ceiling, 2),
                "format": format_name,
            }
        )

    return pd.DataFrame(results)
