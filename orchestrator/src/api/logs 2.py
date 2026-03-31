"""
System & per-bot activity log API routes.

AuditLog rows are IMMUTABLE — never updated, never deleted (safety rule #9).
These endpoints provide read-only access for the frontend Log Viewer.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..database import get_db
from ..models.audit_log import AuditLog

router = APIRouter()


def _serialize_log(row: AuditLog) -> dict[str, Any]:
    """Serialize AuditLog row to JSON-safe dict."""
    return {
        "id": row.id,
        "action": row.action,
        "level": row.level,
        "actor": row.actor,
        "bot_id": row.bot_id,
        "bot_name": row.bot_name,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "target_name": row.target_name,
        "details": row.details,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


# ── GET /api/logs — all system logs (paginated) ───────────────────────

@router.get("/")
async def get_system_logs(
    db: AsyncSession = Depends(get_db),
    level: str | None = Query(default=None, description="Filter by level: info, warning, error, critical"),
    bot_id: int | None = Query(default=None, description="Filter by bot ID"),
    action: str | None = Query(default=None, description="Filter by action (exact or prefix match)"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """
    Get all system activity logs with optional filtering.
    Returns newest first.
    """
    query = select(AuditLog)

    # Apply filters
    if level:
        query = query.where(AuditLog.level == level)
    if bot_id is not None:
        query = query.where(AuditLog.bot_id == bot_id)
    if action:
        # Support prefix matching: "bot." matches "bot.start", "bot.stop", etc.
        if action.endswith("."):
            query = query.where(AuditLog.action.like(f"{action}%"))
        else:
            query = query.where(AuditLog.action == action)

    # Count total (before pagination)
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Fetch paginated results
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [_serialize_log(row) for row in logs],
    }


# ── GET /api/logs/bot/{bot_id} — per-bot logs ─────────────────────────

@router.get("/bot/{bot_id}")
async def get_bot_logs(
    bot_id: int,
    db: AsyncSession = Depends(get_db),
    level: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """Get all activity logs for a specific bot."""
    query = select(AuditLog).where(AuditLog.bot_id == bot_id)

    if level:
        query = query.where(AuditLog.level == level)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "bot_id": bot_id,
        "logs": [_serialize_log(row) for row in logs],
    }


# ── GET /api/logs/errors — only error/critical level ──────────────────

@router.get("/errors")
async def get_error_logs(
    db: AsyncSession = Depends(get_db),
    bot_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """Get recent errors and critical events with diagnosis."""
    query = select(AuditLog).where(
        or_(AuditLog.level == "error", AuditLog.level == "critical")
    )

    if bot_id is not None:
        query = query.where(AuditLog.bot_id == bot_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [_serialize_log(row) for row in logs],
    }
