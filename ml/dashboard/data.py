"""
Shared Supabase data-access layer for the dashboard.

All queries are cached with a 5-minute TTL via @st.cache_data.
Every function returns a pandas DataFrame (empty if no data).
"""

import os
from datetime import date, timedelta

import pandas as pd
import streamlit as st
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

# ---------------------------------------------------------------------------
# Constants (duplicated from ml/config.py to avoid import dependency)
# ---------------------------------------------------------------------------

OVERFITTING_THRESHOLDS = {
    "accuracy": 0.05,
    "brier_score": 0.05,
    "mae": 0.50,
    "rmse": 0.50,
    "log_loss": 0.10,
}

# ---------------------------------------------------------------------------
# Supabase connection
# ---------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")


@st.cache_resource
def get_client() -> Client:
    """Create a singleton Supabase client (anon key, read-only)."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        st.error(
            "Missing Supabase credentials. "
            "Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
        )
        st.stop()
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ---------------------------------------------------------------------------
# Table names (match ml/config.py)
# ---------------------------------------------------------------------------

PREDICTIONS = "ml_predictions"
SCORES = "ml_prediction_scores"
METADATA = "ml_model_metadata"
EVALUATIONS = "ml_model_evaluations"


# ---------------------------------------------------------------------------
# Model metadata queries
# ---------------------------------------------------------------------------


@st.cache_data(ttl=300)
def get_active_models() -> pd.DataFrame:
    """Fetch all active model versions (is_active = true)."""
    client = get_client()
    resp = (
        client.table(METADATA)
        .select("*")
        .eq("is_active", True)
        .execute()
    )
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()


@st.cache_data(ttl=300)
def get_model_metadata(limit: int = 50) -> pd.DataFrame:
    """Fetch recent model metadata, ordered by created_at descending."""
    client = get_client()
    resp = (
        client.table(METADATA)
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()


@st.cache_data(ttl=300)
def get_model_metadata_by_type(model_type: str) -> pd.DataFrame:
    """Fetch all model versions for a specific model type."""
    client = get_client()
    resp = (
        client.table(METADATA)
        .select("*")
        .eq("model_type", model_type)
        .order("created_at", desc=True)
        .execute()
    )
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()


# ---------------------------------------------------------------------------
# Prediction scores queries
# ---------------------------------------------------------------------------


@st.cache_data(ttl=300)
def get_prediction_scores(
    start_date: str | None = None,
    end_date: str | None = None,
    model_type: str | None = None,
) -> pd.DataFrame:
    """Fetch prediction scores with optional date range and model type filters."""
    client = get_client()
    query = client.table(SCORES).select("*")

    if model_type:
        query = query.eq("model_type", model_type)
    if start_date:
        query = query.gte("game_date", start_date)
    if end_date:
        query = query.lte("game_date", end_date)

    query = query.order("game_date", desc=True).limit(2000)
    resp = query.execute()
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()


@st.cache_data(ttl=300)
def get_scores_last_n_days(days: int = 90) -> pd.DataFrame:
    """Fetch all prediction scores from the last N days."""
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    client = get_client()
    resp = (
        client.table(SCORES)
        .select("*")
        .gte("game_date", cutoff)
        .order("game_date", desc=True)
        .limit(2000)
        .execute()
    )
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()


# ---------------------------------------------------------------------------
# Predictions queries
# ---------------------------------------------------------------------------


@st.cache_data(ttl=300)
def get_predictions(
    start_date: str | None = None,
    end_date: str | None = None,
    model_type: str | None = None,
) -> pd.DataFrame:
    """Fetch predictions with optional date range and model type filters."""
    client = get_client()
    query = client.table(PREDICTIONS).select("*")

    if model_type:
        query = query.eq("model_type", model_type)
    if start_date:
        query = query.gte("game_date", start_date)
    if end_date:
        query = query.lte("game_date", end_date)

    query = query.order("game_date", desc=True).limit(2000)
    resp = query.execute()
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()


# ---------------------------------------------------------------------------
# Model evaluations queries
# ---------------------------------------------------------------------------


@st.cache_data(ttl=300)
def get_evaluations(model_type: str | None = None) -> pd.DataFrame:
    """Fetch model evaluations, optionally filtered by model type."""
    client = get_client()
    query = client.table(EVALUATIONS).select("*")
    if model_type:
        query = query.eq("model_type", model_type)
    query = query.order("evaluation_date", desc=True).limit(100)
    resp = query.execute()
    return pd.DataFrame(resp.data) if resp.data else pd.DataFrame()


@st.cache_data(ttl=300)
def get_latest_evaluation(model_type: str) -> dict | None:
    """Fetch the most recent evaluation for a model type."""
    client = get_client()
    resp = (
        client.table(EVALUATIONS)
        .select("*")
        .eq("model_type", model_type)
        .order("evaluation_date", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]
    return None


# ---------------------------------------------------------------------------
# Pipeline status queries
# ---------------------------------------------------------------------------


@st.cache_data(ttl=60)
def get_pipeline_status() -> dict:
    """Get last run times for each pipeline phase.

    Returns a dict with keys: last_prediction, last_training, last_scoring,
    last_evaluation. Each value is an ISO timestamp string or None.
    """
    client = get_client()

    def _latest_ts(table: str, column: str) -> str | None:
        try:
            resp = (
                client.table(table)
                .select(column)
                .order(column, desc=True)
                .limit(1)
                .execute()
            )
            if resp.data:
                return resp.data[0].get(column)
        except Exception:
            pass
        return None

    return {
        "last_prediction": _latest_ts(PREDICTIONS, "predicted_at"),
        "last_training": _latest_ts(METADATA, "created_at"),
        "last_scoring": _latest_ts(SCORES, "scored_at"),
        "last_evaluation": _latest_ts(EVALUATIONS, "evaluation_date"),
    }
