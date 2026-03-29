"""
Strategy Lifecycle API routes with Versioning.

Tracks strategy lifecycle: DRAFT → BACKTEST → AI_TESTED → DEPLOYABLE → RETIRED
This is metadata only — the actual strategy code lives in FT.

Strategy code and builder state are now versioned.
Every save in Builder creates an immutable StrategyVersion.
"""
import json
import re
from typing import Any
from difflib import unified_diff

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..database import get_db
from ..models.strategy import Strategy, StrategyLifecycle
from ..models.strategy_version import StrategyVersion
from ..models.audit_log import AuditLog

router = APIRouter()


# ── Pydantic Schemas ──────────────────────────────────────────

class StrategyVersionCreate(BaseModel):
    """Create a new strategy version (on every Builder save)."""
    code: str
    builder_state: dict | None = None
    risk_config: dict | None = None
    callbacks: dict | None = None
    freqai_config: dict | None = None
    changelog: str | None = None


class StrategyVersionResponse(BaseModel):
    """Immutable strategy snapshot."""
    id: int
    strategy_id: int
    version_number: int
    code: str
    builder_state: dict | None = None
    risk_config: dict | None = None
    callbacks: dict | None = None
    freqai_config: dict | None = None
    changelog: str | None = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class StrategyCreateRequest(BaseModel):
    name: str  # Must match FT strategy class name exactly
    description: str | None = None
    bot_instance_id: int | None = None
    code: str | None = None  # Generated .py strategy code (optional)
    builder_state: dict | None = None  # Full Builder snapshot (optional)
    risk_config: dict | None = None  # Risk config (optional)
    callbacks: dict | None = None  # Callbacks config (optional)
    freqai_config: dict | None = None  # FreqAI config (optional)
    exchange: str | None = None  # DEPRECATED: for backward compat
    timeframe: str | None = None  # DEPRECATED: for backward compat


class StrategyUpdateRequest(BaseModel):
    lifecycle: str | None = None  # draft, backtest, ai_tested, deployable, retired
    description: str | None = None
    bot_instance_id: int | None = None
    current_version_id: int | None = None  # Manually pin a version


class StrategyResponse(BaseModel):
    id: int
    name: str
    lifecycle: str
    bot_instance_id: int | None
    description: str | None
    current_version_id: int | None = None
    current_version_number: int | None = None
    version_count: int = 0
    bots_using: int = 0
    # DEPRECATED fields (for backward compat):
    code: str | None = None
    exchange: str | None = None
    timeframe: str | None = None

    model_config = ConfigDict(from_attributes=True)


class VersionDiffResponse(BaseModel):
    """Diff between two versions."""
    v1: StrategyVersionResponse
    v2: StrategyVersionResponse
    code_changed: bool
    risk_changed: bool
    callbacks_changed: bool
    risk_diff: dict[str, dict] | None = None


class StrategyImportRequest(BaseModel):
    """Import a strategy from server or upload."""
    source: str = Field(..., pattern="^(server|upload)$")  # "server" or "upload"
    filename: str | None = None  # For server import
    code: str | None = None  # For upload import


# ── Helper Functions ──────────────────────────────────────────

async def parse_strategy_code(code: str) -> dict:
    """
    Extract strategy metadata from Python code using regex.
    Returns: { class_name, timeframe, stoploss, roi }
    """
    result = {}

    # Extract class name
    class_match = re.search(r'class\s+(\w+)\s*\(\s*IStrategy\s*\)', code)
    if class_match:
        result["class_name"] = class_match.group(1)

    # Extract timeframe
    timeframe_match = re.search(r'timeframe\s*=\s*["\'](\w+)["\']', code)
    if timeframe_match:
        result["timeframe"] = timeframe_match.group(1)

    # Extract stoploss
    stoploss_match = re.search(r'stoploss\s*=\s*(-?[\d.]+)', code)
    if stoploss_match:
        result["stoploss"] = float(stoploss_match.group(1))

    # Extract minimal_roi
    roi_match = re.search(r'minimal_roi\s*=\s*(\{[^}]+\})', code, re.DOTALL)
    if roi_match:
        try:
            import ast
            roi_str = roi_match.group(1)
            result["minimal_roi"] = ast.literal_eval(roi_str)
        except (ValueError, SyntaxError):
            pass  # non-blocking — ROI parse failed, strategy still imports

    return result


async def get_strategy_version_count(strategy_id: int, db: AsyncSession) -> int:
    """Count versions for a strategy."""
    result = await db.execute(
        select(func.count(StrategyVersion.id)).where(
            StrategyVersion.strategy_id == strategy_id
        )
    )
    return result.scalar() or 0


async def get_bots_using_strategy(strategy_id: int, db: AsyncSession) -> int:
    """Count non-deleted bots whose strategy_version_id points to any version of this strategy."""
    from ..models.bot_instance import BotInstance

    version_ids_q = select(StrategyVersion.id).where(StrategyVersion.strategy_id == strategy_id)
    bots_count_result = await db.execute(
        select(func.count(BotInstance.id)).where(
            BotInstance.strategy_version_id.in_(version_ids_q),
            BotInstance.is_deleted == False,  # noqa: E712
        )
    )
    return bots_count_result.scalar() or 0


# ── Routes ───────────────────────────────────────────────────

# ── Specific Routes (must come before parametrized routes)

import os
import time

STRATEGY_DIR = "/opt/freqtrade/user_data/strategies"

_strategies_cache: list[str] | None = None
_strategies_cache_time: float = 0


@router.get("/available", response_model=list[str])
async def get_available_strategies() -> list[str]:
    """
    List .py strategy files from the shared Docker volume mount.
    Results are cached for 30 seconds to avoid repeated filesystem reads.
    """
    global _strategies_cache, _strategies_cache_time

    if _strategies_cache is not None and time.time() - _strategies_cache_time < 30:
        return _strategies_cache

    if not os.path.isdir(STRATEGY_DIR):
        _strategies_cache = []
        _strategies_cache_time = time.time()
        return []

    result = sorted([
        f for f in os.listdir(STRATEGY_DIR)
        if f.endswith(".py") and not f.startswith("__")
    ])

    _strategies_cache = result
    _strategies_cache_time = time.time()
    return result


@router.post("/import", response_model=StrategyResponse, status_code=201)
async def import_strategy(
    body: StrategyImportRequest,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> StrategyResponse:
    """
    Import a strategy from FT server volume mount or upload.
    Parses code to extract: class name, timeframe, stoploss, minimal_roi.
    Auto-creates strategy in DRAFT + v1.
    """
    code = None
    class_name = None

    if body.source == "server":
        if not body.filename:
            raise HTTPException(400, "filename required for server import")

        # Read from shared Docker volume mount
        filepath = os.path.join(STRATEGY_DIR, body.filename)
        # Prevent path traversal
        if not os.path.realpath(filepath).startswith(os.path.realpath(STRATEGY_DIR)):
            raise HTTPException(400, "Invalid filename")
        if not os.path.isfile(filepath):
            raise HTTPException(404, f"Strategy file not found: {body.filename}")
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                code = f.read()
        except Exception as e:
            raise HTTPException(500, f"Failed to read strategy: {str(e)}")

    elif body.source == "upload":
        if not body.code:
            raise HTTPException(400, "code required for upload import")
        code = body.code

    else:
        raise HTTPException(400, "source must be 'server' or 'upload'")

    # Parse strategy code
    metadata = await parse_strategy_code(code)
    class_name = metadata.get("class_name")

    if not class_name:
        raise HTTPException(400, "Could not parse strategy class name from code")

    # Check duplicate
    existing = await db.execute(
        select(Strategy).where(
            Strategy.name == class_name,
            Strategy.is_deleted.is_(False),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Strategy '{class_name}' already exists")

    # Create strategy
    strategy = Strategy(
        name=class_name,
        description=f"Imported from {body.source}",
        exchange=metadata.get("exchange"),
        timeframe=metadata.get("timeframe"),
        lifecycle=StrategyLifecycle.DRAFT,
        code=code,  # DEPRECATED: for backward compat
    )
    db.add(strategy)
    await db.flush()

    # Create v1
    v1 = StrategyVersion(
        strategy_id=strategy.id,
        version_number=1,
        code=code,
        changelog="Imported from server" if body.source == "server" else "Imported via upload",
    )
    db.add(v1)
    await db.flush()
    strategy.current_version_id = v1.id

    actor = auth_payload.get("sub", "user")
    db.add(AuditLog(
        action="strategy.import",
        actor=actor,
        target_type="strategy",
        target_id=strategy.id,
        target_name=strategy.name,
        details=json.dumps({"source": body.source, "filename": body.filename}),
    ))

    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        lifecycle=strategy.lifecycle.value,
        bot_instance_id=None,
        description=strategy.description,
        current_version_id=strategy.current_version_id,
        current_version_number=1,
        version_count=1,
        bots_using=0,
        code=strategy.code,
        exchange=strategy.exchange,
        timeframe=strategy.timeframe,
    )


# ── Main CRUD Routes

@router.get("/", response_model=list[StrategyResponse])
async def list_strategies(db: AsyncSession = Depends(get_db)) -> list[StrategyResponse]:
    """List all strategies (excludes soft-deleted)."""
    result = await db.execute(
        select(Strategy).where(Strategy.is_deleted.is_(False))
    )
    strategies = result.scalars().all()

    responses = []
    for s in strategies:
        version_count = await get_strategy_version_count(s.id, db)
        bots_using = await get_bots_using_strategy(s.id, db)
        current_version_number = None
        if s.current_version_id:
            v_result = await db.execute(
                select(StrategyVersion).where(StrategyVersion.id == s.current_version_id)
            )
            current_version = v_result.scalar_one_or_none()
            if current_version:
                current_version_number = current_version.version_number

        responses.append(StrategyResponse(
            id=s.id,
            name=s.name,
            lifecycle=s.lifecycle.value,
            bot_instance_id=s.bot_instance_id,
            description=s.description,
            current_version_id=s.current_version_id,
            current_version_number=current_version_number,
            version_count=version_count,
            bots_using=bots_using,
            code=s.code,  # DEPRECATED
            exchange=s.exchange,  # DEPRECATED
            timeframe=s.timeframe,  # DEPRECATED
        ))

    return responses


@router.post("/", response_model=StrategyResponse, status_code=201)
async def create_strategy(
    body: StrategyCreateRequest,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> StrategyResponse:
    """
    Register a strategy.
    If code is provided, auto-creates v1.
    """
    # Check duplicate strategy name
    existing = await db.execute(
        select(Strategy).where(
            Strategy.name == body.name,
            Strategy.is_deleted.is_(False),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Strategy with name '{body.name}' already exists")

    strategy = Strategy(
        name=body.name,
        description=body.description,
        bot_instance_id=body.bot_instance_id,
        code=body.code,  # DEPRECATED: kept for backward compat
        builder_state=body.builder_state,  # DEPRECATED: moved to v1
        exchange=body.exchange,  # DEPRECATED
        timeframe=body.timeframe,  # DEPRECATED
        lifecycle=StrategyLifecycle.DRAFT,
    )
    db.add(strategy)
    await db.flush()

    # If code provided, auto-create v1
    if body.code:
        v1 = StrategyVersion(
            strategy_id=strategy.id,
            version_number=1,
            code=body.code,
            builder_state=body.builder_state,
            risk_config=body.risk_config,
            callbacks=body.callbacks,
            freqai_config=body.freqai_config,
            changelog="Initial version",
        )
        db.add(v1)
        await db.flush()
        strategy.current_version_id = v1.id

    actor = auth_payload.get("sub", "user")
    db.add(AuditLog(
        action="strategy.create",
        actor=actor,
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
        current_version_id=strategy.current_version_id,
        current_version_number=1 if body.code else None,
        version_count=1 if body.code else 0,
        bots_using=0,
        code=strategy.code,
        exchange=strategy.exchange,
        timeframe=strategy.timeframe,
    )


@router.get("/{strategy_id}", response_model=StrategyResponse)
async def get_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
) -> StrategyResponse:
    """Get a single strategy."""
    result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted.is_(False),
        )
    )
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    version_count = await get_strategy_version_count(strategy.id, db)
    bots_using = await get_bots_using_strategy(strategy.id, db)
    current_version_number = None
    if strategy.current_version_id:
        v_result = await db.execute(
            select(StrategyVersion).where(StrategyVersion.id == strategy.current_version_id)
        )
        current_version = v_result.scalar_one_or_none()
        if current_version:
            current_version_number = current_version.version_number

    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        lifecycle=strategy.lifecycle.value,
        bot_instance_id=strategy.bot_instance_id,
        description=strategy.description,
        current_version_id=strategy.current_version_id,
        current_version_number=current_version_number,
        version_count=version_count,
        bots_using=bots_using,
        code=strategy.code,
        exchange=strategy.exchange,
        timeframe=strategy.timeframe,
    )


@router.patch("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(
    strategy_id: int,
    body: StrategyUpdateRequest,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> StrategyResponse:
    """
    Update strategy metadata (lifecycle, description, version pin).
    Lifecycle transitions are validated: DRAFT → BACKTEST → AI_TESTED → DEPLOYABLE → RETIRED
    Can retire from any state.
    """
    result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted.is_(False),
        )
    )
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    old_lifecycle = strategy.lifecycle.value

    if body.lifecycle is not None:
        try:
            new_lifecycle = StrategyLifecycle(body.lifecycle)
        except ValueError:
            raise HTTPException(
                400,
                f"Invalid lifecycle: {body.lifecycle}. "
                f"Must be one of: {', '.join([v.value for v in StrategyLifecycle])}"
            )

        # Validate transition
        valid_transitions = {
            StrategyLifecycle.DRAFT: [
                StrategyLifecycle.BACKTEST,
                StrategyLifecycle.RETIRED,
            ],
            StrategyLifecycle.BACKTEST: [
                StrategyLifecycle.AI_TESTED,
                StrategyLifecycle.DEPLOYABLE,
                StrategyLifecycle.RETIRED,
            ],
            StrategyLifecycle.AI_TESTED: [
                StrategyLifecycle.DEPLOYABLE,
                StrategyLifecycle.RETIRED,
            ],
            StrategyLifecycle.DEPLOYABLE: [
                StrategyLifecycle.RETIRED,
            ],
            StrategyLifecycle.RETIRED: [],  # Terminal state
        }

        if new_lifecycle not in valid_transitions.get(strategy.lifecycle, []):
            raise HTTPException(
                400,
                f"Invalid transition: {strategy.lifecycle.value} → {body.lifecycle}. "
                f"Valid: {[v.value for v in valid_transitions.get(strategy.lifecycle, [])]}"
            )

        strategy.lifecycle = new_lifecycle

    if body.description is not None:
        strategy.description = body.description

    if body.bot_instance_id is not None:
        strategy.bot_instance_id = body.bot_instance_id

    if body.current_version_id is not None:
        # Verify the version exists
        v_result = await db.execute(
            select(StrategyVersion).where(
                StrategyVersion.id == body.current_version_id,
                StrategyVersion.strategy_id == strategy.id,
            )
        )
        if not v_result.scalar_one_or_none():
            raise HTTPException(400, f"Version {body.current_version_id} not found for this strategy")
        strategy.current_version_id = body.current_version_id

    actor = auth_payload.get("sub", "user")
    db.add(AuditLog(
        action="strategy.update",
        actor=actor,
        target_type="strategy",
        target_id=strategy.id,
        target_name=strategy.name,
        details=json.dumps({
            "old_lifecycle": old_lifecycle,
            "new_lifecycle": strategy.lifecycle.value,
        }),
    ))

    version_count = await get_strategy_version_count(strategy.id, db)
    bots_using = await get_bots_using_strategy(strategy.id, db)
    current_version_number = None
    if strategy.current_version_id:
        v_result = await db.execute(
            select(StrategyVersion).where(StrategyVersion.id == strategy.current_version_id)
        )
        current_version = v_result.scalar_one_or_none()
        if current_version:
            current_version_number = current_version.version_number

    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        lifecycle=strategy.lifecycle.value,
        bot_instance_id=strategy.bot_instance_id,
        description=strategy.description,
        current_version_id=strategy.current_version_id,
        current_version_number=current_version_number,
        version_count=version_count,
        bots_using=bots_using,
        code=strategy.code,
        exchange=strategy.exchange,
        timeframe=strategy.timeframe,
    )


@router.delete("/{strategy_id}", response_model=StrategyResponse)
async def delete_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> StrategyResponse:
    """Soft-delete a strategy (never hard delete — safety rule #7)."""
    result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted.is_(False),
        )
    )
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    strategy.is_deleted = True

    actor = auth_payload.get("sub", "user")
    db.add(AuditLog(
        action="strategy.delete",
        actor=actor,
        target_type="strategy",
        target_id=strategy.id,
        target_name=strategy.name,
    ))

    version_count = await get_strategy_version_count(strategy.id, db)
    bots_using = await get_bots_using_strategy(strategy.id, db)
    current_version_number = None
    if strategy.current_version_id:
        v_result = await db.execute(
            select(StrategyVersion).where(StrategyVersion.id == strategy.current_version_id)
        )
        current_version = v_result.scalar_one_or_none()
        if current_version:
            current_version_number = current_version.version_number

    return StrategyResponse(
        id=strategy.id,
        name=strategy.name,
        lifecycle=strategy.lifecycle.value,
        bot_instance_id=strategy.bot_instance_id,
        description=strategy.description,
        current_version_id=strategy.current_version_id,
        current_version_number=current_version_number,
        version_count=version_count,
        bots_using=bots_using,
        code=strategy.code,
        exchange=strategy.exchange,
        timeframe=strategy.timeframe,
    )


# ── Versioning Endpoints

@router.post("/{strategy_id}/versions", response_model=StrategyVersionResponse, status_code=201)
async def create_version(
    strategy_id: int,
    body: StrategyVersionCreate,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> StrategyVersionResponse:
    """
    Create a new version (on every Builder save).
    Auto-increments version_number and updates strategy.current_version_id.
    """
    # Verify strategy exists
    s_result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted.is_(False),
        )
    )
    strategy = s_result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    # Get max version number
    max_result = await db.execute(
        select(func.max(StrategyVersion.version_number)).where(
            StrategyVersion.strategy_id == strategy_id
        )
    )
    max_version = max_result.scalar() or 0
    next_version_number = max_version + 1

    version = StrategyVersion(
        strategy_id=strategy_id,
        version_number=next_version_number,
        code=body.code,
        builder_state=body.builder_state,
        risk_config=body.risk_config,
        callbacks=body.callbacks,
        freqai_config=body.freqai_config,
        changelog=body.changelog,
    )
    db.add(version)
    await db.flush()

    # Update strategy's current version pointer
    strategy.current_version_id = version.id

    actor = auth_payload.get("sub", "user")
    db.add(AuditLog(
        action="strategy.version.create",
        actor=actor,
        target_type="strategy",
        target_id=strategy_id,
        target_name=strategy.name,
        details=json.dumps({"version_number": next_version_number}),
    ))

    return StrategyVersionResponse(
        id=version.id,
        strategy_id=version.strategy_id,
        version_number=version.version_number,
        code=version.code,
        builder_state=version.builder_state,
        risk_config=version.risk_config,
        callbacks=version.callbacks,
        freqai_config=version.freqai_config,
        changelog=version.changelog,
        created_at=version.created_at.isoformat(),
    )


@router.get("/{strategy_id}/versions", response_model=list[StrategyVersionResponse])
async def list_versions(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[StrategyVersionResponse]:
    """List all versions for a strategy (ordered by version_number DESC)."""
    # Verify strategy exists
    s_result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted.is_(False),
        )
    )
    if not s_result.scalar_one_or_none():
        raise HTTPException(404, "Strategy not found")

    # Get all versions
    result = await db.execute(
        select(StrategyVersion)
        .where(StrategyVersion.strategy_id == strategy_id)
        .order_by(StrategyVersion.version_number.desc())
    )
    versions = result.scalars().all()

    return [
        StrategyVersionResponse(
            id=v.id,
            strategy_id=v.strategy_id,
            version_number=v.version_number,
            code=v.code,
            builder_state=v.builder_state,
            risk_config=v.risk_config,
            callbacks=v.callbacks,
            freqai_config=v.freqai_config,
            changelog=v.changelog,
            created_at=v.created_at.isoformat(),
        )
        for v in versions
    ]


@router.get("/{strategy_id}/versions-diff")
async def get_version_diff(
    strategy_id: int,
    v1: int = Query(..., description="First version number"),
    v2: int = Query(..., description="Second version number"),
    db: AsyncSession = Depends(get_db),
) -> VersionDiffResponse:
    """
    Get diff between two versions.
    Returns code, risk, and callback changes.
    """
    # Verify strategy exists
    s_result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted.is_(False),
        )
    )
    if not s_result.scalar_one_or_none():
        raise HTTPException(404, "Strategy not found")

    # Get both versions
    v1_result = await db.execute(
        select(StrategyVersion).where(
            StrategyVersion.strategy_id == strategy_id,
            StrategyVersion.version_number == v1,
        )
    )
    version1 = v1_result.scalar_one_or_none()
    if not version1:
        raise HTTPException(404, f"Version {v1} not found")

    v2_result = await db.execute(
        select(StrategyVersion).where(
            StrategyVersion.strategy_id == strategy_id,
            StrategyVersion.version_number == v2,
        )
    )
    version2 = v2_result.scalar_one_or_none()
    if not version2:
        raise HTTPException(404, f"Version {v2} not found")

    # Compare code
    code_changed = version1.code != version2.code

    # Compare risk config
    risk_changed = version1.risk_config != version2.risk_config
    risk_diff = None
    if risk_changed and version1.risk_config and version2.risk_config:
        risk_diff = {}
        all_keys = set(version1.risk_config.keys()) | set(version2.risk_config.keys())
        for key in all_keys:
            old_val = version1.risk_config.get(key)
            new_val = version2.risk_config.get(key)
            if old_val != new_val:
                risk_diff[key] = {"old": old_val, "new": new_val}

    # Compare callbacks
    callbacks_changed = version1.callbacks != version2.callbacks

    return VersionDiffResponse(
        v1=StrategyVersionResponse(
            id=version1.id,
            strategy_id=version1.strategy_id,
            version_number=version1.version_number,
            code=version1.code,
            builder_state=version1.builder_state,
            risk_config=version1.risk_config,
            callbacks=version1.callbacks,
            freqai_config=version1.freqai_config,
            changelog=version1.changelog,
            created_at=version1.created_at.isoformat(),
        ),
        v2=StrategyVersionResponse(
            id=version2.id,
            strategy_id=version2.strategy_id,
            version_number=version2.version_number,
            code=version2.code,
            builder_state=version2.builder_state,
            risk_config=version2.risk_config,
            callbacks=version2.callbacks,
            freqai_config=version2.freqai_config,
            changelog=version2.changelog,
            created_at=version2.created_at.isoformat(),
        ),
        code_changed=code_changed,
        risk_changed=risk_changed,
        callbacks_changed=callbacks_changed,
        risk_diff=risk_diff,
    )


@router.get("/{strategy_id}/versions/{version_number}", response_model=StrategyVersionResponse)
async def get_version(
    strategy_id: int,
    version_number: int,
    db: AsyncSession = Depends(get_db),
) -> StrategyVersionResponse:
    """Get a specific version."""
    # Verify strategy exists
    s_result = await db.execute(
        select(Strategy).where(
            Strategy.id == strategy_id,
            Strategy.is_deleted.is_(False),
        )
    )
    if not s_result.scalar_one_or_none():
        raise HTTPException(404, "Strategy not found")

    result = await db.execute(
        select(StrategyVersion).where(
            StrategyVersion.strategy_id == strategy_id,
            StrategyVersion.version_number == version_number,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(404, f"Version {version_number} not found")

    return StrategyVersionResponse(
        id=version.id,
        strategy_id=version.strategy_id,
        version_number=version.version_number,
        code=version.code,
        builder_state=version.builder_state,
        risk_config=version.risk_config,
        callbacks=version.callbacks,
        freqai_config=version.freqai_config,
        changelog=version.changelog,
        created_at=version.created_at.isoformat(),
    )
