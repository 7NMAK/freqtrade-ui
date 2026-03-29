"""
Backtest Result model — stores results from strategy version backtests.

Each backtest run is linked to a specific strategy version.
Results include: metrics, full FT output, and parameters used.
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, Date, DateTime, Numeric, ForeignKey, Integer, JSON, String, func
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class BacktestResult(Base):
    """
    Results from backtesting a strategy version.
    
    Each result is immutable — backtests are never re-run in place.
    To re-run with different params, create a new BacktestResult.
    """
    __tablename__ = "backtest_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Link to strategy version that was backtested
    strategy_version_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("strategy_versions.id"), nullable=False
    )

    # Which exchange's historical data was used
    exchange_data: Mapped[str] = mapped_column(String(50), nullable=False)

    # Pairs tested (JSON array)
    pairs: Mapped[list] = mapped_column(JSON, nullable=False)

    # Timeframe used for backtest
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)

    # Date range of backtest
    timerange_start: Mapped[date] = mapped_column(Date, nullable=False)
    timerange_end: Mapped[date] = mapped_column(Date, nullable=False)

    # Trade statistics
    total_trades: Mapped[int | None] = mapped_column(Integer, nullable=True)
    winning_trades: Mapped[int | None] = mapped_column(Integer, nullable=True)
    losing_trades: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Performance metrics
    profit_total: Mapped[Decimal | None] = mapped_column(
        Numeric(20, 8), nullable=True
    )
    profit_percent: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    max_drawdown: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    sharpe_ratio: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    sortino_ratio: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    sqn: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )

    # Complete FT backtest output (for detailed analysis)
    full_results: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Soft delete (never hard delete — safety rule #7)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamp (immutable)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
