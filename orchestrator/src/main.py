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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
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


# ── WebSocket proxy (§8: /api/v1/message/ws) ─────────────────
# Proxies WebSocket from frontend to a specific FT bot.
# FT sends real-time updates (trade opens/closes, new candles, etc.)

@app.websocket("/api/bots/{bot_id}/ws")
async def websocket_proxy(websocket: WebSocket, bot_id: int):
    """
    Proxy WebSocket connection to FT bot's /api/v1/message/ws.
    Frontend connects here → we connect to FT → bidirectional relay.
    """
    import httpx
    import websockets

    await websocket.accept()

    # Get bot from DB
    from .database import async_session
    from .models.bot_instance import BotInstance

    async with async_session() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(BotInstance).where(BotInstance.id == bot_id, BotInstance.is_deleted == False)
        )
        bot = result.scalar_one_or_none()

    if not bot:
        await websocket.close(code=4004, reason="Bot not found")
        return

    # Login to FT to get ws_token
    manager = app.state.bot_manager
    client = manager.get_client(bot)
    try:
        token = await client._get_token()
    except Exception:
        await websocket.close(code=4001, reason="FT auth failed")
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
        await websocket.close(code=4002, reason=f"FT WebSocket failed: {e}")
