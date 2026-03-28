"""
Strategy Lifecycle API routes.

Tracks strategy lifecycle: DRAFT → BACKTEST → PAPER → LIVE → RETIRED
This is metadata only — the actual strategy code lives in FT.

PAPER → LIVE = change dry_run flag in FT config. That's it.
Strategy .py files live in FT: /opt/freqtrade/user_data/strategies/
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.strategy import Strategy, StrategyLifecycle
from ..models.audit_log import AuditLog

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────

class StrategyCreateRequest(BaseModel):
    name: str  # Must match FT strategy class name exactly
    description: str | None = None
    bot_instance_id: int | None = None


class StrategyUpdateRequest(BaseModel):
    lifecycle: str | None = None  # draft, backtest, paper, live, retired
    description: str | None = None
    bot_instance_id: int | None = None


class StrategyResponse(BaseModel):
    id: int
    name: str
    lifecycle: str
    bot_instance_id: int | None
    description: str | None

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────────

@router.get("/", response_model=list[StrategyResponse])
async def list_strategies(db: AsyncSession = Depends(get_db)):
    """List all strategies (excludes soft-deleted)."""
    result = await db.execute(
        select(Strategy).where(Strategy.is_deleted == False)
    )
    strategies = result.scalars().all()
    return [
        StrategyResponse(
            id=s.id,
            name=s.name,
            lifecycle=s.lifecycle.value,
            bot_instance_id=s.bot_instance_id,
            description=s.description,
        )
        for s in strategies
    ]


@router.post("/", response_model=StrategyResponse, status_code=201)
async def create_strategy(
    body: StrategyCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a strategy (metadata only — FT has the actual .py file)."""
    strategy = Strategy(
        name=body.name,
        description=body.description,
        bot_instance_id=body.bot_instance_id,
        lifecycle=StrategyLifecycle.DRAFT,
    )
    db.add(strategy)
    await db.flush()

    db.add(AuditLog(
        action="strategy.create",
        actor="user",
        target_type="strategy",
        target_id=strategy.id,
        target_name=strategy.name,
    ))

    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        lifecycle=strategy.lifecycle.value,
        bot_instance_id=strategy.bot_instance_id,
        description=strategy.description,
    )


@router.get("/{strategy_id}", response_model=StrategyResponse)
async def get_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single strategy."""
    result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted == False,
        )
    )
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")
    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        lifecycle=strategy.lifecycle.value,
        bot_instance_id=strategy.bot_instance_id,
        description=strategy.description,
    )


@router.patch("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(
    strategy_id: int,
    body: StrategyUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Update strategy metadata (lifecycle, description, bot assignment).
    Lifecycle transitions are validated:
      DRAFT → BACKTEST → PAPER → LIVE → RETIRED
    """
    result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted == False,
        )
    )
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    old_lifecycle = strategy.lifecycle.value

    if body.lifecycle:
        try:
            new_lifecycle = StrategyLifecycle(body.lifecycle)
        except ValueError:
            raise HTTPException(400, f"Invalid lifecycle: {body.lifecycle}")

        # Validate transition (only forward, or retire from any state)
        valid_transitions = {
            StrategyLifecycle.DRAFT: [StrategyLifecycle.BACKTEST, StrategyLifecycle.RETIRED],
            StrategyLifecycle.BACKTEST: [StrategyLifecycle.PAPER, StrategyLifecycle.RETIRED],
            StrategyLifecycle.PAPER: [StrategyLifecycle.LIVE, StrategyLifecycle.RETIRED],
            StrategyLifecycle.LIVE: [StrategyLifecycle.RETIRED],
            StrategyLifecycle.RETIRED: [],  # Terminal state
        }

        if new_lifecycle not in valid_transitions.get(strategy.lifecycle, []):
            raise HTTPException(
                400,
                f"Invalid transition: {strategy.lifecycle.value} → {body.lifecycle}. "
                f"Valid: {[v.value for v in valid_transitions.get(strategy.lifecycle, [])]}",
            )

        strategy.lifecycle = new_lifecycle

    if body.description is not None:
        strategy.description = body.description

    if body.bot_instance_id is not None:
        strategy.bot_instance_id = body.bot_instance_id

    db.add(AuditLog(
        action="strategy.update",
        actor="user",
        target_type="strategy",
        target_id=strategy.id,
        target_name=strategy.name,
        details=json.dumps({
            "old_lifecycle": old_lifecycle,
            "new_lifecycle": strategy.lifecycle.value,
        }),
    ))

    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        lifecycle=strategy.lifecycle.value,
        bot_instance_id=strategy.bot_instance_id,
        description=strategy.description,
    )


@router.delete("/{strategy_id}", response_model=StrategyResponse)
async def delete_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    """Soft-delete a strategy (never hard delete — safety rule #7)."""
    result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted == False,
        )
    )
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    strategy.is_deleted = True

    db.add(AuditLog(
        action="strategy.delete",
        actor="user",
        target_type="strategy",
        target_id=strategy.id,
        target_name=strategy.name,
    ))

    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        lifecycle=strategy.lifecycle.value,
        bot_instance_id=strategy.bot_instance_id,
        description=strategy.description,
    )
