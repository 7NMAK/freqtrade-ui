"""
Audit Log model.

IMMUTABLE record of every action taken through the orchestrator.
Rows are NEVER updated or deleted (safety rule #9).
"""
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    """
    Immutable action log.
    Every significant action = one row. Never modified. Never deleted.
    """
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # What happened
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    # e.g. "bot.start", "bot.stop", "kill_switch.soft", "kill_switch.hard",
    #       "strategy.promote", "strategy.retire", "config.update"

    # Who did it
    actor: Mapped[str] = mapped_column(String(100), default="system", nullable=False)

    # Which bot/strategy (optional)
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "bot" or "strategy"
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Details (JSON string of relevant context)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
