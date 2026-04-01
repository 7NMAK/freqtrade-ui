"""
Test Jobs API — submit, monitor, and cancel background test jobs.

Jobs are processed by the JobRunner background worker.
Frontend submits a job and polls for progress — closing the tab does NOT stop the job.
"""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..database import get_db
from ..models.test_job import TestJob

router = APIRouter()


# ── Pydantic Schemas ──────────────────────────────────────────

class SubmitJobRequest(BaseModel):
    """Submit a new test job."""
    experiment_id: int
    bot_id: int
    job_type: str  # "backtest" | "hyperopt" | "freqai_matrix"
    strategy: str
    config: dict | None = None
    matrix_total: int | None = None  # For freqai_matrix


class JobResponse(BaseModel):
    """Full job status response."""
    id: int
    experiment_id: int
    bot_id: int
    job_type: str
    strategy: str
    status: str
    progress: float
    current_step: str | None
    total_trades: int | None
    profit_pct: float | None
    win_rate: float | None
    max_drawdown: float | None
    sharpe_ratio: float | None
    sortino_ratio: float | None
    matrix_total: int | None
    matrix_completed: int | None
    matrix_results: list | None
    error_message: str | None
    created_at: str
    started_at: str | None
    completed_at: str | None

    model_config = ConfigDict(from_attributes=True)


class JobProgressResponse(BaseModel):
    """Lightweight progress-only response for frequent polling."""
    id: int
    status: str
    progress: float
    current_step: str | None
    matrix_completed: int | None
    matrix_total: int | None

    model_config = ConfigDict(from_attributes=True)


class SubmitJobResponse(BaseModel):
    """Response after submitting a job."""
    id: int
    status: str


# ── Helpers ───────────────────────────────────────────────────

def _serialize_datetime(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _job_to_response(job: TestJob) -> dict:
    return {
        "id": job.id,
        "experiment_id": job.experiment_id,
        "bot_id": job.bot_id,
        "job_type": job.job_type,
        "strategy": job.strategy,
        "status": job.status,
        "progress": float(job.progress or 0),
        "current_step": job.current_step,
        "total_trades": job.total_trades,
        "profit_pct": float(job.profit_pct) if job.profit_pct is not None else None,
        "win_rate": float(job.win_rate) if job.win_rate is not None else None,
        "max_drawdown": float(job.max_drawdown) if job.max_drawdown is not None else None,
        "sharpe_ratio": float(job.sharpe_ratio) if job.sharpe_ratio is not None else None,
        "sortino_ratio": float(job.sortino_ratio) if job.sortino_ratio is not None else None,
        "matrix_total": job.matrix_total,
        "matrix_completed": job.matrix_completed,
        "matrix_results": job.matrix_results,
        "error_message": job.error_message,
        "created_at": _serialize_datetime(job.created_at),
        "started_at": _serialize_datetime(job.started_at),
        "completed_at": _serialize_datetime(job.completed_at),
    }


# ── Routes ────────────────────────────────────────────────────

@router.post("", response_model=SubmitJobResponse)
async def submit_job(body: SubmitJobRequest, db: AsyncSession = Depends(get_db)):
    """
    Submit a new test job to the background queue.

    The job will be picked up by the JobRunner and executed server-side.
    Returns the job ID for progress tracking.
    """
    # Validate: no running jobs for same bot (FT only supports 1 backtest at a time)
    existing = await db.execute(
        select(func.count())
        .select_from(TestJob)
        .where(
            TestJob.bot_id == body.bot_id,
            TestJob.status.in_(["queued", "running"]),
        )
    )
    active_count = existing.scalar() or 0
    if active_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Bot #{body.bot_id} already has an active job. Wait for it to complete or cancel it.",
        )

    job = TestJob(
        experiment_id=body.experiment_id,
        bot_id=body.bot_id,
        job_type=body.job_type,
        strategy=body.strategy,
        config=body.config,
        status="queued",
        progress=0.0,
        matrix_total=body.matrix_total,
        matrix_completed=0 if body.matrix_total else None,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return SubmitJobResponse(id=job.id, status="queued")


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """Get full job status including results."""
    result = await db.execute(select(TestJob).where(TestJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job)


@router.get("/{job_id}/progress", response_model=JobProgressResponse)
async def get_job_progress(job_id: int, db: AsyncSession = Depends(get_db)):
    """Lightweight progress endpoint for frequent polling."""
    result = await db.execute(
        select(
            TestJob.id, TestJob.status, TestJob.progress,
            TestJob.current_step, TestJob.matrix_completed, TestJob.matrix_total,
        ).where(TestJob.id == job_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobProgressResponse(
        id=row[0], status=row[1], progress=float(row[2] or 0),
        current_step=row[3], matrix_completed=row[4], matrix_total=row[5],
    )


@router.delete("/{job_id}")
async def cancel_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """
    Cancel a running or queued job.

    If the job is currently running, the JobRunner will detect the cancellation
    on its next poll cycle and stop gracefully.
    """
    result = await db.execute(select(TestJob).where(TestJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in ("queued", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel job with status '{job.status}'")

    await db.execute(
        update(TestJob)
        .where(TestJob.id == job_id)
        .values(status="cancelled", current_step="Cancelled by user")
    )
    await db.commit()
    return {"detail": "Job cancelled"}


@router.get("")
async def list_jobs(
    experiment_id: int | None = Query(None),
    bot_id: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List jobs with optional filters."""
    q = select(TestJob).order_by(TestJob.created_at.desc()).limit(limit)

    if experiment_id is not None:
        q = q.where(TestJob.experiment_id == experiment_id)
    if bot_id is not None:
        q = q.where(TestJob.bot_id == bot_id)
    if status is not None:
        q = q.where(TestJob.status == status)

    result = await db.execute(q)
    jobs = result.scalars().all()
    return [_job_to_response(j) for j in jobs]
