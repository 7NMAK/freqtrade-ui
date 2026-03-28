"""
Kill Switch API routes.

Soft Kill = POST /api/v1/stop → stops trading, positions stay open
Hard Kill = POST /api/v1/forceexit(all) + stop → closes all + stops

Recovery is MANUAL ONLY (safety rule #6).
Every activation logged to risk_events (immutable).
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..database import get_db
from ..models.risk_event import RiskEvent

router = APIRouter()


class KillRequest(BaseModel):
    reason: str = ""


# ── Single bot ───────────────────────────────────────────────

@router.post("/soft/{bot_id}")
async def soft_kill_bot(
    bot_id: int,
    body: KillRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> dict[str, Any]:
    """Soft Kill one bot — stop trading, positions stay open."""
    actor = auth_payload.get("sub", "user")
    ks = request.app.state.kill_switch
    try:
        result = await ks.soft_kill_bot(
            db=db, bot_id=bot_id, trigger="manual", reason=body.reason, actor=actor,
        )
        return {"status": "soft_killed", "result": result}
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/hard/{bot_id}")
async def hard_kill_bot(
    bot_id: int,
    body: KillRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> dict[str, Any]:
    """Hard Kill one bot — close all positions + stop."""
    actor = auth_payload.get("sub", "user")
    ks = request.app.state.kill_switch
    try:
        result = await ks.hard_kill_bot(
            db=db, bot_id=bot_id, trigger="manual", reason=body.reason, actor=actor,
        )
        return {"status": "hard_killed", "result": result}
    except ValueError as e:
        raise HTTPException(404, str(e))


# ── All bots ─────────────────────────────────────────────────

@router.post("/soft-all")
async def soft_kill_all(
    body: KillRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> dict[str, Any]:
    """Soft Kill ALL running bots."""
    actor = auth_payload.get("sub", "user")
    ks = request.app.state.kill_switch
    result = await ks.soft_kill_all(
        db=db, trigger="manual", reason=body.reason, actor=actor,
    )
    return {"status": "soft_killed_all", "results": result}


@router.post("/hard-all")
async def hard_kill_all(
    body: KillRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> dict[str, Any]:
    """Hard Kill ALL running bots — nuclear option."""
    actor = auth_payload.get("sub", "user")
    ks = request.app.state.kill_switch
    result = await ks.hard_kill_all(
        db=db, trigger="manual", reason=body.reason, actor=actor,
    )
    return {"status": "hard_killed_all", "results": result}


# ── Risk Events (read-only) ─────────────────────────────────

@router.get("/events")
async def list_risk_events(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=1000),
) -> list[dict[str, Any]]:
    """List risk events (kill switch activations). Immutable audit trail."""
    result = await db.execute(
        select(RiskEvent).order_by(RiskEvent.created_at.desc()).limit(limit)
    )
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "bot_instance_id": e.bot_instance_id,
            "kill_type": e.kill_type.value,
            "trigger": e.trigger.value,
            "reason": e.reason,
            "triggered_by": e.triggered_by,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
