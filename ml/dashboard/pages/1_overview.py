"""
Page 1: Overview

KPI cards, accuracy trend, overfitting alert, and model version history.
This is the landing page — a quick health check of the entire ML pipeline.
"""

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# Adjust import path — Streamlit pages run from the dashboard/ directory
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data import get_active_models, get_model_metadata, get_scores_last_n_days, OVERFITTING_THRESHOLDS

st.set_page_config(page_title="Overview — PuckIQ ML", layout="wide")
st.title("Overview")
st.caption(
    "High-level health check of the ML pipeline. "
    "KPIs come from the active model metadata; the accuracy trend "
    "is computed from scored predictions over the last 90 days."
)

# ---------------------------------------------------------------------------
# Active model KPIs
# ---------------------------------------------------------------------------

active_models = get_active_models()

if active_models.empty:
    st.info("No active models yet — predictions will appear after the first daily pipeline run.")
    st.stop()

# Use the game_winner model as the primary KPI source (most important model)
primary = active_models[active_models["model_type"] == "game_winner"]
if primary.empty:
    primary = active_models.iloc[[0]]  # Fallback to first active model
primary = primary.iloc[0]

# Compute delta vs prior version for Brier score
all_metadata = get_model_metadata(limit=50)
prior_versions = all_metadata[
    (all_metadata["model_type"] == primary["model_type"])
    & (all_metadata["model_version"] != primary["model_version"])
]
brier_delta = None
if not prior_versions.empty and pd.notna(primary.get("val_brier_score")):
    prior_brier = prior_versions.iloc[0].get("val_brier_score")
    if pd.notna(prior_brier):
        # Negative delta = improvement (lower Brier is better)
        brier_delta = round(primary["val_brier_score"] - prior_brier, 4)

# KPI row
col1, col2, col3, col4 = st.columns(4)

with col1:
    brier = primary.get("val_brier_score")
    st.metric(
        label="Brier Score",
        value=f"{brier:.4f}" if pd.notna(brier) else "N/A",
        delta=f"{brier_delta:+.4f}" if brier_delta is not None else None,
        delta_color="inverse",  # Lower Brier is better, so negative = green
    )

with col2:
    acc_7d = primary.get("prod_accuracy_7d")
    if pd.notna(acc_7d):
        st.metric(label="7-Day Accuracy", value=f"{acc_7d:.1%}")
    else:
        # Fall back to validation accuracy when no production scores exist yet
        val_acc = primary.get("val_accuracy")
        st.metric(
            label="Val Accuracy",
            value=f"{val_acc:.1%}" if pd.notna(val_acc) else "N/A",
            help="Validation accuracy from training (production accuracy appears after games are scored)",
        )

with col3:
    acc_30d = primary.get("prod_accuracy_30d")
    if pd.notna(acc_30d):
        st.metric(label="30-Day Accuracy", value=f"{acc_30d:.1%}")
    else:
        val_mae = primary.get("val_mae")
        st.metric(
            label="Val MAE",
            value=f"{val_mae:.3f}" if pd.notna(val_mae) else "N/A",
            help="Validation MAE from training (production metrics appear after games are scored)",
        )

with col4:
    acc_season = primary.get("prod_accuracy_season")
    if pd.notna(acc_season):
        st.metric(label="Season Accuracy", value=f"{acc_season:.1%}")
    else:
        training_games = primary.get("training_games")
        st.metric(
            label="Training Games",
            value=f"{int(training_games):,}" if pd.notna(training_games) else "N/A",
            help="Number of games used to train the active model",
        )

st.caption(
    "**Brier Score** measures how well-calibrated the probabilities are "
    "(0 = perfect, 0.25 = random guessing). Lower is better. "
    "The delta shows change vs the prior model version. "
    "**Val Accuracy / Val MAE** are from walk-forward cross-validation during training — "
    "these will be replaced by live production accuracy once the daily pipeline scores predictions."
)

# ---------------------------------------------------------------------------
# Overfitting alert
# ---------------------------------------------------------------------------

overfit_gap = primary.get("overfit_gap")
accuracy_threshold = OVERFITTING_THRESHOLDS.get("accuracy", 0.05)
watch_threshold = accuracy_threshold * 0.6  # 60% of the danger threshold
if pd.notna(overfit_gap) and overfit_gap > accuracy_threshold:
    st.error(
        f"**Overfitting Alert**: The active model's train-validation gap is "
        f"{overfit_gap:.1%} (threshold: {accuracy_threshold:.1%}). "
        f"The model may be memorizing training data instead of learning generalizable patterns. "
        f"Consider reducing model complexity or increasing regularization."
    )
elif pd.notna(overfit_gap) and overfit_gap > watch_threshold:
    st.warning(
        f"**Overfitting Watch**: Train-validation gap is {overfit_gap:.1%}. "
        f"Not yet critical, but approaching the {accuracy_threshold:.1%} threshold."
    )

# ---------------------------------------------------------------------------
# All active models summary
# ---------------------------------------------------------------------------

st.subheader("Active Models")

if len(active_models) > 1:
    summary_rows = []
    for _, m in active_models.iterrows():
        row = {
            "Model": m.get("model_type", ""),
            "Version": m.get("model_version", ""),
            "Games": int(m["training_games"]) if pd.notna(m.get("training_games")) else None,
        }
        # Show primary metric per model type
        if m.get("model_type") == "game_winner":
            brier_val = m.get("val_brier_score")
            acc_val = m.get("val_accuracy")
            row["Primary Metric"] = f"Brier: {brier_val:.4f}" if pd.notna(brier_val) else "—"
            row["Secondary"] = f"Acc: {acc_val:.1%}" if pd.notna(acc_val) else "—"
        else:
            mae_val = m.get("val_mae")
            rmse_val = m.get("val_rmse")
            row["Primary Metric"] = f"MAE: {mae_val:.3f}" if pd.notna(mae_val) else "—"
            row["Secondary"] = f"RMSE: {rmse_val:.3f}" if pd.notna(rmse_val) else "—"
        gap = m.get("overfit_gap")
        row["Overfit Gap"] = f"{gap:.1%}" if pd.notna(gap) else "—"
        summary_rows.append(row)

    st.dataframe(pd.DataFrame(summary_rows), use_container_width=True, hide_index=True)
    st.caption(
        "Summary of all active models. **Primary Metric** is Brier score for game_winner "
        "(lower = better) and MAE for spread/totals/player_props (lower = better)."
    )
else:
    st.info("Only one active model — additional models will appear here after training.")

# ---------------------------------------------------------------------------
# Accuracy trend (rolling 7-day)
# ---------------------------------------------------------------------------

st.subheader("Accuracy Trend (Rolling 7-Day)")

scores = get_scores_last_n_days(days=90)

if scores.empty:
    st.info("No scored predictions yet — results will appear after games are completed and scored.")
else:
    # Filter to game_winner model type for the accuracy trend
    gw_scores = scores[scores["model_type"] == "game_winner"].copy()

    if gw_scores.empty:
        st.info("No game_winner prediction scores found in the last 90 days.")
    else:
        gw_scores["game_date"] = pd.to_datetime(gw_scores["game_date"])
        gw_scores = gw_scores.sort_values("game_date")

        # Daily accuracy
        daily = (
            gw_scores.groupby("game_date")
            .agg(correct=("was_correct", "sum"), total=("was_correct", "count"))
            .reset_index()
        )
        daily["accuracy"] = daily["correct"] / daily["total"]

        # Rolling 7-day average
        daily["rolling_7d"] = daily["accuracy"].rolling(window=7, min_periods=1).mean()

        fig = go.Figure()
        fig.add_trace(
            go.Scatter(
                x=daily["game_date"],
                y=daily["accuracy"],
                mode="markers",
                name="Daily",
                marker=dict(color="#1f77b4", size=5, opacity=0.4),
            )
        )
        fig.add_trace(
            go.Scatter(
                x=daily["game_date"],
                y=daily["rolling_7d"],
                mode="lines",
                name="7-Day Rolling Avg",
                line=dict(color="#1f77b4", width=3),
            )
        )
        # 50% baseline
        fig.add_hline(
            y=0.5,
            line_dash="dash",
            line_color="red",
            opacity=0.5,
            annotation_text="Random (50%)",
        )
        fig.update_layout(
            yaxis_title="Accuracy",
            xaxis_title="Date",
            yaxis_tickformat=".0%",
            yaxis_range=[0.3, 0.8],
            template="plotly_dark",
            height=400,
            margin=dict(l=50, r=20, t=20, b=50),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig, use_container_width=True)

        st.caption(
            "Each dot is one day's accuracy (games correct / total games). "
            "The blue line is the 7-day rolling average, which smooths out day-to-day variance. "
            "If the rolling average drops below 50%, the model is performing worse than a coin flip."
        )

# ---------------------------------------------------------------------------
# Model versions table
# ---------------------------------------------------------------------------

st.subheader("Recent Model Versions")

model_table = all_metadata.head(10)

if model_table.empty:
    st.info("No model versions recorded yet.")
else:
    display_cols = [
        "model_type", "model_version", "training_games",
        "val_brier_score", "val_accuracy", "train_accuracy",
        "overfit_gap", "is_active", "created_at",
    ]
    # Only show columns that exist in the data
    available_cols = [c for c in display_cols if c in model_table.columns]
    display_df = model_table[available_cols].copy()

    # Format percentages
    for col in ["val_accuracy", "train_accuracy", "overfit_gap"]:
        if col in display_df.columns:
            display_df[col] = display_df[col].apply(
                lambda x: f"{x:.1%}" if pd.notna(x) else "—"
            )
    for col in ["val_brier_score"]:
        if col in display_df.columns:
            display_df[col] = display_df[col].apply(
                lambda x: f"{x:.4f}" if pd.notna(x) else "—"
            )

    st.dataframe(display_df, use_container_width=True, hide_index=True)

    st.caption(
        "Each row is a model version. **is_active = True** means it is the model "
        "currently serving predictions. **overfit_gap** = train_accuracy - val_accuracy. "
        "A healthy gap is under 3%."
    )
