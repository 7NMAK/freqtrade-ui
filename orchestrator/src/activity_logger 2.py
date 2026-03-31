"""
Activity Logger — writes structured events to both Python logging AND the audit_log DB table.
Every significant event gets persisted so we can always answer "what happened?"

Usage:
    from .activity_logger import log_activity
    await log_activity(db, action="bot.start", bot_id=1, bot_name="BTC_Scalper")

Rules:
    - AuditLog rows are IMMUTABLE — never update, never delete (safety rule #9)
    - Every log entry gets a timestamp from TimestampMixin
    - Diagnosis MUST be included for ALL error-level entries
    - No sensitive data in logs (no passwords, no tokens)
"""
import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from .models.audit_log import AuditLog

logger = logging.getLogger("orchestrator.activity")

# Map our level strings to Python logging levels
_LEVEL_MAP = {
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR,
    "critical": logging.CRITICAL,
}


async def log_activity(
    db: AsyncSession,
    action: str,
    level: str = "info",
    actor: str = "system",
    bot_id: int | None = None,
    bot_name: str | None = None,
    target_type: str | None = None,
    target_id: int | None = None,
    target_name: str | None = None,
    details: str | None = None,
    diagnosis: str | None = None,
) -> AuditLog:
    """
    Log to both Python logger and DB audit_log table.

    Args:
        db: Async SQLAlchemy session (caller manages commit)
        action: Dot-notation action name (e.g. "bot.start", "ft.connection_failed")
        level: Severity — "info", "warning", "error", "critical"
        actor: Who triggered this (username or "system")
        bot_id: Bot instance ID for per-bot filtering
        bot_name: Bot display name for convenience
        target_type: What was acted on ("bot", "strategy", etc.)
        target_id: ID of the target
        target_name: Name of the target
        details: JSON string or plain text with context
        diagnosis: Actionable diagnosis for errors — REQUIRED for error/critical level

    Returns:
        The created AuditLog row (already added to session, not yet committed)
    """
    # Validate level
    if level not in _LEVEL_MAP:
        level = "info"

    # Build details JSON, including diagnosis if provided
    details_obj: dict | None = None
    if details or diagnosis:
        if details:
            try:
                details_obj = json.loads(details)
            except (json.JSONDecodeError, TypeError):
                details_obj = {"message": details}
        else:
            details_obj = {}
        if diagnosis:
            details_obj["diagnosis"] = diagnosis

    details_str = json.dumps(details_obj) if details_obj else None

    # 1. Log to Python logger at the appropriate level
    py_level = _LEVEL_MAP[level]
    log_parts = [f"[{action}]"]
    if bot_name:
        log_parts.append(f"bot={bot_name}")
    elif bot_id is not None:
        log_parts.append(f"bot_id={bot_id}")
    if target_type:
        log_parts.append(f"target={target_type}:{target_id}:{target_name}")
    if actor != "system":
        log_parts.append(f"actor={actor}")
    if diagnosis:
        log_parts.append(f"DIAGNOSIS: {diagnosis}")
    elif details:
        # Truncate long details for log line
        log_parts.append(details[:200])

    logger.log(py_level, " ".join(log_parts))

    # 2. Create immutable AuditLog DB row
    row = AuditLog(
        action=action,
        level=level,
        actor=actor,
        bot_id=bot_id,
        bot_name=bot_name,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        details=details_str,
    )
    db.add(row)

    return row
