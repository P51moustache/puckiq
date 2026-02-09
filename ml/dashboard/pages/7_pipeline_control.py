"""
Page 7: Pipeline Control

Trigger ML pipeline phases (daily predictions, weekly retrain, monthly evaluation)
directly from the dashboard. Requires SUPABASE_SERVICE_ROLE_KEY for write access.
"""

import os
import subprocess
import sys
import time
from datetime import datetime, timezone

import pandas as pd
import streamlit as st

# Adjust import path — Streamlit pages run from the dashboard/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data import get_pipeline_status

st.set_page_config(page_title="Pipeline Control — PuckIQ ML", layout="wide")
st.title("Pipeline Control")
st.caption(
    "Trigger ML pipeline phases manually. "
    "Pipeline runs modify production data in Supabase."
)

# ---------------------------------------------------------------------------
# Safety check: require SUPABASE_SERVICE_ROLE_KEY for write access
# ---------------------------------------------------------------------------

HAS_WRITE_ACCESS = bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

if not HAS_WRITE_ACCESS:
    st.info(
        "Pipeline controls require write access. "
        "Set **SUPABASE_SERVICE_ROLE_KEY** environment variable to enable."
    )

# ---------------------------------------------------------------------------
# Pipeline status
# ---------------------------------------------------------------------------

st.subheader("Pipeline Status")

status = get_pipeline_status()

col1, col2, col3, col4 = st.columns(4)


def _format_age(iso_timestamp: str | None) -> str:
    """Format a timestamp as a human-readable age string."""
    if not iso_timestamp:
        return "Never"
    try:
        ts = pd.to_datetime(iso_timestamp, utc=True)
        now = pd.Timestamp.now(tz="UTC")
        delta = now - ts
        hours = delta.total_seconds() / 3600
        if hours < 1:
            return f"{int(delta.total_seconds() / 60)}m ago"
        if hours < 24:
            return f"{int(hours)}h ago"
        days = int(hours / 24)
        return f"{days}d ago"
    except Exception:
        return "Unknown"


with col1:
    st.metric(
        label="Last Prediction",
        value=_format_age(status.get("last_prediction")),
        help="Most recent prediction written to ml_predictions",
    )

with col2:
    st.metric(
        label="Last Training",
        value=_format_age(status.get("last_training")),
        help="Most recent model training (ml_model_metadata)",
    )

with col3:
    st.metric(
        label="Last Scoring",
        value=_format_age(status.get("last_scoring")),
        help="Most recent prediction scoring (ml_prediction_scores)",
    )

with col4:
    st.metric(
        label="Last Evaluation",
        value=_format_age(status.get("last_evaluation")),
        help="Most recent monthly evaluation (ml_model_evaluations)",
    )

# Schedule reference
with st.expander("Scheduled Runs (GitHub Actions)"):
    st.markdown(
        """
| Pipeline | Schedule | Cron |
|----------|----------|------|
| **Daily Predictions** | Midnight + Noon ET | `0 5,17 * * *` UTC |
| **Weekly Retrain** | Monday 6:00 AM ET | `0 11 * * 1` UTC |
| **Monthly Evaluation** | 1st of month 8:00 AM ET | `0 13 1 * *` UTC |
        """
    )

st.divider()

# ---------------------------------------------------------------------------
# Helpers for running pipelines
# ---------------------------------------------------------------------------

# Rate-limit window (seconds)
RATE_LIMIT_SECONDS = 300  # 5 minutes

# Initialize session state for tracking runs
if "pipeline_running" not in st.session_state:
    st.session_state["pipeline_running"] = None
if "pipeline_last_run" not in st.session_state:
    st.session_state["pipeline_last_run"] = {}


def _is_rate_limited(pipeline_name: str) -> bool:
    """Check if a pipeline was run within the last 5 minutes."""
    last_run = st.session_state["pipeline_last_run"].get(pipeline_name)
    if last_run is None:
        return False
    elapsed = time.time() - last_run
    return elapsed < RATE_LIMIT_SECONDS


def _remaining_cooldown(pipeline_name: str) -> int:
    """Return remaining cooldown seconds for a pipeline."""
    last_run = st.session_state["pipeline_last_run"].get(pipeline_name)
    if last_run is None:
        return 0
    remaining = RATE_LIMIT_SECONDS - (time.time() - last_run)
    return max(0, int(remaining))


def _run_pipeline(pipeline_name: str, module_path: str) -> None:
    """Run a pipeline module as a subprocess and display output."""
    st.session_state["pipeline_running"] = pipeline_name
    st.session_state["pipeline_last_run"][pipeline_name] = time.time()

    # Build the subprocess command
    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    env = os.environ.copy()
    env["PYTHONPATH"] = project_root

    with st.spinner(f"Running {pipeline_name}..."):
        try:
            result = subprocess.run(
                [sys.executable, "-m", module_path],
                capture_output=True,
                text=True,
                timeout=600,
                env=env,
                cwd=project_root,
            )

            if result.returncode == 0:
                st.success(f"{pipeline_name} completed successfully.")
            else:
                st.error(f"{pipeline_name} failed (exit code {result.returncode}).")

            # Show output
            output = result.stdout or ""
            errors = result.stderr or ""
            combined = ""
            if output:
                combined += output
            if errors:
                combined += "\n--- STDERR ---\n" + errors

            if combined.strip():
                st.code(combined.strip(), language="text")
            else:
                st.caption("No output captured.")

        except subprocess.TimeoutExpired:
            st.error(f"{pipeline_name} timed out after 10 minutes.")
        except Exception as exc:
            st.error(f"Failed to run {pipeline_name}: {exc}")

    st.session_state["pipeline_running"] = None


# ---------------------------------------------------------------------------
# Pipeline action buttons
# ---------------------------------------------------------------------------

st.subheader("Run Pipeline")

is_any_running = st.session_state.get("pipeline_running") is not None

# --- Daily Predictions ---
st.markdown("### Daily Predictions")
st.markdown(
    "Generates predictions for today's games using the active trained models, "
    "then scores yesterday's predictions against actual results."
)

daily_rate_limited = _is_rate_limited("daily")
daily_cooldown = _remaining_cooldown("daily")
daily_disabled = not HAS_WRITE_ACCESS or is_any_running or daily_rate_limited

daily_confirm = st.checkbox(
    "I understand this will modify production data",
    key="daily_confirm",
    disabled=daily_disabled,
)

if daily_rate_limited:
    st.caption(f"Rate limited. Available again in {daily_cooldown}s.")

if st.button(
    "Run Daily Predictions",
    disabled=daily_disabled or not daily_confirm,
    key="daily_btn",
):
    _run_pipeline("Daily Predictions", "ml.pipeline.daily_run")

st.divider()

# --- Weekly Retrain ---
st.markdown("### Weekly Retrain")
st.markdown(
    "Retrains all models (game_winner, spread, totals) on the latest completed games. "
    "Uses walk-forward cross-validation and only promotes new models if they beat "
    "the current active model."
)

weekly_rate_limited = _is_rate_limited("weekly")
weekly_cooldown = _remaining_cooldown("weekly")
weekly_disabled = not HAS_WRITE_ACCESS or is_any_running or weekly_rate_limited

weekly_confirm = st.checkbox(
    "I understand this will modify production data",
    key="weekly_confirm",
    disabled=weekly_disabled,
)

if weekly_rate_limited:
    st.caption(f"Rate limited. Available again in {weekly_cooldown}s.")

if st.button(
    "Run Weekly Retrain",
    disabled=weekly_disabled or not weekly_confirm,
    key="weekly_btn",
):
    _run_pipeline("Weekly Retrain", "ml.pipeline.weekly_retrain")

st.divider()

# --- Monthly Evaluation ---
st.markdown("### Monthly Evaluation")
st.markdown(
    "Runs a comprehensive evaluation: calibration analysis, confidence-accuracy "
    "breakdown, baseline comparison, and overfitting trend. Results are written "
    "to ml_model_evaluations."
)

monthly_rate_limited = _is_rate_limited("monthly")
monthly_cooldown = _remaining_cooldown("monthly")
monthly_disabled = not HAS_WRITE_ACCESS or is_any_running or monthly_rate_limited

monthly_confirm = st.checkbox(
    "I understand this will modify production data",
    key="monthly_confirm",
    disabled=monthly_disabled,
)

if monthly_rate_limited:
    st.caption(f"Rate limited. Available again in {monthly_cooldown}s.")

if st.button(
    "Run Monthly Evaluation",
    disabled=monthly_disabled or not monthly_confirm,
    key="monthly_btn",
):
    _run_pipeline("Monthly Evaluation", "ml.pipeline.monthly_eval")
