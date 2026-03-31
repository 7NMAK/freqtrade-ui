# PROMPT: Dashboard (Control Room) — Complete Implementation Spec

## Goal

Build the main **Control Room** dashboard — a single-page, high-density analyst workspace that provides real-time oversight of ALL bots, trades, performance, and system health. This is the primary screen users see after login.

---

## Layout Architecture

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│ SIDE   │ HEADER: Title + Search (⌘K) + [🛡 Soft Kill All] [⚡ Hard Kill All] │
│ MENU   ├─────────────────────────────────────────────────────────────────────┤
│        │ KPI BAR — 2 rows × 7 columns (14 metrics total)                   │
│ Collap-├────────────┬──────────────────────────────┬────────────────────────┤
│ sible  │ COL 1      │ COL 2                        │ COL 3                 │
│ 240px  │ Bot Fleet  │ P&L Chart + Distribution     │ Balance               │
│ → 56px │ 400px      │ (flex-1)                     │ Fees & Costs          │
│        │            │                              │ Telemetry             │
│ Icons  │ ALL bots   ├──────────────────────────────┤ Terminal StdOut       │
│ only   │ expanded   │ Trade Engine — 5 tabs:       │ 320px fixed           │
│ when   │ with 8-btn │ Open|Closed|WL|Perf|Tags     │                       │
│ closed │ control    │                              │                       │
│        │ bars       │                              │                       │
│        │ + P&L %    │                              │                       │
│        │ [Compare]→ │                              │                       │
│        │ Fleet page │                              │                       │
├────────┼────────────┴──────────────────────────────┴────────────────────────┤
│        │ BOT DRAWER (slide-in from right, overlay)                          │
└────────┴───────────────────────────────────────────────────────────────────────┘
```

---

## Section 0: Collapsible Sidebar Navigation

### Behavior
- **Expanded** (default): `width: 240px` — shows icon + label text
- **Collapsed**: `width: 56px` — shows icons only
- Toggle via `«` (chevrons-left) button in sidebar header — rotates 180° when collapsed
- Smooth CSS transition: `transition: width 0.25s ease`

### Structure
```
┌─────────────────────┐     ┌────┐
│ FT  Orchestrator V4 «│     │ FT »│
├─────────────────────┤     ├────┤
│ 📊 Control Room      │     │ 📊 │
│ 🧪 Experiments       │     │ 🧪 │
│ 📋 Strategies        │     │ 📋 │
│ ⚙  System            │     │ ⚙  │
│                      │     │    │
│ 🟢 LIVE Trading      │     │ 🟢 │
│ Bin: 32ms  Krk: 45ms │     │    │
└─────────────────────┘     └────┘
     EXPANDED                 COLLAPSED
```

### CSS Classes for Collapse
- `#side-menu.collapsed .nav-label` → `display: none`
- `#side-menu.collapsed .sidebar-title` → `display: none`
- `#side-menu.collapsed .sidebar-footer-text` → `display: none`
- `#side-menu.collapsed nav button` → `justify-content: center; padding: 0`
- `#side-menu.collapsed .toggle-btn` → `transform: rotate(180deg)`

### Footer Status
- Green pulse dot: `bg-up shadow-[0_0_6px_#22c55e]`
- Exchange latencies: `font-mono text-[11px] text-up`

---

## Section 0.5: Header Bar

### Layout: `flex justify-between items-center h-14 sticky top-0`

| Element | Position | Description |
|---|---|---|
| Page title | Left | `CONTROL ROOM` / `FLEET MANAGEMENT` / `EXPERIMENTS MATRIX` — uppercase, tracking-widest |
| Global search | Center | `⌘K` fuzzy search across bots, pairs, configs — `w-96 bg-black l-bd rounded-lg` |
| **Soft Kill All** | Right | Yellow border+bg, `shield-alert` icon — exits all trades on ALL bots |
| **Hard Kill All** | Right | Red border+bg, `zap` icon — stops ALL bots + containers |

#### Global Kill Switch Buttons
```html
<button class="h-8 px-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 
        text-yellow-400 text-[11px] font-bold uppercase">
    🛡 Soft Kill All
</button>
<button class="h-8 px-3 rounded-md border border-red-500/40 bg-red-500/10 
        text-red-400 text-[11px] font-bold uppercase">
    ⚡ Hard Kill All
</button>
```
- Both must trigger a **confirmation modal** with reason textarea before executing.
- API: `softKillAll(reason)` → `POST /api/kill-switch/soft-all`
- API: `hardKillAll(reason)` → `POST /api/kill-switch/hard-all`

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

### Column Header
- Title: `Fleet Management (312)` with layers icon
- **Compare View** button → navigates to Fleet Management page
  - Icon: `git-compare`, tooltip: "Open Fleet Management — Compare all bots side by side"

### ALL Bots Displayed in Expanded Format (scrollable)
Every bot uses the same expanded card format — NO compact rows. This ensures control buttons are always accessible.

### Each Bot Card Contains:
- **Header row**: 
  - Status dot: 🟢 green (running), 🟡 yellow (paused), 🔴 red (stopped)
  - Bot name: `font-bold uppercase text-[12px] tracking-wide` — clickable → opens drawer
  - Status badge: `LIVE` (border-white), `PAUSED` (border-yellow), `STOPPED` (border-red)
  - **P&L $ + P&L %**: e.g. `+$48.20 +2.4%`
    - Percentage uses `style="color:rgba(34,197,94,0.5)"` for green or `rgba(239,68,68,0.5)` for red
    - ⚠️ Do NOT use Tailwind `text-up/60` — CDN doesn't support opacity on custom colors
- **Stats grid**: 2×2 grid, `text-muted text-[12px]`:
  - Trades count, Win Rate, Drawdown (always red), Avg Duration
- **Sparkline**: 5-bar mini chart (`w-1.5` bars, green/red)
- **8-Button Control Bar** (visible on hover, `opacity-50 → opacity-100`):

| # | Icon | Tooltip | API Function | Color |
|---|---|---|---|---|
| 1 | `play` | `▶ Start Bot — Resume trading engine` | `startBot(id)` → `POST /api/bots/{id}/start` | Green |
| 2 | `square` | `■ Stop Bot — Gracefully stop trading` | `stopBot(id)` → `POST /api/bots/{id}/stop` | Red |
| 3 | `pause` | `⏸ Pause — Stop opening new trades` | `botPause(id)` → `POST /api/bots/{id}/pause` | Yellow |
| 4 | `refresh-cw` | `↻ Reload Config — Hot-reload strategy config` | `reloadBotConfig(id)` → `POST /api/bots/{id}/reload-config` | White |
| 5 | `x-square` | `✕ Force Exit All — Close all open positions` | `botForceExit(id, 'all')` → `POST /api/bots/{id}/forceexit` | Red |
| 6 | `plus-square` | `⊞ Toggle Stopbuy — Prevent new buy orders` | `botStopBuy(id)` → `POST /api/bots/{id}/stopbuy` | White |
| — | — | **vertical divider** `w-px h-3 bg-white/15` | — | — |
| 7 | `shield-alert` | `🛡 Soft Kill — Exit all trades, keep bot alive` | `softKill(id, reason)` → `POST /api/kill-switch/soft/{id}` | Yellow |
| 8 | `zap` | `⚡ Hard Kill — Force stop bot + container` | `hardKill(id, reason)` → `POST /api/kill-switch/hard/{id}` | Red |

> **Soft Kill**: Forcefully exits ALL open trades (market orders), keeps bot process running.  
> **Hard Kill**: Stops the bot AND its Docker container immediately. Nuclear option.

### Bot Status Visual States
- **Running**: Green dot with glow (`shadow-[0_0_4px_#22c55e]`), white name, `LIVE` badge
- **Paused**: Yellow dot (no glow), dimmed name (`text-white/60`), `PAUSED` badge in yellow
- **Stopped**: Red dot, very dimmed name (`text-white/40`), `STOPPED` badge in red

### Bot Drawer (responsive full-width overlay)

#### Layout & Sizing
- **Responsive width**: Fills all space right of Col 1 (Bot Fleet)
  - `left: calc(var(--sidebar-width) + 400px); right: 0; width: auto;`
  - When sidebar expanded (240px): left = 640px
  - When sidebar collapsed (56px): left = 456px
  - Scales proportionally with screen resolution
- Animation: `translateX(100%) → translateX(0)`, `cubic-bezier(0.16, 1, 0.3, 1)` 0.3s
- Backdrop: `rgba(0,0,0,0.6)` + `backdrop-filter: blur(3px)`
- Click backdrop to close
- Col 1 (Bot Fleet) remains visible and interactive

#### Drawer Header
Opens when clicking bot name or bot card row. Contains:
- Close button: `×` icon, left side, `w-8 h-8`
- Bot name: `font-bold text-base font-mono text-white`
- Status badge: `LIVE` / `PAUSED` / `STOPPED` / `DRAINING`
- Subtitle: `Strategy: {name} · {exchange} · {status}` — `text-xs text-muted font-mono`

**9 Action Buttons** (all in one row in header):

| # | Icon | Label | Tooltip | Hover Color |
|---|---|---|---|---|
| 1 | `play` | Start | `▶ Start Bot — Resume trading engine` | Green |
| 2 | `square` | Stop | `■ Stop Bot — Gracefully stop trading` | Red |
| 3 | `pause` | Pause | `⏸ Pause — Stop opening new trades` | Yellow |
| 4 | `refresh-cw` | Reload | `↻ Reload Config — Hot-reload strategy config` | White |
| 5 | `plus-circle` | Force Enter | `Force open a new trade manually` | Green |
| 6 | `x-square` | Force Exit | `✕ Force Exit All — Close all open positions` | Red |
| 7 | `plus-square` | Stopbuy | `⊞ Toggle Stopbuy — Prevent new buy orders` | White |
| — | divider | `w-px h-4 bg-white/15` | — | — |
| 8 | `shield-alert` | Soft Kill | `🛡 Soft Kill — Exit all trades, keep bot alive` | Yellow |
| 9 | `zap` | Hard Kill | `⚡ Hard Kill — Force stop bot + container` | Red |

#### 10-Tab Navigation

```
[ Overview | Trades | Performance | Config | System | Log | Backtest | Hyperopt | FreqAI | Edit Bot ]
```

- Tab bar: `h-12 border-b`, active = `border-b-2 border-white text-white`, inactive = `text-muted`
- Tabs scroll horizontally if needed on smaller screens
- Tab switching via `switchDrawerTab(tabId, btn)` function

| Tab | ID | Source APIs |
|---|---|---|
| Overview | `drawer-overview` | `botProfit`, `botStats`, `botBalance`, `botConfig` |
| Trades | `drawer-trades` | `botStatus`, `botTrades` |
| Performance | `drawer-perf` | `botPerformance`, `botEntries`, `botExits` |
| Config | `drawer-config` | `botConfig`, `botLocks` |
| System | `drawer-system` | `botSysinfo`, `botHealth` |
| Log | `drawer-log` | `botLogs` |
| Backtest | `drawer-backtest` | `botBacktestStart`, `botBacktestResults`, `botBacktestHistory` |
| Hyperopt | `drawer-hyperopt` | `botHyperoptStart`, `botHyperoptStatus`, `botHyperoptList` |
| FreqAI | `drawer-freqai` | FreqAI config endpoints |
| Edit Bot | `drawer-edit` | `botConfig` (read + write) |

#### Tab 1: Overview
Sources: `FTShowConfig`, `FTProfit`, `FTStats`, `FTBalance`

**Bot Configuration** (key-value rows):
Exchange, Strategy, Timeframe, Trading Mode, Margin Mode, Stake Currency, Stake Amount, Max Open Trades, Dry Run, Pairs Count

**P&L Summary** (2×2 grid cards):
Closed Profit (`profit_closed_coin`), Total Profit (`profit_all_coin`), Trade Count, Win Rate

**Advanced Stats** (key-value rows):
Profit Factor, Max Drawdown (red), Sharpe Ratio, Sortino Ratio

**Wallet Balance** (per-currency rows):
Currency name, Free amount, Est. value in fiat

#### Tab 2: Trades
Sources: `botStatus(id)`, `botTrades(id)`

**Open Positions (N)** — table: Pair, Side (LONG/SHORT badge), Entry, Current, P&L
**Closed Trades (Last 10)** — table: Pair, Side, Entry, Exit, P&L

#### Tab 3: Performance
Sources: `botPerformance(id)`, `botEntries(id)`, `botExits(id)`

**Per-Pair Performance** — table: Pair, Trades, Profit
**Entry Tag Analysis (Top 5)** — table: Tag, Trades, Profit
**Exit Reason Analysis (Top 5)** — table: Reason, Trades, Profit

#### Tab 4: Config
Sources: `botConfig(id)`, `botLocks(id)`

**Core Config**: Exchange, Timeframe, Stake Currency, Dry Run
**ROI & Stoploss**: Stoploss %, Trailing Stop, Trailing Positive, Trailing Offset, Minimal ROI table
**Whitelist**: Pair chips from `pair_whitelist[]`
**Active Locks**: table — Pair, Reason, Until

#### Tab 5: System
Sources: `botSysinfo(id)`, `botHealth(id)`

**System Info**: CPU % (progress bar), Memory % (bar, yellow >80%, red >95%)
**Bot Health**: Last Process, Last Process TS

#### Tab 6: Log
Source: `botLogs(id, limit)` — `GET /api/bots/{id}/logs?limit=50`

Full-height dedicated streaming log viewer.
**Header bar**: Log level filter (ALL | INFO | BUY/SELL | WARN | ERROR), Pin-to-bottom toggle, Refresh button, entry count
**Log viewer**: `font-mono text-[11px]` on `bg-[#060606]`, full height scrollable
**Colors**: INFO=blue-400, BUY/FILL=green bold, SELL/EXIT=red bold, WARN=yellow-500, ERROR=red-500 bold, HTTP=yellow-500, DEBUG=white/30
**Polling**: Every 5 seconds when tab is active

#### Tab 7: Backtest (per-bot)
Sources: `botBacktestStart(id)`, `botBacktestResults(id)`, `botBacktestHistory(id)`

Run backtest using THIS bot's strategy.
**Config form**: Strategy (pre-filled), Timeframe, Fee %, Timerange
**Execute button** → `botBacktestStart(id, params)`
**Results**: Total Profit, Max Drawdown, Win Rate (3 KPI cards) + trade list table
**History**: Previous runs from `botBacktestHistory(id)`

#### Tab 8: Hyperopt (per-bot)
Sources: `botHyperoptStart(id)`, `botHyperoptStatus(id)`, `botHyperoptList(id)`

Optimize THIS bot's parameters.
**Config form**: Epochs, Loss Function, Search Space
**Run button** → `botHyperoptStart(id, params)`
**Live log**: Streaming epoch results
**Results**: Best parameters from `botHyperoptList(id)`

#### Tab 9: FreqAI (per-bot)
ML model training for THIS bot.
Model type selector, training status/progress, feature importance (placeholder)

#### Tab 10: Edit Bot
Sources: `botConfig(id)` read + write

Edit bot configuration in-place.
- Strategy selector (from `botFtStrategies(id)`)
- Pair whitelist editor (add/remove chips)
- Stoploss / ROI editor
- Key config field forms
- Save button → writes config back

#### Drawer Footer
| Button | Action | Style |
|---|---|---|
| Edit Bot Settings | switches to Edit Bot tab | Neutral border |
| Close Panel | `closeBotDrawer()` | White bg, black text |

---

## Section 2.5: Fleet Management Page (Compare View)

Accessed via **Compare View** button in Bot Fleet header. NOT in sidebar nav.

### Navigation
- `← Dashboard` back button in page header → returns to Control Room
- Header title changes to `FLEET MANAGEMENT` in top bar

### Fleet Page Header
- Back button: `← Dashboard` (clickable, returns to page-dashboard)
- Title: `FLEET MANAGEMENT`
- Status counters: `312 bots` badge, `🟢 284 running`, `🟡 16 paused`, `🔴 12 stopped`
- Actions: `[Compare Selected]` + `[Export CSV]` buttons

### Fleet Table (15 Columns)

| # | Column | Align | Notes |
|---|---|---|---|
| 1 | ☐ Checkbox | Left | Select for comparison, select-all in header |
| 2 | Status | Left | `RUN` (green dot), `PAUSE` (yellow), `STOP` (red) |
| 3 | Bot Name | Left | `font-bold text-white`, dimmed for PAUSE/STOP |
| 4 | Strategy | Left | `font-sans text-[11px] text-muted` |
| 5 | Exchange | Left | `text-muted` |
| 6 | Balance | Right | Current balance |
| 7 | Today P&L | Right | `bg-up/5` or `bg-down/5`, bold |
| 8 | Total P&L | Right | `bg-up/5` or `bg-down/5` |
| 9 | **P&L %** | Right | `bg-up/5` or `bg-down/5`, `text-[11px]` |
| 10 | Win Rate | Right | Green/Red based on value |
| 11 | Trades | Right | Total count |
| 12 | Open | Right | Currently open trades |
| 13 | Drawdown | Right | Always `text-down` |
| 14 | Avg Dur | Right | Average trade duration |
| 15 | Actions | Center | **Full 8-button control bar** (same as bot cards) |

### Table Styling
- Header: `sticky top-0 bg-surface font-mono text-[10px] uppercase tracking-widest`
- Rows: `hover:bg-white/[0.04]`, alternating `bg-white/[0.015]`
- Row click → opens Bot Drawer
- Action buttons: mini `22×22px` version, `gap-0.5`

### Table Footer
- `Showing X of 312 bots`
- Sort indicator, Filter selector, Pagination

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
- Right panel inside chart container, `w-[300px]`
- Vertical bars with gradient opacity (`bg-down/60` to `bg-up/80`)
- Below histogram: **Absolute DD** (e.g. `-$5,210` red) + **Relative DD** (e.g. `-4.12%` red)
- X-axis labels: `-0.02`, `0`, `+0.01`

### SVG Chart Details
- `viewBox="0 0 200 100"`, `preserveAspectRatio="none"`
- Zero line: `stroke-dasharray="3,3"`, `rgba(255,255,255,0.08)`
- Trade count bars: semi-transparent `rgba(255,255,255,0.12)` rectangles
- P&L line: `stroke="#22c55e"`, `stroke-width="0.4"`, dots `r="1.2"`
- Y-axis labels: `text-[9px] font-mono text-white/25`
- X-axis labels: date format `MM-DD`

---

## Section 4: Trade Engine (Col 2 Bottom) — 5 Tabs

The main tabular engine with switchable views.

### Tab Bar
- Height: `h-12`, background: `bg-black/40 l-b`
- Active tab: `border-b-2 border-white text-white`
- Inactive tabs: `text-muted hover:text-white`
- Right side: CSV export button

### Tab Tooltips
| Tab | Tooltip |
|---|---|
| Open Trades (42) | `Currently active trades` |
| Closed (1284) | `Completed trade history` |
| Whitelist Matrix | `Pair monitoring and lock management` |
| Performance | `Performance by trading pair` |
| Entry / Exit | `Entry and exit tag analysis` |

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

Note: HTML prototype includes additional statuses beyond ACTIVE/LOCKED:
- **COOLDOWN**: yellow badge (`bg-yellow-500/12 text-yellow-400`) — pair temporarily suspended
- Lock column shows countdown: `14m left`, `5m left` for active locks/cooldowns
- Controls column: LOCK button (for active pairs), UNLOCK button (for locked/cooldown pairs)

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
--muted: #9CA3AF;   /* Gray — labels, secondary */
--surface: #0C0C0C; /* Card backgrounds */
--background: #000; /* Page background */

/* Typography */
font-family: 'Inter', sans-serif;         /* UI text */
font-family: 'JetBrains Mono', monospace; /* Data values */

/* Borders — note opacity is 0.10, not 0.08 */
.l-bd { border: 1px solid rgba(255,255,255,0.10); }
.l-b  { border-bottom: 1px solid rgba(255,255,255,0.10); }
.l-r  { border-right: 1px solid rgba(255,255,255,0.10); }

/* Grid background overlay */
.l-grid { background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 24px 24px; }

/* Bot control button base */
.bot-ctrl { width: 28px; height: 28px; border-radius: 5px; background: #1a1a1a;
            border: 1px solid rgba(255,255,255,0.10); color: #9CA3AF; }
.bot-ctrl:hover { background: #2a2a2a; color: #F5F5F5; }
.bot-ctrl.ctrl-start:hover { color: #22c55e; border-color: rgba(34,197,94,0.3); }
.bot-ctrl.ctrl-stop:hover  { color: #ef4444; border-color: rgba(239,68,68,0.3); }
.bot-ctrl.ctrl-pause:hover { color: #eab308; border-color: rgba(234,179,8,0.3); }
/* In Fleet table, buttons use 22×22px with gap-0.5 */

/* Action dropdown menu */
.action-menu { position: relative; display: inline-block; }
.action-menu-btn { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.10);
                   padding: 4px 10px; border-radius: 5px; font-size: 11px; }
.action-dropdown { position: absolute; right: 0; bottom: 100%; min-width: 200px;
                   background: #151515; border-radius: 8px; box-shadow: 0 -8px 30px rgba(0,0,0,0.6); }
.action-dropdown.open { display: block; }
.action-dropdown .sep { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 8px; }
.action-dropdown button.danger { color: #ef4444; }

/* Sidebar header (centered when collapsed) */
.sidebar-header { /* inherits from flex, centered via CSS when .collapsed */ }

/* Common patterns */
.kpi-label: text-[11px] uppercase tracking-widest text-muted font-sans
.kpi-value: font-mono font-bold text-white
.section-title: text-[12px] font-bold uppercase tracking-widest text-muted
```

### Lucide Icons Used (26 total)

| Icon | Used In |
|---|---|
| `play` | Bot Start button |
| `square` | Bot Stop button |
| `pause` | Bot Pause button |
| `refresh-cw` | Reload Config + Trade Reload |
| `x-square` | Force Exit All |
| `plus-square` | Toggle Stopbuy |
| `shield-alert` | Soft Kill |
| `zap` | Hard Kill + Hyperopt icon |
| `x` | Close drawer |
| `chevrons-left` | Sidebar toggle |
| `layout-dashboard` | Control Room nav icon |
| `flask-conical` | Experiments nav icon |
| `list` | Strategies nav icon |
| `settings` | System nav icon |
| `layers` | Fleet Management title |
| `git-compare` | Compare View button |
| `search` | Global search icon |
| `download` | CSV export buttons |
| `chevron-down` | Action dropdown toggle |
| `log-out` | Forceexit limit |
| `scissors` | Forceexit partial |
| `plus-circle` | Increase position |
| `trash-2` | Delete trade |
| `arrow-left` | Back to Dashboard |
| `brain-circuit` | FreqAI tab placeholder |
| `bot` | AI Review tab placeholder |

### Key DOM Element IDs

| ID | Element | Purpose |
|---|---|---|
| `side-menu` | `<aside>` | Sidebar navigation, toggles `.collapsed` |
| `top-title` | `<h1>` | Header page title, updated by `switchPage()` |
| `bot-drawer` | `<aside>` | Bot detail drawer, toggles `.open` |
| `drawer-backdrop` | `<div>` | Semi-transparent overlay behind drawer |
| `drawer-bot-name` | `<h2>` | Bot name text in drawer header |
| `drawer-bot-mode` | `<span>` | Bot mode badge (LIVE/PAUSED/STOPPED) in drawer |
| `page-dashboard` | `<div>` | Control Room page container |
| `page-fleet` | `<div>` | Fleet Management page container |
| `page-experiments` | `<div>` | Experiments page container |

### Section Titles in Prototype

| Title | Location |
|---|---|
| `Fleet Management (312)` | Col 1 header |
| `Profit Over Time` | Chart panel left |
| `Profit Distribution` | Chart panel right |
| `Balance` | Col 3 widget 1 |
| `Fees & Costs` | Col 3 widget 2 |
| `Node Telemetry` | Col 3 widget 3 |
| `Terminal StdOut` | Col 3 widget 4 |
| `Process Controls` | Bot drawer section 1 |
| `RPC Actions` | Bot drawer section 2 |
| `Tail_Log.txt` | Bot drawer section 3 |
| `Run Configuration` | Backtest control panel |
| `Total Profit` / `Max Drawdown` / `Win Rate` | Backtest results KPIs |
| `Test Logs & Trades` | Backtest results table |
| `Hyperopt Compute` | Hyperopt tab heading |

## Tooltips — Every Interactive Element

ALL buttons in the application have descriptive `title=` attributes for hover tooltips.

### Bot Control Buttons (8 per bot)
| Icon | Tooltip |
|---|---|
| `play` | `▶ Start Bot — Resume trading engine` |
| `square` | `■ Stop Bot — Gracefully stop trading` |
| `pause` | `⏸ Pause — Stop opening new trades` |
| `refresh-cw` | `↻ Reload Config — Hot-reload strategy config` |
| `x-square` | `✕ Force Exit All — Close all open positions` |
| `plus-square` | `⊞ Toggle Stopbuy — Prevent new buy orders` |
| `shield-alert` | `🛡 Soft Kill — Exit all trades, keep bot alive` |
| `zap` | `⚡ Hard Kill — Force stop bot + container` |

### Header Buttons
| Button | Tooltip |
|---|---|
| Soft Kill All | `Soft Kill All — exit all trades on ALL bots` |
| Hard Kill All | `Hard Kill All — stop ALL bots + containers` |

### Navigation
| Button | Tooltip |
|---|---|
| Control Room | `Dashboard — Real-time trading overview` |
| Experiments | `Experiments — Backtest, Hyperopt, FreqAI` |
| Strategies | `Strategies — Manage trading strategies` |
| System | `System — Server health, configs, logs` |

### Trade Actions
| Button | Tooltip |
|---|---|
| Forceexit limit | `Exit trade at limit price` |
| Forceexit market | `Exit trade at market price immediately` |
| Forceexit partial | `Partially exit trade position` |
| Increase position | `Add to existing position (DCA)` |
| Reload | `Reload trade data from exchange` |
| Delete trade | `🗑 Delete trade — Remove from history permanently` |

### Drawer Tooltips
| Button | Tooltip |
|---|---|
| Start | `▶ Start Bot — Resume trading engine` |
| Pause | `⏸ Pause — Stop opening new trades` |
| Stop | `■ Stop Bot — Gracefully stop trading` |
| Reload Config | `↻ Reload Config — Hot-reload strategy config` |
| Force Enter | `Force open a new trade manually` |
| Force Exit All | `Close all open positions immediately` |
| Toggle Stopbuy | `Prevent bot from opening new buy orders` |
| Close drawer | `Close drawer` |

### Experiments Tab Tooltips
| Tab | Tooltip |
|---|---|
| Backtest | `Run historical simulation on past data` |
| Hyperopt | `Optimize strategy parameters automatically` |
| FreqAI | `Machine learning model training` |
| AI Review | `AI-powered strategy analysis and recommendations` |
| Validation | `Walk-forward validation and robustness checks` |

### Whitelist Matrix Tooltips
| Button | Tooltip |
|---|---|
| LOCK | `Lock pair` |
| UNLOCK | `Unlock pair` |
| Select all checkbox | `Select all` |

### Chart Tooltips
| Button | Tooltip |
|---|---|
| Days | `Show daily chart` |
| Weeks | `Show weekly chart` |
| Months | `Show monthly chart` |
| Abs $ | `Show absolute dollar values` |
| Rel % | `Show relative percentage values` |

### Other Tooltips
| Button | Tooltip |
|---|---|
| Execute Backtest | `Start backtesting with selected parameters` |
| Run Optimizer | `Start hyperparameter optimization` |
| Compare View | `Open Fleet Management — Compare all bots side by side` |
| Compare Selected | `Compare selected bots side-by-side` |
| Export CSV | `Export all bot data as CSV file` |
| CSV | `Export trade data as CSV` |
| Toggle sidebar | `Toggle sidebar` (chevrons-left icon, rotates 180° collapsed) |

---

## Interaction Patterns

| Pattern | Implementation |
|---|---|
| Tab switching | `switchTradeTab(tabId, btn)` — hide all `.trade-tab-content`, show selected |
| Action dropdown | `toggleActionMenu(btn, event)` — toggle `.action-dropdown.open` class |
| Bot drawer | `openBotDrawer(name, mode)` — slide-in overlay from right |
| Close on outside click | Global `document.addEventListener('click', ...)` |
| Sidebar collapse | `toggleSidebar()` — toggle `.collapsed` class on `#side-menu` |
| Page routing | `switchPage(pageId)` — hide/show `.page-view`, update header title, re-render Lucide icons |
| Fleet access | Compare View button in Bot Fleet header → `switchPage('page-fleet')` |
| Fleet back | `← Dashboard` button in Fleet header → `switchPage('page-dashboard')` |
| Auto-refresh | 10-second polling interval for all data sources |
| Lucide re-render | `setTimeout(() => lucide.createIcons(), 50)` after every page switch |

### JavaScript Functions (exact signatures)

```javascript
// Page navigation — hides all .page-view, shows target, updates title, re-renders icons
function switchPage(pageId) // pageId: 'page-dashboard' | 'page-fleet' | 'page-experiments'

// Experiment tabs — toggles .exp-tab visibility, updates button styling
function switchExpTab(tabId, btn) // tabId: 'tab-backtest' | 'tab-hyperopt' | 'tab-freqai' | 'tab-ai' | 'tab-val'

// Trade tabs — hides all .trade-tab-content, shows target via display style
function switchTradeTab(tabId, btn) // tabId: 'trades-open' | 'trades-closed' | 'trades-whitelist' | 'trades-performance' | 'trades-tags'

// Bot drawer — sets name+mode text, adds .open class to drawer + backdrop
function openBotDrawer(name, mode)
function closeBotDrawer()

// Action dropdown — toggles .open on dropdown, closes others first
function toggleActionMenu(btn, event)

// Sidebar — toggles .collapsed on #side-menu, re-renders Lucide after 300ms
function toggleSidebar()
```

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
| `POST /api/kill-switch/soft/{id}` | `softKill(id, reason)` | Bot control — Soft Kill |
| `POST /api/kill-switch/hard/{id}` | `hardKill(id, reason)` | Bot control — Hard Kill |
| `POST /api/kill-switch/soft-all` | `softKillAll(reason)` | Global kill switch |
| `POST /api/kill-switch/hard-all` | `hardKillAll(reason)` | Global kill switch |
| `GET /api/kill-switch/events` | `getRiskEvents()` | Risk event history |
| `GET /api/portfolio/balance` | `portfolioBalance()` | Aggregated balance |
| `GET /api/portfolio/profit` | `portfolioProfit()` | Aggregated profit |
| `GET /api/portfolio/trades` | `portfolioTrades()` | Aggregated trades |

## Pages Summary

| Page ID | Title | Access | Content |
|---|---|---|---|
| `page-dashboard` | Control Room | Sidebar nav (default) | KPI bar + 3-column layout |
| `page-fleet` | Fleet Management | Compare View button in Col 1 | 15-column comparison table |
| `page-experiments` | Experiments Matrix | Sidebar nav | 5 tabs: Backtest, Hyperopt, FreqAI, AI Review, Validation |

## Reference Files

- **Prototype HTML**: `prototypes/DESIGN-LINEAR-EDGE-FULL.html`
- **Whitelist Matrix spec**: `prototypes/PROMPT-WHITELIST-MATRIX.md`
- **Types**: `frontend/src/types/index.ts`
- **API functions**: `frontend/src/lib/api.ts`
- **Existing dashboard**: `frontend/src/app/dashboard/page.tsx`
- **Bot detail panel**: `frontend/src/components/dashboard/BotDetailPanel.tsx`
