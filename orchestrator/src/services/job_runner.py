"""
JobRunner — Background worker that processes test jobs.

Runs as an asyncio task (like HeartbeatMonitor). Picks up queued jobs
from the DB and executes them against FreqTrade bots via FTClient.

Lifecycle:
  1. Poll DB for oldest 'queued' job
  2. Mark as 'running', start FT backtest/hyperopt
  3. Poll FT for progress, update DB
  4. On completion: save results, create experiment_run, mark 'completed'
  5. On error: save error_message, mark 'failed'
"""
import asyncio
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select, update

from ..database import async_session
from ..models.test_job import TestJob
from ..models.experiment_run import ExperimentRun
from ..ft_client import FTClient, FTClientError

logger = logging.getLogger(__name__)


class JobRunner:
    """Background worker for test job execution."""

    def __init__(self, bot_manager):
        self.bot_manager = bot_manager
        self._stopped = False
        self._current_job_id: int | None = None

    def stop(self):
        self._stopped = True

    async def run(self):
        """Main loop — runs forever until stopped."""
        logger.info("JobRunner started — waiting for test jobs...")

        # C3 FIX: Recover stale jobs from previous crash
        await self._recover_stale_jobs()

        while not self._stopped:
            try:
                job = await self._pick_next_job()
                if job:
                    await self._execute_job(job)
                else:
                    await asyncio.sleep(2)
            except Exception as e:
                logger.error("JobRunner loop error: %s", e, exc_info=True)
                await asyncio.sleep(5)

    async def _recover_stale_jobs(self):
        """C3 FIX: Reset jobs that were 'running' when we crashed/restarted."""
        try:
            async with async_session() as db:
                result = await db.execute(
                    update(TestJob)
                    .where(TestJob.status == "running")
                    .values(
                        status="queued",
                        current_step="Recovered after restart — re-queued",
                        progress=0.0,
                    )
                )
                if result.rowcount > 0:
                    logger.warning("Recovered %d stale running jobs → re-queued", result.rowcount)
                await db.commit()
        except Exception as e:
            logger.error("Failed to recover stale jobs: %s", e)

    async def _pick_next_job(self) -> dict | None:
        """Get the oldest queued job from DB. Uses FOR UPDATE SKIP LOCKED to prevent races."""
        async with async_session() as db:
            # C1 FIX: Use FOR UPDATE SKIP LOCKED to atomically claim the job
            result = await db.execute(
                select(TestJob)
                .where(TestJob.status == "queued")
                .order_by(TestJob.created_at.asc())
                .limit(1)
                .with_for_update(skip_locked=True)
            )
            job = result.scalar_one_or_none()
            if not job:
                return None

            # Mark as running (atomic — we hold the lock)
            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            job.current_step = "Starting..."
            await db.commit()

            return {
                "id": job.id,
                "experiment_id": job.experiment_id,
                "bot_id": job.bot_id,
                "job_type": job.job_type,
                "strategy": job.strategy,
                "config": job.config,
                "matrix_total": job.matrix_total,
            }

    async def _execute_job(self, job: dict):
        """Route to the correct handler based on job_type."""
        self._current_job_id = job["id"]
        logger.info("JobRunner executing job #%d (type=%s)", job["id"], job["job_type"])

        try:
            client = await self._get_client(job["bot_id"])

            if job["job_type"] == "backtest":
                await self._run_backtest(job, client)
            elif job["job_type"] == "hyperopt":
                # C2 FIX: Hyperopt uses Docker exec, not FT REST API
                await self._run_hyperopt(job)
            elif job["job_type"] == "freqai_matrix":
                await self._run_freqai_matrix(job, client)
            else:
                await self._fail_job(job["id"], f"Unknown job_type: {job['job_type']}")

        except FTClientError as e:
            logger.error("Job #%d FT error: %s", job["id"], e)
            await self._fail_job(job["id"], str(e))
        except Exception as e:
            logger.error("Job #%d unexpected error: %s", job["id"], e, exc_info=True)
            await self._fail_job(job["id"], str(e))
        finally:
            self._current_job_id = None

    async def _get_client(self, bot_id: int) -> FTClient:
        """Get FTClient for a bot by ID."""
        from ..models.bot_instance import BotInstance

        async with async_session() as db:
            result = await db.execute(
                select(BotInstance).where(
                    BotInstance.id == bot_id,
                    BotInstance.is_deleted.is_(False),
                )
            )
            bot = result.scalar_one_or_none()
            if not bot:
                raise FTClientError(f"Bot #{bot_id} not found")

        return await self.bot_manager.get_client(bot)

    # ── Single Backtest ──────────────────────────────────────────────

    async def _run_backtest(self, job: dict, client: FTClient):
        """Run a single backtest against FT via REST API."""
        config = job["config"]
        if not config:
            await self._fail_job(job["id"], "No config provided")
            return

        # Start backtest on FT
        await client.backtest_start(config)
        await self._update_step(job["id"], "Running backtest...", 0.0)

        # Poll until done
        result = await self._poll_ft(job["id"], client)
        if result is None:
            return  # Cancelled or timed out — already handled

        # Extract metrics
        metrics = self._extract_metrics(result, job["strategy"])

        # Save results (strip trade list to avoid DB bloat — M2 fix)
        slim_result = self._slim_result(result, job["strategy"])

        # Save results
        await self._complete_job(job["id"], metrics, slim_result)

        # Create experiment_run
        await self._create_experiment_run(job, metrics)

        logger.info("Job #%d completed: %d trades, %.2f%% profit",
                     job["id"], metrics.get("total_trades", 0), metrics.get("profit_pct", 0))

    # ── Hyperopt (Docker Exec) ───────────────────────────────────────

    async def _run_hyperopt(self, job: dict):
        """C2 FIX: Run hyperopt via Docker exec — NOT the FT REST API.

        Hyperopt uses `freqtrade hyperopt --config ... --epochs N --spaces buy sell ...`
        which is a CLI command, not a REST endpoint.
        """
        import docker

        config = job["config"]
        if not config:
            await self._fail_job(job["id"], "No config provided")
            return

        # Get the Docker container for this bot
        container_name = config.get("container_name")
        if not container_name:
            # Look up from DB
            from ..models.bot_instance import BotInstance
            async with async_session() as db:
                result = await db.execute(
                    select(BotInstance.container_id, BotInstance.name)
                    .where(BotInstance.id == job["bot_id"])
                )
                row = result.one_or_none()
                if row:
                    container_name = row[0] or row[1]

        if not container_name:
            await self._fail_job(job["id"], "No Docker container found for this bot")
            return

        # Build the hyperopt command
        cmd = ["freqtrade", "hyperopt", "--config", "/freqtrade/user_data/config_backtest.json"]
        cmd += ["--strategy", job["strategy"]]

        epochs = config.get("epochs", 100)
        cmd += ["--epochs", str(epochs)]

        spaces = config.get("spaces", [])
        if spaces:
            cmd += ["--spaces"] + spaces

        loss = config.get("hyperopt_loss") or config.get("loss")
        if loss:
            cmd += ["--hyperopt-loss", loss]

        timerange = config.get("timerange")
        if timerange:
            cmd += ["--timerange", timerange]

        await self._update_step(job["id"], f"Starting hyperopt ({epochs} epochs)...", 0.0)

        # Run via Docker exec in a thread (blocking call)
        try:
            docker_client = docker.from_env()
            container = docker_client.containers.get(container_name)

            # Remove stale lock file
            try:
                container.exec_run(["rm", "-f", "/freqtrade/user_data/hyperopt.lock"])
            except Exception:
                pass

            # Execute hyperopt (this blocks for minutes/hours)
            loop = asyncio.get_event_loop()
            exit_code, output = await loop.run_in_executor(
                None,
                lambda: container.exec_run(cmd, demux=True)
            )

            stdout = (output[0] or b"").decode("utf-8", errors="replace")
            stderr = (output[1] or b"").decode("utf-8", errors="replace")
            full_output = stdout + stderr

            if exit_code != 0:
                await self._fail_job(job["id"], f"Hyperopt exited with code {exit_code}: {full_output[-1000:]}")
                return

            # Parse output for metrics
            metrics = self._parse_hyperopt_output(full_output)

            await self._complete_job(job["id"], metrics, {"output": full_output[-8000:]})
            await self._create_experiment_run(job, metrics)

            logger.info("Job #%d hyperopt completed: %d trades, %.2f%% profit",
                         job["id"], metrics.get("total_trades", 0), metrics.get("profit_pct", 0))

        except docker.errors.NotFound:
            await self._fail_job(job["id"], f"Docker container '{container_name}' not found")
        except docker.errors.APIError as e:
            await self._fail_job(job["id"], f"Docker API error: {e}")

    def _parse_hyperopt_output(self, output: str) -> dict:
        """Parse hyperopt CLI output for key metrics."""
        try:
            from ..services.hyperopt_parser import parse_hyperopt_output
            parsed = parse_hyperopt_output(output)
            if parsed:
                return {
                    "total_trades": parsed.get("total_trades", 0),
                    "win_rate": parsed.get("win_rate", 0),
                    "profit_pct": parsed.get("profit_pct", 0),
                    "max_drawdown": parsed.get("max_drawdown", 0),
                    "sharpe_ratio": parsed.get("sharpe_ratio", 0),
                    "sortino_ratio": parsed.get("sortino_ratio", 0),
                }
        except Exception as e:
            logger.warning("Failed to parse hyperopt output: %s", e)

        return {"total_trades": 0, "profit_pct": 0, "win_rate": 0,
                "max_drawdown": 0, "sharpe_ratio": 0, "sortino_ratio": 0}

    # ── FreqAI Matrix ────────────────────────────────────────────────

    async def _run_freqai_matrix(self, job: dict, client: FTClient):
        """Run a FreqAI matrix — multiple sequential backtests."""
        config = job["config"]
        queue = config.get("queue", [])
        if not queue:
            await self._fail_job(job["id"], "Empty matrix queue")
            return

        total = len(queue)
        matrix_results = []

        for i, item in enumerate(queue):
            # Check for cancellation
            if await self._is_cancelled(job["id"]):
                logger.info("Job #%d cancelled at step %d/%d", job["id"], i + 1, total)
                break

            label = item.get("label", f"Run {i + 1}")
            await self._update_step(
                job["id"],
                f"[{i + 1}/{total}] {label} — starting...",
                i / total,
                matrix_completed=i,
            )

            try:
                # Start the backtest
                bt_config = item.get("config", item)
                await client.backtest_start(bt_config)

                # Update step to training
                await self._update_step(
                    job["id"],
                    f"[{i + 1}/{total}] {label} — training...",
                    (i + 0.1) / total,
                )

                # Poll until done
                result = await self._poll_ft(job["id"], client, step_prefix=f"[{i + 1}/{total}] {label}")
                if result is None:
                    matrix_results.append({"label": label, "status": "cancelled"})
                    break

                # Extract metrics
                metrics = self._extract_metrics(result, job["strategy"])
                entry = {
                    "label": label,
                    "model": item.get("model", ""),
                    "outlier": item.get("outlier", ""),
                    "pca": item.get("pca", False),
                    "noise": item.get("noise", False),
                    "status": "completed",
                    **metrics,
                }
                matrix_results.append(entry)

                # Create experiment_run for each combo
                await self._create_experiment_run(job, metrics, extra_raw={
                    "model": item.get("model", ""),
                    "outlier": item.get("outlier", ""),
                    "pca": item.get("pca", False),
                    "noise": item.get("noise", False),
                })

                # Clean up for next run
                try:
                    await client.backtest_abort()
                except Exception:
                    pass
                await asyncio.sleep(1)  # Cool-down

            except FTClientError as e:
                logger.warning("Job #%d step %d/%d failed: %s", job["id"], i + 1, total, e)
                matrix_results.append({"label": label, "status": "failed", "error": str(e)})
                try:
                    await client.backtest_abort()
                except Exception:
                    pass
                await asyncio.sleep(2)

        # Find best result
        completed = [r for r in matrix_results if r.get("status") == "completed"]
        best = max(completed, key=lambda r: r.get("profit_pct", -999)) if completed else {}

        await self._complete_matrix(job["id"], total, completed, matrix_results, best)
        logger.info("Job #%d matrix complete: %d/%d succeeded", job["id"], len(completed), total)

    async def _complete_matrix(self, job_id: int, total: int,
                                completed: list, matrix_results: list, best: dict):
        """Mark matrix job as completed."""
        try:
            async with async_session() as db:
                await db.execute(
                    update(TestJob)
                    .where(TestJob.id == job_id)
                    .values(
                        status="completed",
                        progress=1.0,
                        current_step=f"Matrix complete: {len(completed)}/{total} succeeded",
                        completed_at=datetime.now(timezone.utc),
                        matrix_completed=len(completed),
                        matrix_results=matrix_results,
                        total_trades=best.get("total_trades"),
                        profit_pct=best.get("profit_pct"),
                        win_rate=best.get("win_rate"),
                        max_drawdown=best.get("max_drawdown"),
                        sharpe_ratio=best.get("sharpe_ratio"),
                        sortino_ratio=best.get("sortino_ratio"),
                    )
                )
                await db.commit()
        except Exception as e:
            logger.error("Failed to complete matrix job #%d: %s", job_id, e)

    # ── FT Polling ───────────────────────────────────────────────────

    async def _poll_ft(self, job_id: int, client: FTClient,
                       step_prefix: str = "", max_polls: int = 600) -> dict | None:
        """Poll FT backtest status until done. Returns result dict or None if cancelled."""
        poll_count = 0
        last_db_update = 0.0

        for _ in range(max_polls):
            if await self._is_cancelled(job_id):
                return None

            await asyncio.sleep(3)
            poll_count += 1

            try:
                raw = await client.backtest_status()
            except FTClientError as e:
                logger.warning("Job #%d poll error: %s", job_id, e)
                continue

            running = raw.get("running", True)
            step = raw.get("step", "")
            progress = raw.get("progress", 0)

            # M1 FIX: Throttle DB updates to every 5 polls (~15s)
            if step and (time.monotonic() - last_db_update) > 12:
                pct = (progress or 0) * 100
                display = f"{step_prefix} — {step} ({pct:.0f}%)" if step_prefix else f"{step} ({pct:.0f}%)"
                await self._update_step(job_id, display, progress or 0)
                last_db_update = time.monotonic()

            if not running and step in ("finished", "done", "backtest"):
                if step == "backtest" and progress == 1:
                    return raw
                if step in ("finished", "done"):
                    return raw

            if step == "error":
                await self._fail_job(job_id, f"FT backtest error: {raw.get('status', 'unknown')}")
                return None

        # Timeout
        await self._fail_job(job_id, "Polling timed out after 30 minutes")
        return None

    # ── Result Extraction ────────────────────────────────────────────

    def _extract_metrics(self, raw: dict, strategy: str) -> dict:
        """Extract key metrics from FT backtest result."""
        br = raw.get("backtest_result", {})
        strat_data = br.get("strategy", br)

        sd = strat_data.get(strategy) or strat_data.get(next(iter(strat_data), ""), {})
        if not isinstance(sd, dict):
            sd = {}

        tt = int(sd.get("total_trades", 0) or 0)
        wins = int(sd.get("wins", 0) or 0)
        losses = int(sd.get("losses", 0) or 0)
        draws = int(sd.get("draws", 0) or 0)
        total = wins + losses + draws
        wr = (wins / total * 100) if total > 0 else 0
        pt = float(sd.get("profit_total", 0) or 0) * 100
        mdd = float(sd.get("max_drawdown_account", 0) or 0) * 100
        sh = float(sd.get("sharpe", 0) or 0)
        so = float(sd.get("sortino", 0) or 0)

        return {
            "total_trades": tt,
            "win_rate": round(wr, 2),
            "profit_pct": round(pt, 4),
            "max_drawdown": round(mdd, 4),
            "sharpe_ratio": round(sh, 4),
            "sortino_ratio": round(so, 4),
        }

    def _slim_result(self, raw: dict, strategy: str) -> dict:
        """M2 FIX: Strip full trade list from result to avoid DB bloat.
        Keep only strategy-level summary (not per-trade data)."""
        br = raw.get("backtest_result", {})
        strat_data = br.get("strategy", br)
        sd = strat_data.get(strategy) or strat_data.get(next(iter(strat_data), ""), {})
        if not isinstance(sd, dict):
            return {"summary": "No strategy data found"}

        # Keep summary fields, drop trades/trade_list/pair_summary
        slim = {}
        skip_keys = {"trades", "trade_list", "trades_list", "pair_summary",
                      "left_open_trades", "rejected_signals", "exit_reason_summary"}
        for k, v in sd.items():
            if k not in skip_keys:
                slim[k] = v
        return {"strategy_summary": slim}

    # ── DB Helpers ───────────────────────────────────────────────────

    async def _update_step(self, job_id: int, step: str, progress: float,
                           matrix_completed: int | None = None):
        """Update job progress in DB. H1 FIX: Non-fatal — never kills the job."""
        values: dict = {"current_step": step, "progress": min(progress, 0.99)}
        if matrix_completed is not None:
            values["matrix_completed"] = matrix_completed

        try:
            async with async_session() as db:
                await db.execute(
                    update(TestJob).where(TestJob.id == job_id).values(**values)
                )
                await db.commit()
        except Exception as e:
            logger.warning("Failed to update job #%d step (non-fatal): %s", job_id, e)

    async def _complete_job(self, job_id: int, metrics: dict, raw_result: dict):
        """Mark job as completed with results."""
        async with async_session() as db:
            await db.execute(
                update(TestJob)
                .where(TestJob.id == job_id)
                .values(
                    status="completed",
                    progress=1.0,
                    current_step="Completed",
                    completed_at=datetime.now(timezone.utc),
                    total_trades=metrics.get("total_trades"),
                    profit_pct=metrics.get("profit_pct"),
                    win_rate=metrics.get("win_rate"),
                    max_drawdown=metrics.get("max_drawdown"),
                    sharpe_ratio=metrics.get("sharpe_ratio"),
                    sortino_ratio=metrics.get("sortino_ratio"),
                    raw_result=raw_result,
                )
            )
            await db.commit()

    async def _fail_job(self, job_id: int, error: str):
        """Mark job as failed."""
        try:
            async with async_session() as db:
                await db.execute(
                    update(TestJob)
                    .where(TestJob.id == job_id)
                    .values(
                        status="failed",
                        current_step="Failed",
                        completed_at=datetime.now(timezone.utc),
                        error_message=error[:2000],
                    )
                )
                await db.commit()
        except Exception as e:
            logger.error("Failed to mark job #%d as failed: %s", job_id, e)
        logger.error("Job #%d failed: %s", job_id, error)

    async def _is_cancelled(self, job_id: int) -> bool:
        """Check if job was cancelled by the user. H1 FIX: Non-fatal."""
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(TestJob.status).where(TestJob.id == job_id)
                )
                status = result.scalar_one_or_none()
                return status == "cancelled"
        except Exception:
            return False  # If we can't check, assume not cancelled

    async def _create_experiment_run(self, job: dict, metrics: dict,
                                      extra_raw: dict | None = None):
        """Create an ExperimentRun record for the completed test."""
        import json

        raw_output = None
        if extra_raw:
            raw_output = json.dumps(extra_raw)

        try:
            async with async_session() as db:
                run = ExperimentRun(
                    experiment_id=job["experiment_id"],
                    run_type=job["job_type"].replace("_matrix", ""),  # freqai_matrix → freqai
                    status="completed",
                    total_trades=metrics.get("total_trades"),
                    win_rate=metrics.get("win_rate"),
                    profit_pct=metrics.get("profit_pct"),
                    max_drawdown=metrics.get("max_drawdown"),
                    sharpe_ratio=metrics.get("sharpe_ratio"),
                    sortino_ratio=metrics.get("sortino_ratio"),
                    raw_output=raw_output,
                )
                db.add(run)
                await db.commit()
        except Exception as e:
            logger.warning("Failed to create experiment_run for job #%d: %s", job["id"], e)
