"""
Tests for Telegram notifier — format and send functions.
All HTTP calls are mocked (no real network requests).
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.ai_validator.telegram_notifier import (
    send_telegram_alert,
    format_strong_disagree_alert,
)


class TestFormatStrongDisagreeAlert:

    def test_basic_format(self):
        """Message contains expected fields."""
        msg = format_strong_disagree_alert(
            bot_id=1,
            bot_name="TestBot",
            trade_id=42,
            pair="BTC/USDT:USDT",
            freqai_dir="long",
            claude_dir="short",
            grok_dir="short",
            combined_conf=0.35,
        )
        assert "BTC/USDT:USDT" in msg
        assert "TestBot" in msg
        assert "42" in msg
        assert "LONG" in msg or "long" in msg.upper()
        assert "SHORT" in msg or "short" in msg.upper()
        assert "35.0%" in msg

    def test_reasoning_truncated(self):
        """Reasoning is truncated to 200 chars."""
        long_reasoning = "A" * 300
        msg = format_strong_disagree_alert(
            bot_id=1,
            bot_name="Bot",
            trade_id=1,
            pair="ETH/USDT",
            freqai_dir="long",
            claude_dir="short",
            grok_dir="neutral",
            combined_conf=0.4,
            claude_reasoning=long_reasoning,
        )
        # Should have 200 chars of the reasoning in msg
        assert "A" * 200 in msg
        assert "A" * 201 not in msg

    def test_no_reasoning_still_formats(self):
        """Message formats correctly with no reasoning."""
        msg = format_strong_disagree_alert(
            bot_id=2, bot_name="Bot2", trade_id=10,
            pair="SOL/USDT", freqai_dir="short",
            claude_dir="long", grok_dir="long",
            combined_conf=0.28,
            claude_reasoning=None, grok_reasoning=None,
        )
        assert "SOL/USDT" in msg
        assert "28.0%" in msg

    def test_html_tags_present(self):
        """Message uses HTML bold tags (for Telegram parse_mode=HTML)."""
        msg = format_strong_disagree_alert(
            bot_id=1, bot_name="Bot", trade_id=1,
            pair="BTC/USDT", freqai_dir="long",
            claude_dir="short", grok_dir="short",
            combined_conf=0.3,
        )
        assert "<b>" in msg
        assert "</b>" in msg


class TestSendTelegramAlert:

    @pytest.mark.asyncio
    async def test_no_config_returns_false(self):
        """Returns False immediately when token/chat_id not configured."""
        with patch("src.ai_validator.telegram_notifier.settings") as mock_settings:
            mock_settings.telegram_token = None
            mock_settings.telegram_chat_id = None
            result = await send_telegram_alert("test message")
        assert result is False

    @pytest.mark.asyncio
    async def test_successful_send(self):
        """Returns True when API call succeeds."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()

        with patch("src.ai_validator.telegram_notifier.settings") as mock_settings:
            mock_settings.telegram_token = "test-token"
            mock_settings.telegram_chat_id = "123456"

            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.post = AsyncMock(return_value=mock_response)
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=None)
                mock_client_cls.return_value = mock_client

                result = await send_telegram_alert("Test alert")

        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_on_http_error(self):
        """Returns False when API returns non-429 HTTP error."""
        import httpx

        with patch("src.ai_validator.telegram_notifier.settings") as mock_settings:
            mock_settings.telegram_token = "test-token"
            mock_settings.telegram_chat_id = "123456"

            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                err_response = MagicMock()
                err_response.status_code = 403
                err_response.headers = {}
                mock_client.post = AsyncMock(
                    side_effect=httpx.HTTPStatusError(
                        "403 Forbidden",
                        request=MagicMock(),
                        response=err_response,
                    )
                )
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=None)
                mock_client_cls.return_value = mock_client

                result = await send_telegram_alert("Test alert")

        assert result is False
