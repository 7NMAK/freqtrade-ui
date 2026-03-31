"""
Telegram notifier for AI Validation Layer.

Sends alerts to a Telegram bot when strong_disagree is detected.
Uses the same credentials as the main orchestrator Telegram integration.

Phase 14 — Notifications.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

_TELEGRAM_API = "https://api.telegram.org"


async def send_telegram_alert(message: str) -> bool:
    """
    Send a message to the configured Telegram bot.

    Returns True if successful, False on any error.
    Message is silently dropped (returns False) if Telegram is not configured.
    """
    token = getattr(settings, "telegram_token", None)
    chat_id = getattr(settings, "telegram_chat_id", None)

    if not token or not chat_id:
        logger.debug("Telegram not configured — skipping alert")
        return False

    url = f"{_TELEGRAM_API}/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                return True
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                retry_after = int(exc.response.headers.get("Retry-After", 5))
                logger.warning("Telegram rate limited — retry in %ds", retry_after)
                await asyncio.sleep(retry_after)
            else:
                logger.error("Telegram HTTP error: %s", exc)
                return False
        except Exception as exc:
            logger.error("Telegram send failed (attempt %d/3): %s", attempt + 1, exc)
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)

    return False


def format_strong_disagree_alert(
    bot_id: int,
    bot_name: str,
    trade_id: Any,
    pair: str,
    freqai_dir: str,
    claude_dir: str,
    grok_dir: str,
    combined_conf: float,
    claude_reasoning: str | None = None,
    grok_reasoning: str | None = None,
) -> str:
    """
    Format the ⚠️ strong disagree Telegram message.

    Returns an HTML-formatted string for Telegram's parse_mode=HTML.
    """
    conf_pct = f"{combined_conf * 100:.1f}%"

    lines = [
        "⚠️ <b>AI STRONG DISAGREE ALERT</b>",
        "",
        f"🤖 Bot: <b>{bot_name}</b> (id={bot_id})",
        f"📊 Pair: <b>{pair}</b>  |  Trade #{trade_id}",
        "",
        f"🔵 FreqAI direction: <b>{freqai_dir.upper()}</b>",
        f"🧠 Claude: <b>{claude_dir.upper()}</b>",
        f"⚡ Grok:   <b>{grok_dir.upper()}</b>",
        "",
        f"📉 Combined confidence: <b>{conf_pct}</b>",
    ]

    if claude_reasoning:
        lines += ["", "🧠 Claude reasoning:", f"<i>{claude_reasoning[:200]}</i>"]

    if grok_reasoning:
        lines += ["", "⚡ Grok reasoning:", f"<i>{grok_reasoning[:200]}</i>"]

    lines += ["", "👉 Review in <b>AI Insights</b> page"]

    return "\n".join(lines)
