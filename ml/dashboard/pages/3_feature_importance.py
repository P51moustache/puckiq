"""
Page 3: Feature Importance

Top features bar chart and feature list.
This page answers: "What data is the model actually using to make predictions?"
"""

import pandas as pd
import plotly.express as px
import streamlit as st

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data import get_active_models, get_latest_evaluation

st.set_page_config(page_title="Feature Importance — PuckIQ ML", layout="wide")
st.title("Feature Importance")
st.caption(
    "Which input features have the most influence on the model's predictions? "
    "Feature importance is calculated during training by LightGBM — "
    "it measures how often each feature is used in tree splits and how much "
    "it improves prediction accuracy."
)

# ---------------------------------------------------------------------------
# Model type selector
# ---------------------------------------------------------------------------

MODEL_TYPES = ["game_winner", "spread", "totals"]

model_type = st.selectbox(
    "Model Type",
    MODEL_TYPES,
    index=0,
    help="Select which prediction model to analyze.",
)

# ---------------------------------------------------------------------------
# Feature importance from active model
# ---------------------------------------------------------------------------

active_models = get_active_models()

if active_models.empty:
    st.info("No active models yet — feature importance will appear after the first model training.")
    st.stop()

model_row = active_models[active_models["model_type"] == model_type]
if model_row.empty:
    st.info(f"No active model found for type '{model_type}'.")
    st.stop()

model = model_row.iloc[0]

# ---------------------------------------------------------------------------
# Horizontal bar chart — Top 15 features
# ---------------------------------------------------------------------------

st.subheader("Top 15 Features")

feature_importance = model.get("feature_importance")

# Normalize feature importance data.
# The weekly retrain writes this as a dict: {"feature_name": importance_value, ...}
# but it could also arrive as a list: [{"feature": "name", "importance": value}, ...]
# Handle both formats.
fi_df = pd.DataFrame()
if feature_importance:
    if isinstance(feature_importance, dict) and len(feature_importance) > 0:
        # Dict format from get_feature_importance() → {"home_goals_for_l10": 713, ...}
        fi_df = pd.DataFrame([
            {"feature": k, "importance": v}
            for k, v in feature_importance.items()
        ])
    elif isinstance(feature_importance, list) and len(feature_importance) > 0:
        fi_df = pd.DataFrame(feature_importance)
        # Normalize column names — expect {feature, importance} or {name, importance}
        if "name" in fi_df.columns and "feature" not in fi_df.columns:
            fi_df = fi_df.rename(columns={"name": "feature"})

if not fi_df.empty and "feature" in fi_df.columns and "importance" in fi_df.columns:
        # Sort by importance descending, take top 15
        fi_df = fi_df.sort_values("importance", ascending=False).head(15)

        # Reverse for horizontal bar chart (top feature at top of chart)
        fi_df = fi_df.sort_values("importance", ascending=True)

        fig = px.bar(
            fi_df,
            x="importance",
            y="feature",
            orientation="h",
            color="importance",
            color_continuous_scale="Blues",
        )
        fig.update_layout(
            xaxis_title="Importance (split gain)",
            yaxis_title="",
            template="plotly_dark",
            height=max(400, len(fi_df) * 30),
            margin=dict(l=20, r=20, t=20, b=50),
            showlegend=False,
            coloraxis_showscale=False,
        )
        st.plotly_chart(fig, use_container_width=True)

        st.caption(
            "**Split gain** measures how much each feature improves the model when used in a "
            "decision tree split. Higher = more important. "
            "If a few features dominate, the model may be too reliant on them. "
            "If importance is spread evenly, each feature contributes a small amount. "
            "Ideally, the top features make intuitive hockey sense "
            "(e.g., goal differential, power play %, recent form)."
        )
    else:
        st.warning(
            f"Feature importance data has unexpected format. "
            f"Columns found: {list(fi_df.columns)}"
        )
else:
    st.info("No feature importance data available for this model type.")

# ---------------------------------------------------------------------------
# Feature drift analysis
# ---------------------------------------------------------------------------

st.subheader("Feature Drift")

evaluation = get_latest_evaluation(model_type)

if evaluation is not None:
    drift_score = evaluation.get("feature_drift_score")
    if drift_score is not None and pd.notna(drift_score):
        # Color-code the drift score
        if drift_score < 0.1:
            color = "green"
            status = "Low"
            description = "Feature distributions are stable. No action needed."
        elif drift_score < 0.3:
            color = "orange"
            status = "Moderate"
            description = (
                "Some feature distributions have shifted. Monitor closely — "
                "if drift continues, the model may need retraining."
            )
        else:
            color = "red"
            status = "High"
            description = (
                "Significant feature drift detected. The data the model was trained on "
                "no longer matches current data. Retraining is recommended."
            )

        col1, col2 = st.columns([1, 3])
        with col1:
            st.metric("Drift Score", f"{drift_score:.3f}")
        with col2:
            if color == "red":
                st.error(f"**{status} Drift** — {description}")
            elif color == "orange":
                st.warning(f"**{status} Drift** — {description}")
            else:
                st.success(f"**{status} Drift** — {description}")
    else:
        st.info("No feature drift score available yet.")
else:
    st.info("No evaluation data available — drift analysis requires a completed evaluation.")

st.caption(
    "**Feature drift** measures how much the distribution of input features has changed "
    "since the model was trained. High drift means the model is seeing data patterns "
    "it was not trained on, which can degrade prediction accuracy. "
    "Common causes: mid-season trades, injuries, or schedule changes."
)

# ---------------------------------------------------------------------------
# Full feature list
# ---------------------------------------------------------------------------

st.subheader("All Features Used")

features_used = model.get("features_used")

if features_used and isinstance(features_used, list) and len(features_used) > 0:
    # Feature descriptions — must match the actual feature names from features.yaml
    FEATURE_DESCRIPTIONS = {
        # Standings-based (lookup)
        "home_point_pctg": "Home team season point percentage",
        "away_point_pctg": "Away team season point percentage",
        "home_goal_diff": "Home team season goal differential",
        "away_goal_diff": "Away team season goal differential",
        "home_home_wins": "Home team wins at home this season",
        "away_road_wins": "Away team wins on the road this season",
        # Rolling window (recent form, last 10 games)
        "home_goals_for_l10": "Home team avg goals scored in last 10 games",
        "away_goals_for_l10": "Away team avg goals scored in last 10 games",
        "home_goals_against_l10": "Home team avg goals allowed in last 10 games",
        "away_goals_against_l10": "Away team avg goals allowed in last 10 games",
        "home_win_pct_l10": "Home team win rate in last 10 games",
        "away_win_pct_l10": "Away team win rate in last 10 games",
        # Goalie stats
        "home_starter_save_pctg": "Home starting goalie save percentage",
        "away_starter_save_pctg": "Away starting goalie save percentage",
        # Rest / schedule (derived)
        "rest_advantage": "Home team rest days minus away (positive = home more rested)",
        "home_is_back_to_back": "1 if home team played yesterday, 0 otherwise",
        "away_is_back_to_back": "1 if away team played yesterday, 0 otherwise",
        # Derived
        "point_pctg_diff": "Home point% minus away point% (positive = home stronger)",
    }

    feature_data = []
    for f in features_used:
        feature_data.append({
            "Feature": f,
            "Description": FEATURE_DESCRIPTIONS.get(f, "—"),
        })

    st.dataframe(
        pd.DataFrame(feature_data),
        use_container_width=True,
        hide_index=True,
        height=min(600, len(feature_data) * 40 + 40),
    )

    st.caption(
        f"The active model uses **{len(features_used)} features**. "
        f"Each feature is a numeric value computed from Supabase data before each prediction. "
        f"Features prefixed with 'home_' describe the home team; 'away_' describe the away team."
    )
else:
    st.info("No feature list available for this model type.")
