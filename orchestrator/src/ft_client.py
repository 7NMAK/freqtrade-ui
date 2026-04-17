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
import asyncio
import logging
from typing import Callable, Awaitable

import httpx

logger = logging.getLogger(__name__)

# Optional async callback for DB-level activity logging.
# Set by main.py after startup so ft_client can log to audit_log DB table.
# Signature: (action, level, bot_id, bot_name, details, diagnosis) -> None
_activity_log_callback: Callable[..., Awaitable[None]] | None = None


def set_activity_log_callback(cb: Callable[..., Awaitable[None]] | None) -> None:
    """Set the callback that ft_client uses to persist logs to the DB."""
    global _activity_log_callback
    _activity_log_callback = cb


async def _log_ft_event(
    action: str,
    level: str = "error",
    details: str | None = None,
    diagnosis: str | None = None,
) -> None:
    """Fire-and-forget DB logging via callback. Never raises."""
    if _activity_log_callback is None:
        return
    try:
        await _activity_log_callback(
            action=action,
            level=level,
            details=details,
            diagnosis=diagnosis,
        )
    except Exception:
        logger.debug("Failed to persist FT event to DB (non-fatal)")


class FTClientError(Exception):
    """Error communicating with FreqTrade API."""

    def __init__(self, message: str, diagnosis: str | None = None):
        self.diagnosis = diagnosis
        super().__init__(message)


def _diagnose_connection_error(e: Exception, url: str) -> str:
    """Produce a precise, actionable diagnosis from a connection error."""
    err_str = str(e).lower()
    err_type = type(e).__name__

    # Parse the URL to get host/port
    host = url.split("://")[-1].split("/")[0].split(":")[0]
    port = url.split("://")[-1].split("/")[0].split(":")[-1] if ":" in url.split("://")[-1].split("/")[0] else "80"

    # DNS resolution failure
    if "name or service not known" in err_str or "nodename nor servname" in err_str or "getaddrinfo failed" in err_str:
        return (
            f"DNS resolution failed for '{host}'. "
            f"The hostname '{host}' cannot be resolved. "
            f"Check: (1) Is the FreqTrade container running? `docker ps | grep freqtrade` "
            f"(2) Is it on the same Docker network? `docker network inspect ft_network` "
            f"(3) Is the registered api_url correct? Currently: {url}"
        )

    # Connection refused
    if "connection refused" in err_str or "errno 111" in err_str:
        return (
            f"Connection refused at {host}:{port}. "
            f"FreqTrade container exists but is not accepting connections on port {port}. "
            f"Check: (1) Is FT actually running inside the container? `docker logs freqtrade --tail 20` "
            f"(2) Is the API server enabled in config.json? (api_server.enabled must be true) "
            f"(3) Is the port correct? Registered: {url}"
        )

    # Timeout
    if "timed out" in err_str or "timeout" in err_str:
        return (
            f"Connection to {host}:{port} timed out after 10s. "
            f"The host exists but is not responding. "
            f"Check: (1) Is FT under heavy load? (backtesting in progress?) "
            f"(2) Network issue between orchestrator and FT container "
            f"(3) Is FreqTrade's API server frozen? `docker restart freqtrade`"
        )

    # Network unreachable
    if "network is unreachable" in err_str or "no route to host" in err_str:
        return (
            f"Network unreachable to {host}. "
            f"Check: (1) Are both containers on ft_network? `docker network inspect ft_network` "
            f"(2) Did Docker network get recreated? `docker network connect ft_network freqtrade`"
        )

    # Connection reset
    if "connection reset" in err_str or "broken pipe" in err_str:
        return (
            f"Connection to {host}:{port} was reset by the server. "
            f"FreqTrade may have crashed or restarted. "
            f"Check: `docker logs freqtrade --tail 30`"
        )

    # SSL errors
    if "ssl" in err_str or "certificate" in err_str:
        return (
            f"SSL/TLS error connecting to {url}. "
            f"FreqTrade API should use HTTP (not HTTPS) for internal Docker communication. "
            f"Check that the registered api_url starts with http:// not https://"
        )

    # Generic fallback with full error details
    return (
        f"Connection failed to {url}. Error type: {err_type}. Detail: {e}. "
        f"Check: (1) `docker ps` — is freqtrade running? "
        f"(2) `docker network inspect ft_network` — are both containers on the same network? "
        f"(3) `curl {url}/api/v1/ping` from inside orchestrator container"
    )


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
        self._token_lock = asyncio.Lock()
        # keepalive_expiry=0 prevents reuse of stale connections (RemoteProtocolError)
        self._client = httpx.AsyncClient(
            timeout=10.0,
            limits=httpx.Limits(max_keepalive_connections=5, keepalive_expiry=30),
        )

    async def _login(self) -> str:
        """POST /api/v1/token/login — get JWT token."""
        login_url = f"{self.api_url}/api/v1/token/login"
        logger.info("FT login attempt: %s (user=%s)", login_url, self.username)
        try:
            resp = await self._client.post(
                login_url,
                auth=(self.username, self.password),
            )
        except (httpx.HTTPError, OSError) as e:
            diag = _diagnose_connection_error(e, self.api_url)
            logger.error("FT login connection failed: %s — DIAGNOSIS: %s", self.api_url, diag)
            await _log_ft_event("ft.connection_failed", "error", f"Login to {self.api_url}", diag)
            raise FTClientError(f"FT connection failed: {diag}", diagnosis=diag) from e
        if resp.status_code == 401:
            logger.error("FT login auth failed (401): wrong username/password for %s", self.api_url)
            diag = "Authentication failed. The username or password registered for this bot is incorrect."
            await _log_ft_event("ft.login_failed", "error", f"401 at {self.api_url}", diag)
            raise FTClientError(
                f"FT login failed: wrong credentials for {self.api_url}. Check api_username and api_password in bot registration.",
                diagnosis=diag,
            )
        if resp.status_code != 200:
            logger.error("FT login failed: %s %s (url=%s)", resp.status_code, resp.text[:200], self.api_url)
            await _log_ft_event("ft.login_failed", "error", f"HTTP {resp.status_code} at {self.api_url}")
            raise FTClientError(f"FT login failed: HTTP {resp.status_code} — {resp.text[:200]}")
        data = resp.json()
        self._token = data.get("access_token")
        if not self._token:
            raise FTClientError("No access_token in login response")
        logger.info("FT login success: %s", self.api_url)
        await _log_ft_event("ft.login_success", "info", f"Logged into {self.api_url}")
        return self._token

    async def _refresh_token(self) -> str:
        """POST /api/v1/token/refresh — refresh JWT token."""
        try:
            resp = await self._client.post(
                f"{self.api_url}/api/v1/token/refresh",
                headers={"Authorization": f"Bearer {self._token}"},
            )
        except httpx.HTTPError:
            # Refresh failed — fall back to full login
            return await self._login()
        if resp.status_code != 200:
            return await self._login()
        data = resp.json()
        self._token = data.get("access_token")
        if not self._token:
            raise FTClientError("No access_token in refresh response")
        return self._token

    async def _get_token(self) -> str:
        """Get valid token, login if needed. Thread-safe via lock."""
        async with self._token_lock:
            if not self._token:
                await self._login()
            return self._token

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """Make authenticated request to FT API."""
        full_url = f"{self.api_url}{path}"
        logger.debug("FT request: %s %s", method, full_url)

        try:
            token = await self._get_token()
        except FTClientError:
            raise  # Already diagnosed and logged in _login
        except (httpx.HTTPError, OSError) as e:
            diag = _diagnose_connection_error(e, self.api_url)
            logger.error("FT auth failed before request: %s %s — DIAGNOSIS: %s", method, path, diag)
            await _log_ft_event("ft.connection_failed", "error", f"Auth before {method} {path}", diag)
            raise FTClientError(f"FT connection failed: {diag}", diagnosis=diag) from e

        headers = {"Authorization": f"Bearer {token}"}

        try:
            resp = await self._client.request(method, full_url, headers=headers, **kwargs)
        except httpx.RemoteProtocolError:
            # Stale keep-alive connection — retry once with a fresh attempt
            logger.warning("FT stale connection on %s %s, retrying once", method, full_url)
            try:
                resp = await self._client.request(method, full_url, headers=headers, **kwargs)
            except (httpx.HTTPError, OSError) as e:
                diag = _diagnose_connection_error(e, self.api_url)
                logger.error("FT request failed after retry: %s %s — %s", method, full_url, diag)
                await _log_ft_event("ft.connection_failed", "error", f"{method} {path} to {self.api_url}", diag)
                raise FTClientError(f"FT connection failed: {diag}", diagnosis=diag) from e
        except (httpx.HTTPError, OSError) as e:
            diag = _diagnose_connection_error(e, self.api_url)
            logger.error("FT request failed: %s %s — DIAGNOSIS: %s", method, full_url, diag)
            await _log_ft_event("ft.connection_failed", "error", f"{method} {path} to {self.api_url}", diag)
            raise FTClientError(f"FT connection failed: {diag}", diagnosis=diag) from e

        # Token expired — try refresh, then re-login
        if resp.status_code == 401:
            logger.info("FT token expired, refreshing: %s %s", method, path)
            try:
                await self._refresh_token()
                headers = {"Authorization": f"Bearer {self._token}"}
                resp = await self._client.request(method, full_url, headers=headers, **kwargs)
            except (httpx.HTTPError, OSError) as e:
                diag = _diagnose_connection_error(e, self.api_url)
                logger.error("FT retry failed: %s %s — DIAGNOSIS: %s", method, full_url, diag)
                raise FTClientError(f"FT connection failed: {diag}", diagnosis=diag) from e

        if resp.status_code >= 400:
            body = resp.text[:500]
            logger.error("FT API error: %s %s → %d %s", method, path, resp.status_code, body)

            # Parse FT error detail for actionable info
            diagnosis = None
            if resp.status_code == 502:
                diagnosis = f"FreqTrade returned 502 Bad Gateway on {method} {path}. The bot process may have crashed."
            elif resp.status_code == 503:
                diagnosis = f"FreqTrade returned 503 on {method} {path}. Bot is not in the correct state — check if it's running."
            elif resp.status_code == 404:
                diagnosis = f"FreqTrade has no endpoint at {path}. Check that the FT version supports this feature."

            error_level = "error" if resp.status_code >= 500 else "warning"
            await _log_ft_event(
                "ft.api_error", error_level,
                f"{method} {path} -> {resp.status_code} {body[:200]}",
                diagnosis,
            )
            raise FTClientError(
                f"FT API error: {method} {path} → {resp.status_code} {body}",
                diagnosis=diagnosis,
            )

        logger.debug("FT response OK: %s %s → %d", method, path, resp.status_code)
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
        ping_url = f"{self.api_url}/api/v1/ping"
        try:
            resp = await self._client.get(ping_url, timeout=5.0)
            return resp.json()
        except (httpx.HTTPError, OSError) as e:
            diag = _diagnose_connection_error(e, self.api_url)
            logger.warning("FT ping failed: %s — DIAGNOSIS: %s", ping_url, diag)
            await _log_ft_event("ft.ping_failed", "warning", f"Ping {ping_url}", diag)
            raise FTClientError(f"Ping failed: {diag}", diagnosis=diag) from e

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
        if stake_amount is not None:
            data["stakeamount"] = stake_amount
        return await self._post("/api/v1/forceenter", data)

    async def status(self) -> dict | list:
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

    async def performance(self) -> dict | list:
        """GET /api/v1/performance — per-pair performance."""
        return await self._get("/api/v1/performance")

    async def entries(self) -> dict | list:
        """GET /api/v1/entries — entry tag analysis."""
        return await self._get("/api/v1/entries")

    async def exits(self) -> dict | list:
        """GET /api/v1/exits — exit reason analysis."""
        return await self._get("/api/v1/exits")

    async def mix_tags(self) -> dict | list:
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

    async def backtest_history_result(self, filename: str, strategy: str) -> dict:
        """GET /api/v1/backtest/history/result — specific result."""
        return await self._get("/api/v1/backtest/history/result", filename=filename, strategy=strategy)

    async def backtest_history_delete(self, strategy: str, filename: str) -> dict:
        """DELETE /api/v1/backtest/history/result — delete backtest result (FT expects query params)."""
        return await self._request("DELETE", "/api/v1/backtest/history/result", params={"strategy": strategy, "filename": filename})

    # ── Cleanup ──────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
