"""
FreqTrade REST API Client.

This is a thin wrapper around FT's REST API (§8 of FREQTRADE_REFERENCE.md).
We do NOT add any custom logic — just call FT endpoints and return their data.

Every method maps to exactly one FT API endpoint:
- ping()         → GET  /api/v1/ping
- start()        → POST /api/v1/start
- stop()         → POST /api/v1/stop
- stopbuy()      → POST /api/v1/stopbuy
- pause()        → POST /api/v1/pause
- reload_config()→ POST /api/v1/reload_config
- forceexit()    → POST /api/v1/forceexit
- forceenter()   → POST /api/v1/forceenter
- status()       → GET  /api/v1/status
- trades()       → GET  /api/v1/trades
- trade()        → GET  /api/v1/trades/{id}
- profit()       → GET  /api/v1/profit
- balance()      → GET  /api/v1/balance
- daily()        → GET  /api/v1/daily
- weekly()       → GET  /api/v1/weekly
- monthly()      → GET  /api/v1/monthly
- performance()  → GET  /api/v1/performance
- entries()      → GET  /api/v1/entries
- exits()        → GET  /api/v1/exits
- mix_tags()     → GET  /api/v1/mix_tags
- stats()        → GET  /api/v1/stats
- count()        → GET  /api/v1/count
- show_config()  → GET  /api/v1/show_config
- health()       → GET  /api/v1/health
- version()      → GET  /api/v1/version
- sysinfo()      → GET  /api/v1/sysinfo
- logs()         → GET  /api/v1/logs
- whitelist()    → GET  /api/v1/whitelist
- blacklist_get()→ GET  /api/v1/blacklist
- blacklist_add()→ POST /api/v1/blacklist
- locks()        → GET  /api/v1/locks
- strategies()   → GET  /api/v1/strategies
- strategy()     → GET  /api/v1/strategy/{name}
- freqaimodels() → GET  /api/v1/freqaimodels
- plot_config()  → GET  /api/v1/plot_config
- pair_candles() → GET  /api/v1/pair_candles
- pair_history() → GET  /api/v1/pair_history
- backtest_start()  → POST /api/v1/backtest
- backtest_status() → GET  /api/v1/backtest
- backtest_abort()  → DELETE /api/v1/backtest
- backtest_history() → GET /api/v1/backtest/history
"""
import httpx


class FTClientError(Exception):
    """Error communicating with FreqTrade API."""
    pass


class FTClient:
    """
    Async client for a single FreqTrade bot instance.
    One FTClient per bot.
    """

    def __init__(self, api_url: str, username: str, password: str):
        self.api_url = api_url.rstrip("/")
        self.username = username
        self.password = password
        self._token: str | None = None
        self._client = httpx.AsyncClient(timeout=10.0)

    async def _login(self) -> str:
        """POST /api/v1/token/login — get JWT token."""
        resp = await self._client.post(
            f"{self.api_url}/api/v1/token/login",
            auth=(self.username, self.password),
        )
        if resp.status_code != 200:
            raise FTClientError(f"Login failed: {resp.status_code} {resp.text}")
        data = resp.json()
        self._token = data.get("access_token")
        return self._token

    async def _get_token(self) -> str:
        """Get valid token, login if needed."""
        if not self._token:
            await self._login()
        return self._token

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """Make authenticated request to FT API."""
        token = await self._get_token()
        headers = {"Authorization": f"Bearer {token}"}

        resp = await self._client.request(
            method,
            f"{self.api_url}{path}",
            headers=headers,
            **kwargs,
        )

        # Token expired — re-login once
        if resp.status_code == 401:
            await self._login()
            headers = {"Authorization": f"Bearer {self._token}"}
            resp = await self._client.request(
                method,
                f"{self.api_url}{path}",
                headers=headers,
                **kwargs,
            )

        if resp.status_code >= 400:
            raise FTClientError(f"FT API error: {method} {path} → {resp.status_code} {resp.text}")

        return resp.json()

    async def _get(self, path: str, **params) -> dict:
        return await self._request("GET", path, params=params)

    async def _post(self, path: str, data: dict | None = None) -> dict:
        return await self._request("POST", path, json=data or {})

    async def _delete(self, path: str) -> dict:
        return await self._request("DELETE", path)

    # ── Bot Control (§8) ─────────────────────────────────────────

    async def ping(self) -> dict:
        """GET /api/v1/ping — health check (no auth needed but we auth anyway)."""
        try:
            resp = await self._client.get(f"{self.api_url}/api/v1/ping", timeout=5.0)
            return resp.json()
        except Exception:
            raise FTClientError(f"Ping failed for {self.api_url}")

    async def start(self) -> dict:
        """POST /api/v1/start — start trading."""
        return await self._post("/api/v1/start")

    async def stop(self) -> dict:
        """POST /api/v1/stop — stop trading (Soft Kill)."""
        return await self._post("/api/v1/stop")

    async def stopbuy(self) -> dict:
        """POST /api/v1/stopbuy — stop new entries only."""
        return await self._post("/api/v1/stopbuy")

    async def pause(self) -> dict:
        """POST /api/v1/pause — pause trading."""
        return await self._post("/api/v1/pause")

    async def reload_config(self) -> dict:
        """POST /api/v1/reload_config — reload configuration."""
        return await self._post("/api/v1/reload_config")

    # ── Trading (§8) ─────────────────────────────────────────────

    async def forceexit(self, trade_id: int | str = "all") -> dict:
        """POST /api/v1/forceexit — force close a trade (Hard Kill uses 'all')."""
        return await self._post("/api/v1/forceexit", {"tradeid": str(trade_id)})

    async def forceenter(self, pair: str, side: str = "long", stake_amount: float | None = None) -> dict:
        """POST /api/v1/forceenter — force open a trade."""
        data = {"pair": pair, "side": side}
        if stake_amount:
            data["stakeamount"] = stake_amount
        return await self._post("/api/v1/forceenter", data)

    async def status(self) -> list:
        """GET /api/v1/status — open trades (uses FT field names: open_rate, stake_amount, etc.)."""
        return await self._get("/api/v1/status")

    async def trades(self, limit: int = 50, offset: int = 0) -> dict:
        """GET /api/v1/trades — trade history (paginated)."""
        return await self._get("/api/v1/trades", limit=limit, offset=offset)

    async def trade(self, trade_id: int) -> dict:
        """GET /api/v1/trades/{id} — single trade."""
        return await self._get(f"/api/v1/trades/{trade_id}")

    async def delete_trade(self, trade_id: int) -> dict:
        """DELETE /api/v1/trades/{id} — delete trade."""
        return await self._delete(f"/api/v1/trades/{trade_id}")

    async def cancel_open_order(self, trade_id: int) -> dict:
        """DELETE /api/v1/trades/{id}/open-order — cancel open order."""
        return await self._delete(f"/api/v1/trades/{trade_id}/open-order")

    async def reload_trade(self, trade_id: int) -> dict:
        """POST /api/v1/trades/{id}/reload — reload from exchange."""
        return await self._post(f"/api/v1/trades/{trade_id}/reload")

    # ── Status & Info (§8) ───────────────────────────────────────

    async def profit(self) -> dict:
        """GET /api/v1/profit — overall profit stats."""
        return await self._get("/api/v1/profit")

    async def balance(self) -> dict:
        """GET /api/v1/balance — account balance."""
        return await self._get("/api/v1/balance")

    async def daily(self, days: int = 30) -> dict:
        """GET /api/v1/daily — daily profit."""
        return await self._get("/api/v1/daily", timescale=days)

    async def weekly(self, weeks: int = 12) -> dict:
        """GET /api/v1/weekly — weekly profit."""
        return await self._get("/api/v1/weekly", timescale=weeks)

    async def monthly(self, months: int = 6) -> dict:
        """GET /api/v1/monthly — monthly profit."""
        return await self._get("/api/v1/monthly", timescale=months)

    async def performance(self) -> list:
        """GET /api/v1/performance — per-pair performance."""
        return await self._get("/api/v1/performance")

    async def entries(self) -> list:
        """GET /api/v1/entries — entry tag analysis."""
        return await self._get("/api/v1/entries")

    async def exits(self) -> list:
        """GET /api/v1/exits — exit reason analysis."""
        return await self._get("/api/v1/exits")

    async def mix_tags(self) -> list:
        """GET /api/v1/mix_tags — combined tag analysis."""
        return await self._get("/api/v1/mix_tags")

    async def stats(self) -> dict:
        """GET /api/v1/stats — trade statistics."""
        return await self._get("/api/v1/stats")

    async def count(self) -> dict:
        """GET /api/v1/count — open trade count."""
        return await self._get("/api/v1/count")

    async def show_config(self) -> dict:
        """GET /api/v1/show_config — current config."""
        return await self._get("/api/v1/show_config")

    async def health(self) -> dict:
        """GET /api/v1/health — bot health."""
        return await self._get("/api/v1/health")

    async def version(self) -> dict:
        """GET /api/v1/version — bot version."""
        return await self._get("/api/v1/version")

    async def sysinfo(self) -> dict:
        """GET /api/v1/sysinfo — system info."""
        return await self._get("/api/v1/sysinfo")

    async def logs(self, limit: int = 50) -> dict:
        """GET /api/v1/logs — bot logs."""
        return await self._get("/api/v1/logs", limit=limit)

    # ── Data (§8) ────────────────────────────────────────────────

    async def whitelist(self) -> dict:
        """GET /api/v1/whitelist — current whitelist."""
        return await self._get("/api/v1/whitelist")

    async def blacklist_get(self) -> dict:
        """GET /api/v1/blacklist — current blacklist."""
        return await self._get("/api/v1/blacklist")

    async def blacklist_add(self, pairs: list[str]) -> dict:
        """POST /api/v1/blacklist — add to blacklist."""
        return await self._post("/api/v1/blacklist", {"blacklist": pairs})

    async def blacklist_remove(self, pairs: list[str]) -> dict:
        """DELETE /api/v1/blacklist — remove from blacklist."""
        return await self._request("DELETE", "/api/v1/blacklist", json={"blacklist": pairs})

    async def locks(self) -> dict:
        """GET /api/v1/locks — pair locks."""
        return await self._get("/api/v1/locks")

    async def lock_add(self, pair: str, until: str, reason: str = "") -> dict:
        """POST /api/v1/locks — create lock."""
        return await self._post("/api/v1/locks", {"pair": pair, "until": until, "reason": reason})

    async def lock_delete(self, lock_id: int) -> dict:
        """DELETE /api/v1/locks/{id} — delete lock."""
        return await self._delete(f"/api/v1/locks/{lock_id}")

    async def strategies(self) -> dict:
        """GET /api/v1/strategies — available strategies."""
        return await self._get("/api/v1/strategies")

    async def strategy(self, name: str) -> dict:
        """GET /api/v1/strategy/{name} — strategy details/source."""
        return await self._get(f"/api/v1/strategy/{name}")

    async def freqaimodels(self) -> dict:
        """GET /api/v1/freqaimodels — available FreqAI models."""
        return await self._get("/api/v1/freqaimodels")

    async def plot_config(self) -> dict:
        """GET /api/v1/plot_config — strategy plotting config."""
        return await self._get("/api/v1/plot_config")

    async def pair_candles(self, pair: str, timeframe: str, limit: int = 500) -> dict:
        """GET /api/v1/pair_candles — OHLCV data."""
        return await self._get("/api/v1/pair_candles", pair=pair, timeframe=timeframe, limit=limit)

    async def pair_history(self, pair: str, timeframe: str, timerange: str = "") -> dict:
        """GET /api/v1/pair_history — historical with indicators."""
        params = {"pair": pair, "timeframe": timeframe}
        if timerange:
            params["timerange"] = timerange
        return await self._get("/api/v1/pair_history", **params)

    async def available_pairs(self, timeframe: str = "") -> dict:
        """GET /api/v1/available_pairs — available pairs."""
        params = {}
        if timeframe:
            params["timeframe"] = timeframe
        return await self._get("/api/v1/available_pairs", **params)

    # ── Backtesting (§8) ─────────────────────────────────────────

    async def backtest_start(self, config: dict) -> dict:
        """POST /api/v1/backtest — start backtest."""
        return await self._post("/api/v1/backtest", config)

    async def backtest_status(self) -> dict:
        """GET /api/v1/backtest — get backtest status/results."""
        return await self._get("/api/v1/backtest")

    async def backtest_abort(self) -> dict:
        """DELETE /api/v1/backtest — abort backtest."""
        return await self._delete("/api/v1/backtest")

    async def backtest_history(self) -> dict:
        """GET /api/v1/backtest/history — backtest history."""
        return await self._get("/api/v1/backtest/history")

    async def backtest_history_result(self, result_id: str) -> dict:
        """GET /api/v1/backtest/history/result — specific result."""
        return await self._get("/api/v1/backtest/history/result", id=result_id)

    # ── Cleanup ──────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
