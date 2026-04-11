"""
Dashboard Snapshot API.

Single endpoint that returns the pre-computed Redis cache built by DashboardWorker.
Replaces the frontend's N×3 per-bot FT API calls with one sub-100ms read.

GET /api/dashboard/snapshot
  → 200 + snapshot JSON  (cache hit)
  → 503 + {"status": "warming_up"}  (first 30s after startup, cache not yet built)
"""
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..config import settings
from ..polling.worker import REDIS_KEY

router = APIRouter()


@router.get("")
async def get_dashboard_snapshot(request: Request) -> dict[str, Any]:
    """
    Return the latest pre-computed dashboard snapshot from Redis.

    Data is refreshed every 30s by DashboardWorker. The TTL is 90s so
    the snapshot is always available even during a slow poll cycle.

    Returns 503 only during the first ~30s after orchestrator startup
    before the first poll cycle completes.
    """
    redis = request.app.state.redis
    raw = await redis.get(REDIS_KEY)

    if raw is None:
        raise HTTPException(
            status_code=503,
            detail={"error": "Dashboard snapshot not yet available", "status": "warming_up"},
        )

    return json.loads(raw)
