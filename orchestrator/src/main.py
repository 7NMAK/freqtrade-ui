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
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine
from .models.base import Base
from .heartbeat.monitor import HeartbeatMonitor
from .bot_manager.manager import BotManager
from .kill_switch.kill_switch import KillSwitch


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    # Create tables (dev convenience — production uses Alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize bot manager
    app.state.bot_manager = BotManager()

    # Initialize kill switch
    app.state.kill_switch = KillSwitch(app.state.bot_manager)

    # Start heartbeat monitor (wired to kill switch for auto-kill on failure)
    app.state.heartbeat = HeartbeatMonitor(app.state.bot_manager)
    app.state.heartbeat.set_kill_switch(app.state.kill_switch)
    heartbeat_task = asyncio.create_task(app.state.heartbeat.run())

    yield

    # Shutdown
    app.state.heartbeat.stop()
    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except asyncio.CancelledError:
        pass
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
from .api.bots import router as bots_router
from .api.kill_switch import router as kill_switch_router
from .api.portfolio import router as portfolio_router
from .api.strategies import router as strategies_router

app.include_router(bots_router, prefix="/api/bots", tags=["bots"])
app.include_router(kill_switch_router, prefix="/api/kill-switch", tags=["kill-switch"])
app.include_router(portfolio_router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(strategies_router, prefix="/api/strategies", tags=["strategies"])


@app.get("/api/health")
async def health():
    """Orchestrator health check."""
    return {"status": "ok"}
