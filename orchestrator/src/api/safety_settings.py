"""
Safety Settings API — user-editable risk controls surfaced in the Settings UI.

Reads/writes the single-row `orch_settings` table. Values override the
fallback defaults in config.py. Enforcement code elsewhere reads via
get_safety_settings(db).
"""
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..database import get_db
from ..models.audit_log import AuditLog
from ..models.orch_settings import OrchSettings

router = APIRouter()


class SafetySettingsResponse(BaseModel):
    max_leverage: int
    portfolio_exposure_pct: int
    daily_loss_threshold_pct: int
    daily_loss_action: Literal["soft_kill_all", "hard_kill_all"]
    require_typed_go_live: bool
    forbid_unlimited_stake_live: bool
    updated_at: datetime | None = None
    updated_by: str | None = None


class SafetySettingsUpdate(BaseModel):
    max_leverage: int = Field(ge=1, le=125)
    portfolio_exposure_pct: int = Field(ge=1, le=100)
    daily_loss_threshold_pct: int = Field(ge=1, le=100)
    daily_loss_action: Literal["soft_kill_all", "hard_kill_all"]
    require_typed_go_live: bool
    forbid_unlimited_stake_live: bool


async def get_safety_settings(db: AsyncSession) -> OrchSettings:
    """Get or create the single OrchSettings row. Returns row with defaults if absent."""
    result = await db.execute(select(OrchSettings).where(OrchSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        row = OrchSettings(id=1)
        db.add(row)
        await db.flush()
    return row


@router.get("/safety", response_model=SafetySettingsResponse)
async def read_safety_settings(
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
) -> SafetySettingsResponse:
    row = await get_safety_settings(db)
    return SafetySettingsResponse(
        max_leverage=row.max_leverage,
        portfolio_exposure_pct=row.portfolio_exposure_pct,
        daily_loss_threshold_pct=row.daily_loss_threshold_pct,
        daily_loss_action=row.daily_loss_action,
        require_typed_go_live=row.require_typed_go_live,
        forbid_unlimited_stake_live=row.forbid_unlimited_stake_live,
        updated_at=row.updated_at,
        updated_by=row.updated_by,
    )


@router.put("/safety", response_model=SafetySettingsResponse)
async def update_safety_settings(
    body: SafetySettingsUpdate,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
) -> SafetySettingsResponse:
    row = await get_safety_settings(db)

    # Capture before/after for audit log
    before = {
        "max_leverage": row.max_leverage,
        "portfolio_exposure_pct": row.portfolio_exposure_pct,
        "daily_loss_threshold_pct": row.daily_loss_threshold_pct,
        "daily_loss_action": row.daily_loss_action,
        "require_typed_go_live": row.require_typed_go_live,
        "forbid_unlimited_stake_live": row.forbid_unlimited_stake_live,
    }

    # Extra validation — downgrades during live trading are dangerous. Warn
    # via the log but don't block (operator may legitimately tighten limits).
    row.max_leverage = body.max_leverage
    row.portfolio_exposure_pct = body.portfolio_exposure_pct
    row.daily_loss_threshold_pct = body.daily_loss_threshold_pct
    row.daily_loss_action = body.daily_loss_action
    row.require_typed_go_live = body.require_typed_go_live
    row.forbid_unlimited_stake_live = body.forbid_unlimited_stake_live
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by = auth.get("sub", "unknown")

    # Audit log — immutable trail of who changed what
    import json
    db.add(AuditLog(
        action="safety_settings.update",
        level="warning",
        actor=row.updated_by,
        target_type="orch_settings",
        target_name="safety",
        details=json.dumps({"before": before, "after": body.model_dump()}),
    ))
    await db.commit()

    return SafetySettingsResponse(
        max_leverage=row.max_leverage,
        portfolio_exposure_pct=row.portfolio_exposure_pct,
        daily_loss_threshold_pct=row.daily_loss_threshold_pct,
        daily_loss_action=row.daily_loss_action,
        require_typed_go_live=row.require_typed_go_live,
        forbid_unlimited_stake_live=row.forbid_unlimited_stake_live,
        updated_at=row.updated_at,
        updated_by=row.updated_by,
    )
