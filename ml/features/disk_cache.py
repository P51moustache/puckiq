"""
Disk-based feature cache for the ML pipeline.

Caches the output of compute_all_features() as a Parquet file so that
subsequent retrain runs only compute features for new games. The cache
auto-invalidates when features.yaml or compute.py change (schema hash
embedded in the filename).

Typical speedup: first run ~40 min, incremental runs ~5-30 seconds.
"""

import hashlib
import logging
from pathlib import Path

import pandas as pd
from supabase import Client

from ml.features.compute import FeatureCache, compute_all_features
from ml.features.registry import FeatureDefinition, load_feature_registry

logger = logging.getLogger(__name__)

_FEATURES_DIR = Path(__file__).parent
_DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent / ".cache"


def _compute_schema_hash() -> str:
    """
    SHA256 hash of features.yaml + compute.py content, truncated to 12 chars.

    Any change to feature definitions or computation logic produces a
    different hash, which auto-invalidates the cached Parquet file.
    """
    h = hashlib.sha256()
    for filename in ("features.yaml", "compute.py"):
        path = _FEATURES_DIR / filename
        h.update(path.read_bytes())
    return h.hexdigest()[:12]


def load_cached_features(cache_dir: Path | None = None) -> pd.DataFrame | None:
    """
    Load the cached features DataFrame from disk.

    Returns None if no cache file exists for the current schema hash.
    """
    cache_dir = cache_dir or _DEFAULT_CACHE_DIR
    schema_hash = _compute_schema_hash()
    parquet_path = cache_dir / f"features_v{schema_hash}.parquet"

    if not parquet_path.exists():
        return None

    df = pd.read_parquet(parquet_path)
    logger.info("Loaded %d cached feature rows from %s", len(df), parquet_path.name)
    return df


def save_cached_features(
    features_df: pd.DataFrame, cache_dir: Path | None = None
) -> None:
    """
    Save the features DataFrame to disk as Parquet.

    Also cleans up any Parquet files from older schema versions.
    """
    cache_dir = cache_dir or _DEFAULT_CACHE_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)

    schema_hash = _compute_schema_hash()
    parquet_path = cache_dir / f"features_v{schema_hash}.parquet"

    # Clean up old schema files before writing the new one
    for old_file in cache_dir.glob("features_v*.parquet"):
        if old_file != parquet_path:
            old_file.unlink()
            logger.info("Removed stale cache file: %s", old_file.name)

    features_df.to_parquet(parquet_path)
    logger.info(
        "Saved %d feature rows to %s (%.1f KB)",
        len(features_df),
        parquet_path.name,
        parquet_path.stat().st_size / 1024,
    )


def invalidate_cache(cache_dir: Path | None = None) -> int:
    """
    Delete all cached Parquet files.

    Returns the number of files removed.
    """
    cache_dir = cache_dir or _DEFAULT_CACHE_DIR
    removed = 0
    if cache_dir.exists():
        for f in cache_dir.glob("features_v*.parquet"):
            f.unlink()
            removed += 1
    if removed:
        logger.info("Invalidated %d cache file(s)", removed)
    return removed


def compute_features_with_cache(
    games_df: pd.DataFrame,
    client: Client,
    *,
    registry: dict[str, FeatureDefinition] | None = None,
    seasons: list[int] | None = None,
    cache_dir: Path | None = None,
    force_recompute: bool = False,
) -> pd.DataFrame:
    """
    Compute features for all games, using disk cache for known games.

    1. Load cached features from disk (if any, and not force_recompute).
    2. Identify game_ids not present in the cache.
    3. If all games are cached, return immediately.
    4. Build a FeatureCache for new games only and compute their features.
    5. Merge cached + new, save to disk, and return.

    Args:
        games_df: DataFrame of games (must have 'id', 'game_date', etc.).
        client: Supabase client.
        registry: Feature registry. Loaded from YAML if not provided.
        seasons: Training seasons list (passed to FeatureCache.build).
        cache_dir: Override the default cache directory.
        force_recompute: If True, ignore cache and recompute everything.

    Returns:
        DataFrame indexed by game_id with one column per feature.
    """
    if registry is None:
        registry = load_feature_registry()

    all_game_ids = set(games_df["id"].tolist())

    # Try loading cached features
    cached_df = None
    if not force_recompute:
        cached_df = load_cached_features(cache_dir)

    if cached_df is not None:
        cached_game_ids = set(cached_df.index.tolist())
        new_game_ids = all_game_ids - cached_game_ids
    else:
        new_game_ids = all_game_ids

    # Fast path: everything is cached
    if cached_df is not None and not new_game_ids:
        logger.info("All %d games found in cache — skipping feature computation", len(all_game_ids))
        # Return only the rows for games in games_df (cache may have extras from prior runs)
        return cached_df.loc[cached_df.index.isin(all_game_ids)]

    # Compute features for new games only
    new_games_df = games_df[games_df["id"].isin(new_game_ids)]
    logger.info(
        "Computing features for %d new games (%d cached, %d total)",
        len(new_games_df), len(all_game_ids) - len(new_game_ids), len(all_game_ids),
    )

    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cache_obj = FeatureCache.build(client, new_games_df, seasons=seasons)
    new_features_df = compute_all_features(
        new_games_df, today, client, registry, use_cache=True, cache=cache_obj
    )

    # Merge cached + new
    if cached_df is not None and not cached_df.empty:
        merged_df = pd.concat([cached_df, new_features_df])
        # Drop any duplicates (shouldn't happen, but be safe)
        merged_df = merged_df[~merged_df.index.duplicated(keep="last")]
    else:
        merged_df = new_features_df

    # Save the full merged result to disk
    save_cached_features(merged_df, cache_dir)

    # Return only rows for the requested games
    return merged_df.loc[merged_df.index.isin(all_game_ids)]
