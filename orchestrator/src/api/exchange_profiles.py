"""
Exchange Profiles API routes.

Manages reusable encrypted API credential sets for exchanges.
Profiles serve as templates — when deploying to a bot, credentials are copied to that bot.
Updating a profile doesn't affect bots already using it.

Field security: api_key and api_secret are encrypted at application level.
API always returns has_api_key: bool, never the actual key.
"""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..crypto import encrypt
from ..database import get_db
from ..models.exchange_profile import ExchangeProfile
from ..activity_logger import log_activity

router = APIRouter()

# Supported exchanges (must match FT's SUPPORTED_EXCHANGES)
SUPPORTED_EXCHANGES = [
    "binance",
    "bybit",
    "okx",
    "hyperliquid",
    "bitget",
    "kraken",
    "kucoin",
    "gate",
]


# ── Pydantic Schemas ──────────────────────────────────────────

class ExchangeProfileCreate(BaseModel):
    """Request body for creating a new exchange profile."""
    name: str = Field(..., min_length=1, max_length=100)
    exchange_name: str = Field(..., pattern="^[a-z0-9]+$")
    api_key: str | None = Field(None, min_length=1)
    api_secret: str | None = Field(None, min_length=1)
    api_password: str | None = Field(None, min_length=0)
    uid: str | None = Field(None, min_length=1, max_length=100)
    subaccount: str | None = Field(None, min_length=1, max_length=100)

    @field_validator("exchange_name")
    @classmethod
    def validate_exchange(cls, v: str) -> str:
        """Validate that exchange_name is supported."""
        if v.lower() not in SUPPORTED_EXCHANGES:
            raise ValueError(
                f"exchange_name must be one of: {', '.join(SUPPORTED_EXCHANGES)}"
            )
        return v.lower()


class ExchangeProfileUpdate(BaseModel):
    """Request body for updating an exchange profile (all fields optional)."""
    name: str | None = Field(None, min_length=1, max_length=100)
    exchange_name: str | None = Field(None, pattern="^[a-z0-9]+$")
    api_key: str | None = Field(None, min_length=1)
    api_secret: str | None = Field(None, min_length=1)
    api_password: str | None = Field(None, min_length=0)
    uid: str | None = Field(None, min_length=1, max_length=100)
    subaccount: str | None = Field(None, min_length=1, max_length=100)

    @field_validator("exchange_name")
    @classmethod
    def validate_exchange(cls, v: str | None) -> str | None:
        """Validate that exchange_name is supported."""
        if v is None:
            return v
        if v.lower() not in SUPPORTED_EXCHANGES:
            raise ValueError(
                f"exchange_name must be one of: {', '.join(SUPPORTED_EXCHANGES)}"
            )
        return v.lower()


class ExchangeProfileResponse(BaseModel):
    """Response for a single exchange profile."""
    id: int
    name: str
    exchange_name: str
    has_api_key: bool
    has_api_secret: bool
    uid: str | None
    subaccount: str | None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)


class ExchangeProfileListResponse(BaseModel):
    """Response for listing profiles."""
    total: int
    items: list[ExchangeProfileResponse]


# ── Helper Functions ──────────────────────────────────────────

async def _get_profile_or_404(
    db: AsyncSession,
    profile_id: int,
) -> ExchangeProfile:
    """Helper to fetch a profile by ID or raise 404."""
    result = await db.execute(
        select(ExchangeProfile).where(
            and_(
                ExchangeProfile.id == profile_id,
                ExchangeProfile.is_deleted.is_(False),
            )
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Exchange profile not found")
    return profile


def _format_profile_response(profile: ExchangeProfile) -> dict[str, Any]:
    """Convert ExchangeProfile model to response DTO."""
    return {
        "id": profile.id,
        "name": profile.name,
        "exchange_name": profile.exchange_name,
        "has_api_key": bool(profile.api_key_enc),
        "has_api_secret": bool(profile.api_secret_enc),
        "uid": profile.uid,
        "subaccount": profile.subaccount,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


# ── Routes ───────────────────────────────────────────────────

@router.get("/", response_model=ExchangeProfileListResponse)
async def list_exchange_profiles(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    exchange: str | None = Query(None),
    current_user: dict = Depends(require_auth),
) -> ExchangeProfileListResponse:
    """
    List all exchange profiles (excluding soft-deleted).
    Optionally filter by exchange_name.
    """
    query = select(ExchangeProfile).where(ExchangeProfile.is_deleted.is_(False))

    if exchange:
        query = query.where(ExchangeProfile.exchange_name == exchange.lower())

    # Count total (apply the same filters as the main query)
    from sqlalchemy import func
    count_query = select(func.count(ExchangeProfile.id)).where(ExchangeProfile.is_deleted.is_(False))
    if exchange:
        count_query = count_query.where(ExchangeProfile.exchange_name == exchange.lower())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Fetch paginated results
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    profiles = result.scalars().all()

    items = [
        ExchangeProfileResponse(**_format_profile_response(p))
        for p in profiles
    ]

    return ExchangeProfileListResponse(total=total, items=items)


@router.post("/", response_model=ExchangeProfileResponse, status_code=201)
async def create_exchange_profile(
    req: ExchangeProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> ExchangeProfileResponse:
    """
    Create a new exchange profile.

    API keys and secrets are encrypted at application level before storage.
    """
    if req.exchange_name.lower() not in SUPPORTED_EXCHANGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported exchange. Supported: {', '.join(SUPPORTED_EXCHANGES)}",
        )

    # Create new profile
    profile = ExchangeProfile(
        name=req.name,
        exchange_name=req.exchange_name.lower(),
        api_key_enc=encrypt(req.api_key) if req.api_key else None,
        api_secret_enc=encrypt(req.api_secret) if req.api_secret else None,
        api_password=encrypt(req.api_password) if req.api_password else None,
        uid=req.uid,
        subaccount=req.subaccount,
    )

    db.add(profile)
    await db.flush()  # Get the ID before commit

    # Audit log
    await log_activity(
        db,
        action="exchange_profile.create",
        level="info",
        actor=current_user.get("username", "unknown"),
        target_type="exchange_profile",
        target_id=profile.id,
        target_name=profile.name,
        details=f"Created exchange profile for {profile.exchange_name}",
    )

    await db.commit()

    return ExchangeProfileResponse(**_format_profile_response(profile))


@router.get("/{profile_id}", response_model=ExchangeProfileResponse)
async def get_exchange_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> ExchangeProfileResponse:
    """Get a single exchange profile by ID."""
    profile = await _get_profile_or_404(db, profile_id)
    return ExchangeProfileResponse(**_format_profile_response(profile))


@router.patch("/{profile_id}", response_model=ExchangeProfileResponse)
async def update_exchange_profile(
    profile_id: int,
    req: ExchangeProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> ExchangeProfileResponse:
    """
    Partially update an exchange profile.

    Only provided fields are updated; omitted fields remain unchanged.
    """
    profile = await _get_profile_or_404(db, profile_id)

    updates = []

    if req.name is not None:
        profile.name = req.name
        updates.append(f"name={req.name}")

    if req.exchange_name is not None:
        if req.exchange_name.lower() not in SUPPORTED_EXCHANGES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported exchange. Supported: {', '.join(SUPPORTED_EXCHANGES)}",
            )
        profile.exchange_name = req.exchange_name.lower()
        updates.append(f"exchange={req.exchange_name.lower()}")

    if req.api_key is not None:
        profile.api_key_enc = encrypt(req.api_key)
        updates.append("api_key")

    if req.api_secret is not None:
        profile.api_secret_enc = encrypt(req.api_secret)
        updates.append("api_secret")

    if req.api_password is not None:
        profile.api_password = encrypt(req.api_password)
        updates.append("api_password")

    if req.uid is not None:
        profile.uid = req.uid
        updates.append(f"uid={req.uid}")

    if req.subaccount is not None:
        profile.subaccount = req.subaccount
        updates.append(f"subaccount={req.subaccount}")

    # Audit log
    if updates:
        await log_activity(
            db,
            action="exchange_profile.update",
            level="info",
            actor=current_user.get("username", "unknown"),
            target_type="exchange_profile",
            target_id=profile.id,
            target_name=profile.name,
            details=f"Updated fields: {', '.join(updates)}",
        )

    await db.commit()

    return ExchangeProfileResponse(**_format_profile_response(profile))


@router.delete("/{profile_id}", status_code=204)
async def delete_exchange_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> None:
    """
    Soft-delete an exchange profile.

    Never hard-deletes; sets is_deleted = True for audit trail.
    """
    profile = await _get_profile_or_404(db, profile_id)

    profile.is_deleted = True

    await log_activity(
        db,
        action="exchange_profile.delete",
        level="info",
        actor=current_user.get("username", "unknown"),
        target_type="exchange_profile",
        target_id=profile.id,
        target_name=profile.name,
        details="Soft-deleted exchange profile",
    )

    await db.commit()


@router.get("/{profile_id}/bots", response_model=list[dict])
async def get_bots_using_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> list[dict]:
    """
    List all bot instances using this exchange profile.

    This allows the user to see which bots depend on a profile before deleting it.
    """
    profile = await _get_profile_or_404(db, profile_id)

    # Import BotInstance here to avoid circular imports
    from ..models.bot_instance import BotInstance

    result = await db.execute(
        select(BotInstance).where(
            and_(
                BotInstance.exchange_profile_id == profile_id,
                BotInstance.is_deleted.is_(False),
            )
        )
    )
    bots = result.scalars().all()

    return [
        {
            "id": bot.id,
            "name": bot.name,
            "exchange_profile_id": bot.exchange_profile_id,
        }
        for bot in bots
    ]
