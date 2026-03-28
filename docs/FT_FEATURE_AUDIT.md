# FreqTrade Feature Audit — Full Cross-Reference

**Date:** 2026-03-28
**Source:** FreqTrade official docs (https://www.freqtrade.io/en/stable/)
**Compared against:** FT-UI-MAP.html + FREQTRADE_REFERENCE.md

**STATUS: ALL 53 GAPS RESOLVED** — Applied to FT-UI-MAP.html and FREQTRADE_REFERENCE.md on 2026-03-28.

---

## METHODOLOGY

Every page from FT official docs was fetched and compared against our FT-UI-MAP.html.
For each feature: is it mapped to a UI page? Are all parameters present? Are API endpoints complete?

**Legend:**
- OK = fully integrated, all parameters mapped
- PARTIAL = page exists but some parameters missing
- MISSING = not mapped at all
- N/A = intentionally skipped (with justification)

---

## 1. CONFIGURATION (§1) → Settings Page

**Status: OK — COMPLETE**

Official docs list ~95 config parameters across 15 categories.
Our FT-UI-MAP.html §1 maps ALL 15 categories with exact parameter counts:

| Category | FT Params | Our Map | Status |
|----------|-----------|---------|--------|
| Core Trading | 8 | 8 | OK |
| Timeframe & Display | 2 | 2 | OK |
| Dry Run | 4 | 4 | OK |
| ROI & Stoploss | 6 | 5+ROI table | OK |
| Exit Signal Control | 5 | 5 | OK |
| Order Types | 12 | 12 | OK |
| Unfilled Timeout | 4 | 4 | OK |
| Entry Pricing | 6 | 6 | OK |
| Exit Pricing | 5 | 5 | OK |
| Position Adjustment (DCA) | 2 | 2 | OK |
| Fee & Funding | 2 | 2 | OK |
| Trading Mode | 3 | 3 | OK |
| Bot Identity | 3 | 3 | OK |
| Database & Data | 10 | 10 | OK |
| Internal | 5 | 5 | OK |
| CoinGecko | 2 | 2 | OK |

**GAPS FOUND: 3 MINOR**

1. `exchange.skip_open_order_update` — in FT docs, NOT in our §1 map
   → Add to Settings > Exchange section
   → Type: bool, default: false

2. `exchange.unknown_fee_rate` — in FT docs, NOT in our map
   → Add to Settings > Exchange section
   → Type: float, default: None

3. `exchange.log_responses` — in FT docs, NOT in our map
   → Add to Settings > Exchange section (debug only)
   → Type: bool, default: false

4. `exchange.only_from_ccxt` — in FT docs, NOT in our map
   → Add to Settings > Exchange section
   → Type: bool, default: false
   → Disables data.binance.vision fallback

---

## 2. STRATEGY INTERFACE (§2) → Builder Page

**Status: OK — COMPLETE**

All core methods and properties mapped:
- populate_indicators() OK
- populate_entry_trend() OK
- populate_exit_trend() OK
- informative_pairs() OK
- timeframe, can_short, startup_candle_count OK
- minimal_roi, stoploss, trailing_stop OK
- order_types, order_time_in_force OK
- plot_config OK
- DataProvider methods reference OK
- Wallet methods reference OK
- lock_pair/unlock_pair/is_pair_locked OK

**GAPS FOUND: 2 MINOR**

1. `version()` method — strategy versioning method not in Builder
   → Add as optional text input "Strategy Version" in Builder metadata
   → Returns string, shown in list-strategies output

2. Strategy embedding (BASE64) — not in Builder
   → This is an edge case; can skip (N/A) or add as advanced export option

---

## 3. STRATEGY CALLBACKS (§3) → Builder Page

**Status: OK — COMPLETE (19 callbacks)**

Our FT-UI-MAP lists 19 callbacks. Let me verify against official docs:

| # | Callback | In Map? | Status |
|---|----------|---------|--------|
| 1 | bot_start() | Yes | OK |
| 2 | bot_loop_start() | Yes | OK |
| 3 | custom_stake_amount() | Yes | OK |
| 4 | custom_exit() | Yes | OK |
| 5 | custom_stoploss() | Yes | OK |
| 6 | custom_roi() | Yes | OK |
| 7 | custom_entry_price() | Yes | OK |
| 8 | custom_exit_price() | Yes | OK |
| 9 | check_entry_timeout() | Yes | OK |
| 10 | check_exit_timeout() | Yes | OK |
| 11 | confirm_trade_entry() | Yes | OK |
| 12 | confirm_trade_exit() | Yes | OK |
| 13 | adjust_trade_position() | Yes | OK |
| 14 | adjust_order_price() | Yes | OK |
| 15 | leverage() | Yes | OK |
| 16 | order_filled() | Yes | OK |
| 17 | adjust_entry_price() | Yes | OK |
| 18 | adjust_exit_price() | Yes | OK |
| 19 | plot_annotations() | Yes | OK |

**GAPS FOUND: 0**

Note: FT docs now show `adjust_entry_price` and `adjust_exit_price` as subsets of
`adjust_order_price`. Our map has all three — this is correct as FT supports both
the combined and split versions.

---

## 4. STOPLOSS (§4) → Builder Page

**Status: OK — COMPLETE (6 types)**

All 6 stoploss types mapped with correct parameters:
1. Static OK
2. Trailing OK
3. Trailing + Positive OK
4. Trailing + Offset OK
5. Custom (callback) OK
6. On Exchange OK (all 4 sub-params: limit_ratio, interval, price_type, emergency_exit)

**GAPS FOUND: 0**

---

## 5. BACKTESTING (§5) → Backtesting Page

**Status: PARTIAL — 2 MISSING CLI ARGS**

| CLI Arg | In Map? | Status |
|---------|---------|--------|
| --strategy | Yes | OK |
| --strategy-list | Yes | OK |
| --timeframe | Yes | OK |
| --timerange | Yes | OK |
| --timeframe-detail | Yes | OK |
| --export | Yes | OK |
| --breakdown | Yes | OK |
| --enable-protections | Yes | OK |
| --dry-run-wallet | Yes | OK |
| --stake-amount | Yes | OK |
| --max-open-trades | Yes | OK |
| --fee | Yes | OK |
| --pairs | Yes | OK |
| --freqaimodel | Yes | OK |
| --cache | Yes | OK |
| --eps (position stacking) | **NO** | MISSING |
| --notes | **NO** | MISSING |
| --enable-dynamic-pairlist | **NO** | MISSING |

**GAPS FOUND: 3**

1. `--eps / --enable-position-stacking` — Allow multiple positions per pair
   → Add toggle to Backtesting form
   → bool, default false

2. `--notes` — Attach text annotations to backtest results
   → Add text input "Notes" to Backtesting form
   → string, optional

3. `--enable-dynamic-pairlist` — Refresh pair selections per candle
   → Add toggle to Backtesting form (advanced section)
   → bool, default false

---

## 6. HYPEROPT (§6) → Backtesting Page

**Status: PARTIAL — 2 ISSUES**

Loss functions check:
| # | Loss Function | In Map? |
|---|--------------|---------|
| 1 | ShortTradeDurHyperOptLoss | Yes |
| 2 | OnlyProfitHyperOptLoss | Yes |
| 3 | SharpeHyperOptLoss | Yes |
| 4 | SharpeHyperOptLossDaily | Yes |
| 5 | SortinoHyperOptLoss | Yes |
| 6 | SortinoHyperOptLossDaily | Yes |
| 7 | MaxDrawDownHyperOptLoss | Yes |
| 8 | MaxDrawDownRelativeHyperOptLoss | Yes |
| 9 | CalmarHyperOptLoss | Yes |
| 10 | ProfitDrawDownHyperOptLoss | Yes |
| 11 | MultiMetricHyperOptLoss | Yes |
| 12 | MaxDrawDownPerPairHyperOptLoss | **NO** |

Our map says "11 loss functions" but FT now has **12** (MaxDrawDownPerPairHyperOptLoss added).

**GAPS FOUND: 2**

1. `MaxDrawDownPerPairHyperOptLoss` — Missing from our loss function list
   → Add to Backtesting > Hyperopt > Loss function dropdown
   → Optimizes worst pair performance

2. `--effort` parameter — in our map but NOT in FT official current docs
   → This might be a newer addition; verify in FT changelog
   → Keep in map, mark as "if supported by installed FT version"

Samplers check: Our map lists 6 (TPE, NSGA-II, GP, CMA-ES, Random, QMC).
FT docs also mention MOTPE and NSGAIIISampler. However FT defaults to NSGAIIISampler now.

3. Sampler list needs update:
   - Current: TPE, NSGA-II, GP, CMA-ES, Random, QMC
   - FT now has: TPE, Random, CMA-ES, NSGA-II, QMC, MOTPE, NSGA-III, GP + AutoSampler via optunahub
   → Update dropdown to include all available samplers

---

## 7. PLUGINS — PAIRLISTS + PROTECTIONS (§7) → Settings + Builder

**Status: PARTIAL — 1 MISSING HANDLER**

Pairlist handlers:
| Handler | In Map? | Status |
|---------|---------|--------|
| StaticPairList | Yes | OK |
| VolumePairList | Yes | OK |
| PercentChangePairList | Yes | OK |
| ProducerPairList | Yes | OK |
| RemotePairList | Yes | OK |
| MarketCapPairList | Yes | OK |

Pairlist filters:
| Filter | In Map? | Status |
|--------|---------|--------|
| AgeFilter | Yes | OK |
| DelistFilter | Yes | OK |
| OffsetFilter | Yes | OK |
| PerformanceFilter | Yes | OK |
| FullTradesFilter | Yes | OK |
| PrecisionFilter | Yes | OK |
| PriceFilter | Yes | OK |
| ShuffleFilter | Yes | OK |
| SpreadFilter | Yes | OK |
| RangeStabilityFilter | Yes | OK |
| VolatilityFilter | Yes | OK |

Protections:
| Protection | In Map? | Status |
|------------|---------|--------|
| StoplossGuard | Yes | OK |
| MaxDrawdown | Yes | OK (includes calculation_mode param) |
| LowProfitPairs | Yes | OK |
| CooldownPeriod | Yes | OK |

**GAPS FOUND: 1 MINOR**

1. MaxDrawdown protection `calculation_mode` parameter (ratios/equity)
   → Verify this is in the Builder form. FT docs show it as a parameter.
   → Our map shows it in §7p but doesn't explicitly list calculation_mode.
   → Add dropdown: "ratios" (default) or "equity"

---

## 8. REST API ENDPOINTS (§8) → All Pages (plumbing)

**Status: PARTIAL — 3 ENDPOINTS NOT MAPPED**

| Endpoint | In Map? | Status |
|----------|---------|--------|
| GET /ping | Yes (heartbeat) | OK |
| POST /start | Yes | OK |
| POST /pause | Yes | OK |
| POST /stop | Yes | OK |
| POST /stopbuy | Yes | OK |
| POST /reload_config | Yes | OK |
| GET /trades | Yes | OK |
| GET /trade/{id} | Yes | OK |
| DELETE /trades/{id} | Yes | OK |
| DELETE /trades/{id}/open-order | **NO** | MISSING |
| POST /trades/{id}/reload | Yes | OK |
| GET /show_config | Yes | OK |
| GET /logs | Yes | OK |
| GET /status | Yes | OK |
| GET /count | Yes | OK |
| GET /entries | Yes | OK |
| GET /exits | Yes | OK |
| GET /mix_tags | Yes | OK |
| GET /locks | Yes | OK |
| POST /locks | **NOT EXPLICIT** | PARTIAL |
| DELETE /locks/{id} | **NOT EXPLICIT** | PARTIAL |
| GET /profit | Yes | OK |
| POST /forceexit | Yes | OK |
| POST /forceenter | Yes | OK |
| GET /performance | Yes | OK |
| GET /balance | Yes | OK |
| GET /daily | Yes | OK |
| GET /weekly | Yes | OK |
| GET /monthly | Yes | OK |
| GET /stats | Yes | OK |
| GET /whitelist | Yes | OK |
| GET /blacklist | Yes | OK |
| POST /blacklist | Yes | OK |
| DELETE /blacklist | Yes | OK |
| GET /pair_candles | Yes | OK |
| POST /pair_candles | **NO** | MISSING (POST variant with column filter) |
| GET /pair_history | Yes | OK |
| POST /pair_history | **NO** | MISSING (POST variant with column filter) |
| GET /plot_config | Yes | OK |
| GET /strategies | Yes | OK |
| GET /strategy/{name} | Yes | OK |
| GET /available_pairs | Yes | OK |
| GET /version | Yes | OK |
| GET /sysinfo | Yes | OK |
| GET /health | Yes | OK |
| POST /token/login | Implicit | OK (used by FTClient) |
| POST /token/refresh | Implicit | OK (used by FTClient) |
| WS /message/ws | Implicit | OK (used by dashboard) |

**GAPS FOUND: 4**

1. `DELETE /trades/{id}/open-order` — Cancel pending orders for specific trade
   → Add to Dashboard > Open Positions table as "Cancel Order" button per row
   → Important for stuck orders

2. `POST /pair_candles` — Filtered candle data (reduces payload)
   → Can use GET version; POST is optimization. LOW PRIORITY.

3. `POST /pair_history` — Filtered history data
   → Same as above. LOW PRIORITY.

4. `POST /locks` — Create pair lock manually
   → Add to Risk page: "Lock Pair" button with pair selector + duration + reason
   → Also add `DELETE /locks/{id}` as "Unlock" button per lock row

---

## 9. EXCHANGES (§9) → Settings Page

**Status: OK — COMPLETE**

All exchange config parameters mapped:
- exchange.name, key, secret, password, uid OK
- pair_whitelist, pair_blacklist OK
- ccxt_config variants OK
- enable_ws, markets_refresh_interval OK

**GAPS FOUND: 0** (minor gaps captured in §1 section above)

---

## 10. LEVERAGE & FUTURES (§10) → Builder Page

**Status: OK — COMPLETE**

- trading_mode OK
- margin_mode OK
- can_short OK
- leverage() callback OK
- liquidation_buffer OK
- Pair format (BTC/USDT:USDT) OK
- futures_funding_rate OK (in §1 settings)

**GAPS FOUND: 0**

---

## 11. TELEGRAM (§11) → Settings Page

**Status: PARTIAL — MISSING PARAMS**

| Feature | In Map? | Status |
|---------|---------|--------|
| telegram.enabled | Yes | OK |
| telegram.token | Yes | OK |
| telegram.chat_id | Yes | OK |
| telegram.notification_settings | Yes | OK |
| telegram.allow_custom_messages | Yes | OK |
| telegram.balance_dust_level | **NO** | MISSING |
| telegram.reload | **NO** | MISSING |
| telegram.topic_id | **NO** | MISSING |
| telegram.authorized_users | **NO** | MISSING |
| telegram.keyboard (custom) | **NO** | MISSING |
| notification per exit reason | **NO** | MISSING |
| show_candle setting | **NO** | MISSING |
| protection_trigger notifications | **NO** | MISSING |

**GAPS FOUND: 7**

1. `telegram.balance_dust_level` — Min balance to display
   → Add to Settings > Telegram section
2. `telegram.reload` — Allow reload buttons in Telegram
   → Add toggle
3. `telegram.topic_id` — Specific group topic
   → Add text input
4. `telegram.authorized_users` — List of allowed user IDs
   → Add list input
5. `telegram.keyboard` — Custom keyboard layout
   → Add JSON editor (advanced)
6. Per exit reason notification settings (exit_roi, exit_stoploss, etc.)
   → Extend notification_settings UI
7. `show_candle` setting ("ohlc" or "off")
   → Add dropdown
8. `protection_trigger` / `protection_trigger_global` notifications
   → Add toggles

---

## 12. DATA DOWNLOAD (§12) → Data Management Page

**Status: PARTIAL — 4 MISSING ARGS**

| CLI Arg | In Map? | Status |
|---------|---------|--------|
| --pairs | Yes | OK |
| --exchange | Yes | OK |
| --timeframes | Yes | OK |
| --timerange | Yes | OK |
| --trading-mode | Yes | OK |
| --erase | Yes | OK |
| --prepend | Yes | OK |
| --days | **NO** | MISSING |
| --new-pairs-days | **NO** | MISSING |
| --include-inactive-pairs | **NO** | MISSING |
| --dl-trades | **NO** | MISSING |
| --convert | **NO** | MISSING |
| --candle-types | **NO** | MISSING |
| --data-format-ohlcv | **NO** | MISSING |
| --no-parallel-download | **NO** | MISSING |

**GAPS FOUND: 8**

1. `--days` — Download N days of data (alternative to --timerange)
   → Add number input "Days" (mutually exclusive with timerange)
2. `--new-pairs-days` — Different day count for new pairs
   → Add number input
3. `--include-inactive-pairs` — Include delisted pairs
   → Add toggle
4. `--dl-trades` — Download trades instead of OHLCV
   → Add toggle "Download trades data"
5. `--convert` — Convert after download
   → Add toggle
6. `--candle-types` — spot, futures, mark, index, premiumIndex, funding_rate
   → Add multi-select
7. `--data-format-ohlcv` — Format selection
   → Add dropdown: json, jsongz, feather, parquet
8. `--no-parallel-download` — Disable parallel
   → Add toggle (advanced)

---

## 13. WEBHOOK (§13) → Settings Page

**Status: PARTIAL — MISSING PARAMS**

| Feature | In Map? | Status |
|---------|---------|--------|
| webhook.enabled | Yes | OK |
| webhook.url | Yes | OK |
| webhook.entry/exit/status events | Yes | OK |
| Template variables | Yes | OK |
| webhook.format | **NO** | MISSING |
| webhook.retries | **NO** | MISSING |
| webhook.retry_delay | **NO** | MISSING |
| webhook.timeout | **NO** | MISSING |
| webhook.strategy_msg | **NO** | MISSING |
| Discord config | **NO** | MISSING |

**GAPS FOUND: 5**

1. `webhook.format` — "form", "json", or "raw"
   → Add dropdown
2. `webhook.retries` — Retry count (default 0)
   → Add number input
3. `webhook.retry_delay` — Retry delay seconds
   → Add number input
4. `webhook.timeout` — Request timeout seconds
   → Add number input
5. Discord integration (discord.enabled, discord.webhook_url, etc.)
   → Add "Discord" sub-section in Settings > Notifications

---

## 14. ADVANCED STRATEGY (§14) → Builder Page

**Status: OK — COMPLETE**

- Custom data storage (set/get_custom_data) OK
- Enter/exit tags OK
- Strategy inheritance OK
- dp.get_analyzed_dataframe() OK
- Hyperoptable parameters OK

**GAPS FOUND: 0**

---

## 15. ADVANCED HYPEROPT (§15) → Backtesting Page

**Status: OK — MOSTLY COMPLETE**

- Custom loss functions OK
- Space overrides OK
- Optuna samplers OK (need update — see §6 gaps)

**Additional gap:**
1. `generate_estimator()` method for selecting optimization algorithm
   → Document in Builder as advanced hyperopt feature
2. Dynamic parameters in `bot_start()` — already covered by callbacks

---

## 16. TRADE OBJECT (§16) → All Pages

**Status: PARTIAL — 8 FIELDS NOT IN REFERENCE**

Compared FT docs trade object fields against our FREQTRADE_REFERENCE.md §16:

Missing fields:
1. `safe_base_currency` / `safe_quote_currency` — compatibility wrappers
2. `safe_close_rate` — close_rate with fallback
3. `max_stake_amount` — sum of all filled entries
4. `date_last_filled_utc` — last order fill timestamp
5. `date_entry_fill_utc` — first entry fill timestamp
6. `fully_canceled_entry_order_count` — canceled entry count
7. `canceled_exit_order_count` — canceled exit count
8. `has_open_position` / `has_open_orders` / `has_open_sl_orders` — state booleans
9. `open_orders` / `open_sl_orders` — order lists
10. `stoploss_or_liquidation` — more restrictive of SL or liquidation

**IMPACT:** Most of these are convenience wrappers. The core fields (open_rate, close_rate,
stake_amount, etc.) are all present. However, for complete UI coverage:
→ Add `max_stake_amount` to position display (DCA total)
→ Add `has_open_orders` indicator to open positions table
→ Add `stoploss_or_liquidation` to risk display

---

## 17. PRODUCER/CONSUMER (§17) → Settings Page

**Status: OK — COMPLETE**

All parameters mapped:
- enabled, producers[], wait_timeout, ping_timeout OK
- remove_entry_exit_signals, initial_candle_limit, message_size_limit OK
- producers[].secure missing → Add toggle for SSL

**GAPS FOUND: 1**

1. `producers[].secure` — SSL toggle
   → Add to producer row in Settings

---

## 18. UTILITY SUB-COMMANDS (§18) → Data Management Page

**Status: PARTIAL — 4 MISSING COMMANDS**

| Command | In Map? | Status |
|---------|---------|--------|
| list-strategies | Yes | OK |
| list-exchanges | Yes | OK |
| list-timeframes | Yes | OK |
| list-pairs | Yes | OK |
| list-data | Yes | OK |
| convert-data | Yes | OK |
| test-pairlist | Yes | OK |
| show-trades | Yes | OK |
| list-hyperoptloss | Yes | OK |
| list-freqaimodels | Yes | OK |
| create-userdir | **NO** | N/A (Docker handles this) |
| new-config | **NO** | N/A (Settings page handles this) |
| show-config | **NO** | N/A (GET /api/v1/show_config) |
| new-strategy | **NO** | N/A (Builder page handles this) |
| convert-trade-data | **NO** | MISSING |
| trades-to-ohlcv | **NO** | MISSING |
| convert-db | **NO** | MISSING |
| webserver | **NO** | N/A (our UI replaces this) |
| backtesting-show | **NO** | PARTIAL (covered by backtest history) |
| backtesting-analysis | **PARTIAL** | In §30 but not all args |
| hyperopt-list | **NO** | MISSING |
| hyperopt-show | **NO** | MISSING |
| strategy-updater | **NO** | N/A (V3 only) |

**GAPS FOUND: 4 (non-N/A)**

1. `convert-trade-data` — Convert between trade data formats
   → Add to Data Mgmt > Convert section
2. `trades-to-ohlcv` — Generate OHLCV from trade data
   → Add to Data Mgmt > Convert section
3. `hyperopt-list` — Browse hyperopt results
   → Add to Backtesting > Hyperopt Results tab
4. `hyperopt-show` — Show specific epoch details
   → Add to Backtesting > Hyperopt Results detail view

---

## 19. PLOTTING (§19) → Analytics Page

**Status: OK — COMPLETE**

- Candlestick chart OK
- plot_config (main_plot + subplots) OK
- Trade markers OK
- Profit chart OK
- Indicator overlays OK

**GAPS FOUND: 0**

---

## 20. DATA ANALYSIS / JUPYTER (§20) → Analytics Page

**Status: OK — BASIC**

Mapped as "Notebook-style analysis view, or link to Jupyter"
This is intentionally minimal — we show analysis tools in our UI.

**GAPS FOUND: 0**

---

## 21. LOOKAHEAD ANALYSIS (§21) → Backtesting Page

**Status: OK — COMPLETE**

- Run button OK
- Results table (bias detection) OK
- Educational tooltips OK

**GAPS FOUND: 0**

---

## 22. RECURSIVE ANALYSIS (§22) → Backtesting Page

**Status: OK — COMPLETE**

- Run button OK
- Results display OK
- Startup candle parameter OK

**GAPS FOUND: 0**

---

## 23. SQL CHEAT-SHEET (§23) → N/A

**Status: N/A — INTENTIONALLY SKIPPED**

We use API, not direct SQL. Correct decision.

---

## 24-26. FreqAI (§24, §25, §26) → FreqAI Page

**Status: PARTIAL — SEVERAL MISSING PARAMS**

§24 Core — checked against FT parameter table:
| Parameter | In Map? | Status |
|-----------|---------|--------|
| enabled | Yes | OK |
| identifier | Yes | OK |
| purge_old_models | Yes | OK |
| train_period_days | Yes | OK |
| backtest_period_days | Yes | OK |
| live_retrain_hours | Yes | OK |
| expiration_hours | Yes | OK |
| continual_learning | Yes | OK |
| activate_tensorboard | Yes | OK |
| save_backtest_models | Yes (§26) | OK |
| write_metrics_to_disk | Yes (§26) | OK |
| data_kitchen_thread_count | Yes (§26) | OK |
| wait_for_training_iteration_on_reload | **NO** | MISSING |
| override_exchange_check | **NO** | MISSING |

§25 RL — checked:
| Parameter | In Map? | Status |
|-----------|---------|--------|
| rl_config.train_cycles | Yes | OK |
| rl_config.add_state_info | Yes | OK |
| rl_config.max_trade_duration_candles | Yes | OK |
| rl_config.max_training_drawdown_pct | Yes | OK |
| rl_config.model_type | Yes | OK |
| rl_config.policy_type | Yes | OK |
| rl_config.model_reward_parameters | Yes | OK |
| rl_config.cpu_count | **NO** | MISSING |
| rl_config.net_arch | **NO** | MISSING |
| rl_config.randomize_starting_position | **NO** | MISSING |
| rl_config.drop_ohlc_from_features | **NO** | MISSING |
| rl_config.progress_bar | **NO** | MISSING |

§26 Feature processing — checked:
| Parameter | In Map? | Status |
|-----------|---------|--------|
| weight_factor | Yes | OK |
| shuffle_after_split | Yes | OK |
| buffer_train_data_candles | Yes | OK |
| reverse_train_test_order | Yes | OK |
| noise_standard_deviation | Yes | OK |
| PCA | Yes | OK |
| SVM outlier | Yes | OK |
| DBSCAN | Yes | OK |
| DI_threshold | Yes | OK |
| outlier_protection_percentage | Yes | OK |
| learning_rate (PyTorch) | Yes | OK |
| n_epochs | Yes | OK |
| batch_size | Yes | OK |
| conv_width | Yes | OK |
| svm_params | **NO** | MISSING |
| plot_feature_importances | **NO** | MISSING |

**GAPS FOUND: 9**

1. `wait_for_training_iteration_on_reload` — Wait for training on shutdown
   → Add toggle (advanced)
2. `override_exchange_check` — Force FreqAI on limited exchanges
   → Add toggle (advanced/dangerous)
3. `rl_config.cpu_count` — CPU threads for RL
   → Add number input
4. `rl_config.net_arch` — Network architecture (e.g., [128, 128])
   → Add array input
5. `rl_config.randomize_starting_position` — Randomize episode starts
   → Add toggle
6. `rl_config.drop_ohlc_from_features` — Exclude normalized OHLC
   → Add toggle
7. `rl_config.progress_bar` — Show training progress
   → Add toggle
8. `svm_params` — Custom SVM parameters dict
   → Add JSON editor (advanced)
9. `plot_feature_importances` — Number of features to plot
   → Add number input

---

## 27. BOT USAGE / CLI (§27) → Data Mgmt + Settings

**Status: OK — COVERED**

CLI args are represented as form fields where we invoke CLI commands.

---

## 28. ADVANCED SETUP (§28) → Settings Page

**Status: OK — COMPLETE**

Multi-instance, DB options, logging config all mapped.

---

## 29. ORDERFLOW (§29) → Analytics Page

**Status: OK — COMPLETE**

- Footprint chart OK
- Delta, imbalances, stacked imbalances OK
- Config params (scale, imbalance_volume, etc.) OK
- use_public_trades toggle OK

**GAPS FOUND: 1 MINOR**

1. `cache_size` and `max_candles` params not explicitly in map
   → Add to Analytics > Orderflow config section

---

## 30. ADVANCED BACKTESTING ANALYSIS (§30) → Backtesting Page

**Status: OK — COMPLETE**

- Analysis groups 0-5 OK
- enter/exit reason lists OK
- indicator list OK
- rejected signals OK
- analysis-to-csv export NOT in map → Add "Export to CSV" button

**GAPS FOUND: 1**

1. `--analysis-to-csv` / `--analysis-csv-path` — Export analysis to CSV
   → Add "Export CSV" button to analysis results

---

## 31-34. SKIPPED SECTIONS

- §31 FreqUI — N/A (we replace it)
- §32 FAQ — Mapped to tooltips (OK)
- §33 Deprecated — N/A (guard list)
- §34 Migration — N/A (V3 only)

**Status: OK — CORRECTLY SKIPPED**

---

## SUMMARY

### Total gaps found: 53

| Section | Gaps | Severity |
|---------|------|----------|
| §1 Config | 4 | Minor (exchange debug params) |
| §2 Strategy Interface | 2 | Minor (version method, embedding) |
| §3 Callbacks | 0 | — |
| §4 Stoploss | 0 | — |
| §5 Backtesting | 3 | Medium (position stacking, notes, dynamic pairlist) |
| §6 Hyperopt | 3 | Medium (missing loss function, sampler update) |
| §7 Plugins | 1 | Minor (MaxDrawdown calculation_mode) |
| §8 REST API | 4 | Medium (cancel open order, lock creation) |
| §9 Exchanges | 0 | — |
| §10 Leverage | 0 | — |
| §11 Telegram | 7 | Medium (several notification params) |
| §12 Data Download | 8 | High (many CLI args missing) |
| §13 Webhook | 5 | Medium (format, retries, Discord) |
| §14 Advanced Strategy | 0 | — |
| §15 Advanced Hyperopt | 0 | — |
| §16 Trade Object | 3 | Minor (convenience fields) |
| §17 Producer/Consumer | 1 | Minor (SSL toggle) |
| §18 Utilities | 4 | Medium (hyperopt list/show, data convert) |
| §19-22 Analytics/Analysis | 0 | — |
| §24-26 FreqAI | 9 | Medium (RL params, SVM params) |
| §29 Orderflow | 1 | Minor |
| §30 Adv. Backtesting | 1 | Minor |

### By severity:
- **HIGH (must fix):** 8 (§12 Data Download missing args)
- **MEDIUM (should fix):** 30 (§5,6,8,11,13,18,24-26)
- **MINOR (nice to have):** 15 (§1,2,7,16,17,29,30)

### Sections with 100% coverage (0 gaps): 12 of 30
§3, §4, §9, §10, §14, §15, §19, §20, §21, §22, §28, §30(mostly)

### Action items for FREQTRADE_REFERENCE.md update:
1. Add MaxDrawDownPerPairHyperOptLoss to §6
2. Update sampler list in §6/§15 (add MOTPE, NSGA-III, AutoSampler)
3. Add missing exchange params to §1/§9
4. Add missing Telegram params to §11
5. Add missing Data Download args to §12
6. Add missing Webhook params to §13
7. Add missing FreqAI RL params to §25
8. Add missing Trade Object fields to §16

### Action items for FT-UI-MAP.html update:
1. Add 3 backtesting CLI args (eps, notes, dynamic-pairlist)
2. Add cancel-open-order button to Dashboard
3. Add lock creation to Risk page
4. Expand Telegram notification settings
5. Expand Data Download form (8 missing args)
6. Expand Webhook config (format, retries, Discord)
7. Add hyperopt-list/show to Backtesting page
8. Add 9 FreqAI params to FreqAI page
9. Add orderflow cache_size/max_candles to Analytics
10. Add analysis CSV export to Backtesting
