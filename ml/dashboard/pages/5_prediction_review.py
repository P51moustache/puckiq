"""
Page 5: Prediction Review

Game-by-game results table with filters for correct/incorrect predictions,
confidence levels, model types, and date ranges.
This page answers: "Which specific games did the model get right/wrong, and why?"
"""

from datetime import date, timedelta

import pandas as pd
import streamlit as st

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data import get_prediction_scores, get_predictions

st.set_page_config(page_title="Prediction Review — PuckIQ ML", layout="wide")
st.title("Prediction Review")
st.caption(
    "Browse individual game predictions and their outcomes. "
    "Use the filters to find patterns — for example, are high-confidence picks "
    "consistently correct? Are there specific matchup types the model struggles with?"
)

# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

st.subheader("Filters")

filter_col1, filter_col2, filter_col3, filter_col4 = st.columns(4)

with filter_col1:
    MODEL_TYPES = ["All", "game_winner", "spread", "totals", "player_props"]
    selected_model = st.selectbox(
        "Model Type",
        MODEL_TYPES,
        index=0,
        help="Filter predictions by model type.",
    )

with filter_col2:
    RESULT_FILTERS = ["All", "Correct Only", "Incorrect Only"]
    result_filter = st.selectbox(
        "Result",
        RESULT_FILTERS,
        index=0,
        help="Filter by whether the prediction was correct.",
    )

with filter_col3:
    CONFIDENCE_FILTERS = [
        "All",
        "High (>65%)",
        "Medium (55-65%)",
        "Low (<55%)",
    ]
    confidence_filter = st.selectbox(
        "Confidence",
        CONFIDENCE_FILTERS,
        index=0,
        help="Filter by prediction confidence level.",
    )

with filter_col4:
    default_start = date.today() - timedelta(days=30)
    date_range = st.date_input(
        "Date Range",
        value=(default_start, date.today()),
        help="Select start and end dates.",
    )

# Parse date range — handle single date or tuple
if isinstance(date_range, tuple) and len(date_range) == 2:
    start_date, end_date = date_range
else:
    start_date = date_range if not isinstance(date_range, tuple) else date_range[0]
    end_date = date.today()

# ---------------------------------------------------------------------------
# Fetch data
# ---------------------------------------------------------------------------

model_type_filter = None if selected_model == "All" else selected_model

scores_df = get_prediction_scores(
    start_date=start_date.isoformat(),
    end_date=end_date.isoformat(),
    model_type=model_type_filter,
)

if scores_df.empty:
    st.info(
        "No scored predictions yet for the selected filters — "
        "results will appear after games are completed and scored."
    )
    st.stop()

# Also fetch predictions to get additional context (confidence, home_win_prob)
predictions_df = get_predictions(
    start_date=start_date.isoformat(),
    end_date=end_date.isoformat(),
    model_type=model_type_filter,
)

# ---------------------------------------------------------------------------
# Merge scores with predictions for a richer table
# ---------------------------------------------------------------------------

# Merge on game_id + model_type to get confidence and other prediction fields
if not predictions_df.empty:
    merge_cols = ["game_id", "model_type"]
    # Include player_id in merge key when both tables have it (player_props rows)
    if "player_id" in predictions_df.columns and "player_id" in scores_df.columns:
        merge_cols = ["game_id", "model_type", "player_id"]
    # Select only useful prediction columns to avoid clashes
    pred_extra_cols = []
    for col in ["confidence", "data_quality", "top_factors"]:
        if col in predictions_df.columns and col not in merge_cols:
            pred_extra_cols.append(col)

    if pred_extra_cols:
        pred_merge = predictions_df[merge_cols + pred_extra_cols].drop_duplicates(
            subset=merge_cols
        )
        df = scores_df.merge(pred_merge, on=merge_cols, how="left")
    else:
        df = scores_df.copy()
else:
    df = scores_df.copy()

# ---------------------------------------------------------------------------
# Apply filters
# ---------------------------------------------------------------------------

# Result filter
if result_filter == "Correct Only":
    df = df[df["was_correct"] == True]
elif result_filter == "Incorrect Only":
    df = df[df["was_correct"] == False]

# Confidence filter — use home_win_prob as the confidence proxy
# The confidence is max(home_win_prob, 1 - home_win_prob) since it represents
# how sure the model is regardless of which team it picked
if "home_win_prob" in df.columns:
    df["effective_confidence"] = df["home_win_prob"].apply(
        lambda x: max(x, 1 - x) if pd.notna(x) else None
    )
else:
    df["effective_confidence"] = None

if confidence_filter == "High (>65%)":
    df = df[df["effective_confidence"] > 0.65]
elif confidence_filter == "Medium (55-65%)":
    df = df[
        (df["effective_confidence"] >= 0.55)
        & (df["effective_confidence"] <= 0.65)
    ]
elif confidence_filter == "Low (<55%)":
    df = df[df["effective_confidence"] < 0.55]

if df.empty:
    st.info("No predictions match the selected filters.")
    st.stop()

# ---------------------------------------------------------------------------
# Summary stats
# ---------------------------------------------------------------------------

st.subheader("Summary")

# Only count rows where was_correct is not null (spread/totals don't have it)
has_correct = df["was_correct"].notna() if "was_correct" in df.columns else pd.Series(dtype=bool)
scored_df = df[has_correct] if has_correct.any() else pd.DataFrame()

total_predictions = len(df)
total_scored = len(scored_df)
correct_predictions = scored_df["was_correct"].sum() if not scored_df.empty else 0
accuracy = correct_predictions / total_scored if total_scored > 0 else 0

summary_col1, summary_col2, summary_col3, summary_col4 = st.columns(4)

with summary_col1:
    st.metric("Total Games", total_predictions)

with summary_col2:
    st.metric("Correct", int(correct_predictions))

with summary_col3:
    incorrect = int(total_scored - correct_predictions) if total_scored > 0 else 0
    st.metric("Incorrect", incorrect)

with summary_col4:
    st.metric("Accuracy", f"{accuracy:.1%}" if total_scored > 0 else "N/A")

st.caption(
    "These stats reflect only the filtered results shown below. "
    "Use the filters above to slice by date, model type, confidence, or correctness."
)

# ---------------------------------------------------------------------------
# Spread and totals error stats (if applicable)
# ---------------------------------------------------------------------------

has_spread = "spread_error" in df.columns and df["spread_error"].notna().any()
has_total = "total_error" in df.columns and df["total_error"].notna().any()

if has_spread or has_total:
    st.subheader("Error Metrics")

    error_col1, error_col2 = st.columns(2)

    if has_spread:
        with error_col1:
            mae_spread = df["spread_error"].abs().mean()
            st.metric(
                "Spread MAE",
                f"{mae_spread:.2f} goals",
                help="Mean Absolute Error on predicted spread",
            )

    if has_total:
        with error_col2:
            mae_total = df["total_error"].abs().mean()
            st.metric(
                "Total MAE",
                f"{mae_total:.2f} goals",
                help="Mean Absolute Error on predicted total goals",
            )

    st.caption(
        "**MAE (Mean Absolute Error)** measures how far off the predictions are on average. "
        "For spread: MAE of 1.5 means the predicted margin of victory is off by 1.5 goals on average. "
        "For totals: MAE of 1.0 means the predicted combined score is off by 1 goal on average."
    )

# ---------------------------------------------------------------------------
# Game-by-game table
# ---------------------------------------------------------------------------

st.subheader("Game-by-Game Results")

# Build display columns
display_cols = []
col_config = {}

if "game_date" in df.columns:
    display_cols.append("game_date")
    col_config["game_date"] = st.column_config.TextColumn("Date")

if "game_id" in df.columns:
    display_cols.append("game_id")
    col_config["game_id"] = st.column_config.TextColumn("Game ID")

if "model_type" in df.columns:
    display_cols.append("model_type")
    col_config["model_type"] = st.column_config.TextColumn("Model")

if "predicted_winner" in df.columns:
    display_cols.append("predicted_winner")
    col_config["predicted_winner"] = st.column_config.TextColumn("Predicted")

if "actual_winner" in df.columns:
    display_cols.append("actual_winner")
    col_config["actual_winner"] = st.column_config.TextColumn("Actual")

if "was_correct" in df.columns:
    display_cols.append("was_correct")
    col_config["was_correct"] = st.column_config.CheckboxColumn("Correct?")

if "home_win_prob" in df.columns:
    display_cols.append("home_win_prob")
    col_config["home_win_prob"] = st.column_config.NumberColumn(
        "Home Win Prob", format="%.1%%"
    )

if "effective_confidence" in df.columns:
    display_cols.append("effective_confidence")
    col_config["effective_confidence"] = st.column_config.NumberColumn(
        "Confidence", format="%.1%%"
    )

if "predicted_spread" in df.columns and df["predicted_spread"].notna().any():
    display_cols.append("predicted_spread")
    col_config["predicted_spread"] = st.column_config.NumberColumn(
        "Pred Spread", format="%.1f"
    )

if "actual_spread" in df.columns and df["actual_spread"].notna().any():
    display_cols.append("actual_spread")
    col_config["actual_spread"] = st.column_config.NumberColumn(
        "Actual Spread", format="%.1f"
    )

if "spread_error" in df.columns and df["spread_error"].notna().any():
    display_cols.append("spread_error")
    col_config["spread_error"] = st.column_config.NumberColumn(
        "Spread Error", format="%.1f"
    )

if "confidence" in df.columns and "effective_confidence" not in display_cols:
    display_cols.append("confidence")
    col_config["confidence"] = st.column_config.TextColumn("Confidence Level")

# Filter to only existing columns
display_cols = [c for c in display_cols if c in df.columns]

if display_cols:
    # Sort by date descending
    sort_col = "game_date" if "game_date" in df.columns else display_cols[0]
    display_df = df[display_cols].sort_values(sort_col, ascending=False)

    st.dataframe(
        display_df,
        column_config=col_config,
        width="stretch",
        hide_index=True,
        height=min(600, len(display_df) * 40 + 40),
    )
else:
    st.dataframe(df, width="stretch", hide_index=True)

st.caption(
    "Each row is one game prediction and its outcome. "
    "**Home Win Prob** is the model's predicted probability that the home team wins. "
    "**Confidence** = max(home_win_prob, 1 - home_win_prob) — how sure the model is, "
    "regardless of which team it picked. "
    "Look for patterns: does the model struggle with certain confidence levels? "
    "Are there specific teams it consistently gets wrong?"
)

# ---------------------------------------------------------------------------
# Daily accuracy breakdown
# ---------------------------------------------------------------------------

st.subheader("Daily Accuracy Breakdown")

if "game_date" in df.columns and "was_correct" in df.columns:
    daily = (
        df.groupby("game_date")
        .agg(
            total=("was_correct", "count"),
            correct=("was_correct", "sum"),
        )
        .reset_index()
    )
    daily["accuracy"] = daily["correct"] / daily["total"]
    daily["accuracy_display"] = daily["accuracy"].apply(lambda x: f"{x:.0%}")
    daily["record"] = daily.apply(
        lambda row: f"{int(row['correct'])}/{int(row['total'])}", axis=1
    )

    daily = daily.sort_values("game_date", ascending=False)

    st.dataframe(
        daily[["game_date", "record", "accuracy_display"]].rename(
            columns={
                "game_date": "Date",
                "record": "Record (Correct/Total)",
                "accuracy_display": "Accuracy",
            }
        ),
        width="stretch",
        hide_index=True,
        height=min(400, len(daily) * 40 + 40),
    )

    st.caption(
        "Daily record for the filtered predictions. "
        "Look for streaks of bad days — they might correspond to unusual events "
        "(trade deadline, all-star break, back-to-back heavy nights)."
    )
