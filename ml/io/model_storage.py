"""
Model artifact storage via Supabase Storage.

Models are serialized with joblib, checksummed with SHA-256,
and uploaded to a dedicated bucket. A manifest.json per model type
tracks the active version and history.
"""

import hashlib
import json
import logging
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx
import joblib
from supabase import Client

from ml.config import MODEL_STORAGE_BUCKET, MODEL_VERSIONS_TO_KEEP

logger = logging.getLogger(__name__)


class ModelStorage:
    """Manage ML model artifacts in Supabase Storage."""

    def __init__(self, client: Client, bucket: str = MODEL_STORAGE_BUCKET):
        self.client = client
        self.bucket = bucket

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------

    def save_model(
        self,
        model: Any,
        model_type: str,
        version: str,
        metrics: dict[str, float] | None = None,
    ) -> str:
        """
        Serialize a model, upload to storage, and update the manifest.

        Args:
            model: Trained model object (must be joblib-serializable).
            model_type: One of ModelType values (e.g. 'game_winner').
            version: Version string (e.g. '2026-02-08_001').
            metrics: Optional dict of evaluation metrics to store in manifest.

        Returns:
            Storage path of the uploaded artifact.
        """
        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as tmp:
            joblib.dump(model, tmp.name)
            tmp_path = Path(tmp.name)

        file_bytes = tmp_path.read_bytes()
        checksum = hashlib.sha256(file_bytes).hexdigest()
        storage_path = f"{model_type}/{version}.joblib"

        self.client.storage.from_(self.bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "application/octet-stream", "upsert": "true"},
        )
        logger.info("Uploaded model artifact to %s/%s", self.bucket, storage_path)

        tmp_path.unlink(missing_ok=True)

        self.update_manifest(model_type, version, checksum, metrics or {})
        return storage_path

    # ------------------------------------------------------------------
    # Load
    # ------------------------------------------------------------------

    def load_model(self, model_type: str) -> Any:
        """
        Download the active model for a given type and deserialize it.

        Returns:
            Deserialized model object.

        Raises:
            FileNotFoundError: If no manifest or artifact exists.
            ValueError: If checksum verification fails.
        """
        manifest = self.get_manifest(model_type)
        if not manifest or not manifest.get("active_version"):
            raise FileNotFoundError(f"No active model found for {model_type}")

        active = manifest["active_version"]
        storage_path = f"{model_type}/{active}.joblib"
        expected_checksum = manifest.get("checksum", "")

        # Supabase Storage downloads can hang on the underlying HTTP/2 stream.
        # Default httpx timeout is too aggressive for ~10 MB artifacts on
        # ephemeral CI runners. Retry up to 3 times with exponential backoff.
        last_err: Exception | None = None
        file_bytes: bytes | None = None
        for attempt in range(3):
            try:
                file_bytes = self.client.storage.from_(self.bucket).download(storage_path)
                break
            except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.RemoteProtocolError) as err:
                last_err = err
                wait = 2 ** attempt
                logger.warning(
                    "Model download timed out (attempt %d/3) for %s — retry in %ds",
                    attempt + 1, storage_path, wait,
                )
                time.sleep(wait)
        if file_bytes is None:
            raise RuntimeError(
                f"Failed to download {storage_path} after 3 retries: {last_err}"
            )

        actual_checksum = hashlib.sha256(file_bytes).hexdigest()
        if expected_checksum and actual_checksum != expected_checksum:
            raise ValueError(
                f"Checksum mismatch for {storage_path}: "
                f"expected {expected_checksum}, got {actual_checksum}"
            )

        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        model = joblib.load(tmp_path)
        Path(tmp_path).unlink(missing_ok=True)

        logger.info("Loaded model %s version %s (checksum OK)", model_type, active)
        return model

    # ------------------------------------------------------------------
    # Manifest management
    # ------------------------------------------------------------------

    def get_manifest(self, model_type: str) -> dict[str, Any] | None:
        """Read the manifest.json for a model type from storage."""
        manifest_path = f"{model_type}/manifest.json"
        try:
            file_bytes = self.client.storage.from_(self.bucket).download(manifest_path)
            return json.loads(file_bytes.decode("utf-8"))
        except Exception:
            logger.debug("No manifest found at %s/%s", self.bucket, manifest_path)
            return None

    def update_manifest(
        self,
        model_type: str,
        version: str,
        checksum: str,
        metrics: dict[str, float],
    ) -> None:
        """
        Update (or create) the manifest.json for a model type.

        The manifest tracks the active version, checksum, metrics, and version history.
        """
        manifest = self.get_manifest(model_type) or {
            "model_type": model_type,
            "versions": [],
        }

        manifest["active_version"] = version
        manifest["checksum"] = checksum
        manifest["metrics"] = metrics

        # Append to version history
        manifest.setdefault("versions", [])
        manifest["versions"].append({
            "version": version,
            "checksum": checksum,
            "metrics": metrics,
        })

        manifest_path = f"{model_type}/manifest.json"
        manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")

        self.client.storage.from_(self.bucket).upload(
            path=manifest_path,
            file=manifest_bytes,
            file_options={"content-type": "application/json", "upsert": "true"},
        )
        logger.info("Updated manifest for %s: active_version=%s", model_type, version)

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def cleanup_old_versions(
        self, model_type: str, keep: int = MODEL_VERSIONS_TO_KEEP
    ) -> int:
        """
        Remove old model artifacts, keeping the most recent `keep` versions.

        Returns:
            Number of artifacts deleted.
        """
        manifest = self.get_manifest(model_type)
        if not manifest:
            return 0

        versions = manifest.get("versions", [])
        if len(versions) <= keep:
            return 0

        to_remove = versions[:-keep]
        removed = 0

        for entry in to_remove:
            path = f"{model_type}/{entry['version']}.joblib"
            try:
                self.client.storage.from_(self.bucket).remove([path])
                removed += 1
            except Exception as exc:
                logger.warning("Failed to remove %s: %s", path, exc)

        # Update manifest to only keep recent versions
        manifest["versions"] = versions[-keep:]
        manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
        self.client.storage.from_(self.bucket).upload(
            path=f"{model_type}/manifest.json",
            file=manifest_bytes,
            file_options={"content-type": "application/json", "upsert": "true"},
        )

        logger.info("Cleaned up %d old versions for %s (kept %d)", removed, model_type, keep)
        return removed

    # ------------------------------------------------------------------
    # Promotion decision
    # ------------------------------------------------------------------

    @staticmethod
    def should_promote(
        old_metrics: dict[str, float],
        new_metrics: dict[str, float],
        min_improvement: float = 0.02,
    ) -> bool:
        """
        Decide whether a new model should replace the current active model.

        Checks metrics in priority order:
          1. Brier score (lower is better) — game_winner primary metric
          2. MAE (lower is better) — spread/totals primary metric
          3. Accuracy (higher is better) — fallback

        Returns:
            True if the new model is meaningfully better.
        """
        # Lower-is-better metrics: old - new >= threshold means new is better
        for metric in ("brier_score", "mae"):
            if metric in old_metrics and metric in new_metrics:
                improvement = old_metrics[metric] - new_metrics[metric]
                return improvement >= min_improvement

        # Higher-is-better metrics: new - old >= threshold means new is better
        if "accuracy" in old_metrics and "accuracy" in new_metrics:
            improvement = new_metrics["accuracy"] - old_metrics["accuracy"]
            return improvement >= min_improvement

        # No comparable metrics — do not promote
        logger.warning("Cannot compare metrics for promotion: old=%s, new=%s", old_metrics, new_metrics)
        return False
