"""
Page 6: Player Props

Per-player lookup for predicted vs actual stats from player_predictions
and player_scores JSONB fields. Shows individual player prediction accuracy.
This page answers: "How well does the model predict individual player performance?"
"""

from datetime import date, timedelta

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data import get_predictions, get_prediction_scores

st.set_page_config(page_title="Player Props — PuckIQ ML", layout="wide")
st.title("Player Props")
st.caption(
    "Look up individual player predictions vs actual results. "
    "Player props are Poisson GLM predictions for goals, assists, and points per player. "
    "Each prediction is stored as a separate row with expected values and player ID."
)

# ---------------------------------------------------------------------------
# Check if player props model is available
# ---------------------------------------------------------------------------
# Check if the player_props model has been trained and promoted to active.
from data import get_active_models
active = get_active_models()
has_player_model = (
    not active.empty
    and (active["model_type"] == "player_props").any()
)
if not has_player_model:
    st.info(
        "**No active player props model.** "
        "The player-level Poisson GLM model needs to be trained via the weekly "
        "retrain pipeline before predictions appear here. "
        "Once trained and promoted, this page will show per-player predicted vs actual stats."
    )
    st.stop()

# ---------------------------------------------------------------------------
# Date range and player search
# ---------------------------------------------------------------------------

col1, col2 = st.columns([1, 2])

with col1:
    default_start = date.today() - timedelta(days=30)
    date_range = st.date_input(
        "Date Range",
        value=(default_start, date.today()),
        help="Select start and end dates to search.",
    )

    if isinstance(date_range, tuple) and len(date_range) == 2:
        start_date, end_date = date_range
    else:
        start_date = date_range if not isinstance(date_range, tuple) else date_range[0]
        end_date = date.today()

with col2:
    player_search = st.text_input(
        "Player Name",
        placeholder="e.g. Connor McDavid, Auston Matthews",
        help="Search for a player by name. Partial matches are supported.",
    )

# ---------------------------------------------------------------------------
# Fetch predictions and scores with player JSONB data
# ---------------------------------------------------------------------------

predictions_df = get_predictions(
    start_date=start_date.isoformat(),
    end_date=end_date.isoformat(),
)

scores_df = get_prediction_scores(
    start_date=start_date.isoformat(),
    end_date=end_date.isoformat(),
)

# ---------------------------------------------------------------------------
# Extract player predictions from JSONB
# ---------------------------------------------------------------------------


def extract_player_predictions(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract player_predictions JSONB from each prediction row into flat rows.

    Handles two formats:
    1. Single dict per row (current pipeline): {"player_id": 123, "expected_goals": 0.8, ...}
    2. List of dicts per row (legacy/alternate): [{"player_name": "...", ...}, ...]
    """
    rows = []
    if df.empty or "player_predictions" not in df.columns:
        return pd.DataFrame()

    for _, row in df.iterrows():
        preds = row.get("player_predictions")
        if not preds:
            continue

        base = {
            "game_id": row.get("game_id"),
            "game_date": row.get("game_date"),
            "model_type": row.get("model_type"),
        }

        if isinstance(preds, dict):
            flat = {**base, **preds}
            rows.append(flat)
        elif isinstance(preds, list):
            for p in preds:
                if isinstance(p, dict):
                    flat = {**base, **p}
                    rows.append(flat)

    return pd.DataFrame(rows)


def extract_player_scores(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract player_scores JSONB from each scored prediction row into flat rows.

    Handles two formats:
    1. Single dict per row: {"player_id": 123, "expected_goals": 0.8, "actual_goals": 1, ...}
    2. List of dicts per row: [{"player_name": "...", ...}, ...]
    """
    rows = []
    if df.empty or "player_scores" not in df.columns:
        return pd.DataFrame()

    for _, row in df.iterrows():
        scores = row.get("player_scores")
        if not scores:
            continue

        base = {
            "game_id": row.get("game_id"),
            "game_date": row.get("game_date"),
            "model_type": row.get("model_type"),
        }

        if isinstance(scores, dict):
            flat = {**base, **scores}
            rows.append(flat)
        elif isinstance(scores, list):
            for s in scores:
                if isinstance(s, dict):
                    flat = {**base, **s}
                    rows.append(flat)

    return pd.DataFrame(rows)


player_preds = extract_player_predictions(predictions_df)
player_scores = extract_player_scores(scores_df)

# ---------------------------------------------------------------------------
# Check for data availability
# ---------------------------------------------------------------------------

has_predictions = not player_preds.empty
has_scores = not player_scores.empty

if not has_predictions and not has_scores:
    st.info(
        "No player prediction data yet — player props will appear after "
        "the pipeline generates predictions with player_predictions JSONB. "
        "This feature requires the player_props model to be active."
    )
    st.stop()

# ---------------------------------------------------------------------------
# Filter by player name
# ---------------------------------------------------------------------------

# Determine the name/id column — might be "player_name", "name", "player", or "player_id"
def find_name_col(df: pd.DataFrame) -> str | None:
    for col in ["player_name", "name", "player", "player_id"]:
        if col in df.columns:
            return col
    return None


if has_predictions:
    pred_name_col = find_name_col(player_preds)
else:
    pred_name_col = None

if has_scores:
    score_name_col = find_name_col(player_scores)
else:
    score_name_col = None

# Get unique player names for suggestions
all_player_names = set()
if pred_name_col and has_predictions:
    all_player_names.update(player_preds[pred_name_col].dropna().unique())
if score_name_col and has_scores:
    all_player_names.update(player_scores[score_name_col].dropna().unique())

if not all_player_names:
    st.info("Player predictions exist but no player names were found in the data.")
    st.stop()

# Apply search filter
if player_search:
    search_lower = player_search.strip().lower()

    if has_predictions and pred_name_col:
        player_preds = player_preds[
            player_preds[pred_name_col]
            .str.lower()
            .str.contains(search_lower, na=False)
        ]

    if has_scores and score_name_col:
        player_scores = player_scores[
            player_scores[score_name_col]
            .str.lower()
            .str.contains(search_lower, na=False)
        ]

    if player_preds.empty and player_scores.empty:
        st.warning(
            f"No results found for '{player_search}'. "
            f"Try a different spelling or check the available players below."
        )

        # Show a sample of available players
        sorted_names = sorted(all_player_names)
        with st.expander("Available Players", expanded=False):
            st.write(", ".join(sorted_names[:50]))
            if len(sorted_names) > 50:
                st.caption(f"...and {len(sorted_names) - 50} more.")
        st.stop()

# ---------------------------------------------------------------------------
# Player scores table — Predicted vs Actual
# ---------------------------------------------------------------------------

if has_scores and not player_scores.empty and score_name_col:
    st.subheader("Predicted vs Actual")

    # Identify stat columns dynamically
    # Handles both naming conventions:
    #   predicted_goals/actual_goals (legacy) and expected_goals/actual_goals (current pipeline)
    stat_types = set()
    for col in player_scores.columns:
        for prefix in ("predicted_", "expected_"):
            if col.startswith(prefix):
                stat_name = col.replace(prefix, "")
                if f"actual_{stat_name}" in player_scores.columns:
                    stat_types.add(stat_name)

    if stat_types:
        # Build display table
        display_rows = []
        for _, row in player_scores.iterrows():
            base = {
                "Date": row.get("game_date", ""),
                "Player": row.get(score_name_col, ""),
                "Game": row.get("game_id", ""),
            }
            for stat in sorted(stat_types):
                # Support both predicted_ and expected_ prefixes
                pred_val = row.get(f"predicted_{stat}")
                if pd.isna(pred_val) if pred_val is not None else True:
                    pred_val = row.get(f"expected_{stat}")
                actual_val = row.get(f"actual_{stat}")
                base[f"Pred {stat.title()}"] = (
                    round(pred_val, 2) if pd.notna(pred_val) else None
                )
                base[f"Actual {stat.title()}"] = (
                    actual_val if pd.notna(actual_val) else None
                )
                if pd.notna(pred_val) and pd.notna(actual_val):
                    base[f"{stat.title()} Error"] = round(
                        abs(pred_val - actual_val), 2
                    )
                else:
                    base[f"{stat.title()} Error"] = None
            display_rows.append(base)

        display_df = pd.DataFrame(display_rows)
        if "Date" in display_df.columns:
            display_df = display_df.sort_values("Date", ascending=False)

        st.dataframe(
            display_df,
            width="stretch",
            hide_index=True,
            height=min(500, len(display_df) * 40 + 40),
        )

        st.caption(
            "Each row is one player-game prediction vs actual result. "
            "**Error** = absolute difference between predicted and actual. "
            "Lower error is better. Look for players where the model consistently "
            "over- or under-predicts — that might indicate missing features "
            "(e.g., line changes, injury status)."
        )

        # ---------------------------------------------------------------
        # MAE summary by player
        # ---------------------------------------------------------------

        st.subheader("MAE by Player")

        if score_name_col in player_scores.columns:
            mae_rows = []
            for player_name, group in player_scores.groupby(score_name_col):
                row_data = {"Player": player_name, "Games": len(group)}
                for stat in sorted(stat_types):
                    # Support both predicted_ and expected_ prefixes
                    pred_col = f"predicted_{stat}" if f"predicted_{stat}" in group.columns else f"expected_{stat}"
                    actual_col = f"actual_{stat}"
                    if (
                        pred_col in group.columns
                        and actual_col in group.columns
                    ):
                        errors = (group[pred_col] - group[actual_col]).abs()
                        errors = errors.dropna()
                        if len(errors) > 0:
                            row_data[f"{stat.title()} MAE"] = round(
                                errors.mean(), 3
                            )
                mae_rows.append(row_data)

            if mae_rows:
                mae_df = pd.DataFrame(mae_rows).sort_values(
                    "Games", ascending=False
                )
                st.dataframe(
                    mae_df,
                    width="stretch",
                    hide_index=True,
                )

                st.caption(
                    "**MAE (Mean Absolute Error)** per player across all their games "
                    "in the selected date range. Lower MAE = better predictions. "
                    "Players with more games give a more reliable MAE estimate. "
                    "If a player's MAE is consistently high, the model may need "
                    "player-specific features (ice time, line combinations, matchups)."
                )

        # ---------------------------------------------------------------
        # MAE trend over time (if enough data)
        # ---------------------------------------------------------------

        if len(player_scores) >= 7:
            st.subheader("MAE Trend Over Time")

            # Pick the first stat type for trending
            primary_stat = sorted(stat_types)[0]
            pred_col = f"predicted_{primary_stat}" if f"predicted_{primary_stat}" in player_scores.columns else f"expected_{primary_stat}"
            actual_col = f"actual_{primary_stat}"

            if pred_col in player_scores.columns and actual_col in player_scores.columns:
                trend_df = player_scores.copy()
                trend_df["abs_error"] = (
                    trend_df[pred_col] - trend_df[actual_col]
                ).abs()
                trend_df = trend_df.dropna(subset=["abs_error", "game_date"])
                trend_df["game_date"] = pd.to_datetime(trend_df["game_date"])

                daily_mae = (
                    trend_df.groupby("game_date")
                    .agg(mae=("abs_error", "mean"), count=("abs_error", "count"))
                    .reset_index()
                    .sort_values("game_date")
                )

                if len(daily_mae) >= 3:
                    daily_mae["rolling_mae"] = (
                        daily_mae["mae"].rolling(window=7, min_periods=1).mean()
                    )

                    fig = go.Figure()
                    fig.add_trace(
                        go.Scatter(
                            x=daily_mae["game_date"],
                            y=daily_mae["mae"],
                            mode="markers",
                            name="Daily MAE",
                            marker=dict(
                                color="#1f77b4", size=6, opacity=0.4
                            ),
                        )
                    )
                    fig.add_trace(
                        go.Scatter(
                            x=daily_mae["game_date"],
                            y=daily_mae["rolling_mae"],
                            mode="lines",
                            name="7-Day Rolling MAE",
                            line=dict(color="#1f77b4", width=3),
                        )
                    )
                    fig.update_layout(
                        xaxis_title="Date",
                        yaxis_title=f"{primary_stat.title()} MAE",
                        template="plotly_dark",
                        height=350,
                        margin=dict(l=50, r=20, t=20, b=50),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=1.02,
                            xanchor="right",
                            x=1,
                        ),
                    )
                    st.plotly_chart(fig, width="stretch")

                    st.caption(
                        f"Rolling 7-day MAE for {primary_stat} predictions. "
                        "A downward trend means the model is improving over time. "
                        "An upward trend could indicate feature drift or changing "
                        "player usage patterns."
                    )
                else:
                    st.info(
                        "Not enough daily data points for a trend chart — "
                        "need at least 3 days of scored player predictions."
                    )
    else:
        # No matched predicted/actual pairs — show raw data
        st.dataframe(
            player_scores,
            width="stretch",
            hide_index=True,
        )
        st.caption(
            "Player scores data is available but doesn't follow the expected "
            "predicted_X / actual_X column pattern. Showing raw data."
        )

elif has_predictions and not player_preds.empty and pred_name_col:
    # Only predictions available, no scores yet
    st.subheader("Predictions (Not Yet Scored)")

    st.info(
        "Player predictions exist but have not been scored yet. "
        "Scores will appear after the games are completed and the scoring pipeline runs."
    )

    # Show predictions table
    display_cols = ["game_date", "game_id", pred_name_col]
    # Add any predicted_ or expected_ columns
    for col in player_preds.columns:
        if col.startswith("predicted_") or col.startswith("expected_"):
            display_cols.append(col)

    display_cols = [c for c in display_cols if c in player_preds.columns]

    if display_cols:
        display_df = player_preds[display_cols].sort_values(
            "game_date", ascending=False
        )
        st.dataframe(
            display_df,
            width="stretch",
            hide_index=True,
            height=min(400, len(display_df) * 40 + 40),
        )

    st.caption(
        "These are pending player predictions. Once the games are played and scored, "
        "you'll be able to compare predicted vs actual values on this page."
    )
else:
    st.info(
        "No player data matches the current filters. "
        "Try adjusting the date range or clearing the player search."
    )

# ---------------------------------------------------------------------------
# Available players reference
# ---------------------------------------------------------------------------

with st.expander("All Available Players", expanded=False):
    sorted_names = sorted(all_player_names)
    if sorted_names:
        # Display in a compact multi-column format
        n_cols = 4
        cols = st.columns(n_cols)
        chunk_size = len(sorted_names) // n_cols + 1
        for i, col in enumerate(cols):
            start = i * chunk_size
            end = start + chunk_size
            with col:
                for name in sorted_names[start:end]:
                    st.text(name)
    else:
        st.info("No player names found in the data.")

    st.caption(
        f"**{len(sorted_names)} players** with predictions in the selected date range. "
        "Type a name in the search box above to filter."
    )
