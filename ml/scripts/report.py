"""
ML Pipeline Performance Report — queries live Supabase data.

Usage:
    ml/.venv/bin/python -m ml.scripts.report

Reads from 4 ML tables (read-only via anon key):
  - ml_model_metadata    → active model versions, feature importance, training metrics
  - ml_model_evaluations → monthly evaluation results (accuracy, Brier, drift)
  - ml_prediction_scores → per-game prediction outcomes (correct/incorrect)
  - ml_predictions       → recent predictions (probabilities, spreads, totals)

Environment:
  Reads SUPABASE_URL and SUPABASE_ANON_KEY from:
    1. EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (app creds)
    2. SUPABASE_URL / SUPABASE_ANON_KEY (ML pipeline creds)
"""

from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path

# Load .env from project root
try:
    from dotenv import load_dotenv
    env_paths = [
        Path(__file__).parent.parent.parent / ".env",  # project root
        Path(__file__).parent.parent / ".env",          # ml/.env
    ]
    for p in env_paths:
        if p.exists():
            load_dotenv(p)
            break
except ImportError:
    pass

from supabase import create_client

# ---------------------------------------------------------------------------
# Resolve credentials (support both EXPO_PUBLIC_ and plain prefixes)
# ---------------------------------------------------------------------------

SUPABASE_URL = (
    os.getenv("SUPABASE_URL")
    or os.getenv("EXPO_PUBLIC_SUPABASE_URL")
    or ""
)
SUPABASE_KEY = (
    os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or ""
)

# Table names
METADATA = "ml_model_metadata"
EVALUATIONS = "ml_model_evaluations"
SCORES = "ml_prediction_scores"
PREDICTIONS = "ml_predictions"


def connect():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Missing Supabase credentials.")
        print("  Set SUPABASE_URL + SUPABASE_ANON_KEY, or have .env with EXPO_PUBLIC_ variants.")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

def get_active_models(client):
    resp = client.table(METADATA).select("*").eq("is_active", True).execute()
    return resp.data or []


def get_all_model_versions(client, model_type: str, limit: int = 10):
    resp = (
        client.table(METADATA)
        .select("*")
        .eq("model_type", model_type)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def get_latest_evaluation(client, model_type: str):
    resp = (
        client.table(EVALUATIONS)
        .select("*")
        .eq("model_type", model_type)
        .order("evaluation_date", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def get_recent_scores(client, model_type: str, days: int = 30):
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    resp = (
        client.table(SCORES)
        .select("*")
        .eq("model_type", model_type)
        .gte("game_date", cutoff)
        .order("game_date", desc=True)
        .limit(500)
        .execute()
    )
    return resp.data or []


def get_recent_predictions(client, model_type: str, days: int = 7):
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    resp = (
        client.table(PREDICTIONS)
        .select("*")
        .eq("model_type", model_type)
        .gte("game_date", cutoff)
        .order("game_date", desc=True)
        .limit(200)
        .execute()
    )
    return resp.data or []


def get_pipeline_status(client):
    """Get the latest timestamp from each ML table."""
    status = {}
    for table, col in [
        (PREDICTIONS, "predicted_at"),
        (METADATA, "created_at"),
        (SCORES, "scored_at"),
        (EVALUATIONS, "evaluation_date"),
    ]:
        try:
            resp = (
                client.table(table)
                .select(col)
                .order(col, desc=True)
                .limit(1)
                .execute()
            )
            status[table] = resp.data[0][col] if resp.data else None
        except Exception:
            status[table] = None
    return status


# ---------------------------------------------------------------------------
# Report formatting
# ---------------------------------------------------------------------------

def fmt_pct(val, decimals=1):
    if val is None:
        return "—"
    return f"{float(val) * 100:.{decimals}f}%"


def fmt_num(val, decimals=3):
    if val is None:
        return "—"
    return f"{float(val):.{decimals}f}"


def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def print_section(text):
    print(f"\n  --- {text} ---")


def report_active_model(model, client):
    """Print report for one active model."""
    mt = model["model_type"]
    is_classifier = mt == "game_winner"

    print_header(f"{mt.upper().replace('_', ' ')}")

    # Model info
    version = model.get("version", "?")
    created = model.get("created_at", "?")
    if isinstance(created, str) and len(created) > 19:
        created = created[:19].replace("T", " ")
    n_features = len(model.get("features_used", []) or [])
    print(f"  Version:    {version}")
    print(f"  Trained:    {created}")
    print(f"  Features:   {n_features}")

    # Training metrics (stored in model metadata)
    train_metrics = model.get("training_metrics") or model.get("train_metrics") or {}
    if train_metrics:
        print_section("Training Metrics")
        for k, v in sorted(train_metrics.items()):
            if isinstance(v, (int, float)):
                if "accuracy" in k or "pct" in k or "rate" in k:
                    print(f"    {k:30s} {fmt_pct(v)}")
                else:
                    print(f"    {k:30s} {fmt_num(v)}")

    # Feature importance (top 10)
    fi = model.get("feature_importance")
    if fi and isinstance(fi, dict) and len(fi) > 0:
        print_section("Top 10 Features (split gain)")
        sorted_fi = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:10]
        max_val = sorted_fi[0][1] if sorted_fi else 1
        for name, val in sorted_fi:
            bar_len = int(20 * val / max_val) if max_val > 0 else 0
            bar = "█" * bar_len
            print(f"    {name:35s} {val:>8.0f}  {bar}")

    # Latest evaluation
    evaluation = get_latest_evaluation(client, mt)
    if evaluation:
        print_section("Latest Evaluation")
        eval_date = evaluation.get("evaluation_date", "?")
        if isinstance(eval_date, str) and len(eval_date) > 10:
            eval_date = eval_date[:10]
        print(f"    Date: {eval_date}")

        metrics = evaluation.get("metrics") or evaluation.get("evaluation_metrics") or {}
        if isinstance(metrics, dict):
            for k, v in sorted(metrics.items()):
                if isinstance(v, (int, float)):
                    if "accuracy" in k or "pct" in k or "rate" in k:
                        print(f"    {k:30s} {fmt_pct(v)}")
                    else:
                        print(f"    {k:30s} {fmt_num(v)}")

        # Overfitting & drift
        overfit = evaluation.get("overfit_gap") or evaluation.get("overfitting_gap")
        drift = evaluation.get("feature_drift_score")
        if overfit is not None:
            label = "Accuracy gap" if is_classifier else "MAE gap"
            unit = fmt_pct(overfit) if is_classifier else f"{float(overfit):.3f} goals"
            print(f"    {'overfit_gap (' + label + ')':30s} {unit}")
        if drift is not None:
            status = "LOW" if float(drift) < 0.1 else ("MODERATE" if float(drift) < 0.3 else "HIGH")
            print(f"    {'feature_drift':30s} {fmt_num(drift)} ({status})")

    # Recent prediction scores (last 30 days)
    scores = get_recent_scores(client, mt, days=30)
    if scores:
        print_section(f"Prediction Accuracy (last 30 days, {len(scores)} games)")

        if is_classifier:
            correct = sum(1 for s in scores if s.get("is_correct"))
            total = len(scores)
            acc = correct / total if total > 0 else 0
            print(f"    Correct:   {correct}/{total} ({fmt_pct(acc)})")

            # Confidence breakdown
            high_conf = [s for s in scores if s.get("confidence") and float(s["confidence"]) >= 0.65]
            med_conf = [s for s in scores if s.get("confidence") and 0.55 <= float(s["confidence"]) < 0.65]
            low_conf = [s for s in scores if s.get("confidence") and float(s["confidence"]) < 0.55]

            for label, subset in [("High conf (>=65%)", high_conf), ("Med conf (55-65%)", med_conf), ("Low conf (<55%)", low_conf)]:
                if subset:
                    c = sum(1 for s in subset if s.get("is_correct"))
                    t = len(subset)
                    print(f"    {label:25s} {c}/{t} ({fmt_pct(c/t if t else 0)})")

            # Brier scores
            briers = [float(s["brier_score"]) for s in scores if s.get("brier_score") is not None]
            if briers:
                avg_brier = sum(briers) / len(briers)
                print(f"    Avg Brier score:       {fmt_num(avg_brier)}")

        else:
            # Regression: MAE from scores
            errors = []
            for s in scores:
                pred = s.get("predicted_value")
                actual = s.get("actual_value")
                if pred is not None and actual is not None:
                    errors.append(abs(float(pred) - float(actual)))
            if errors:
                mae = sum(errors) / len(errors)
                print(f"    MAE:       {fmt_num(mae)} {'goals' if mt == 'totals' else 'pts'}")
                print(f"    Games:     {len(errors)}")

                # Bucket by error magnitude
                within_1 = sum(1 for e in errors if e <= 1.0)
                within_2 = sum(1 for e in errors if e <= 2.0)
                print(f"    Within 1:  {within_1}/{len(errors)} ({fmt_pct(within_1/len(errors))})")
                print(f"    Within 2:  {within_2}/{len(errors)} ({fmt_pct(within_2/len(errors))})")

    # Recent predictions (last 7 days, show a few)
    recent = get_recent_predictions(client, mt, days=3)
    if recent:
        print_section(f"Recent Predictions (last 3 days, showing up to 5)")
        for pred in recent[:5]:
            game_date = pred.get("game_date", "?")
            home = pred.get("home_team", "?")
            away = pred.get("away_team", "?")

            if is_classifier:
                prob = pred.get("home_win_prob") or pred.get("predicted_value")
                conf = pred.get("confidence")
                pick = pred.get("predicted_winner") or pred.get("pick")
                line = f"    {game_date}  {away:3s} @ {home:3s}"
                if prob is not None:
                    line += f"  P(home)={fmt_pct(prob)}"
                if pick:
                    line += f"  Pick: {pick}"
                print(line)
            elif mt == "spread":
                spread = pred.get("predicted_value") or pred.get("predicted_spread")
                line = f"    {game_date}  {away:3s} @ {home:3s}"
                if spread is not None:
                    s = float(spread)
                    line += f"  Spread: {'+' if s > 0 else ''}{s:.1f}"
                print(line)
            elif mt == "totals":
                total = pred.get("predicted_value") or pred.get("predicted_total")
                line = f"    {game_date}  {away:3s} @ {home:3s}"
                if total is not None:
                    line += f"  Total: {float(total):.1f}"
                print(line)
            else:
                # player_props
                player = pred.get("player_name", "?")
                prop = pred.get("prop_type", "?")
                val = pred.get("predicted_value")
                line = f"    {game_date}  {player} — {prop}"
                if val is not None:
                    line += f": {fmt_num(val, 2)}"
                print(line)


def report_pipeline_status(client):
    """Print pipeline last-run times."""
    print_header("PIPELINE STATUS")
    status = get_pipeline_status(client)

    labels = {
        PREDICTIONS: "Last prediction",
        METADATA: "Last training",
        SCORES: "Last scoring",
        EVALUATIONS: "Last evaluation",
    }
    for table, ts in status.items():
        label = labels.get(table, table)
        if ts and isinstance(ts, str) and len(ts) > 19:
            ts = ts[:19].replace("T", " ")
        print(f"  {label:25s} {ts or 'never'}")


def report_model_history(client, model_type: str, limit: int = 5):
    """Show version history for a model type."""
    versions = get_all_model_versions(client, model_type, limit=limit)
    if not versions:
        return

    print_section(f"Version History (last {limit})")
    for v in versions:
        version = v.get("version", "?")
        created = v.get("created_at", "?")
        if isinstance(created, str) and len(created) > 19:
            created = created[:19].replace("T", " ")
        active = " [ACTIVE]" if v.get("is_active") else ""
        n_feat = len(v.get("features_used", []) or [])
        print(f"    v{version}  {created}  {n_feat} features{active}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("\n" + "╔" + "═"*58 + "╗")
    print("║" + "  PuckIQ ML Pipeline — Performance Report".center(58) + "║")
    print("║" + f"  {date.today().isoformat()}".center(58) + "║")
    print("╚" + "═"*58 + "╝")

    client = connect()

    # Pipeline status
    report_pipeline_status(client)

    # Active models
    active = get_active_models(client)

    if not active:
        print("\n  No active models found in Supabase.")
        print("  Run the weekly retrain pipeline to train and promote models:")
        print("    ml/.venv/bin/python -m ml.pipeline.weekly_retrain")
        return

    model_types_seen = set()
    for model in active:
        mt = model.get("model_type", "unknown")
        model_types_seen.add(mt)
        report_active_model(model, client)
        report_model_history(client, mt)

    # Check for model types without active versions
    all_types = {"game_winner", "spread", "totals", "player_props"}
    missing = all_types - model_types_seen
    if missing:
        print_header("MISSING MODELS")
        for mt in sorted(missing):
            print(f"  {mt}: No active model — needs training")

    print(f"\n{'─'*60}")
    print("  Dashboard: ml/dashboard/ (streamlit run app.py)")
    print(f"{'─'*60}\n")


if __name__ == "__main__":
    main()
