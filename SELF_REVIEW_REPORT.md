# FULL APPLICATION AUDIT REPORT

**Date:** 2026-03-28
**Scope:** Complete freqtrade-ui application (frontend + orchestrator + infrastructure)
**Files Audited:** 42 source files + 18 infrastructure files
**Verdict:** NOT production-ready. 15 Critical, 18 Medium, 16 Minor issues found.

---

## EXECUTIVE SUMMARY

| Category | Critical | Medium | Minor | Total |
|----------|----------|--------|-------|-------|
| Frontend API/Types | 1 | 4 | 4 | 9 |
| Frontend Pages | 8 | 8 | 5 | 21 |
| Orchestrator Backend | 3 | 4 | 5 | 12 |
| Infrastructure | 0 | 2 | 2 | 4 |
| **TOTAL** | **15** | **18** | **16** | **49** |

---

## SECTION 1: CRITICAL ISSUES (15)

### C1. Orchestrator: No Authentication on ANY Endpoint
- **File:** All `orchestrator/src/api/*.py`
- **Issue:** Zero auth on all 93 endpoints. Anyone on the network can hard-kill all bots.
- **Impact:** Complete security bypass. Kill switch, bot control, everything public.
- **Fix:** Add JWT bearer token validation to all endpoints.

### C2. Orchestrator: Kill Switch Silent Partial Failure
- **File:** `orchestrator/src/kill_switch/kill_switch.py`
- **Issue:** `hard_kill_bot()` does forceexit + stop independently. If forceexit fails but stop succeeds, positions stay open but status shows KILLED.
- **Impact:** Safety rule #5 (exit ALWAYS MARKET) not guaranteed. User thinks kill succeeded.
- **Fix:** Fail-fast: if forceexit fails, raise immediately. Don't proceed to stop.

### C3. Orchestrator: Heartbeat False-Positive on Restart
- **File:** `orchestrator/src/heartbeat/monitor.py`
- **Issue:** No grace period on app startup. If FT is still booting, first 3 pings fail = immediate hard kill of healthy bot.
- **Impact:** Safety rule #4 broken. Restart orchestrator = kill all bots.
- **Fix:** Reset `consecutive_failures` to 0 on startup. Add 10s grace period.

### C4. Orchestrator: Database Pool Exhaustion
- **File:** `orchestrator/src/database.py:21`
- **Issue:** No `pool_pre_ping=True`. No connection timeout. Heartbeat (every 3s) + API requests can exhaust pool.
- **Impact:** Cascade failure under load. All endpoints hang.
- **Fix:** Add `pool_pre_ping=True`, `pool_timeout=10`, connection retry.

### C5. Frontend: Strategies Page — All Mock Data
- **File:** `frontend/src/app/strategies/page.tsx`
- **Issue:** 6 hardcoded fake strategies with fake profit values (+$4,820, +14.2%, etc.)
- **Impact:** Users see fabricated data. No real API connection.
- **Fix:** Connect to `getStrategies()` + `botProfit()` APIs.

### C6. Frontend: Backtesting Page — All Mock Data
- **File:** `frontend/src/app/backtesting/page.tsx`
- **Issue:** 8 hardcoded arrays (strategies, loss functions, pair results, history). Run button shows fake progress.
- **Impact:** Core functionality non-functional. Users can't run real backtests.
- **Fix:** Connect to `botBacktest*()` API functions.

### C7. Frontend: Data Management Page — All Mock Data
- **File:** `frontend/src/app/data/page.tsx`
- **Issue:** 10 fake downloaded data entries, 7 fake trades, hardcoded pairs.
- **Impact:** Users don't know what data actually exists on server.
- **Fix:** Connect to FT API passthrough endpoints.

### C8. Frontend: Settings Page — Forms Don't Save
- **File:** `frontend/src/app/settings/page.tsx`
- **Issue:** All inputs have `defaultValue` or local state only. No onChange, no save button, no API call.
- **Impact:** Users think they changed settings. Nothing persists.
- **Fix:** Implement form submission to config.json via orchestrator.

### C9. Frontend: FreqAI Page — Forms Don't Save
- **File:** `frontend/src/app/freqai/page.tsx`
- **Issue:** freqaiEnabled toggle and all form inputs have no save mechanism.
- **Impact:** FreqAI cannot be configured through UI.
- **Fix:** Implement form submission to FT config.

### C10. Frontend: Builder — Code Preview is Static Mock
- **File:** `frontend/src/app/builder/page.tsx:122-222`
- **Issue:** Python strategy code preview is a hardcoded string. Never generated from form state.
- **Impact:** Users think they're reviewing generated code but it's always the same boilerplate.
- **Fix:** Generate code dynamically from form state (conditions, indicators, stoploss, etc.)

### C11. Frontend: Builder — "Save as Draft" Button Dead
- **File:** `frontend/src/app/builder/page.tsx:1086-1088`
- **Issue:** No onClick handler. Appears between "Previous" and "Next: Review".
- **Impact:** Users cannot save work-in-progress strategies.
- **Fix:** Wire to `handleSaveStrategy()` or new draft endpoint.

### C12. Frontend: Analytics — Wrong FT Field Name
- **File:** `frontend/src/app/analytics/page.tsx:167-168`
- **Issue:** Uses `profit_abs` (doesn't exist in FT). Should be `close_profit_abs` (CLAUDE.md §16).
- **Impact:** Shows "$0" when real data loads because field is undefined.
- **Fix:** Change `profit_abs` to `close_profit_abs`.

### C13. Frontend: Analytics — Renders Mock Data Instead of Real Data
- **File:** `frontend/src/app/analytics/page.tsx:295`
- **Issue:** `candlesData` loaded from API but page renders hardcoded `candles` array. Real data ignored.
- **Impact:** User selects pair, API loads data, but display never updates.
- **Fix:** Replace `candles` reference with `candlesData` in rendering.

### C14. Frontend: Analytics — "Export Data" Dead Button
- **File:** `frontend/src/app/analytics/page.tsx:437`
- **Issue:** No onClick handler. Styled as clickable.
- **Impact:** Users expect data export but nothing happens.
- **Fix:** Implement CSV/JSON export.

### C15. Frontend: Builder — "Add Pair" Dead Button
- **File:** `frontend/src/app/builder/page.tsx:522-524`
- **Issue:** No onClick handler. Has cursor-pointer and hover styling.
- **Impact:** Users cannot add custom pairs to strategy.
- **Fix:** Wire to pair selection dialog.

---

## SECTION 2: MEDIUM ISSUES (18)

### M1. Types: FTLock Field Typo (`stategy` → `strategy`)
- **File:** `frontend/src/types/index.ts:364`
- **Fix:** Rename field.

### M2. API: `requestMultipart()` Missing JSON Error Parsing
- **File:** `frontend/src/lib/api.ts:105-107`
- **Fix:** Apply same error parsing as `request()`.

### M3. Dashboard: Invalid Bot ID Fallback (`-1`)
- **File:** `frontend/src/app/dashboard/page.tsx:351`
- **Issue:** `botDaily(runningBots[0]?.id ?? -1, ...)` — calls API with invalid ID.
- **Fix:** Check `runningBots.length > 0` first.

### M4. Frontend: 23 Unused API Functions (Dead Code)
- **File:** `frontend/src/lib/api.ts`
- **Issue:** 23 of 55 exported functions never imported. 42% dead code.
- **Fix:** Remove or implement UI for them.

### M5. Dashboard: Unsafe Type Casting (`as unknown as`)
- **File:** `frontend/src/app/dashboard/page.tsx:368, 759`
- **Fix:** Use proper type guards.

### M6. Analytics: Mock Data Never Replaced
- **File:** `frontend/src/app/analytics/page.tsx:10-94`
- **Issue:** candles, orderflow, footprint, delta, imbalances, notebooks all hardcoded.
- **Fix:** Connect to API or remove.

### M7. Analytics: Performance API Fails Silently
- **File:** `frontend/src/app/analytics/page.tsx:152`
- **Issue:** `catch { /* silent — keep mock stats */ }` — shows mock data without warning.
- **Fix:** Show toast or "Data unavailable" message.

### M8. Builder: All Dropdown Options Hardcoded
- **File:** `frontend/src/app/builder/page.tsx:9-101`
- **Issue:** Exchanges, timeframes, leverage, pairs, indicators all hardcoded arrays.
- **Fix:** Fetch from FT config API.

### M9. Risk: Portfolio/Events Load Fails Silently
- **File:** `frontend/src/app/risk/page.tsx:118, 126`
- **Issue:** `catch { // non-critical }` — no user notification.
- **Fix:** Show warning.

### M10. Orchestrator: Missing Database Indexes
- **File:** `orchestrator/src/models/*.py`
- **Issue:** No indexes on `bot_instances.status`, `bot_instances.is_deleted`, `risk_events.created_at`, `audit_log.created_at`.
- **Fix:** Add Alembic migration with indexes.

### M11. Orchestrator: Inconsistent Error Response Schema
- **File:** `orchestrator/src/api/*.py`
- **Issue:** Errors return 3+ different formats. Frontend can't reliably parse.
- **Fix:** Standardize to `{"error": str, "code": str, "detail": str|null}`.

### M12. Orchestrator: Strategy Lifecycle Not Enforced
- **File:** `orchestrator/src/api/strategies.py`
- **Issue:** Nothing stops starting a bot in DRAFT lifecycle. Safety rule #8 not enforced.
- **Fix:** Block bot start if strategy lifecycle < PAPER.

### M13. Orchestrator: FTClient Token Refresh Race Condition
- **File:** `orchestrator/src/ft_client.py`
- **Issue:** Multiple concurrent requests can trigger simultaneous token refresh.
- **Fix:** Add `asyncio.Lock()` around token management.

### M14. Orchestrator: Prometheus Counters Never Incremented
- **File:** `orchestrator/src/main.py:97-99`
- **Issue:** `KILL_EVENTS_TOTAL`, `HEARTBEAT_FAILURES`, `API_REQUEST_DURATION` defined but never incremented.
- **Fix:** Increment in kill_switch.py and heartbeat/monitor.py.

### M15. Header: Search Input Non-Functional
- **File:** `frontend/src/components/layout/Header.tsx:98`
- **Issue:** No onChange handler, no API call, no results display.
- **Fix:** Implement search or remove the input.

### M16. Analytics: Orderflow Section All Mock
- **File:** `frontend/src/app/analytics/page.tsx:491-626`
- **Issue:** Footprint, delta, imbalances all hardcoded. usePublicTrades toggle doesn't fetch.
- **Fix:** Connect to FT API or mark as "Coming Soon".

### M17. Analytics: "This Week" Heatmap Filter Dead
- **File:** `frontend/src/app/analytics/page.tsx:658`
- **Issue:** No onClick handler. Hardcoded heatmapRows never change.
- **Fix:** Wire filter to date range selection.

### M18. Orchestrator: Portfolio Aggregator Sequential (Slow)
- **File:** `orchestrator/src/portfolio/aggregator.py`
- **Issue:** Aggregates balance/profit from all bots serially. 100 bots = 20s latency.
- **Fix:** Use `asyncio.gather()` for parallel fetching.

---

## SECTION 3: MINOR ISSUES (16)

| # | File | Issue |
|---|------|-------|
| Mi1 | dashboard/page.tsx | No "no running bots" message when array empty |
| Mi2 | api.ts:7 | Fallback URL `localhost:8888` — no `/api` prefix |
| Mi3 | api.ts:13-30 | Token in localStorage (XSS vulnerable, standard for SPA) |
| Mi4 | dashboard/page.tsx | Comments "D-9", "D-12" not documented anywhere |
| Mi5 | analytics.tsx:12-13 | Hardcoded pair list (should come from API) |
| Mi6 | data/page.tsx:9-15 | Hardcoded pair/exchange/timeframe lists |
| Mi7 | login/page.tsx:28 | Default username "admin" pre-filled |
| Mi8 | risk/page.tsx:152 | Double `as unknown as` type cast |
| Mi9 | risk/page.tsx:156-164 | MaxDrawdown assumes decimal (0-1), no range validation |
| Mi10 | Sidebar.tsx:49-50 | Badge count stale for 30s between refreshes |
| Mi11 | globals.css:28 | `.toggle.active` CSS class defined but never used |
| Mi12 | orchestrator/ft_client.py | Methods return `dict` instead of typed Pydantic models |
| Mi13 | orchestrator/main.py:152-168 | Bare `except Exception: pass` in WebSocket proxy |
| Mi14 | orchestrator/models/bot_instance.py:46-47 | FT API credentials stored as plaintext in DB |
| Mi15 | orchestrator/alembic | No FK cascade behavior (RESTRICT/SET NULL) |
| Mi16 | builder/page.tsx:233 | "exchange" field captured but never used in payload |

---

## SECTION 4: FT FEATURE COVERAGE

### API Endpoint Coverage
- **Orchestrator FT client:** 53/55 endpoints (96%)
- **Frontend API functions:** 55 defined, 32 used (58%)
- **Missing FT endpoints:** Protections GET, Strategy PUT, Hyperopt (CLI only)

### Page vs FT-UI-MAP.html Coverage

| Page | FT Sections | Status |
|------|-------------|--------|
| Dashboard | §8, §16 | WORKING (real data) |
| Strategies | §2 | MOCK DATA (not connected) |
| Builder | §2, §3, §4, §7p, §10, §14 | PARTIAL (forms work, no save) |
| Backtesting | §5, §6, §15, §21, §22, §30 | MOCK DATA (not connected) |
| Settings | §1, §7, §9, §11, §13, §17, §28 | DEAD (forms don't save) |
| FreqAI | §24, §25, §26 | DEAD (forms don't save) |
| Analytics | §19, §20, §29 | MOCK DATA (some API, renders mock) |
| Data Mgmt | §12, §18 | MOCK DATA (not connected) |
| Risk | §7p + Kill Switch | WORKING (kill switch real, protections partial) |

### Working End-to-End Flows
1. Login → Dashboard (real FT data via orchestrator)
2. Kill Switch (soft + hard, with confirmation)
3. Heartbeat monitor (auto-kill on failure)
4. Portfolio aggregation (balance, profit, open trades)
5. Strategy lifecycle (CRUD + transitions)

### Broken/Mock End-to-End Flows
1. Strategy Builder → Save → Backtest → Deploy
2. Backtesting → Run → View Results
3. Settings → Edit → Save to config.json
4. FreqAI → Configure → Enable
5. Data Management → Download → Verify
6. Analytics → View candles → Orderflow

---

## SECTION 5: CODE QUALITY METRICS

| Metric | Frontend | Orchestrator |
|--------|----------|--------------|
| Lines of code | ~8,000 | ~2,500 |
| TypeScript `any` | 0 | N/A |
| `as unknown as` casts | 3 | N/A |
| Bare type hints | N/A | ~20 methods |
| Test coverage | 0% | 0% |
| Console.log/alert | 0 | 0 |
| Dead imports | 0 | 1 (Depends in main.py) |
| Hardcoded mock arrays | 12 | 0 |
| FT field name violations | 1 (profit_abs) | 0 |

---

## SECTION 6: RECOMMENDATIONS BY PRIORITY

### Block Release (Do First)
1. Fix C1: Add auth to orchestrator endpoints
2. Fix C2: Kill switch atomic failure handling
3. Fix C3: Heartbeat restart grace period
4. Fix C4: Database pool_pre_ping + timeout
5. Fix C12: Wrong FT field name (profit_abs → close_profit_abs)

### Connect Real Data (Phase 3 Core Work)
6. Fix C5-C9: Connect strategies, backtesting, settings, freqai, data pages to API
7. Fix C10-C11: Builder code generation + save draft
8. Fix C13: Analytics render real candlesData instead of mock
9. Fix M6, M16: Analytics orderflow section

### Reliability
10. Fix M10: Add database indexes
11. Fix M13: FTClient token lock
12. Fix M14: Prometheus counter instrumentation
13. Fix M18: Portfolio aggregator parallel fetch

### Polish
14. Fix M1-M5: Types, error handling, dead code cleanup
15. Fix Mi1-Mi16: All minor issues
16. Add unit tests (target 80% coverage)

---

## SECTION 7: WHAT'S WORKING WELL

- Dashboard real-time data from FT API via orchestrator
- Kill switch (soft + hard) fully functional with audit logging
- Heartbeat monitor with auto-kill (minus restart race condition)
- Portfolio aggregation across multiple bots
- Strategy lifecycle state machine with transition validation
- FT API client with 96% endpoint coverage
- Correct FT field names throughout (1 exception)
- Clean TypeScript (0 `any` types)
- Proper auth guard on all pages
- Responsive dark theme UI

---

## SECTION 8: HACKS & WORKAROUNDS

### 8.1 eslint-disable Suppressions (3)

| # | File | Line | Suppression | Verdict |
|---|------|------|-------------|---------|
| 1 | `frontend/src/lib/useApi.ts` | 31 | `eslint-disable-next-line react-hooks/exhaustive-deps` | ACCEPTABLE — spreading deps array |
| 2 | `frontend/src/app/analytics/page.tsx` | 157 | `eslint-disable-line react-hooks/exhaustive-deps` | ACCEPTABLE — intentional dep omission |
| 3 | `frontend/src/app/dashboard/page.tsx` | 393 | `eslint-disable-next-line react-hooks/exhaustive-deps` | ACCEPTABLE — same pattern |

### 8.2 Silent catch Blocks (3)

| # | File | Line | Pattern | Risk |
|---|------|------|---------|------|
| 1 | `analytics/page.tsx` | 152 | `catch { /* silent -- keep mock stats */ }` | **HIGH** — shows fake data instead of error |
| 2 | `strategies/page.tsx` | 458 | `.catch(() => {})` | **MEDIUM** — getBots() failure invisible |
| 3 | `backtesting/page.tsx` | 330 | `.catch(() => {})` | **MEDIUM** — strategy list stays empty silently |

### 8.3 Fake Simulations (2 — CRITICAL)

| # | File | Line | Function | What It Does |
|---|------|------|----------|-------------|
| 1 | `data/page.tsx` | 289-325 | `startDownload()` | **FAKE** — runs setTimeout loop with `Math.random()` delays simulating download progress bar. NO API call whatsoever. Builds CLI command string but never sends it anywhere. |
| 2 | `data/page.tsx` | 328-337 | `runConvert()` | **FAKE** — shows success toast after 1.2s setTimeout. NO API call. |

### 8.4 Hardcoded Delays (5)

| # | File | Line | Delay | Purpose | Verdict |
|---|------|------|-------|---------|---------|
| 1 | `data/page.tsx` | 322 | `300 + Math.random() * 400 ms` | Fake download animation | **HACK** — no real operation |
| 2 | `data/page.tsx` | 324 | `500 ms` | Initial fake download kick | **HACK** |
| 3 | `data/page.tsx` | 334 | `1200 ms` | Fake convert animation | **HACK** |
| 4 | `risk/page.tsx` | 213, 233, 261 | `2000 ms` | Post-action reload | ACCEPTABLE |
| 5 | `dashboard/page.tsx` | 419 | `2000 ms` | Post-action reload | ACCEPTABLE |

---

## SECTION 9: MOCK DATA INVENTORY (COMPLETE)

### Per-Page Mock Data Census

#### analytics/page.tsx — 11 mock variables (lines 10-94)

| Variable | Line | Items | Real API Replacement |
|----------|------|-------|---------------------|
| `pairs` | 12 | 5 | `botWhitelist(id)` |
| `candles` | 15-36 | 20 | `botPairCandles(id, pair, tf)` — **API called but result ignored in render** |
| `rsiBars` | 38-44 | 20 | Derive from candle indicators |
| `macdBars` | 46-48 | 20 | Derive from candle indicators |
| `volumeBars` | 50-56 | 20 | Volume from candle data |
| `footprintData` | 58-65 | 6 | FT orderflow (§29) |
| `deltaBars` | 67 | 16 | Derive from orderflow |
| `imbalances` | 69-74 | 4 | Derive from orderflow |
| `analysisStats` | 76-81 | 4 | `botPerformance(id)` — partially replaced on load |
| `heatmapRows` | 83-89 | 5 | `botDaily(id)` per pair — **all % values fake** |
| `notebooks` | 91-94 | 2 | Server filesystem listing |

**Also fake:** Cumulative Profit Chart (lines 439-456) is a CSS `clipPath` polygon with hardcoded coordinates. Y-axis labels hardcoded: `+$2,400`, `+$1,800`, `+$1,200`, `+$600`, `$0`.

#### strategies/page.tsx — 1 massive mock variable (lines 42-406)

| Variable | Line | Items | Real API Replacement |
|----------|------|-------|---------------------|
| `strategies` | 42-406 | 7 objects (**364 lines**) | `getStrategies()` + `botProfit(id)` |

Fake values: `+$4,820`, `+$3,210`, `+$1,540`, `+$2,180`, `+14.2%`, `+11.8%`, `142 trades`, `68.2% win rate`, `Sharpe 2.31`, etc.

#### settings/page.tsx — 6 mock variables (lines 32-68)

| Variable | Line | Items | Real API Replacement |
|----------|------|-------|---------------------|
| `mockRoi` | 32-37 | 4 | `botConfig(id)` → `minimal_roi` |
| `mockWhitelist` | 39-42 | 7 | `botWhitelist(id)` |
| `mockBlacklist` | 44 | 3 | `botBlacklist(id)` |
| `mockFilters` | 46-58 | 11 | `botConfig(id)` → `pairlists` |
| `producers` | 1088-1091 | 2 | `botConfig(id)` → `external_message_consumer.producers` |
| `webhookEvents` | 60-68 | 7 | `botConfig(id)` → webhook section |

**Note:** `loadConfig()` exists and fetches real config, but form fields initialize from mock and may not update.

Hardcoded secrets: fake IPs `192.168.1.100`, `192.168.1.101` and fake token `sampleWsToken123abc`.

#### backtesting/page.tsx — 7 mock variables (lines 78-112)

| Variable | Line | Items | Real API Replacement |
|----------|------|-------|---------------------|
| `pairResults` | 78-82 | 3 | `botBacktestResults(id)` per-pair |
| `analysisData` | 84-88 | 3 | `botBacktestResults(id)` enter_tag |
| `breakdownData` | 90-98 | 7 | Day-of-week breakdown |
| `historyItems` | 100-106 | 5 | Orchestrator backtest history |
| `validationIndicators` | 108-112 | 3 | Lookahead/recursive analysis |
| Summary StatBoxes | 953-964 | 7 inline | **Hardcoded in JSX:** `247`, `63.97%`, `+142.38 USDT`, `+14.24%`, `-8.72%`, `2.14`, `3.08` |
| TOTAL row | 1018-1027 | 1 | **Hardcoded in JSX:** `247`, `63.97%`, `+142.38`, `4h 23m` |

**Note:** Backtesting page DOES call real API to run backtests (lines 358-423), but **results display section renders hardcoded mock** instead of `btResult`.

#### data/page.tsx — 5 mock variables + 2 fake operations (lines 7-100)

| Variable | Line | Items | Real API Replacement |
|----------|------|-------|---------------------|
| `PAIRS` | 9-15 | 20 | Exchange pair list from FT |
| `strategies` | 20-47 | 26 | `botFtStrategies(id)` |
| `dataList` | 71-83 | 11 | Server filesystem data listing |
| `tradeList` | 85-93 | 7 | `botTrades(id)` — fake dates 2026-03-15 to 2026-03-27 |
| `hyperoptLosses` | 95-100 | 12 | Static reference (acceptable) |
| `startDownload()` | 289-325 | — | **SIMULATION** — no API call, setTimeout loop |
| `runConvert()` | 328-337 | — | **SIMULATION** — no API call, 1.2s delay |

#### builder/page.tsx — 2 mock structures (lines 8-101, 121-222)

| Variable | Line | Items | Real API Replacement |
|----------|------|-------|---------------------|
| `tradingPairs` | 14-22 | 7 | `botWhitelist(id)` or exchange pairs |
| `codePreview` | 122-222 | 100 lines | **Dynamic code generation from wizard state** |

Static dropdowns (exchanges, timeframes, indicators) are acceptable as reference data.

### Mock Data Summary

| Page | Mock Variables | Mock Lines | Fake Operations | Status |
|------|---------------|------------|-----------------|--------|
| analytics | 11 | ~85 | 0 | RENDERS MOCK OVER REAL DATA |
| strategies | 1 | ~364 | 0 | 100% MOCK |
| settings | 6 | ~40 | 0 | FORMS DON'T SAVE |
| backtesting | 7 + 2 inline | ~50 + JSX | 0 | API WORKS, DISPLAY IS MOCK |
| data | 5 | ~60 | 2 (download, convert) | 100% MOCK + FAKE SIMULATIONS |
| builder | 2 | ~115 | 0 | CODE PREVIEW STATIC |
| **TOTAL** | **~34** | **~714 lines** | **2** | |

---

## SECTION 10: STUB FUNCTIONS & DEAD UI ELEMENTS

### 10.1 Stub Functions (4)

| # | File | Line | Function | What It Does Now | What It Should Do |
|---|------|------|----------|-----------------|-------------------|
| 1 | `data/page.tsx` | 289 | `startDownload()` | Fake setTimeout loop | Call orchestrator → `freqtrade download-data` |
| 2 | `data/page.tsx` | 328 | `runConvert()` | Fake 1.2s delay + toast | Call orchestrator → `freqtrade convert-data` |
| 3 | `strategies/page.tsx` | 458 | getBots catch | `.catch(() => {})` | Show error toast |
| 4 | `backtesting/page.tsx` | 330 | botFtStrategies catch | `.catch(() => {})` | Show error toast |

### 10.2 Dead Buttons — No onClick Handler (8)

| # | File | Line | Element | Expected Action |
|---|------|------|---------|----------------|
| 1 | `builder/page.tsx` | 522-524 | "Add pair" button | Open pair picker dialog |
| 2 | `builder/page.tsx` | 1086-1088 | "Save as Draft" button | Save strategy draft |
| 3 | `analytics/page.tsx` | 437 | "Export Data" span | Export CSV/JSON |
| 4 | `analytics/page.tsx` | 543 | "BTC/USDT:USDT . 1h" span | Change pair/timeframe |
| 5 | `analytics/page.tsx` | 658 | "This Week" span | Filter heatmap by date |
| 6 | `backtesting/page.tsx` | 992 | "Export CSV" span | Export backtest results |
| 7 | `settings/page.tsx` | 1126 | "x Remove" producer button | Remove producer from list |
| 8 | `settings/page.tsx` | 1152 | "+ Add Producer" button | Add new producer entry |

### 10.3 Dead Inputs — No onChange Handler (10+)

All in `settings/page.tsx` using `FormInput` with hardcoded `value`:

| # | Line | Field | Hardcoded Value |
|---|------|-------|----------------|
| 1 | 265 | Bot Name | `"freqtrade"` |
| 2 | 286 | max_open_trades | `5` |
| 3 | 291 | stake_currency | `"USDT"` |
| 4 | 295 | tradable_balance_ratio | `"100"` |
| 5 | 306 | stake_amount | `1000` |
| 6 | 545 | unfilledtimeout.entry | `10` |
| 7 | 549 | unfilledtimeout.exit | `30` |
| 8 | 1108 | wait_timeout | `300` |
| 9 | 1113 | ping_timeout | `10` |
| 10 | 1185 | db_url | `"sqlite:///..."` |

### 10.4 Dead Search Input (1)

| # | File | Line | Element |
|---|------|------|---------|
| 1 | `Header.tsx` | 96-100 | Search `<input>` — no onChange, no state, no API, typing does nothing |

---

## SECTION 11: REVISED TOTALS

| Category | Critical | Medium | Minor | Total |
|----------|----------|--------|-------|-------|
| Frontend API/Types | 1 | 4 | 4 | 9 |
| Frontend Pages | 8 | 8 | 5 | 21 |
| Frontend Hacks/Mocks/Stubs | 4 | 3 | 0 | 7 |
| Orchestrator Backend | 3 | 4 | 5 | 12 |
| Infrastructure (post-fix) | 0 | 0 | 0 | 0 |
| **TOTAL** | **16** | **19** | **14** | **49** |

### New Critical Issues (added by forensic scan)

- **C16. Data Management: Download is 100% Fake Simulation** — `startDownload()` uses `Math.random()` delays, NO API call. User thinks data is downloading but nothing happens on server.

### Page Readiness Summary

| Page | API Connected | Mock Data Removed | Forms Save | E2E Working |
|------|:---:|:---:|:---:|:---:|
| Login | YES | N/A | YES | YES |
| Dashboard | YES | N/A | N/A | YES |
| Risk | YES | N/A | N/A | YES |
| Strategies | PARTIAL | NO (364 lines) | N/A | NO |
| Builder | PARTIAL | NO (115 lines) | PARTIAL | NO |
| Backtesting | YES (run) | NO (results mock) | N/A | PARTIAL |
| Analytics | YES (fetch) | NO (renders mock) | N/A | NO |
| Settings | PARTIAL | NO (40 lines) | NO | NO |
| FreqAI | NO | N/A | NO | NO |
| Data Mgmt | NO | NO (60 lines) | NO | NO |

**3 of 10 pages work end-to-end. 7 of 10 have mock data or non-functional forms.**

---

*Report generated by multi-agent audit. All findings verified against source code with exact line numbers.*
