# FreqTrade Complete Reference (v2026.2)
> This file contains ALL FreqTrade parameters, functions, callbacks, API endpoints, plugins, and CLI options.
> Each section links to the official documentation page.
> Agent MUST consult this file when working on any task that touches FreqTrade configuration or features.

---

## 1. CONFIGURATION PARAMETERS
**Docs:** https://www.freqtrade.io/en/stable/configuration/

### Core Trading
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_open_trades` | int/-1 | Required | Max simultaneous trades (-1=unlimited) |
| `stake_currency` | str | Required | Currency for trading (e.g., USDT) |
| `stake_amount` | float/"unlimited" | Required | Amount per trade |
| `tradable_balance_ratio` | float | 0.99 | Ratio of balance available for trading |
| `available_capital` | float | None | Starting capital (for multi-bot) |
| `amend_last_stake_amount` | bool | false | Reduce final stake if insufficient |
| `last_stake_amount_min_ratio` | float | 0.5 | Min ratio for amended stake |
| `amount_reserve_percent` | float | 0.05 | Reserve % in min pair stake |

### Timeframe & Display
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeframe` | str | Strategy | Candle interval (1m/5m/15m/30m/1h/4h/1d/1w) |
| `fiat_display_currency` | str | None | Fiat for profit display |

### Dry Run
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dry_run` | bool | true | Simulation mode |
| `dry_run_wallet` | float/dict | 1000 | Simulated starting wallet |
| `cancel_open_orders_on_exit` | bool | false | Cancel orders on stop |
| `process_only_new_candles` | bool | true | Process only on new candles |

### ROI & Stoploss
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `minimal_roi` | dict | Required | Exit thresholds by duration {"0": 0.04, "30": 0.02, "60": 0.01} |
| `stoploss` | float | Required | Loss ratio (e.g., -0.10 = 10%) |
| `trailing_stop` | bool | false | Enable trailing stoploss |
| `trailing_stop_positive` | float | None | Alternative % once profitable |
| `trailing_stop_positive_offset` | float | 0.0 | Profit threshold for trailing |
| `trailing_only_offset_is_reached` | bool | false | Trail only after offset |

### Exit Signal Control
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `use_exit_signal` | bool | true | Use strategy exit signals |
| `exit_profit_only` | bool | false | Wait for profit before exit signal |
| `exit_profit_offset` | float | 0.0 | Min profit for exit signal |
| `ignore_roi_if_entry_signal` | bool | false | Don't ROI-exit if entry signal active |
| `ignore_buying_expired_candle_after` | int | None | Seconds until buy signal expires |

### Order Types
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `order_types.entry` | str | Required | Entry order type (market/limit) |
| `order_types.exit` | str | Required | Exit order type |
| `order_types.stoploss` | str | Required | Stoploss order type |
| `order_types.emergency_exit` | str | "market" | Fallback exit type |
| `order_types.force_exit` | str | same as exit | Manual exit type |
| `order_types.force_entry` | str | same as entry | Manual entry type |
| `order_types.stoploss_on_exchange` | bool | false | Place SL on exchange |
| `order_types.stoploss_on_exchange_limit_ratio` | float | 0.99 | Limit ratio below stop |
| `order_types.stoploss_on_exchange_interval` | int | 60 | SL update interval (seconds) |
| `order_types.stoploss_price_type` | str | "last" | Price type for SL (last/mark/index) |
| `order_time_in_force.entry` | str | "GTC" | Entry TIF (GTC/FOK/IOC/PO) |
| `order_time_in_force.exit` | str | "GTC" | Exit TIF |

### Unfilled Timeout
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `unfilledtimeout.entry` | int | Required | Minutes before entry cancels |
| `unfilledtimeout.exit` | int | Required | Minutes before exit cancels |
| `unfilledtimeout.unit` | str | "minutes" | Unit (minutes/seconds) |
| `unfilledtimeout.exit_timeout_count` | int | 0 | Emergency exit after N timeouts |

### Entry Pricing
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `entry_pricing.price_side` | str | "same" | Rate side (ask/bid/same/other) |
| `entry_pricing.price_last_balance` | float | 0.0 | Interpolate between side and last |
| `entry_pricing.use_order_book` | bool | true | Use orderbook |
| `entry_pricing.order_book_top` | int | 1 | Top N orderbook entry |
| `entry_pricing.check_depth_of_market.enabled` | bool | false | Check DOM depth |
| `entry_pricing.check_depth_of_market.bids_to_ask_delta` | float | 0 | Buy/sell ratio |

### Exit Pricing
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exit_pricing.price_side` | str | "same" | Rate side |
| `exit_pricing.price_last_balance` | float | 0.0 | Interpolate |
| `exit_pricing.use_order_book` | bool | true | Use orderbook |
| `exit_pricing.order_book_top` | int | 1 | Top N orderbook exit |
| `custom_price_max_distance_ratio` | float | 0.02 | Max custom price distance |

### Position Adjustment (DCA)
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `position_adjustment_enable` | bool | false | Enable DCA |
| `max_entry_position_adjustment` | int | -1 | Max additional entries (-1=unlimited) |

### Fee & Funding
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fee` | float | Exchange | Override fee ratio |
| `futures_funding_rate` | float | None | Override funding rate |

### Trading Mode (Futures)
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `trading_mode` | str | "spot" | spot/margin/futures |
| `margin_mode` | str | None | isolated/cross |
| `liquidation_buffer` | float | 0.05 | Buffer between SL and liquidation |

### Exchange
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exchange.name` | str | Required | Exchange name |
| `exchange.key` | str | Required (live) | API key |
| `exchange.secret` | str | Required (live) | API secret |
| `exchange.password` | str | None | API password (Bitget, etc.) |
| `exchange.uid` | str | None | API UID |
| `exchange.pair_whitelist` | list | Required | Tradeable pairs |
| `exchange.pair_blacklist` | list | [] | Blacklisted pairs |
| `exchange.ccxt_config` | dict | None | CCXT config (both) |
| `exchange.ccxt_sync_config` | dict | None | CCXT sync config |
| `exchange.ccxt_async_config` | dict | None | CCXT async config |
| `exchange.enable_ws` | bool | true | Use websockets |
| `exchange.markets_refresh_interval` | int | 60 | Market refresh (minutes) |
| `exchange.skip_open_order_update` | bool | false | Skip order update on start |
| `exchange.unknown_fee_rate` | float | None | Fallback fee |
| `exchange.log_responses` | bool | false | Log responses (debug) |
| `exchange.only_from_ccxt` | bool | false | No binance.vision downloads |

### API Server / FreqUI
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `api_server.enabled` | bool | false | Enable API |
| `api_server.listen_ip_address` | str | None | Bind IP |
| `api_server.listen_port` | int | None | Bind port (1024-65535) |
| `api_server.verbosity` | str | "info" | Log level (info/error) |
| `api_server.username` | str | None | Auth username |
| `api_server.password` | str | None | Auth password |
| `api_server.ws_token` | str | None | WebSocket token |
| `api_server.jwt_secret_key` | str | auto | JWT signing key |
| `api_server.CORS_origins` | list | [] | CORS allowed origins |

### Telegram
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `telegram.enabled` | bool | false | Enable Telegram |
| `telegram.token` | str | Required | Bot token |
| `telegram.chat_id` | str | Required | Chat ID |
| `telegram.balance_dust_level` | float | None | Min balance to display |
| `telegram.reload` | bool | true | Reload buttons |
| `telegram.notification_settings` | dict | None | Per-event settings |
| `telegram.allow_custom_messages` | bool | false | Strategy messages |

### Webhook
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `webhook.enabled` | bool | false | Enable webhooks |
| `webhook.url` | str | None | Endpoint URL |
| `webhook.entry` | dict | None | Entry payload |
| `webhook.entry_cancel` | dict | None | Cancel payload |
| `webhook.entry_fill` | dict | None | Fill payload |
| `webhook.exit` | dict | None | Exit payload |
| `webhook.exit_cancel` | dict | None | Cancel payload |
| `webhook.exit_fill` | dict | None | Fill payload |
| `webhook.status` | dict | None | Status payload |
| `webhook.allow_custom_messages` | bool | false | Custom messages |

### Bot Identity
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bot_name` | str | "freqtrade" | Bot name |
| `initial_state` | str | "stopped" | Start state (running/paused/stopped) |
| `force_entry_enable` | bool | false | Enable force entry RPC |

### Database & Data
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `db_url` | str | auto | SQLAlchemy DB URL |
| `user_data_dir` | str | "./user_data/" | Data directory |
| `dataformat_ohlcv` | str | "feather" | OHLCV format |
| `dataformat_trades` | str | "feather" | Trades format |
| `reduce_df_footprint` | bool | false | Cast to float32 |
| `strategy` | str | Required | Strategy class name |
| `strategy_path` | str | None | Extra strategy dir |
| `recursive_strategy_search` | bool | false | Search subdirs |
| `disable_dataframe_checks` | bool | false | Skip DF validation |
| `add_config_files` | list | [] | Additional configs |

### Internal
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `internals.process_throttle_secs` | int | 5 | Min loop duration |
| `internals.heartbeat_interval` | int | 60 | Heartbeat interval (0=disable) |
| `internals.sd_notify` | bool | false | Systemd notify |
| `logfile` | str | None | Log file path |
| `log_config` | dict | FtRichHandler | Python logging config |

### Producer/Consumer
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `external_message_consumer.enabled` | bool | false | Enable consumer |
| `external_message_consumer.producers` | list | [] | Producer configs |
| `external_message_consumer.producers[].name` | str | Required | Producer name |
| `external_message_consumer.producers[].host` | str | Required | Producer host |
| `external_message_consumer.producers[].port` | int | Required | Producer port |
| `external_message_consumer.producers[].ws_token` | str | Required | WS auth token |
| `external_message_consumer.wait_timeout` | int | 300 | WS wait timeout |
| `external_message_consumer.ping_timeout` | int | 10 | WS ping timeout |
| `external_message_consumer.remove_entry_exit_signals` | bool | false | Strip signals |
| `external_message_consumer.initial_candle_limit` | int | 1500 | Initial candle request |
| `external_message_consumer.message_size_limit` | int | 8MB | Max message size |

### CoinGecko
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `coingecko.api_key` | str | None | API key |
| `coingecko.is_demo` | bool | false | Demo API mode |

---

## 2. STRATEGY INTERFACE
**Docs:** https://www.freqtrade.io/en/stable/strategy-customization/

### Required Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `populate_indicators` | `(dataframe, metadata) -> DataFrame` | Add TA indicators to dataframe |
| `populate_entry_trend` | `(dataframe, metadata) -> DataFrame` | Set enter_long/enter_short/enter_tag columns |
| `populate_exit_trend` | `(dataframe, metadata) -> DataFrame` | Set exit_long/exit_short/exit_tag columns |

### Optional Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `informative_pairs` | `() -> list[tuple]` | Additional pairs for analysis |

### Strategy Properties
| Property | Type | Description |
|----------|------|-------------|
| `INTERFACE_VERSION` | int | Must be 3 |
| `timeframe` | str | Candle interval |
| `can_short` | bool | Enable shorting |
| `startup_candle_count` | int | Candles needed for stable indicators |
| `minimal_roi` | dict | ROI table |
| `stoploss` | float | Default stoploss |
| `trailing_stop` | bool | Trailing SL |
| `trailing_stop_positive` | float | Trailing positive |
| `trailing_stop_positive_offset` | float | Offset |
| `trailing_only_offset_is_reached` | bool | Only after offset |
| `use_custom_stoploss` | bool | Enable custom_stoploss callback |
| `process_only_new_candles` | bool | Process only new candles |
| `order_types` | dict | Order type config |
| `order_time_in_force` | dict | TIF config |
| `plot_config` | dict | Plotting config |

### DataProvider (self.dp)
| Method | Description |
|--------|-------------|
| `dp.get_pair_dataframe(pair, timeframe)` | Historical/cached data |
| `dp.get_analyzed_dataframe(pair, timeframe)` | Analyzed data + timestamp |
| `dp.orderbook(pair, max)` | Current orderbook |
| `dp.ticker(pair)` | Current ticker |
| `dp.check_delisting(pair)` | Delisting check |
| `dp.funding_rate(pair)` | Current funding rate |
| `dp.send_msg(message)` | Send custom notification |

### Wallet (self.wallets)
| Method | Description |
|--------|-------------|
| `wallets.get_free(asset)` | Available balance |
| `wallets.get_used(asset)` | Balance in orders |
| `wallets.get_total(asset)` | Total balance |

### Pair Locking
| Method | Description |
|--------|-------------|
| `lock_pair(pair, until, reason)` | Lock pair |
| `unlock_pair(pair)` | Unlock pair |
| `unlock_reason(reason)` | Unlock by reason |
| `is_pair_locked(pair)` | Check lock status |

### Utility
| Function | Description |
|----------|-------------|
| `merge_informative_pair(df, inf, tf, inf_tf, ffill)` | Merge multi-TF data |
| `timeframe_to_minutes(timeframe)` | Convert TF to minutes |

---

## 3. STRATEGY CALLBACKS
**Docs:** https://www.freqtrade.io/en/stable/strategy-callbacks/

| Callback | Return | Description |
|----------|--------|-------------|
| `bot_start(**kwargs)` | None | Called once at bot start |
| `bot_loop_start(current_time, **kwargs)` | None | Called each iteration |
| `custom_stake_amount(pair, current_time, current_rate, proposed_stake, min_stake, max_stake, leverage, entry_tag, side)` | float | Custom position size |
| `custom_exit(pair, trade, current_time, current_rate, current_profit)` | str/bool/None | Custom exit logic |
| `custom_stoploss(pair, trade, current_time, current_rate, current_profit, after_fill)` | float/None | Dynamic stoploss |
| `custom_roi(pair, trade, current_time, trade_duration, entry_tag, side)` | float/None | Dynamic ROI |
| `custom_entry_price(pair, trade, current_time, proposed_rate, entry_tag, side)` | float | Custom entry price |
| `custom_exit_price(pair, trade, current_time, proposed_rate, current_profit, exit_tag)` | float | Custom exit price |
| `check_entry_timeout(pair, trade, order, current_time)` | bool | Cancel unfilled entry |
| `check_exit_timeout(pair, trade, order, current_time)` | bool | Cancel unfilled exit |
| `confirm_trade_entry(pair, order_type, amount, rate, time_in_force, current_time, entry_tag, side)` | bool | Confirm entry |
| `confirm_trade_exit(pair, trade, order_type, amount, rate, time_in_force, exit_reason, current_time)` | bool | Confirm exit |
| `adjust_trade_position(trade, current_time, current_rate, current_profit, min_stake, max_stake, ...)` | float/None | DCA adjustment |
| `adjust_order_price(trade, order, pair, current_time, proposed_rate, current_order_rate, entry_tag, side, is_entry)` | float/None | Refresh limit orders (entry+exit) |
| `adjust_entry_price(trade, order, pair, current_time, proposed_rate, current_order_rate, entry_tag, side)` | float/None | Refresh entry limit orders only |
| `adjust_exit_price(trade, order, pair, current_time, proposed_rate, current_order_rate, current_profit, exit_tag)` | float/None | Refresh exit limit orders only |
| `leverage(pair, current_time, current_rate, proposed_leverage, max_leverage, entry_tag, side)` | float | Custom leverage |
| `order_filled(pair, trade, order, current_time)` | None | Post-fill trigger |
| `plot_annotations(pair, start_date, end_date, dataframe)` | list[AnnotationType] | Chart annotations for FreqUI (area/line/point) |

### Additional Strategy Properties (from official docs)
| Property | Type | Description |
|----------|------|-------------|
| `use_custom_roi` | bool | Enable custom_roi() callback |
| `version()` | method | Return strategy version string |

---

## 4. STOPLOSS OPTIONS
**Docs:** https://www.freqtrade.io/en/stable/stoploss/

### Types
1. **Static** — Fixed % (stoploss = -0.10)
2. **Trailing** — Follows price up (trailing_stop = true)
3. **Trailing + Positive** — Different % after profit (trailing_stop_positive)
4. **Trailing + Offset** — Activate after offset (trailing_stop_positive_offset)
5. **Custom** — Via custom_stoploss() callback (use_custom_stoploss = true)
6. **On Exchange** — Placed on exchange (stoploss_on_exchange = true)

---

## 5. BACKTESTING
**Docs:** https://www.freqtrade.io/en/stable/backtesting/

### CLI Arguments
| Argument | Description |
|----------|-------------|
| `--strategy` | Strategy name |
| `--strategy-path` | Additional strategy dir |
| `--strategy-list` | Space-separated list for comparison |
| `--timeframe` | Override timeframe |
| `--timerange` | Date range (YYYYMMDD-YYYYMMDD) |
| `--timeframe-detail` | Detail timeframe for accuracy |
| `--export` | Export results (trades/signals/none) |
| `--export-filename` | Custom export path |
| `--breakdown` | Breakdown by day/week/month |
| `--cache` | Cache results (day/week/month/none) |
| `--eps` / `--no-eps` | Enable/disable ExitProfitOnly |
| `--enable-protections` | Enable protections in backtest |
| `--dry-run-wallet` | Override starting balance |
| `--stake-amount` | Override stake amount |
| `--max-open-trades` | Override max trades |
| `--fee` | Override fee rate |
| `--pairs` | Override pair whitelist |
| `--freqaimodel` | FreqAI model name |
| `--freqaibacktest-live-models` | Use live FreqAI models |
| `--enable-dynamic-pairlist` | Refresh pairlist per candle |
| `--eps` / `--enable-position-stacking` | Allow buying same pair multiple times |
| `--notes` | Add metadata text to results |
| `--backtest-directory` | Custom results directory |

### Config Settings
| Setting | Description |
|---------|-------------|
| `backtest_show_pair_list` | Show pair-level results |
| `backtest_breakdown` | Default breakdown (day/week/month) |

---

## 6. HYPEROPT
**Docs:** https://www.freqtrade.io/en/stable/hyperopt/

### CLI Arguments
| Argument | Description |
|----------|-------------|
| `--epochs` | Number of optimization epochs |
| `--spaces` | Spaces to optimize (buy/sell/roi/stoploss/trailing/protection/trades/default) |
| `--loss` | Loss function name |
| `--min-trades` | Min trades for valid result |
| `--max-trades` | Max trades for valid result |
| `--hyperopt-path` | Custom hyperopt class dir |
| `--print-all` | Print all results |
| `--no-color` | Disable colors |
| `--print-json` | Print JSON format |
| `--random-state` | Random seed |
| `--jobs` | Parallel workers (-1=all CPUs) |
| `--analyze-per-epoch` | Per-epoch analysis |
| `--effort` | Search effort multiplier |

### Parameter Types
| Type | Description |
|------|-------------|
| `IntParameter(low, high)` | Integer range |
| `DecimalParameter(low, high, decimals)` | Decimal range |
| `RealParameter(low, high)` | Float range |
| `CategoricalParameter(list)` | Category selection |
| `BooleanParameter()` | True/False |

### Built-in Loss Functions
| Name | Description |
|------|-------------|
| `ShortTradeDurHyperOptLoss` | Short trade + max profit |
| `OnlyProfitHyperOptLoss` | Profit only |
| `SharpeHyperOptLoss` | Sharpe ratio |
| `SharpeHyperOptLossDaily` | Daily Sharpe |
| `SortinoHyperOptLoss` | Sortino ratio |
| `SortinoHyperOptLossDaily` | Daily Sortino |
| `CalmarHyperOptLoss` | Calmar ratio |
| `MaxDrawDownHyperOptLoss` | Min drawdown + max profit |
| `MaxDrawDownRelativeHyperOptLoss` | Relative drawdown |
| `ProfitDrawDownHyperOptLoss` | Profit/DD balance |
| `MultiMetricHyperOptLoss` | Multi-metric optimization |
| `MaxDrawDownPerPairHyperOptLoss` | Per-pair profit/drawdown ratio |

### Additional Hyperopt CLI Arguments (from official docs)
| Argument | Description |
|----------|-------------|
| `--early-stop` | Halt after N epochs without improvement |
| `--analyze-per-epoch` | Run populate_indicators once per epoch |
| `--disable-param-export` | Prevent automatic parameter export |
| `--eps / --enable-position-stacking` | Allow buying same pair multiple times |

---

## 7. PLUGINS & PROTECTIONS
**Docs:** https://www.freqtrade.io/en/stable/plugins/

### Pairlist Handlers
| Handler | Key Parameters | Description |
|---------|---------------|-------------|
| `StaticPairList` | — | Fixed whitelist from config |
| `VolumePairList` | number_assets, sort_key, min_value, refresh_period | Top N by volume |
| `PercentChangePairList` | number_assets, sort_key, min_value, max_value, refresh_period | Sort by % change |
| `ProducerPairList` | producer_name | From producer bot |
| `RemotePairList` | pairlist_url, refresh_period, mode(whitelist/blacklist), processing_mode(filter/append), number_assets, bearer_token, read_timeout, keep_pairlist_on_failure, save_to_file | From remote URL/JSON |
| `MarketCapPairList` | number_assets, max_rank, refresh_period, mode(whitelist/blacklist), categories | By CoinGecko market cap |

### Pairlist Filters
| Filter | Key Parameters | Description |
|--------|---------------|-------------|
| `AgeFilter` | min_days_listed, max_days_listed | By listing age |
| `DelistFilter` | max_days_from_now (default 0) | Remove delisting pairs |
| `FullTradesFilter` | — | Shrink whitelist when trade slots full |
| `OffsetFilter` | offset, number_assets | Slice pairlist |
| `PerformanceFilter` | trade_back_seconds, min_profit | By bot performance |
| `PrecisionFilter` | — | Remove pairs with bad precision |
| `PriceFilter` | low_price_ratio, min_price, max_price | By price range |
| `ShuffleFilter` | seed | Randomize order |
| `SpreadFilter` | max_spread_ratio | By spread |
| `RangeStabilityFilter` | min/max_rate_of_change, lookback_days, refresh_period | By range stability |
| `VolatilityFilter` | min/max_volatility, lookback_days, refresh_period | By volatility |

### Protections
| Protection | Parameters | Description |
|------------|-----------|-------------|
| `StoplossGuard` | trade_limit, lookback_period_candles, stop_duration_candles, only_per_pair, only_per_side, required_profit, unlock_at(HH:MM) | Pause after N stoplosses |
| `MaxDrawdown` | trade_limit, lookback_period_candles, stop_duration_candles, max_allowed_drawdown, calculation_mode(ratios/equity), unlock_at(HH:MM) | Pause at drawdown limit |
| `LowProfitPairs` | trade_limit, lookback_period_candles, stop_duration_candles, required_profit, only_per_pair, only_per_side, unlock_at(HH:MM) | Pause losing pairs |
| `CooldownPeriod` | stop_duration_candles, only_per_pair, unlock_at(HH:MM) | Min time between trades |

---

## 8. REST API ENDPOINTS
**Docs:** https://www.freqtrade.io/en/stable/rest-api/

### Bot Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/start` | Start trading |
| POST | `/api/v1/stop` | Stop trading |
| POST | `/api/v1/stopbuy` | Stop new entries only |
| POST | `/api/v1/pause` | Pause trading |
| POST | `/api/v1/reload_config` | Reload configuration |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/token/login` | Get JWT token (Basic Auth) |
| POST | `/api/v1/token/refresh` | Refresh JWT token |

### Status & Info
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/ping` | Health check |
| GET | `/api/v1/version` | Bot version |
| GET | `/api/v1/show_config` | Current config |
| GET | `/api/v1/balance` | Account balance |
| GET | `/api/v1/count` | Open trade count |
| GET | `/api/v1/health` | Bot health |
| GET | `/api/v1/sysinfo` | System info |
| GET | `/api/v1/logs` | Bot logs |

### Trading
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/forceenter` | Force open a trade |
| POST | `/api/v1/forceexit` | Force close a trade |
| GET | `/api/v1/status` | Open trades |
| GET | `/api/v1/trades` | Trade history (paginated) |
| GET | `/api/v1/trades/{id}` | Single trade |
| DELETE | `/api/v1/trades/{id}` | Delete trade |
| DELETE | `/api/v1/trades/{id}/open-order` | Cancel open order for trade |
| POST | `/api/v1/trades/{id}/reload` | Reload trade from exchange |

### Performance & Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/profit` | Overall profit |
| GET | `/api/v1/performance` | Per-pair performance |
| GET | `/api/v1/entries` | Entry tag analysis |
| GET | `/api/v1/exits` | Exit reason analysis |
| GET | `/api/v1/mix_tags` | Combined tag analysis |
| GET | `/api/v1/daily` | Daily profit |
| GET | `/api/v1/weekly` | Weekly profit |
| GET | `/api/v1/monthly` | Monthly profit |
| GET | `/api/v1/stats` | Trade statistics |

### Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/whitelist` | Current whitelist |
| POST | `/api/v1/blacklist` | Add to blacklist |
| DELETE | `/api/v1/blacklist` | Remove from blacklist |
| GET | `/api/v1/pair_candles` | OHLCV data for pair |
| GET | `/api/v1/pair_history` | Historical with indicators |
| GET | `/api/v1/available_pairs` | Available pairs |
| GET | `/api/v1/strategies` | Available strategies |
| GET | `/api/v1/strategy/{name}` | Strategy details/source code |
| GET | `/api/v1/freqaimodels` | FreqAI models |
| GET | `/api/v1/plot_config` | Strategy plotting configuration |
| GET | `/api/v1/blacklist` | Current blacklist |
| POST | `/api/v1/pair_candles` | OHLCV data with column filtering |
| POST | `/api/v1/pair_history` | Historical with indicators + column filtering |

### Locks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/locks` | List pair locks |
| POST | `/api/v1/locks` | Create lock |
| DELETE | `/api/v1/locks/{id}` | Delete lock |

### Backtesting (via API)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/backtest` | Start backtest |
| GET | `/api/v1/backtest` | Get backtest status/results |
| DELETE | `/api/v1/backtest` | Abort backtest |
| GET | `/api/v1/backtest/history` | Backtest history |
| GET | `/api/v1/backtest/history/result` | Specific result |
| DELETE | `/api/v1/backtest/history/{id}` | Delete result |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `/api/v1/message/ws?token={ws_token}` | Real-time updates |

---

## 9. EXCHANGES
**Docs:** https://www.freqtrade.io/en/stable/exchanges/

### Supported Exchanges for Futures
| Exchange | Futures | SL on Exchange | Notes |
|----------|---------|---------------|-------|
| Binance | Yes (isolated) | stop-limit, stop-market | Full support |
| Bybit | Yes (isolated) | stop-limit, stop-market | One-way mode |
| Gate.io | Yes (isolated) | stop-limit, stop-market | USDT-margined |
| Hyperliquid | Yes (isolated) | stop-limit | Wallet auth, HIP-3, 5000 candle limit |
| Bitget | Yes (isolated) | market, limit | Passphrase required, one-way mode |
| OKX | Yes (isolated) | stop-limit, stop-market | API v5 |
| Kraken | Yes (isolated) | stop-limit, stop-market | |

### Hyperliquid-Specific
| Parameter | Value | Description |
|-----------|-------|-------------|
| `exchange.key` | Wallet address | Public wallet address |
| `exchange.secret` | Private key (hex) | Wallet private key |
| `exchange.uid` | Vault address | Optional vault |
| `exchange.ccxt_config.walletAddress` | Wallet | Alternative config |
| `exchange.ccxt_config.privateKey` | Key | Alternative config |

### Bitget-Specific
| Parameter | Description |
|-----------|-------------|
| `exchange.password` | API passphrase (required) |

---

## 10. LEVERAGE & FUTURES
**Docs:** https://www.freqtrade.io/en/stable/leverage/

### Config
| Parameter | Description |
|-----------|-------------|
| `trading_mode: "futures"` | Enable futures |
| `margin_mode: "isolated"` | Recommended for safety |
| `can_short: true` | In strategy class to enable shorting |

### Pair Format
- Futures: `BTC/USDT:USDT` (settle currency after colon)
- Spot: `BTC/USDT`

### leverage() Callback
```python
def leverage(self, pair, current_time, current_rate, proposed_leverage, max_leverage, entry_tag, side, **kwargs) -> float:
    return 3.0  # Fixed leverage example
```

---

## 11. TELEGRAM COMMANDS
**Docs:** https://www.freqtrade.io/en/stable/telegram-usage/

### Bot Control
| Command | Description |
|---------|-------------|
| `/start` | Start trading |
| `/stop` | Stop trading |
| `/stopentry` | Stop new entries |
| `/reload_config` | Reload config |
| `/help` | Show commands |

### Status
| Command | Description |
|---------|-------------|
| `/status` | Open trades |
| `/balance` | Account balance |
| `/count` | Trade count |
| `/health` | Bot health |

### Trading
| Command | Description |
|---------|-------------|
| `/forcelong` | Force long entry |
| `/forceshort` | Force short entry |
| `/forceexit` | Force exit trade |
| `/forceexit all` | Force exit all |

### Analysis
| Command | Description |
|---------|-------------|
| `/profit` | Overall profit |
| `/performance` | Per-pair performance |
| `/daily` | Daily P&L |
| `/weekly` | Weekly P&L |
| `/monthly` | Monthly P&L |
| `/stats` | Trade stats |
| `/entries` | Entry tag analysis |
| `/exits` | Exit reason analysis |

### Pair Management
| Command | Description |
|---------|-------------|
| `/whitelist` | Show whitelist |
| `/blacklist [pair]` | Show/add blacklist |

---

## 12. DATA DOWNLOAD
**Docs:** https://www.freqtrade.io/en/stable/data-download/

### CLI: download-data
| Argument | Description |
|----------|-------------|
| `--pairs` | Pairs to download |
| `--exchange` | Exchange name |
| `--timeframes` | Timeframes (space separated) |
| `--timerange` | Date range (YYYYMMDD-YYYYMMDD) |
| `--erase` | Delete existing data first |
| `--trading-mode` | spot/futures |
| `--prepend` | Prepend to existing data |

### CLI: convert-data
| Argument | Description |
|----------|-------------|
| `--format-from` | Source format (json/feather/parquet) |
| `--format-to` | Target format |
| `--candle-types` | Candle types to convert |

### CLI: list-data
| Argument | Description |
|----------|-------------|
| `--exchange` | Exchange name |
| `--pairs` | Filter pairs |
| `--trading-mode` | spot/futures |

---

## 13. WEBHOOK CONFIG
**Docs:** https://www.freqtrade.io/en/stable/webhook-config/

### Available Payload Variables
| Variable | Description |
|----------|-------------|
| `{trade_id}` | Internal trade ID |
| `{exchange}` | Exchange name |
| `{pair}` | Trading pair |
| `{base_currency}` | Base currency |
| `{quote_currency}` | Quote currency |
| `{open_rate}` | Entry price |
| `{amount}` | Trade amount |
| `{open_date}` | Entry time |
| `{close_rate}` | Exit price |
| `{close_date}` | Exit time |
| `{profit_amount}` | Profit in stake |
| `{profit_ratio}` | Profit as ratio |
| `{stake_amount}` | Stake amount |
| `{stake_currency}` | Stake currency |
| `{enter_tag}` | Entry tag |
| `{exit_reason}` | Exit reason |
| `{direction}` | Trade direction |
| `{leverage}` | Trade leverage |
| `{order_type}` | Order type |
| `{current_rate}` | Current rate |
| `{unrealized_profit}` | Unrealized P&L |

---

## 14. ADVANCED STRATEGY
**Docs:** https://www.freqtrade.io/en/stable/strategy-advanced/

### Persistent Trade Data Storage
| Method | Signature | Description |
|--------|-----------|-------------|
| `set_custom_data` | `trade.set_custom_data(key, value)` | Store custom data on trade object |
| `get_custom_data` | `trade.get_custom_data(key)` | Retrieve custom data from trade |

### Tagging System
| Tag Type | Max Length | Column | Description |
|----------|-----------|--------|-------------|
| Entry tag | 255 chars | `enter_tag` | Tag entry signals for analysis |
| Exit tag | 100 chars | `exit_tag` | Tag exit signals for analysis |

### Strategy Versioning & Inheritance
- Strategies can inherit from other strategies
- `INTERFACE_VERSION = 3` required
- BASE64 strategy embedding for portable distribution

### Dataframe Access Patterns
- Access analyzed dataframe: `self.dp.get_analyzed_dataframe(pair, timeframe)`
- Returns tuple: `(dataframe, last_analyzed_time)`
- Candle lookups via iloc for historical comparison

---

## 15. ADVANCED HYPEROPT
**Docs:** https://www.freqtrade.io/en/stable/advanced-hyperopt/

### Custom Loss Function Interface
```python
class IHyperOptLoss:
    @staticmethod
    def hyperopt_loss_function(results, trade_count, min_date, max_date,
                                config, processed, backtest_stats, **kwargs) -> float:
        # Return float — lower is better
```

### Space Types
| Type | Import | Use Case |
|------|--------|----------|
| `Categorical` | `from skopt.space` | Fixed choices |
| `Integer` | `from skopt.space` | Int ranges |
| `SKDecimal` | `from freqtrade.optimize.space` | Decimal ranges (precision control) |
| `Real` | `from skopt.space` | Float ranges |

### Optuna Samplers
| Sampler | Description |
|---------|-------------|
| `TPESampler` | Tree-structured Parzen Estimator (default) |
| `NSGAIISampler` | Multi-objective optimization |
| `GPSampler` | Gaussian Process |
| `CmaEsSampler` | Covariance Matrix Adaptation |
| `RandomSampler` | Random search |
| `QMCSampler` | Quasi-Monte Carlo |

### Nested Space Overrides
- Override stoploss, ROI, trailing, max_open_trades search spaces
- Dynamic parameter configuration via `bot_start()` callback

---

## 16. TRADE OBJECT
**Docs:** https://www.freqtrade.io/en/stable/trade-object/

### Core Properties
| Property | Type | Description |
|----------|------|-------------|
| `id` | int | Internal trade ID |
| `pair` | str | Trading pair |
| `is_open` | bool | Trade open status |
| `is_short` | bool | Short trade flag |
| `trading_mode` | str | spot/futures |
| `amount` | float | Trade amount |
| `stake_amount` | float | Stake used |
| `leverage` | float | Leverage used |
| `enter_tag` | str | Entry tag |
| `exit_reason` | str | Exit reason |

### Timing Properties
| Property | Type | Description |
|----------|------|-------------|
| `open_date` | datetime | Entry time |
| `close_date` | datetime | Exit time |
| `open_date_utc` | datetime | Entry UTC |
| `close_date_utc` | datetime | Exit UTC |

### Profitability Properties
| Property | Type | Description |
|----------|------|-------------|
| `open_rate` | float | Entry price |
| `close_rate` | float | Exit price |
| `close_profit` | float | Profit ratio |
| `close_profit_abs` | float | Absolute profit |
| `fee_open` | float | Entry fee |
| `fee_close` | float | Exit fee |
| `funding_fees` | float | Accumulated funding |

### Stop Loss Properties
| Property | Type | Description |
|----------|------|-------------|
| `stop_loss` | float | Current SL price |
| `stop_loss_pct` | float | SL percentage |
| `initial_stop_loss` | float | Original SL |
| `initial_stop_loss_pct` | float | Original SL % |
| `stoploss_order_id` | str | Exchange SL order ID |

### Futures/Margin Properties
| Property | Type | Description |
|----------|------|-------------|
| `liquidation_price` | float | Liquidation price |
| `interest_rate` | float | Margin interest |

### Trade Class Methods
| Method | Description |
|--------|-------------|
| `Trade.get_trades_proxy()` | Query trades with filters |
| `Trade.get_overall_performance()` | Aggregate performance stats |
| `Trade.get_trades_count()` | Open trade count |

### Order Object Properties
| Property | Type | Description |
|----------|------|-------------|
| `order_id` | str | Exchange order ID |
| `ft_order_side` | str | buy/sell |
| `ft_order_type` | str | market/limit |
| `status` | str | Order status |
| `order_filled_date` | datetime | Fill time |
| `average` | float | Average fill price |
| `filled` | float | Filled amount |
| `remaining` | float | Remaining amount |
| `cost` | float | Order cost |
| `safe_price` | float | Safe accessor for price |
| `safe_filled` | float | Safe accessor for filled |
| `safe_fee_base` | float | Safe accessor for fee |
| `safe_amount_after_fee` | float | Amount minus fees |

---

## 17. PRODUCER/CONSUMER MODE
**Docs:** https://www.freqtrade.io/en/stable/producer-consumer/

### Consumer Configuration
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `external_message_consumer.enabled` | bool | false | Enable consumer |
| `external_message_consumer.producers` | list | [] | Producer list |
| `external_message_consumer.producers[].name` | str | Required | Producer name |
| `external_message_consumer.producers[].host` | str | Required | Producer host |
| `external_message_consumer.producers[].port` | int | Required | Producer port |
| `external_message_consumer.producers[].ws_token` | str | Required | WS auth token |
| `external_message_consumer.wait_timeout` | int | 300 | WS wait timeout (seconds) |
| `external_message_consumer.ping_timeout` | int | 10 | WS ping timeout |
| `external_message_consumer.remove_entry_exit_signals` | bool | false | Strip entry/exit signals |
| `external_message_consumer.initial_candle_limit` | int | 1500 | Initial candle request |
| `external_message_consumer.message_size_limit` | int | 8MB | Max message size |

### Consumer API Methods
| Method | Description |
|--------|-------------|
| `dp.get_producer_pairs(producer_name)` | Get pairs from producer |
| `dp.get_producer_df(pair, timeframe, producer_name)` | Get analyzed dataframe from producer |

### Architecture
- Producer: Normal FreqTrade bot with `api_server.ws_token` set
- Consumer: Bot with `external_message_consumer` config
- Multi-producer: Consumer can subscribe to N producers
- Automatic signal suffix system for multi-producer disambiguation
- Network resilience: Auto-reconnect on disconnection

---

## 18. UTILITY SUB-COMMANDS
**Docs:** https://www.freqtrade.io/en/stable/utils/

### Configuration & Setup
| Command | Description |
|---------|-------------|
| `freqtrade create-userdir [--userdir PATH] [--reset]` | Create user data directory |
| `freqtrade new-config [-c PATH]` | Interactive config creation |
| `freqtrade show-config [--show-sensitive]` | Show merged config |

### Strategy Management
| Command | Description |
|---------|-------------|
| `freqtrade new-strategy [-s NAME] [--template {full,minimal,advanced}]` | Create strategy file |
| `freqtrade list-strategies [--strategy-path PATH] [-1]` | List available strategies |
| `freqtrade strategy-updater [--strategy-list NAMES]` | Convert strategies to v3 |

### Exchange & Market
| Command | Description |
|---------|-------------|
| `freqtrade list-exchanges [-1] [-a] [--trading-mode MODE]` | List exchanges |
| `freqtrade list-timeframes [-c PATH] [--exchange NAME]` | List timeframes |
| `freqtrade list-pairs [--quote CUR] [--base CUR] [-a]` | List trading pairs |

### Analysis
| Command | Description |
|---------|-------------|
| `freqtrade backtesting-show [--breakdown {day,week,month,year,weekday}]` | Show backtest results |
| `freqtrade backtesting-analysis [--analysis-groups {0-5}]` | Detailed backtest analysis |
| `freqtrade hyperopt-list [--best] [--profitable]` | List hyperopt results |
| `freqtrade hyperopt-show [-n INT] [--best]` | Show hyperopt detail |

### Data & Database
| Command | Description |
|---------|-------------|
| `freqtrade show-trades [--db-url PATH] [--trade-ids IDS]` | Show trades from DB |
| `freqtrade convert-db [--db-url PATH] [--db-url-from PATH]` | Convert/transfer DB |
| `freqtrade list-hyperoptloss` | List loss functions |
| `freqtrade list-freqaimodels` | List FreqAI models |
| `freqtrade test-pairlist [-c PATH]` | Test pairlist config |

### Webserver
| Command | Description |
|---------|-------------|
| `freqtrade webserver [-c PATH]` | Start API-only mode (no trading) |

### Global Arguments
| Argument | Description |
|----------|-------------|
| `-v / -vv / -vvv` | Verbosity levels |
| `--no-color` | Disable colored output |
| `--logfile FILE` | Log file path |
| `-c / --config PATH` | Config file(s) |
| `-d / --datadir PATH` | Data directory |
| `--userdir PATH` | User data directory |

---

## 19. PLOTTING
**Docs:** https://www.freqtrade.io/en/stable/plotting/

### Installation
```bash
pip install -U -r requirements-plot.txt
```

### Plot Dataframe
```bash
freqtrade plot-dataframe [-p PAIRS] [--indicators1 LIST] [--indicators2 LIST]
  [--plot-limit INT] [--timerange RANGE] [-i TIMEFRAME]
  [--trade-source {DB,file}] [--no-trades]
```

### Plot Profit
```bash
freqtrade plot-profit [-p PAIRS] [--timerange RANGE]
  [--trade-source {DB,file}] [--auto-open] [--db-url URL]
```

### Strategy Plot Config Property
```python
plot_config = {
    "main_plot": {"indicator_name": {"color": "value"}},
    "subplots": {"subplot_name": {"indicator": {}}},
    "fill_to": {"indicator_pair": {"fill": "color"}},
    "type": "scatter|bar",
    "plotly": {}
}
```

### Plot Markers
| Marker | Meaning |
|--------|---------|
| Green triangle | Buy signal |
| Red triangle | Sell signal |
| Cyan circle | Trade entry |
| Red square | Losing/breakeven exit |
| Green square | Profitable exit |

---

## 20. DATA ANALYSIS (JUPYTER)
**Docs:** https://www.freqtrade.io/en/stable/data-analysis/

### Docker Setup
```bash
docker compose -f docker/docker-compose-jupyter.yml up
```
Access: `https://127.0.0.1:8888/lab`

### Configuration Loading in Notebook
```python
from freqtrade.configuration import Configuration
config = Configuration.from_files(["config1.json", "config2.json"])
```

### Notebook Location
- Example notebooks: `user_data/notebooks/`
- Create via: `freqtrade create-userdir --userdir user_data`

---

## 21. LOOKAHEAD ANALYSIS
**Docs:** https://www.freqtrade.io/en/stable/lookahead-analysis/

### CLI
```bash
freqtrade lookahead-analysis -s STRATEGY [-i TIMEFRAME] [--timerange RANGE]
  [-p PAIRS] [--minimum-trade-amount INT] [--targeted-trade-amount INT]
  [--lookahead-analysis-exportfilename FILE]
```

### Forced Settings (Override)
- Cache: `"none"`
- max_open_trades: >= pair count
- dry_run_wallet: ~1 billion
- stake_amount: 10,000
- Protections: Disabled
- Order types: `"market"` (unless `--allow-limit-orders`)

### Result Columns
| Column | Description |
|--------|-------------|
| `has_bias` | Lookahead bias detected |
| `total_signals` | Total entry signals |
| `biased_entry_signals` | Biased entry count |
| `biased_exit_signals` | Biased exit count |
| `biased_indicators` | Affected indicator names |

### Common Bias Sources
- `shift(-N)` — future data access
- `iloc[]` — uncontrolled index
- `.mean()` / `.min()` / `.max()` without rolling window
- Uncontrolled for-loops

---

## 22. RECURSIVE ANALYSIS
**Docs:** https://www.freqtrade.io/en/stable/recursive-analysis/

### CLI
```bash
freqtrade recursive-analysis -s STRATEGY [-i TIMEFRAME] [--timerange RANGE]
  [-p PAIRS] [--startup-candle {199,499,999,1999}]
```

### Purpose
- Calculates indicators with different startup candle counts
- Compares last-row values across configurations
- Detects recursion issues in indicator calculations
- Simple lookahead check on indicator values

---

## 23. SQL CHEAT-SHEET
**Docs:** https://www.freqtrade.io/en/stable/sql_cheatsheet/

### Open Database
```sql
-- SQLite
sqlite3 tradesv3.sqlite
.open <filepath>
.tables
.schema <table_name>
```

### Key Queries
```sql
-- All trades
SELECT * FROM trades;

-- Manual close fix
UPDATE trades SET
  is_open=0, close_date='2020-06-20 03:08:45',
  close_rate=0.19638016, close_profit=0.0496,
  close_profit_abs=(amount * close_rate * (1-fee_close)) - (amount * open_rate * (1-fee_open)),
  exit_reason='force_exit'
WHERE id=31;

-- Delete trade (with FK)
PRAGMA foreign_keys = ON;
DELETE FROM trades WHERE id = <tradeid>;
```

### Key Trade Fields
| Field | Type | Description |
|-------|------|-------------|
| `is_open` | bool | Trade open status |
| `close_date` | datetime | Exit time |
| `close_rate` | float | Exit price |
| `close_profit` | float | Profit ratio |
| `close_profit_abs` | float | Absolute profit |
| `fee_open` | float | Entry fee |
| `fee_close` | float | Exit fee |
| `exit_reason` | str | Exit reason |

---

## 24. FreqAI (MACHINE LEARNING)
**Docs:** https://www.freqtrade.io/en/stable/freqai/

### Docker Images
| Image | Contents |
|-------|----------|
| `:freqai` | Standard FreqAI |
| `:stable_freqaitorch` | + PyTorch |
| `:stable_freqairl` | + Reinforcement Learning (~700MB) |

### Core Configuration
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `freqai.enabled` | bool | false | Enable FreqAI |
| `freqai.identifier` | str | Required | Unique model run ID |
| `freqai.purge_old_models` | int | 2 | Old models to keep |
| `freqai.train_period_days` | int | Required | Training window (days) |
| `freqai.backtest_period_days` | int | Required | Backtest window (days) |
| `freqai.live_retrain_hours` | int | None | Min hours between retrains |
| `freqai.expired_hours` | int | None | Max model age for predictions |
| `freqai.continual_learning` | bool | false | Incremental learning |
| `freqai.activate_tensorboard` | bool | true | TensorBoard logging |

### Feature Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `feature_parameters.include_timeframes` | list | Timeframes for features |
| `feature_parameters.include_corr_pairlist` | list | Correlated pairs |
| `feature_parameters.include_shifted_candles` | int | Historical candle shifts |
| `feature_parameters.indicator_periods_candles` | list | Indicator period variations |
| `feature_parameters.label_period_candles` | int | Target period (future bars) |
| `feature_parameters.fit_live_predictions_candles` | int | Historical predictions for dynamic targets |
| `data_split_parameters.test_size` | float | Train/test split ratio (0-1) |

### Feature Engineering Methods
| Method | Expansion | Description |
|--------|-----------|-------------|
| `feature_engineering_expand_all(df, period, metadata)` | Periods × Timeframes × Shifts × Pairs | Full auto-expansion |
| `feature_engineering_expand_basic(df, metadata)` | Timeframes × Shifts × Pairs | No period expansion |
| `feature_engineering_standard(df, metadata)` | None | Custom features, no expansion |
| `set_freqai_targets(df, metadata)` | None | Define prediction targets |

### Column Naming Convention
| Prefix | Meaning |
|--------|---------|
| `%` | Training feature (auto-included) |
| `%%` | Plot-only feature |
| `&` | Prediction target/label |
| `do_predict` | Outlier indicator (-2 to 2) |
| `DI_values` | Dissimilarity Index (confidence) |

### Supported Models (--freqaimodel)
| Model | Type | Tasks |
|-------|------|-------|
| `LightGBMRegressor` | Gradient Boosting | Regression |
| `LightGBMClassifier` | Gradient Boosting | Classification |
| `XGBoostRegressor` | Gradient Boosting | Regression |
| `XGBoostClassifier` | Gradient Boosting | Classification |
| `CatBoostRegressor` | Gradient Boosting | Regression (deprecated) |
| `CatBoostClassifier` | Gradient Boosting | Classification (deprecated) |
| `PyTorchRegressor` | Neural Network | Regression |
| `PyTorchClassifier` | Neural Network | Classification |

### Data Pipeline
```
Raw Data → MinMaxScaler(-1,1) → VarianceThreshold → Model Training
```
Optional: SVM Outlier Removal, PCA, DBSCAN Clustering, Dissimilarity Index

### Constraints
- Incompatible with dynamic VolumePairList (use static/shuffle)
- CatBoost unavailable on ARM
- `--analyze-per-epoch` incompatible with FreqAI

---

## 25. FreqAI REINFORCEMENT LEARNING
**Docs:** https://www.freqtrade.io/en/stable/freqai-reinforcement-learning/

### RL Configuration
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `rl_config.train_cycles` | int | Required | Training iterations |
| `rl_config.add_state_info` | bool | false | Include profit/position/duration state |
| `rl_config.max_trade_duration_candles` | int | Required | Max candles per trade |
| `rl_config.max_training_drawdown_pct` | float | Required | Max DD tolerance (e.g. 0.05=5%) |
| `rl_config.cpu_count` | int | Auto | CPU cores for training |
| `rl_config.model_type` | str | "PPO" | RL algorithm |
| `rl_config.policy_type` | str | "MlpPolicy" | Network architecture |
| `rl_config.model_reward_parameters` | dict | Required | Reward scaling factors |

### RL Environments
| Environment | Actions | Mapping |
|------------|---------|---------|
| `Base3ActionRLEnv` | 3 | Hold, Long, Short |
| `Base4ActionRLEnv` | 4 | Enter Long, Enter Short, Hold, Exit |
| `Base5ActionRLEnv` | 5 | Enter Long, Enter Short, Hold, Exit Long, Exit Short |

### State Info (when add_state_info=True)
| State | Description |
|-------|-------------|
| `current_profit` | Current position profit % |
| `position_type` | Long/Short/None (0,1,2) |
| `trade_duration` | Candles held |

### RL vs Backtesting
| Aspect | RL Training | Backtesting |
|--------|-------------|-------------|
| Callbacks | Not included | Full support |
| Leverage | Not included | Full support |
| Custom SL | Not included | Full support |
| Risk Mgmt | Basic | Complex |

---

## 26. FreqAI DETAILED PARAMETERS
**Docs:** https://www.freqtrade.io/en/stable/freqai-configuration/ + https://www.freqtrade.io/en/stable/freqai-parameter-table/

### Model Lifecycle & Persistence
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `save_backtest_models` | bool | false | Save models during backtesting for live reuse |
| `live_retrain_hours` | float | 0 | Min hours between retrains (0=retrain every loop) |
| `expiration_hours` | int | 0 | Max model age for predictions (0=no limit) |
| `write_metrics_to_disk` | bool | false | Persist training/inference timing metrics |
| `data_kitchen_thread_count` | int | auto | Threads for data processing |
| `wait_for_training_iteration_on_reload` | bool | true | Wait for training on shutdown |
| `keras` | bool | false | Enable Keras model save/load |
| `reduce_df_footprint` | bool | false | Cast to float32/int32 for memory |
| `override_exchange_check` | bool | false | Force FreqAI on exchanges without historic data |
| `conv_width` | int | 2 | Neural network input tensor width |

### Feature Processing Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `feature_parameters.weight_factor` | float | 1.0 | Exponential recency weighting (higher=more recent) |
| `feature_parameters.shuffle_after_split` | bool | false | Shuffle train/test after split |
| `feature_parameters.buffer_train_data_candles` | int | 0 | Remove N candles from training edges |
| `feature_parameters.reverse_train_test_order` | bool | false | Recent data for training (reversed) |
| `feature_parameters.principal_component_analysis` | bool | false | PCA to 99.9% variance |
| `feature_parameters.noise_standard_deviation` | int | 0 | Gaussian noise for anti-overfitting |
| `feature_parameters.outlier_protection_percentage` | float | 30 | Max % data flagged as outliers |
| `feature_parameters.DI_threshold` | float | — | Dissimilarity Index threshold |
| `feature_parameters.use_SVM_to_remove_outliers` | bool | false | SVM outlier removal |
| `feature_parameters.use_DBSCAN_to_remove_outliers` | bool | false | DBSCAN outlier removal |
| `feature_parameters.svm_params.shuffle` | bool | false | Shuffle during SVM fit |
| `feature_parameters.svm_params.nu` | float | 0.1 | Expected outlier fraction |

### PyTorch/Deep Learning Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `learning_rate` | float | 3e-4 | Optimizer learning rate |
| `model_kwargs` | dict | {} | Custom model constructor params |
| `trainer_kwargs.n_epochs` | int | 10 | Training dataset passes |
| `trainer_kwargs.n_steps` | int | None | Alternative to n_epochs |
| `trainer_kwargs.batch_size` | int | 64 | Gradient update batch size |

### Data Pipeline (Default)
| Step | Component | Parameters | Purpose |
|------|-----------|-----------|---------|
| 1 | MinMaxScaler | Range: [-1, 1] | Normalize features |
| 2 | VarianceThreshold | Threshold: 0 | Remove constant columns |

### Outlier Detection Methods
| Method | Config | Description |
|--------|--------|-------------|
| Dissimilarity Index | `DI_threshold: 1.0` | Distance-based confidence scoring |
| SVM | `use_SVM_to_remove_outliers: true` | Boundary-based outlier removal |
| DBSCAN | `use_DBSCAN_to_remove_outliers: true` | Density-based clustering |
| PCA | `principal_component_analysis: true` | Dimensionality reduction |

### Developer API Classes
| Class | Lifecycle | Purpose |
|-------|-----------|---------|
| `IFreqaiModel` | Persistent singleton | Base class, override fit()/predict() |
| `FreqaiDataKitchen` | Per-asset, non-persistent | Feature scaling, metadata, processing |
| `FreqaiDataDrawer` | Persistent singleton | Model save/load, prediction history |

### IFreqaiModel Methods to Override
| Method | Signature | Description |
|--------|-----------|-------------|
| `fit` | `(data_dictionary, dk) -> model` | Train model on prepared data |
| `predict` | `(dataframe, metadata) -> (predictions, do_predict)` | Generate predictions |
| `data_cleaning_train` | `(dk) -> None` | Custom training data cleaning |
| `data_cleaning_predict` | `(dk) -> None` | Custom prediction data cleaning |
| `define_data_pipeline` | `() -> Pipeline` | Custom preprocessing pipeline |
| `define_label_pipeline` | `() -> Pipeline` | Custom label pipeline |

### Model Storage Structure
```
user_data/models/{identifier}/
├── config_{identifier}.json
├── historic_predictions.pkl
├── pair_dictionary.json
└── sub-train-{pair}_{TIMESTAMP}/
    ├── metadata/
    ├── {model_file}
    ├── pca_transform.joblib
    ├── svm_outliers.joblib
    └── training_timerange.json
```

---

## 27. BOT USAGE & CLI ARGUMENTS
**Docs:** https://www.freqtrade.io/en/stable/bot-usage/

### Core CLI Arguments
| Argument | Short | Type | Default | Description |
|----------|-------|------|---------|-------------|
| `--config` | `-c` | PATH | `config.json` | Configuration file |
| `--datadir` | `-d` | PATH | — | Historical data directory |
| `--userdir` | — | PATH | — | User data directory |
| `--version` | `-V` | — | — | Show version |

### Strategy Arguments
| Argument | Type | Description |
|----------|------|-------------|
| `--strategy` / `-s` | NAME | Strategy class name (case-sensitive) |
| `--strategy-path` | PATH | Additional strategy lookup path |
| `--recursive-strategy-search` | FLAG | Search strategies recursively |
| `--freqaimodel` | NAME | FreqAI model class name |
| `--freqaimodel-path` | PATH | Custom FreqAI model path |

### Trading Mode Arguments
| Argument | Type | Description |
|----------|------|-------------|
| `--dry-run` | FLAG | Force dry-run mode |
| `--dry-run-wallet` | FLOAT | Starting balance |
| `--fee` | FLOAT | Fee ratio (applied entry + exit) |
| `--db-url` | PATH | Override trades database URL |

### Logging Arguments
| Argument | Type | Description |
|----------|------|-------------|
| `--logfile` | FILE | Log to file (supports syslog, journald) |
| `--verbose` / `-v` | FLAG | Verbose mode (-vv, -vvv for more) |
| `--no-color` | FLAG | Disable colored output |
| `--sd-notify` | FLAG | Systemd service notify |

---

## 28. ADVANCED SETUP
**Docs:** https://www.freqtrade.io/en/stable/advanced-setup/

### Multiple Instances
- Use `--db-url` for separate databases per instance
- Default dry-run: `tradesv3.dryrun.sqlite`
- Default live: `tradesv3.sqlite`
- Each instance needs: separate Telegram config, different API port, unique container name

### Database Options
| Database | Driver | Connection String |
|----------|--------|------------------|
| SQLite (default) | built-in | `sqlite:///user_data/tradesv3.sqlite` |
| PostgreSQL | `psycopg[binary]` | `postgresql+psycopg://user:pass@localhost:5432/db` |
| MariaDB/MySQL | `pymysql` | `mysql+pymysql://user:pass@localhost:3306/db` |

### Systemd Service
- File: `~/.config/systemd/user/freqtrade.service`
- Config: `internals.sd_notify = true` or `--sd-notify` CLI
- Requires: `sudo loginctl enable-linger "$USER"`

### Logging Configuration
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `log_config` | dict | — | Python logging config |
| `maxBytes` | int | 10485760 | Max log file size (rotating) |
| `backupCount` | int | 10 | Backup log files to keep |

Supports: RotatingFileHandler, Syslog (UDP/Unix socket), Journald (`pip install cysystemd`), JSON format

---

## 29. ORDERFLOW ANALYSIS
**Docs:** https://www.freqtrade.io/en/stable/advanced-orderflow/

### Configuration
```json
{ "use_public_trades": true }
```

### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `cache_size` | int | Previous orderflow candles cached |
| `max_candles` | int | Historical trade data scope limit |
| `scale` | float | Price bin sizing for footprint charts |
| `stacked_imbalance_range` | int | Min consecutive imbalanced levels |
| `imbalance_volume` | float | Volume threshold filter |
| `imbalance_ratio` | float | Ratio threshold filter |

### Dataframe Columns
| Column | Type | Description |
|--------|------|-------------|
| `dataframe["trades"]` | list[dict] | Individual trades (timestamp, price, amount, side) |
| `dataframe["orderflow"]` | dict | Footprint chart (bid_amount, ask_amount, delta per level) |
| `dataframe["imbalances"]` | dict | Bid/ask imbalance flags per level |
| `dataframe["bid"]` | float | Total bid volume |
| `dataframe["ask"]` | float | Total ask volume |
| `dataframe["delta"]` | float | Ask - Bid volume |
| `dataframe["min_delta"]` | float | Min delta in candle |
| `dataframe["max_delta"]` | float | Max delta in candle |
| `dataframe["total_trades"]` | int | Total trade count |
| `dataframe["stacked_imbalances_bid"]` | list | Bid-side imbalance levels |
| `dataframe["stacked_imbalances_ask"]` | list | Ask-side imbalance levels |

Status: Beta feature

---

## 30. ADVANCED BACKTESTING ANALYSIS
**Docs:** https://www.freqtrade.io/en/stable/advanced-backtesting/

### CLI
```bash
freqtrade backtesting-analysis -c config.json --analysis-groups 0 1 2 3 4 5
```

### Arguments
| Argument | Type | Description |
|----------|------|-------------|
| `--analysis-groups` | int list (0-5) | Detail levels |
| `--backtest-filename` | PATH | Specific result file |
| `--backtest-directory` | PATH | Custom results directory |
| `--enter-reason-list` | str list | Entry signals to analyze |
| `--exit-reason-list` | str list | Exit signals to analyze |
| `--indicator-list` | str list | Indicator values on signal candles |
| `--timerange` | str | Date range filter |
| `--rejected-signals` | FLAG | Show rejected signals |
| `--analysis-to-csv` | FLAG | Write to CSV |
| `--analysis-csv-path` | PATH | CSV output directory |
| `--entry-only` | FLAG | Indicators at entry only |
| `--exit-only` | FLAG | Indicators at exit only |
| `--cache` | str | `none` to prevent cached results |

### Analysis Group Levels
| Level | Description |
|-------|-------------|
| 0 | Overall winrate/profit by enter_tag |
| 1 | Profit summaries by enter_tag |
| 2 | Profit summaries by enter_tag + exit_tag |
| 3 | Profit summaries by pair + enter_tag |
| 4 | Profit summaries by pair + enter_tag + exit_tag |
| 5 | Profit summaries by exit_tag |

---

## 31. FreqUI
**Docs:** https://www.freqtrade.io/en/stable/freq-ui/

### Installation
```bash
freqtrade install-ui
```

### Configuration (via config.json api_server section)
| Parameter | Type | Description |
|-----------|------|-------------|
| `jwt_secret_key` | str | JWT signing key (required) |
| `CORS_origins` | list[str] | Allowed origins (NO trailing slashes) |

### Features
- Light/dark theme toggle
- Trade visualization and interaction
- Plot configurator (uses strategy's `plot_config` dict)
- Settings: timezone, favicon open trade, candle colors, notifications
- Webserver mode: data download, pairlist testing, backtest visualization

### Access
- Default: `http://127.0.0.1:8080`
- Requires REST API authentication (same credentials)
- Fix CORS: add UI port to `CORS_origins`

---

## 32. FAQ & COMMON ISSUES
**Docs:** https://www.freqtrade.io/en/stable/faq/

### Startup
| Issue | Solution |
|-------|----------|
| "command not found" | Activate venv: `source .venv/bin/activate` |
| Bot stays STOPPED | Set `"initial_state": "running"` |
| Strategy won't load | Check case-sensitive name, .py extension, use `freqtrade list-strategies` |

### Trading
| Issue | Solution |
|-------|----------|
| No trades executing | Check logs for signals; depends on strategy/market |
| Incomplete candle repainting | Use dp.orderbook()/dp.ticker() instead |
| Coin dust prevents selling | Use exchange fee currency (e.g., BNB on Binance) |
| Deposited funds not recognized | Use `/reload_config` for immediate refresh |

### Data
| Issue | Explanation |
|-------|-------------|
| "Missing data fillup" | No trade for timeframe; auto-filled with empty candles |
| "Price jump detected" | Possible token exchange/suspension |
| "Outdated history" | Exchange downtime, wrong system time, or low volume |
| "Couldn't reuse watch" | WebSocket interruption; auto-fallback to REST API |

### Exchange/API
| Issue | Solution |
|-------|----------|
| "Does not support market orders" | Set `order_types.stoploss: "limit"` |
| API permission error | Check API keys, IP whitelist, "Spot Trading" permission |
| Reset database | Delete `tradesv3.sqlite` or use `--db-url` with new path |

---

## 33. DEPRECATED FEATURES
**Docs:** https://www.freqtrade.io/en/stable/deprecated/

### Removed CLI Options
| Argument | Removed | Alternative |
|----------|---------|-------------|
| `--refresh-pairs-cached` | 2019.9 | `freqtrade download-data` |
| `--dynamic-whitelist` | 2019.7 | `pairlists` config |
| `--live` | 2019.8 | `freqtrade download-data` |

### Config Changes
| Old | New | Removed |
|-----|-----|---------|
| `ticker_interval` | `timeframe` | 2022.3 |
| `pairlist` (single) | `pairlists` (list) | 2020.4 |
| `protections` in config | In strategy class | 2024.10 |
| Funding rate 8h | 1h timeframe | 2025.12 |

### Removed Features
| Feature | Removed | Alternative |
|---------|---------|-------------|
| Edge module | 2025.6 | N/A |
| HDF5 storage | 2025.1 | Feather format + `convert-data` |
| CatBoost models | 2025.12 | LightGBM or XGBoost |
| Legacy Hyperopt | 2021.9 | Parametrized strategies |
| `populate_any_indicators()` | 2023.3 | Split feature engineering methods |

---

## 34. V2 TO V3 STRATEGY MIGRATION
**Docs:** https://www.freqtrade.io/en/stable/strategy_migration/

### Method Renames
| V2 | V3 |
|----|----|
| `populate_buy_trend()` | `populate_entry_trend()` |
| `populate_sell_trend()` | `populate_exit_trend()` |
| `check_buy_timeout()` | `check_entry_timeout()` |
| `check_sell_timeout()` | `check_exit_timeout()` |
| `custom_sell()` | `custom_exit()` |

### Column Renames
| V2 | V3 | Description |
|----|----|----|
| `buy` | `enter_long` | Long entry signal |
| `sell` | `exit_long` | Long exit signal |
| `buy_tag` | `enter_tag` | Entry tag |
| N/A | `enter_short` | Short entry (new) |
| N/A | `exit_short` | Short exit (new) |

### Config Renames
| V2 Key | V3 Key |
|--------|--------|
| `order_types.buy` | `order_types.entry` |
| `order_types.sell` | `order_types.exit` |
| `unfilledtimeout.buy` | `unfilledtimeout.entry` |
| `unfilledtimeout.sell` | `unfilledtimeout.exit` |
| `bid_strategy` | `entry_pricing` |
| `ask_strategy` | `exit_pricing` |
| `use_sell_signal` | `use_exit_signal` |
| `sell_profit_only` | `exit_profit_only` |
| `ignore_roi_if_buy_signal` | `ignore_roi_if_entry_signal` |

### Callback Changes (added `side` param)
- `confirm_trade_entry()` — added `side: str`
- `custom_stake_amount()` — added `side: str`
- `custom_entry_price()` — added `trade: Trade | None`, `side: str`
- `confirm_trade_exit()` — `sell_reason` → `exit_reason`
- `stoploss_from_open()` — `is_short: bool` now required
- `stoploss_from_absolute()` — `is_short: bool` now required

### Required
```python
INTERFACE_VERSION = 3
```

---

*Generated: March 27, 2026 (Final) | FreqTrade version: 2026.2*
*Source: https://www.freqtrade.io/en/stable/*
*Sections: 34 total — COMPLETE COVERAGE of all FreqTrade documentation pages*
