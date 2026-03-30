"""
Audit Log model.

IMMUTABLE record of every action taken through the orchestrator.
Rows are NEVER updated or deleted (safety rule #9).
"""
from sqlalchemy import Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    """
    Immutable action log.
    Every significant action = one row. Never modified. Never deleted.
    """
    __tablename__ = "audit_log"

    __table_args__ = (
        Index("ix_audit_log_created_at_desc", "created_at", postgresql_using="btree"),
        Index("ix_audit_log_bot_id", "bot_id"),
        Index("ix_audit_log_level", "level"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # What happened
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    # e.g. "bot.start", "bot.stop", "kill_switch.soft", "kill_switch.hard",
    #       "strategy.promote", "strategy.retire", "config.update",
    #       "ft.connection_failed", "ft.api_error", "heartbeat.failure"

    # Severity level: info | warning | error | critical
    level: Mapped[str] = mapped_column(String(20), default="info", nullable=False)

    # Who did it
    actor: Mapped[str] = mapped_column(String(100), default="system", nullable=False)

    # Per-bot filtering (nullable for system-wide events)
    bot_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    bot_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Which bot/strategy (optional)
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "bot" or "strategy"
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Details (JSON string of relevant context)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
