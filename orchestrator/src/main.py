"""
Orchestrator — FastAPI entry point.

This app does ONLY 5 things:
1. Multi-bot management (start/stop/configure FT Docker containers)
2. Kill Switch (Soft Kill = POST /api/v1/stop, Hard Kill = forceexit + stop)
3. Heartbeat monitor (ping every 3s, 3 failures = HARD KILL)
4. Cross-bot portfolio aggregation (aggregate balance from all bots)
5. Strategy lifecycle tracking (DRAFT → BACKTEST → PAPER → LIVE → RETIRED)

ALL trading logic, ALL features = FreqTrade. We just manage multiple bots.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, async_session
from .models.base import Base
from .heartbeat.monitor import HeartbeatMonitor
from .bot_manager.manager import BotManager
from .kill_switch.kill_switch import KillSwitch
from .polling.worker import DashboardWorker

# Import AI validator models so they are registered with Base.metadata
from .ai_validator.models import AIValidation, AIAccuracy, AIHyperoptAnalysis, AIHyperoptOutcome  # noqa: F401

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    # Production uses Alembic migrations — only run create_all if explicitly
    # requested (e.g. local dev with a fresh DB). Running it in production
    # bypasses the migration history and creates drift between declared
    # schema and Alembic's revision log.
    import os
    if os.environ.get("ORCH_RUN_CREATE_ALL") == "1":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.warning("Ran create_all (ORCH_RUN_CREATE_ALL=1) — NOT safe for production")

    # Wire up ft_client activity logging callback (logs FT connection errors to DB)
    from .ft_client import set_activity_log_callback
    from .activity_logger import log_activity as _log_activity

    async def _ft_activity_callback(**kwargs):
        """Bridge ft_client events into the audit_log DB table."""
        async with async_session() as session:
            try:
                await _log_activity(session, **kwargs)
                await session.commit()
            except Exception:
                await session.rollback()

    set_activity_log_callback(_ft_activity_callback)

    # Redis client (shared across all requests and background workers)
    import redis.asyncio as aioredis
    app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)

    # Initialize bot manager
    app.state.bot_manager = BotManager()

    # Initialize kill switch
    app.state.kill_switch = KillSwitch(app.state.bot_manager)

    # Start heartbeat monitor (wired to kill switch for auto-kill on failure)
    app.state.heartbeat = HeartbeatMonitor(app.state.bot_manager)
    app.state.heartbeat.set_kill_switch(app.state.kill_switch)
    heartbeat_task = asyncio.create_task(app.state.heartbeat.run())

    # Start Dashboard Polling Worker (pre-computes snapshot every 30s → Redis)
    app.state.dashboard_worker = DashboardWorker(app.state.bot_manager)
    app.state.dashboard_worker._redis = app.state.redis  # share connection
    dashboard_worker_task = asyncio.create_task(app.state.dashboard_worker.run())

    # Start JobRunner (background test job worker)
    from .services.job_runner import JobRunner
    app.state.job_runner = JobRunner(app.state.bot_manager)
    job_runner_task = asyncio.create_task(app.state.job_runner.run())

    # Start Daily Loss Circuit Breaker (reads thresholds from Safety Settings)
    from .risk.daily_loss_breaker import DailyLossBreaker
    from .portfolio.aggregator import PortfolioAggregator
    app.state.portfolio_aggregator = PortfolioAggregator(app.state.bot_manager)
    app.state.daily_loss_breaker = DailyLossBreaker(
        app.state.bot_manager,
        app.state.kill_switch,
        app.state.portfolio_aggregator,
    )
    daily_loss_task = asyncio.create_task(app.state.daily_loss_breaker.run())

    # Validate AI configuration at startup (enforces weight sum, API key, cost limit)
    if settings.ai_validation_enabled or settings.ai_hyperopt_enabled:
        from .ai_validator.config import AIValidatorConfig
        AIValidatorConfig(
            ai_openrouter_api_key=settings.ai_openrouter_api_key,
            ai_validation_enabled=settings.ai_validation_enabled,
            ai_validation_interval=settings.ai_validation_interval,
            ai_claude_model=settings.ai_claude_model,
            ai_claude_fallback=settings.ai_claude_fallback,
            ai_grok_model=settings.ai_grok_model,
            ai_grok_fallback=settings.ai_grok_fallback,
            ai_weight_freqai=settings.ai_weight_freqai,
            ai_weight_claude=settings.ai_weight_claude,
            ai_weight_grok=settings.ai_weight_grok,
            ai_max_daily_cost_usd=settings.ai_max_daily_cost_usd,
            ai_max_validations_per_hour=settings.ai_max_validations_per_hour,
            ai_telegram_notify_disagree=settings.ai_telegram_notify_disagree,
            ai_hyperopt_enabled=settings.ai_hyperopt_enabled,
            ai_hyperopt_auto_post_analyze=settings.ai_hyperopt_auto_post_analyze,
        )

    # Start AI Validation Scheduler (if enabled)
    ai_scheduler_task: asyncio.Task | None = None
    if settings.ai_validation_enabled:
        from .ai_validator.llm_gateway import LLMGateway
        from .ai_validator.scorer import ScoreCalculator
        from .ai_validator.tracker import AccuracyTracker
        from .ai_validator.scheduler import AIValidationScheduler

        gateway = LLMGateway()
        scorer = ScoreCalculator()
        tracker = AccuracyTracker()
        app.state.ai_scheduler = AIValidationScheduler(
            gateway=gateway,
            scorer=scorer,
            tracker=tracker,
            interval_seconds=settings.ai_validation_interval,
            max_daily_cost_usd=settings.ai_max_daily_cost_usd,
            max_validations_per_hour=settings.ai_max_validations_per_hour,
        )
        ai_scheduler_task = asyncio.create_task(app.state.ai_scheduler.start())
    else:
        app.state.ai_scheduler = None

    yield

    # Shutdown AI scheduler
    if app.state.ai_scheduler is not None:
        await app.state.ai_scheduler.stop()
    if ai_scheduler_task is not None:
        ai_scheduler_task.cancel()
        try:
            await ai_scheduler_task
        except asyncio.CancelledError:
            pass

    # Shutdown Dashboard Worker
    app.state.dashboard_worker.stop()
    dashboard_worker_task.cancel()
    try:
        await dashboard_worker_task
    except asyncio.CancelledError:
        pass

    # Shutdown heartbeat
    app.state.heartbeat.stop()
    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except asyncio.CancelledError:
        pass

    # Shutdown JobRunner
    app.state.job_runner.stop()
    job_runner_task.cancel()
    try:
        await job_runner_task
    except asyncio.CancelledError:
        pass

    # Close Redis connection
    await app.state.redis.aclose()

    await engine.dispose()


app = FastAPI(
    title="FreqTrade Orchestrator",
    description="Multi-bot manager for FreqTrade. NOT a trading engine — FT does all trading.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Register API routes
from .api.bots import router as bots_router
from .api.kill_switch import router as kill_switch_router
from .api.portfolio import router as portfolio_router
from .api.snapshot import router as snapshot_router
from .api.strategies import router as strategies_router
from .api.logs import router as logs_router
from .api.exchange_profiles import router as exchange_profiles_router
from .api.backtest_results import router as backtest_results_router
from .api.experiments import router as experiments_router
from .api.safety_settings import router as safety_settings_router

from .auth import require_auth as _auth_dep

app.include_router(bots_router, prefix="/api/bots", tags=["bots"], dependencies=[Depends(_auth_dep)])
app.include_router(kill_switch_router, prefix="/api/kill-switch", tags=["kill-switch"], dependencies=[Depends(_auth_dep)])
app.include_router(portfolio_router, prefix="/api/portfolio", tags=["portfolio"], dependencies=[Depends(_auth_dep)])
app.include_router(snapshot_router, prefix="/api/dashboard/snapshot", tags=["snapshot"], dependencies=[Depends(_auth_dep)])
app.include_router(strategies_router, prefix="/api/strategies", tags=["strategies"], dependencies=[Depends(_auth_dep)])
app.include_router(logs_router, prefix="/api/logs", tags=["logs"], dependencies=[Depends(_auth_dep)])
app.include_router(exchange_profiles_router, prefix="/api/exchange-profiles", tags=["exchange-profiles"], dependencies=[Depends(_auth_dep)])
app.include_router(backtest_results_router, prefix="/api/backtest-results", tags=["backtest-results"], dependencies=[Depends(_auth_dep)])
app.include_router(experiments_router, prefix="/api/experiments", tags=["experiments"], dependencies=[Depends(_auth_dep)])
app.include_router(safety_settings_router, prefix="/api/settings", tags=["settings"], dependencies=[Depends(_auth_dep)])

# Jobs (background test queue)
from .api.jobs import router as jobs_router
app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"], dependencies=[Depends(_auth_dep)])

# AI Validation Layer routes
from .api.ai import router as ai_router
from .api.ai_hyperopt import router as ai_hyperopt_router

app.include_router(ai_router, prefix="/api/ai", tags=["ai"], dependencies=[Depends(_auth_dep)])
app.include_router(ai_hyperopt_router, prefix="/api/ai/hyperopt", tags=["ai-hyperopt"], dependencies=[Depends(_auth_dep)])


# ── Auth endpoints (public — no token needed) ────────────────
from .auth import (
    LoginRequest, RefreshRequest, TokenResponse, create_access_token, create_refresh_token,
    ADMIN_USERNAME, ADMIN_PASSWORD_HASH, pwd_context, require_auth, verify_token,
    blocklist_jti, is_jti_blocklisted,
)
from datetime import datetime, timezone


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Issue access + refresh tokens."""
    if body.username != ADMIN_USERNAME or not pwd_context.verify(body.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_access_token({"sub": body.username})
    refresh = create_refresh_token({"sub": body.username})
    return TokenResponse(access_token=access, refresh_token=refresh)


@app.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest):
    """Exchange a valid refresh token for a new access token."""
    payload = verify_token(body.refresh_token, expected_type="refresh")
    jti = payload.get("jti")
    if jti and await is_jti_blocklisted(jti):
        raise HTTPException(401, "Refresh token has been revoked")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(401, "Malformed refresh token")
    new_access = create_access_token({"sub": sub})
    return TokenResponse(access_token=new_access)


@app.post("/api/auth/logout")
async def logout(auth_payload: dict = Depends(require_auth)):
    """Blocklist the current access token's JTI until it naturally expires."""
    jti = auth_payload.get("jti")
    exp = auth_payload.get("exp")
    if jti and exp:
        remaining = int(exp - datetime.now(timezone.utc).timestamp())
        if remaining > 0:
            await blocklist_jti(jti, remaining)
    return {"status": "logged_out"}


@app.get("/api/health")
async def health():
    """Orchestrator health check (public — no auth)."""
    return {"status": "ok"}


# ── Prometheus metrics ───────────────────────────────────────
from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

BOTS_TOTAL = Gauge("orch_bots_total", "Total registered bots")
BOTS_RUNNING = Gauge("orch_bots_running", "Bots in RUNNING state")
KILL_EVENTS_TOTAL = Counter("orch_kill_events_total", "Kill switch activations", ["type", "trigger"])
HEARTBEAT_FAILURES = Counter("orch_heartbeat_failures_total", "Heartbeat ping failures")
HEARTBEAT_CYCLE_ERRORS = Counter("orch_heartbeat_cycle_errors_total", "Heartbeat full-cycle failures (monitoring may be silent)")
API_REQUEST_DURATION = Histogram("orch_api_request_duration_seconds", "API request duration", ["method", "endpoint"])


@app.get("/api/metrics")
async def metrics(auth_payload: dict = Depends(require_auth)):
    """Prometheus metrics endpoint (auth-gated). Prometheus scraper must use
    a bearer token — configure bearer_token_file in prometheus.yml."""
    # Update gauges from DB
    from .database import async_session
    from .models.bot_instance import BotInstance, BotStatus
    from sqlalchemy import select, func

    async with async_session() as db:
        total = await db.scalar(
            select(func.count()).select_from(BotInstance).where(BotInstance.is_deleted.is_(False))
        )
        running = await db.scalar(
            select(func.count()).select_from(BotInstance).where(
                BotInstance.is_deleted.is_(False), BotInstance.status == BotStatus.RUNNING
            )
        )
        BOTS_TOTAL.set(total or 0)
        BOTS_RUNNING.set(running or 0)

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ── WebSocket proxy (§8: /api/v1/message/ws) ─────────────────
# Proxies WebSocket from frontend to a specific FT bot.
# FT sends real-time updates (trade opens/closes, new candles, etc.)

@app.websocket("/api/bots/{bot_id}/ws")
async def websocket_proxy(websocket: WebSocket, bot_id: int):
    """
    Proxy WebSocket connection to FT bot's /api/v1/message/ws.
    Frontend connects here → we connect to FT → bidirectional relay.
    Requires token query param for auth.
    """
    import websockets

    # Auth: require token as query parameter (WebSocket can't use headers)
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing auth token")
        return
    try:
        verify_token(token)
    except Exception as auth_exc:
        logger.warning("WS auth failed: %s", auth_exc)
        await websocket.close(code=4001, reason="Invalid auth token")
        return

    await websocket.accept()

    # Get bot from DB
    from .database import async_session
    from .models.bot_instance import BotInstance

    async with async_session() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(BotInstance).where(BotInstance.id == bot_id, BotInstance.is_deleted.is_(False))
        )
        bot = result.scalar_one_or_none()

    if not bot:
        try:
            await websocket.close(code=4004, reason="Bot not found")
        except Exception as exc:
            logger.debug("WS close failed (bot not found): %s", exc)
        return

    # Login to FT to get ws_token
    manager = app.state.bot_manager
    client = await manager.get_client(bot)
    try:
        token = await client._get_token()
    except Exception as auth_exc:
        logger.warning("FT auth failed for bot %s: %s", bot_id, auth_exc)
        try:
            await websocket.close(code=4001, reason="FT auth failed")
        except Exception as close_exc:
            logger.debug("WS close failed after auth error: %s", close_exc)
        return

    # Build FT WebSocket URL
    ft_ws_url = bot.api_url.replace("http://", "ws://").replace("https://", "wss://")
    ft_ws_url = f"{ft_ws_url}/api/v1/message/ws?token={token}"

    try:
        async with websockets.connect(ft_ws_url) as ft_ws:
            # Bidirectional relay
            async def ft_to_client():
                try:
                    async for message in ft_ws:
                        await websocket.send_text(message)
                except (websockets.exceptions.ConnectionClosed, WebSocketDisconnect):
                    pass

            async def client_to_ft():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await ft_ws.send(data)
                except WebSocketDisconnect:
                    pass

            # Run both directions concurrently
            done, pending = await asyncio.wait(
                [asyncio.create_task(ft_to_client()), asyncio.create_task(client_to_ft())],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
    except Exception as e:
        logger.warning("FT WebSocket relay failed for bot %s: %s", bot_id, e)
        try:
            await websocket.close(code=4002, reason=f"FT WebSocket failed: {e}")
        except Exception as close_exc:
            logger.debug("WS close failed after relay error: %s", close_exc)
