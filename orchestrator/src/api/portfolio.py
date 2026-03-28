"""
Portfolio API routes.

Cross-bot aggregation of FT API data.
No custom calculations — just combines per-bot FT responses.
Uses FT field names exactly: profit_all_coin, profit_all_fiat, etc.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..portfolio.aggregator import PortfolioAggregator

router = APIRouter()


@router.get("/balance")
async def combined_balance(request: Request, db: AsyncSession = Depends(get_db)):
    """Combined balance across all running bots (from GET /api/v1/balance each)."""
    agg = PortfolioAggregator(request.app.state.bot_manager)
    return await agg.get_combined_balance(db)


@router.get("/profit")
async def combined_profit(request: Request, db: AsyncSession = Depends(get_db)):
    """Combined profit across all running bots (from GET /api/v1/profit each)."""
    agg = PortfolioAggregator(request.app.state.bot_manager)
    return await agg.get_combined_profit(db)


@router.get("/trades")
async def all_open_trades(request: Request, db: AsyncSession = Depends(get_db)):
    """All open trades across all bots (from GET /api/v1/status each)."""
    agg = PortfolioAggregator(request.app.state.bot_manager)
    return await agg.get_all_open_trades(db)


@router.get("/daily")
async def combined_daily(
    request: Request,
    db: AsyncSession = Depends(get_db),
    days: int = 30,
):
    """Daily profit per bot (from GET /api/v1/daily each)."""
    agg = PortfolioAggregator(request.app.state.bot_manager)
    return await agg.get_combined_daily(db, days=days)
