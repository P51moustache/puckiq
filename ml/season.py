"""Season identity shared by training and inference (July 1 UTC rollover)."""
from datetime import datetime, timezone
import re


def resolve_season(now: datetime | None = None, override: str | int | None = None) -> int:
    if override is not None:
        raw = str(override)
        if not re.fullmatch(r"\d{8}", raw) or int(raw[4:]) != int(raw[:4]) + 1:
            raise ValueError("Season must contain consecutive years, e.g. 20262027")
        return int(raw)
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Season resolution requires a timezone-aware date")
    now = now.astimezone(timezone.utc)
    start = now.year if now.month >= 7 else now.year - 1
    return start * 10000 + start + 1


def training_seasons(season: int, count: int = 3) -> list[int]:
    start = resolve_season(override=season) // 10000
    return [year * 10000 + year + 1 for year in range(start - count + 1, start + 1)]
