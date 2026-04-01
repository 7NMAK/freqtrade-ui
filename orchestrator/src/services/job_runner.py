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
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

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

    async def _pick_next_job(self) -> dict | None:
        """Get the oldest queued job from DB."""
        async with async_session() as db:
            result = await db.execute(
                select(TestJob)
                .where(TestJob.status == "queued")
                .order_by(TestJob.created_at.asc())
                .limit(1)
            )
            job = result.scalar_one_or_none()
            if not job:
                return None

            # Mark as running
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
                await self._run_backtest(job, client)  # Same FT endpoint, different config
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

    # ── Single Backtest/Hyperopt ─────────────────────────────────────

    async def _run_backtest(self, job: dict, client: FTClient):
        """Run a single backtest or hyperopt against FT."""
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

        # Save results
        await self._complete_job(job["id"], metrics, result)

        # Create experiment_run
        await self._create_experiment_run(job, metrics, result)

        logger.info("Job #%d completed: %d trades, %.2f%% profit",
                     job["id"], metrics.get("total_trades", 0), metrics.get("profit_pct", 0))

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
                run_job = {**job, "config": bt_config}
                await self._create_experiment_run(run_job, metrics, result, extra_raw={
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

        async with async_session() as db:
            await db.execute(
                update(TestJob)
                .where(TestJob.id == job["id"])
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

        logger.info("Job #%d matrix complete: %d/%d succeeded", job["id"], len(completed), total)

    # ── FT Polling ───────────────────────────────────────────────────

    async def _poll_ft(self, job_id: int, client: FTClient,
                       step_prefix: str = "", max_polls: int = 600) -> dict | None:
        """Poll FT backtest status until done. Returns result dict or None if cancelled."""
        for _ in range(max_polls):
            if await self._is_cancelled(job_id):
                return None

            await asyncio.sleep(3)

            try:
                raw = await client.backtest_status()
            except FTClientError as e:
                logger.warning("Job #%d poll error: %s", job_id, e)
                continue

            running = raw.get("running", True)
            step = raw.get("step", "")
            progress = raw.get("progress", 0)

            if step:
                pct = (progress or 0) * 100
                display = f"{step_prefix} — {step} ({pct:.0f}%)" if step_prefix else f"{step} ({pct:.0f}%)"
                # Don't update DB on every poll — only every ~5 polls (15s)
                await self._update_step(job_id, display, progress or 0)

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

    # ── DB Helpers ───────────────────────────────────────────────────

    async def _update_step(self, job_id: int, step: str, progress: float,
                           matrix_completed: int | None = None):
        """Update job progress in DB."""
        values: dict = {"current_step": step, "progress": min(progress, 0.99)}
        if matrix_completed is not None:
            values["matrix_completed"] = matrix_completed

        async with async_session() as db:
            await db.execute(
                update(TestJob).where(TestJob.id == job_id).values(**values)
            )
            await db.commit()

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
        logger.error("Job #%d failed: %s", job_id, error)

    async def _is_cancelled(self, job_id: int) -> bool:
        """Check if job was cancelled by the user."""
        async with async_session() as db:
            result = await db.execute(
                select(TestJob.status).where(TestJob.id == job_id)
            )
            status = result.scalar_one_or_none()
            return status == "cancelled"

    async def _create_experiment_run(self, job: dict, metrics: dict,
                                      raw_result: dict, extra_raw: dict | None = None):
        """Create an ExperimentRun record for the completed test."""
        import json

        raw_output = None
        if extra_raw:
            raw_output = json.dumps(extra_raw)

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
