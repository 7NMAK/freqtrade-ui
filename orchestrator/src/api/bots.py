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
