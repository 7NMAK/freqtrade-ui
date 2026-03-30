"""
Backtest Results API routes.

Stores and retrieves results from strategy version backtests.
Each result is linked to a specific StrategyVersion and is immutable.
Results can be compared to help select the best-performing version.

Results come from FreqTrade's backtest output and are stored for analysis/history.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..database import get_db
from ..models.backtest_result import BacktestResult
from ..models.strategy_version import StrategyVersion
from ..activity_logger import log_activity

router = APIRouter()


# ── Pydantic Schemas ──────────────────────────────────────────

class BacktestResultCreate(BaseModel):
    """Request body for storing a new backtest result."""
    strategy_version_id: int
    exchange_data: str = Field(..., min_length=1, max_length=50)
    pairs: list[str] = Field(..., min_items=1)
    timeframe: str = Field(..., min_length=2, max_length=10)
    timerange_start: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    timerange_end: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    # Results from FT backtest (optional until provided)
    total_trades: int | None = None
    winning_trades: int | None = None
    losing_trades: int | None = None
    profit_total: float | None = None
    profit_percent: float | None = None
    max_drawdown: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    sqn: float | None = None
    full_results: dict | None = None


class BacktestResultUpdate(BaseModel):
    """Request body for updating backtest results (after FT backtest completes)."""
    total_trades: int | None = None
    winning_trades: int | None = None
    losing_trades: int | None = None
    profit_total: float | None = None
    profit_percent: float | None = None
    max_drawdown: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    sqn: float | None = None
    full_results: dict | None = None


class BacktestResultResponse(BaseModel):
    """Response for a single backtest result."""
    id: int
    strategy_version_id: int
    exchange_data: str
    pairs: list[str]
    timeframe: str
    timerange_start: str
    timerange_end: str
    total_trades: int | None
    winning_trades: int | None
    losing_trades: int | None
    profit_total: float | None
    profit_percent: float | None
    max_drawdown: float | None
    sharpe_ratio: float | None
    sortino_ratio: float | None
    sqn: float | None
    full_results: dict | None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class BacktestResultListResponse(BaseModel):
    """Response for listing backtest results."""
    total: int
    items: list[BacktestResultResponse]


class BacktestComparisonResult(BaseModel):
    """Single result in a comparison."""
    id: int
    version_id: int
    version_number: int | None
    total_trades: int | None
    winning_trades: int | None
    losing_trades: int | None
    profit_percent: float | None
    max_drawdown: float | None
    sharpe_ratio: float | None
    sortino_ratio: float | None
    sqn: float | None
    created_at: str


class BacktestComparisonResponse(BaseModel):
    """Comparison of multiple backtest results."""
    results: list[BacktestComparisonResult]
    best_profit: int | None  # Result ID with highest profit
    best_drawdown: int | None  # Result ID with lowest max drawdown
    best_sharpe: int | None  # Result ID with highest Sharpe


# ── Helper Functions ──────────────────────────────────────────

async def _get_result_or_404(
    db: AsyncSession,
    result_id: int,
) -> BacktestResult:
    """Helper to fetch a backtest result by ID or raise 404."""
    result = await db.execute(
        select(BacktestResult).where(
            BacktestResult.id == result_id,
            BacktestResult.is_deleted == False,  # noqa: E712
        )
    )
    backtest = result.scalar_one_or_none()
    if not backtest:
        raise HTTPException(status_code=404, detail="Backtest result not found")
    return backtest


async def _get_version_or_404(
    db: AsyncSession,
    version_id: int,
) -> StrategyVersion:
    """Helper to fetch a strategy version by ID or raise 404."""
    result = await db.execute(
        select(StrategyVersion).where(StrategyVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Strategy version not found")
    return version


def _format_result_response(result: BacktestResult) -> dict[str, Any]:
    """Convert BacktestResult model to response DTO."""
    return {
        "id": result.id,
        "strategy_version_id": result.strategy_version_id,
        "exchange_data": result.exchange_data,
        "pairs": result.pairs,
        "timeframe": result.timeframe,
        "timerange_start": result.timerange_start.isoformat() if isinstance(result.timerange_start, date) else result.timerange_start,
        "timerange_end": result.timerange_end.isoformat() if isinstance(result.timerange_end, date) else result.timerange_end,
        "total_trades": result.total_trades,
        "winning_trades": result.winning_trades,
        "losing_trades": result.losing_trades,
        "profit_total": float(result.profit_total) if result.profit_total is not None else None,
        "profit_percent": float(result.profit_percent) if result.profit_percent is not None else None,
        "max_drawdown": float(result.max_drawdown) if result.max_drawdown is not None else None,
        "sharpe_ratio": float(result.sharpe_ratio) if result.sharpe_ratio is not None else None,
        "sortino_ratio": float(result.sortino_ratio) if result.sortino_ratio is not None else None,
        "sqn": float(result.sqn) if result.sqn is not None else None,
        "full_results": result.full_results,
        "created_at": result.created_at.isoformat() if result.created_at else None,
    }


# ── Routes (IMPORTANT: fixed-path routes BEFORE dynamic-path routes) ────────

@router.get("/", response_model=BacktestResultListResponse)
async def list_backtest_results(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    strategy_id: int | None = Query(None),
    version_id: int | None = Query(None),
    exchange: str | None = Query(None),
    current_user: dict = Depends(require_auth),
) -> BacktestResultListResponse:
    """
    List all backtest results (paginated).

    Optionally filter by:
    - strategy_id: all versions of a strategy
    - version_id: specific version
    - exchange: specific exchange data source
    """
    query = select(BacktestResult).where(BacktestResult.is_deleted == False)  # noqa: E712

    if version_id:
        query = query.where(BacktestResult.strategy_version_id == version_id)
    elif strategy_id:
        # Join with StrategyVersion to filter by strategy
        query = (
            select(BacktestResult)
            .join(StrategyVersion)
            .where(
                StrategyVersion.strategy_id == strategy_id,
                BacktestResult.is_deleted == False,  # noqa: E712
            )
        )

    if exchange:
        query = query.where(BacktestResult.exchange_data == exchange)

    # Count total (apply the same filters as the main query)
    count_query = select(func.count(BacktestResult.id)).where(
        BacktestResult.is_deleted == False,  # noqa: E712
    )
    if version_id:
        count_query = count_query.where(BacktestResult.strategy_version_id == version_id)
    elif strategy_id:
        count_query = count_query.join(StrategyVersion).where(
            StrategyVersion.strategy_id == strategy_id,
        )
    if exchange:
        count_query = count_query.where(BacktestResult.exchange_data == exchange)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Fetch paginated results
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    backtests = result.scalars().all()

    items = [
        BacktestResultResponse(**_format_result_response(b))
        for b in backtests
    ]

    return BacktestResultListResponse(total=total, items=items)


@router.post("/", response_model=BacktestResultResponse, status_code=201)
async def create_backtest_result(
    req: BacktestResultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> BacktestResultResponse:
    """
    Create a new backtest result record.

    Links to a specific StrategyVersion and stores backtest parameters.
    Results are immutable — create a new record for each backtest run.
    """
    # Verify version exists
    await _get_version_or_404(db, req.strategy_version_id)

    # Parse dates
    try:
        start_date = datetime.strptime(req.timerange_start, "%Y-%m-%d").date()
        end_date = datetime.strptime(req.timerange_end, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD",
        )

    # Create backtest result
    backtest = BacktestResult(
        strategy_version_id=req.strategy_version_id,
        exchange_data=req.exchange_data,
        pairs=req.pairs,
        timeframe=req.timeframe,
        timerange_start=start_date,
        timerange_end=end_date,
        total_trades=req.total_trades,
        winning_trades=req.winning_trades,
        losing_trades=req.losing_trades,
        profit_total=Decimal(str(req.profit_total)) if req.profit_total is not None else None,
        profit_percent=Decimal(str(req.profit_percent)) if req.profit_percent is not None else None,
        max_drawdown=Decimal(str(req.max_drawdown)) if req.max_drawdown is not None else None,
        sharpe_ratio=Decimal(str(req.sharpe_ratio)) if req.sharpe_ratio is not None else None,
        sortino_ratio=Decimal(str(req.sortino_ratio)) if req.sortino_ratio is not None else None,
        sqn=Decimal(str(req.sqn)) if req.sqn is not None else None,
        full_results=req.full_results,
    )

    db.add(backtest)
    await db.flush()

    # Audit log
    await log_activity(
        db,
        action="backtest_result.create",
        level="info",
        actor=current_user.get("username", "unknown"),
        target_type="backtest_result",
        target_id=backtest.id,
        target_name=f"Backtest v{req.strategy_version_id}",
        details=f"Created backtest result: {len(req.pairs)} pairs, {req.timeframe} on {req.exchange_data}",
    )

    return BacktestResultResponse(**_format_result_response(backtest))


# Fixed paths come BEFORE dynamic paths
@router.get("/compare", response_model=BacktestComparisonResponse)
async def compare_backtest_results(
    ids: str = Query(..., description="Comma-separated result IDs (e.g., 1,2,3)"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> BacktestComparisonResponse:
    """
    Compare multiple backtest results side-by-side.

    Query param: ?ids=1,2,3
    Returns: results + identifiers for best performers (profit, drawdown, sharpe).
    """
    try:
        result_ids = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="ids must be comma-separated integers (e.g., 1,2,3)",
        )

    if not result_ids:
        raise HTTPException(status_code=400, detail="At least one result ID required")

    # Fetch all results
    query = select(BacktestResult).where(
        BacktestResult.id.in_(result_ids),
        BacktestResult.is_deleted == False,  # noqa: E712
    )
    result = await db.execute(query)
    backtests = result.scalars().all()

    if not backtests:
        raise HTTPException(status_code=404, detail="No backtest results found")

    # Fetch version numbers for each
    version_map = {}
    for backtest in backtests:
        if backtest.strategy_version_id not in version_map:
            version_result = await db.execute(
                select(StrategyVersion).where(StrategyVersion.id == backtest.strategy_version_id)
            )
            version = version_result.scalar_one_or_none()
            version_map[backtest.strategy_version_id] = version.version_number if version else None

    # Build comparison results
    comparison_results = []
    best_profit_id = None
    best_drawdown_id = None
    best_sharpe_id = None
    best_profit = None
    best_drawdown = None
    best_sharpe = None

    for backtest in backtests:
        comp = BacktestComparisonResult(
            id=backtest.id,
            version_id=backtest.strategy_version_id,
            version_number=version_map.get(backtest.strategy_version_id),
            total_trades=backtest.total_trades,
            winning_trades=backtest.winning_trades,
            losing_trades=backtest.losing_trades,
            profit_percent=float(backtest.profit_percent) if backtest.profit_percent else None,
            max_drawdown=float(backtest.max_drawdown) if backtest.max_drawdown else None,
            sharpe_ratio=float(backtest.sharpe_ratio) if backtest.sharpe_ratio else None,
            sortino_ratio=float(backtest.sortino_ratio) if backtest.sortino_ratio else None,
            sqn=float(backtest.sqn) if backtest.sqn else None,
            created_at=backtest.created_at.isoformat() if backtest.created_at else None,
        )
        comparison_results.append(comp)

        # Track best performers
        if backtest.profit_percent is not None:
            if best_profit is None or backtest.profit_percent > best_profit:
                best_profit = backtest.profit_percent
                best_profit_id = backtest.id

        if backtest.max_drawdown is not None:
            if best_drawdown is None or backtest.max_drawdown < best_drawdown:
                best_drawdown = backtest.max_drawdown
                best_drawdown_id = backtest.id

        if backtest.sharpe_ratio is not None:
            if best_sharpe is None or backtest.sharpe_ratio > best_sharpe:
                best_sharpe = backtest.sharpe_ratio
                best_sharpe_id = backtest.id

    return BacktestComparisonResponse(
        results=comparison_results,
        best_profit=best_profit_id,
        best_drawdown=best_drawdown_id,
        best_sharpe=best_sharpe_id,
    )


@router.get("/by-strategy/{strategy_id}", response_model=BacktestResultListResponse)
async def get_results_by_strategy(
    strategy_id: int,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(require_auth),
) -> BacktestResultListResponse:
    """
    Get all backtest results for a strategy (across all versions).

    Useful for comparing performance across versions of the same strategy.
    """
    # Join BacktestResult -> StrategyVersion -> strategy_id
    query = (
        select(BacktestResult)
        .join(StrategyVersion)
        .where(
            StrategyVersion.strategy_id == strategy_id,
            BacktestResult.is_deleted == False,  # noqa: E712
        )
    )

    # Count total (must match main query: join + both where clauses)
    count_result = await db.execute(
        select(func.count(BacktestResult.id))
        .join(StrategyVersion)
        .where(
            StrategyVersion.strategy_id == strategy_id,
            BacktestResult.is_deleted == False,  # noqa: E712
        )
    )
    total = count_result.scalar() or 0

    # Fetch paginated results
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    backtests = result.scalars().all()

    items = [
        BacktestResultResponse(**_format_result_response(b))
        for b in backtests
    ]

    return BacktestResultListResponse(total=total, items=items)


@router.get("/by-version/{version_id}", response_model=BacktestResultListResponse)
async def get_results_by_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(require_auth),
) -> BacktestResultListResponse:
    """
    Get all backtest results for a specific strategy version.

    A single version may have multiple results if backtested with different params.
    """
    # Verify version exists
    await _get_version_or_404(db, version_id)

    query = select(BacktestResult).where(
        BacktestResult.strategy_version_id == version_id,
        BacktestResult.is_deleted == False,  # noqa: E712
    )

    # Count total
    count_result = await db.execute(
        select(func.count(BacktestResult.id)).where(
            BacktestResult.strategy_version_id == version_id,
            BacktestResult.is_deleted == False,  # noqa: E712
        )
    )
    total = count_result.scalar() or 0

    # Fetch paginated results
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    backtests = result.scalars().all()

    items = [
        BacktestResultResponse(**_format_result_response(b))
        for b in backtests
    ]

    return BacktestResultListResponse(total=total, items=items)


# Dynamic paths AFTER fixed paths
@router.get("/{result_id}", response_model=BacktestResultResponse)
async def get_backtest_result(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> BacktestResultResponse:
    """Get a single backtest result by ID."""
    backtest = await _get_result_or_404(db, result_id)
    return BacktestResultResponse(**_format_result_response(backtest))


@router.patch("/{result_id}", response_model=BacktestResultResponse)
async def update_backtest_result(
    result_id: int,
    req: BacktestResultUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> BacktestResultResponse:
    """
    Update backtest results after FT completes the run.

    Typically used to fill in metrics after a backtest job completes.
    """
    backtest = await _get_result_or_404(db, result_id)

    updates = []

    if req.total_trades is not None:
        backtest.total_trades = req.total_trades
        updates.append(f"total_trades={req.total_trades}")

    if req.winning_trades is not None:
        backtest.winning_trades = req.winning_trades
        updates.append(f"winning_trades={req.winning_trades}")

    if req.losing_trades is not None:
        backtest.losing_trades = req.losing_trades
        updates.append(f"losing_trades={req.losing_trades}")

    if req.profit_total is not None:
        backtest.profit_total = Decimal(str(req.profit_total))
        updates.append(f"profit_total={req.profit_total}")

    if req.profit_percent is not None:
        backtest.profit_percent = Decimal(str(req.profit_percent))
        updates.append(f"profit_percent={req.profit_percent}")

    if req.max_drawdown is not None:
        backtest.max_drawdown = Decimal(str(req.max_drawdown))
        updates.append(f"max_drawdown={req.max_drawdown}")

    if req.sharpe_ratio is not None:
        backtest.sharpe_ratio = Decimal(str(req.sharpe_ratio))
        updates.append(f"sharpe_ratio={req.sharpe_ratio}")

    if req.sortino_ratio is not None:
        backtest.sortino_ratio = Decimal(str(req.sortino_ratio))
        updates.append(f"sortino_ratio={req.sortino_ratio}")

    if req.sqn is not None:
        backtest.sqn = Decimal(str(req.sqn))
        updates.append(f"sqn={req.sqn}")

    if req.full_results is not None:
        backtest.full_results = req.full_results
        updates.append("full_results")

    # Audit log
    if updates:
        await log_activity(
            db,
            action="backtest_result.update",
            level="info",
            actor=current_user.get("username", "unknown"),
            target_type="backtest_result",
            target_id=backtest.id,
            target_name=f"Backtest {backtest.id}",
            details=f"Updated fields: {', '.join(updates)}",
        )

    return BacktestResultResponse(**_format_result_response(backtest))


@router.delete("/{result_id}", status_code=204)
async def delete_backtest_result(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
) -> None:
    """Soft-delete a backtest result by ID (safety rule #7: never hard delete)."""
    backtest = await _get_result_or_404(db, result_id)

    backtest.is_deleted = True

    await log_activity(
        db,
        action="backtest_result.delete",
        level="info",
        actor=current_user.get("username", "unknown"),
        target_type="backtest_result",
        target_id=backtest.id,
        target_name=f"Backtest {backtest.id}",
        details="Soft-deleted backtest result",
    )
