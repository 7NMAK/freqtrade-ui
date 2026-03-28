# PAGE SPECIFICATIONS — Complete Widget-Level Documentation

**Created:** 2026-03-28
**Purpose:** Every page, every widget, every click, every data source — documented so any developer or agent can implement it without guessing.
**Rule:** If a feature comes from FreqTrade, the FT section (§) and exact parameter name are listed. If it's our custom feature (orchestrator), it says "ORCH" explicitly.

---

# TABLE OF CONTENTS

- [SHARED: Sidebar](#shared-sidebar)
- [SHARED: Header](#shared-header)
- [PAGE 0: Login](#page-0-login)
- [PAGE 1: Dashboard](#page-1-dashboard)
- [PAGE 2: Strategies](#page-2-strategies)
- [PAGE 3: Strategy Builder](#page-3-strategy-builder)
- [PAGE 4: Backtesting](#page-4-backtesting)
- [PAGE 5: Analytics](#page-5-analytics)
- [PAGE 6: Risk Management](#page-6-risk-management)
- [PAGE 7: Settings](#page-7-settings)
- [PAGE 8: FreqAI](#page-8-freqai)
- [PAGE 9: Data Management](#page-9-data-management)
- [NEW ORCHESTRATOR ENDPOINTS](#new-orchestrator-endpoints-needed)

---

# SHARED: SIDEBAR

**Component:** `Sidebar.tsx`
**Visible on:** Every page except Login

## S-1: Logo Area
- **Visual:** "FT" gradient icon + "FreqTrade Trading Platform" text
- **Click:** Navigate to `/dashboard`
- **Data source:** Static

## S-2: Navigation Links (9 items)
| # | Name | Icon | Route | Badge | Live Dot |
|---|------|------|-------|-------|----------|
| S-2a | Dashboard | 📊 | `/dashboard` | — | Yes (green) |
| S-2b | Strategies | 📋 | `/strategies` | "{N} live" | — |
| S-2c | Strategy Builder | 🔧 | `/builder` | — | Yes |
| S-2d | Backtesting | ⚡ | `/backtesting` | "{N} runs" | — |
| S-2e | Analytics | 📈 | `/analytics` | — | Yes |
| S-2f | Risk | 🛡️ | `/risk` | — | Yes |
| S-2g | FreqAI | 🧠 | `/freqai` | — | Yes |
| S-2h | Data | 💾 | `/data` | — | — |
| S-2i | Settings | ⚙️ | `/settings` | — | — |

### Badge Data Sources:
- **"{N} live" badge on Strategies:** Count strategies where `lifecycle === 'live'` → `getStrategies()` filter → **ORCH** `GET /api/strategies/`
- **"{N} runs" badge on Backtesting:** Count active backtest/hyperopt jobs → **ORCH** (future: `GET /api/jobs/active`)
- **Live dots:** Show green dot when at least 1 bot is running → `getBots()` → filter `status === 'running'` → **ORCH** `GET /api/bots/`

### Click behavior:
- Each link uses Next.js `<Link>` component
- Active state: accent background glow + accent text color
- Hover: bg-bg-3 + text-text-1

## S-3: Footer Status
- **Visual:** Green dot + "FreqTrade 2026.2 — {N} bots"
- **Data source:** `getBots()` → `bots.length` → **ORCH** `GET /api/bots/`
- **Green dot:** Green if orchestrator healthy, red if not → `health()` → **ORCH** `GET /api/health`
- **Update frequency:** On page load + every 30s

---

# SHARED: HEADER

**Component:** `Header.tsx`
**Visible on:** Every page except Login

## H-1: Page Title
- **Visual:** `<h1>` showing current page name
- **Data source:** Passed as `title` prop from each page via `AppShell`
- **Click:** None

## H-2: Search Input
- **Visual:** Text input with magnifying glass icon, placeholder "Search pairs, strategies..."
- **Click/Type:** Opens search results dropdown
- **On input change:** Filter across:
  - Pair names (from `botWhitelist()` of all bots)
  - Strategy names (from `getStrategies()`)
  - Bot names (from `getBots()`)
- **On result click:** Navigate to relevant page:
  - Pair → `/analytics?pair={pair}`
  - Strategy → `/strategies?selected={id}`
  - Bot → `/dashboard` (scroll to bot)
- **Data source:** Combined from **ORCH** `GET /api/bots/`, `GET /api/strategies/`, **FT** `GET /api/v1/whitelist`
- **Priority:** LOW (can be implemented last)

## H-3: Notification Bell
- **Visual:** 🔔 button with red dot indicator
- **Click:** Opens dropdown panel showing recent events
- **Data source:** `getRiskEvents()` → **ORCH** `GET /api/kill-switch/events` (last 10)
- **Red dot visible when:** Any risk events in last 1 hour, or any bot `consecutive_failures > 0`
- **Dropdown items:** Show timestamp + bot name + event type (soft/hard kill, heartbeat warning)
- **Click on item:** Navigate to `/risk`

## H-4: Kill Switch Button
- **Visual:** Red button "🚨 KILL SWITCH"
- **Click:** Opens kill switch confirmation modal (H-5)
- **Data source:** None (action trigger only)

## H-5: Kill Switch Confirmation Modal
- **Visual:** Full-screen overlay with centered card
- **Widgets inside:**

### H-5a: Cancel Button
- **Click:** Close modal, do nothing
- **API:** None

### H-5b: Confirm "KILL ALL BOTS" Button
- **Click:** Call `hardKillAll("Emergency kill from header")`
- **API:** **ORCH** `POST /api/kill-switch/hard-all` → body: `{ "reason": "Emergency kill from header" }`
- **What this does on server:** For each bot: `POST /api/v1/forceexit` (all trades) → `POST /api/v1/stop` → update bot status to "killed" → create RiskEvent in DB
- **On success:** Show success alert, close modal
- **On error:** Show error alert, keep modal open
- **Loading state:** Button shows "Killing..." and is disabled

## H-6: User Avatar
- **Visual:** Circle with initial "N", gradient background
- **Click:** `confirm("Logout?")` → if yes: `logout()` → clear token → redirect to `/login`
- **API:** None (client-side token removal only)

---

# PAGE 0: LOGIN

**File:** `app/login/page.tsx`
**Route:** `/login`
**Auth:** NOT required (public page)
**Prototype:** `prototypes/login.html`

## L-1: Username Input
- **Visual:** Text input, label "Username"
- **On change:** Update local state `username`
- **Validation:** Required, non-empty

## L-2: Password Input
- **Visual:** Password input, label "Password"
- **On change:** Update local state `password`
- **Validation:** Required, non-empty

## L-3: Password Toggle Button
- **Visual:** Eye icon inside password input
- **Click:** Toggle input type between `password` and `text`
- **Source:** Prototype has this, current React does NOT → **ADD**

## L-4: Remember Me Checkbox
- **Visual:** Checkbox + label "Remember me"
- **Click:** Toggle. If checked, token persists in localStorage (already default behavior). If unchecked, use sessionStorage instead.
- **Source:** Prototype has this, current React does NOT → **ADD** (low priority)

## L-5: Sign In Button
- **Visual:** Full-width primary button "Sign In →"
- **Click:** Call `login(username, password)`
- **API:** **ORCH** `POST /api/auth/login` → body: `{ "username": "...", "password": "..." }`
- **On success:** Store JWT token → redirect to `/dashboard`
- **On error:** Show error message below form (red text)
- **Loading state:** Button shows "Signing in..." and is disabled
- **Credentials:** `admin` / `***REMOVED***`

## L-6: Error Display
- **Visual:** Red text below form
- **Shows when:** Login fails (wrong credentials, server error)
- **Data source:** Error message from API response

---

# PAGE 1: DASHBOARD

**File:** `app/dashboard/page.tsx`
**Route:** `/dashboard`
**Auth:** Required (AuthGuard)
**Prototype:** `prototypes/dashboard.html`
**Auto-refresh:** Every 10 seconds
**Data loading:** On mount + interval

## Dashboard Data Flow
```
On mount:
  1. getBots() → bot list                      ORCH GET /api/bots/
  2. For EACH bot, in parallel:
     a. botStatus(bot.id) → open trades        FT GET /api/v1/status
     b. botProfit(bot.id) → profit data        FT GET /api/v1/profit
     c. botBalance(bot.id) → balance           FT GET /api/v1/balance
  3. botDaily(bots[0].id, 7) → daily chart     FT GET /api/v1/daily
```

## SECTION: Portfolio Summary Bar (5 stat cards)

### D-1: Portfolio Equity Card
- **Visual:** "$127,432.18" large text + "+$2,341.50 (+1.87%) today" subtitle
- **Data source:** `totalEquity` = sum of `botBalance(id).total` for all bots → **FT** `GET /api/v1/balance`
- **Today change:** From `botProfit(id).profit_all_coin` → **FT** `GET /api/v1/profit`
- **Click:** None (display only)
- **Prototype note:** First card has gradient border highlight

### D-2: Unrealized P&L Card
- **Visual:** "+$1,892.40" colored green/red + "Across {N} open positions"
- **Data source:** Sum of `close_profit_abs` from all open trades → `botStatus(id)` → **FT** `GET /api/v1/status`
- **FT field:** `close_profit_abs` (§16)
- **Color:** Green if >= 0, Red if < 0
- **Click:** None

### D-3: Today's Realized Card
- **Visual:** "+$449.10" + "{N} trades closed"
- **Data source:** `botProfit(id).profit_closed_coin` → **FT** `GET /api/v1/profit`
- **FT fields:** `profit_closed_coin`, `closed_trade_count` (§8)
- **Click:** None
- **NOTE:** Current React page shows "Open Positions" count instead. Prototype shows "Today's Realized". → **FIX to match prototype**

### D-4: Max Drawdown (30d) Card
- **Visual:** "4.2%" + "$5,352 from peak"
- **Data source:** Not directly available from single FT endpoint. Can approximate from `botDaily(id, 30)` → compute max drawdown from daily equity curve
- **FT endpoint:** `GET /api/v1/daily?days=30` → compute peak-to-trough
- **Click:** None
- **NOTE:** Current React page shows "Active Bots" count instead. Prototype shows "Max Drawdown". → **FIX to match prototype**

### D-5: Active Bots Card
- **Visual:** "5" + "3 LIVE · 2 PAPER"
- **Data source:** `getBots()` → count by status and `is_dry_run`
- **ORCH:** `GET /api/bots/`
- **FT fields on Bot:** `status`, `is_dry_run`
- **Click:** None

## SECTION: Active Bots Grid

### D-6: "Active Bots" Card Header
- **Visual:** Card title "Active Bots" with 🤖 icon

### D-7: "View all strategies →" Link
- **Visual:** Accent colored text link in card header
- **Click:** Navigate to `/strategies`
- **Implementation:** `<Link href="/strategies">`

### D-8: Bot Cards (one per bot, grid layout)
For each bot from `getBots()`:

- **Visual:** Card with:
  - Bot name (bold) + Status badge (LIVE/PAPER/STOPPED)
  - Strategy name + trading mode (Paper/Live)
  - Today P&L value (colored)
  - Positions count
  - Sparkline chart (7 bars showing recent daily P&L)

- **Data per card:**
  - `bot.name` → from `getBots()` → **ORCH**
  - `bot.status` → "running"/"stopped"/"error" → **ORCH**
  - `bot.is_dry_run` → true = "PAPER", false = "LIVE" → **ORCH**
  - `bot.strategy_name` → **ORCH**
  - Today P&L → `botProfit(bot.id).profit_closed_coin` → **FT** `GET /api/v1/profit`
  - Positions count → `botStatus(bot.id).length` → **FT** `GET /api/v1/status`
  - Sparkline → `botDaily(bot.id, 7)` → **FT** `GET /api/v1/daily?days=7`

- **Click on card:** Navigate to `/strategies?bot={bot.id}` (show strategy detail for this bot)
- **Hover:** Border changes to accent, slight lift (-2px), shadow appears

### D-9: Status Badge on Bot Card
- **Visual:** Pill badge
  - `running` + `!is_dry_run` → "LIVE" green
  - `running` + `is_dry_run` → "PAPER" amber
  - `stopped` → "STOPPED" red
  - `error` → "ERROR" red
  - `killed` → "KILLED" red

## SECTION: Open Positions Table

### D-10: Open Positions Card Header
- **Visual:** "Open Positions" with 📍 icon + "{N} active" count

### D-11: Position Table
- **Columns** (from prototype):

| Column | FT Field (§16) | Data Source |
|--------|----------------|-------------|
| Pair | `pair` | `botStatus(id)` → **FT** `GET /api/v1/status` |
| Bot | `_bot_name` | Added by our code when flattening trades |
| Side | `is_short` → "Short"/"Long" | `botStatus(id)` |
| Leverage | `leverage` → "{N}x" badge | `botStatus(id)` |
| open_rate | `open_rate` → "$XX,XXX.XX" | `botStatus(id)` |
| current_rate | `current_rate` → "$XX,XXX.XX" | `botStatus(id)` |
| close_profit_abs | `close_profit_abs` → "+$XX.XX"/"-$XX.XX" | `botStatus(id)` |
| Duration | computed: `now - open_date` | `open_date` from `botStatus(id)` |
| Action | "⋮" menu | See D-12 |

### D-12: Position Row Click / Action Menu (⋮)
- **Click on row:** Expand row to show additional trade details:
  - `trade_id`, `stake_amount`, `fee_open`, `fee_close`, `enter_tag`, `open_date`
  - All from **FT** trade object (§16)
- **⋮ menu options:**
  - **"Force Exit"** → Confirm dialog → `botForceExit(botId, tradeId)` → **FT** `POST /api/v1/forceexit` body: `{ "tradeid": "{trade_id}" }`
  - **"View in Analytics"** → Navigate to `/analytics?pair={pair}&timeframe=1h`

### D-13: Position Row Colors
- `is_short === true` → Side text is RED
- `is_short === false` → Side text is GREEN
- `close_profit_abs >= 0` → P&L text is GREEN
- `close_profit_abs < 0` → P&L text is RED

## SECTION: Quick Actions Card

### D-14: Quick Actions (4 links)
| # | Icon | Label | Click Action |
|---|------|-------|-------------|
| D-14a | ✏️ | New Strategy | Navigate to `/builder` |
| D-14b | 🧪 | Run Backtest | Navigate to `/backtesting` |
| D-14c | 📥 | Import Strategy (.py) | Navigate to `/strategies` (open import modal) |
| D-14d | 💾 | Download Data | Navigate to `/data` |

Each is an `<a>` tag with `href`. Hover: border brightens, background lightens.

## SECTION: Daily P&L Chart (7 days)

### D-15: Daily P&L Bar Chart
- **Visual:** 7 vertical bars, one per day. Green for positive, red for negative.
- **Data source:** `botDaily(bots[0].id, 7)` → **FT** `GET /api/v1/daily?days=7`
- **FT response format:** `{ "data": [{ "date": "2026-03-28", "abs_profit": 449.10 }, ...] }`
- **Bar height:** Proportional to `abs_profit / max(abs_profit)`
- **Label above bar:** "+$XXX" or "-$XXX"
- **Label below bar:** Day name (Mon, Tue, etc.)
- **Click:** None (display only)
- **NOTE:** Should aggregate across ALL bots, not just first bot → iterate `botDaily(id, 7)` for each bot and sum per day

### D-16: "Analytics →" Link in Daily P&L header
- **Visual:** Accent text link
- **Click:** Navigate to `/analytics`

## SECTION: Equity Curve (30d) — FROM PROTOTYPE, NOT YET IN REACT

### D-17: Equity Curve Line Chart
- **Visual:** SVG line chart showing 30-day equity progression with gradient fill
- **Data source:** `botDaily(bots[0].id, 30)` → cumulative sum → **FT** `GET /api/v1/daily?days=30`
- **Should aggregate:** All bots
- **Library:** Recharts `<AreaChart>` or SVG
- **NOTE:** This exists in prototype but NOT in current React → **ADD**

## SECTION: Recent Alerts — FROM PROTOTYPE, NOT YET IN REACT

### D-18: Recent Alerts List
- **Visual:** 5 most recent alerts with colored dots (green=success, amber=warning, blue=info, red=critical)
- **Data source:** Combination of:
  - Risk events → `getRiskEvents()` → **ORCH** `GET /api/kill-switch/events`
  - Trade events → derived from recent trades (last closed trade = "Trade closed" alert)
  - Protection triggers → from `botLocks()` → **FT** `GET /api/v1/locks`
- **Click on alert:** Navigate to relevant page (/risk for kills, /analytics for trades)
- **NOTE:** This exists in prototype but NOT in current React → **ADD**

## SECTION: System Health — FROM PROTOTYPE, NOT YET IN REACT

### D-19: System Health Grid
- **Visual:** Grid of 8 health items with green/amber/red dots
- **Items:**
  - Per-bot health (5 bots): `botHealth(id)` → **FT** `GET /api/v1/health` + ping time from orchestrator heartbeat
  - PostgreSQL: `health()` → **ORCH** `GET /api/health`
  - Redis: `health()` → **ORCH** `GET /api/health`
  - Exchange API: derived from bot health status
- **Click:** None (display only)
- **NOTE:** This exists in prototype but NOT in current React → **ADD**

## SECTION: Today's Closed Trades — FROM PROTOTYPE, NOT YET IN REACT

### D-20: Closed Trades Table
- **Visual:** Table of trades closed today
- **Columns:** trade_id, Pair, Bot, Side, open_rate, close_rate, close_profit_abs, fee_open+fee_close, Duration, close_date
- **Data source:** `botTrades(id, 50)` for each bot → filter by `close_date` = today → **FT** `GET /api/v1/trades?limit=50`
- **FT fields (§16):** `trade_id`, `pair`, `is_short`, `open_rate`, `close_rate`, `close_profit_abs`, `fee_open`, `fee_close`, `open_date`, `close_date`
- **Click on row:** Same as D-12 (expand detail or navigate)
- **NOTE:** This exists in prototype but NOT in current React → **ADD**

---

# PAGE 2: STRATEGIES

**File:** `app/strategies/page.tsx`
**Route:** `/strategies`
**Auth:** Required
**Prototype:** `prototypes/strategies.html`

## Data Flow
```
On mount:
  1. getStrategies()                    ORCH GET /api/strategies/
  2. getBots()                          ORCH GET /api/bots/
  3. For each bot with status=running:
     a. botProfit(bot.id)              FT GET /api/v1/profit
     b. botStatus(bot.id)             FT GET /api/v1/status
```

## SECTION: Toolbar

### ST-1: Lifecycle Filter Tabs
- **Visual:** Row of 6 pill buttons: All | Live | Paper | Backtest | Draft | Retired
- **Click on tab:** Filter displayed strategy cards by lifecycle
  - "All" → show all
  - "Live" → filter `lifecycle === 'live'`
  - "Paper" → filter `lifecycle === 'paper'`
  - "Backtest" → filter `lifecycle === 'backtest'`
  - "Draft" → filter `lifecycle === 'draft'`
  - "Retired" → filter `lifecycle === 'retired'`
- **Badge counts:** Show count per lifecycle: "Live (3)", "Paper (2)", etc.
- **Data source:** `getStrategies()` → **ORCH**
- **Active tab style:** Accent background + white/accent text

### ST-2: Import .py Button
- **Visual:** "📥 Import .py" button
- **Click:** Open import modal (ST-20)

### ST-3: + New Strategy Button
- **Visual:** Primary styled button "+ New Strategy"
- **Click:** Navigate to `/builder`

## SECTION: Strategy Cards Grid

### ST-4: Strategy Card (one per strategy)
Each card represents one strategy from `getStrategies()` joined with bot data from `getBots()`.

**Card layout:**
```
┌──────────────────────────────────┐
│ [Icon] Strategy Name    [LIVE]   │ ← name + lifecycle badge
│ Description text...              │ ← strategy.description
│ ETH/USDT:USDT · 1h · 5x lev    │ ← pairs, timeframe, leverage from bot config
│                                  │
│ Total Profit  Win Rate  Max DD   │ ← metrics from botProfit()
│ +$4,820       68.2%     4.1%     │
│ Trades                           │
│ 142                              │
│                                  │
│ [View Trades][Analytics][Edit]   │ ← action buttons
│              [View Bot →]        │ ← primary action button
└──────────────────────────────────┘
```

**Data mapping per card:**

| Field | Source | API |
|-------|--------|-----|
| Strategy name | `strategy.name` | **ORCH** `GET /api/strategies/` |
| Lifecycle badge | `strategy.lifecycle` | **ORCH** |
| Description | `strategy.description` | **ORCH** |
| Icon + color | Based on lifecycle (green=live, amber=paper, cyan=backtest, gray=draft, red=retired) | Derived |
| Pairs | From linked bot config: `botConfig(bot.id)` → `exchange.pair_whitelist` | **FT** `GET /api/v1/show_config` |
| Timeframe | From bot config: `timeframe` | **FT** |
| Leverage | From bot config or strategy file | **FT** |
| Total Profit | `botProfit(bot.id).profit_all_coin` | **FT** `GET /api/v1/profit` |
| Win Rate | `botProfit(bot.id).winning_trades / (winning + losing)` | **FT** |
| Max DD | Computed from daily data or not shown if unavailable | **FT** |
| Trades count | `botProfit(bot.id).trade_count` | **FT** |
| Bot name | `bot.name` where `bot.id === strategy.bot_instance_id` | **ORCH** |

**Card click:** Open detail panel (ST-10)
**Card hover:** Border → accent, translateY(-2px), shadow

### ST-5: Lifecycle Badge
- **Visual:** Colored pill badge
  - `live` → "LIVE" green bg + green text
  - `paper` → "PAPER" amber bg + amber text
  - `backtest` → "BACKTEST" cyan bg + cyan text
  - `draft` → "DRAFT" gray bg + gray text
  - `retired` → "RETIRED" red bg + red text (card opacity 0.6)

### ST-6: Action Buttons on Card (vary by lifecycle)

**For LIVE strategies:**
| Button | Click Action |
|--------|-------------|
| View Trades | Navigate to trade list modal, show `botStatus(bot.id)` + `botTrades(bot.id)` → **FT** |
| Analytics | Navigate to `/analytics?pair={pair}&bot={bot.id}` |
| Edit | Navigate to `/builder?strategy={strategy.id}` |
| View Bot → (primary) | Navigate to `/dashboard` or show bot detail |

**For PAPER strategies:**
| Button | Click Action |
|--------|-------------|
| View Trades | Same as live |
| Backtest History | Show backtest results for this strategy |
| Go Live → (promote) | Confirm dialog → `updateStrategy(id, { lifecycle: 'live' })` + `updateBot(bot.id, { is_dry_run: false })` → **ORCH** |

**For BACKTEST strategies:**
| Button | Click Action |
|--------|-------------|
| View Results | Show backtest results |
| Edit | Navigate to `/builder?strategy={strategy.id}` |
| Re-run Backtest | Navigate to `/backtesting?strategy={name}` |
| Start Paper → (promote) | `updateStrategy(id, { lifecycle: 'paper' })` + create/start paper bot → **ORCH** |

**For DRAFT strategies:**
| Button | Click Action |
|--------|-------------|
| Edit in Builder | Navigate to `/builder?strategy={strategy.id}` |
| Run Backtest → (primary) | Navigate to `/backtesting?strategy={name}` |

**For RETIRED strategies:**
| Button | Click Action |
|--------|-------------|
| View History | Show trade history for this strategy |
| Clone | `createStrategy({ ...strategy, name: strategy.name + '_clone', lifecycle: 'draft' })` → **ORCH** |
| Export .py | `botFtStrategy(bot.id, strategy.name)` → download as .py file → **FT** `GET /api/v1/strategy/{name}` |

## SECTION: Strategy Detail Panel (slide-in)

### ST-10: Detail Panel
- **Visual:** Panel slides in from right side, darkens background
- **Triggered by:** Clicking any strategy card

**Contents:**

### ST-11: Detail Header
- **Visual:** Strategy name + lifecycle badge + icon
- **Close button (✕):** Closes panel

### ST-12: Lifecycle Timeline
- **Visual:** Horizontal timeline: DRAFT → BACKTEST → PAPER → LIVE → RETIRED
- **Each step shows:** Date completed or "—" if pending
- **Current step:** Highlighted/active
- **Data source:** `getStrategy(id)` → **ORCH** `GET /api/strategies/{id}`

### ST-13: Configuration Table
- **Visual:** Key-value pairs showing strategy config
- **Data source:** `botConfig(bot.id)` → **FT** `GET /api/v1/show_config`
- **Fields shown:**

| Key | FT Config Param | Display |
|-----|----------------|---------|
| Strategy file | `strategy` | "TrendFollowerV3.py" |
| Pairs | `exchange.pair_whitelist` | "BTC/USDT:USDT" |
| Timeframe | `timeframe` | "1h" |
| stake_amount | `stake_amount` | "$1,000" |
| stoploss | `stoploss` | "-0.035 (-3.5%)" red |
| trailing_stop | `trailing_stop` | "enabled" green / "disabled" |
| trailing_stop_positive | `trailing_stop_positive` | "0.01" |
| minimal_roi | `minimal_roi` | JSON display |
| Leverage | from strategy | "10x (isolated)" |
| dry_run | `dry_run` | "true" amber / "false" red |

### ST-14: Backtest History
- **Visual:** List of past backtest runs for this strategy
- **Data source:** Orchestrator stores backtest results (future: `GET /api/strategies/{id}/backtests`)
- **Each entry shows:** Date, timerange, total profit, Sharpe, trades, win rate, max DD
- **Click on entry:** Expand to show full results

### ST-15: Protections List
- **Visual:** List of active protections
- **Data source:** `botConfig(bot.id)` → `protections` array → **FT**
- **Shows:** Protection name + parameter summary

### ST-16: Detail Action Buttons
| Button | Click Action |
|--------|-------------|
| Edit Strategy | Navigate to `/builder?strategy={id}` |
| View Trades | Show trade list |
| Analytics | Navigate to `/analytics` |
| View Bot → (primary) | Navigate to dashboard |

## SECTION: Import Modal

### ST-20: Import Strategy Modal
- **Visual:** Modal overlay with:
  - Drag-and-drop zone for .py files
  - File browser trigger
  - Cancel button → close modal
  - Import button → upload file
- **On import:** Upload .py file to orchestrator → orchestrator saves to FT `user_data/strategies/` → create Strategy record in DB with `lifecycle: 'draft'`
- **API:** **ORCH** `POST /api/strategies/import` (new endpoint needed) → body: multipart form with .py file
- **On success:** Close modal, refresh strategy list, show success toast
- **On error:** Show error message in modal

---

# PAGE 3: STRATEGY BUILDER

**File:** `app/builder/page.tsx`
**Route:** `/builder`
**Auth:** Required
**Prototype:** `prototypes/builder.html`

## Wizard Structure
6 steps, navigated with Next/Previous buttons:
1. **Basics** — name, exchange, timeframe, pairs, leverage
2. **Indicators** — select which technical indicators to include
3. **Entry** — define entry conditions (long + short)
4. **Exit** — define exit conditions
5. **Risk** — stoploss, trailing, ROI, protections
6. **Review** — summary + code preview

## Step Navigation

### B-1: Step Navigation Bar
- **Visual:** 6 numbered step buttons at top
- **Click on step:** Jump to that step (only if previous steps valid)
- **Active step:** Accent colored
- **Completed step:** Checkmark + green

### B-2: Previous Button
- **Visual:** "← Previous" (hidden on step 1)
- **Click:** Go to previous step

### B-3: Next Button
- **Visual:** "Next: {next_step_name} →" (shown on steps 1-5)
- **Click:** Validate current step → go to next step

### B-4: Save as Draft Button
- **Visual:** Secondary button "Save as Draft" (shown on all steps)
- **Click:** Collect all form data → `createStrategy({ name, description, lifecycle: 'draft', ...config })` → **ORCH** `POST /api/strategies/`
- **On success:** Navigate to `/strategies`

### B-5: Save & Backtest Button
- **Visual:** Green button "Save & Backtest" (shown on step 6 only)
- **Click:** Save strategy as draft → navigate to `/backtesting?strategy={name}`

## STEP 1: Basics

### B-10: Strategy Name Input
- **Visual:** Text input, required, label "Strategy Name"
- **Maps to:** Strategy file name → `{name}.py`
- **Validation:** Non-empty, valid Python identifier, no spaces

### B-11: Description Textarea
- **Visual:** Multi-line text input
- **Maps to:** Strategy docstring + orchestrator DB `strategies.description`

### B-12: Target Bot Selector
- **Visual:** Dropdown select
- **Options:** Load from `getBots()` → **ORCH** — shows bot name + exchange
- **Purpose:** Selects which bot this strategy will be deployed to. Exchange is configured in Settings (SET-60), NOT in the strategy file.
- **NOTE:** Strategies do NOT have an exchange property — exchange is a config.json parameter (§1). This selector determines which bot's config to use for pairs, timeframe defaults, etc.
- **Maps to:** Orchestrator `strategy.bot_instance_id` link

### B-13: Timeframe Selector
- **Visual:** Dropdown select, required
- **Options:** 5m, 15m, 1h, 4h, 1d
- **Maps to:** Strategy class attribute `timeframe = '{value}'` + `config.json` → `timeframe` (§1)
- **FT ref:** §2 Strategy Interface

### B-14: Trading Pairs (chip multi-select)
- **Visual:** Grid of pair chips, click to toggle selection. "+ Add pair" button for custom.
- **Options:** BTC/USDT:USDT, ETH/USDT:USDT, SOL/USDT:USDT, DOGE/USDT:USDT, AVAX/USDT:USDT, LINK/USDT:USDT, ARB/USDT:USDT
- **Maps to:** `config.json` → `exchange.pair_whitelist` (§1)
- **Click on chip:** Toggle selected state
- **"+ Add pair" click:** Show text input to type custom pair

### B-15: Leverage Selector
- **Visual:** Dropdown select
- **Options:** 1x (no leverage), 3x, 5x, 10x, 20x
- **Maps to:** Strategy method `leverage()` return value (§10)
- **FT ref:** §10 Leverage/Futures

### B-16: Margin Mode Selector
- **Visual:** Dropdown select
- **Options:** Isolated, Cross
- **Maps to:** `config.json` → `margin_mode` (§1)

## STEP 2: Indicators

### B-20: Indicator Search
- **Visual:** Text input "Search indicators..."
- **On type:** Filter indicator list below

### B-21: Indicator Category Groups (4 groups)
Each group contains clickable indicator chips:

**Trend (§2, §14):**
| Chip | Selected default | FT function |
|------|-----------------|-------------|
| EMA (20) | ✅ | `ta.trend.ema_indicator(close, 20)` |
| EMA (50) | ✅ | `ta.trend.ema_indicator(close, 50)` |
| SMA | ❌ | `ta.trend.sma_indicator(close, N)` |
| WMA | ❌ | `ta.trend.wma_indicator(close, N)` |
| ADX | ✅ | `ta.trend.adx(high, low, close, 14)` |
| Supertrend | ❌ | `ta.trend.supertrend()` |
| Ichimoku | ❌ | `ta.trend.ichimoku_*()` |
| PSAR | ❌ | `ta.trend.psar_*()` |

**Momentum:**
| Chip | Selected default | FT function |
|------|-----------------|-------------|
| RSI (14) | ✅ | `ta.momentum.rsi(close, 14)` |
| MACD | ❌ | `ta.trend.macd_*()` |
| Stochastic | ❌ | `ta.momentum.stoch*()` |
| CCI | ❌ | `ta.trend.cci()` |
| Williams %R | ❌ | `ta.momentum.williams_r()` |
| MFI | ❌ | `ta.volume.money_flow_index()` |

**Volatility:**
| Chip | Selected default | FT function |
|------|-----------------|-------------|
| Bollinger Bands | ❌ | `ta.volatility.bollinger_*()` |
| ATR (14) | ✅ | `ta.volatility.average_true_range()` |
| Keltner Channel | ❌ | `ta.volatility.keltner_channel_*()` |
| Donchian Channel | ❌ | `ta.volatility.donchian_channel_*()` |

**Volume:**
| Chip | Selected default | FT function |
|------|-----------------|-------------|
| OBV | ❌ | `ta.volume.on_balance_volume()` |
| VWAP | ❌ | `ta.volume.volume_weighted_average_price()` |
| Volume SMA | ❌ | SMA of volume column |
| CMF | ❌ | `ta.volume.chaikin_money_flow()` |

- **Click on chip:** Toggle selected state (accent border + glow when selected)
- **Selected indicators** determine what goes into `populate_indicators()` in generated .py file

## STEP 3: Entry Conditions

### B-30: Long Entry Conditions
- **Visual:** List of condition rows, each with:
  - Label: "IF" (first) or "AND" (subsequent)
  - Indicator dropdown (options: selected indicators from Step 2 + "close")
  - Operator dropdown: "crosses above", "crosses below", ">", "<", "="
  - Compare type: "indicator" or "value"
    - If "indicator": dropdown of indicators
    - If "value": number input
- **Maps to:** `populate_entry_trend()` method in strategy .py → sets `dataframe['enter_long'] = 1` when all conditions true
- **FT ref:** §2 Strategy Interface, §3 Callbacks

### B-31: + Add Condition Button (Long)
- **Click:** Add new condition row to long entry list
- **Default new row:** First available indicator, ">", value 0

### B-32: Remove Condition Button (per row)
- **Visual:** "✕" or trash icon on each row
- **Click:** Remove that condition row

### B-33: Short Entry Conditions
- **Visual:** Same structure as Long, but generates `dataframe['enter_short'] = 1`
- **Label:** "Short Entry (Optional)"
- **FT ref:** §2 (is_short support), §10 (futures)

### B-34: + Add Condition Button (Short)
- Same as B-31 but for short conditions

## STEP 4: Exit Conditions

### B-40: Custom Exit Conditions
- **Visual:** Same condition row format as entry
- **Maps to:** `populate_exit_trend()` → sets `dataframe['exit_long'] = 1`
- **FT ref:** §2, §3

### B-41: + Add Exit Condition Button
- Same as B-31

### B-42: Exit Note
- **Visual:** Info box explaining that stoploss, trailing stop, and ROI (configured in Step 5) also trigger exits
- **Not interactive** (display only)

## STEP 5: Risk Parameters

### B-50: Stoploss Input
- **Visual:** Number input, value: -0.035, step: 0.005 + display "(-3.5%)"
- **Maps to:** Strategy class attribute `stoploss = {value}` (§4)
- **FT ref:** §4 Stoploss types
- **Validation:** Must be negative

### B-51: stake_amount Input
- **Visual:** Number input, value: 1000, step: 100 + "USDT" label
- **Maps to:** `config.json` → `stake_amount` (§1)

### B-52: max_open_trades Input
- **Visual:** Number input, value: 3, step: 1
- **Maps to:** `config.json` → `max_open_trades` (§1)

### B-53: Trailing Stop Toggle
- **Visual:** Toggle switch (on/off)
- **Maps to:** Strategy `trailing_stop = True/False` (§4)
- **When ON, show sub-fields:**

### B-54: trailing_stop_positive Input
- **Visual:** Number input, value: 0.01, step: 0.005 + "(1%)"
- **Maps to:** Strategy `trailing_stop_positive = {value}` (§4)
- **Visible only when:** B-53 is ON

### B-55: trailing_stop_positive_offset Input
- **Visual:** Number input, value: 0.02, step: 0.005 + "(2%)"
- **Maps to:** Strategy `trailing_stop_positive_offset = {value}` (§4)
- **Visible only when:** B-53 is ON

### B-56: minimal_roi Table
- **Visual:** Editable table with columns: Minutes | ROI% | Description
- **Default rows:**

| Minutes | ROI% | Maps to |
|---------|------|---------|
| 0 | 10 | `minimal_roi = { "0": 0.10, ...}` |
| 30 | 5 | `"30": 0.05` |
| 60 | 2 | `"60": 0.02` |
| 120 | 0 | `"120": 0` |

- **Maps to:** Strategy class attribute `minimal_roi` dict (§4)
- **Each cell is editable** (number inputs)
- **+ Add Row button:** Adds new time/ROI row
- **Remove button per row:** Deletes that ROI step

### B-57: Protection Toggles (3)
| Toggle | Default | Maps to (§7) |
|--------|---------|---------------|
| "3 SL in 1h → lock 30m" | ON | `StoplossGuard(trade_limit=3, lookback_period_candles=60, stop_duration_candles=30)` |
| "5% DD in 48h → lock 12h" | ON | `MaxDrawdown(max_allowed_drawdown=0.05, lookback_period_candles=2880, stop_duration_candles=720)` |
| "5 candles cooldown" | ON | `CooldownPeriod(stop_duration_candles=5)` |

- **Maps to:** `config.json` → `protections` array (§7) or strategy `protections` attribute

## STEP 6: Review

### B-60: Review Summary Grid
- **Visual:** 2-column grid showing all configured values
- **Fields:** Strategy name, exchange, timeframe, pairs, leverage, margin mode, indicators (count), entry conditions (count), exit conditions (count), stoploss, trailing stop, ROI, protections
- **All read-only** — summary display

### B-61: Generated Code Preview
- **Visual:** Code block showing the generated Python strategy file
- **Content:** Full `.py` file with:
  - Class definition inheriting `IStrategy`
  - `timeframe`, `stoploss`, `trailing_stop`, `minimal_roi` attributes
  - `populate_indicators()` with selected indicators
  - `populate_entry_trend()` with entry conditions
  - `populate_exit_trend()` with exit conditions
  - `leverage()` callback if leverage > 1x
  - Protections in `protections` list
- **FT ref:** §2 Strategy Interface, §3 Callbacks

### B-62: Copy Code Button
- **Visual:** Copy icon button on code block
- **Click:** Copy generated .py content to clipboard
- **Feedback:** Button text changes to "Copied!" for 2 seconds

---

# PAGE 4: BACKTESTING

**File:** `app/backtesting/page.tsx`
**Route:** `/backtesting`
**Auth:** Required
**Prototype:** `prototypes/backtesting.html`

## Main Tabs

### BT-1: Tab Bar (3 tabs)
| Tab | Click Action |
|-----|-------------|
| Backtest | Show backtest configuration panel |
| Hyperopt | Show hyperopt configuration panel |
| Validation | Show lookahead/recursive analysis panel |

## TAB: Backtest

### BT-10: Strategy Selector
- **Visual:** Dropdown select
- **Options:** Load from `botFtStrategies(botId)` → **FT** `GET /api/v1/strategies`
- **Returns:** List of strategy names available on FT server
- **Maps to:** CLI arg `--strategy {name}` (§5)

### BT-11: Multi-Strategy Compare (tag input)
- **Visual:** Tag input for comparing multiple strategies
- **Click "add":** Add another strategy name tag
- **Click "✕" on tag:** Remove that strategy
- **Maps to:** CLI arg `--strategy-list {name1} {name2}` (§5)

### BT-12: Timeframe Selector
- **Visual:** Dropdown
- **Options:** 1m, 5m, 15m, 30m, 1h, 4h, 1d
- **Maps to:** CLI arg `--timeframe {tf}` (§5)

### BT-13: Detail Timeframe Selector
- **Visual:** Dropdown
- **Options:** None, 1m, 5m, 15m
- **Maps to:** CLI arg `--timeframe-detail {tf}` (§5)
- **FT note:** Provides more granular simulation at cost of speed

### BT-14: Start Date Input
- **Visual:** Date input, default "2024-01-01"
- **Maps to:** First part of `--timerange YYYYMMDD-YYYYMMDD` (§5)

### BT-15: End Date Input
- **Visual:** Date input, default "2026-03-01"
- **Maps to:** Second part of `--timerange` (§5)

### BT-16: Export Mode Radio Buttons
- **Options:** trades (default), signals, none
- **Maps to:** CLI arg `--export {mode}` (§5)

### BT-17: Breakdown Checkboxes
- **Options:** day ✅, week ☐, month ✅
- **Maps to:** CLI arg `--breakdown day month` (§5)
- **Also:** config `backtest_breakdown` (§5)

### BT-18: Enable Protections Toggle
- **Visual:** Toggle switch, default ON
- **Maps to:** CLI arg `--enable-protections` (§5)

### BT-19: Starting Balance Input
- **Visual:** Number input, default 1000
- **Maps to:** CLI arg `--dry-run-wallet {value}` (§5)

### BT-20: Stake Amount Input
- **Visual:** Text input, default "unlimited"
- **Maps to:** CLI arg `--stake-amount {value}` (§5)

### BT-21: Max Open Trades Input
- **Visual:** Number input, default 3
- **Maps to:** CLI arg `--max-open-trades {value}` (§5)

### BT-22: Fee Override Input
- **Visual:** Number input (optional)
- **Maps to:** CLI arg `--fee {value}` (§5)

### BT-23: Pair Override (tag input)
- **Visual:** Tag input with pair names
- **Default tags:** BTC/USDT:USDT, ETH/USDT:USDT
- **Maps to:** CLI arg `--pairs BTC/USDT:USDT ETH/USDT:USDT` (§5)

### BT-24: FreqAI Model Selector
- **Visual:** Dropdown
- **Options:** None, LightGBMRegressor, XGBoostRegressor, CatboostRegressor, ReinforcementLearner, PyTorchTransformer
- **Maps to:** CLI arg `--freqaimodel {model}` (§5)

### BT-25: Cache Selector
- **Visual:** Dropdown
- **Options:** day, week, month, none
- **Maps to:** CLI arg `--cache {value}` (§5)

### BT-26: Enable Position Stacking Toggle
- **Visual:** Toggle switch, default OFF
- **Maps to:** CLI flag `--enable-position-stacking` (§5)

### BT-27: ▶ Run Backtest Button
- **Visual:** Primary blue button "▶ Run Backtest"
- **Click:** Collect all form values → construct CLI command → send to orchestrator
- **API:** **ORCH** `POST /api/bots/{botId}/backtest` (NEW endpoint needed)
  - Body: `{ "strategy": "X", "timerange": "20240101-20260301", "timeframe": "1h", ... }`
  - Orchestrator runs: `docker exec freqtrade freqtrade backtesting --strategy X --timerange ... --config /freqtrade/user_data/config.json`
- **Loading state:** Button shows "Running..." + progress indicator
- **Polling:** After submit, poll `GET /api/bots/{id}/backtest/{jobId}` every 2s until complete
- **On complete:** Display results in BT-30

### BT-28: Reset Button
- **Click:** Reset all form values to defaults

## Backtest Results Display

### BT-30: Results Summary Cards
- **Visual:** Row of stat cards after backtest completes
- **Data from FT backtest JSON output:**

| Card | FT Output Field |
|------|----------------|
| Total Profit | `profit_total_abs` |
| Profit % | `profit_total` |
| Total Trades | `total_trades` |
| Win Rate | `wins / total_trades` |
| Max Drawdown | `max_drawdown_abs` |
| Sharpe Ratio | `sharpe` |
| Sortino Ratio | `sortino` |
| Avg Duration | `holding_avg` |

### BT-31: Per-Pair Results Table
- **Columns:** Pair, Trades, Win Rate, close_profit_abs, Profit%, Max DD, Avg Duration
- **Data:** FT backtest JSON → `strategy[name].results_per_pair`
- **Click on row:** Expand to show per-pair details

### BT-32: Equity Curve Chart
- **Visual:** Line chart showing cumulative profit over backtest period
- **Data:** FT backtest JSON → daily profits
- **Library:** Recharts `<LineChart>`

### BT-33: Export Button
- **Click:** Download backtest results as JSON
- **Data:** Full FT backtest output JSON

## TAB: Hyperopt

### BT-40: Epochs Input
- **Visual:** Number input, default 500, min 1, step 100
- **Maps to:** CLI arg `--epochs {value}` (§6)

### BT-41: Spaces Checkboxes (8 options)
- **Options:** buy ✅, sell ✅, roi ✅, stoploss ✅, trailing ☐, protection ☐, trades ☐, default ☐
- **Maps to:** CLI arg `--spaces buy sell roi stoploss` (§6)

### BT-42: Loss Function Selector
- **Visual:** Dropdown with 12 options
- **Options (§6):**
  - ShortTradeDurHyperOptLoss
  - OnlyProfitHyperOptLoss
  - SharpeHyperOptLoss
  - SharpeHyperOptLossDaily
  - SortinoHyperOptLoss
  - SortinoHyperOptLossDaily
  - CalmarHyperOptLoss
  - MaxDrawDownHyperOptLoss
  - MaxDrawDownRelativeHyperOptLoss
  - ProfitDrawDownHyperOptLoss
  - MultiMetricHyperOptLoss
  - MaxDrawDownPerPairHyperOptLoss
- **Maps to:** CLI arg `--hyperopt-loss {name}` (§6)

### BT-43: Sampler Selector
- **Visual:** Dropdown with description text below
- **Options (§6):**
  - TPE (default) — "Bayesian optimization using kernel density estimators"
  - NSGA-II — "Multi-objective evolutionary algorithm"
  - GP — "Gaussian Process-based optimization"
  - CMA-ES — "Covariance Matrix Adaptation Evolution Strategy"
  - Random — "Uniform random sampling"
  - QMC — "Quasi-Monte Carlo sampling"
- **Maps to:** CLI arg `--opt-sampler {value}` (§6)
- **On change:** Update description text below dropdown

### BT-44: Min Trades Input
- **Visual:** Number input, default 20
- **Maps to:** CLI arg `--min-trades {value}` (§6)

### BT-45: Max Trades Input
- **Visual:** Number input (optional)
- **Maps to:** CLI arg `--max-trades {value}` (§6)

### BT-46: Random State Input
- **Visual:** Number input (optional, for reproducibility)
- **Maps to:** CLI arg `--random-state {value}` (§6)

### BT-47: Workers Selector
- **Visual:** Dropdown: Auto, 1, 2, 4, 8
- **Maps to:** CLI arg `--jobs {value}` (§6)

### BT-48: Search Effort Slider
- **Visual:** Range slider 0-100, default 50
- **Maps to:** CLI arg `--effort {value}` (§6)
- **Display:** Shows current value number next to slider

### BT-49: Early Stop Input
- **Visual:** Number input, default 50
- **Maps to:** CLI arg `--early-stop {value}` (§6)

### BT-50: Analyze Per Epoch Toggle
- **Maps to:** CLI flag `--analyze-per-epoch` (§6)

### BT-51: Disable Param Export Toggle
- **Maps to:** CLI flag `--disable-param-export` (§6)

### BT-52: ▶ Run Hyperopt Button
- **Visual:** Amber/warning colored button "▶ Run Hyperopt"
- **Click:** Same pattern as BT-27 but for hyperopt
- **API:** **ORCH** `POST /api/bots/{botId}/hyperopt` (NEW)
  - Body: `{ "strategy": "X", "epochs": 500, "spaces": ["buy","sell","roi","stoploss"], "loss": "SharpeHyperOptLossDaily", "sampler": "tpe", ... }`
  - Runs: `docker exec freqtrade freqtrade hyperopt --strategy X --epochs 500 ...`
- **Polling:** Same as backtest

### BT-53: Hyperopt Results Table
- **Visual:** Table showing top N epochs
- **Columns:** Epoch, Trades, Win Rate, Profit, Drawdown, Sharpe, Duration, Params
- **FT output:** From hyperopt result JSON
- **"Apply Best" button:** Takes best epoch params and updates strategy

## TAB: Validation

### BT-60: Lookahead Analysis Button
- **Visual:** "🔍 Lookahead Analysis" primary button
- **Click:** Run `freqtrade lookahead-analysis --strategy X` via orchestrator
- **API:** **ORCH** `POST /api/bots/{botId}/utility/lookahead-analysis` (NEW)
- **FT ref:** §21
- **Result:** Shows which indicators have lookahead bias (PASS/FAIL per indicator)

### BT-61: Recursive Analysis Button
- **Visual:** "🔐 Recursive Analysis" secondary button
- **Click:** Run `freqtrade recursive-analysis --strategy X` via orchestrator
- **API:** **ORCH** `POST /api/bots/{botId}/utility/recursive-analysis` (NEW)
- **FT ref:** §22

### BT-62: Analysis Breakdown Tabs (§30)
- **Visual:** 6 sub-tabs for analysis groups
- **Options (maps to `--analysis-groups`):**
  - 0: by enter_tag
  - 1: profit by tag
  - 2: enter + exit combo
  - 3: pair + tag
  - 4: pair + enter + exit
  - 5: by exit_tag
- **Data source:** FT backtest JSON → tag analysis
- **FT ref:** §30 Advanced Analysis

### BT-63: Day/Week/Month Breakdown Tabs
- **Options:** Day, Week, Month
- **Data:** Backtest breakdown results (from `--breakdown day/week/month`)
- **Shows:** Table with period, trades, win rate, profit

## SECTION: History Sidebar

### BT-70: Past Runs List
- **Visual:** Scrollable list of past backtest/hyperopt runs
- **Each entry shows:** Type (BT/HO badge), strategy name, timerange, duration, P&L, trade count
- **Data source:** **ORCH** stores completed jobs OR **FT** `GET /api/v1/backtest/history` (§8)
- **Click on entry:** Load that run's results into the results display area
- **Active entry:** Highlighted with accent border

---

# PAGE 5: ANALYTICS

**File:** `app/analytics/page.tsx`
**Route:** `/analytics`
**Auth:** Required
**Prototype:** `prototypes/analytics.html`

## SECTION 1: Plotting & Visualization (§19)

### A-1: Pair Selector Dropdown
- **Visual:** Dropdown in chart card header
- **Options:** Load from `botWhitelist(botId)` → **FT** `GET /api/v1/whitelist`
- **On change:** Refetch candles for new pair → A-3

### A-2: Timeframe Buttons
- **Visual:** Row of pill buttons: 1m, 5m, 15m, 30m, 1h, 4h, 1d
- **Click:** Refetch candles for new timeframe → A-3
- **Active button:** Accent background + white text

### A-3: Candlestick Chart
- **Visual:** Full OHLCV candlestick chart with Y-axis price labels
- **Data source:** `botPairCandles(botId, pair, timeframe, 500)` → **FT** `GET /api/v1/pair_candles?pair={pair}&timeframe={tf}&limit=500`
- **FT response:** Array of `[timestamp, open, high, low, close, volume]`
- **Library:** Recharts custom candlestick or D3 or lightweight-charts
- **Features:**
  - Crosshair on hover showing price + time
  - Y-axis with price grid lines
  - X-axis with time labels

### A-4: Indicator Overlay Checkboxes
- **Visual:** Checkboxes for each indicator defined in `plot_config`
- **Data source:** `botPlotConfig(botId)` → **FT** `GET /api/v1/plot_config`
- **FT response:** `{ "main_plot": { "tema": { "color": "#...", "type": "line" }, "sar": {...} }, "subplots": { "RSI": {...}, "MACD": {...} } }`
- **Each checkbox:**
  - Checked → show indicator line on chart (from candle data columns)
  - Unchecked → hide
- **Default checkboxes from prototype:** TEMA toggle, SAR toggle (with color swatches)

### A-5: Trade Markers on Chart
- **Visual:** Triangle markers on candlestick chart: ▲ green for entries, ▼ red for exits
- **Data source:** `botTrades(botId, 500)` → **FT** `GET /api/v1/trades?limit=500`
- **Mapping:** Match trade `open_date` and `close_date` to candle timestamps
- **FT fields (§16):** `open_date`, `close_date`, `open_rate`, `close_rate`, `is_short`

### A-6: Sub-chart Tab Buttons
- **Visual:** 3 tabs below main chart: RSI, MACD, Volume
- **Click:** Switch which sub-chart indicator is displayed
- **Data source:** From `plot_config.subplots` → **FT**

### A-7: RSI Sub-chart
- **Visual:** Bar chart or line showing RSI values (0-100)
- **Data source:** RSI values from candle data (calculated or from plot_config columns)
- **Overbought line:** 70 (red horizontal)
- **Oversold line:** 30 (green horizontal)
- **Bar colors:** Red if RSI > 70, green if RSI < 30, accent otherwise

### A-8: MACD Sub-chart
- **Visual:** Histogram bars + signal line
- **Data source:** MACD from candle data

### A-9: Volume Sub-chart
- **Visual:** Bar chart with green/red bars (up/down candles)
- **Data source:** Volume column from `botPairCandles()` response

## SECTION 2: Orderflow (§29)

### A-10: use_public_trades Toggle
- **Visual:** Toggle switch
- **Maps to:** `config.json` → `exchange.use_public_trades` (§29)
- **On change:** Save to config (requires config save mechanism)

### A-11: Orderflow Parameter Inputs (4)
| Input | Default | FT Param (§29) |
|-------|---------|----------------|
| scale | 0.5 | `orderflow.scale` |
| imbalance_volume | 100 | `orderflow.imbalance_volume` |
| imbalance_ratio | 3.0 | `orderflow.imbalance_ratio` |
| stacked_imbalance_range | 3 | `orderflow.stacked_imbalance_range` |

### A-12: Footprint Chart
- **Visual:** Grid showing bid/ask volumes at each price level
- **Data source:** Requires orderflow data from FT candles (only available with `use_public_trades = true`)
- **FT dataframe columns (§29):** `orderflow`, `imbalances`, `bid`, `ask`, `delta`
- **NOTE:** This is advanced and requires FT to have orderflow data cached

### A-13: CVD (Cumulative Volume Delta) Chart
- **Visual:** Line chart showing cumulative ask-bid delta
- **Data source:** `delta` column from orderflow data (§29)

### A-14: Imbalance Highlights
- **Visual:** List of detected imbalances with price level, type (buy/sell), volume, ratio
- **Data source:** `imbalances` from orderflow (§29)

## SECTION 3: Data Analysis (§20)

### A-15: Quick Stats Cards (4)
| Card | Data Source | FT Fields |
|------|-----------|-----------|
| Total Trades Analyzed | `botProfit(id).trade_count` | `trade_count` (§8) |
| Avg Trade Duration | `botProfit(id).avg_duration` | `avg_duration` (§8) |
| Best Pair | `botProfit(id).best_pair` + `best_rate` | `best_pair`, `best_rate` (§8) |
| Worst Pair | `botPerformance(id)` → sort → last | `GET /api/v1/performance` (§8) |

### A-16: Performance Heatmap
- **Visual:** Grid: rows = pairs, columns = days of week, cells = colored by profit %
- **Data source:** `botDaily(id, 30)` → group by pair and weekday
- **OR:** `botPerformance(id)` → **FT** `GET /api/v1/performance`
- **Cell colors:** Green intensity for positive, red for negative

### A-17: Jupyter Notebooks List
- **Visual:** 2 notebook links
- **Data source:** Static list or from server file listing
- **Click:** Could open notebook viewer (low priority)
- **Priority:** LOW

## SECTION 4: Extended Profit Analysis (§8 — previously unmapped endpoints)

### A-18: Weekly Profit Table
- **Visual:** Table showing weekly profit breakdown
- **Columns:** Week Start, Trades, Profit (abs), Profit (%)
- **Data source:** `botWeekly(botId)` → **FT** `GET /api/v1/weekly`
- **FT ref:** §8 REST API

### A-19: Monthly Profit Table
- **Visual:** Table showing monthly profit breakdown
- **Columns:** Month, Trades, Profit (abs), Profit (%)
- **Data source:** `botMonthly(botId)` → **FT** `GET /api/v1/monthly`
- **FT ref:** §8 REST API

### A-20: Entry Tag Analysis Table
- **Visual:** Table showing performance by entry tag (enter_tag)
- **Columns:** Tag, Trades, Win Rate, Profit, Avg Duration
- **Data source:** `botEntries(botId)` → **FT** `GET /api/v1/entries`
- **FT ref:** §8 REST API

### A-21: Exit Reason Analysis Table
- **Visual:** Table showing performance by exit reason
- **Columns:** Exit Reason, Trades, Win Rate, Profit, Avg Duration
- **Data source:** `botExits(botId)` → **FT** `GET /api/v1/exits`
- **FT ref:** §8 REST API

### A-22: Combined Tag Analysis (Mix Tags)
- **Visual:** Table showing entry+exit tag combinations
- **Columns:** Entry Tag, Exit Reason, Trades, Win Rate, Profit
- **Data source:** `botMixTags(botId)` → **FT** `GET /api/v1/mix_tags`
- **FT ref:** §8 REST API

### A-23: Trade Statistics Summary
- **Visual:** Stats card group showing advanced trading metrics
- **Data source:** `botStats(botId)` → **FT** `GET /api/v1/stats`
- **FT fields:** Duration averages (winning/losing/all), sell reasons breakdown
- **FT ref:** §8 REST API

## SECTION 5: Additional Bot Controls (§8 — previously unmapped endpoints)

**NOTE:** These FT endpoints are used on Dashboard (PAGE 1) and Risk (PAGE 6) as additional action buttons.

### D-22: Stop New Entries Button (Dashboard bot card action)
- **Visual:** "⏸ Stop Entries" in bot card ⋮ menu
- **Click:** `botStopBuy(botId)` → **FT** `POST /api/v1/stopbuy`
- **Effect:** Bot continues managing open trades but won't open new ones
- **FT ref:** §8 — different from soft kill (which is `/api/v1/stop`)

### D-23: Pause Bot Button (Dashboard bot card action)
- **Visual:** "⏯ Pause" in bot card ⋮ menu
- **Click:** `botPause(botId)` → **FT** `POST /api/v1/pause`
- **Effect:** Pauses bot trading loop temporarily
- **FT ref:** §8

---

# PAGE 6: RISK MANAGEMENT

**File:** `app/risk/page.tsx`
**Route:** `/risk`
**Auth:** Required
**Prototype:** `prototypes/risk.html`
**Auto-refresh:** Every 5 seconds

## Data Flow
```
On mount + every 5s:
  1. getBots()                           ORCH GET /api/bots/
  2. getRiskEvents()                     ORCH GET /api/kill-switch/events
  3. For each bot:
     a. botLocks(bot.id)                FT GET /api/v1/locks
     b. botConfig(bot.id)              FT GET /api/v1/show_config
  4. portfolioBalance()                  ORCH GET /api/portfolio/balance
```

## SECTION: Kill Switch Control Panel

### R-1: SOFT KILL Card Button
- **Visual:** Large amber card with ⏸️ icon, "SOFT KILL" title
- **Description:** "Stop Trading — no new entries. Open positions remain untouched."
- **API endpoint shown:** `POST /api/v1/stop`
- **Click:** Confirm dialog → `softKillAll("Manual soft kill from risk page")`
- **API:** **ORCH** `POST /api/kill-switch/soft-all` → body: `{ "reason": "Manual soft kill" }`
- **What server does:** For each running bot: `POST /api/v1/stop` → update status → create RiskEvent
- **On success:** Show success toast, refresh page data
- **On error:** Show error alert

### R-2: EMERGENCY CLOSE ALL Card Button
- **Visual:** Large red card with 🛑 icon, "EMERGENCY CLOSE ALL" title
- **Description:** "Force-exit ALL positions at MARKET and stop ALL bots. Nuclear option."
- **API endpoints shown:** `POST /api/v1/forceexit + /api/v1/stop`
- **Click:** Confirm dialog with WARNING → `hardKillAll("Emergency close all from risk page")`
- **API:** **ORCH** `POST /api/kill-switch/hard-all` → body: `{ "reason": "Emergency close all" }`
- **What server does:** For each bot: `POST /api/v1/forceexit` (all trades at MARKET) → `POST /api/v1/stop` → update status to "killed" → create RiskEvent
- **Confirm dialog text:** "HARD KILL: This will forceexit ALL positions at MARKET and stop ALL bots. Are you sure?"
- **On success:** Show alert "All bots killed successfully"

### R-3: Bot Selector Dropdown
- **Visual:** `<select>` with "Select bot to kill..." placeholder
- **Options:** Load from `getBots()` → **ORCH**
- **Format:** "{bot.name} ({bot.is_dry_run ? 'PAPER' : 'LIVE'}) - {bot.status}"
- **Used with:** Per-bot kill buttons (soft kill selected bot, hard kill selected bot)

### R-4: KILL ALL BOTS Button
- **Visual:** Red button next to dropdown
- **Click:** Same as R-2 (hardKillAll)

### R-5: Per-Bot Soft Kill Button (not in current React, in prototype implied)
- **Visual:** Amber button "SOFT KILL" (appears when bot selected in R-3)
- **Click:** `softKill(selectedBotId, "Manual per-bot soft kill")`
- **API:** **ORCH** `POST /api/kill-switch/soft/{botId}`

### R-6: Per-Bot Hard Kill Button
- **Visual:** Red button "HARD KILL" (appears when bot selected)
- **Click:** Confirm → `hardKill(selectedBotId, "Manual per-bot hard kill")`
- **API:** **ORCH** `POST /api/kill-switch/hard/{botId}`

### R-7: Running Status Indicator
- **Visual:** Green dot + "{X} / {Y} Running" + "{Z} stopped ({names})"
- **Data:** `getBots()` → count `status === 'running'` vs total → **ORCH**

### R-8: Last Event Display
- **Visual:** Text showing most recent risk event
- **Data:** `getRiskEvents()` → first item → **ORCH**
- **Format:** "{kill_type} — {bot_name} — {created_at}"

## SECTION: Heartbeat Monitor

### R-10: Heartbeat Card (one per bot)
For each bot from `getBots()`:

- **Visual:** Card showing:
  - Bot name
  - Status dot (green=ok, amber=warning, red=failed)
  - Status label: "Healthy" / "Warning" / "Stopped"
  - Last Ping time
  - Failures count with 3 indicator dots

- **Data mapping:**

| Field | Source | API |
|-------|--------|-----|
| Bot name | `bot.name` | **ORCH** `getBots()` |
| Status | Derived: `consecutive_failures === 0` = ok, `1-2` = warn, `>= 3` = fail | **ORCH** |
| Last Ping | **ORCH** heartbeat data (needs `last_ping` field on bot or heartbeat endpoint) | **ORCH** `GET /api/bots/` or `GET /api/heartbeat/status` |
| Failures | `bot.consecutive_failures` | **ORCH** `getBots()` |
| Failure dots | 3 dots, filled red for each failure | Derived from failures count |

- **Auto-kill info:** If failures >= 3, show text: "Auto-killed at {time} after 3 consecutive ping failures"
- **Status dot animations:**
  - OK: solid green with glow
  - Warning: amber, no animation
  - Failed: red, pulsing animation

## SECTION: FT Protections Status (read-only)

### R-20: Protection Cards (one per protection)
- **Data source:** `botConfig(botId)` → `protections` array → **FT** `GET /api/v1/show_config`
- **FT ref:** §7 Protections

For each protection in config:

**Card layout:**
```
┌──────────────────────────────────┐
│ StoplossGuard           [ACTIVE] │
│                                  │
│ trade_limit        4             │
│ lookback_period    1440          │
│ stop_duration      720           │
│ only_per_pair      false         │
│ only_per_side      true          │
│ required_profit    0.0           │
└──────────────────────────────────┘
```

**Protection types and their params (§7):**

| Protection | Params |
|-----------|--------|
| StoplossGuard | `trade_limit`, `lookback_period_candles`, `stop_duration_candles`, `only_per_pair`, `only_per_side`, `required_profit` |
| MaxDrawdown | `trade_limit`, `lookback_period_candles`, `stop_duration_candles`, `max_allowed_drawdown` |
| LowProfitPairs | `trade_limit`, `lookback_period_candles`, `stop_duration_candles`, `required_profit` |
| CooldownPeriod | `stop_duration_candles`, `only_per_pair` |

**Badge states:**
- "ACTIVE" (green) — protection is configured and not triggered
- "TRIGGERED" (red) — protection is currently triggered (pair is locked)
- Determine triggered state by checking `botLocks(id)` → if any lock has reason matching this protection

### R-21: MaxDrawdown Progress Bar
- **Visual:** Horizontal progress bar showing current drawdown vs max allowed
- **Data:** Current drawdown approximate from `botProfit(id)` profit data. Max from protection config `max_allowed_drawdown`.
- **Color:** Green if < 50% of max, amber if 50-80%, red if > 80%

### R-22: LowProfitPairs Flagged Pairs
- **Visual:** List of pair badges showing locked pairs
- **Data:** `botLocks(botId)` → filter locks where reason contains "LowProfitPairs" → **FT** `GET /api/v1/locks`

## SECTION: Pair Locks Table

### R-30: Pair Locks Table
- **Data source:** `botLocks(botId)` for each bot → **FT** `GET /api/v1/locks`
- **FT response:** `{ "locks": [{ "id": 1, "pair": "DOGE/USDT:USDT", "until": "2026-03-28T02:15:00", "reason": "...", "active": true }] }`
- **Columns:**

| Column | FT Field | Display |
|--------|----------|---------|
| Pair | `pair` | "DOGE/USDT:USDT" |
| Lock Until | `until` | Formatted datetime |
| Reason | `reason` | Full reason text |
| Status | `active` | "Active" (red badge) / "Expired" (gray badge) |

## SECTION: Portfolio Exposure

### R-40: Portfolio Exposure Bars
- **Visual:** Horizontal bar chart showing allocation per bot
- **Data source:** `portfolioBalance()` → **ORCH** `GET /api/portfolio/balance`
- **Response:** `{ "bots": { "BTC-Scalper": { "total": 18327, ... }, ... }, "total_value": 48230 }`
- **Per bot:** Bar width = `bot_balance / total_value * 100%`
- **Display:** Bot name | progress bar | value | percentage
- **Colors:** Different gradient per bot

## SECTION: Risk Events Log

### R-50: Risk Events Table
- **Data source:** `getRiskEvents()` → **ORCH** `GET /api/kill-switch/events`
- **ORCH response:** Array of `RiskEvent` objects
- **Columns:**

| Column | Field | Display |
|--------|-------|---------|
| Timestamp | `created_at` | Formatted datetime |
| Bot | Bot name (join with bots table via `bot_instance_id`) | "BTC-Scalper" or "ALL BOTS" if null |
| Kill Type | `kill_type` | Badge: "HARD" (red) / "SOFT" (amber) |
| Trigger | `trigger` | Badge: "MANUAL" (accent) / "HEARTBEAT" (purple) / "DRAWDOWN" (cyan) |
| Reason | `reason` | Full text |
| Triggered By | `triggered_by` | Username or "System (heartbeat)" |

### R-51: "Showing last N events" Link
- **Visual:** Text link in card header
- **Click:** Toggle between last 10 / last 50 / all events
- **API:** Pass `?limit=N` to getRiskEvents

---

# PAGE 7: SETTINGS

**File:** `app/settings/page.tsx`
**Route:** `/settings`
**Auth:** Required
**Prototype:** `prototypes/settings.html`

## CRITICAL: Bot Selector (NOT IN PROTOTYPE, NEEDED)

### SET-0: Bot Selector Dropdown (top of page)
- **Visual:** Dropdown to select which bot's config to edit
- **Options:** Load from `getBots()` → **ORCH**
- **On change:** Reload all config fields from `botConfig(selectedBotId)` → **FT** `GET /api/v1/show_config`
- **NOTE:** This is essential — without it, we don't know WHICH config we're editing

## Data Flow
```
On mount:
  1. getBots()                          ORCH GET /api/bots/
  2. botConfig(selectedBotId)           FT GET /api/v1/show_config
  → Populates ALL form fields with current config values
```

## Tab Navigation

### SET-1: Settings Tabs (7 vertical tabs)
| Tab | Label | Icon | FT Section |
|-----|-------|------|------------|
| core | Core Trading | ⚙️ | §1 |
| pairlists | Pairlists | 📋 | §7 |
| exchange | Exchange | 🏦 | §9 |
| telegram | Telegram | 📨 | §11 |
| webhooks | Webhooks | 🔗 | §13 |
| producer | Producer/Consumer | 📡 | §17 |
| advanced | Advanced | 🔧 | §28 |

**Click on tab:** Switch visible content panel. Local state only.

## TAB: Core Trading (§1)

Every input below maps to a specific `config.json` parameter. The current value loads from `botConfig(botId)`.

### SET-10: Bot Name
- **Input type:** Text
- **FT param:** `bot_name`
- **Load from:** `config.bot_name`

### SET-11: Initial State
- **Input type:** Dropdown: running / stopped
- **FT param:** `initial_state`
- **Load from:** `config.initial_state`

### SET-12: Max Open Trades
- **Input type:** Number
- **FT param:** `max_open_trades`
- **Load from:** `config.max_open_trades`

### SET-13: Stake Currency
- **Input type:** Text
- **FT param:** `stake_currency`
- **Load from:** `config.stake_currency`

### SET-14: Stake Amount
- **Input type:** Text (can be number or "unlimited")
- **FT param:** `stake_amount`
- **Load from:** `config.stake_amount`

### SET-15: Tradable Balance Ratio
- **Input type:** Number, step 0.01, range 0-1
- **FT param:** `tradable_balance_ratio`
- **Load from:** `config.tradable_balance_ratio`

### SET-16: Available Capital
- **Input type:** Number
- **FT param:** `available_capital`
- **Load from:** `config.available_capital`

### SET-17: Fiat Display Currency
- **Input type:** Dropdown: USD, EUR, GBP, JPY, None
- **FT param:** `fiat_display_currency`
- **Load from:** `config.fiat_display_currency`

### SET-18: Timeframe
- **Input type:** Dropdown: 1m, 5m, 15m, 30m, 1h, 4h, 1d
- **FT param:** `timeframe`
- **Load from:** `config.timeframe`

### SET-19: Force Entry Enable
- **Input type:** Dropdown: true/false
- **FT param:** `force_entry_enable`

### SET-20: Dry Run Toggle
- **Input type:** Toggle
- **FT param:** `dry_run`
- **Load from:** `config.dry_run`
- **WARNING:** Changing this from true to false means LIVE TRADING

### SET-21: Cancel Open Orders on Exit Toggle
- **FT param:** `cancel_open_orders_on_exit`

### SET-22: Process Only New Candles Toggle
- **FT param:** `process_only_new_candles`

### SET-23: Dry Run Wallet
- **Input type:** Number
- **FT param:** `dry_run_wallet`
- **Visible only when:** dry_run = true

### SET-24: Minimal ROI Table Editor
- **Visual:** Table with rows: Time (min) | ROI (%) | Remove
- **FT param:** `minimal_roi` (dict: `{"0": 0.10, "30": 0.05, ...}`)
- **Load from:** `config.minimal_roi` → convert to table rows
- **"+ Add Row" button:** Add new time/ROI pair
- **"Remove" button per row:** Delete that entry
- **Inputs:** Number inputs for time and ROI percentage

### SET-25: Stoploss
- **Input type:** Number, step 0.005
- **FT param:** `stoploss`

### SET-26: Trailing Stop Toggle
- **FT param:** `trailing_stop`

### SET-27: Trailing Stop Positive
- **Input type:** Number
- **FT param:** `trailing_stop_positive`
- **Visible when:** trailing_stop = true

### SET-28: Trailing Stop Positive Offset
- **FT param:** `trailing_stop_positive_offset`
- **Visible when:** trailing_stop = true

### SET-29: Trailing Only Offset Is Reached
- **FT param:** `trailing_only_offset_is_reached`

### SET-30: Use Exit Signal Toggle
- **FT param:** `use_exit_signal`

### SET-31: Exit Profit Only Toggle
- **FT param:** `exit_profit_only`

### SET-32: Ignore ROI If Entry Signal Toggle
- **FT param:** `ignore_roi_if_entry_signal`

### SET-33: Exit Profit Offset
- **FT param:** `exit_profit_offset`

### SET-34: Order Types (6 dropdowns)
Each is a dropdown with options: limit, market
- **Entry:** `order_types.entry`
- **Exit:** `order_types.exit`
- **Emergency Exit:** `order_types.emergency_exit`
- **Force Exit:** `order_types.force_exit`
- **Force Entry:** `order_types.force_entry`
- **Stoploss:** `order_types.stoploss`

### SET-35: Stoploss on Exchange Toggle
- **FT param:** `order_types.stoploss_on_exchange`

### SET-36: Stoploss on Exchange Interval
- **FT param:** `order_types.stoploss_on_exchange_interval`

### SET-37: Stoploss on Exchange Limit Ratio
- **FT param:** `order_types.stoploss_on_exchange_limit_ratio`

### SET-38: Order Time in Force (2 dropdowns)
- **Entry TIF:** `order_time_in_force.entry` → GTC/FOK/IOC
- **Exit TIF:** `order_time_in_force.exit` → GTC/FOK/IOC

### SET-39: Unfilled Timeout (4 inputs)
- **Entry Timeout:** `unfilledtimeout.entry` (number)
- **Exit Timeout:** `unfilledtimeout.exit` (number)
- **Unit:** `unfilledtimeout.unit` (dropdown: minutes/seconds)
- **Exit Timeout Count:** `unfilledtimeout.exit_timeout_count` (number)

### SET-40: Entry Pricing (4 inputs)
- **Price Side:** `entry_pricing.price_side` (dropdown: same/other/bid/ask)
- **Use Order Book:** `entry_pricing.use_order_book` (dropdown: true/false)
- **Order Book Top:** `entry_pricing.order_book_top` (number)
- **Price Last Balance:** `entry_pricing.price_last_balance` (number)

### SET-41: Exit Pricing (3 inputs)
- **Price Side:** `exit_pricing.price_side`
- **Use Order Book:** `exit_pricing.use_order_book`
- **Order Book Top:** `exit_pricing.order_book_top`

### SET-42: Position Adjustment Enable Toggle
- **FT param:** `position_adjustment_enable`

### SET-43: Max Entry Position Adjustment
- **FT param:** `max_entry_position_adjustment`
- **Visible when:** position_adjustment_enable = true

### SET-44: Trading Mode
- **Dropdown:** spot, futures
- **FT param:** `trading_mode`

### SET-45: Margin Mode
- **Dropdown:** isolated, cross
- **FT param:** `margin_mode`
- **Visible when:** trading_mode = futures

### SET-46: Liquidation Buffer
- **Input type:** Number
- **FT param:** `liquidation_buffer`
- **Visible when:** trading_mode = futures

## TAB: Pairlists (§7)

### SET-50: Pairlist Handler Selector
- **Dropdown:** StaticPairList, VolumePairList, PercentChangePairList, ProducerPairList, RemotePairList, MarketCapPairList
- **FT param:** `pairlists[0].method`
- **On change:** Show/hide relevant sub-params for selected handler

### SET-51: Handler-specific Params
**For VolumePairList:**
- number_assets (number)
- sort_key (dropdown: quoteVolume/baseVolume)
- min_value (number)
- refresh_period (number, seconds)

**For PercentChangePairList:**
- number_assets, sort_key, min_value, max_value, refresh_period

**For RemotePairList:**
- pairlist_url, refresh_period, bearer_token, read_timeout, number_assets

**For MarketCapPairList:**
- number_assets, max_rank, refresh_period

### SET-52: Whitelist Tag Editor
- **Visual:** Tag input showing current whitelisted pairs
- **Load from:** `config.exchange.pair_whitelist` → **FT**
- **FT param:** `exchange.pair_whitelist`
- **Add:** Type pair name + Enter → adds tag
- **Remove:** Click ✕ on tag → removes pair
- **Current whitelist also available from:** `botWhitelist(id)` → **FT** `GET /api/v1/whitelist`

### SET-53: Blacklist Tag Editor
- **Visual:** Same as whitelist but for blacklisted pairs/patterns
- **FT param:** `exchange.pair_blacklist`
- **Supports regex patterns** (e.g., `BNB/.*`, `.*DOWN/USDT:USDT`)
- **Load from:** `config.exchange.pair_blacklist`
- **Also:** `botBlacklist(id)` → **FT** `GET /api/v1/blacklist`

### SET-54: Pairlist Filters (11 collapsible cards)
Each filter is a collapsible card with:
- Toggle (enable/disable)
- Params when expanded

| Filter | Params (§7) |
|--------|-------------|
| AgeFilter | `min_days_listed`, `max_days_listed` |
| DelistFilter | `max_days_from_now` (default 0 = immediate), `min_days_until_removed` |
| SpreadFilter | `max_spread_ratio` |
| PriceFilter | `low_price_ratio`, `min_price`, `max_price` |
| RangeStabilityFilter | `min_rate_of_change`, `max_rate_of_change`, `lookback_days` |
| VolatilityFilter | `min_volatility`, `max_volatility`, `lookback_days` |
| OffsetFilter | `offset`, `number_assets` |
| PerformanceFilter | `trade_back_seconds`, `min_profit` |
| FullTradesFilter | (no params) |
| PrecisionFilter | (no params) |
| ShuffleFilter | `seed` |

- **FT param:** `pairlists` array (after the primary handler)
- **Toggle on:** Add filter to pairlists array
- **Toggle off:** Remove from array

### SET-55: Test Pairlist Button
- **Click:** Run `freqtrade test-pairlist` with current config → show resulting pair list
- **API:** **ORCH** `POST /api/bots/{id}/utility/test-pairlist` (NEW)
- **Result:** List of pairs that pass all filters

## TAB: Exchange (§9)

### SET-60: Exchange Name
- **Dropdown:** binance, bybit, okx, gate, kraken, bitget, htx, kucoin
- **FT param:** `exchange.name`

### SET-61: API Key (password input)
- **FT param:** `exchange.key`
- **WARNING:** Sensitive — mask by default

### SET-62: API Secret (password input)
- **FT param:** `exchange.secret`

### SET-63: Password (password input)
- **FT param:** `exchange.password`
- **Note:** Only some exchanges require this

### SET-64: UID
- **FT param:** `exchange.uid`

### SET-65: Enable WebSocket Toggle
- **FT param:** `exchange.enable_ws`

### SET-66: Markets Refresh Interval
- **FT param:** `exchange.markets_refresh_interval`

### SET-67: CCXT Config (JSON textarea)
- **FT param:** `exchange.ccxt_config`
- **Visual:** Monospace textarea for raw JSON

## TAB: Telegram (§11)

### SET-70: Telegram Enabled Toggle
- **FT param:** `telegram.enabled`

### SET-71: Bot Token (password input)
- **FT param:** `telegram.token`

### SET-72: Chat ID
- **FT param:** `telegram.chat_id`

### SET-73: Notification Toggles (8)
- Entry, Exit, Entry Cancel, Exit Cancel, Entry Fill, Exit Fill, Status, Allow Custom Messages
- **FT params:** `telegram.notification_settings.entry`, `.exit`, etc.

## TAB: Webhooks (§13)

### SET-80: Webhook Enabled Toggle
- **FT param:** `webhook.enabled`

### SET-81: Webhook URL
- **FT param:** `webhook.url`

### SET-82: Webhook Event Configs (7 collapsible events)
Each event has:
- Toggle (enable/disable)
- JSON payload textarea

| Event | FT Param |
|-------|----------|
| webhookentry | `webhook.webhookentry` |
| webhookentrycancel | `webhook.webhookentrycancel` |
| webhookentryfill | `webhook.webhookentryfill` |
| webhookexit | `webhook.webhookexit` |
| webhookexitcancel | `webhook.webhookexitcancel` |
| webhookexitfill | `webhook.webhookexitfill` |
| webhookstatus | `webhook.webhookstatus` |

### SET-83: Available Variables Reference
- **Visual:** Read-only table showing all available placeholder variables
- **Content:** `{trade_id}`, `{pair}`, `{open_rate}`, `{close_rate}`, `{close_profit_abs}`, `{stake_amount}`, `{enter_tag}`, `{exit_reason}`, `{is_short}`, `{leverage}`, etc.
- **Not interactive** — reference only

## TAB: Producer/Consumer (§17)

### SET-90: External Message Consumer Enabled
- **FT param:** `external_message_consumer.enabled`

### SET-91: Remove Entry/Exit Signals Toggle
- **FT param:** `external_message_consumer.remove_entry_exit_signals`

### SET-92: Wait Timeout
- **FT param:** `external_message_consumer.wait_timeout`

### SET-93: Ping Timeout
- **FT param:** `external_message_consumer.ping_timeout`

### SET-94: Producer Rows (dynamic list)
Each producer has:
- Name input → `producers[N].name`
- Host input → `producers[N].host`
- Port input → `producers[N].port`
- WS Token input → `producers[N].ws_token`
- Remove button → delete this producer

### SET-95: Add Producer Button
- **Click:** Add new empty producer row

## TAB: Advanced (§28)

### SET-100: Database Type
- **Dropdown:** SQLite, PostgreSQL, MariaDB
- **FT param:** `db_url` (derived from type + connection string)

### SET-101: Connection String
- **FT param:** `db_url`

### SET-102: Log Level
- **Dropdown:** ERROR, INFO, DEBUG, TRACE
- **Maps to:** CLI verbose flags or `log_config`

### SET-103: Log File
- **FT param:** `logfile`

### SET-104: Log Rotate Settings
- **Enabled/Disabled toggle**
- **Rotate Max Bytes:** Number input, default 10485760 (10MB)
  - **FT param:** `log_config.handlers.RotatingFileHandler.maxBytes` (§28)
- **Backup Count:** Number input, default 10
  - **FT param:** `log_config.handlers.RotatingFileHandler.backupCount` (§28)
- **Note:** These only apply when `logfile` is set. FT supports RotatingFileHandler, Syslog, Journald.

### SET-105: Multi-Instance Info (read-only display)
- API Listen IP: `api_server.listen_ip_address`
- API Listen Port: `api_server.listen_port`
- API Username: `api_server.username`
- API Password: `api_server.password` (masked)

## SAVE BAR (sticky bottom, all tabs)

### SET-110: Save Configuration Button
- **Visual:** Primary button "Save Configuration", sticky at bottom of page
- **Click:**
  1. Collect ALL form values from ALL tabs
  2. Build config.json object
  3. Send to orchestrator: **ORCH** `PUT /api/bots/{botId}/config` (NEW endpoint)
     - Body: full config.json object
     - Orchestrator writes to FT config file
  4. Call `reloadBotConfig(botId)` → **ORCH** `POST /api/bots/{botId}/reload-config` → **FT** `POST /api/v1/reload_config`
  5. Show success toast
- **On error:** Show error message, keep form state

### SET-111: Reset to Defaults Button
- **Visual:** Secondary/ghost button "Reset to Defaults"
- **Click:** Reset all form fields to FT default values (hardcoded defaults from FT docs)

### SET-112: Unsaved Changes Indicator
- **Visual:** Dot indicator in save bar
- **Green:** All saved
- **Amber:** Unsaved changes detected
- **Logic:** Compare current form values with last saved values

---

# PAGE 8: FREQAI

**File:** `app/freqai/page.tsx`
**Route:** `/freqai`
**Auth:** Required
**Prototype:** `prototypes/freqai.html`

## Data Flow
```
On mount:
  1. getBots()                           ORCH GET /api/bots/
  2. botConfig(selectedBotId)            FT GET /api/v1/show_config
  → Extract config.freqai section → populate all form fields
```

## SECTION: Master Switch

### AI-1: FreqAI Engine Toggle
- **Visual:** Large toggle switch at top of page
- **FT param:** `freqai.enabled` (§24)
- **Load from:** `config.freqai.enabled`
- **When OFF:** All sections below are disabled/grayed out

## SECTION: Core Configuration (§24) — Collapsible

### AI-10: Identifier Input
- **FT param:** `freqai.identifier`
- **Example:** "unique-freqai-model-1"

### AI-11: Model Selector
- **Dropdown with 14 options:**

| Model | Type | FT ref |
|-------|------|--------|
| LightGBMRegressor | Regression | §24 |
| LightGBMClassifier | Classification | §24 |
| XGBoostRegressor | Regression | §24 |
| XGBoostClassifier | Classification | §24 |
| XGBoostRFRegressor | Regression | §24 |
| XGBoostRFClassifier | Classification | §24 |
| CatboostRegressor | Regression (⚠️ DEPRECATED) | §24 |
| CatboostClassifier | Classification (⚠️ DEPRECATED) | §24 |
| PyTorchMLPRegressor | Regression (DL) | §24 |
| PyTorchMLPClassifier | Classification (DL) | §24 |
| PyTorchTransformerRegressor | Regression (DL) | §24 |
| ReinforcementLearner | RL (PPO) | §25 |
| ReinforcementLearner_multiproc | RL (PPO multi) | §25 |
| SKLearnRandomForestRegressor | Regression | §24 |

- **On change:** If RL model selected → show RL section (AI-40). If PyTorch → show PyTorch section (AI-50).
- **⚠️ CatBoost note:** CatboostRegressor/Classifier are deprecated in FT 2026.2 and unavailable on ARM. Show warning badge "Deprecated" next to these options. Still selectable but with amber warning text.

### AI-12: Train Period Days
- **FT param:** `freqai.train_period_days`

### AI-13: Backtest Period Days
- **FT param:** `freqai.backtest_period_days`

### AI-14: Live Retrain Hours
- **FT param:** `freqai.live_retrain_hours`

### AI-15: Expired Hours
- **FT param:** `freqai.expired_hours`

### AI-16: Purge Old Models
- **FT param:** `freqai.purge_old_models`

### AI-17: Continual Learning Toggle
- **FT param:** `freqai.continual_learning`

### AI-18: Activate TensorBoard Toggle
- **FT param:** `freqai.activate_tensorboard`

## SECTION: Feature Parameters (§24, §26) — Collapsible

### AI-20: Include Timeframes (chip multi-select)
- **Options:** 1m, 5m, 15m, 30m, 1h, 4h, 1d
- **FT param:** `freqai.feature_parameters.include_timeframes`
- **Click on chip:** Toggle selected state

### AI-21: Include Corr Pairlist (chip multi-select)
- **Options:** Pair chips from whitelist
- **FT param:** `freqai.feature_parameters.include_corr_pairlist`

### AI-22: Include Shifted Candles
- **FT param:** `freqai.feature_parameters.include_shifted_candles`

### AI-23: Indicator Periods Candles (array tag input)
- **Visual:** Tag input showing numbers: 10, 20, 50
- **FT param:** `freqai.feature_parameters.indicator_periods_candles`
- **Add:** Type number + Enter → adds tag
- **Remove:** Click ✕ on tag

### AI-24: Label Period Candles
- **FT param:** `freqai.feature_parameters.label_period_candles`

### AI-25: Fit Live Predictions Candles
- **FT param:** `freqai.feature_parameters.fit_live_predictions_candles`

### AI-26: Data Split Test Size
- **FT param:** `freqai.data_split_parameters.test_size`
- **Range:** 0-1, step 0.05

## SECTION: Feature Engineering Methods (§24) — Collapsible

### AI-30: Method Selector (exclusive chips)
- **Options:** expand_all, expand_basic, standard
- **Click:** Select one (exclusive — deselects others)
- **Maps to:** Which `feature_engineering_*` method template to use in strategy
- **FT ref:** §24 feature_engineering_expand_all(), feature_engineering_expand_basic(), feature_engineering_standard()

## SECTION: Reinforcement Learning (§25) — Collapsible, visible only if RL model selected

### AI-40: RL Config Fields
- Policy selector → RL policy type
- Model type → MLP, LSTM, etc.
- Framework → stable-baselines3
- Epochs → training epochs
- Batch size
- Learning rate
- Add State Info toggle

### AI-41: Reward Parameters (key-value editor)
- **Visual:** Dynamic rows with key + value inputs
- **Pre-filled:** rr=1, profit_aim=0.025, win_reward_factor=10
- **Add row button:** Adds new key-value pair
- **Remove button per row:** Deletes that pair
- **Maps to:** RL reward parameters in strategy

## SECTION: Data Processing & Outlier Detection (§26) — Collapsible

### AI-50: DI Threshold
- **FT param:** `freqai.feature_parameters.DI_threshold`

### AI-51: Use SVM to Remove Outliers Toggle
- **FT param:** `freqai.feature_parameters.use_SVM_to_remove_outliers`

### AI-52: Use DBSCAN to Remove Outliers Toggle
- **FT param:** `freqai.feature_parameters.use_DBSCAN_to_remove_outliers`

### AI-53: Noise Standard Deviation
- **FT param:** `freqai.feature_parameters.noise_standard_deviation`

### AI-54: Additional toggles
- Save Backtest Models
- Write Metrics to Disk
- Reduce DF Footprint → `reduce_df_footprint` (§1)
- Shuffle After Split
- Reverse Train/Test Order

## SECTION: PyTorch Configuration (§24) — Visible only if PyTorch model selected

### AI-60: PyTorch Fields
- Learning Rate → PyTorch optimizer LR
- Epochs → training epochs
- Batch Size
- GPU Layers → number of hidden layers

## ACTION BUTTONS

### AI-70: Save FreqAI Config Button
- **Visual:** Primary button "💾 Save FreqAI Config"
- **Click:** Same save mechanism as Settings:
  1. Build `freqai` section of config.json
  2. **ORCH** `PUT /api/bots/{botId}/config` → merge with existing config
  3. `reloadBotConfig(botId)` → **ORCH** → **FT** `POST /api/v1/reload_config`
- **On success:** Toast "FreqAI config saved and reloaded"

### AI-71: Reset to Defaults Button
- **Click:** Reset all FreqAI fields to FT default values

---

# PAGE 9: DATA MANAGEMENT

**File:** `app/data/page.tsx`
**Route:** `/data`
**Auth:** Required
**Prototype:** `prototypes/data-management.html`

## SECTION: Data Download (§12)

### DM-1: Pair Multi-Select
- **Visual:** Multi-select box showing available pairs
- **Options:** Load from `botWhitelist(botId)` + common pairs → **FT** `GET /api/v1/whitelist`
- **Maps to:** CLI arg `--pairs BTC/USDT:USDT ETH/USDT:USDT ...` (§12)

### DM-2: Exchange Selector
- **Dropdown:** binance, bybit, okx, gate, kraken, bitget
- **Maps to:** CLI arg `--exchange {name}` (§12)
- **Default:** From bot config

### DM-3: Trading Mode Selector
- **Dropdown:** spot, futures
- **Maps to:** CLI arg `--trading-mode {mode}` (§12)

### DM-4: Timeframe Checkboxes (8)
- **Options:** 1m, 5m, 15m, 30m, 1h ✅, 4h, 1d ✅, 1w
- **Maps to:** CLI arg `--timeframes 1h 1d` (§12)
- **Click:** Toggle checkbox

### DM-5: Start Date Input
- **Default:** "2022-01-01"
- **Maps to:** `--timerange YYYYMMDD-` (§12)

### DM-6: End Date Input
- **Default:** today's date
- **Maps to:** `-YYYYMMDD` (§12)

### DM-7: Erase Toggle
- **Visual:** Toggle with warning text "Destructive — deletes existing data before download"
- **Maps to:** CLI flag `--erase` (§12)
- **Default:** OFF

### DM-8: Prepend Toggle
- **Maps to:** CLI flag `--prepend` (§12)
- **Default:** ON

### DM-9: ▶ Start Download Button
- **Visual:** Primary button "▶ Start Download"
- **Click:**
  1. Build CLI command from all form values
  2. Send to orchestrator: **ORCH** `POST /api/bots/{botId}/download-data` (NEW)
     - Body: `{ "pairs": [...], "exchange": "binance", "timeframes": ["1h", "1d"], "timerange": "20220101-20260328", "trading_mode": "futures", "erase": false, "prepend": true }`
     - Orchestrator runs: `docker exec freqtrade freqtrade download-data --pairs ... --exchange ... --timeframes ...`
  3. Poll for job completion
  4. Show log output in real-time

### DM-10: Build Command Button
- **Visual:** Secondary button "Build Command"
- **Click:** Show the constructed CLI command as text (for copy/manual use)
- **Output:** `freqtrade download-data --pairs BTC/USDT:USDT ETH/USDT:USDT --exchange binance --timeframes 1h 1d --timerange 20220101-20260328 --trading-mode futures --prepend`

### DM-11: Download Progress/Log
- **Visual:** Monospace log area showing download output
- **Updates:** Stream from orchestrator job output (or poll every 2s)
- **Line types:** info (cyan), ok (green), warn (amber), err (red)

## SECTION: Utility Commands (§18)

Each utility command follows this pattern:
- Title + description
- Optional config inputs
- "▶ Run" button
- Output panel (toggleable, shows command output)

### DM-20: List Strategies
- **Run:** `freqtrade list-strategies`
- **API:** `botFtStrategies(botId)` → **FT** `GET /api/v1/strategies`
- **Output:** List of strategy names with status
- **Click on strategy name:** Load source with `botFtStrategy(botId, name)` → **FT** `GET /api/v1/strategy/{name}`

### DM-21: List Exchanges
- **Run:** `freqtrade list-exchanges`
- **API:** **ORCH** `POST /api/bots/{id}/utility/list-exchanges` (NEW) or use static data
- **Output:** Table of exchanges with spot/margin/futures support

### DM-22: List Timeframes
- **Run:** `freqtrade list-timeframes --exchange {exchange}`
- **Output:** Available timeframes for selected exchange

### DM-23: List Pairs
- **Run:** `freqtrade list-pairs`
- **Output:** All available pairs for exchange
- **Filter input:** Text filter to search pairs
- **Sort dropdown:** By name, by volume

### DM-24: List Data
- **Run:** `freqtrade list-data`
- **API:** **ORCH** `POST /api/bots/{id}/utility/list-data` (NEW)
- **Output:** Table showing:
  - Pair, Timeframe, Date Range, Candle Count, Format, Size
- **From server:** Already have BTC/USDT:USDT 1h + 1d data

### DM-25: Convert Data
- **Inputs:** Format From (dropdown: json/feather/parquet) + Format To (dropdown)
- **Run button:** `freqtrade convert-data --format-from {from} --format-to {to}`
- **API:** **ORCH** `POST /api/bots/{id}/utility/convert-data` (NEW)

### DM-26: Test Pairlist
- **Run:** `freqtrade test-pairlist`
- **API:** **ORCH** `POST /api/bots/{id}/utility/test-pairlist` (NEW)
- **Output:** List of pairs that pass all configured filters

### DM-27: Show Trades
- **Visual:** Trade history table
- **Data source:** `botTrades(botId, 50)` → **FT** `GET /api/v1/trades?limit=50`
- **Columns (§16):** trade_id, pair, is_short, open_rate, close_rate, close_profit_abs, stake_amount, open_date, close_date, exit_reason

### DM-28: List Hyperopt Loss Functions
- **Run:** `freqtrade list-hyperoptloss`
- **Output:** List of 12 loss functions (§6)
- **Can be static** — these don't change

### DM-29: List FreqAI Models
- **Run:** `freqtrade list-freqaimodels`
- **Output:** List of available models (§24)
- **Can be static**

---

# NEW ORCHESTRATOR ENDPOINTS NEEDED

These do NOT exist yet in the orchestrator. They must be built on the server.

## Config Management

### EP-1: `PUT /api/bots/{id}/config`
- **Purpose:** Save updated config.json for a bot
- **Body:** Full or partial config.json object
- **Server action:** Write to FT container's config file
- **Used by:** Settings (SET-110), FreqAI (AI-70)

## Job-Based CLI Commands

### EP-2: `POST /api/bots/{id}/backtest`
- **Purpose:** Start a backtest job
- **Body:** `{ "strategy", "timerange", "timeframe", "timeframe_detail", "pairs", "max_open_trades", "stake_amount", "fee", "enable_protections", "export", "breakdown", "cache", "freqaimodel", "dry_run_wallet", "enable_position_stacking" }`
- **Server action:** Run `docker exec freqtrade freqtrade backtesting --strategy {strategy} --timerange {timerange} ...` in background
- **OR:** Use FT REST API: `POST /api/v1/backtest` (§8 — FT has this endpoint!)
- **Returns:** Job ID for polling

### EP-3: `GET /api/bots/{id}/backtest/{job_id}`
- **Purpose:** Poll backtest job status
- **Returns:** `{ "status": "running|complete|error", "progress": 0-100, "result": {...} }`
- **OR:** Use FT REST API: `GET /api/v1/backtest` (§8)

### EP-4: `POST /api/bots/{id}/hyperopt`
- **Purpose:** Start hyperopt job
- **Body:** All hyperopt CLI args as JSON
- **Server action:** Run hyperopt in background
- **Returns:** Job ID

### EP-5: `POST /api/bots/{id}/download-data`
- **Purpose:** Download OHLCV data
- **Body:** `{ "pairs", "exchange", "timeframes", "timerange", "trading_mode", "erase", "prepend" }`
- **Server action:** Run `freqtrade download-data` in background

### EP-6: `POST /api/bots/{id}/list-data`
- **Purpose:** List available data files
- **Returns:** Array of `{ pair, timeframe, start_date, end_date, candle_count, format, size }`

### EP-7: `POST /api/bots/{id}/utility/{command}`
- **Purpose:** Run utility subcommand
- **Supported commands:** `list-strategies`, `list-exchanges`, `list-timeframes`, `list-pairs`, `test-pairlist`, `convert-data`, `list-hyperoptloss`, `list-freqaimodels`, `lookahead-analysis`, `recursive-analysis`
- **Returns:** Command output text or parsed JSON

### EP-8: `GET /api/heartbeat/status`
- **Purpose:** Get heartbeat status for all bots
- **Returns:** `{ "bots": [{ "id", "name", "status", "last_ping", "consecutive_failures", "is_healthy" }] }`

### EP-9: `POST /api/strategies/import`
- **Purpose:** Upload a .py strategy file
- **Body:** Multipart form with .py file
- **Server action:** Save to FT strategies directory + create Strategy record in DB

## IMPORTANT NOTE ON FT BACKTEST API (§8)

FT already has REST endpoints for backtesting:
- `POST /api/v1/backtest` — start backtest
- `GET /api/v1/backtest` — poll backtest status/results
- `DELETE /api/v1/backtest` — abort backtest
- `GET /api/v1/backtest/history` — list past backtests
- `GET /api/v1/backtest/history/result` — get past result

**This means EP-2 and EP-3 might just proxy to FT's built-in backtest API** rather than running CLI commands. The orchestrator should proxy these endpoints.

---

# ADDENDUM: PREVIOUSLY MISSING FT FEATURES

These features were identified during review as present in FREQTRADE_REFERENCE.md but not originally documented in PAGE_SPECS.

## ADD-1: Advanced Hyperopt — Custom Loss Functions (§15)

**Page:** Backtesting (PAGE 4), Hyperopt tab

### BT-54: Custom Loss Function Info Panel
- **Visual:** Expandable info panel below loss function selector (BT-42)
- **Content:** Shows the interface signature for custom loss functions:
  ```python
  class IHyperOptLoss:
      @staticmethod
      def hyperopt_loss_function(results, trade_count, min_date, max_date,
                                  config, processed, backtest_stats, **kwargs) -> float:
  ```
- **FT ref:** §15 Advanced Hyperopt
- **Note:** Custom loss functions are .py files placed in `user_data/hyperopts/`. We don't build an editor — just show available ones and explain how to create custom.

### BT-55: Hyperopt Path Input
- **Visual:** Text input (optional)
- **Maps to:** CLI arg `--hyperopt-path {path}` (§6)
- **Default:** Empty (uses default path)

### BT-56: Space Type Reference Table (read-only)
- **Visual:** Collapsible reference showing parameter types
- **Content:**
  | Type | Import | Use Case |
  |------|--------|----------|
  | `IntParameter(low, high)` | freqtrade.strategy | Integer range |
  | `DecimalParameter(low, high, decimals)` | freqtrade.strategy | Decimal range |
  | `RealParameter(low, high)` | freqtrade.strategy | Float range |
  | `CategoricalParameter(list)` | freqtrade.strategy | Category selection |
  | `BooleanParameter()` | freqtrade.strategy | True/False |
- **FT ref:** §6, §15

## ADD-2: CLI Arguments as Settings (§27)

**Page:** Settings (PAGE 7), Advanced tab

### SET-106: User Data Directory
- **Input type:** Text
- **FT param:** `user_data_dir` (§1) / CLI `--userdir` (§27)
- **Load from:** `config.user_data_dir`

### SET-107: Data Directory
- **Input type:** Text
- **FT param:** CLI `--datadir` (§27)
- **Note:** Only relevant for CLI operations, stored as orchestrator config

### SET-108: Strategy Path
- **Input type:** Text
- **FT param:** `strategy_path` (§1) / CLI `--strategy-path` (§27)
- **Load from:** `config.strategy_path`

### SET-109: Recursive Strategy Search Toggle
- **FT param:** `recursive_strategy_search` (§1)

### SET-110b: Database URL
- **Input type:** Text (read-only display)
- **FT param:** `db_url` (§1) / CLI `--db-url` (§27)
- **Note:** Already partially covered in SET-100/SET-101, this clarifies CLI mapping

### SET-110c: Verbose Level Selector
- **Dropdown:** Normal, Verbose (-v), Very Verbose (-vv), Debug (-vvv)
- **Maps to:** CLI flags `-v`, `-vv`, `-vvv` (§27)
- **Note:** Applied when starting bot container via orchestrator

## ADD-3: Missing Strategy Callbacks (§3)

**Page:** Strategy Builder (PAGE 3), Step 6 Review / Advanced section

### B-63: Advanced Callbacks Reference Panel
- **Visual:** Collapsible panel "Advanced Callbacks (Optional)" in Step 6 or as separate advanced tab
- **Content:** Read-only reference showing all 21 callbacks with signatures:

| Callback | Signature | Description | In Builder? |
|----------|-----------|-------------|-------------|
| `bot_start` | `(**kwargs) -> None` | Called once at bot start | No (code only) |
| `bot_loop_start` | `(current_time, **kwargs) -> None` | Called each iteration | No (code only) |
| `custom_stake_amount` | `(pair, current_time, ...) -> float` | Custom position size | No (code only) |
| `custom_exit` | `(pair, trade, ...) -> str/bool/None` | Custom exit logic | No (code only) |
| `custom_stoploss` | `(pair, trade, ...) -> float/None` | Dynamic stoploss | No (code only) |
| `custom_roi` | `(pair, trade, ...) -> float/None` | Dynamic ROI | No (code only) |
| `custom_entry_price` | `(pair, trade, ...) -> float` | Custom entry price | No (code only) |
| `custom_exit_price` | `(pair, trade, ...) -> float` | Custom exit price | No (code only) |
| `check_entry_timeout` | `(pair, trade, order, ...) -> bool` | Cancel unfilled entry | No (code only) |
| `check_exit_timeout` | `(pair, trade, order, ...) -> bool` | Cancel unfilled exit | No (code only) |
| `confirm_trade_entry` | `(pair, order_type, ...) -> bool` | Confirm entry | No (code only) |
| `confirm_trade_exit` | `(pair, trade, ...) -> bool` | Confirm exit | No (code only) |
| `adjust_trade_position` | `(trade, ...) -> float/None` | DCA adjustment | No (code only) |
| `adjust_order_price` | `(trade, order, ...) -> float/None` | Refresh limit orders | No (code only) |
| `adjust_entry_price` | `(trade, order, ...) -> float/None` | Refresh entry orders | No (code only) |
| `adjust_exit_price` | `(trade, order, ...) -> float/None` | Refresh exit orders | No (code only) |
| `leverage` | `(pair, ...) -> float` | Custom leverage | YES (B-15) |
| `order_filled` | `(pair, trade, order, ...) -> None` | Post-fill trigger | No (code only) |
| `plot_annotations` | `(pair, ...) -> list[AnnotationType]` | Chart annotations | No (code only) |

- **FT ref:** §3 Strategy Callbacks
- **Note:** The Builder wizard (Steps 1-5) handles basic strategy creation. These advanced callbacks require manual code editing. The panel serves as documentation for power users who export the .py and customize further.

## ADD-4: Pair Locks Management (§7, §8)

**Page:** Risk Management (PAGE 6) — already partially covered in R-30

### R-31: Add Pair Lock Button
- **Visual:** "+ Lock Pair" button above pair locks table (R-30)
- **Click:** Opens modal with:
  - Pair input (dropdown from whitelist)
  - Lock Until (datetime input)
  - Reason (text input)
  - Confirm button
- **API:** `botLockPair(botId, { pair, until, reason })` → **FT** `POST /api/v1/locks` body: `{ "pair": "...", "until": "...", "reason": "..." }`
- **FT ref:** §8 REST API — Locks endpoints

### R-32: Delete Pair Lock Button (per row)
- **Visual:** "🗑️" icon on each active lock in R-30 table
- **Click:** Confirm dialog → `botDeleteLock(botId, lockId)` → **FT** `DELETE /api/v1/locks/{id}`
- **On success:** Remove row from table, show success toast

### R-33: Unlock All Button
- **Visual:** "Unlock All" text button in table header
- **Click:** Confirm → delete all active locks
- **API:** For each active lock: `DELETE /api/v1/locks/{id}` → **FT**

## ADD-5: Capital Allocation Display (§1)

**Page:** Settings (PAGE 7), Core Trading tab + Dashboard (PAGE 1)

### SET-16b: Available Capital Info
- **Visual:** Info box below SET-16 (Available Capital input)
- **Content:** Explains multi-bot capital allocation:
  - "When running multiple bots, set `available_capital` per bot to control how much of the wallet each bot can use."
  - "Total allocated: $X / $Y (sum of all bots' available_capital vs actual wallet)"
- **Data:** Sum `available_capital` from all bots' configs → `botConfig(id)` for each bot
- **FT ref:** §1 `available_capital` parameter

### D-21: Capital Allocation Bar (Dashboard)
- **Visual:** Horizontal stacked bar in Portfolio Summary showing capital allocation per bot
- **Data source:** For each bot: `botConfig(id)` → `available_capital` + `botBalance(id)` → actual balance
- **Display:** Bot name segments with allocated vs used capital
- **Priority:** LOW (nice-to-have after core dashboard works)

---

# COMPLETE ELEMENT COUNT (UPDATED)

| Page | Widgets | FT Features | Our Features (ORCH) |
|------|---------|-------------|-------------------|
| Sidebar | 12 | 0 | 12 (navigation, badges) |
| Header | 6 | 0 | 6 (search, notifications, kill switch) |
| Login | 6 | 0 | 6 (auth) |
| Dashboard | 23 | 19 (trades, profit, balance, daily, capital, stopbuy, pause) | 4 (bot management) |
| Strategies | 20 | 8 (profit, trades, config, strategy source) | 12 (lifecycle, CRUD) |
| Builder | 26 | 23 (all strategy params §2,3,4,7,10 + callback ref) | 3 (save, generate) |
| Backtesting | 38 | 36 (all backtest/hyperopt params §5,6,15,21,22,30) | 2 (job management) |
| Analytics | 25 | 23 (candles, plot_config, trades, performance, orderflow, weekly, monthly, entries, exits, mix_tags, stats) | 2 (display) |
| Risk | 21 | 8 (locks CRUD, config protections) | 13 (kill switch, heartbeat, events) |
| Settings | 65+ | 63 (all config.json params §1,7,9,11,13,17,27,28) | 2 (save, bot selector) |
| FreqAI | 25 | 23 (all freqai config §24,25,26) | 2 (save, master switch) |
| Data Mgmt | 20 | 18 (download-data §12, utilities §18) | 2 (job management) |
| **TOTAL** | **~287** | **~221** | **~66** |

**221 features from FreqTrade** (we just display/configure them)
**66 features from our Orchestrator** (multi-bot, kill switch, lifecycle, auth, jobs)
**0 invented features** ✅

**NOTE on widget counting:** The total counts individual discrete UI elements (buttons, inputs, cards, tables, charts). Some PAGE_SPECS entries group related items (e.g., "Protection toggles (3)" counts as 3 widgets, "Order Types (6 dropdowns)" counts as 6). The header says "~287" which is the expanded count.
