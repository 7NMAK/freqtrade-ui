"""
Bot management API routes.

Endpoints for registering, listing, starting/stopping FT bots.
Read-only FT API data is proxied through here (status, trades, profit, etc.)
so the frontend only talks to the orchestrator.
"""
import json
import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from ..auth import require_auth
from ..crypto import decrypt, encrypt
from ..database import get_db
from ..models.bot_instance import BotInstance, BotStatus
from ..models.audit_log import AuditLog
from ..ft_client import FTClientError

router = APIRouter()


# ── Request schemas ──────────────────────────────────────────

class BotRegisterRequest(BaseModel):
    # Existing
    name: str = Field(..., min_length=1, max_length=100)
    api_url: str
    api_port: int = Field(..., ge=1, le=65535)
    api_username: str
    api_password: str
    strategy_name: str | None = None
    is_dry_run: bool = True
    description: str | None = None
    container_id: str | None = None
    docker_image: str = "freqtradeorg/freqtrade:stable_freqai"

    # NEW — exchange config (V2)
    exchange_name: str = "binance"
    exchange_key: str | None = None      # plain text in request, encrypted in DB
    exchange_secret: str | None = None   # plain text in request, encrypted in DB
    exchange_password: str | None = None
    exchange_uid: str | None = None
    exchange_subaccount: str | None = None
    exchange_profile_id: int | None = None

    # NEW — trading config (V2)
    stake_currency: str = "USDT"
    stake_amount: str = "unlimited"
    max_open_trades: int = 3
    timeframe: str = "5m"
    pair_whitelist: list[str] = []
    pair_blacklist: list[str] = []
    trading_mode: str = "futures"
    margin_mode: str = "isolated"

    # NEW — strategy version reference (V2)
    strategy_version_id: int | None = None

    @field_validator("api_url")
    @classmethod
    def validate_api_url(cls, v: str) -> str:
        """M8: SSRF validation — only allow http:// or https://, block internal IPs."""
        if not v.startswith(("http://", "https://")):
            raise ValueError("api_url must start with http:// or https://")
        # Block dangerous schemes that could be embedded
        if re.search(r"(file|ftp|gopher|data|dict)://", v, re.IGNORECASE):
            raise ValueError("api_url contains a forbidden scheme")
        # Block link-local / cloud metadata IPs
        forbidden_patterns = [
            r"169\.254\.\d+\.\d+",   # link-local
            r"0\.0\.0\.0",           # wildcard
            r"\[::1\]",             # IPv6 loopback
        ]
        for pat in forbidden_patterns:
            if re.search(pat, v):
                raise ValueError("api_url points to a forbidden internal address")
        return v


class BotUpdateRequest(BaseModel):
    # Existing fields (optional for partial update)
    name: str | None = None
    strategy_name: str | None = None
    is_dry_run: bool | None = None
    description: str | None = None

    # NEW — exchange (editable!)
    exchange_name: str | None = None
    exchange_key: str | None = None
    exchange_secret: str | None = None
    exchange_password: str | None = None
    exchange_uid: str | None = None
    exchange_subaccount: str | None = None
    exchange_profile_id: int | None = None

    # NEW — trading config (editable!)
    stake_currency: str | None = None
    stake_amount: str | None = None
    max_open_trades: int | None = None
    timeframe: str | None = None
    pair_whitelist: list[str] | None = None
    pair_blacklist: list[str] | None = None
    trading_mode: str | None = None
    margin_mode: str | None = None

    # NEW — strategy version
    strategy_version_id: int | None = None


class ForceEnterRequest(BaseModel):
    pair: str
    side: Literal["long", "short"] = "long"
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
    # Existing fields
    id: int
    name: str
    api_url: str
    api_port: int
    strategy_name: str | None
    status: str
    is_dry_run: bool
    is_healthy: bool
    consecutive_failures: int
    container_id: str | None
    docker_image: str
    description: str | None
    ft_mode: str = "trade"
    is_utility: bool = False

    # NEW fields (V2)
    exchange_name: str = "binance"
    exchange_subaccount: str | None = None
    exchange_profile_id: int | None = None
    stake_currency: str = "USDT"
    stake_amount: str = "unlimited"
    max_open_trades: int = 3
    timeframe: str = "5m"
    pair_whitelist: list = []
    pair_blacklist: list = []
    trading_mode: str = "futures"
    margin_mode: str = "isolated"
    strategy_version_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


# ── Routes ───────────────────────────────────────────────────

@router.get("/", response_model=list[BotResponse])
async def list_bots(request: Request, db: AsyncSession = Depends(get_db)) -> list[BotResponse]:
    """List all registered bots (excludes soft-deleted)."""
    manager = request.app.state.bot_manager
    bots = await manager.get_all_bots(db)
    return bots


@router.post("/", response_model=BotResponse, status_code=201)
async def register_bot(
    body: BotRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> BotResponse:
    """Register an existing FT bot with the orchestrator."""
    manager = request.app.state.bot_manager
    try:
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
            container_id=body.container_id,
            docker_image=body.docker_image,
            # NEW (V2)
            exchange_name=body.exchange_name,
            exchange_key=body.exchange_key,
            exchange_secret=body.exchange_secret,
            exchange_password=body.exchange_password,
            exchange_uid=body.exchange_uid,
            exchange_subaccount=body.exchange_subaccount,
            exchange_profile_id=body.exchange_profile_id,
            stake_currency=body.stake_currency,
            stake_amount=body.stake_amount,
            max_open_trades=body.max_open_trades,
            timeframe=body.timeframe,
            pair_whitelist=body.pair_whitelist,
            pair_blacklist=body.pair_blacklist,
            trading_mode=body.trading_mode,
            margin_mode=body.margin_mode,
            strategy_version_id=body.strategy_version_id,
        )
    except ValueError as e:
        raise HTTPException(409, str(e))
    return bot


@router.get("/{bot_id}", response_model=BotResponse)
async def get_bot(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> BotResponse:
    """Get a single bot."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    return bot


@router.patch("/{bot_id}", response_model=BotResponse)
async def update_bot(
    bot_id: int,
    body: BotUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
):
    """
    Update bot metadata and configuration.
    All fields optional for partial updates.

    Returns: BotResponse + "requires_restart" flag if config changed.
    """
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")

    changes: dict = {}
    config_changed = False

    # Metadata (non-config) fields
    if body.name is not None:
        changes["name"] = {"old": bot.name, "new": body.name}
        bot.name = body.name
    if body.description is not None:
        changes["description"] = {"old": bot.description, "new": body.description}
        bot.description = body.description
    if body.strategy_name is not None:
        changes["strategy_name"] = {"old": bot.strategy_name, "new": body.strategy_name}
        bot.strategy_name = body.strategy_name

    # Config fields (trigger restart flag)
    if body.is_dry_run is not None:
        changes["is_dry_run"] = {"old": bot.is_dry_run, "new": body.is_dry_run}
        bot.is_dry_run = body.is_dry_run
        config_changed = True

    if body.exchange_name is not None:
        changes["exchange_name"] = {"old": bot.exchange_name, "new": body.exchange_name}
        bot.exchange_name = body.exchange_name
        config_changed = True

    if body.exchange_key is not None:
        changes["exchange_key"] = {"old": "***", "new": "***"}
        bot.exchange_key_enc = encrypt(body.exchange_key)
        config_changed = True

    if body.exchange_secret is not None:
        changes["exchange_secret"] = {"old": "***", "new": "***"}
        bot.exchange_secret_enc = encrypt(body.exchange_secret)
        config_changed = True

    if body.exchange_password is not None:
        changes["exchange_password"] = {"old": "***", "new": "***"}
        bot.exchange_password = body.exchange_password
        config_changed = True

    if body.exchange_uid is not None:
        changes["exchange_uid"] = {"old": bot.exchange_uid, "new": body.exchange_uid}
        bot.exchange_uid = body.exchange_uid
        config_changed = True

    if body.exchange_subaccount is not None:
        changes["exchange_subaccount"] = {"old": bot.exchange_subaccount, "new": body.exchange_subaccount}
        bot.exchange_subaccount = body.exchange_subaccount
        config_changed = True

    if body.exchange_profile_id is not None:
        changes["exchange_profile_id"] = {"old": bot.exchange_profile_id, "new": body.exchange_profile_id}
        bot.exchange_profile_id = body.exchange_profile_id
        config_changed = True

    if body.stake_currency is not None:
        changes["stake_currency"] = {"old": bot.stake_currency, "new": body.stake_currency}
        bot.stake_currency = body.stake_currency
        config_changed = True

    if body.stake_amount is not None:
        changes["stake_amount"] = {"old": bot.stake_amount, "new": body.stake_amount}
        bot.stake_amount = body.stake_amount
        config_changed = True

    if body.max_open_trades is not None:
        changes["max_open_trades"] = {"old": bot.max_open_trades, "new": body.max_open_trades}
        bot.max_open_trades = body.max_open_trades
        config_changed = True

    if body.timeframe is not None:
        changes["timeframe"] = {"old": bot.timeframe, "new": body.timeframe}
        bot.timeframe = body.timeframe
        config_changed = True

    if body.pair_whitelist is not None:
        changes["pair_whitelist"] = {"old": bot.pair_whitelist, "new": body.pair_whitelist}
        bot.pair_whitelist = body.pair_whitelist
        flag_modified(bot, "pair_whitelist")
        config_changed = True

    if body.pair_blacklist is not None:
        changes["pair_blacklist"] = {"old": bot.pair_blacklist, "new": body.pair_blacklist}
        bot.pair_blacklist = body.pair_blacklist
        flag_modified(bot, "pair_blacklist")
        config_changed = True

    if body.trading_mode is not None:
        changes["trading_mode"] = {"old": bot.trading_mode, "new": body.trading_mode}
        bot.trading_mode = body.trading_mode
        config_changed = True

    if body.margin_mode is not None:
        changes["margin_mode"] = {"old": bot.margin_mode, "new": body.margin_mode}
        bot.margin_mode = body.margin_mode
        config_changed = True

    if body.strategy_version_id is not None:
        changes["strategy_version_id"] = {"old": bot.strategy_version_id, "new": body.strategy_version_id}
        bot.strategy_version_id = body.strategy_version_id
        config_changed = True

    # L10: audit log for update_bot
    actor = auth_payload.get("sub", "user")
    db.add(AuditLog(
        action="bot.update",
        actor=actor,
        target_type="bot",
        target_id=bot.id,
        target_name=bot.name,
        details=json.dumps(changes),
    ))
    await db.flush()

    bot_response = BotResponse.from_orm(bot).model_dump()
    bot_response["requires_restart"] = config_changed
    return bot_response


@router.delete("/{bot_id}", response_model=BotResponse)
async def delete_bot(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> BotResponse:
    """Soft-delete a bot (never hard delete)."""
    manager = request.app.state.bot_manager
    bot = await manager.delete_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    return bot


# ── NEW: Config Generation (V2) ──────────────────────────────

@router.post("/{bot_id}/generate-config")
async def generate_config(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Generate FreqTrade config.json from bot settings + strategy version.
    
    Returns the config dict for preview before deployment.
    """
    from sqlalchemy import select
    from ..models.strategy_version import StrategyVersion

    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")

    # Build base config from bot settings
    config = {
        "trading_mode": bot.trading_mode or "futures",
        "margin_mode": bot.margin_mode or "isolated",
        "max_open_trades": bot.max_open_trades or 3,
        "stake_currency": bot.stake_currency or "USDT",
        "stake_amount": bot.stake_amount or "unlimited",
        "timeframe": bot.timeframe,
        "dry_run": bot.is_dry_run,
        "dry_run_wallet": bot.config_overrides.get("dry_run_wallet", 10000) if bot.config_overrides else 10000,
        "exchange": {
            "name": bot.exchange_name or "binance",
            "key": decrypt(bot.exchange_key_enc) or "",
            "secret": decrypt(bot.exchange_secret_enc) or "",
            "pair_whitelist": bot.pair_whitelist or [],
            "pair_blacklist": bot.pair_blacklist or [],
        },
        "pairlists": [{"method": "StaticPairList"}],
        "api_server": {
            "enabled": True,
            "listen_ip_address": "0.0.0.0",
            "listen_port": bot.api_port,
            "username": bot.api_username,
            "password": bot.api_password,
            "CORS_origins": ["*"],
        },
        "initial_state": "running",
        "force_entry_enable": True,
        "internals": {"process_throttle_secs": 5},
    }

    # Add exchange-specific fields if present
    if bot.exchange_password:
        config["exchange"]["password"] = bot.exchange_password
    if bot.exchange_uid:
        config["exchange"]["uid"] = bot.exchange_uid
    if bot.exchange_subaccount:
        config["exchange"]["subaccount"] = bot.exchange_subaccount

    # Merge strategy risk config if version exists
    if bot.strategy_version_id:
        try:
            version = await db.get(StrategyVersion, bot.strategy_version_id)
            if version and version.risk_config:
                risk = version.risk_config
                config["stoploss"] = risk.get("stoploss", -0.1)
                config["minimal_roi"] = risk.get("roi", {"60": 0.01, "30": 0.02, "0": 0.04})
                if risk.get("trailing_stop"):
                    config["trailing_stop"] = True
                    for k in ["trailing_stop_positive", "trailing_stop_positive_offset", "trailing_only_offset_is_reached"]:
                        if k in risk:
                            config[k] = risk[k]
        except Exception as e:
            # If strategy fetch fails, return base config with note
            config["_warning"] = f"Could not load strategy risk config: {str(e)}"

    return config


# ── NEW: Drain Endpoint (V2) ──────────────────────────────────

@router.post("/{bot_id}/drain")
async def drain_bot(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Drain a bot: stop new entries, keep existing trades.
    
    Sets status to DRAINING and calls FT API: POST /api/v1/stopbuy
    """
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")

    # Update bot status
    bot.status = BotStatus.DRAINING
    await db.flush()

    # Call FT API to stop buy
    try:
        client = await manager.get_client(bot)
        result = await client.stopbuy()
        # Get current open trades count
        status = await manager.get_bot_status(bot)
        open_count = len(status) if isinstance(status, list) else (1 if status else 0)
        return {
            "status": "draining",
            "open_trades": open_count,
            "ft_response": result,
        }
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


# ── NEW: Bot Import Endpoint (V2) ────────────────────────────

@router.post("/import")
async def import_bot(
    body: dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> BotResponse:
    """
    Import an existing FT bot by connecting to it and reading its config.
    
    Body:
    {
        "api_url": "http://127.0.0.1",
        "api_port": 8080,
        "api_username": "novakus",
        "api_password": "xxx",
        "bot_name": "imported-bot"  # optional, defaults to auto-generated
    }
    
    Returns: newly created BotResponse with auto-populated fields.
    """
    manager = request.app.state.bot_manager

    api_url = body.get("api_url", "http://127.0.0.1")
    api_port = body.get("api_port", 8080)
    api_username = body.get("api_username", "")
    api_password = body.get("api_password", "")
    bot_name = body.get("bot_name")

    if not api_username or not api_password:
        raise HTTPException(400, "api_username and api_password required")

    # Create temporary client to fetch config
    from ..ft_client import FTClient
    try:
        client = FTClient(
            api_url=f"{api_url}:{api_port}",
            username=api_username,
            password=api_password,
        )
        # Ping to verify connection
        await client.ping()

        # Fetch config
        ft_config = await client.show_config()

        # Extract fields from FT config
        exchange_name = ft_config.get("exchange", {}).get("name", "binance")
        stake_currency = ft_config.get("stake_currency", "USDT")
        stake_amount = ft_config.get("stake_amount", "unlimited")
        max_open_trades = ft_config.get("max_open_trades", 3)
        trading_mode = ft_config.get("trading_mode", "spot")
        margin_mode = ft_config.get("margin_mode", "isolated")
        timeframe = ft_config.get("timeframe", "5m")
        pair_whitelist = ft_config.get("exchange", {}).get("pair_whitelist", [])
        pair_blacklist = ft_config.get("exchange", {}).get("pair_blacklist", [])
        strategy_name = ft_config.get("strategy_name")
        is_dry_run = ft_config.get("dry_run", True)

        # Generate bot name if not provided
        if not bot_name:
            bot_name = f"imported-{exchange_name}-{strategy_name or 'bot'}"

        # Register the bot with all discovered config
        bot = await manager.register_bot(
            db=db,
            name=bot_name,
            api_url=api_url,
            api_port=api_port,
            api_username=api_username,
            api_password=api_password,
            strategy_name=strategy_name,
            is_dry_run=is_dry_run,
            description=f"Imported from {api_url}:{api_port}",
            exchange_name=exchange_name,
            stake_currency=stake_currency,
            stake_amount=stake_amount,
            max_open_trades=max_open_trades,
            trading_mode=trading_mode,
            margin_mode=margin_mode,
            timeframe=timeframe,
            pair_whitelist=pair_whitelist,
            pair_blacklist=pair_blacklist,
        )
        return bot

    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)
    except Exception as e:
        raise HTTPException(502, f"Import failed: {str(e)}")


# ── Bot Control ──────────────────────────────────────────────

@router.post("/{bot_id}/start")
async def start_bot(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/start on the FT bot. Blocked if strategy is DRAFT (safety rule #8)."""
    from sqlalchemy import select
    from ..models.strategy import Strategy, StrategyLifecycle

    # M12: Enforce strategy lifecycle — block start if DRAFT
    result_strat = await db.execute(
        select(Strategy).where(Strategy.bot_instance_id == bot_id, Strategy.is_deleted.is_(False))
    )
    strategy = result_strat.scalar_one_or_none()
    if strategy and strategy.lifecycle == StrategyLifecycle.DRAFT:
        raise HTTPException(
            400,
            "Cannot start bot — strategy is in DRAFT. Promote to BACKTEST or higher first.",
        )

    manager = request.app.state.bot_manager
    try:
        result = await manager.start_bot(db, bot_id)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.post("/{bot_id}/stop")
async def stop_bot(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/stop on the FT bot."""
    manager = request.app.state.bot_manager
    try:
        result = await manager.stop_bot(db, bot_id)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.post("/{bot_id}/force-stop")
async def force_stop_bot(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> dict[str, Any]:
    """
    Force-stop a bot: forceexit all open positions, then stop trading.

    1. POST /api/v1/forceexit (trade_id="all") — close all open positions at market
    2. POST /api/v1/stop — stop the trading loop
    3. Update bot status to STOPPED
    4. Log the action

    This is equivalent to a Hard Kill on a single bot (see kill_switch).
    """
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")

    client = await manager.get_client(bot)
    forceexit_failed = False
    exit_result = None
    stop_result = None

    # Step 1: Force-exit all open positions
    try:
        exit_result = await client.forceexit("all")
    except FTClientError as e:
        forceexit_failed = True
        exit_result = {"error": str(e)}

    # Step 2: Stop trading (always attempt, even if forceexit failed)
    try:
        stop_result = await client.stop()
    except FTClientError as e:
        stop_result = {"error": str(e)}

    # Step 3: Update status
    bot.status = BotStatus.STOPPED

    # Step 4: Audit log
    actor = auth_payload.get("sub", "user")
    db.add(AuditLog(
        action="bot.force_stop",
        actor=actor,
        target_type="bot",
        target_id=bot.id,
        target_name=bot.name,
        details=json.dumps({
            "forceexit_failed": forceexit_failed,
            "exit_result": str(exit_result),
            "stop_result": str(stop_result),
        }),
    ))
    await db.flush()

    result = {
        "forceexit": exit_result,
        "stop": stop_result,
        "success": not forceexit_failed,
        "status": "stopped",
    }
    if forceexit_failed:
        result["warning"] = "Force-exit failed — positions may still be open"

    return result


@router.post("/{bot_id}/restart")
async def restart_bot(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth_payload: dict[str, Any] = Depends(require_auth),
) -> dict[str, Any]:
    """
    Restart a bot: stop, wait briefly, then start.

    1. POST /api/v1/stop — stop the trading loop
    2. Wait 2 seconds for graceful shutdown
    3. POST /api/v1/start — start the trading loop
    4. Log the action
    """
    import asyncio

    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")

    client = await manager.get_client(bot)

    # Step 1: Stop
    stop_result = None
    try:
        stop_result = await client.stop()
    except FTClientError:
        # Bot may already be stopped — continue with start
        stop_result = {"status": "already_stopped"}

    # Step 2: Brief wait for graceful shutdown
    await asyncio.sleep(2)

    # Step 3: Start
    try:
        start_result = await client.start()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)

    # Update status
    bot.status = BotStatus.RUNNING
    bot.consecutive_failures = 0
    bot.is_healthy = True

    # Step 4: Audit log
    actor = auth_payload.get("sub", "user")
    db.add(AuditLog(
        action="bot.restart",
        actor=actor,
        target_type="bot",
        target_id=bot.id,
        target_name=bot.name,
    ))
    await db.flush()

    return {
        "stop": stop_result,
        "start": start_result,
        "status": "running",
    }


@router.post("/{bot_id}/reload-config")
async def reload_config(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/reload_config on the FT bot."""
    manager = request.app.state.bot_manager
    try:
        result = await manager.reload_bot_config(db, bot_id)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


# ── FT API Passthrough (read-only) ──────────────────────────
# Frontend calls orchestrator → orchestrator calls FT API → returns data.
# No transformation. FT field names preserved exactly.

@router.get("/{bot_id}/ping")
async def bot_ping(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/ping — lightweight connectivity check."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.ping()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/health")
async def bot_health(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/health — detailed health info."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.health()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/sysinfo")
async def bot_sysinfo(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/sysinfo — system info (CPU, RAM)."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.sysinfo()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/logs")
async def bot_logs(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=500),
):
    """GET /api/v1/logs — FT log output."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.logs(limit=limit)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/status")
async def bot_status(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any] | list[dict[str, Any]]:
    """GET /api/v1/status — open trades (FT field names: open_rate, stake_amount, etc.)."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_status(bot)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/trades")
async def bot_trades(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """GET /api/v1/trades — trade history (FT field names preserved)."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_trades(bot, limit=limit, offset=offset)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/profit")
async def bot_profit(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/profit — profit stats."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_profit(bot)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/balance")
async def bot_balance(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/balance — account balance."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_balance(bot)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/daily")
async def bot_daily(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365),
) -> dict[str, Any]:
    """GET /api/v1/daily — daily profit."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_daily(bot, days=days)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/weekly")
async def bot_weekly(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    weeks: int = Query(default=12, ge=1, le=52),
) -> dict[str, Any]:
    """GET /api/v1/weekly — weekly profit."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.weekly(weeks=weeks)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/monthly")
async def bot_monthly(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    months: int = Query(default=12, ge=1, le=36),
) -> dict[str, Any]:
    """GET /api/v1/monthly — monthly profit."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.monthly(months=months)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/entries")
async def bot_entries(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/entries — enter_tag performance."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.entries()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/exits")
async def bot_exits(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/exits — exit_reason performance."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.exits()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/mix-tags")
async def bot_mix_tags(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/mix_tags — combined enter/exit tag performance."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.mix_tags()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/stats")
async def bot_stats(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """GET /api/v1/stats — trade stats (durations, buy/sell counts)."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        client = await manager.get_client(bot)
        return await client.stats()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/performance")
async def bot_performance(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any] | list[dict[str, Any]]:
    """GET /api/v1/performance — per-pair performance."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_performance(bot)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/config")
async def bot_config(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/show_config — current FT config."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        return await manager.get_bot_config(bot)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.put("/{bot_id}/config")
async def bot_save_config(bot_id: int, body: dict[str, Any], request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """
    Save config sections to orchestrator DB and trigger FT config reload.

    FT doesn't have a direct "write config" API endpoint.
    We store config overrides (e.g. freqai section) in the bot_instances table
    so they are persisted and can be applied when the bot starts/restarts.
    """
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")

    # Merge incoming config sections into stored overrides
    existing = bot.config_overrides or {}
    existing.update(body)
    bot.config_overrides = existing
    # SQLAlchemy needs to detect the mutation on JSON columns
    flag_modified(bot, "config_overrides")
    await db.flush()

    # Try to reload the FT bot config (best-effort — bot may be stopped)
    client = await manager.get_client(bot)
    try:
        return await client.reload_config()
    except FTClientError:
        # If reload fails (bot stopped), just return the saved config
        return bot.config_overrides or {}


@router.post("/{bot_id}/forceenter")
async def bot_forceenter(
    bot_id: int,
    body: ForceEnterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """POST /api/v1/forceenter — force open a trade."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.forceenter(pair=body.pair, side=body.side, stake_amount=body.stake_amount)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.post("/{bot_id}/forceexit")
async def bot_forceexit(
    bot_id: int,
    body: ForceExitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """POST /api/v1/forceexit — force close a trade."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.forceexit(trade_id=body.trade_id)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.post("/{bot_id}/stopbuy")
async def bot_stopbuy(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/stopbuy — stop new entries only."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.stopbuy()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.post("/{bot_id}/pause")
async def bot_pause(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/pause — pause trading."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.pause()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.delete("/{bot_id}/trades/{trade_id}")
async def bot_delete_trade(bot_id: int, trade_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/v1/trades/{id} — delete trade."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.delete_trade(trade_id)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.delete("/{bot_id}/trades/{trade_id}/open-order")
async def bot_cancel_open_order(bot_id: int, trade_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/v1/trades/{id}/open-order — cancel open order."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.cancel_open_order(trade_id)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.post("/{bot_id}/trades/{trade_id}/reload")
async def bot_reload_trade(bot_id: int, trade_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/trades/{id}/reload — reload trade from exchange."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.reload_trade(trade_id)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


# ── Data & Settings (§7, §8) ─────────────────────────────────

@router.get("/{bot_id}/whitelist")
async def bot_whitelist(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/whitelist — current whitelist."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.whitelist()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/blacklist")
async def bot_blacklist_get(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/blacklist — current blacklist."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.blacklist_get()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.post("/{bot_id}/blacklist")
async def bot_blacklist_add(bot_id: int, body: BlacklistRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/blacklist — add pairs to blacklist."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.blacklist_add(body.pairs)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.delete("/{bot_id}/blacklist")
async def bot_blacklist_remove(bot_id: int, body: BlacklistRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/v1/blacklist — remove pairs from blacklist."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.blacklist_remove(body.pairs)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/locks")
async def bot_locks(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/locks — pair locks."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.locks()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.post("/{bot_id}/locks")
async def bot_lock_add(bot_id: int, body: LockRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/locks — create pair lock."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.lock_add(pair=body.pair, until=body.until, reason=body.reason)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.delete("/{bot_id}/locks/{lock_id}")
async def bot_lock_delete(bot_id: int, lock_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/v1/locks/{id} — delete pair lock."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.lock_delete(lock_id)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


# ── Analytics & Strategy data (§19, §2) ──────────────────────

@router.get("/{bot_id}/plot-config")
async def bot_plot_config(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/plot_config — strategy plotting config."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.plot_config()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/pair-candles")
async def bot_pair_candles(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    pair: str = "",
    timeframe: str = "",
    limit: int = Query(default=500, ge=1, le=1000),
) -> dict[str, Any]:
    """GET /api/v1/pair_candles — OHLCV data."""
    if not pair or not timeframe:
        raise HTTPException(status_code=400, detail="pair and timeframe are required")
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.pair_candles(pair=pair, timeframe=timeframe, limit=limit)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/pair-history")
async def bot_pair_history(
    bot_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    pair: str = "",
    timeframe: str = "",
    timerange: str = "",
) -> dict[str, Any]:
    """GET /api/v1/pair_history — historical data with indicators."""
    if not pair or not timeframe:
        raise HTTPException(status_code=400, detail="pair and timeframe are required")
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.pair_history(pair=pair, timeframe=timeframe, timerange=timerange)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/available-pairs")
async def bot_available_pairs(bot_id: int, request: Request, db: AsyncSession = Depends(get_db), timeframe: str = "") -> dict[str, Any]:
    """GET /api/v1/available_pairs — available trading pairs."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.available_pairs(timeframe=timeframe)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/ft-strategies")
async def bot_ft_strategies(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/strategies — available strategies in FT."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.strategies()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/ft-strategy/{strategy_name}")
async def bot_ft_strategy(bot_id: int, strategy_name: str, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/strategy/{name} — strategy source code."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.strategy(strategy_name)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/freqaimodels")
async def bot_freqaimodels(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/freqaimodels — available FreqAI models."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.freqaimodels()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


# ── Backtesting (§5) ─────────────────────────────────────────

@router.post("/{bot_id}/backtest")
async def bot_backtest_start(bot_id: int, body: dict[str, Any], request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """POST /api/v1/backtest — start backtest. Body is FT backtest config (freeform dict)."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_start(body)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/backtest")
async def bot_backtest_status(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/backtest — backtest status/results."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_status()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.delete("/{bot_id}/backtest")
async def bot_backtest_abort(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/v1/backtest — abort backtest."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_abort()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/backtest/history")
async def bot_backtest_history(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """GET /api/v1/backtest/history — backtest history."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_history()
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.get("/{bot_id}/backtest/history/result")
async def bot_backtest_history_result(bot_id: int, request: Request, db: AsyncSession = Depends(get_db), id: str = "") -> dict[str, Any]:
    """GET /api/v1/backtest/history/result — specific result."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_history_result(id)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


@router.delete("/{bot_id}/backtest/history/{result_id}")
async def bot_backtest_history_delete(bot_id: int, result_id: str, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/v1/backtest/history/{id} — delete backtest result."""
    client = await _get_bot_client(bot_id, request, db)
    try:
        return await client.backtest_history_delete(result_id)
    except FTClientError as e:
        detail = {"error": str(e), "diagnosis": e.diagnosis} if hasattr(e, "diagnosis") and e.diagnosis else str(e)
        raise HTTPException(502, detail=detail)


# ── Data management (CLI commands — not native FT REST API) ──────────

@router.post("/{bot_id}/download-data")
async def bot_download_data(bot_id: int, body: dict[str, Any], request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Trigger freqtrade download-data via Docker exec on the bot container."""
    import docker
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        dk = docker.from_env()
        container = dk.containers.get(bot.container_id or bot.name)
        cmd = ["freqtrade", "download-data"]
        if body.get("pairs"):
            cmd += ["--pairs"] + body["pairs"]
        if body.get("timeframes"):
            cmd += ["--timeframes"] + body["timeframes"]
        if body.get("timerange"):
            cmd += ["--timerange", body["timerange"]]
        if body.get("exchange"):
            cmd += ["--exchange", body["exchange"]]
        result = container.exec_run(cmd, detach=False)
        return {"exit_code": result.exit_code, "output": result.output.decode("utf-8", errors="replace")[-2000:]}
    except Exception as e:
        raise HTTPException(502, f"Download-data failed: {e}")


@router.post("/{bot_id}/convert-data")
async def bot_convert_data(bot_id: int, body: dict[str, Any], request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Trigger freqtrade convert-data via Docker exec on the bot container."""
    import docker
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        dk = docker.from_env()
        container = dk.containers.get(bot.container_id or bot.name)
        cmd = ["freqtrade", "convert-data"]
        if body.get("format_from"):
            cmd += ["--format-from", body["format_from"]]
        if body.get("format_to"):
            cmd += ["--format-to", body["format_to"]]
        result = container.exec_run(cmd, detach=False)
        return {"exit_code": result.exit_code, "output": result.output.decode("utf-8", errors="replace")[-2000:]}
    except Exception as e:
        raise HTTPException(502, f"Convert-data failed: {e}")


@router.get("/{bot_id}/list-data")
async def bot_list_data(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """List available data files via Docker exec: freqtrade list-data."""
    import docker
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        dk = docker.from_env()
        container = dk.containers.get(bot.container_id or bot.name)
        result = container.exec_run(["freqtrade", "list-data", "--show-timerange"], detach=False)
        return {"exit_code": result.exit_code, "output": result.output.decode("utf-8", errors="replace")[-4000:]}
    except Exception as e:
        raise HTTPException(502, f"List-data failed: {e}")


# ── Hyperopt + Analysis (CLI commands) ───────────────────────────────

@router.post("/{bot_id}/hyperopt")
async def bot_hyperopt_start(bot_id: int, body: dict[str, Any], request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Start hyperopt via Docker exec on the bot container."""
    import docker
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        dk = docker.from_env()
        container = dk.containers.get(bot.container_id or bot.name)
        cmd = ["freqtrade", "hyperopt"]
        if body.get("strategy"):
            cmd += ["--strategy", body["strategy"]]
        if body.get("epochs"):
            cmd += ["--epochs", str(body["epochs"])]
        if body.get("spaces"):
            for s in body["spaces"]:
                cmd += ["--spaces", s]
        if body.get("jobs"):
            cmd += ["-j", str(body["jobs"])]
        result = container.exec_run(cmd, detach=True)
        return {"status": "started", "detail": "Hyperopt running in background."}
    except Exception as e:
        raise HTTPException(502, f"Hyperopt start failed: {e}")


@router.post("/{bot_id}/lookahead-analysis")
async def bot_lookahead_analysis(bot_id: int, body: dict[str, Any], request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Run lookahead-analysis via Docker exec."""
    import docker
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        dk = docker.from_env()
        container = dk.containers.get(bot.container_id or bot.name)
        cmd = ["freqtrade", "lookahead-analysis"]
        if body.get("strategy"):
            cmd += ["--strategy", body["strategy"]]
        result = container.exec_run(cmd, detach=False)
        return {"exit_code": result.exit_code, "output": result.output.decode("utf-8", errors="replace")[-4000:]}
    except Exception as e:
        raise HTTPException(502, f"Lookahead analysis failed: {e}")


@router.post("/{bot_id}/recursive-analysis")
async def bot_recursive_analysis(bot_id: int, body: dict[str, Any], request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Run recursive-analysis via Docker exec."""
    import docker
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    try:
        dk = docker.from_env()
        container = dk.containers.get(bot.container_id or bot.name)
        cmd = ["freqtrade", "recursive-analysis"]
        if body.get("strategy"):
            cmd += ["--strategy", body["strategy"]]
        result = container.exec_run(cmd, detach=False)
        return {"exit_code": result.exit_code, "output": result.output.decode("utf-8", errors="replace")[-4000:]}
    except Exception as e:
        raise HTTPException(502, f"Recursive analysis failed: {e}")


# ── Strategy file management ─────────────────────────────────────────

@router.post("/{bot_id}/strategy/import")
async def bot_import_strategy(bot_id: int, request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Import a strategy file to the bot's strategies directory."""
    import docker
    from fastapi import UploadFile, File
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    form = await request.form()
    file = form.get("file")
    if not file:
        raise HTTPException(400, "No file uploaded")
    content = await file.read()
    filename = getattr(file, "filename", "strategy.py")
    try:
        dk = docker.from_env()
        container = dk.containers.get(bot.container_id or bot.name)
        import tarfile, io
        tar_stream = io.BytesIO()
        with tarfile.open(fileobj=tar_stream, mode="w") as tar:
            info = tarfile.TarInfo(name=filename)
            info.size = len(content)
            tar.addfile(info, io.BytesIO(content))
        tar_stream.seek(0)
        container.put_archive("/freqtrade/user_data/strategies/", tar_stream)
        return {"status": "imported", "filename": filename}
    except Exception as e:
        raise HTTPException(502, f"Strategy import failed: {e}")


# ── Helper functions ────────────────────────────────────────────────────

async def _get_bot_client(bot_id: int, request: Request, db: AsyncSession):
    """Get an FTClient for a bot (used by trading action endpoints)."""
    manager = request.app.state.bot_manager
    bot = await manager.get_bot(db, bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    return await manager.get_client(bot)
