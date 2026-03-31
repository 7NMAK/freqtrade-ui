# PROMPT: Dashboard (Control Room) — Complete Implementation Spec

## Goal

Build the main **Control Room** dashboard — a single-page, high-density analyst workspace that provides real-time oversight of ALL bots, trades, performance, and system health. This is the primary screen users see after login.

---

## Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Title + Global Fuzzy Search (⌘K)                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI BAR — 2 rows × 7 columns (14 metrics total)                            │
├────────────┬──────────────────────────────────────────┬──────────────────────┤
│ COL 1      │ COL 2                                    │ COL 3               │
│ Bot Fleet  │ P&L Chart + Profit Distribution          │ Balance             │
│ 400px      │ (flex-1)                                 │ Fees & Costs        │
│            │                                          │ Telemetry           │
│ 2+ bot     ├──────────────────────────────────────────┤ Terminal StdOut     │
│ cards with │ Trade Engine — 5 tabs:                   │ 320px fixed         │
│ 6-button   │ Open | Closed | Whitelist | Perf | Tags  │                     │
│ control    │                                          │                     │
│ bars       │                                          │                     │
├────────────┴──────────────────────────────────────────┴──────────────────────┤
│ BOT DRAWER (slide-in from left, overlay)                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Section 1: KPI Bar (14 Metrics, 2 Rows)

Aggregated across ALL running bots. Sources: `FTProfit`, `FTBalance`, `FTStats`, `FTCount`

### Row 1 (large values, p-4)

| KPI | Source | Color Logic |
|---|---|---|
| **Total Equity** | `balance.total` summed | White |
| **Locked in Trades** | `balance.total - free balance` | White + muted % |
| **Today's P&L** | `daily.data[0].abs_profit` | Green/Red |
| **Total P&L (Closed)** | `profit.profit_closed_coin` | Green/Red |
| **Open P&L (Unreal.)** | `profit.profit_open_coin` | Green/Red |
| **Open Trades** | `count.current` / `count.max` | White + muted "/ max" |
| **Max Drawdown** | `stats.max_drawdown` | Red always |

### Row 2 (smaller values, p-3)

| KPI | Source | Color Logic |
|---|---|---|
| **Win Rate** | `profit.winning_trades / (winning + losing)` | White + muted "W / L" |
| **Profit Factor** | `stats.profit_factor` | Green if > 1.0 |
| **Avg Duration** | `profit.avg_duration` | White |
| **Total Trades** | `profit.trade_count` | White |
| **Best Pair** | `profit.best_pair` + `profit.best_rate` | Green |
| **Sharpe Ratio** | `stats.sharpe_ratio` | White |
| **Trading Volume** | `stats.trading_volume` | White |

### Styling
- Container: `rounded-md bg-white/10 l-bd overflow-hidden`
- Each cell: `bg-black hover:bg-white/[0.03] transition-colors`
- Rows separated by `border-t border-white/10`
- Labels: `kpi-label` (11px uppercase muted)
- Values: `kpi-value font-mono font-bold`

---

## Section 2: Bot Fleet (Col 1, 400px)

Sources: Orchestrator `GET /api/bots`, per-bot `FTProfit`, `FTShowConfig`

### Each Bot Card Contains:
- **Header row**: Bot name (clickable → opens drawer), status badge, exchange icon
- **Stats grid**: 4 KPIs per bot:
  - Today's P&L, Total Profit, Win Rate, Active Trades
- **6-Button Control Bar**:

| Button | API Function | Color |
|---|---|---|
| **Start** | `startBot(id)` → `POST /api/bots/{id}/start` | Green |
| **Stop** | `stopBot(id)` → `POST /api/bots/{id}/stop` | Red |
| **Pause** | `botPause(id)` → `POST /api/bots/{id}/pause` | White |
| **Reload** | `reloadBotConfig(id)` → `POST /api/bots/{id}/reload-config` | White |
| **Force Exit All** | `botForceExit(id, 'all')` → `POST /api/bots/{id}/forceexit` | Red |
| **Stopbuy** | `botStopBuy(id)` → `POST /api/bots/{id}/stopbuy` | Yellow |

### Bot Drawer (slide-in overlay)
Opens when clicking bot name. Contains:
- Bot controls (start/stop/reload)
- RPC Actions (force enter, force exit all, toggle stopbuy)
- Tail log (last 20 log lines from `/api/v1/logs`)
- Full config view from `show_config`

---

## Section 3: P&L Charts (Col 2 Top)

Sources: `FTDailyResponse`, `FTWeeklyResponse`, `FTMonthlyResponse`

### Chart Type: Bars + Thin Line overlay
- **Bars**: Absolute profit per period (green = profit, red = loss)
- **Thin line**: Cumulative profit curve
- **Style**: `stroke-width: 0.4`, dot radius: `1.2`

### Tabs (timeframe switching):
- Days | Weeks | Months (switch API endpoint)
- Abs $ | Rel % (toggle y-axis data)

### Secondary: Profit Distribution Histogram
- Small histogram below main chart showing profit distribution spread

---

## Section 4: Trade Engine (Col 2 Bottom) — 5 Tabs

The main tabular engine with switchable views.

### Tab 1: Open Trades
Source: `GET /api/v1/status` (per bot, aggregated)

| Column | Field | Notes |
|---|---|---|
| Date & Time | `open_date` | Format: DD.MM.YY HH:mm |
| Pair | `pair` | Bold white |
| Bot Logic | `_bot_name` (tagged by orchestrator) | Muted, 12px |
| Side | `is_short` → LONG/SHORT + leverage | Badge: green/red |
| Size | `amount` | Muted |
| Entry | `open_rate` | — |
| Mark Price | `current_rate` | Bold |
| Profit % | `current_profit` | Green/Red bg highlight |
| Value | `current_profit_abs` | Green/Red bg highlight |
| **Fee** | `fee_open` × `stake_amount` | Muted, 11px |
| Age | `now - open_date` | Muted |
| Actions | Dropdown menu | See below |

#### Actions Dropdown (per trade):
- Forceexit limit → `botForceExit(botId, tradeId, 'limit')`
- Forceexit market → `botForceExit(botId, tradeId, 'market')`
- Forceexit partial → Custom amount (not yet in API)
- Increase position → `botForceEnter(botId, pair, side, stake)`
- Reload → `botReloadTrade(botId, tradeId)`
- Cancel open order → `botCancelOpenOrder(botId, tradeId)`
- Delete trade → `botDeleteTrade(botId, tradeId)`

### Tab 2: Closed Trades
Source: `GET /api/v1/trades` (per bot, aggregated)

| Column | Field |
|---|---|
| Date | `close_date` |
| Pair | `pair` |
| Bot | `_bot_name` |
| Side | `is_short` → LONG/SHORT + leverage |
| Entry | `open_rate` |
| Exit | `close_rate` |
| Profit % | `close_profit` |
| Value | `close_profit_abs` |
| **Fee** | `(fee_open + fee_close) × stake_amount` |
| Duration | `close_date - open_date` |
| Exit Reason | `exit_reason` |

### Tab 3: Whitelist Matrix
→ See `PROMPT-WHITELIST-MATRIX.md` for full spec

### Tab 4: Performance by Pair
Source: `botPerformance(botId)` → `GET /api/bots/{id}/performance`

Returns `FTPerformance[]` per bot, aggregate by pair across all bots.

| Column | Field |
|---|---|
| Pair | `pair` |
| Trades | `count` |
| Wins | calculated from trade data |
| Losses | calculated from trade data |
| Win Rate | calculated: `wins / count` |
| Profit % | `profit` (this is the ratio × 100) |
| Profit Abs | `profit_abs` |
| Avg Profit | `profit / count` |
| Total Fees | Summed from individual trades |

### Tab 5: Entry / Exit Tags
Sources: `botEntries(botId)` → `GET /api/bots/{id}/entries`, `botExits(botId)` → `GET /api/bots/{id}/exits`

**Split-view layout**: Entry Tags (left half) | Exit Reasons (right half)

Each side shows:

| Column | Field |
|---|---|
| Tag / Reason | `enter_tag` or `exit_reason` |
| Count | `entries` or `exits` |
| Wins | `wins` |
| Losses | `losses` |
| Win Rate | `winrate` |
| Profit | `profit_abs` |

---

## Section 5: Sidebar (Col 3, 320px)

### Widget 1: Balance Breakdown
Source: `GET /api/v1/balance`

Shows each currency:
- Symbol (USDT, BTC, ETH, SOL)
- Amount (`free` or `balance`)
- Fiat equivalent (`est_stake` × price)
- Starting capital from `balance.starting_capital`

### Widget 2: Fees & Costs
Source: Calculated from `FTTrade` data + `FTStats`

| Metric | Calculation |
|---|---|
| Total Fees Paid | Sum of `(fee_open + fee_close) × stake_amount` across all closed trades |
| Entry Fees (avg) | Average `fee_open` across trades |
| Exit Fees (avg) | Average `fee_close` across trades |
| Funding Fees | Sum of `funding_fees` from all trades (futures only) |
| Fees / Gross Profit | `total_fees / gross_profit × 100` |
| Net vs Gross | `(gross - fees)` / `gross` |

### Widget 3: Node Telemetry
Source: `GET /api/v1/sysinfo`, exchange latency

- CPU bar: `sysinfo.cpu_pct` average
- RAM bar: `sysinfo.ram_pct` (yellow if >80%, red if >95%)
- Exchange latency: measured from API response times
- FT Process: `health.last_process` → time since last process
- DB Sync: heartbeat status

### Widget 4: Terminal StdOut
Source: `GET /api/v1/logs`

- Streaming log view, auto-scroll
- Color-coded: INFO (blue), BUY/FILL (green), SELL (red), WARN (red), HTTP (yellow)
- Format: `HH:mm:ss LEVEL Message`
- Green pulse indicator: "Streaming"

---

## Design System Constants

```css
/* Colors */
--up: #22c55e;      /* Green — profit, buy, active */
--down: #ef4444;    /* Red — loss, sell, locked */
--muted: #6b7280;   /* Gray — labels, secondary */
--surface: #111;    /* Card backgrounds */

/* Typography */
font-family: 'Inter', system-ui;     /* UI text */
font-family: 'JetBrains Mono', mono; /* Data values */

/* Borders */
.l-bd { border: 1px solid rgba(255,255,255,0.08); }
.l-b  { border-bottom: 1px solid rgba(255,255,255,0.08); }

/* Common patterns */
.kpi-label: text-[11px] uppercase tracking-widest text-muted font-sans
.kpi-value: font-mono font-bold text-white
.section-title: text-[11px] uppercase tracking-widest text-white/50 font-bold font-sans
```

## Interaction Patterns

| Pattern | Implementation |
|---|---|
| Tab switching | `switchTradeTab(tabId, btn)` — hide all `.trade-tab-content`, show selected |
| Action dropdown | `toggleActionMenu(btn, event)` — toggle `.action-dropdown.open` class |
| Bot drawer | `openBotDrawer(name, mode)` — slide-in overlay from left |
| Close on outside click | Global `document.addEventListener('click', ...)` |
| Auto-refresh | 10-second polling interval for all data sources |

## API Dependencies Summary

| Endpoint | Function | Used In |
|---|---|---|
| `GET /api/bots/{id}/profit` | `botProfit(id)` | KPI bar, multiple widgets |
| `GET /api/bots/{id}/balance` | `botBalance(id)` | KPI bar, Balance widget |
| `GET /api/bots/{id}/daily` | `botDaily(id)` | P&L chart |
| `GET /api/bots/{id}/weekly` | `botWeekly(id)` | P&L chart |
| `GET /api/bots/{id}/monthly` | `botMonthly(id)` | P&L chart |
| `GET /api/bots/{id}/status` | `botStatus(id)` | Open Trades tab, KPI bar |
| `GET /api/bots/{id}/trades` | `botTrades(id)` | Closed Trades tab |
| `GET /api/bots/{id}/count` | ⚠️ COMMENTED OUT | KPI bar — use `botStatus` length instead |
| `GET /api/bots/{id}/stats` | `botStats(id)` | KPI bar (sharpe, PF, drawdown) |
| `GET /api/bots/{id}/performance` | `botPerformance(id)` | Performance tab |
| `GET /api/bots/{id}/entries` | `botEntries(id)` | Entry/Exit tab |
| `GET /api/bots/{id}/exits` | `botExits(id)` | Entry/Exit tab |
| `GET /api/bots/{id}/whitelist` | `botWhitelist(id)` | Whitelist Matrix tab |
| `GET /api/bots/{id}/locks` | `botLocks(id)` | Whitelist Matrix tab |
| `GET /api/bots/{id}/config` | `botConfig(id)` | Bot drawer, bot fleet |
| `GET /api/bots/{id}/sysinfo` | `botSysinfo(id)` | Telemetry widget |
| `GET /api/bots/{id}/logs` | `botLogs(id)` | Terminal widget |
| `GET /api/bots/{id}/health` | `botHealth(id)` | Telemetry widget |
| `POST /api/bots/{id}/forceexit` | `botForceExit(id, tradeId, ordertype)` | Trade actions |
| `POST /api/bots/{id}/forceenter` | `botForceEnter(id, pair, side, stake)` | Trade actions |
| `DELETE /api/bots/{id}/trades/{tid}` | `botDeleteTrade(id, tradeId)` | Trade actions |
| `POST /api/bots/{id}/trades/{tid}/reload` | `botReloadTrade(id, tradeId)` | Trade actions |
| `POST /api/bots/{id}/locks` | `botLockAdd(id, { pair, until, reason })` | Whitelist Matrix |
| `DELETE /api/bots/{id}/locks/{lid}` | `botDeleteLock(id, lockId)` | Whitelist Matrix |
| `GET /api/portfolio/balance` | `portfolioBalance()` | Aggregated balance |
| `GET /api/portfolio/profit` | `portfolioProfit()` | Aggregated profit |
| `GET /api/portfolio/trades` | `portfolioTrades()` | Aggregated trades |

## Reference Files

- **Prototype HTML**: `prototypes/DESIGN-LINEAR-EDGE-FULL.html`
- **Whitelist Matrix spec**: `prototypes/PROMPT-WHITELIST-MATRIX.md`
- **Types**: `frontend/src/types/index.ts`
- **API functions**: `frontend/src/lib/api.ts`
- **Existing dashboard**: `frontend/src/app/dashboard/page.tsx`
- **Bot detail panel**: `frontend/src/components/dashboard/BotDetailPanel.tsx`
