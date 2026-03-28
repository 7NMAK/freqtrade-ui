# IMPLEMENTATION PLAN — Every Page, Every Click, Every Effect

**Created:** 2026-03-28
**Status:** Reference document for making ALL interactive elements functional
**Principle:** FreqTrade is the brain. We display its data and write its config.

---

## SUMMARY OF CURRENT STATE

| Category | Count | Description |
|----------|-------|-------------|
| **Working** | 14 | Login, header kill switch, sidebar nav, dashboard data loading |
| **Dead** | ~30 | No onClick handler at all — nothing happens on click |
| **Local-only** | ~150 | Tabs/toggles work in UI but never save to API |
| **Simulated** | ~12 | Fake progress bars, alert() instead of API calls |

**API functions defined:** 52 in `api.ts`
**API functions USED:** 6 (login, getBots, botStatus, botProfit, botBalance, botDaily)
**API functions UNUSED:** 46

---

## PAGE 0: LOGIN (`/login`)

**Status: WORKING** — Connected to real API

| # | Element | Current | Action Needed |
|---|---------|---------|---------------|
| 1 | Username input | Works | None |
| 2 | Password input | Works | None |
| 3 | Sign In button | Calls `login()` | None |
| 4 | Error display | Shows API errors | None |
| 5 | Redirect after login | Goes to /dashboard | None |

---

## PAGE 1: DASHBOARD (`/dashboard`)

**Status: PARTIALLY WORKING** — Data loads, but most elements are dead

### Data Sources (all from FT API via orchestrator)
- `getBots()` → bot list
- `botStatus(id)` → open trades per bot
- `botProfit(id)` → profit data per bot
- `botBalance(id)` → balance per bot
- `botDaily(id, 7)` → daily P&L chart

### Interactive Elements

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | Portfolio Equity card | Shows real data | None needed | — | Done |
| 2 | Unrealized P&L card | Shows real data | None needed | — | Done |
| 3 | Open Positions count | Shows real data | None needed | — | Done |
| 4 | Active Bots count | Shows real data | None needed | — | Done |
| 5 | Total Bots count | Shows real data | None needed | — | Done |
| 6 | "View all strategies" link | **DEAD** | Navigate to /strategies | `<Link href="/strategies">` | HIGH |
| 7 | Bot cards (each bot) | **DEAD** — no click | Click → navigate to bot detail or /strategies?bot=X | `router.push()` | HIGH |
| 8 | Bot card "View Bot" | **MISSING** | Should have a link/button on each card | Link to /strategies | MED |
| 9 | Position rows (table) | **DEAD** — no click | Click row → expand trade detail or show trade modal | Show FT trade detail fields | MED |
| 10 | "Analytics" link (Daily P&L) | **DEAD** | Navigate to /analytics | `<Link href="/analytics">` | HIGH |
| 11 | Quick Actions: New Strategy | Works (link) | None needed | — | Done |
| 12 | Quick Actions: Run Backtest | Works (link) | None needed | — | Done |
| 13 | Quick Actions: Import Strategy | Works (link) | None needed | — | Done |
| 14 | Quick Actions: Download Data | Works (link) | None needed | — | Done |
| 15 | Auto-refresh (10s) | Works | None needed | — | Done |

---

## PAGE 2: STRATEGIES (`/strategies`)

**Status: ALL MOCK DATA** — Nothing connected to API

### Data Sources Needed
- `getStrategies()` → orchestrator strategy list (lifecycle metadata)
- `getBots()` → bot instances (to show which bot runs which strategy)
- `botFtStrategies(botId)` → list .py files on FT server
- `botFtStrategy(botId, name)` → get strategy source code
- `botProfit(botId)` → per-strategy profit (via its bot)
- `botStatus(botId)` → open trades per strategy

### Interactive Elements

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | Strategy cards (6 mock) | **ALL MOCK** | Load from `getStrategies()` + `getBots()` + per-bot profit | `getStrategies()`, `getBots()`, `botProfit()` | CRITICAL |
| 2 | Lifecycle filter tabs (All/Live/Paper/Backtest/Draft/Retired) | **LOCAL** — filters mock data | Filter real strategy list by lifecycle | Local filter on real data | HIGH |
| 3 | Strategy card click → expand | **LOCAL** — toggles local state | Show real detail panel with real config | Load from API | HIGH |
| 4 | "View Trades" button | **DEAD** | Navigate to that bot's trade list, or show modal with `botStatus(id)` + `botTrades(id)` | `botTrades(botId)` | HIGH |
| 5 | "Analytics" button | **DEAD** | Navigate to /analytics with pair/strategy pre-selected | `router.push('/analytics?...')` | MED |
| 6 | "Edit" button | **DEAD** | Navigate to /builder with strategy pre-loaded | `router.push('/builder?strategy=X')` | MED |
| 7 | "View Bot" button | **DEAD** | Show bot status detail (health, trades, config) | `botStatus(id)`, `botConfig(id)` | HIGH |
| 8 | Lifecycle timeline (detail panel) | **MOCK** | Show real lifecycle timestamps from orchestrator DB | `getStrategy(id)` | MED |
| 9 | Config table (detail panel) | **MOCK** | Show real FT config for that bot | `botConfig(botId)` | HIGH |
| 10 | Backtest history (detail panel) | **MOCK** | Show real backtest results (if stored) | Orchestrator backtest history | MED |
| 11 | Protections (detail panel) | **MOCK** | Show real protections from bot config | `botConfig(botId)` → protections section | MED |
| 12 | "Promote" action button | **DEAD** | Change lifecycle: draft→backtest→paper→live | `updateStrategy(id, {lifecycle: 'next'})` | HIGH |
| 13 | "Deploy to Paper" button | **DEAD** | Deploy strategy to a paper trading bot | `registerBot()` + `startBot()` | HIGH |
| 14 | "Deploy to Live" button | **DEAD** | Deploy strategy to a live bot | Confirm → `updateBot()` → `startBot()` | HIGH |
| 15 | "Retire" button | **DEAD** | Change lifecycle to retired, stop bot | `updateStrategy()` + `stopBot()` | MED |
| 16 | Search input (if present) | **DEAD** | Filter strategies by name | Local filter | LOW |
| 17 | "+ New Strategy" button | **DEAD** | Navigate to /builder | `router.push('/builder')` | HIGH |

---

## PAGE 3: STRATEGY BUILDER (`/builder`)

**Status: ALL MOCK/LOCAL** — Form works locally but saves nothing

### Data Sources Needed
- `botFtStrategies(botId)` → list available strategies
- `botFtStrategy(botId, name)` → load strategy source
- `createStrategy()` → save new strategy to orchestrator
- `updateStrategy()` → update existing

### Interactive Elements

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | Strategy name input | **LOCAL** | Part of strategy creation form | Save with strategy | HIGH |
| 2 | Exchange selector | **LOCAL** | Select exchange (maps to config.json `exchange.name`) | Config param | HIGH |
| 3 | Timeframe selector | **LOCAL** | Maps to config.json `timeframe` | Config param | HIGH |
| 4 | Leverage selector | **LOCAL** | Maps to strategy `leverage` callback return | Config param | HIGH |
| 5 | Margin mode selector | **LOCAL** | Maps to config.json `margin_mode` | Config param | HIGH |
| 6 | Pair chips (multi-select) | **LOCAL** | Maps to config.json `exchange.pair_whitelist` | Config param | HIGH |
| 7 | Indicator selector (checkboxes) | **LOCAL** | Determines which indicators to include in `populate_indicators()` | Strategy .py generation | HIGH |
| 8 | Entry conditions (long) | **LOCAL** | Build `populate_entry_trend()` logic | Strategy .py generation | CRITICAL |
| 9 | Entry conditions (short) | **LOCAL** | Build `populate_entry_trend()` short logic | Strategy .py generation | CRITICAL |
| 10 | Exit conditions | **LOCAL** | Build `populate_exit_trend()` logic | Strategy .py generation | CRITICAL |
| 11 | "+ Add Condition" buttons | **LOCAL** | Add new condition row | Local state | MED |
| 12 | "Remove" condition buttons | **LOCAL** | Remove condition row | Local state | MED |
| 13 | Stoploss input | **LOCAL** | Maps to strategy `stoploss` attribute | Strategy attr | HIGH |
| 14 | Trailing stop toggle + params | **LOCAL** | Maps to `trailing_stop`, `trailing_stop_positive`, etc. | Strategy attrs (§4) | HIGH |
| 15 | ROI table (time → ROI %) | **LOCAL** | Maps to strategy `minimal_roi` dict | Strategy attr (§4) | HIGH |
| 16 | Protection toggles | **LOCAL** | Maps to `protections` list in config.json (§7) | Config param | HIGH |
| 17 | Protection param inputs | **LOCAL** | Maps to protection params (trade_limit, lookback_period, etc.) | Config param | HIGH |
| 18 | Collapsible sections (5 sections) | **LOCAL** | Toggle sections open/close | Local UI | Done |
| 19 | "Preview Code" button | **DEAD/SIMULATED** | Generate .py strategy file from form values and show preview | Local generation | HIGH |
| 20 | "Save as Draft" button | **DEAD** | Save to orchestrator as draft strategy | `createStrategy({...data, lifecycle: 'draft'})` | CRITICAL |
| 21 | "Run Backtest" button | **DEAD** | Save + navigate to backtesting page | Save → `router.push('/backtesting?strategy=X')` | HIGH |
| 22 | Stake amount input | **LOCAL** | Maps to config.json `stake_amount` | Config param | HIGH |
| 23 | Max open trades input | **LOCAL** | Maps to config.json `max_open_trades` | Config param | HIGH |

---

## PAGE 4: BACKTESTING (`/backtesting`)

**Status: ALL MOCK/SIMULATED** — Fake progress bars, mock results

### Data Sources Needed
- `botFtStrategies(botId)` → list strategies available for backtesting
- Orchestrator endpoint to run: `freqtrade backtesting --strategy X --timerange Y` (needs new API)
- Orchestrator endpoint to run: `freqtrade hyperopt --strategy X --epochs N` (needs new API)
- Results from backtesting runs (stored by orchestrator or parsed from FT output)

### Interactive Elements

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | Strategy selector | **LOCAL** (mock list) | Load real strategies from `botFtStrategies()` | `botFtStrategies(botId)` | CRITICAL |
| 2 | Timeframe selector | **LOCAL** | Maps to `--timeframe` CLI arg | CLI arg | HIGH |
| 3 | Detail timeframe selector | **LOCAL** | Maps to `--timeframe-detail` CLI arg | CLI arg | MED |
| 4 | Date range (start/end) | **LOCAL** | Maps to `--timerange YYYYMMDD-YYYYMMDD` | CLI arg | CRITICAL |
| 5 | Pair whitelist checkboxes | **LOCAL** | Maps to `--pairs` CLI arg or config whitelist | CLI arg | HIGH |
| 6 | Max open trades input | **LOCAL** | Maps to `--max-open-trades` CLI arg | CLI arg | HIGH |
| 7 | Starting balance input | **LOCAL** | Maps to `--starting-balance` CLI arg | CLI arg | MED |
| 8 | Fee override inputs | **LOCAL** | Maps to `--fee` CLI arg | CLI arg | LOW |
| 9 | Enable position stacking toggle | **LOCAL** | Maps to `--enable-position-stacking` | CLI flag | MED |
| 10 | Cache selector | **LOCAL** | Maps to `--cache` CLI arg (day/week/month/none) | CLI arg | LOW |
| 11 | FreqAI model selector | **LOCAL** | Maps to `--freqaimodel` CLI arg | CLI arg | MED |
| 12 | **"▶ Run Backtest" button** | **SIMULATED** — fake progress | Run real backtest via orchestrator | POST to orchestrator → runs `freqtrade backtesting` | CRITICAL |
| 13 | Progress bar | **SIMULATED** | Show real progress (or polling for completion) | Poll orchestrator for job status | HIGH |
| 14 | Results table (per-pair) | **MOCK** | Show real backtest results | Parse backtest JSON output | CRITICAL |
| 15 | Summary stats (total profit, trades, Sharpe, etc.) | **MOCK** | Show real summary from backtest | Parse backtest JSON output | CRITICAL |
| 16 | Equity curve chart | **MOCK** | Render real equity curve from backtest | Backtest daily stats | HIGH |
| 17 | Hyperopt tab | **LOCAL** | Switch to hyperopt mode | Local tab switch | Done |
| 18 | Loss function selector | **LOCAL** (12 options) | Maps to `--hyperopt-loss` CLI arg | CLI arg | HIGH |
| 19 | Sampler selector | **LOCAL** (6 options) | Maps to `--opt-sampler` CLI arg (§6) | CLI arg | HIGH |
| 20 | Epochs input | **LOCAL** | Maps to `--epochs` CLI arg | CLI arg | HIGH |
| 21 | Spaces checkboxes | **LOCAL** | Maps to `--spaces` CLI arg | CLI arg | HIGH |
| 22 | Min trades input | **LOCAL** | Maps to `--min-trades` CLI arg | CLI arg | MED |
| 23 | **"▶ Run Hyperopt" button** | **SIMULATED** | Run real hyperopt | POST to orchestrator → runs `freqtrade hyperopt` | CRITICAL |
| 24 | Hyperopt results table | **MOCK** | Show real epoch results | Parse hyperopt output | CRITICAL |
| 25 | "Apply Best" button | **DEAD** | Apply best hyperopt params to strategy | Update strategy config | HIGH |
| 26 | "Export" button | **DEAD** | Export results to file | Download JSON/CSV | LOW |
| 27 | History sidebar (past runs) | **MOCK** | Show real past backtest/hyperopt runs | Orchestrator job history | MED |
| 28 | History item click | **DEAD** | Load past run results | Fetch from orchestrator | MED |
| 29 | Validation tab (Lookahead §21) | **MOCK** | Run `freqtrade lookahead-analysis` | POST to orchestrator | MED |
| 30 | Validation tab (Recursive §22) | **MOCK** | Run `freqtrade recursive-analysis` | POST to orchestrator | MED |
| 31 | Analysis tab (enter_tag breakdown §30) | **MOCK** | Show real analysis from backtest data | Backtest enter_tag stats | MED |
| 32 | Analysis tab (day-of-week breakdown) | **MOCK** | Show real day breakdown | Backtest daily stats | MED |

**NOTE:** Backtesting requires new orchestrator endpoints:
- `POST /api/bots/{id}/backtest` — start backtest job
- `GET /api/bots/{id}/backtest/{job_id}` — poll job status
- `POST /api/bots/{id}/hyperopt` — start hyperopt job
- `GET /api/bots/{id}/hyperopt/{job_id}` — poll job status

---

## PAGE 5: ANALYTICS (`/analytics`)

**Status: ALL MOCK** — Beautiful charts with fake data

### Data Sources Needed
- `botPairCandles(botId, pair, timeframe, limit)` → OHLCV candle data
- `botPlotConfig(botId)` → plot_config (which indicators to overlay)
- `botTrades(botId)` → trade markers on chart
- `botPerformance(botId)` → per-pair performance
- `botProfit(botId)` → overall profit stats
- `botDaily(botId)` / `botWeekly(botId)` / `botMonthly(botId)` → time-based P&L

### Interactive Elements

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | Pair selector dropdown | **LOCAL** (mock pairs) | Load real pairs from `botWhitelist()` | `botWhitelist(botId)` | CRITICAL |
| 2 | Timeframe buttons | **LOCAL** | Refetch candles for new timeframe | `botPairCandles(botId, pair, tf)` | CRITICAL |
| 3 | Candlestick chart | **MOCK** (CSS candles) | Render real OHLCV data | `botPairCandles()` → real chart (Recharts/D3) | CRITICAL |
| 4 | TEMA overlay toggle | **LOCAL** | Show/hide TEMA on chart (from plot_config) | `botPlotConfig()` | HIGH |
| 5 | SAR overlay toggle | **LOCAL** | Show/hide SAR on chart (from plot_config) | `botPlotConfig()` | HIGH |
| 6 | Trade markers on chart | **MOCK** | Show real trade entry/exit points | `botTrades()` mapped to candle times | HIGH |
| 7 | Sub-chart tabs (RSI/MACD/Volume) | **LOCAL** | Switch subchart indicator | From plot_config subplots | HIGH |
| 8 | RSI subchart | **MOCK** (CSS bars) | Render real RSI data from candles | Computed from candle data or plot_config | HIGH |
| 9 | MACD subchart | **MOCK** | Render real MACD data | Computed or from plot_config | HIGH |
| 10 | Volume subchart | **MOCK** | Render real volume from candles | `botPairCandles()` volume field | HIGH |
| 11 | Orderflow: use_public_trades toggle | **LOCAL** | Config param `exchange.use_public_trades` (§29) | Config param | MED |
| 12 | Orderflow scale input | **LOCAL** | Config param `orderflow.scale` | Config param | MED |
| 13 | Orderflow imbalance inputs | **LOCAL** | Config params `orderflow.imbalance_volume`, `orderflow.imbalance_ratio` | Config params | MED |
| 14 | Footprint chart | **MOCK** | Render real orderflow data (if available) | Requires orderflow data from FT | LOW |
| 15 | CVD (Cumulative Volume Delta) | **MOCK** | Render real CVD | From orderflow data | LOW |
| 16 | Imbalance alerts list | **MOCK** | Show real imbalances | From orderflow data | LOW |
| 17 | Analysis stats (4 stat cards) | **MOCK** | Show real stats from `botProfit()` + `botPerformance()` | `botProfit()`, `botPerformance()` | HIGH |
| 18 | Performance heatmap | **MOCK** | Real per-pair daily performance | `botDaily()` per pair | MED |
| 19 | Notebooks list | **MOCK** | List real notebooks from server | SSH/file list (low priority) | LOW |

---

## PAGE 6: RISK (`/risk`)

**Status: ALL MOCK** — Kill buttons use alert(), data is hardcoded

### Data Sources Needed
- `getBots()` → bot list for kill switch dropdown
- `getRiskEvents()` → risk event audit log
- `botLocks(botId)` → pair locks from FT
- `botConfig(botId)` → protections config (read-only display)
- `portfolioBalance()` → cross-bot exposure
- Heartbeat data from orchestrator (needs endpoint)

### Interactive Elements

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | **SOFT KILL button** | **SIMULATED** — alert() | Call `softKillAll()` to stop all bots | `softKillAll(reason)` | CRITICAL |
| 2 | **HARD KILL button** | **SIMULATED** — confirm + alert | Call `hardKillAll()` to force-exit + stop | `hardKillAll(reason)` | CRITICAL |
| 3 | Bot selector dropdown | **MOCK** (hardcoded options) | Load real bots from `getBots()` | `getBots()` | CRITICAL |
| 4 | "KILL ALL BOTS" button | **SIMULATED** — alert() | `hardKillAll()` | `hardKillAll(reason)` | CRITICAL |
| 5 | Per-bot kill (select + kill) | **DEAD** | Kill selected bot: `softKill(botId)` or `hardKill(botId)` | `softKill(id)` / `hardKill(id)` | HIGH |
| 6 | Running status indicator (X/Y running) | **MOCK** | Show real count from `getBots()` | `getBots()` → filter by status | HIGH |
| 7 | Last event display | **MOCK** | Show latest from `getRiskEvents()` | `getRiskEvents()` | HIGH |
| 8 | Heartbeat monitor cards | **ALL MOCK** | Show real heartbeat status per bot | Orchestrator heartbeat endpoint (TBD) | HIGH |
| 9 | Heartbeat ping values | **MOCK** | Real last ping time per bot | Orchestrator stores last_ping per bot | HIGH |
| 10 | Heartbeat failure dots | **MOCK** | Real consecutive_failures per bot | From `getBots()` → consecutive_failures | HIGH |
| 11 | FT Protections cards (4) | **ALL MOCK** | Load real protections from `botConfig()` | `botConfig(botId)` → protections array | HIGH |
| 12 | MaxDrawdown progress bar | **MOCK** | Calculate from real data | FT doesn't expose current drawdown directly; could compute from `botProfit()` | MED |
| 13 | LowProfitPairs flagged list | **MOCK** | From `botLocks()` | `botLocks(botId)` → filter by reason | MED |
| 14 | Pair Locks table | **ALL MOCK** | Load real locks from `botLocks()` | `botLocks(botId)` for each bot | HIGH |
| 15 | Portfolio Exposure bars | **ALL MOCK** | Load from `portfolioBalance()` | `portfolioBalance()` | HIGH |
| 16 | Risk Events Log table | **ALL MOCK** | Load from `getRiskEvents()` | `getRiskEvents()` | CRITICAL |
| 17 | "Showing last 6 events" link | **DEAD** | Paginate or show all events | Pagination param | LOW |
| 18 | Auto-refresh | **MISSING** | Refresh every 5-10s | `setInterval` like dashboard | HIGH |

---

## PAGE 7: SETTINGS (`/settings`)

**Status: ALL MOCK/LOCAL** — Forms render but save nothing, load nothing

### Data Sources Needed
- `botConfig(botId)` → load current config.json values
- Orchestrator endpoint to save config (needs: PUT /api/bots/{id}/config)
- `reloadBotConfig(botId)` → tell FT to reload after save
- `botWhitelist(botId)` → current whitelist
- `botBlacklist(botId)` → current blacklist

### Interactive Elements (Settings has 7 tabs)

#### Tab: Core Trading (§1)
| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | dry_run toggle | **LOCAL** | Load from `botConfig()`, save to config | config.json `dry_run` | CRITICAL |
| 2 | trading_mode selector | **LOCAL** | `spot` / `futures` / `margin` | config.json `trading_mode` | HIGH |
| 3 | margin_mode selector | **LOCAL** | `isolated` / `cross` | config.json `margin_mode` | HIGH |
| 4 | stake_currency input | **LOCAL** | config.json `stake_currency` | Config param | HIGH |
| 5 | stake_amount input | **LOCAL** | config.json `stake_amount` | Config param | HIGH |
| 6 | max_open_trades input | **LOCAL** | config.json `max_open_trades` | Config param | HIGH |
| 7 | tradable_balance_ratio input | **LOCAL** | config.json `tradable_balance_ratio` | Config param | MED |
| 8 | stoploss input | **LOCAL** | Strategy attribute (per-strategy) | Strategy param | HIGH |
| 9 | Trailing stop toggles + params | **LOCAL** | trailing_stop, trailing_stop_positive, etc. | Strategy/config | HIGH |
| 10 | ROI table editor | **LOCAL** | minimal_roi dict | Strategy/config | HIGH |
| 11 | unfilledtimeout inputs | **LOCAL** | config.json `unfilledtimeout.entry`, `.exit` | Config params | MED |
| 12 | order_types selectors | **LOCAL** | config.json `order_types.entry`, `.exit`, `.stoploss` | Config params | MED |
| 13 | order_time_in_force selectors | **LOCAL** | config.json `order_time_in_force` | Config params | LOW |
| 14 | **"Save & Reload Config" button** | **DEAD** | Save config → `reloadBotConfig(botId)` | PUT config + `reloadBotConfig()` | CRITICAL |

#### Tab: Pairlists (§7)
| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 15 | Pairlist handler selector | **LOCAL** | config.json `pairlists[0].method` | Config param | HIGH |
| 16 | Whitelist editor (add/remove pairs) | **LOCAL** | config.json `exchange.pair_whitelist` | Config param | HIGH |
| 17 | Blacklist editor | **LOCAL** | config.json `exchange.pair_blacklist` | Config param | HIGH |
| 18 | Filter toggles (11 filters) | **LOCAL** | config.json `pairlists` array entries | Config param | HIGH |
| 19 | Filter param inputs (when expanded) | **LOCAL** | Per-filter params (min_value, max_value, etc.) | Config params | MED |

#### Tab: Exchange (§9)
| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 20 | Exchange name selector | **LOCAL** | config.json `exchange.name` | Config param | HIGH |
| 21 | API key input | **LOCAL** | config.json `exchange.key` | Config param (sensitive!) | HIGH |
| 22 | API secret input | **LOCAL** | config.json `exchange.secret` | Config param (sensitive!) | HIGH |
| 23 | CCXT rate limit toggle | **LOCAL** | config.json `exchange.ccxt_config.enableRateLimit` | Config param | LOW |

#### Tab: Telegram (§11)
| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 24 | Telegram enabled toggle | **LOCAL** | config.json `telegram.enabled` | Config param | HIGH |
| 25 | Bot token input | **LOCAL** | config.json `telegram.token` | Config param | HIGH |
| 26 | Chat ID input | **LOCAL** | config.json `telegram.chat_id` | Config param | HIGH |
| 27 | Notification toggles (entry, exit, etc.) | **LOCAL** | config.json `telegram.notification_settings.*` | Config params | MED |

#### Tab: Webhooks (§13)
| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 28 | Webhook enabled toggle | **LOCAL** | config.json `webhook.enabled` | Config param | HIGH |
| 29 | Webhook URL input | **LOCAL** | config.json `webhook.url` | Config param | HIGH |
| 30 | Event payload editors (7 events) | **LOCAL** | config.json `webhook.webhookentry`, etc. | Config params | MED |
| 31 | Event toggles | **LOCAL** | Enable/disable each webhook event | Config params | MED |

#### Tab: Producer/Consumer (§17)
| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 32 | Producer enabled toggle | **LOCAL** | config.json `external_message_consumer.enabled` | Config param | MED |
| 33 | Producer name/host/port | **LOCAL** | Producer connection details | Config params | MED |
| 34 | Consumer entries | **LOCAL** | config.json `external_message_consumer.producers` array | Config param | MED |

#### Tab: Advanced (§28)
| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 35 | Log level selector | **LOCAL** | config.json `verbosity` or logging config | Config param | LOW |
| 36 | Internals process throttle | **LOCAL** | config.json `internals.process_throttle_secs` | Config param | LOW |
| 37 | Heartbeat interval | **LOCAL** | config.json `internals.heartbeat_interval` | Config param | LOW |

**CRITICAL MISSING FEATURE:** There is NO "bot selector" on settings page. Settings should let you choose WHICH bot's config you're editing. Need a bot dropdown at the top.

---

## PAGE 8: FREQAI (`/freqai`)

**Status: ALL MOCK/LOCAL** — Forms work but save nothing

### Data Sources Needed
- `botConfig(botId)` → load current freqai{} config section
- Same save mechanism as Settings (PUT config + reload)

### Interactive Elements

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | FreqAI enabled toggle | **LOCAL** | config.json `freqai.enabled` | Config param (§24) | HIGH |
| 2 | Model selector (14 models) | **LOCAL** | config.json `freqai.model_training_parameters.model_type` or `freqaimodel` | Config param (§24) | HIGH |
| 3 | Identifier input | **LOCAL** | config.json `freqai.identifier` | Config param | HIGH |
| 4 | Training period input | **LOCAL** | config.json `freqai.train_period_days` | Config param | HIGH |
| 5 | Backtest period input | **LOCAL** | config.json `freqai.backtest_period_days` | Config param | HIGH |
| 6 | Feature columns editor (tag input) | **LOCAL** | config.json `freqai.feature_parameters.include_timeframes`, etc. | Config params (§26) | HIGH |
| 7 | Label period candles input | **LOCAL** | config.json `freqai.feature_parameters.label_period_candles` | Config param | HIGH |
| 8 | Indicator periods candles array | **LOCAL** | config.json `freqai.feature_parameters.indicator_periods_candles` | Config param (§26) | MED |
| 9 | DI threshold input | **LOCAL** | config.json `freqai.feature_parameters.DI_threshold` | Config param (§26) | MED |
| 10 | Outlier detection toggles | **LOCAL** | use_SVM_to_remove_outliers, use_DBSCAN_to_remove_outliers | Config params (§26) | MED |
| 11 | Noise standard deviation input | **LOCAL** | config.json `freqai.feature_parameters.noise_standard_deviation` | Config param | LOW |
| 12 | RL-specific fields (if RL model selected) | **LOCAL** | §25 RL config params | Config params | MED |
| 13 | Collapsible sections | **LOCAL** | Toggle UI sections | Local UI | Done |
| 14 | **"Save FreqAI Config" button** | **DEAD** | Save freqai{} section to config | PUT config + reload | CRITICAL |
| 15 | Status/training indicators | **MOCK** | Show if model is currently training | Need FT API or orchestrator endpoint | LOW |

---

## PAGE 9: DATA MANAGEMENT (`/data`)

**Status: ALL MOCK/SIMULATED** — Download simulated, lists are mock

### Data Sources Needed
- Orchestrator endpoint to run `freqtrade download-data` (needs new API)
- Orchestrator endpoint to run `freqtrade list-data` (needs new API)
- `botFtStrategies(botId)` → list strategies
- Orchestrator endpoints for utility subcommands (§18)

### Interactive Elements

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | Exchange selector | **LOCAL** | Select exchange for download-data | CLI arg `--exchange` | HIGH |
| 2 | Timeframe multi-select | **LOCAL** | CLI arg `--timeframes` | CLI args | HIGH |
| 3 | Pair selector | **LOCAL** | CLI arg `--pairs` | CLI args | HIGH |
| 4 | Date range (since) | **LOCAL** | CLI arg `--timerange` or `--days` | CLI arg | HIGH |
| 5 | Data format selector | **LOCAL** | CLI arg `--data-format-ohlcv` (json/feather/parquet) | CLI arg | MED |
| 6 | Include trades toggle | **LOCAL** | CLI arg `--dl-trades` | CLI flag | MED |
| 7 | **"▶ Download Data" button** | **SIMULATED** | Run `freqtrade download-data` via orchestrator | POST orchestrator → run CLI | CRITICAL |
| 8 | Download progress/log | **SIMULATED** | Real output from download command | Stream/poll job output | HIGH |
| 9 | Available data table | **MOCK** (11 rows) | Run `freqtrade list-data` and show real results | Orchestrator CLI → parse output | HIGH |
| 10 | Data table: delete button | **DEAD** | Delete specific data files | CLI or file deletion | LOW |
| 11 | Strategy list | **MOCK** (26 items) | Load from `botFtStrategies(botId)` | `botFtStrategies()` | HIGH |
| 12 | Strategy search | **DEAD** | Filter strategy list | Local filter | MED |
| 13 | Strategy click → view source | **DEAD** | Load strategy source with `botFtStrategy(botId, name)` | `botFtStrategy()` | HIGH |
| 14 | Exchange info table | **MOCK** | From FT or hardcoded reference | Reference data | LOW |
| 15 | Timeframe reference table | **MOCK** | From FT or hardcoded reference | Reference data | LOW |
| 16 | Trade list table | **MOCK** | Load from `botTrades(botId)` | `botTrades()` | HIGH |
| 17 | Pairlist tester section | **MOCK** | Run `freqtrade test-pairlist` | Orchestrator CLI endpoint | MED |
| 18 | Hyperopt loss + FreqAI model lists | **MOCK** | Reference data (can stay static) | Static reference | LOW |
| 19 | Utility commands (list-exchanges, etc.) | **MOCK/DEAD** | Run via orchestrator | POST orchestrator → CLI | MED |

**NOTE:** Data management requires new orchestrator endpoints:
- `POST /api/bots/{id}/download-data` — start download job
- `GET /api/bots/{id}/download-data/{job_id}` — poll status
- `POST /api/bots/{id}/list-data` — list available data
- `POST /api/bots/{id}/utility/{command}` — run utility subcommand

---

## SHARED: HEADER (`Header.tsx`)

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | Search input | **DEAD** | Global search across pairs, strategies | Local filtering or search API | LOW |
| 2 | Notification bell | **DEAD** | Show recent notifications/alerts | From risk events or FT logs | MED |
| 3 | Notification dot (red) | **STATIC** | Show if unread notifications | Count from risk events | MED |
| 4 | Kill Switch button | **WORKS** | Opens confirm modal → `hardKillAll()` | ✅ Done | Done |
| 5 | Kill confirm modal | **WORKS** | Calls API | ✅ Done | Done |
| 6 | User avatar (N) | **WORKS** | confirm("Logout?") → `logout()` | ✅ Done | Done |

---

## SHARED: SIDEBAR (`Sidebar.tsx`)

| # | Element | Current State | What It Should Do | API/Action | Priority |
|---|---------|--------------|-------------------|------------|----------|
| 1 | Navigation links | **WORKS** | All 9 links work | ✅ Done | Done |
| 2 | "3 live" badge (Strategies) | **STATIC** | Show real count of live strategies | From `getStrategies()` filter | MED |
| 3 | "2 runs" badge (Backtesting) | **STATIC** | Show active backtest jobs count | From orchestrator job queue | LOW |
| 4 | Green dots (live indicators) | **STATIC** | Show if real-time data flowing | From bot health status | LOW |
| 5 | Footer "5 bots" | **STATIC** | Show real bot count | From `getBots()` | MED |
| 6 | Footer green dot | **STATIC** | Show overall system health | From orchestrator health | MED |

---

## NEW ORCHESTRATOR ENDPOINTS NEEDED

These endpoints don't exist yet and must be built:

| # | Endpoint | Purpose | Used By |
|---|----------|---------|---------|
| 1 | `PUT /api/bots/{id}/config` | Save config.json changes | Settings, FreqAI |
| 2 | `POST /api/bots/{id}/backtest` | Start backtest job | Backtesting |
| 3 | `GET /api/bots/{id}/backtest/{job_id}` | Poll backtest status | Backtesting |
| 4 | `POST /api/bots/{id}/hyperopt` | Start hyperopt job | Backtesting |
| 5 | `GET /api/bots/{id}/hyperopt/{job_id}` | Poll hyperopt status | Backtesting |
| 6 | `POST /api/bots/{id}/download-data` | Start data download | Data Mgmt |
| 7 | `GET /api/bots/{id}/download-data/{job_id}` | Poll download status | Data Mgmt |
| 8 | `POST /api/bots/{id}/list-data` | List available data | Data Mgmt |
| 9 | `POST /api/bots/{id}/utility/{command}` | Run utility subcommand | Data Mgmt |
| 10 | `GET /api/heartbeat/status` | All bots heartbeat status | Risk |
| 11 | `POST /api/bots/{id}/strategy-source` | Get/save strategy .py file | Builder, Strategies |

---

## IMPLEMENTATION ORDER (Recommended)

### Phase A: Fix Dead Links + Connect Existing API Functions (1-2 days)
All these use EXISTING api.ts functions — no new backend work needed.

1. **Dashboard** — Fix dead links (View all strategies, Analytics, bot card clicks, trade row clicks)
2. **Risk** — Connect kill buttons to real `softKill/hardKill` API, load `getRiskEvents()`, load `getBots()` for dropdown, load `botLocks()` for pair locks, load `portfolioBalance()` for exposure
3. **Sidebar** — Load real bot count, strategy count from API
4. **Strategies** — Load strategies from `getStrategies()` + `getBots()`, show real profit data

### Phase B: Settings & Config Loading (1-2 days)
Requires `botConfig()` (exists) + new `PUT config` endpoint.

5. **Settings** — Add bot selector, load config with `botConfig()`, implement save
6. **FreqAI** — Same pattern as Settings but for freqai{} section
7. **Builder** — Generate .py file from form, save via orchestrator

### Phase C: Data Display Pages (1-2 days)
Uses existing API functions.

8. **Analytics** — Load real candles with `botPairCandles()`, real plot_config, real trades
9. **Data Management** — Load strategies with `botFtStrategies()`, trades with `botTrades()`

### Phase D: Job-Based Operations (2-3 days)
Requires NEW orchestrator endpoints for running CLI commands.

10. **Backtesting** — Build orchestrator backtest/hyperopt endpoints, connect forms
11. **Data Management** — Build orchestrator download-data endpoint, connect download form
12. **Builder** — Connect "Run Backtest" flow end-to-end

---

## TOTAL ELEMENT COUNT

| Page | Total Elements | Working | To Fix |
|------|---------------|---------|--------|
| Login | 5 | 5 | 0 |
| Dashboard | 15 | 11 | 4 |
| Strategies | 17 | 0 | 17 |
| Builder | 23 | 2 | 21 |
| Backtesting | 32 | 0 | 32 |
| Analytics | 19 | 0 | 19 |
| Risk | 18 | 0 | 18 |
| Settings | 37 | 0 | 37 |
| FreqAI | 15 | 1 | 14 |
| Data Mgmt | 19 | 0 | 19 |
| Header | 6 | 3 | 3 |
| Sidebar | 6 | 1 | 5 |
| **TOTAL** | **212** | **23** | **189** |
