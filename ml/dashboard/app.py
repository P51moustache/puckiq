"""
PuckIQ ML Dashboard — Main entry point.

Run with:
    cd ml/dashboard && streamlit run app.py

Environment variables required:
    SUPABASE_URL         — Supabase project URL
    SUPABASE_ANON_KEY    — Supabase anonymous (read-only) key
    DASHBOARD_PASSWORD   — Password to access the dashboard

The dashboard reads from 4 ML tables in Supabase (all read-only via RLS):
    ml_predictions, ml_prediction_scores, ml_model_metadata, ml_model_evaluations
"""

import os

import streamlit as st
from dotenv import load_dotenv

# Load .env if present (local dev)
load_dotenv()

# ---------------------------------------------------------------------------
# Page config — must be the first Streamlit command
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="PuckIQ ML Dashboard",
    page_icon="hockey",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Authentication gate
# ---------------------------------------------------------------------------

DASHBOARD_PASSWORD = os.getenv("DASHBOARD_PASSWORD", "")


def check_auth() -> bool:
    """Simple password gate. Returns True if authenticated."""
    if not DASHBOARD_PASSWORD:
        # No password configured — allow access (local dev convenience)
        return True

    if st.session_state.get("authenticated"):
        return True

    st.title("PuckIQ ML Dashboard")
    password = st.text_input("Enter password to continue.", type="password")

    if password:
        if password == DASHBOARD_PASSWORD:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.error("Incorrect password.")

    return False


if not check_auth():
    st.stop()

# ---------------------------------------------------------------------------
# Authenticated — show the main page
# ---------------------------------------------------------------------------

st.title("PuckIQ ML Dashboard")
st.markdown(
    """
    Private monitoring dashboard for the PuckIQ ML prediction pipeline.
    Use the sidebar to navigate between pages.

    ---

    **Pages:**
    - **Overview** — KPI cards, accuracy trend, overfitting alert
    - **Model Performance** — Reliability diagram, confidence breakdown, baselines
    - **Feature Importance** — Top features, drift analysis
    - **Overfitting Monitor** — Train/val gap trend, alert zones
    - **Prediction Review** — Game-by-game results table
    - **Player Props** — Per-player predicted vs actual stats
    """
)

st.caption(
    "Data refreshes every 5 minutes (cached). "
    "All queries use the Supabase anon key (read-only)."
)
