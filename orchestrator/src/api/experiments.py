"""
Experiments API routes.

Experiments group related runs (backtest, hyperopt, AI analyses) under one parent.
Each experiment = one strategy + pair + timerange combination.
Runs within an experiment are hierarchical: baseline backtest → hyperopt children → validation children.
"""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..database import get_db
from ..models.experiment import Experiment
from ..models.experiment_run import ExperimentRun
from ..models.strategy import Strategy
from ..activity_logger import log_activity

router = APIRouter()


# ── Pydantic Schemas ──────────────────────────────────────────

class ExperimentRunResponse(BaseModel):
    """Single run within an experiment."""
    id: int
    experiment_id: int
    parent_run_id: int | None
    run_type: str
    status: str
    backtest_result_id: int | None
    strategy_version_id: int | None
    ai_analysis_id: int | None
    sampler: str | None
    loss_function: str | None
    epochs: int | None
    spaces: list[str] | None
    hyperopt_duration_seconds: int | None
    total_trades: int | None
    win_rate: float | None
    profit_abs: float | None
    profit_pct: float | None
    max_drawdown: float | None
    sharpe_ratio: float | None
    sortino_ratio: float | None
    calmar_ratio: float | None
    avg_duration: str | None
    raw_output: str | None
    error_message: str | None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class ExperimentResponse(BaseModel):
    """Single experiment with metadata."""
    id: int
    strategy_id: int
    strategy_name: str | None = None
    name: str
    pair: str
    timeframe: str
    timerange_start: str | None
    timerange_end: str | None
    baseline_backtest_id: int | None
    best_version_id: int | None
    notes: str | None
    run_count: int = 0
    created_at: str
    # Enriched fields — aggregated from best completed run
    best_profit_pct: float | None = None
    best_win_rate: float | None = None
    best_max_drawdown: float | None = None
    best_sharpe: float | None = None
    last_run_type: str | None = None
    last_run_date: str | None = None
    completed_run_types: list[str] = []

    model_config = ConfigDict(from_attributes=True)


class ExperimentDetailResponse(ExperimentResponse):
    """Experiment with all its runs."""
    runs: list[ExperimentRunResponse] = []


class ExperimentListResponse(BaseModel):
    """Paginated list of experiments."""
    total: int
    items: list[ExperimentResponse]


# ── Helpers ──────────────────────────────────────────

def _decimal_to_float(val: Any) -> float | None:
    if val is None:
        return None
    return float(val)


def _format_run(run: ExperimentRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "experiment_id": run.experiment_id,
        "parent_run_id": run.parent_run_id,
        "run_type": run.run_type,
        "status": run.status,
        "backtest_result_id": run.backtest_result_id,
        "strategy_version_id": run.strategy_version_id,
        "ai_analysis_id": run.ai_analysis_id,
        "sampler": run.sampler,
        "loss_function": run.loss_function,
        "epochs": run.epochs,
        "spaces": run.spaces,
        "hyperopt_duration_seconds": run.hyperopt_duration_seconds,
        "total_trades": run.total_trades,
        "win_rate": _decimal_to_float(run.win_rate),
        "profit_abs": _decimal_to_float(run.profit_abs),
        "profit_pct": _decimal_to_float(run.profit_pct),
        "max_drawdown": _decimal_to_float(run.max_drawdown),
        "sharpe_ratio": _decimal_to_float(run.sharpe_ratio),
        "sortino_ratio": _decimal_to_float(run.sortino_ratio),
        "calmar_ratio": _decimal_to_float(run.calmar_ratio),
        "avg_duration": run.avg_duration,
        "raw_output": run.raw_output,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


async def _format_experiment(db: AsyncSession, exp: Experiment, include_runs: bool = False) -> dict[str, Any]:
    """Format experiment for response, optionally including runs."""
    # Get strategy name
    strategy_name = None
    if exp.strategy_id:
        result = await db.execute(select(Strategy.name).where(Strategy.id == exp.strategy_id))
        strategy_name = result.scalar_one_or_none()

    # Count runs
    count_result = await db.execute(
        select(func.count(ExperimentRun.id)).where(
            ExperimentRun.experiment_id == exp.id,
            ExperimentRun.is_deleted == False,  # noqa: E712
        )
    )
    run_count = count_result.scalar() or 0

    data = {
        "id": exp.id,
        "strategy_id": exp.strategy_id,
        "strategy_name": strategy_name,
        "name": exp.name,
        "pair": exp.pair,
        "timeframe": exp.timeframe,
        "timerange_start": exp.timerange_start.isoformat() if exp.timerange_start else None,
        "timerange_end": exp.timerange_end.isoformat() if exp.timerange_end else None,
        "baseline_backtest_id": exp.baseline_backtest_id,
        "best_version_id": exp.best_version_id,
        "notes": exp.notes,
        "run_count": run_count,
        "created_at": exp.created_at.isoformat() if exp.created_at else None,
    }

    if include_runs:
        runs_result = await db.execute(
            select(ExperimentRun).where(
                ExperimentRun.experiment_id == exp.id,
                ExperimentRun.is_deleted == False,  # noqa: E712
            ).order_by(ExperimentRun.created_at.desc())
        )
        runs = runs_result.scalars().all()
        data["runs"] = [_format_run(r) for r in runs]

    return data


# ── Create / Seed Schemas ────────────────────────────

class ExperimentCreate(BaseModel):
    """Create a new experiment."""
    strategy_id: int
    name: str | None = None
    pair: str = "BTC/USDT:USDT"
    timeframe: str = "1h"
    timerange_start: str | None = None
    timerange_end: str | None = None
    notes: str | None = None


# ── Routes ──────────────────────────────────────────

@router.post("/", status_code=201)
async def create_experiment(
    body: ExperimentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> ExperimentResponse:
    """Create a new experiment for a strategy."""
    # Verify strategy exists
    strat_result = await db.execute(select(Strategy).where(Strategy.id == body.strategy_id))
    strategy = strat_result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, f"Strategy {body.strategy_id} not found")

    # Auto-generate name if not provided
    name = body.name or f"{strategy.name} — {body.pair} experiment"

    exp = Experiment(
        strategy_id=body.strategy_id,
        name=name,
        pair=body.pair,
        timeframe=body.timeframe,
        timerange_start=datetime.strptime(body.timerange_start, "%Y-%m-%d").date() if body.timerange_start else None,
        timerange_end=datetime.strptime(body.timerange_end, "%Y-%m-%d").date() if body.timerange_end else None,
        notes=body.notes,
    )
    db.add(exp)
    await db.flush()

    await log_activity(
        db,
        action="experiment.create",
        level="info",
        actor=current_user.get("username", "unknown"),
        target_type="experiment",
        target_id=exp.id,
        target_name=exp.name,
        details=f"Created experiment for {strategy.name}",
    )

    await db.commit()
    data = await _format_experiment(db, exp)
    return ExperimentResponse(**data)


@router.post("/seed", status_code=201)
async def seed_experiments(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> dict:
    """
    Auto-create one experiment per strategy that doesn't already have one.
    Returns count of created experiments.
    """
    # Get all strategies
    strats_result = await db.execute(select(Strategy))
    strategies = strats_result.scalars().all()

    # Get existing experiment strategy_ids
    existing_result = await db.execute(
        select(Experiment.strategy_id).where(Experiment.is_deleted == False)  # noqa: E712
    )
    existing_ids = {row[0] for row in existing_result.all()}

    created = 0
    for strat in strategies:
        if strat.id in existing_ids:
            continue

        exp = Experiment(
            strategy_id=strat.id,
            name=f"{strat.name} — BTC/USDT:USDT experiment",
            pair="BTC/USDT:USDT",
            timeframe="1h",
        )
        db.add(exp)
        created += 1

    if created > 0:
        await db.flush()
        await log_activity(
            db,
            action="experiment.seed",
            level="info",
            actor=current_user.get("username", "unknown"),
            target_type="experiment",
            target_id=0,
            target_name="bulk_seed",
            details=f"Seeded {created} experiments from {len(strategies)} strategies",
        )
        await db.commit()

    return {"created": created, "total_strategies": len(strategies), "already_existed": len(existing_ids)}


@router.get("/")
async def list_experiments(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    strategy_id: int | None = Query(None),
    pair: str | None = Query(None),
    current_user: dict = Depends(require_auth),
) -> ExperimentListResponse:
    """List all experiments (paginated, filterable)."""
    base_filter = [Experiment.is_deleted == False]  # noqa: E712
    if strategy_id:
        base_filter.append(Experiment.strategy_id == strategy_id)
    if pair:
        base_filter.append(Experiment.pair == pair)

    # Count total
    total = (await db.execute(
        select(func.count(Experiment.id)).where(*base_filter)
    )).scalar() or 0

    # Fetch experiments
    result = await db.execute(
        select(Experiment)
        .where(*base_filter)
        .order_by(Experiment.created_at.desc())
        .offset(skip).limit(limit)
    )
    experiments = result.scalars().all()

    if not experiments:
        return ExperimentListResponse(total=total, items=[])

    # Batch-load strategy names (1 query instead of N)
    strategy_ids = list({exp.strategy_id for exp in experiments})
    strat_result = await db.execute(
        select(Strategy.id, Strategy.name).where(Strategy.id.in_(strategy_ids))
    )
    strategy_names: dict[int, str] = {row[0]: row[1] for row in strat_result.all()}

    # Batch-load run counts (1 query instead of N)
    exp_ids = [exp.id for exp in experiments]
    count_result = await db.execute(
        select(ExperimentRun.experiment_id, func.count(ExperimentRun.id))
        .where(
            ExperimentRun.experiment_id.in_(exp_ids),
            ExperimentRun.is_deleted == False,  # noqa: E712
        )
        .group_by(ExperimentRun.experiment_id)
    )
    run_counts: dict[int, int] = {row[0]: row[1] for row in count_result.all()}

    # Batch-load best run metrics per experiment (1 query)
    # Use a window function to get ALL metrics from the single best run (by profit_pct)
    # This ensures profit, win_rate, drawdown, sharpe are from the SAME run

    # Subquery: rank runs per experiment by profit_pct DESC
    best_run_sub = (
        select(
            ExperimentRun.experiment_id,
            ExperimentRun.profit_pct,
            ExperimentRun.win_rate,
            ExperimentRun.max_drawdown,
            ExperimentRun.sharpe_ratio,
            func.row_number().over(
                partition_by=ExperimentRun.experiment_id,
                order_by=ExperimentRun.profit_pct.desc().nullslast(),
            ).label("rn"),
        )
        .where(
            ExperimentRun.experiment_id.in_(exp_ids),
            ExperimentRun.status == "completed",
            ExperimentRun.is_deleted == False,  # noqa: E712
        )
        .subquery()
    )

    best_runs_result = await db.execute(
        select(
            best_run_sub.c.experiment_id,
            best_run_sub.c.profit_pct,
            best_run_sub.c.win_rate,
            best_run_sub.c.max_drawdown,
            best_run_sub.c.sharpe_ratio,
        ).where(best_run_sub.c.rn == 1)
    )
    best_metrics: dict[int, dict] = {}
    for row in best_runs_result.all():
        best_metrics[row[0]] = {
            "best_profit_pct": float(row[1]) if row[1] is not None else None,
            "best_win_rate": float(row[2]) if row[2] is not None else None,
            "best_max_drawdown": float(row[3]) if row[3] is not None else None,
            "best_sharpe": float(row[4]) if row[4] is not None else None,
        }

    # Batch-load last run info + completed run types per experiment (1 query)
    last_run_result = await db.execute(
        select(
            ExperimentRun.experiment_id,
            ExperimentRun.run_type,
            func.max(ExperimentRun.created_at).label("last_date"),
        )
        .where(
            ExperimentRun.experiment_id.in_(exp_ids),
            ExperimentRun.status == "completed",
            ExperimentRun.is_deleted == False,  # noqa: E712
        )
        .group_by(ExperimentRun.experiment_id, ExperimentRun.run_type)
    )
    last_runs: dict[int, dict] = {}  # {exp_id: {"last_run_type": ..., "last_run_date": ..., "types": [...]}}
    for row in last_run_result.all():
        eid = row[0]
        if eid not in last_runs:
            last_runs[eid] = {"last_run_type": None, "last_run_date": None, "types": []}
        last_runs[eid]["types"].append(row[1])
        run_date = row[2]
        if run_date and (last_runs[eid]["last_run_date"] is None or run_date > last_runs[eid]["last_run_date"]):
            last_runs[eid]["last_run_date"] = run_date
            last_runs[eid]["last_run_type"] = row[1]

    # Build response using batch data (0 additional queries)
    items = []
    for exp in experiments:
        eid = exp.id
        metrics = best_metrics.get(eid, {})
        lr = last_runs.get(eid, {})
        items.append(ExperimentResponse(
            id=exp.id,
            strategy_id=exp.strategy_id,
            strategy_name=strategy_names.get(exp.strategy_id),
            name=exp.name,
            pair=exp.pair,
            timeframe=exp.timeframe,
            timerange_start=exp.timerange_start.isoformat() if exp.timerange_start else None,
            timerange_end=exp.timerange_end.isoformat() if exp.timerange_end else None,
            baseline_backtest_id=exp.baseline_backtest_id,
            best_version_id=exp.best_version_id,
            notes=exp.notes,
            run_count=run_counts.get(eid, 0),
            created_at=exp.created_at.isoformat() if exp.created_at else None,
            best_profit_pct=metrics.get("best_profit_pct"),
            best_win_rate=metrics.get("best_win_rate"),
            best_max_drawdown=metrics.get("best_max_drawdown"),
            best_sharpe=metrics.get("best_sharpe"),
            last_run_type=lr.get("last_run_type"),
            last_run_date=lr.get("last_run_date").isoformat() if lr.get("last_run_date") else None,
            completed_run_types=sorted(lr.get("types", [])),
        ))

    return ExperimentListResponse(total=total, items=items)


# ── IMPORTANT: Fixed-path routes MUST come BEFORE dynamic /{id} routes ──
# Otherwise FastAPI will match "/runs/123" as experiment_id="runs"

@router.delete("/runs/{run_id}", status_code=204)
async def delete_experiment_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> None:
    """Soft-delete a single experiment run."""
    result = await db.execute(
        select(ExperimentRun).where(
            ExperimentRun.id == run_id,
            ExperimentRun.is_deleted == False,  # noqa: E712
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Experiment run not found")

    run.is_deleted = True

    await log_activity(
        db,
        action="experiment_run.delete",
        level="info",
        actor=current_user.get("username", "unknown"),
        target_type="experiment_run",
        target_id=run.id,
        target_name=f"{run.run_type} run #{run.id}",
        details=f"Soft-deleted {run.run_type} run from experiment {run.experiment_id}",
    )

    await db.commit()


# ── Dynamic-path routes (after all fixed paths) ──

@router.get("/{experiment_id}")
async def get_experiment(
    experiment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> ExperimentDetailResponse:
    """Get a single experiment with all its runs."""
    result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.is_deleted == False,  # noqa: E712
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Experiment not found")

    data = await _format_experiment(db, exp, include_runs=True)
    return ExperimentDetailResponse(**data)


@router.delete("/{experiment_id}", status_code=204)
async def delete_experiment(
    experiment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> None:
    """Soft-delete an experiment and all its runs."""
    result = await db.execute(
        select(Experiment).where(
            Experiment.id == experiment_id,
            Experiment.is_deleted == False,  # noqa: E712
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Experiment not found")

    exp.is_deleted = True

    # Soft-delete all runs
    runs_result = await db.execute(
        select(ExperimentRun).where(ExperimentRun.experiment_id == experiment_id)
    )
    for run in runs_result.scalars().all():
        run.is_deleted = True

    await log_activity(
        db,
        action="experiment.delete",
        level="info",
        actor=current_user.get("username", "unknown"),
        target_type="experiment",
        target_id=exp.id,
        target_name=exp.name,
        details="Soft-deleted experiment and all runs",
    )

    await db.commit()


@router.get("/{experiment_id}/runs")
async def list_experiment_runs(
    experiment_id: int,
    db: AsyncSession = Depends(get_db),
    run_type: str | None = Query(None),
    status: str | None = Query(None),
    current_user: dict = Depends(require_auth),
) -> list[ExperimentRunResponse]:
    """List runs for an experiment (filterable by type and status)."""
    query = select(ExperimentRun).where(
        ExperimentRun.experiment_id == experiment_id,
        ExperimentRun.is_deleted == False,  # noqa: E712
    )
    if run_type:
        query = query.where(ExperimentRun.run_type == run_type)
    if status:
        query = query.where(ExperimentRun.status == status)

    query = query.order_by(ExperimentRun.created_at.desc())
    result = await db.execute(query)
    runs = result.scalars().all()

    return [ExperimentRunResponse(**_format_run(r)) for r in runs]



# ── Strategy Version Activation (unique to experiments — not in strategies router) ──

@router.post("/strategies/{strategy_id}/versions/{version_id}/activate")
async def activate_strategy_version(
    strategy_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> dict:
    """
    Activate a specific strategy version.

    Reads version params from DB and writes StrategyName.json to the FT container.
    Updates strategies.current_version_id.
    """
    from ..models.strategy_version import StrategyVersion
    import docker
    import json as _json

    # Get the strategy
    strat_result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = strat_result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    # Get the version
    ver_result = await db.execute(
        select(StrategyVersion).where(
            StrategyVersion.id == version_id,
            StrategyVersion.strategy_id == strategy_id,
        )
    )
    version = ver_result.scalar_one_or_none()
    if not version:
        raise HTTPException(404, "Strategy version not found")

    # Write the .json file to FT container
    # The risk_config field stores the hyperopt params (ROI, stoploss, trailing, buy/sell)
    if version.risk_config:
        try:
            import tarfile
            import io

            # Find the bot container for this strategy
            # BotInstance has strategy_name (not strategy_id), so match by name
            from ..models.bot_instance import BotInstance
            bot_result = await db.execute(
                select(BotInstance).where(BotInstance.strategy_name == strategy.name).limit(1)
            )
            bot = bot_result.scalar_one_or_none()
            if not bot:
                raise HTTPException(400, f"No bot found for strategy '{strategy.name}'")

            container_name = bot.container_id or bot.name
            dk = docker.from_env()
            container = dk.containers.get(container_name)

            # Build the JSON content
            json_content = _json.dumps(version.risk_config, indent=4).encode("utf-8")
            strategy_name = strategy.name

            # Write via tarball
            tar_stream = io.BytesIO()
            with tarfile.open(fileobj=tar_stream, mode="w") as tar:
                info = tarfile.TarInfo(name=f"{strategy_name}.json")
                info.size = len(json_content)
                tar.addfile(info, io.BytesIO(json_content))
            tar_stream.seek(0)
            container.put_archive("/freqtrade/user_data/strategies", tar_stream)

        except docker.errors.NotFound:
            raise HTTPException(502, f"Container {container_name} not found")
        except Exception as e:
            raise HTTPException(502, f"Failed to write strategy params: {e}")

    # Update current version
    strategy.current_version_id = version_id
    await db.flush()

    await log_activity(
        db,
        action="strategy_version.activate",
        level="info",
        actor=current_user.get("username", "unknown"),
        target_type="strategy_version",
        target_id=version.id,
        target_name=f"{strategy.name} v{version.version_number}",
        details=f"Activated version {version.version_number} for {strategy.name}",
    )

    await db.commit()

    return {
        "message": f"Activated version {version.version_number} for {strategy.name}",
        "version_id": version.id,
        "version_number": version.version_number,
    }
