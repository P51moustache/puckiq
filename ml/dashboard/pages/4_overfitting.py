"""
Page 4: Overfitting Monitor

Train/val gap trend, alert zones, and model version history.
This page answers: "Is the model memorizing training data instead of learning?"

Overfitting happens when a model performs great on training data but poorly on
unseen data. The key indicator is the gap between training accuracy and
validation accuracy. A large gap means the model has "memorized" the training
set rather than learning generalizable patterns.
"""

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data import get_active_models, get_model_metadata_by_type, get_latest_evaluation

st.set_page_config(page_title="Overfitting Monitor — PuckIQ ML", layout="wide")
st.title("Overfitting Monitor")
st.caption(
    "Track the gap between training and validation accuracy over time. "
    "A growing gap is a sign that the model is memorizing training data "
    "instead of learning patterns that generalize to new games."
)

# ---------------------------------------------------------------------------
# Model type selector
# ---------------------------------------------------------------------------

MODEL_TYPES = ["game_winner", "spread", "totals"]

model_type = st.selectbox(
    "Model Type",
    MODEL_TYPES,
    index=0,
    help="Select which prediction model to monitor for overfitting.",
)

# ---------------------------------------------------------------------------
# Current gap indicator
# ---------------------------------------------------------------------------

st.subheader("Current Overfit Gap")

active_models = get_active_models()

if active_models.empty:
    st.info(
        "No active models yet — overfitting data will appear "
        "after the first model training run."
    )
    st.stop()

model_row = active_models[active_models["model_type"] == model_type]
if model_row.empty:
    st.info(f"No active model found for type '{model_type}'.")
    st.stop()

model = model_row.iloc[0]
overfit_gap = model.get("overfit_gap")

# Import per-metric thresholds from the ML config
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), ".."))
from ml.config import OVERFITTING_THRESHOLDS

accuracy_threshold = OVERFITTING_THRESHOLDS.get("accuracy", 0.05)
watch_threshold = accuracy_threshold * 0.6  # 60% of the danger threshold

col1, col2, col3 = st.columns([1, 2, 2])

with col1:
    if pd.notna(overfit_gap):
        st.metric("Overfit Gap", f"{overfit_gap:.1%}")
    else:
        st.metric("Overfit Gap", "N/A")

with col2:
    if pd.notna(overfit_gap):
        if overfit_gap < watch_threshold:
            st.success(
                f"**Healthy** — The gap between training and validation accuracy "
                f"is under {watch_threshold:.0%}. The model is generalizing well."
            )
        elif overfit_gap < accuracy_threshold:
            st.warning(
                f"**Watch** — The gap is between {watch_threshold:.0%} and "
                f"{accuracy_threshold:.0%}. Not critical yet, "
                f"but worth monitoring. Consider adding regularization if it grows."
            )
        else:
            st.error(
                f"**Overfitting Detected** — The gap exceeds {accuracy_threshold:.0%}. "
                f"The model is performing significantly better on training data than "
                f"on unseen data. Action needed: increase regularization, reduce model "
                f"complexity, or add more training data."
            )
    else:
        st.info("No overfit gap data available for the active model.")

with col3:
    train_acc = model.get("train_accuracy")
    val_acc = model.get("val_accuracy")
    if pd.notna(train_acc) and pd.notna(val_acc):
        st.metric("Train Accuracy", f"{train_acc:.1%}")
        st.metric("Val Accuracy", f"{val_acc:.1%}")
    else:
        st.info("Train/val accuracy not available.")

st.caption(
    f"**Overfit gap** = training accuracy minus validation accuracy. "
    f"Training accuracy is measured on data the model has already seen. "
    f"Validation accuracy is measured on held-out data the model has never seen. "
    f"The gap tells you how much accuracy is 'fake' — only applicable to known data. "
    f"Green (<{watch_threshold:.0%}): Healthy. "
    f"Yellow ({watch_threshold:.0%}-{accuracy_threshold:.0%}): Watch. "
    f"Red (>{accuracy_threshold:.0%}): Take action."
)

# ---------------------------------------------------------------------------
# Per-metric overfit gaps (new: shows all metrics, not just accuracy)
# ---------------------------------------------------------------------------

st.subheader("Per-Metric Overfit Gaps")

evaluation = get_latest_evaluation(model_type)

per_metric_gaps = evaluation.get("per_metric_gaps") if evaluation else None

if per_metric_gaps and isinstance(per_metric_gaps, dict) and len(per_metric_gaps) > 0:
    gap_rows = []
    for metric, gap_val in per_metric_gaps.items():
        t = OVERFITTING_THRESHOLDS.get(metric, accuracy_threshold)
        if gap_val is not None:
            status = "Overfitting" if gap_val > t else ("Watch" if gap_val > t * 0.6 else "Healthy")
            gap_rows.append({
                "Metric": metric,
                "Gap": f"{gap_val:.4f}",
                "Threshold": f"{t:.4f}",
                "Status": status,
            })

    if gap_rows:
        st.dataframe(pd.DataFrame(gap_rows), use_container_width=True, hide_index=True)
        st.caption(
            "Per-metric gaps use different thresholds because metrics have different scales. "
            "Accuracy and Brier are 0-1, so a 0.05 gap is meaningful. "
            "MAE is in goal units, so the threshold is 0.50 (half a goal)."
        )
    else:
        st.info("No per-metric gap data available.")
else:
    st.info(
        "Per-metric overfit gaps will appear after the next monthly evaluation. "
        "The single accuracy gap is shown above from model metadata."
    )

# ---------------------------------------------------------------------------
# Train/val gap trend over time
# ---------------------------------------------------------------------------

st.subheader("Train/Val Gap Trend")

evaluation = get_latest_evaluation(model_type)

if evaluation is not None:
    gap_history = evaluation.get("train_val_gap_history")

    if gap_history and isinstance(gap_history, list) and len(gap_history) > 0:
        gap_df = pd.DataFrame(gap_history)

        # Expect columns like {date, gap} or {version, gap} or {timestamp, train_val_gap}
        # Normalize column names
        date_col = None
        gap_col = None
        for col in gap_df.columns:
            if col in ("date", "timestamp", "evaluation_date", "created_at"):
                date_col = col
            if col in ("gap", "train_val_gap", "overfit_gap"):
                gap_col = col

        if date_col and gap_col:
            gap_df[date_col] = pd.to_datetime(gap_df[date_col])
            gap_df = gap_df.sort_values(date_col)

            fig = go.Figure()

            # Alert zone (red shading above 5%)
            fig.add_hrect(
                y0=0.05,
                y1=gap_df[gap_col].max() * 1.2 if gap_df[gap_col].max() > 0.05 else 0.10,
                fillcolor="red",
                opacity=0.1,
                line_width=0,
                annotation_text="Overfitting Zone",
                annotation_position="top left",
            )

            # Warning zone (yellow shading 3-5%)
            fig.add_hrect(
                y0=0.03,
                y1=0.05,
                fillcolor="yellow",
                opacity=0.08,
                line_width=0,
            )

            # Gap trend line
            fig.add_trace(
                go.Scatter(
                    x=gap_df[date_col],
                    y=gap_df[gap_col],
                    mode="lines+markers",
                    name="Train-Val Gap",
                    line=dict(color="#1f77b4", width=3),
                    marker=dict(size=8),
                )
            )

            # Threshold lines
            fig.add_hline(
                y=0.05,
                line_dash="dash",
                line_color="red",
                opacity=0.7,
                annotation_text="Danger (5%)",
            )
            fig.add_hline(
                y=0.03,
                line_dash="dash",
                line_color="#ffc107",
                opacity=0.7,
                annotation_text="Watch (3%)",
            )

            fig.update_layout(
                xaxis_title="Date",
                yaxis_title="Train-Val Gap",
                yaxis_tickformat=".1%",
                yaxis_range=[0, max(0.10, gap_df[gap_col].max() * 1.3)],
                template="plotly_dark",
                height=450,
                margin=dict(l=50, r=20, t=20, b=50),
                legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=1.02,
                    xanchor="right",
                    x=1,
                ),
            )

            st.plotly_chart(fig, use_container_width=True)

            st.caption(
                "This chart shows how the train-validation gap has changed over time. "
                "The **red zone** (above 5%) indicates overfitting. "
                "The **yellow zone** (3-5%) is a warning area. "
                "A healthy model stays in the white zone below 3%. "
                "If the gap is trending upward, the model is increasingly memorizing "
                "training data with each version — a sign to add regularization or simplify."
            )
        else:
            st.warning(
                f"Gap history data has unexpected format. "
                f"Columns found: {list(gap_df.columns)}. "
                f"Expected a date column and a gap column."
            )
    else:
        st.info(
            "No train/val gap history available — "
            "this data accumulates after multiple evaluation cycles."
        )
else:
    st.info(
        "No evaluation data available yet for this model type — "
        "evaluations run monthly after enough predictions are scored."
    )

# ---------------------------------------------------------------------------
# Concept drift detection
# ---------------------------------------------------------------------------

st.subheader("Concept Drift")

if evaluation is not None:
    # Show concept drift info from the gap history analysis
    gap_history = evaluation.get("train_val_gap_history")
    if gap_history and isinstance(gap_history, list) and len(gap_history) >= 3:
        # Check for drift by looking at version-over-version gap trends
        gaps_over_time = [
            entry.get("gaps", {}).get("accuracy", entry.get("gap"))
            for entry in gap_history
            if entry.get("gaps", {}).get("accuracy") is not None or entry.get("gap") is not None
        ]

        if len(gaps_over_time) >= 3:
            # Count consecutive increases (worsening gaps)
            increases = sum(
                1 for i in range(1, len(gaps_over_time))
                if gaps_over_time[i] is not None and gaps_over_time[i - 1] is not None
                and gaps_over_time[i] > gaps_over_time[i - 1]
            )
            pairs = sum(
                1 for i in range(1, len(gaps_over_time))
                if gaps_over_time[i] is not None and gaps_over_time[i - 1] is not None
            )
            increase_rate = increases / pairs if pairs > 0 else 0

            avg_gap = sum(g for g in gaps_over_time if g is not None) / len([g for g in gaps_over_time if g is not None])
            last_gap = gaps_over_time[-1] if gaps_over_time[-1] is not None else 0

            drift_col1, drift_col2 = st.columns([1, 3])
            with drift_col1:
                st.metric("Gap Trend", f"{increase_rate:.0%} worsening")
            with drift_col2:
                if increase_rate >= 0.75:
                    st.error(
                        "**Concept drift likely** — The overfit gap has been increasing "
                        "in 75%+ of recent model versions. The data distribution may be "
                        "shifting (e.g., mid-season trades, injuries, schedule changes). "
                        "Consider retraining with more recent data or adjusting features."
                    )
                elif increase_rate >= 0.50:
                    st.warning(
                        "**Possible concept drift** — The overfit gap has been increasing "
                        "in more than half of recent versions. Worth monitoring."
                    )
                else:
                    st.success(
                        "**No drift detected** — The overfit gap is not consistently "
                        "increasing across model versions. The model appears stable."
                    )

            st.caption(
                "**Concept drift** occurs when the underlying patterns in the data change over time. "
                "In hockey, this can happen due to mid-season trades, injuries, coaching changes, "
                "or schedule changes. If the gap is consistently growing version over version, "
                "the model trained on older data is becoming less applicable to current games."
            )
        else:
            st.info("Not enough gap data points for concept drift analysis (need at least 3 model versions).")
    else:
        st.info("Concept drift analysis requires at least 3 model versions with gap history.")
else:
    st.info("No evaluation data available — concept drift analysis will appear after the monthly evaluation.")

# ---------------------------------------------------------------------------
# Model version history table
# ---------------------------------------------------------------------------

st.subheader("Model Version History")

all_versions = get_model_metadata_by_type(model_type)

if all_versions.empty:
    st.info("No model versions recorded for this model type.")
else:
    display_cols = [
        "model_version",
        "training_games",
        "train_accuracy",
        "val_accuracy",
        "overfit_gap",
        "val_brier_score",
        "is_active",
        "created_at",
    ]
    # Only show columns that exist
    available_cols = [c for c in display_cols if c in all_versions.columns]
    display_df = all_versions[available_cols].copy()

    # Format percentages
    for col in ["train_accuracy", "val_accuracy", "overfit_gap"]:
        if col in display_df.columns:
            display_df[col] = display_df[col].apply(
                lambda x: f"{x:.1%}" if pd.notna(x) else "\u2014"
            )

    # Format Brier score
    if "val_brier_score" in display_df.columns:
        display_df["val_brier_score"] = display_df["val_brier_score"].apply(
            lambda x: f"{x:.4f}" if pd.notna(x) else "\u2014"
        )

    # Format timestamp
    if "created_at" in display_df.columns:
        display_df["created_at"] = pd.to_datetime(display_df["created_at"]).dt.strftime(
            "%Y-%m-%d %H:%M"
        )

    st.dataframe(display_df, use_container_width=True, hide_index=True)

    st.caption(
        "Each row is a trained model version. The **overfit_gap** column is the key metric — "
        "it shows how much the model's training accuracy exceeds its validation accuracy. "
        "Compare the gaps across versions: if the gap is growing version over version, "
        "the model architecture or hyperparameters may need adjustment. "
        "The **is_active** column shows which version is currently serving live predictions."
    )

# ---------------------------------------------------------------------------
# Overfit gap comparison across model types
# ---------------------------------------------------------------------------

st.subheader("Overfit Gap by Model Type")

if not active_models.empty and "overfit_gap" in active_models.columns:
    gap_data = active_models[["model_type", "overfit_gap"]].copy()
    gap_data = gap_data.dropna(subset=["overfit_gap"])

    if not gap_data.empty:
        # Color-code bars by severity using config thresholds
        def gap_color(val):
            if val < watch_threshold:
                return "#4caf50"  # green
            elif val < accuracy_threshold:
                return "#ffc107"  # yellow
            else:
                return "#d32f2f"  # red

        gap_data["color"] = gap_data["overfit_gap"].apply(gap_color)

        fig = go.Figure()
        fig.add_trace(
            go.Bar(
                x=gap_data["model_type"],
                y=gap_data["overfit_gap"],
                marker_color=gap_data["color"],
                text=gap_data["overfit_gap"].apply(lambda x: f"{x:.1%}"),
                textposition="auto",
            )
        )

        fig.add_hline(
            y=accuracy_threshold,
            line_dash="dash",
            line_color="red",
            opacity=0.7,
            annotation_text="Danger threshold",
        )
        fig.add_hline(
            y=watch_threshold,
            line_dash="dash",
            line_color="#ffc107",
            opacity=0.5,
            annotation_text="Watch threshold",
        )

        fig.update_layout(
            xaxis_title="Model Type",
            yaxis_title="Overfit Gap",
            yaxis_tickformat=".1%",
            template="plotly_dark",
            height=350,
            margin=dict(l=50, r=20, t=20, b=50),
            showlegend=False,
        )

        st.plotly_chart(fig, use_container_width=True)

        st.caption(
            f"Side-by-side comparison of overfitting across all active model types. "
            f"Green bars are healthy (<{watch_threshold:.0%}), "
            f"yellow bars need watching ({watch_threshold:.0%}-{accuracy_threshold:.0%}), "
            f"and red bars indicate overfitting (>{accuracy_threshold:.0%}). "
            f"Different model types may overfit at different rates — "
            f"regression models (spread, totals) may overfit differently than "
            f"classifiers (game_winner) due to different loss functions."
        )
    else:
        st.info("No overfit gap data available across model types.")
else:
    st.info("No active models with overfit gap data available.")
