"""Start/Sit recommendation engine for fantasy hockey.

Combines fantasy point projections with contextual factors (trend, matchup,
back-to-back) to produce lineup recommendations.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TREND_BONUS: dict[str, float] = {
    "HOT": 0.2,
    "WARM": 0.1,
    "STEADY": 0.0,
    "COOL": -0.1,
    "COLD": -0.2,
}

B2B_PENALTY = -0.25

# Component weights
W_PROJECTION = 0.4
W_FLOOR = 0.2
W_MATCHUP = 0.2

# Recommendation thresholds
THRESHOLD_START = 0.6
THRESHOLD_UPSIDE_MIN = 0.4
THRESHOLD_FLEX = 0.35
UPSIDE_SPREAD = 5.0  # ceiling - floor must exceed this

# Confidence bands (distance from 0.5)
CONFIDENCE_HIGH = 0.2
CONFIDENCE_MEDIUM = 0.1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compute_start_sit(player: dict) -> dict:
    """Compute a start/sit recommendation for *player*.

    Parameters
    ----------
    player : dict
        Must contain ``fantasy_points`` (float).  Optional keys:
        ``floor`` (float, default 0), ``ceiling`` (float, default fantasy_points),
        ``is_b2b`` (bool, default False), ``trend`` (str, default 'STEADY'),
        ``opponent_rank`` (int 1-32, default 16).

    Returns
    -------
    dict with keys ``recommendation``, ``confidence``, ``score``, ``reason``.
    """

    fantasy_points: float = player["fantasy_points"]
    floor: float = player.get("floor", 0.0)
    ceiling: float = player.get("ceiling", fantasy_points)
    is_b2b: bool = player.get("is_b2b", False)
    trend: str = player.get("trend", "STEADY")
    opponent_rank: int = player.get("opponent_rank", 16)

    # --- component scores ---
    projection_score = min(fantasy_points / 5.0, 1.0)
    floor_score = min(floor / 3.0, 1.0)
    matchup_score = opponent_rank / 32.0

    total = (
        W_PROJECTION * projection_score
        + W_FLOOR * floor_score
        + W_MATCHUP * matchup_score
        + TREND_BONUS.get(trend, 0.0)
        + (B2B_PENALTY if is_b2b else 0.0)
    )

    # Clamp to [0, 1]
    total = max(0.0, min(1.0, total))

    # --- recommendation ---
    spread = ceiling - floor
    if total >= THRESHOLD_START:
        recommendation = "START"
    elif total >= THRESHOLD_UPSIDE_MIN and spread > UPSIDE_SPREAD:
        recommendation = "UPSIDE"
    elif total >= THRESHOLD_FLEX:
        recommendation = "FLEX"
    else:
        recommendation = "SIT"

    # --- confidence ---
    distance = abs(total - 0.5)
    if distance > CONFIDENCE_HIGH:
        confidence = "high"
    elif distance > CONFIDENCE_MEDIUM:
        confidence = "medium"
    else:
        confidence = "low"

    # --- reason ---
    reason = _build_reason(trend, is_b2b, opponent_rank, spread)

    return {
        "recommendation": recommendation,
        "confidence": confidence,
        "score": round(total, 4),
        "reason": reason,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_reason(
    trend: str, is_b2b: bool, opponent_rank: int, spread: float
) -> str:
    parts: list[str] = []

    if trend in ("HOT", "WARM"):
        parts.append(f"trending {trend.lower()}")
    elif trend in ("COOL", "COLD"):
        parts.append(f"trending {trend.lower()}")

    if is_b2b:
        parts.append("back-to-back")

    if opponent_rank >= 24:
        parts.append("soft matchup")
    elif opponent_rank <= 8:
        parts.append("tough matchup")

    if spread > UPSIDE_SPREAD:
        parts.append("high ceiling spread")

    if not parts:
        return "average matchup, steady form"

    return ", ".join(parts).capitalize()
