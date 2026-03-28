"""
Kill Switch API routes.

Soft Kill = POST /api/v1/stop → stops trading, positions stay open
Hard Kill = POST /api/v1/forceexit(all) + stop → closes all + stops

Recovery is MANUAL ONLY (safety rule #6).
Every activation logged to risk_events (immutable).
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
):
    """Soft Kill one bot — stop trading, positions stay open."""
    ks = request.app.state.kill_switch
    try:
        result = await ks.soft_kill_bot(
            db=db, bot_id=bot_id, trigger="manual", reason=body.reason, actor="user",
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
):
    """Hard Kill one bot — close all positions + stop."""
    ks = request.app.state.kill_switch
    try:
        result = await ks.hard_kill_bot(
            db=db, bot_id=bot_id, trigger="manual", reason=body.reason, actor="user",
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
):
    """Soft Kill ALL running bots."""
    ks = request.app.state.kill_switch
    result = await ks.soft_kill_all(
        db=db, trigger="manual", reason=body.reason, actor="user",
    )
    return {"status": "soft_killed_all", "results": result}


@router.post("/hard-all")
async def hard_kill_all(
    body: KillRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Hard Kill ALL running bots — nuclear option."""
    ks = request.app.state.kill_switch
    result = await ks.hard_kill_all(
        db=db, trigger="manual", reason=body.reason, actor="user",
    )
    return {"status": "hard_killed_all", "results": result}


# ── Risk Events (read-only) ─────────────────────────────────

@router.get("/events")
async def list_risk_events(
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
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
