"""
Page 2: Model Performance

Reliability diagram, confidence breakdown, and baseline comparisons.
This page answers: "How well-calibrated are our probability predictions?"
"""

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data import get_evaluations, get_latest_evaluation

st.set_page_config(page_title="Model Performance — PuckIQ ML", layout="wide")
st.title("Model Performance")
st.caption(
    "Deep dive into model calibration and comparison against baselines. "
    "A well-calibrated model means: when it says 70% chance, the team actually wins ~70% of the time."
)

# ---------------------------------------------------------------------------
# Model type selector
# ---------------------------------------------------------------------------

MODEL_TYPES = ["game_winner", "spread", "totals", "player_props"]

model_type = st.selectbox(
    "Model Type",
    MODEL_TYPES,
    index=0,
    help="Select which prediction model to analyze.",
)

evaluation = get_latest_evaluation(model_type)

if evaluation is None:
    st.info(
        "No evaluation data yet for this model type — "
        "evaluations will appear after the first monthly evaluation run."
    )
    st.stop()

# ---------------------------------------------------------------------------
# Reliability diagram (THE key visualization)
# ---------------------------------------------------------------------------

st.subheader("Reliability Diagram")

calibration_buckets = evaluation.get("calibration_buckets")

if calibration_buckets and isinstance(calibration_buckets, list) and len(calibration_buckets) > 0:
    cal_df = pd.DataFrame(calibration_buckets)

    fig = go.Figure()

    # Perfect calibration line (diagonal)
    fig.add_trace(
        go.Scatter(
            x=[0, 1],
            y=[0, 1],
            mode="lines",
            name="Perfect Calibration",
            line=dict(color="gray", dash="dash", width=2),
        )
    )

    # Actual calibration points
    fig.add_trace(
        go.Scatter(
            x=cal_df["predicted_prob"],
            y=cal_df["actual_prob"],
            mode="lines+markers",
            name="Model Calibration",
            line=dict(color="#1f77b4", width=3),
            marker=dict(size=10),
            text=cal_df.get("count", None),
            hovertemplate=(
                "Predicted: %{x:.0%}<br>"
                "Actual: %{y:.0%}<br>"
                "Games: %{text}<extra></extra>"
            ),
        )
    )

    fig.update_layout(
        xaxis_title="Predicted Probability",
        yaxis_title="Actual Win Rate",
        xaxis_tickformat=".0%",
        yaxis_tickformat=".0%",
        xaxis_range=[0, 1],
        yaxis_range=[0, 1],
        template="plotly_dark",
        height=500,
        margin=dict(l=50, r=20, t=20, b=50),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )

    st.plotly_chart(fig, use_container_width=True)

    st.caption(
        "**How to read this chart:** Each point shows a bucket of predictions grouped by "
        "predicted probability (x-axis) and the actual win rate for those games (y-axis). "
        "If the model is perfectly calibrated, all points would fall on the diagonal dashed line. "
        "Points above the line mean the model is underconfident (actual wins are higher than predicted). "
        "Points below the line mean the model is overconfident. "
        "This is the single most important chart for understanding model quality."
    )
else:
    st.info("No calibration bucket data available for this model type.")

# ---------------------------------------------------------------------------
# Confidence breakdown table
# ---------------------------------------------------------------------------

st.subheader("Accuracy by Confidence Level")

accuracy_by_confidence = evaluation.get("accuracy_by_confidence")

if accuracy_by_confidence and isinstance(accuracy_by_confidence, (list, dict)):
    if isinstance(accuracy_by_confidence, dict):
        # Convert dict format {high: {accuracy, count}, ...} to list
        rows = []
        for level, stats in accuracy_by_confidence.items():
            if isinstance(stats, dict):
                rows.append({"confidence_level": level, **stats})
            else:
                rows.append({"confidence_level": level, "accuracy": stats})
        conf_df = pd.DataFrame(rows)
    else:
        conf_df = pd.DataFrame(accuracy_by_confidence)

    if not conf_df.empty:
        # Format accuracy as percentage
        if "accuracy" in conf_df.columns:
            conf_df["accuracy_display"] = conf_df["accuracy"].apply(
                lambda x: f"{x:.1%}" if pd.notna(x) else "—"
            )

        st.dataframe(conf_df, use_container_width=True, hide_index=True)

        st.caption(
            "**High confidence** predictions (above 65% probability) should have the highest accuracy. "
            "If low-confidence picks are more accurate than high-confidence ones, "
            "the model's confidence calibration needs work. "
            "Ideally, high-confidence accuracy > medium > low."
        )
    else:
        st.info("Confidence breakdown data is empty.")
else:
    st.info("No confidence breakdown data available for this model type.")

# ---------------------------------------------------------------------------
# Baseline comparisons
# ---------------------------------------------------------------------------

st.subheader("Performance vs Baselines")

baseline_data = {
    "Baseline": [],
    "Lift vs Baseline": [],
}

for key, label in [
    ("vs_naive_baseline", "Naive (always pick home)"),
    ("vs_simple_baseline", "Simple (pick better record)"),
    ("vs_rule_based", "Rule-Based (PuckIQ v1 heuristics)"),
]:
    val = evaluation.get(key)
    if val is not None and pd.notna(val):
        baseline_data["Baseline"].append(label)
        baseline_data["Lift vs Baseline"].append(val)

if baseline_data["Baseline"]:
    baseline_df = pd.DataFrame(baseline_data)

    fig = px.bar(
        baseline_df,
        x="Lift vs Baseline",
        y="Baseline",
        orientation="h",
        color="Lift vs Baseline",
        color_continuous_scale=["#d32f2f", "#ffc107", "#4caf50"],
        color_continuous_midpoint=0,
    )
    fig.update_layout(
        xaxis_title="Accuracy Lift (percentage points)",
        yaxis_title="",
        template="plotly_dark",
        height=250,
        margin=dict(l=20, r=20, t=20, b=50),
        showlegend=False,
        coloraxis_showscale=False,
    )
    # Add a zero line
    fig.add_vline(x=0, line_dash="dash", line_color="white", opacity=0.3)

    st.plotly_chart(fig, use_container_width=True)

    st.caption(
        "**Lift** = how many percentage points better the ML model is compared to each baseline. "
        "Positive values (green) mean the model outperforms the baseline. "
        "If any baseline beats our model (negative lift), that's a red flag. "
        "**Naive** = always pick the home team. "
        "**Simple** = always pick the team with the better record. "
        "**Rule-based** = the non-ML heuristic logic from PuckIQ v1."
    )
else:
    st.info("No baseline comparison data available yet.")
