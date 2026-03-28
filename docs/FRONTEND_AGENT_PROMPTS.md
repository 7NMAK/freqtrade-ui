# Frontend Build — Agent Prompts

Two agents run IN PARALLEL:
- **Agent A (Builder):** completes/fixes each page phase by phase, marks each phase DONE
- **Agent B (Auditor):** watches for completed phases, does deep code audit against FT-UI-MAP.html, fixes bugs immediately

Communication mechanism: `FRONTEND_BUILD_STATUS.md` in the project root. Builder writes to it. Auditor reads it.

---

## STATUS FILE FORMAT

File: `FRONTEND_BUILD_STATUS.md` (project root)

Builder agent MUST create this file at the start and update it after EVERY phase.
Auditor agent polls this file every time it finishes auditing a phase.

```markdown
# Frontend Build — Status

## Phase Tracker
| Phase | Status | Started | Completed | Files Changed |
|-------|--------|---------|-----------|---------------|
| P1: Foundation & Auth | ⏳ PENDING | — | — | — |
| P2: Dashboard | ⏳ PENDING | — | — | — |
| P3: Strategies | ⏳ PENDING | — | — | — |
| P4: Strategy Builder | ⏳ PENDING | — | — | — |
| P5: Backtesting + Hyperopt | ⏳ PENDING | — | — | — |
| P6: Settings | ⏳ PENDING | — | — | — |
| P7: FreqAI | ⏳ PENDING | — | — | — |
| P8: Analytics | ⏳ PENDING | — | — | — |
| P9: Data Management | ⏳ PENDING | — | — | — |
| P10: Risk | ⏳ PENDING | — | — | — |
| P11: Login + Auth Flow | ⏳ PENDING | — | — | — |
| P12: API Client Completeness | ⏳ PENDING | — | — | — |
| P13: Shared Components + Polish | ⏳ PENDING | — | — | — |
| P14: Build + Lint + Integration | ⏳ PENDING | — | — | — |

## Audit Tracker
| Phase | Audited | Issues | Fixed |
|-------|---------|--------|-------|
| P1 | ⏳ | — | — |
```

Status values:
- `⏳ PENDING` — not started
- `🔨 BUILDING` — builder is working on this now
- `✅ DONE` — builder finished, ready for audit
- `🔍 AUDITING` — auditor is reviewing
- `✅ AUDITED` — audit complete, issues fixed

---

## AGENT A: BUILDER

Copy-paste this prompt into a Claude Code session:

```
You are completing the Next.js 14 frontend for freqtrade-ui.
The frontend is PARTIALLY BUILT — pages exist but may be incomplete.
Your job: ensure EVERY element from FT-UI-MAP.html is present and wired to real API.

═══════════════════════════════════════════════════════════
MANDATORY: Read these files BEFORE writing ANY code:
═══════════════════════════════════════════════════════════

1. CLAUDE.md — project rules, anti-hallucination protocol, field names
2. docs/FT-UI-MAP.html — THE BLUEPRINT. Every FT feature → exact page → exact UI element.
   If it's in the map, it MUST be in the UI. If it's NOT in the map, DON'T add it.
3. docs/FREQTRADE_REFERENCE.md — all FT features (34 sections)
4. docs/STATUS.md — current project state
5. frontend/src/lib/api.ts — existing API client (571 lines)
6. frontend/src/types/index.ts — existing TypeScript types (679 lines)
7. frontend/src/components/layout/AppShell.tsx — layout wrapper

═══════════════════════════════════════════════════════════
EXISTING STATE — READ BEFORE CHANGING
═══════════════════════════════════════════════════════════

The frontend ALREADY has:
- Next.js 14 project with TailwindCSS, Recharts
- AppShell layout (Sidebar + Header + AuthGuard + ErrorBoundary)
- API client with token management, error handling
- TypeScript types for FT trades, orders, config, protections, etc.
- All 9 page routes + login page (substantial code, 200-2100 lines each)
- UI components: Card, Skeleton, Toast, ErrorBoundary

YOUR JOB is NOT to rewrite — it's to:
1. Audit each page against FT-UI-MAP.html
2. Add ANY missing UI elements (forms, tables, buttons, dropdowns)
3. Wire ALL UI elements to real API endpoints
4. Ensure every FT parameter has the correct input type
5. Fix any bugs, broken imports, or incorrect field names

═══════════════════════════════════════════════════════════
STATUS FILE — CRITICAL REQUIREMENT
═══════════════════════════════════════════════════════════

You MUST maintain FRONTEND_BUILD_STATUS.md in the project root.
- Create it at the START with all 14 phases as ⏳ PENDING
- Update the current phase to 🔨 BUILDING when you start it
- Update to ✅ DONE with timestamp and file list when you finish
- A parallel audit agent reads this file to know what to audit
- NEVER skip the status update — the audit agent depends on it

═══════════════════════════════════════════════════════════
PHASE-BY-PHASE BUILD ORDER (DO NOT SKIP OR REORDER)
═══════════════════════════════════════════════════════════

Each phase MUST be fully complete before moving to the next.
After completing each phase, update FRONTEND_BUILD_STATUS.md immediately.

───────────────────────────────────────────────────────────
PHASE 1: Foundation & Shared Infrastructure
───────────────────────────────────────────────────────────
FT-UI-MAP ref: All pages (global infrastructure)

Verify/fix:
  frontend/src/lib/api.ts
    - Base request function handles auth, errors, retries
    - Token refresh on 401
    - API_BASE configurable via NEXT_PUBLIC_API_URL

  frontend/src/types/index.ts
    - All FT trade fields from §16 present (open_rate, close_rate, etc.)
    - All orchestrator types (Bot, Strategy, RiskEvent)
    - All config types matching §1 categories

  frontend/src/components/layout/AppShell.tsx
    - Sidebar with ALL 9 nav items + AI Insights (10 total)
    - Active state highlighting
    - Kill switch button in header (always visible)
    - Bot selector dropdown in header (multi-bot support)

  frontend/src/components/layout/Sidebar.tsx
    - Navigation items:
      Dashboard, Strategies, Builder, Backtesting, Settings,
      FreqAI, Analytics, Data Management, Risk, AI Insights
    - Each links to correct /route
    - Collapse/expand toggle

  frontend/src/components/layout/Header.tsx
    - Bot selector (dropdown of registered bots from GET /api/bots)
    - Bot status indicator (green/yellow/red)
    - Kill Switch button (red, always accessible)
    - Heartbeat indicator

Checklist before marking DONE:
  □ API client handles all error cases
  □ Types match FREQTRADE_REFERENCE.md §16 exactly
  □ All 10 nav items present in sidebar
  □ Kill switch in header
  □ Bot selector in header
  □ Build succeeds: cd frontend && npx next build

→ Update FRONTEND_BUILD_STATUS.md: P1 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 2: Dashboard Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: §8+16 Dashboard section — EVERY row in that table

File: frontend/src/app/dashboard/page.tsx (existing: ~976 lines)

Cross-reference FT-UI-MAP.html Dashboard section. EVERY element must exist:

  DATA DISPLAYS (read-only, from FT API):
  □ Portfolio equity — GET /api/v1/balance → total, free, used, currencies[].balance
  □ Overall profit stats — GET /api/v1/profit → profit_all_coin, profit_all_percent,
    profit_closed_coin, profit_closed_percent, trade_count, closed_trade_count,
    first_trade_date, latest_trade_date, avg_duration, best_pair, best_rate,
    winning_trades, losing_trades
  □ Open positions table — GET /api/v1/status → trade_id, pair, is_short, open_rate,
    stake_amount, amount, open_date, current_rate, current_profit,
    stoploss_current_dist, stoploss_entry_dist, open_order, enter_tag
  □ Trade history table — GET /api/v1/trades → trade_id, pair, is_short, open_rate,
    close_rate, close_profit, close_profit_abs, fee_open, fee_close, open_date,
    close_date, exit_reason, enter_tag, stake_amount, leverage
  □ Daily P&L chart — GET /api/v1/daily → data[].date, abs_profit, fiat_value, trade_count
  □ Weekly P&L — GET /api/v1/weekly
  □ Monthly P&L — GET /api/v1/monthly
  □ Per-pair performance — GET /api/v1/performance → pair, profit, profit_abs, count
  □ Entry tag analysis — GET /api/v1/entries → enter_tag, profit, profit_abs, count
  □ Exit reason analysis — GET /api/v1/exits → exit_reason, profit, profit_abs, count
  □ Mixed tag analysis — GET /api/v1/mix_tags
  □ Trade stats — GET /api/v1/stats
  □ Open trade count — GET /api/v1/count → current, max
  □ Bot config display — GET /api/v1/show_config
  □ Bot health — GET /api/v1/health → last_process, last_process_ts
  □ System info — GET /api/v1/sysinfo
  □ Bot logs — GET /api/v1/logs
  □ Heartbeat — GET /api/v1/ping
  □ Bot version — GET /api/v1/version
  □ Whitelist display — GET /api/v1/whitelist
  □ Pair locks — GET /api/v1/locks

  BOT CONTROL ACTIONS (buttons):
  □ Start bot — POST /api/v1/start
  □ Stop bot — POST /api/v1/stop
  □ Stop new entries — POST /api/v1/stopbuy
  □ Pause — POST /api/v1/pause
  □ Force exit — POST /api/v1/forceexit (per trade, in open positions table)
  □ Force entry — POST /api/v1/forceenter (dialog: pair, side, price, stake)
  □ Reload config — POST /api/v1/reload_config
  □ Delete trade — DELETE /api/v1/trades/{id}
  □ Reload trade — POST /api/v1/trades/{id}/reload
  □ Cancel open order — DELETE /api/v1/trades/{id}/open-order (NEW — per trade)

Checklist before marking DONE:
  □ ALL 20+ data displays present
  □ ALL 10 action buttons present and wired
  □ Cancel open order button per trade row
  □ FT field names correct everywhere (open_rate NOT entry_price)
  □ Loading skeletons on all data sections
  □ Error states on all sections
  □ No mock data, no Math.random()
  □ Refresh interval configurable (not hardcoded)

→ Update FRONTEND_BUILD_STATUS.md: P2 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 3: Strategies Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: Strategy lifecycle (orchestrator feature)

File: frontend/src/app/strategies/page.tsx (existing: ~504 lines)

  □ Strategy list from GET /api/strategies
  □ Lifecycle badges: DRAFT → BACKTEST → PAPER → LIVE → RETIRED
  □ Transition buttons (advance/retire) — POST /api/strategies/{id}/transition
  □ Create new strategy — POST /api/strategies
  □ Delete strategy (soft) — DELETE /api/strategies/{id}
  □ Link to Builder for editing
  □ FT strategy list from GET /api/v1/strategies (show available .py files)
  □ Filter by lifecycle state
  □ Sort by name/date/lifecycle

Checklist before marking DONE:
  □ All CRUD operations wired
  □ Lifecycle transitions work
  □ Both orchestrator strategies AND FT strategy files shown
  □ No orphan API functions

→ Update FRONTEND_BUILD_STATUS.md: P3 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 4: Strategy Builder Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: §2, §3, §4, §7p (protections), §10, §14

File: frontend/src/app/builder/page.tsx (existing: ~1346 lines)

  §2 — STRATEGY INTERFACE (every row in FT-UI-MAP):
  □ populate_indicators() — indicator picker (EMA, SMA, RSI, MACD, BB, ATR chips)
  □ populate_entry_trend() — entry condition builder (IF indicator op value AND/OR)
  □ populate_exit_trend() — exit condition builder (same UI)
  □ informative_pairs() — multi-timeframe pair selector
  □ timeframe dropdown (1m/5m/15m/30m/1h/4h/1d/1w)
  □ can_short toggle
  □ startup_candle_count number input
  □ minimal_roi table editor (add/remove rows: {"0": 0.04, "30": 0.02})
  □ stoploss input (negative float)
  □ trailing_stop section (toggle + 3 numeric inputs)
  □ use_custom_stoploss toggle → links to callback
  □ process_only_new_candles toggle (advanced)
  □ order_types config grid (entry/exit/stoploss/emergency_exit/force_exit/force_entry)
  □ order_time_in_force dropdowns (entry/exit: GTC/FOK/IOC/PO)
  □ plot_config editor (main_plot + subplots)
  □ DataProvider methods reference tooltip
  □ Wallet methods reference tooltip
  □ lock_pair/unlock_pair/is_pair_locked reference
  □ version() optional text input (strategy version metadata)

  §3 — ALL 19 CALLBACKS (each = toggleable section):
  □ bot_start() — toggle + code editor
  □ bot_loop_start() — toggle + code editor
  □ custom_stake_amount() — toggle + visual presets (fixed/% of balance/Kelly)
  □ custom_exit() — toggle + condition builder
  □ custom_stoploss() — toggle + presets (time-based/profit-based/ATR-based)
  □ custom_roi() — toggle + code editor
  □ custom_entry_price() — toggle + offset/orderbook presets
  □ custom_exit_price() — toggle + offset presets
  □ check_entry_timeout() — toggle + time threshold input
  □ check_exit_timeout() — toggle + time threshold input
  □ confirm_trade_entry() — toggle + condition builder
  □ confirm_trade_exit() — toggle + condition builder
  □ adjust_trade_position() — toggle + DCA config (levels, multiplier, conditions)
  □ adjust_order_price() — toggle + code editor
  □ leverage() — toggle + fixed/dynamic/pair-based presets
  □ order_filled() — toggle + code editor
  □ adjust_entry_price() — toggle + code editor (entry-only)
  □ adjust_exit_price() — toggle + code editor (exit-only)
  □ plot_annotations() — toggle + annotation builder

  §4 — ALL 6 STOPLOSS TYPES:
  □ 1. Static (stoploss input)
  □ 2. Trailing (toggle trailing_stop)
  □ 3. Trailing + Positive (+ trailing_stop_positive)
  □ 4. Trailing + Offset (+ offset input + only_offset toggle)
  □ 5. Custom callback (toggle use_custom_stoploss → opens §3 callback)
  □ 6. On Exchange (toggle + limit_ratio + interval + price_type)

  §10 — LEVERAGE/FUTURES:
  □ trading_mode selector (spot/futures)
  □ margin_mode selector (isolated/cross)
  □ can_short toggle
  □ leverage() callback
  □ Pair format auto-display (BTC/USDT:USDT for futures)
  □ liquidation_buffer number input (advanced)

  §7p — PROTECTIONS (in builder risk step):
  □ StoplossGuard — toggle + trade_limit, lookback_period, stop_duration, only_per_pair, only_per_side, required_profit
  □ MaxDrawdown — toggle + trade_limit, lookback_period, stop_duration, max_allowed_drawdown, calculation_mode (ratios/equity)
  □ LowProfitPairs — toggle + trade_limit, lookback_period, stop_duration, required_profit, only_per_pair
  □ CooldownPeriod — toggle + stop_duration, only_per_pair

  §14 — ADVANCED FEATURES:
  □ set_custom_data / get_custom_data — key/value editor
  □ Entry tags (enter_tag, 255 chars) — input per entry condition
  □ Exit tags (exit_tag, 100 chars) — input per exit condition
  □ Strategy inheritance — "Based on" dropdown
  □ dp.get_analyzed_dataframe() reference
  □ Hyperoptable parameters — mark any numeric input as "optimizable"

  OUTPUT: Strategy .py file generation
  □ "Generate Strategy" button → creates valid Python strategy file
  □ Code preview panel (readonly)
  □ Download / Deploy to bot

Checklist before marking DONE:
  □ ALL items from §2, §3, §4, §7p, §10, §14 present
  □ 19 callbacks as toggleable sections
  □ 6 stoploss types with correct params
  □ 4 protections with correct params
  □ Strategy file generation works
  □ FT parameter names exact (order_types not orderTypes)

→ Update FRONTEND_BUILD_STATUS.md: P4 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 5: Backtesting + Hyperopt Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: §5, §6, §15, §21, §22, §30

File: frontend/src/app/backtesting/page.tsx (existing: ~1373 lines)

  §5 — BACKTESTING FORM (all CLI args):
  □ --strategy dropdown (GET /api/v1/strategies)
  □ --strategy-list multi-select (comparison mode)
  □ --timeframe override dropdown
  □ --timerange date range picker (YYYYMMDD-YYYYMMDD)
  □ --timeframe-detail dropdown
  □ --export radio (trades/signals/none)
  □ --breakdown checkboxes (day/week/month)
  □ --enable-protections toggle
  □ --dry-run-wallet starting balance input
  □ --stake-amount input
  □ --max-open-trades input
  □ --fee override input
  □ --pairs override multi-select
  □ --freqaimodel dropdown (if FreqAI enabled)
  □ --cache dropdown (day/week/month/none)
  □ --eps / --enable-position-stacking toggle (NEW)
  □ --notes text input (NEW)
  □ --enable-dynamic-pairlist toggle (NEW, advanced)
  □ Run button → POST /api/v1/backtest
  □ Results display: total trades, win rate, profit, max DD, Sharpe, Sortino, Calmar
  □ Backtest history list from GET /api/v1/backtest/history

  §6 — HYPEROPT FORM:
  □ --epochs number input
  □ --spaces checkboxes (buy/sell/roi/stoploss/trailing/protection/trades/default)
  □ --loss dropdown (12 functions: ShortTradeDur, OnlyProfit, Sharpe, SharpeDaily,
    Sortino, SortinoDaily, Calmar, MaxDD, MaxDDRelative, MaxDDPerPair, ProfitDD, MultiMetric)
  □ --min-trades / --max-trades inputs
  □ --random-state seed input
  □ --jobs workers dropdown (-1/1/2/4)
  □ --effort search effort slider
  □ --early-stop number input
  □ --analyze-per-epoch toggle
  □ --disable-param-export toggle
  □ Parameter types display (IntParameter, DecimalParameter, RealParameter,
    CategoricalParameter, BooleanParameter)
  □ Run Hyperopt button

  §15 — ADVANCED HYPEROPT:
  □ Sampler dropdown (9 samplers: TPE, Random, CMA-ES, NSGA-II, QMC, MOTPE, NSGA-III, GP, AutoSampler)
  □ Custom loss function code editor
  □ Space overrides

  §21+22 — VALIDATION:
  □ "Validate Strategy" button → freqtrade lookahead-analysis
  □ Lookahead results table (has_bias, biased_entry_signals, biased_exit_signals, biased_indicators)
  □ "Check Recursion" button → freqtrade recursive-analysis
  □ Recursion results
  □ Bias source tooltips

  §30 — ADVANCED ANALYSIS:
  □ Analysis groups tabs (0-5)
  □ --enter-reason-list / --exit-reason-list tag filter dropdowns
  □ --indicator-list selector
  □ --rejected-signals toggle
  □ --analysis-to-csv "Export CSV" button (NEW)

Checklist before marking DONE:
  □ ALL §5 CLI args present (including 3 new ones: eps, notes, dynamic-pairlist)
  □ ALL 12 loss functions in dropdown
  □ ALL 9 samplers in dropdown
  □ Backtest run + poll + display results works
  □ Hyperopt form complete
  □ Lookahead + recursive analysis buttons
  □ Analysis groups 0-5 tabs
  □ CSV export button
  □ No mock data

→ Update FRONTEND_BUILD_STATUS.md: P5 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 6: Settings Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: §1, §7 (pairlists), §9, §11+13, §17, §28

File: frontend/src/app/settings/page.tsx (existing: ~2104 lines)

  §1 — CONFIG PARAMETERS (every category from FT-UI-MAP):
  □ Core Trading: max_open_trades, stake_currency, stake_amount, tradable_balance_ratio,
    available_capital, amend_last_stake_amount, last_stake_amount_min_ratio, amount_reserve_percent
  □ Timeframe & Display: timeframe, fiat_display_currency
  □ Dry Run: dry_run, dry_run_wallet, cancel_open_orders_on_exit, process_only_new_candles
  □ ROI & Stoploss: minimal_roi table, stoploss, trailing_stop (4 params)
  □ Exit Signal Control: use_exit_signal, exit_profit_only, exit_profit_offset,
    ignore_roi_if_entry_signal, ignore_buying_expired_candle_after
  □ Order Types: order_types{} (10 params), order_time_in_force{} (2 params)
  □ Unfilled Timeout: unfilledtimeout{} (4 params)
  □ Entry Pricing: entry_pricing{} (6 params)
  □ Exit Pricing: exit_pricing{} (4 params + custom_price_max_distance_ratio)
  □ Position Adjustment: position_adjustment_enable, max_entry_position_adjustment
  □ Fee & Funding: fee, futures_funding_rate
  □ Trading Mode: trading_mode, margin_mode, liquidation_buffer
  □ Bot Identity: bot_name, initial_state, force_entry_enable
  □ Database & Data: db_url + 9 other params
  □ Internal: process_throttle_secs, heartbeat_interval, sd_notify, logfile, log_config
  □ CoinGecko: api_key, is_demo

  §9 — EXCHANGE:
  □ exchange.name dropdown (Binance, Bybit, Gate.io, Hyperliquid, Bitget, OKX, Kraken)
  □ exchange.key / secret / password / uid (masked inputs)
  □ exchange.pair_whitelist editor
  □ exchange.pair_blacklist editor (add/remove)
  □ exchange.ccxt_config JSON editors (3 variants)
  □ exchange.enable_ws toggle
  □ exchange.markets_refresh_interval number input
  □ exchange.skip_open_order_update toggle (NEW)
  □ exchange.unknown_fee_rate number input (NEW)
  □ exchange.log_responses toggle (NEW, debug)
  □ exchange.only_from_ccxt toggle (NEW)

  §7 — PAIRLISTS:
  □ 6 handlers: Static, Volume, PercentChange, Producer, Remote, MarketCap
  □ 11 filters: Age, Delist, Offset, Performance, FullTrades, Precision, Price,
    Shuffle, Spread, RangeStability, Volatility
  □ Each handler/filter with correct parameters from FT-UI-MAP
  □ "Test Pairlist" button (freqtrade test-pairlist)

  §11 — TELEGRAM:
  □ telegram.enabled toggle
  □ telegram.token input (masked)
  □ telegram.chat_id input
  □ telegram.notification_settings — per-event toggles
  □ telegram.allow_custom_messages toggle
  □ telegram.balance_dust_level number input (NEW)
  □ telegram.reload toggle (NEW)
  □ telegram.topic_id text input (NEW)
  □ telegram.authorized_users list input (NEW)
  □ telegram.keyboard JSON editor (NEW, advanced)
  □ Per exit reason notifications (NEW)
  □ telegram.show_candle dropdown (NEW)
  □ telegram.protection_trigger toggles (NEW)

  §13 — WEBHOOK:
  □ webhook.enabled toggle
  □ webhook.url input
  □ webhook.entry/exit/status payload editors
  □ Payload variable reference
  □ webhook.format dropdown: form/json/raw (NEW)
  □ webhook.retries number input (NEW)
  □ webhook.retry_delay number input (NEW)
  □ webhook.timeout number input (NEW)
  □ webhook.strategy_msg payload editor (NEW)
  □ Discord section: discord.enabled, discord.webhook_url, per-event editors (NEW)

  §17 — PRODUCER/CONSUMER:
  □ external_message_consumer.enabled toggle
  □ producers[] list (name, host, port, ws_token, secure) — 5 fields per row (NEW: secure)
  □ wait_timeout, ping_timeout number inputs
  □ remove_entry_exit_signals toggle
  □ initial_candle_limit, message_size_limit number inputs

  §28 — ADVANCED:
  □ Multi-instance config
  □ DB type selector + connection string
  □ Logging config

  SAVE:
  □ Save button → writes config.json → POST /api/v1/reload_config
  □ Validation on save (highlight invalid fields)

Checklist before marking DONE:
  □ ALL §1 categories present with all params
  □ ALL §9 exchange params including 4 new ones
  □ ALL 6 pairlist handlers + 11 filters
  □ ALL §11 telegram params including 8 new ones
  □ ALL §13 webhook params including Discord section
  □ §17 producer list with secure field
  □ Save + reload works
  □ Form validation

→ Update FRONTEND_BUILD_STATUS.md: P6 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 7: FreqAI Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: §24, §25, §26

File: frontend/src/app/freqai/page.tsx (existing: ~895 lines)

  §24 — CORE CONFIG:
  □ freqai.enabled master toggle
  □ freqai.identifier text input
  □ freqai.purge_old_models number input
  □ freqai.train_period_days number input
  □ freqai.backtest_period_days number input
  □ freqai.live_retrain_hours number input
  □ freqai.expired_hours number input
  □ freqai.continual_learning toggle
  □ freqai.activate_tensorboard toggle
  □ freqai.wait_for_training_iteration_on_reload toggle (NEW)
  □ freqai.override_exchange_check toggle (NEW, danger)
  □ Model dropdown (LightGBM/XGBoost/PyTorch Regressor/Classifier)
  □ Feature parameters: include_timeframes, include_corr_pairlist,
    include_shifted_candles, indicator_periods_candles,
    label_period_candles, fit_live_predictions_candles
  □ data_split_parameters.test_size slider
  □ Feature engineering methods: expand_all, expand_basic, standard, set_targets
  □ Column naming conventions reference (%, %%, &, do_predict)

  §25 — REINFORCEMENT LEARNING:
  □ rl_config.train_cycles number input
  □ rl_config.add_state_info toggle
  □ rl_config.max_trade_duration_candles number input
  □ rl_config.max_training_drawdown_pct number input
  □ rl_config.model_type dropdown (PPO, A2C, DQN)
  □ rl_config.policy_type dropdown (MlpPolicy, CnnPolicy)
  □ rl_config.model_reward_parameters key-value editor
  □ rl_config.cpu_count number input (NEW)
  □ rl_config.net_arch array input (NEW)
  □ rl_config.randomize_starting_position toggle (NEW)
  □ rl_config.drop_ohlc_from_features toggle (NEW)
  □ rl_config.progress_bar toggle (NEW)
  □ RL Environments dropdown (Base3Action/Base4Action/Base5Action)

  §26 — DETAILED PARAMETERS:
  □ Model lifecycle: save_backtest_models, write_metrics_to_disk, data_kitchen_thread_count, reduce_df_footprint
  □ Feature processing: weight_factor slider, shuffle_after_split, buffer_train_data_candles,
    reverse_train_test_order, noise_standard_deviation
  □ Outlier detection: PCA toggle, SVM toggle + nu, DBSCAN toggle, DI_threshold, outlier_protection_percentage
  □ svm_params JSON editor (NEW)
  □ plot_feature_importances number input (NEW)
  □ PyTorch: learning_rate, n_epochs, batch_size, conv_width

Checklist before marking DONE:
  □ ALL §24 params including 2 new ones
  □ ALL §25 RL params including 5 new ones
  □ ALL §26 params including 2 new ones
  □ Correct config nesting (freqai.rl_config.*, freqai.feature_parameters.*)
  □ Save writes to config.json freqai{} section

→ Update FRONTEND_BUILD_STATUS.md: P7 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 8: Analytics Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: §19, §20, §29

File: frontend/src/app/analytics/page.tsx (existing: ~788 lines)

  §19 — PLOTTING:
  □ Candlestick chart (OHLCV from GET /api/v1/pair_candles)
  □ Indicator overlays from strategy plot_config
  □ plot_config.main_plot (EMA, SMA indicators on main chart)
  □ plot_config.subplots (RSI, MACD, Volume sub-charts)
  □ Trade markers (buy/sell/entry/exit)
  □ Profit chart (cumulative)

  §29 — ORDERFLOW:
  □ use_public_trades toggle
  □ Footprint chart (bid/ask volume per price level)
  □ Delta bar chart
  □ Imbalances highlighted
  □ Stacked imbalances marked
  □ Config: scale, imbalance_volume, imbalance_ratio, stacked_imbalance_range
  □ cache_size, max_candles number inputs (NEW)

  §20 — DATA ANALYSIS:
  □ Notebook-style view or Jupyter link

Checklist before marking DONE:
  □ Candlestick chart renders with real data
  □ Indicator overlays from plot_config
  □ Trade markers on chart
  □ Orderflow section with all config params
  □ 2 new orderflow params (cache_size, max_candles)

→ Update FRONTEND_BUILD_STATUS.md: P8 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 9: Data Management Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: §12, §18

File: frontend/src/app/data/page.tsx (existing: ~1129 lines)

  §12 — DATA DOWNLOAD FORM (ALL CLI args):
  □ --pairs multi-select
  □ --exchange dropdown
  □ --timeframes multi-select
  □ --timerange date range picker
  □ --trading-mode selector (spot/futures)
  □ --erase toggle "Delete existing first" (warning)
  □ --prepend toggle "Prepend to existing"
  □ --days number input (NEW — mutually exclusive with timerange)
  □ --new-pairs-days number input (NEW)
  □ --include-inactive-pairs toggle (NEW)
  □ --dl-trades toggle (NEW)
  □ --convert toggle (NEW)
  □ --candle-types multi-select (NEW: spot, futures, mark, index, premiumIndex, funding_rate)
  □ --data-format-ohlcv dropdown (NEW: json, jsongz, feather, parquet)
  □ --no-parallel-download toggle (NEW, advanced)
  □ Download button + progress indicator

  §18 — UTILITY COMMANDS:
  □ freqtrade list-strategies → strategy list view
  □ freqtrade list-exchanges → exchange info panel
  □ freqtrade list-timeframes → timeframe reference
  □ freqtrade list-pairs → available pairs browser
  □ freqtrade list-data → downloaded data inventory
  □ freqtrade convert-data → format converter (json↔feather↔parquet)
  □ freqtrade test-pairlist → test button + result display
  □ freqtrade show-trades → DB trade viewer
  □ freqtrade list-hyperoptloss → loss function reference
  □ freqtrade list-freqaimodels → FreqAI model reference
  □ freqtrade convert-trade-data → trade data format converter (NEW)
  □ freqtrade trades-to-ohlcv → "Generate OHLCV" button (NEW)
  □ freqtrade hyperopt-list → hyperopt results browser (NEW)
  □ freqtrade hyperopt-show → epoch detail view (NEW)

Checklist before marking DONE:
  □ ALL §12 args including 8 new ones
  □ ALL §18 commands including 4 new ones
  □ Days/timerange mutual exclusion
  □ Format converter works

→ Update FRONTEND_BUILD_STATUS.md: P9 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 10: Risk Page
───────────────────────────────────────────────────────────
FT-UI-MAP ref: §7 protections + Orchestrator additions

File: frontend/src/app/risk/page.tsx (existing: ~799 lines)

  FT PROTECTIONS (read-only display):
  □ Active protections per bot — from GET /api/v1/show_config → protections[]
  □ Pair locks table — GET /api/v1/locks
  □ "Lock Pair" button — POST /api/v1/locks (NEW: pair selector + duration + reason)
  □ "Unlock" button per lock row — DELETE /api/v1/locks/{id} (NEW)
  □ Stoploss events timeline — GET /api/v1/trades (filter exit_reason=stoploss)
  □ Max drawdown status — current DD vs protection limit

  ORCHESTRATOR ADDITIONS:
  □ Kill Switch: Soft Kill (per bot) / Hard Kill (all bots) — buttons
  □ Heartbeat monitor per bot — green/yellow/red status
  □ Cross-bot correlation matrix
  □ Global portfolio limits (total exposure across bots)
  □ Risk events log — GET /api/risk-events

Checklist before marking DONE:
  □ Lock/Unlock pair functionality (NEW)
  □ Kill switch prominent and working
  □ Heartbeat indicators
  □ Risk events table with soft-delete only
  □ All FT protection data displayed correctly

→ Update FRONTEND_BUILD_STATUS.md: P10 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 11: Login & Auth Flow
───────────────────────────────────────────────────────────

File: frontend/src/app/login/page.tsx (existing: ~206 lines)
File: frontend/src/lib/AuthGuard.tsx

  □ Login form (username + password)
  □ POST /api/v1/token/login → JWT token
  □ Token stored in localStorage
  □ AuthGuard redirects to /login if not authenticated
  □ Token refresh on 401 (POST /api/v1/token/refresh)
  □ Logout button (clear token, redirect to /login)
  □ Remember me toggle
  □ Error display on wrong credentials

Checklist before marking DONE:
  □ Login works end-to-end
  □ Protected routes redirect when not authenticated
  □ Token refresh handles expiry
  □ Logout clears state completely

→ Update FRONTEND_BUILD_STATUS.md: P11 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 12: API Client Completeness
───────────────────────────────────────────────────────────

File: frontend/src/lib/api.ts (existing: ~571 lines)

Cross-reference EVERY API call used by all pages and ensure a function exists:

  ORCHESTRATOR API:
  □ getBots / createBot / updateBot / deleteBot
  □ softKill / hardKill / hardKillAll
  □ getRiskEvents
  □ getStrategies / createStrategy / transitionStrategy / deleteStrategy
  □ portfolioBalance / portfolioProfit / portfolioTrades

  FT PASSTHROUGH API (per bot):
  □ botStatus / botTrades / botProfit / botDaily / botWeekly / botMonthly
  □ botPerformance / botEntries / botExits / botMixTags / botStats / botCount
  □ botConfig / botHealth / botSysinfo / botLogs / botVersion
  □ botWhitelist / botBlacklist / addBlacklist / removeBlacklist
  □ botLocks / createLock / deleteLock (NEW)
  □ botStart / botStop / botStopbuy / botPause / botReloadConfig
  □ botForceExit / botForceEnter / botDeleteTrade / botReloadTrade
  □ botCancelOpenOrder (NEW — DELETE /api/v1/trades/{id}/open-order)
  □ botPairCandles / botPairHistory / botPlotConfig
  □ botStrategies / botStrategy
  □ botAvailablePairs / botFreqAIModels
  □ botBacktest / botBacktestResults / botBacktestHistory
  □ botPing

  AI LAYER API (if AI validation is included):
  □ fetchAIValidations / fetchAIAccuracy / fetchAIAgreementRate / fetchAICost
  □ triggerAIValidation / fetchAIConfig / updateAIConfig
  □ submitHyperoptPreAnalyze / submitHyperoptPostAnalyze
  □ fetchHyperoptAnalyses / fetchHyperoptComparison

Remove any dead/unused API functions.

Checklist before marking DONE:
  □ Every page's API calls have a corresponding function
  □ No dead API functions (unused imports)
  □ All functions use correct HTTP method and path
  □ All functions handle errors correctly
  □ Types match between API response and TypeScript interfaces

→ Update FRONTEND_BUILD_STATUS.md: P12 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 13: Shared Components + Polish
───────────────────────────────────────────────────────────

  SHARED UI COMPONENTS:
  □ Card / CardHeader / CardBody — consistent styling
  □ Skeleton loaders for all data types (stat, table, chart, card)
  □ Toast notifications (success/error/warning)
  □ ErrorBoundary with fallback UI
  □ Form components: Input, Select, Toggle, MultiSelect, DateRangePicker, JsonEditor
  □ Table component with sorting, pagination, filtering
  □ Modal/Dialog for confirmations
  □ Status badges (lifecycle, bot status, trade direction)

  POLISH:
  □ Responsive layout (sidebar collapses on mobile)
  □ Dark theme consistent (all pages use same color tokens)
  □ Loading states on ALL data sections
  □ Error states on ALL data sections
  □ Empty states ("No data" messages)
  □ Keyboard navigation (Tab, Enter, Escape)
  □ Tooltips on FT parameter names (explain what each does)

Checklist before marking DONE:
  □ All shared components exist and are used consistently
  □ No inline styles (all Tailwind)
  □ Responsive on desktop + tablet
  □ Loading/error/empty states everywhere

→ Update FRONTEND_BUILD_STATUS.md: P13 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 14: Build + Lint + Integration
───────────────────────────────────────────────────────────

Run and fix ALL errors:
  □ cd frontend && npx next build — MUST succeed with 0 errors
  □ cd frontend && npx next lint — MUST succeed with 0 errors
  □ Verify all imports resolve (no missing modules)
  □ Verify all TypeScript types compile
  □ Test auth flow: login → navigate all pages → logout
  □ Test against live orchestrator API (if available)
  □ Verify kill switch works from every page
  □ Verify FT field names correct everywhere (search for "entry_price", "exit_price" — must find 0)

Final audit:
  □ grep -r "entry_price\|exit_price\|net_pnl\|position_size\|entry_time\|exit_time\|entry_signal\|exit_signal\|unrealized_pnl\|entry_fee\|exit_fee" frontend/src/ — MUST return 0 results
  □ grep -r "Math.random\|mock\|TODO\|FIXME\|HACK" frontend/src/ — review all hits
  □ grep -r "console.log" frontend/src/ — remove from production

Checklist before marking DONE:
  □ Build passes with 0 errors
  □ Lint passes with 0 errors
  □ No forbidden FT field names anywhere
  □ No mock data anywhere
  □ No console.log in production

→ Update FRONTEND_BUILD_STATUS.md: P14 = ✅ DONE

═══════════════════════════════════════════════════════════
AFTER ALL PHASES COMPLETE:
═══════════════════════════════════════════════════════════

1. Run: cd frontend && npx next build
2. Run: cd frontend && npx next lint
3. Run: grep for forbidden field names (must be 0)
4. Update FRONTEND_BUILD_STATUS.md: all phases ✅ DONE
5. Wait for audit agent to finish all audits
6. Commit all changes

═══════════════════════════════════════════════════════════
RULES (NON-NEGOTIABLE):
═══════════════════════════════════════════════════════════

1. FT-UI-MAP.html IS LAW — if it's in the map, it must be in the UI.
   If it's NOT in the map, DON'T add it.
2. FT FIELD NAMES — use open_rate, close_rate, close_profit_abs,
   stake_amount, is_short. NEVER entry_price, exit_price, etc.
3. NO MOCK DATA — every widget fetches from real API. No Math.random().
4. NO FT MODIFICATIONS — frontend reads from FT via orchestrator passthrough.
5. STATUS FILE — update FRONTEND_BUILD_STATUS.md after EVERY phase.
6. EXISTING CODE — read before rewriting. Preserve working code.
   Add missing elements, don't recreate from scratch.
7. USE EXACT FT PARAMETER NAMES — in form labels, config keys, API calls.
   "max_open_trades" not "maxOpenTrades". "stake_amount" not "stakeAmount".
8. ALL NEW ELEMENTS — from the FT Feature Audit (53 gaps). These are marked
   (NEW) throughout this prompt. They MUST be present.

Start by reading the mandatory files, then create FRONTEND_BUILD_STATUS.md,
then begin Phase 1.
```

---

## AGENT B: AUDITOR

Copy-paste this prompt into a SECOND Claude Code session (runs in parallel):

```
You are the AUDIT AGENT for the freqtrade-ui frontend build.

A parallel builder agent is completing the frontend page by page.
Your job: audit each page AS SOON as it's marked DONE,
verify every UI element against FT-UI-MAP.html, and fix bugs immediately.

═══════════════════════════════════════════════════════════
MANDATORY: Read these files FIRST:
═══════════════════════════════════════════════════════════

1. CLAUDE.md — project rules, field names, anti-hallucination protocol
2. docs/FT-UI-MAP.html — THE BLUEPRINT (every FT feature → exact UI element)
   This is what you audit against. If it's in the map, it MUST be in the code.
3. docs/FT_FEATURE_AUDIT.md — the 53 gaps audit (all should now be in FT-UI-MAP)
4. FRONTEND_BUILD_STATUS.md — the builder's progress (poll this file)
5. frontend/src/types/index.ts — TypeScript types (verify FT field names)
6. frontend/src/lib/api.ts — API client (verify all functions exist)

═══════════════════════════════════════════════════════════
YOUR WORKFLOW:
═══════════════════════════════════════════════════════════

1. Read FRONTEND_BUILD_STATUS.md
2. Find the FIRST phase marked ✅ DONE that is NOT yet ✅ AUDITED
3. Audit that phase (deep code review — see checklist below)
4. Fix ALL issues you find (edit the code directly)
5. Update FRONTEND_BUILD_STATUS.md: phase → ✅ AUDITED, issues count, fixed count
6. Go back to step 1
7. If no phases are ready for audit, WAIT 30 seconds and check again
8. When ALL 14 phases are ✅ AUDITED, do a final cross-phase integration audit

═══════════════════════════════════════════════════════════
AUDIT CHECKLIST (apply to EVERY phase):
═══════════════════════════════════════════════════════════

▸ FT-UI-MAP COMPLIANCE (PRIMARY CHECK)
  Open docs/FT-UI-MAP.html. Find the section for this page.
  For EVERY row in the FT-UI-MAP table:
  - Is there a corresponding UI element in the code?
  - Does the UI element match the description?
  - Is the FT parameter name exact (not renamed, not camelCased)?
  - Is the data source correct (right API endpoint)?
  COUNT: [elements in map] vs [elements in code]. Diff = bugs.

▸ FT FIELD NAMES (CRITICAL — grep EVERY file in the phase)
  Run these searches and fix ANY hits:
  - "entry_price" → should be "open_rate"
  - "exit_price" → should be "close_rate"
  - "net_pnl" → should be "close_profit_abs"
  - "position_size" → should be "stake_amount"
  - "entry_time" → should be "open_date"
  - "exit_time" → should be "close_date"
  - "entry_signal" → should be "enter_tag"
  - "exit_signal" → should be "exit_reason"
  - "unrealized_pnl" → should be "current_profit"
  - "entry_fee" / "exit_fee" → should be "fee_open" / "fee_close"
  - "direction" (as field name) → should be "is_short"

▸ NEW ELEMENTS (from 53-gap audit)
  The audit found 53 missing features that were added to FT-UI-MAP.html.
  These are marked (NEW) in the builder prompt. Verify each is implemented:
  §1: skip_open_order_update, unknown_fee_rate, log_responses, only_from_ccxt
  §2: version() method
  §5: --eps, --notes, --enable-dynamic-pairlist
  §6: MaxDrawDownPerPairHyperOptLoss in dropdown
  §7: calculation_mode for MaxDrawdown
  §8: cancel-open-order, POST/DELETE locks
  §11: balance_dust_level, reload, topic_id, authorized_users, keyboard,
       per exit reason notifications, show_candle, protection_trigger
  §12: --days, --new-pairs-days, --include-inactive-pairs, --dl-trades,
       --convert, --candle-types, --data-format-ohlcv, --no-parallel-download
  §13: webhook.format, retries, retry_delay, timeout, strategy_msg, Discord section
  §15: 9 samplers (was 6)
  §17: producers[].secure
  §18: convert-trade-data, trades-to-ohlcv, hyperopt-list, hyperopt-show
  §24: wait_for_training_iteration_on_reload, override_exchange_check
  §25: cpu_count, net_arch, randomize_starting_position, drop_ohlc_from_features, progress_bar
  §26: svm_params, plot_feature_importances
  §29: cache_size, max_candles
  §30: --analysis-to-csv

▸ API WIRING
  For every UI element that displays data or performs an action:
  - Is there an API call to the correct endpoint?
  - Does the API function exist in api.ts?
  - Is the response type correct?
  - Is error handling present?

▸ CODE QUALITY
  - TypeScript types used (no `any` types)
  - No bare catch (always handle specific errors)
  - Loading states on all data-fetching components
  - Error states on all data-fetching components
  - Empty states ("No data" messages)
  - No console.log in production code
  - No mock data, no Math.random()
  - Proper React key props (not key={index})
  - useEffect cleanup (no memory leaks)
  - useCallback/useMemo where needed (avoid unnecessary re-renders)

▸ STYLING & UX
  - Consistent with other pages (same Card, same colors, same patterns)
  - FT parameter names displayed correctly (show human label + FT param name)
  - Responsive layout (doesn't break on smaller screens)
  - Tooltips on FT parameters (explain what they do)

═══════════════════════════════════════════════════════════
HOW TO FIX ISSUES:
═══════════════════════════════════════════════════════════

When you find a bug:
1. Log it: note file, line, what's wrong, what it should be
2. Fix it: edit the file directly
3. Verify: re-read the file to confirm the fix is correct
4. If the fix affects another phase's code, note it for re-audit

NEVER just report issues — FIX THEM.

═══════════════════════════════════════════════════════════
PAGE-SPECIFIC AUDIT GUIDES:
═══════════════════════════════════════════════════════════

P2 (Dashboard): Count all 20+ data displays and 10 action buttons.
  Missing even ONE = fail. Cancel open order button is NEW — check it.

P4 (Builder): Count all 19 callbacks. Count all 6 stoploss types.
  Count all 4 protections. Missing ANY = fail.

P5 (Backtesting): Count all 12 loss functions in dropdown. Count all 9 samplers.
  Count all CLI args (should be 18+ for backtesting, 10+ for hyperopt).
  All 3 new backtesting args (eps, notes, dynamic-pairlist) MUST be present.

P6 (Settings): This is the BIGGEST page. Verify EVERY config category from §1.
  8 new telegram params, 5 new webhook params, 4 new exchange params.
  Discord section MUST exist.

P7 (FreqAI): 2 new §24 params, 5 new §25 RL params, 2 new §26 params.
  Total 9 new FreqAI params MUST be present.

P9 (Data): 8 new §12 download args, 4 new §18 utility commands.
  Total 12 new data management elements MUST be present.

P10 (Risk): Lock/Unlock pair buttons are NEW — verify POST/DELETE /locks wired.

═══════════════════════════════════════════════════════════
CROSS-PHASE INTEGRATION AUDIT (after all 14 phases done):
═══════════════════════════════════════════════════════════

After all individual phases are audited, do one final pass:

1. BUILD TEST: cd frontend && npx next build — MUST pass 0 errors.

2. LINT TEST: cd frontend && npx next lint — MUST pass 0 errors.

3. FORBIDDEN NAMES GREP:
   grep -r "entry_price\|exit_price\|net_pnl\|position_size\|entry_time\|exit_time\|entry_signal\|exit_signal\|unrealized_pnl\|entry_fee\|exit_fee" frontend/src/
   MUST return 0 results.

4. MOCK DATA GREP:
   grep -r "Math.random\|mock\|MOCK\|faker\|placeholder" frontend/src/
   Review all hits — none should be in data-displaying code.

5. CONSOLE.LOG GREP:
   grep -r "console.log" frontend/src/
   Remove all from production code.

6. IMPORT CHAIN: verify no circular imports between pages/components/lib.

7. TYPE SAFETY: verify api.ts return types match what pages expect.

8. NAVIGATION: verify all 10 sidebar items link to correct routes.

9. KILL SWITCH: verify kill switch button accessible from EVERY page (in header).

10. FT-UI-MAP ELEMENT COUNT:
    Count total UI elements in FT-UI-MAP.html (all pages combined).
    Count total implemented UI elements in code.
    Diff = remaining gaps. Target = 0.

Update FRONTEND_BUILD_STATUS.md with:
  "## Final Integration Audit: ✅ COMPLETE — X issues found, X fixed"

═══════════════════════════════════════════════════════════
RULES:
═══════════════════════════════════════════════════════════

1. FT-UI-MAP.html is the ONLY source of truth — if code doesn't match map, code is wrong
2. NEVER wait for builder to finish all phases — audit AS THEY COMPLETE
3. Fix immediately — don't create TODO lists, fix the actual code
4. Update status file after every audit
5. Be thorough — read every line of every file in the phase
6. Be brutal — the builder will make mistakes, your job is to catch ALL of them
7. Don't duplicate the builder's work — only audit, fix, and verify
8. 53 NEW ELEMENTS from the feature audit are your special focus — these are most
   likely to be missing since they were just added to the map

Start by reading the mandatory files, then begin polling FRONTEND_BUILD_STATUS.md.
If no phases are DONE yet, wait and re-check.
```

---

## RUNNING BOTH AGENTS

### Terminal 1 (Builder):
```bash
cd /path/to/freqtrade-ui
# Paste Agent A prompt
# Builder starts working through phases
```

### Terminal 2 (Auditor):
```bash
cd /path/to/freqtrade-ui
# Paste Agent B prompt
# Auditor starts polling FRONTEND_BUILD_STATUS.md
# As builder completes phases, auditor reviews them
```

### Timeline:
```
Builder:  [P1]──[P2]──[P3]──[P4]──[P5]──[P6]──[P7]──[P8]──[P9]──[P10]──[P11]──[P12]──[P13]──[P14]
Auditor:     [audit P1]──[audit P2]──[audit P3]──...──[audit P14]──[INTEGRATION AUDIT]
              ↑ starts as soon as P1 is DONE
```

The key: Builder never has to wait for Auditor. Auditor never has to wait for Builder
(it just checks the next DONE phase). They work completely independently via the
shared status file.

### Expected scope per phase:
- P1 (Foundation): ~4 files, ~30 min
- P2 (Dashboard): ~1 file, ~45 min (already large, mostly adding missing elements)
- P3 (Strategies): ~1 file, ~15 min
- P4 (Builder): ~1 file, ~60 min (largest: 19 callbacks, 6 SL types, 4 protections)
- P5 (Backtesting): ~1 file, ~45 min (hyperopt + analysis)
- P6 (Settings): ~1 file, ~60 min (most config params: §1,7,9,11,13,17,28)
- P7 (FreqAI): ~1 file, ~30 min
- P8 (Analytics): ~1 file, ~30 min
- P9 (Data): ~1 file, ~30 min
- P10 (Risk): ~1 file, ~20 min
- P11 (Login): ~2 files, ~15 min
- P12 (API): ~1 file, ~30 min
- P13 (Components): ~5 files, ~30 min
- P14 (Build): ~0 files, ~15 min (just testing)

Total estimated: ~7-8 hours builder, ~5-6 hours auditor (runs in parallel)
