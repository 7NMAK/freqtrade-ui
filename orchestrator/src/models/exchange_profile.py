"""
Exchange Profile model — reusable encrypted credential sets.

Convenience feature: save and reuse API credentials across bots.
When deploying to a bot, user can pick a profile → credentials copied to bot.
Profile is template only. Bot owns its own copy. Updating profile doesn't affect existing bots.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ExchangeProfile(Base):
    """
    Reusable exchange API credential set.
    
    Names are human-readable (e.g., "My Binance Futures").
    All sensitive fields are encrypted at application level.
    """
    __tablename__ = "exchange_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Human-readable name for this credential set
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Which exchange (binance, bybit, okx, hyperliquid, etc.)
    exchange_name: Mapped[str] = mapped_column(String(50), nullable=False)

    # Encrypted API key (stored encrypted, decrypted by orchestrator)
    api_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Encrypted API secret (stored encrypted, decrypted by orchestrator)
    api_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    # API password (some exchanges require this; encrypted at app level)
    api_password: Mapped[str | None] = mapped_column(Text, nullable=True)

    # UID or other identifier (depends on exchange)
    uid: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Optional subaccount name
    subaccount: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Soft delete (never hard delete)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
