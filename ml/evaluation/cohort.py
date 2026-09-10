"""Evaluate only identifiable pregame forecasts against their own game outcomes.

The legacy score table has no model version. Reconstructing from the versioned
prediction rows avoids attributing another version's results to the active model.
"""
import math
from typing import Any

import pandas as pd

from ml.config import ModelType
from ml.evaluation.scoring import _compute_score


def build_version_scores(
    predictions: list[dict[str, Any]], games: list[dict[str, Any]],
    model_type: str, version: str, start_date: str, end_date: str,
) -> pd.DataFrame:
    actuals = {row["id"]: row for row in games}
    scores: dict[int, dict[str, Any]] = {}
    # Last pregame publication per game, never a postgame replacement.
    for row in sorted(predictions, key=lambda r: r.get("predicted_at") or ""):
        if row.get("model_type") != model_type or row.get("model_version") != version:
            continue
        date = row.get("game_date", "")
        actual = actuals.get(row.get("game_id"))
        if not actual or not start_date <= date < end_date or actual.get("game_date") != date:
            continue
        if actual.get("game_type") not in (2, 3) or actual.get("game_state") not in ("OFF", "FINAL"):
            continue
        if row.get("data_quality") != "fresh":
            continue
        published = pd.to_datetime(row.get("predicted_at"), utc=True, errors="coerce")
        puck_drop = pd.to_datetime(actual.get("start_time_utc"), utc=True, errors="coerce")
        if pd.isna(published) or pd.isna(puck_drop) or published >= puck_drop:
            continue
        field = {"game_winner": "home_win_prob", "spread": "predicted_spread", "totals": "predicted_total"}.get(model_type)
        value = row.get(field) if field else None
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            continue
        if model_type == "game_winner" and not 0 <= value <= 1:
            continue
        home, away = actual.get("home_score"), actual.get("away_score")
        if any(not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0 for v in (home, away)) or home == away:
            continue
        score = _compute_score(row, actual, ModelType(model_type))
        if score:
            scores[row["game_id"]] = score
    return pd.DataFrame(scores.values())
