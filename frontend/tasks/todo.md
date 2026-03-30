# Experiments System + Fixes — Master Plan
**Created:** 2026-03-29
**Status:** Planning

---

## OVERVIEW

Build the Experiments system (strategy versioning, test history, comparison) and fix existing hyperopt/sampler issues. All runs (backtest, hyperopt, AI) are grouped under parent experiments. Strategy parameters are versioned — every hyperopt creates a new version, user can revert to any version.

---

## PHASE 1: Backend Fixes (no UI changes)
*Goal: Make hyperopt fully functional before building Experiments*

### T1.1 — Sampler Selection via Orchestrator
**Problem:** UI has sampler dropdown but FT has no CLI flag for it. FT reads sampler from strategy's `generate_estimator()` method.
**Solution:** Orchestrator creates temp strategy wrapper before hyperopt run.
**Files:** `orchestrator/src/api/bots.py`
**Steps:**
- [ ] Before hyperopt, read original strategy file from container
- [ ] If user selected a sampler != default, create temp copy with `generate_estimator()` override
- [ ] Run hyperopt with `--strategy TempStrategyName`
- [ ] After hyperopt, copy results back under original strategy name
- [ ] Delete temp strategy file
- [ ] Fix dropdown list: remove 3 fake samplers (Random, MOTPE, AutoSampler), keep 6 real ones (TPE, GP, CMA-ES, NSGA-II, NSGA-III, QMC)

### T1.2 — Disable Param Export Option
**Problem:** Hyperopt overwrites `StrategyName.json` after every run without asking.
**Solution:** Add `--disable-param-export` flag when user toggles "Disable param export" checkbox (already exists in UI).
**Files:** `orchestrator/src/api/bots.py`
**Steps:**
- [ ] Check if `body.get("disable_param_export")` is true
- [ ] If true, add `--disable-param-export` to cmd
- [ ] Always save the hyperopt output params to orchestrator DB regardless

### T1.3 — Save Hyperopt Results to DB
**Problem:** Hyperopt results only exist as raw text output and `.fthypt` files. Not queryable.
**Solution:** Parse hyperopt output, extract best result params + metrics, save to DB.
**Files:** `orchestrator/src/api/bots.py`, new: `orchestrator/src/services/hyperopt_parser.py`
**Steps:**
- [ ] Parse hyperopt output text to extract: best epoch, profit, trades, win/draw/loss, drawdown, params (ROI, stoploss, trailing)
- [ ] On hyperopt completion, create new `strategy_version` record with the optimized params
- [ ] Create `backtest_results` record linked to that version (using metrics from hyperopt)
- [ ] Store metadata: sampler used, loss function, epochs, duration, spaces

### T1.4 — Hyperopt Lock Cleanup (DONE)
- [x] Clean `hyperopt.lock` before each run
- [x] Add `--ignore-missing-spaces` flag

---

## PHASE 2: Experiments DB Schema
*Goal: Create the data layer for experiment grouping*

### T2.1 — New DB Table: `experiments`
**Purpose:** Groups related runs (baseline backtest + hyperopts + AI analyses) under one experiment.
**Fields:**
```
experiments:
  id: Integer PK
  strategy_id: FK → strategies
  name: String(200)  -- auto-generated: "Strategy004 — BTC/USDT 2024-2026"
  pair: String(50)
  timeframe: String(10)
  timerange_start: Date
  timerange_end: Date
  baseline_backtest_id: FK → backtest_results (nullable)
  best_version_id: FK → strategy_versions (nullable)
  notes: Text (nullable)
  is_deleted: Boolean
  created_at: DateTime
```

### T2.2 — New DB Table: `experiment_runs`
**Purpose:** Each individual run within an experiment (hyperopt, AI analysis, validation backtest).
**Fields:**
```
experiment_runs:
  id: Integer PK
  experiment_id: FK → experiments
  parent_run_id: FK → experiment_runs (nullable, for re-backtests under hyperopt)
  run_type: Enum(backtest, hyperopt, ai_pre, ai_post, oos_validation, freqai)
  status: Enum(running, completed, failed)

  -- Links to existing tables
  backtest_result_id: FK → backtest_results (nullable)
  strategy_version_id: FK → strategy_versions (nullable)
  ai_analysis_id: FK → ai_hyperopt_analyses (nullable)

  -- Hyperopt-specific metadata
  sampler: String(50) (nullable)
  loss_function: String(100) (nullable)
  epochs: Integer (nullable)
  spaces: JSON (nullable)
  hyperopt_duration_seconds: Integer (nullable)

  -- Quick metrics (denormalized for fast display)
  total_trades: Integer (nullable)
  win_rate: Numeric(6,2) (nullable)
  profit_abs: Numeric(20,8) (nullable)
  profit_pct: Numeric(10,4) (nullable)
  max_drawdown: Numeric(10,4) (nullable)
  sharpe_ratio: Numeric(10,4) (nullable)
  sortino_ratio: Numeric(10,4) (nullable)
  calmar_ratio: Numeric(10,4) (nullable)
  avg_duration: String(50) (nullable)

  -- Output
  raw_output: Text (nullable, last 8000 chars of CLI output)
  error_message: Text (nullable)

  is_deleted: Boolean
  created_at: DateTime
```

### T2.3 — Alembic Migration
- [ ] Create migration file for `experiments` and `experiment_runs` tables
- [ ] Run migration on server

---

## PHASE 3: Orchestrator API for Experiments
*Goal: Wire up the experiment tracking*

### T3.1 — Auto-create Experiment on Backtest
**Files:** `orchestrator/src/api/bots.py`
**Logic:**
- When backtest completes successfully:
  1. Check if experiment exists for this strategy+pair+timerange
  2. If not, create new experiment with this backtest as baseline
  3. Create experiment_run (type=backtest) linked to backtest_result
- When hyperopt completes:
  1. Find parent experiment (same strategy+pair+timerange)
  2. Create experiment_run (type=hyperopt) with sampler, loss_fn metadata
  3. Create new strategy_version with optimized params
  4. Link run to version

### T3.2 — Experiments CRUD API
**New file:** `orchestrator/src/api/experiments.py`
**Endpoints:**
```
GET    /api/experiments              — list all experiments (with filters)
GET    /api/experiments/{id}         — single experiment with all runs
DELETE /api/experiments/{id}         — soft delete experiment
GET    /api/experiments/{id}/runs    — list runs for experiment
DELETE /api/experiments/runs/{id}    — soft delete a run + its FT backtest file
```

### T3.3 — Strategy Version Management API
**Extend:** `orchestrator/src/api/strategies.py`
**Endpoints:**
```
GET    /api/strategies/{id}/versions          — list all versions
GET    /api/strategies/{id}/versions/{ver}    — get specific version params
POST   /api/strategies/{id}/versions/{ver}/activate  — write .json file to FT
POST   /api/strategies/{id}/versions/revert   — activate a specific version
```
**Activate logic:**
1. Read version params from DB
2. Write `StrategyName.json` to FT container
3. Update `strategies.current_version_id`
4. Log to audit_log

---

## PHASE 4: Frontend — Experiments Page
*Goal: New /experiments page*

### T4.1 — New Page: `/experiments`
**File:** `frontend/src/app/experiments/page.tsx`
**3 tabs:**

**Tab: All Runs (dense table with grouping)**
- Parent rows = experiments (strategy name, pair, period, baseline metrics)
- Child rows = individual runs (hyperopt, AI, validation)
- Columns: Strategy/Run, Type, Pair, Period, TF, Trades, Win%, Profit, DD, Sharpe, Version, Date
- Checkboxes for multi-select delete
- Filters: strategy, type, status, sort order
- Search across all fields
- Collapse/expand groups
- Click row → expand detail panel (full metrics + params + raw output)
- "..." menu per row: View Details, Re-run, Delete, Compare

**Tab: Strategy Versions**
- Strategy selector dropdown
- Left panel: compact version list (not timeline for scalability)
  - Each version: number, source tag, date, key params, key metrics
  - "Activate" button, "Re-run backtest" button, "Copy params" button
- Right panel: comparison table of all/selected versions
  - All metrics side by side
  - Visual bars for profit, drawdown, sharpe
  - "best" indicator on winning cells

**Tab: Compare**
- User adds runs to comparison (from any experiment/strategy)
- Dense table with all metrics + ratios
- Sort by any column
- Export CSV

### T4.2 — API Functions
**File:** `frontend/src/lib/api.ts`
**New functions:**
```typescript
getExperiments(filters?)
getExperiment(id)
deleteExperiment(id)
getExperimentRuns(experimentId)
deleteExperimentRun(runId)
getStrategyVersions(strategyId)
activateStrategyVersion(strategyId, versionId)
```

### T4.3 — Remove History from Backtesting Page
- Remove "Backtest History" card from backtesting page
- Add link: "View in Experiments →" that navigates to /experiments filtered by strategy
- Keep raw hyperopt output display (useful during active run)

### T4.4 — Sidebar Update
- Add "Experiments" item under Testing section
- Remove or rename old items if needed

---

## PHASE 5: Wire Everything Together
*Goal: End-to-end flow works*

### T5.1 — Backtest → Experiment Auto-tracking
- After successful backtest: auto-create/update experiment
- Show toast: "Saved to Experiments"

### T5.2 — Hyperopt → Version Auto-creation
- After successful hyperopt: parse output → create version → create run
- If `disable_param_export` is OFF: also write .json (current behavior)
- If ON: only save to DB, don't write .json
- Show toast: "Created version v{N} — View in Experiments"

### T5.3 — Re-run from Experiments
- "Re-run" button on any experiment run
- Opens backtesting page with pre-filled params from that run
- "Re-run with modifications" — same but editable

### T5.4 — Delete Flow
- Checkbox select → Delete button → Confirmation dialog
- Soft-delete in DB
- Also delete FT backtest result file via `DELETE /api/v1/backtest/history/{id}`
- Strategy versions are NEVER deleted (always available for revert)

### T5.5 — Version Activation (Revert)
- User clicks "Activate" on any version
- Confirmation dialog explains what will change
- Writes .json file to FT container
- Updates current_version_id in strategies table
- Logs to audit_log

---

## PHASE 6: Populate Existing Data
*Goal: Import existing backtest/hyperopt results into new system*

### T6.1 — Migration Script
- Read all `.fthypt` files from FT container
- Read all backtest result files from FT history API
- Create experiment + experiment_run records for each
- Parse hyperopt results for metrics
- Map to strategies table

---

## IMPLEMENTATION ORDER

1. **T1.2** — disable-param-export (5 min, trivial)
2. **T1.1** — sampler selection (30 min)
3. **T2.1-T2.3** — DB schema + migration (20 min)
4. **T1.3** — hyperopt result parsing + save to DB (45 min)
5. **T3.1-T3.3** — Orchestrator API (1 hour)
6. **T4.1-T4.4** — Frontend Experiments page (2-3 hours)
7. **T5.1-T5.5** — Wire together (1 hour)
8. **T6.1** — Populate existing data (30 min)

**Total estimate: ~6-8 hours of implementation**

---

## RULES
- FreqTrade source code: ZERO modifications
- Strategy .py files: ONLY temp copies for sampler injection, deleted after hyperopt
- All data in orchestrator DB, never duplicate FT trade data
- Strategy versions are immutable and never deleted
- Use exact FT field names (open_rate, close_profit_abs, etc.)
