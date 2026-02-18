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
from data import get_active_models, get_evaluations, get_latest_evaluation

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
    # No evaluations yet — show what we have from model metadata instead
    active_models = get_active_models()
    model_row = active_models[active_models["model_type"] == model_type] if not active_models.empty else pd.DataFrame()

    if model_row.empty:
        st.info(
            "No active model or evaluation data for this model type — "
            "data will appear after training and the first monthly evaluation."
        )
        st.stop()

    model = model_row.iloc[0]
    st.subheader("Validation Metrics (from Training)")
    st.info(
        "Full evaluation data (reliability diagrams, baseline comparisons) will appear "
        "after the monthly evaluation pipeline runs. Showing validation metrics from training below."
    )

    metric_col1, metric_col2, metric_col3, metric_col4 = st.columns(4)
    with metric_col1:
        brier = model.get("val_brier_score")
        st.metric("Brier Score", f"{brier:.4f}" if pd.notna(brier) else "N/A")
    with metric_col2:
        acc = model.get("val_accuracy")
        st.metric("Val Accuracy", f"{acc:.1%}" if pd.notna(acc) else "N/A")
    with metric_col3:
        mae = model.get("val_mae")
        st.metric("Val MAE", f"{mae:.3f}" if pd.notna(mae) else "N/A")
    with metric_col4:
        gap = model.get("overfit_gap")
        st.metric("Overfit Gap", f"{gap:.1%}" if pd.notna(gap) else "N/A")

    st.caption(
        "These metrics come from walk-forward cross-validation during the weekly retrain. "
        "**Brier score** measures probability calibration (lower = better, 0.25 = random). "
        "**Val accuracy** is the % of games predicted correctly on held-out validation data. "
        "**Val MAE** is the average prediction error for spread/totals models. "
        "**Overfit gap** = training accuracy minus validation accuracy (lower = healthier)."
    )

    # Show feature importance as a useful visualization while we wait for evaluations
    fi = model.get("feature_importance")
    if fi and isinstance(fi, dict) and len(fi) > 0:
        st.subheader("Feature Importance")
        fi_df = pd.DataFrame([
            {"feature": k, "importance": v}
            for k, v in fi.items()
        ]).sort_values("importance", ascending=True).tail(15)

        fig = px.bar(
            fi_df, x="importance", y="feature", orientation="h",
            color="importance", color_continuous_scale="Blues",
        )
        fig.update_layout(
            xaxis_title="Importance (split gain)", yaxis_title="",
            template="plotly_dark", height=max(400, len(fi_df) * 30),
            margin=dict(l=20, r=20, t=20, b=50),
            showlegend=False, coloraxis_showscale=False,
        )
        st.plotly_chart(fig, width="stretch")

    st.stop()

# ---------------------------------------------------------------------------
# Reliability diagram (THE key visualization)
# ---------------------------------------------------------------------------

st.subheader("Calibration Quality")

# ECE metric — single-number summary of calibration quality
ece_val = evaluation.get("ece")
if ece_val is not None and pd.notna(ece_val):
    ece_col1, ece_col2 = st.columns([1, 3])
    with ece_col1:
        st.metric("ECE", f"{ece_val:.4f}")
    with ece_col2:
        if ece_val < 0.03:
            st.success(
                "**Excellent calibration** — ECE < 0.03. "
                "Predicted probabilities closely match actual outcomes."
            )
        elif ece_val < 0.05:
            st.success(
                "**Good calibration** — ECE < 0.05. "
                "Predicted probabilities are reasonably well-matched to actual outcomes."
            )
        elif ece_val < 0.10:
            st.warning(
                "**Fair calibration** — ECE is between 0.05 and 0.10. "
                "There is noticeable miscalibration; predictions are somewhat off."
            )
        else:
            st.error(
                "**Poor calibration** — ECE exceeds 0.10. "
                "Predicted probabilities don't match actual outcomes well. "
                "Consider Platt scaling or isotonic regression to recalibrate."
            )
    st.caption(
        "**Expected Calibration Error (ECE)** is the weighted average gap between "
        "predicted probabilities and actual outcomes across all buckets. "
        "Lower is better. 0 = perfect calibration. "
        "Typical good models achieve ECE < 0.05."
    )

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
            x=cal_df.get("predicted_avg", cal_df.get("predicted_prob", pd.Series())),
            y=cal_df.get("actual_avg", cal_df.get("actual_prob", pd.Series())),
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

    st.plotly_chart(fig, width="stretch")

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

        st.dataframe(conf_df, width="stretch", hide_index=True)

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

    st.plotly_chart(fig, width="stretch")

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
