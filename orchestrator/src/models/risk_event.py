"""
Risk Event model.

Logs every kill switch activation.
This is an IMMUTABLE audit trail — rows are never updated or deleted (safety rule #9).
"""
import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class KillType(str, enum.Enum):
    """Kill switch action type."""
    SOFT_KILL = "soft_kill"    # POST /api/v1/stop — stops trading, positions stay open
    HARD_KILL = "hard_kill"    # POST /api/v1/forceexit + stop — closes all positions + stops


class KillTrigger(str, enum.Enum):
    """What triggered the kill switch."""
    MANUAL = "manual"                # User pressed the button
    HEARTBEAT_FAILURE = "heartbeat"  # 3 consecutive ping failures
    DRAWDOWN_LIMIT = "drawdown"      # Cross-bot drawdown exceeded


class RiskEvent(Base, TimestampMixin):
    """
    Immutable log of kill switch activations.
    NEVER updated. NEVER deleted.
    """
    __tablename__ = "risk_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which bot was affected (null = all bots for HARD KILL ALL)
    bot_instance_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bot_instances.id"), nullable=True
    )

    # What happened
    kill_type: Mapped[KillType] = mapped_column(Enum(KillType), nullable=False)
    trigger: Mapped[KillTrigger] = mapped_column(Enum(KillTrigger), nullable=False)

    # Details
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Who did it
    triggered_by: Mapped[str] = mapped_column(
        String(100), default="system", nullable=False
    )
