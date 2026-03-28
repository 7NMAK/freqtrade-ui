"""
Bot management API routes.

Endpoints for registering, listing, starting/stopping FT bots.
Read-only FT API data is proxied through here (status, trades, profit, etc.)
so the frontend only talks to the orchestrator.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.bot_instance import BotInstance, BotStatus
from ..ft_client import FTClientError

router = APIRouter()


# ── Request schemas ──────────────────────────────────────────

class BotRegisterRequest(BaseModel):
    name: str
    api_url: str
    api_port: int
    api_username: str
    api_password: str
    strategy_name: str | None = None
    is_dry_run: bool = True
    description: str | None = None


class BotUpdateRequest(BaseModel):
    name: str | None = None
    strategy_name: str | None = None
    is_dry_run: bool | None = None
    description: str | None = None


class ForceEnterRequest(BaseModel):
    pair: str
    side: str = "long"
    stake_amount: float | None = None


class ForceExitRequest(BaseModel):
    trade_id: str = "all"


class BlacklistRequest(BaseModel):
    pairs: list[str]


class LockRequest(BaseModel):
    pair: str
    until: str
    reason: str = ""


# ── Response schemas ─────────────────────────────────────────

class BotResponse(BaseModel):
    id: int
    name: str
    api_url: str
    api_port: int
    strategy_name: str | None
    status: str
    is_dry_run: bool
    is_healthy: bool
    consecutive_failures: int
    description: str | None

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────────

@router.get("/", response_model=list[BotResponse])
async def list_bots(request: Request, db: AsyncSession = Depends(get_db)):
    """List all registered bots (excludes soft-deleted)."""
    manager = request.app.state.bot_manager
    bots = await manager.get_all_bots(db)
    return bots


@router.post("/", response_model=BotResponse, status_code=201)
async def register_bot(
    body: BotRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Register an existing FT bot with the orchestrator."""
    manager = request.app.state.bot_manager
    bot = await manager.register_bot(
        db=db,
        name=body.name,
        api_url=body.api_url,
        api_port=body.api_port,
        api_username=body.api_username,
        api_password=body.api_password,
        strategy_name=body.strategy_name,
        is_dry_run=body.is_dry_run,
        description=body.description,
    )
    return bot


@router.get("/{bot_id}", response_model=BotResponse)
async def get_bot(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Get a single bot."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    return bot


@router.delete("/{bot_id}", response_model=BotResponse)
async def delete_bot(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Soft-delete a bot (never hard delete)."""
    manager = request.app.state.bot_manager
    bot = await manager.delete_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    return bot


# ── Bot Control ──────────────────────────────────────────────

@router.post("/{bot_id}/start")
async def start_bot(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/start on the FT bot."""
    manager = request.app.state.bot_manager
    try:
        result = await manager.start_bot(db, bot_id)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.post("/{bot_id}/stop")
async def stop_bot(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/stop on the FT bot."""
    manager = request.app.state.bot_manager
    try:
        result = await manager.stop_bot(db, bot_id)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.post("/{bot_id}/reload-config")
async def reload_config(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/reload_config on the FT bot."""
    manager = request.app.state.bot_manager
    try:
        result = await manager.reload_bot_config(db, bot_id)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


# ── FT API Passthrough (read-only) ──────────────────────────
# Frontend calls orchestrator → orchestrator calls FT API → returns data.
# No transformation. FT field names preserved exactly.

@router.get("/{bot_id}/status")
async def bot_status(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/status — open trades (FT field names: open_rate, stake_amount, etc.)."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_status(bot)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/trades")
async def bot_trades(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """GET /api/v1/trades — trade history (FT field names preserved)."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_trades(bot, limit=limit, offset=offset)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/profit")
async def bot_profit(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/profit — profit stats."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_profit(bot)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/balance")
async def bot_balance(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/balance — account balance."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_balance(bot)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/daily")
async def bot_daily(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    days: int = 30,
):
    """GET /api/v1/daily — daily profit."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_daily(bot, days=days)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/performance")
async def bot_performance(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/performance — per-pair performance."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_performance(bot)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/config")
async def bot_config(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/show_config — current FT config."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_config(bot)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/logs")
async def bot_logs(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """GET /api/v1/logs — bot logs."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_logs(bot, limit=limit)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


# ── Additional FT API Passthrough ─────────────────────────────
# All remaining FT endpoints needed by frontend pages.
# No transformation. FT field names preserved exactly.

async def _get_bot_client(bot_id: int, request: Request, db: AsyncSession):
    """Helper: get bot + FT client, or raise 404."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    return manager.get_client(bot)


# ── Dashboard extras (§8) ─────────────────────────────────────

@router.get("/{bot_id}/weekly")
async def bot_weekly(bot_id: int, request: Request, db: AsyncSession = Depends(get_db), weeks: int = 12):
    """GET /api/v1/weekly — weekly profit."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.weekly(weeks=weeks)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/monthly")
async def bot_monthly(bot_id: int, request: Request, db: AsyncSession = Depends(get_db), months: int = 6):
    """GET /api/v1/monthly — monthly profit."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.monthly(months=months)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/entries")
async def bot_entries(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/entries — entry tag analysis."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.entries()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/exits")
async def bot_exits(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/exits — exit reason analysis."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.exits()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/mix-tags")
async def bot_mix_tags(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/mix_tags — combined tag analysis."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.mix_tags()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/stats")
async def bot_stats(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/stats — trade statistics."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.stats()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/count")
async def bot_count(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/count — open trade count."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.count()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/version")
async def bot_version(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/version — FT version."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.version()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/sysinfo")
async def bot_sysinfo(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/sysinfo — system info."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.sysinfo()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/health")
async def bot_health(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/health — bot health status."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.health()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


# ── Trading actions (§8) ──────────────────────────────────────

@router.post("/{bot_id}/forceenter")
async def bot_forceenter(
    bot_id: int,
    body: ForceEnterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """POST /api/v1/forceenter — force open a trade."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.forceenter(pair=body.pair, side=body.side, stake_amount=body.stake_amount)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.post("/{bot_id}/forceexit")
async def bot_forceexit(
    bot_id: int,
    body: ForceExitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """POST /api/v1/forceexit — force close a trade."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.forceexit(trade_id=body.trade_id)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.post("/{bot_id}/stopbuy")
async def bot_stopbuy(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/stopbuy — stop new entries only."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.stopbuy()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.post("/{bot_id}/pause")
async def bot_pause(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/pause — pause trading."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.pause()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.delete("/{bot_id}/trades/{trade_id}")
async def bot_delete_trade(bot_id: int, trade_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """DELETE /api/v1/trades/{id} — delete trade."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.delete_trade(trade_id)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.delete("/{bot_id}/trades/{trade_id}/open-order")
async def bot_cancel_open_order(bot_id: int, trade_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """DELETE /api/v1/trades/{id}/open-order — cancel open order."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.cancel_open_order(trade_id)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.post("/{bot_id}/trades/{trade_id}/reload")
async def bot_reload_trade(bot_id: int, trade_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/trades/{id}/reload — reload trade from exchange."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.reload_trade(trade_id)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


# ── Data & Settings (§7, §8) ─────────────────────────────────

@router.get("/{bot_id}/whitelist")
async def bot_whitelist(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/whitelist — current whitelist."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.whitelist()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/blacklist")
async def bot_blacklist_get(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/blacklist — current blacklist."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.blacklist_get()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.post("/{bot_id}/blacklist")
async def bot_blacklist_add(bot_id: int, body: BlacklistRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/blacklist — add pairs to blacklist."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.blacklist_add(body.pairs)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.delete("/{bot_id}/blacklist")
async def bot_blacklist_remove(bot_id: int, body: BlacklistRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """DELETE /api/v1/blacklist — remove pairs from blacklist."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.blacklist_remove(body.pairs)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/locks")
async def bot_locks(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/locks — pair locks."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.locks()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.post("/{bot_id}/locks")
async def bot_lock_add(bot_id: int, body: LockRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/locks — create pair lock."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.lock_add(pair=body.pair, until=body.until, reason=body.reason)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.delete("/{bot_id}/locks/{lock_id}")
async def bot_lock_delete(bot_id: int, lock_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """DELETE /api/v1/locks/{id} — delete pair lock."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.lock_delete(lock_id)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


# ── Analytics & Strategy data (§19, §2) ──────────────────────

@router.get("/{bot_id}/plot-config")
async def bot_plot_config(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/plot_config — strategy plotting config."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.plot_config()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/pair-candles")
async def bot_pair_candles(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    pair: str = "",
    timeframe: str = "",
    limit: int = 500,
):
    """GET /api/v1/pair_candles — OHLCV data."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.pair_candles(pair=pair, timeframe=timeframe, limit=limit)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/pair-history")
async def bot_pair_history(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    pair: str = "",
    timeframe: str = "",
    timerange: str = "",
):
    """GET /api/v1/pair_history — historical data with indicators."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.pair_history(pair=pair, timeframe=timeframe, timerange=timerange)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/available-pairs")
async def bot_available_pairs(bot_id: int, request: Request, db: AsyncSession = Depends(get_db), timeframe: str = ""):
    """GET /api/v1/available_pairs — available trading pairs."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.available_pairs(timeframe=timeframe)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/ft-strategies")
async def bot_ft_strategies(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/strategies — available strategies in FT."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.strategies()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/ft-strategy/{strategy_name}")
async def bot_ft_strategy(bot_id: int, strategy_name: str, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/strategy/{name} — strategy source code."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.strategy(strategy_name)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/freqaimodels")
async def bot_freqaimodels(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/freqaimodels — available FreqAI models."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.freqaimodels()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


# ── Backtesting (§5) ─────────────────────────────────────────

@router.post("/{bot_id}/backtest")
async def bot_backtest_start(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """POST /api/v1/backtest — start backtest."""
    client = await _get_bot_client(bot_id, request, db)
    body = await request.json()
    try:
        return await client.backtest_start(body)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/backtest")
async def bot_backtest_status(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/backtest — backtest status/results."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_status()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.delete("/{bot_id}/backtest")
async def bot_backtest_abort(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """DELETE /api/v1/backtest — abort backtest."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_abort()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/backtest/history")
async def bot_backtest_history(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/backtest/history — backtest history."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_history()
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.get("/{bot_id}/backtest/history/result")
async def bot_backtest_history_result(bot_id: int, request: Request, db: AsyncSession = Depends(get_db), id: str = ""):
    """GET /api/v1/backtest/history/result — specific result."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_history_result(id)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")


@router.delete("/{bot_id}/backtest/history/{result_id}")
async def bot_backtest_history_delete(bot_id: int, result_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """DELETE /api/v1/backtest/history/{id} — delete backtest result."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_history_delete(result_id)
    except FTClientError as e:
        raise HTTPException(502, f"FT API error: {e}")
