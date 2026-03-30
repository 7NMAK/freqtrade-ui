"""
Bot Instance model.

Maps a FreqTrade bot container to orchestrator metadata.
Each bot = 1 FT Docker container = 1 strategy version.

Trade data is NOT here. Read from FT API:
- GET /api/v1/status (open trades)
- GET /api/v1/trades (trade history)
- GET /api/v1/profit (profit stats)
- GET /api/v1/balance (account balance)
"""
import enum

from sqlalchemy import Boolean, Enum, Integer, JSON, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class BotStatus(str, enum.Enum):
    """Bot container status."""
    STARTING = "starting"
    RUNNING = "running"
    STOPPED = "stopped"
    DRAINING = "draining"  # No new entries, waiting for positions to close
    ERROR = "error"
    KILLED = "killed"  # killed by kill switch


class FTMode(str, enum.Enum):
    """FreqTrade running mode."""
    TRADE = "trade"      # Full trading bot — all endpoints available
    WEBSERVER = "webserver"  # API-only (backtesting) — trade-only endpoints return 503


class BotInstance(Base, TimestampMixin):
    """
    One row per FT bot container.
    This is orchestrator metadata only — NOT trade data.
    """
    __tablename__ = "bot_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Container info
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    container_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    docker_image: Mapped[str] = mapped_column(String(200), default="freqtradeorg/freqtrade:stable_freqai")

    # FT API connection (how orchestrator talks to this bot)
    api_url: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g. http://127.0.0.1:8080
    api_username: Mapped[str] = mapped_column(String(100), nullable=False)
    api_password: Mapped[str] = mapped_column(Text, nullable=False)  # Fernet-encrypted
    api_port: Mapped[int] = mapped_column(Integer, nullable=False)

    # ===== NEW: Exchange Configuration (V2) =====
    # Exchange to use (binance, bybit, okx, hyperliquid, etc.)
    exchange_name: Mapped[str] = mapped_column(String(50), default="binance", nullable=False)

    # Exchange API credentials (encrypted)
    exchange_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    exchange_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Additional exchange fields (some exchanges need these)
    exchange_password: Mapped[str | None] = mapped_column(Text, nullable=True)  # Fernet-encrypted
    exchange_uid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    exchange_subaccount: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Optional: link to exchange profile for convenience
    exchange_profile_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("exchange_profiles.id"), nullable=True
    )

    # ===== NEW: Trading Configuration (V2) =====
    # Stake currency (USDT, BUSD, BTC, etc.)
    stake_currency: Mapped[str] = mapped_column(String(20), default="USDT", nullable=False)

    # Stake amount per trade (unlimited or fixed amount)
    stake_amount: Mapped[str] = mapped_column(String(50), default="unlimited", nullable=False)

    # Max simultaneous open positions
    max_open_trades: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    # Timeframe for bot (5m, 15m, 1h, 1d, etc.)
    timeframe: Mapped[str] = mapped_column(String(10), default="5m", nullable=False)

    # Pair whitelist (JSON array: ["BTC/USDT:USDT", "ETH/USDT:USDT", ...])
    pair_whitelist: Mapped[list] = mapped_column(JSON, default=[], nullable=False)

    # Pair blacklist (JSON array)
    pair_blacklist: Mapped[list] = mapped_column(JSON, default=[], nullable=False)

    # Trading mode: spot or futures
    trading_mode: Mapped[str] = mapped_column(String(20), default="futures", nullable=False)

    # Margin mode (isolated or cross, only for futures)
    margin_mode: Mapped[str] = mapped_column(String(20), default="isolated", nullable=False)

    # ===== NEW: Strategy Reference (V2) =====
    # Links to specific strategy version (not just strategy name)
    strategy_version_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("strategy_versions.id"), nullable=True
    )

    # ===== DEPRECATED: Old Strategy Link =====
    # Kept for backward compat during migration
    strategy_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # State
    status: Mapped[BotStatus] = mapped_column(
        Enum(BotStatus, native_enum=False), default=BotStatus.STOPPED, nullable=False
    )
    is_dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # FreqTrade mode: determines which endpoints are available
    ft_mode: Mapped[str] = mapped_column(String(20), default=FTMode.TRADE.value, nullable=False)

    # Heartbeat tracking
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Soft delete (never hard delete — safety rule #7)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Path to this bot's config.json on the host filesystem
    # e.g. /opt/freqtrade/user_data/config.json
    # Orchestrator writes generated config here before start/reload
    config_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Config overrides managed by orchestrator (e.g. freqai section)
    # Stored as JSON — applied to bot config.json on start/restart
    config_overrides: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Notes
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Cached profit snapshot (updated while bot runs, preserved after stop)
    cached_profit: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cached_balance: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Utility flag (backtest workers etc. — hidden from dashboard)
    is_utility: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
