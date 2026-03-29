# Agent 2 — Strategies Page: Unified Strategy-Bot Cards + Drill-Down

## MANDATORY READ ORDER
1. `CLAUDE.md` — rules, philosophy, CUSTOM FEATURE section on unified strategy-bot cards
2. `FT-UI-MAP.html` — feature-to-page blueprint
3. `FREQTRADE_REFERENCE.md` — §2 (Strategy Interface), §5 (Backtesting), §6 (Hyperopt)
4. `prototypes/strategies.html` — **VISUAL REFERENCE** — this is the design target
5. `frontend/src/app/strategies/page.tsx` — CURRENT CODE (~504 lines, needs major rewrite)
6. `frontend/src/app/builder/page.tsx` — Builder page (strategies link to this)
7. `frontend/src/lib/api.ts` — all available API functions
8. `frontend/src/types/index.ts` — all types

---

## CONTEXT

### What exists now
The current strategies page (504 lines) is a basic expandable list showing:
- Strategy name + lifecycle badge
- Description
- Linked bot info + profit summary
- Actions: delete, promote lifecycle, retire

### What it should be (per prototype + owner decision)
A unified strategy-bot card system where **each card represents a strategy+bot combination**. This is a documented custom feature (see CLAUDE.md "CUSTOM FEATURE: Unified Strategy-Bot Cards").

Key decision from project owner:
> "Svaka kartica = strategija + bot + sve u jednom. Klikneš → drill-down sa svim backtestovima, hyperopt rezultatima, trades, stats, AI sugestijama. Čak i ako isti .py koristiš za BTC i ETH, to su dva bota sa dva različita configa = dve kartice."

---

## TASK 1: Rewrite Strategy Cards (Grid Layout)

Replace the current expandable list with a **card grid** matching the prototype design.

### Card Layout
```
┌─────────────────────────────────────────────┐
│ [Icon] StrategyName          [LIVE badge]   │
│        Description text here...              │
│        [BTC/USDT] [1h] [10x leverage]       │
│        🟢 bot-trend-01 running               │
├─────────────────────────────────────────────┤
│ TOTAL    WIN RATE   MAX DD    TRADES        │
│ +$4,820  68.2%      4.1%     142            │
├─────────────────────────────────────────────┤
│ [View Trades] [Analytics] [Edit] [View Bot→]│
└─────────────────────────────────────────────┘
```

### Card data by lifecycle status:

**DRAFT:**
- Stats row: shows "BACKTEST —" (no data yet)
- Actions: [Edit in Builder] [Run Backtest →]
- Description may say "Work in progress"

**BACKTEST:**
- Stats row: BACKTEST PROFIT, WIN RATE, SHARPE, TRADES (from backtest results)
- Actions: [View Results] [Edit] [Re-run Backtest] [Start Paper →]

**PAPER:**
- Stats row: PAPER PROFIT, WIN RATE, MAX DD, TRADES (from bot API, dry_run=true)
- Actions: [View Trades] [Backtest History] [Go Live →]
- Bot status dot: 🟢 running / 🔴 stopped

**LIVE:**
- Stats row: TOTAL PROFIT, WIN RATE, MAX DD, TRADES (from bot API, dry_run=false)
- Actions: [View Trades] [Analytics] [Edit] [View Bot →]
- Bot status dot: 🟢 running / 🔴 stopped

**RETIRED:**
- Stats row: TOTAL PROFIT, WIN RATE, MAX DD, TRADES (historical)
- Actions: [View History] [Clone] [Export .py]
- Card is visually dimmed (lower opacity)

### Filter toolbar
```
[All 8] [Live 3] [Paper 2] [Backtest 1] [Draft 1] [Retired 1]    [Import .py] [+ New Strategy]
```

### Card grid
```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
gap: 14px;
```

---

## TASK 2: Build Drill-Down View

When a card is clicked, show a **full drill-down page** (can be same page with state toggle, like dashboard does with `selectedBotId`).

### Drill-Down Layout (use `selectedStrategyId` state)

**Header:**
```
[← All Strategies]   StrategyName   [LIVE badge]   [Actions: Edit | Pause | Stop | Retire]
```

**Tabs or sections (scrollable):**

1. **Overview** — key stats, current profit, trade count, win rate, max DD, avg duration, best/worst trade
2. **Open Trades** — table of open positions (from `botTrades(botId)` where `is_open=true`)
   - Columns: Pair, is_short, open_rate, stake_amount, current_profit, open_date, enter_tag
3. **Closed Trades** — table of closed trades (from `botTrades(botId)` where `is_open=false`)
   - Columns: Pair, is_short, open_rate, close_rate, close_profit_abs, enter_tag, exit_reason, open_date, close_date
4. **Backtest History** — list of all backtest runs (from `botBacktestHistory(botId)`)
   - Each run shows: date, profit, trades, sharpe, max DD, duration
   - Click to see full backtest details
5. **Hyperopt History** — list of hyperopt runs (from `botHyperoptList(botId)`)
   - Each run shows: loss function, epochs, best result
   - Click to see parameters + results
6. **Performance** — per-pair performance table (from `botPerformance(botId)`)
7. **Entry/Exit Analysis** — entry tags and exit reasons breakdown (from `botEntries`, `botExits`)
8. **AI Suggestions** — AI validation results if available (from `fetchAIValidations`)
9. **Configuration** — bot config display (from `botConfig(botId)`)
10. **Lifecycle Timeline** — visual timeline showing: created → first backtest → paper started → went live
    - Data from strategy.created_at + audit events

**Back button** → `setSelectedStrategyId(null)` → returns to card grid

---

## TASK 3: Strategy Actions

### "New Strategy" button
- Opens Builder page (`router.push('/builder')`)

### "Import .py" button
- Modal with file upload
- Select which bot to import to (dropdown of registered bots)
- Calls `importStrategy(botId, file)`
- Creates strategy record with lifecycle=DRAFT

### "Edit in Builder" (DRAFT/BACKTEST status)
- `router.push('/builder?strategyId=' + strategy.id)`
- Builder page should load existing strategy data (this is Agent 3's responsibility)

### "Run Backtest" / "Re-run Backtest"
- `router.push('/backtesting?strategyId=' + strategy.id)`
- Pre-selects the strategy in backtesting page

### "Start Paper" (promote BACKTEST → PAPER)
- Calls `updateStrategy(id, { lifecycle: 'paper' })`
- Bot must be configured with dry_run=true
- If no bot linked, prompt to select/register one

### "Go Live" (promote PAPER → LIVE)
- Calls `updateStrategy(id, { lifecycle: 'live' })`
- **Confirmation dialog**: "This will switch to REAL trading. Are you sure?"
- Bot config changes dry_run=false

### "Retire" (any status → RETIRED)
- Calls `updateStrategy(id, { lifecycle: 'retired' })`
- Stops bot if running
- Confirmation required

### "Clone"
- Creates a copy of the strategy with lifecycle=DRAFT
- New name: "OriginalName_copy"

### "Export .py"
- Downloads the strategy .py file

### "View Bot →" (LIVE/PAPER)
- `router.push('/dashboard')` and somehow signals to select this bot
- OR: just navigates to dashboard and lets user click the bot card there

---

## API FUNCTIONS TO USE

```typescript
// Strategy CRUD
getStrategies()                    → Strategy[]
getStrategy(id)                    → Strategy
createStrategy(data)               → Strategy
updateStrategy(id, data)           → Strategy
deleteStrategy(id)                 → void
importStrategy(botId, file)        → Strategy

// Bot data (for PAPER/LIVE cards with linked bots)
botProfit(botId)                   → FTProfit  (win_rate, profit_all_coin, trade_count, etc.)
botTrades(botId)                   → { trades: FTTrade[] }
botPerformance(botId)              → FTPerformance[]
botEntries(botId)                  → FTEntry[]
botExits(botId)                    → FTExit[]
botMixTags(botId)                  → FTMixTag[]
botStats(botId)                    → FTStats
botConfig(botId)                   → FTShowConfig

// Backtest data
botBacktestHistory(botId)          → backtest run list
botBacktestResults(botId)          → FTBacktestResult

// Hyperopt data
botHyperoptList(botId)             → hyperopt run list
botHyperoptShow(botId, epochId)    → hyperopt details

// AI (optional, show if data exists)
fetchAIValidations(params)         → AIValidation[]
```

---

## FT FIELD NAMES (USE THESE EXACTLY)

| Correct (FT) | NEVER use |
|---|---|
| open_rate | ~~entry_price~~ |
| close_rate | ~~exit_price~~ |
| close_profit_abs | ~~net_pnl~~ |
| stake_amount | ~~position_size~~ |
| is_short | ~~direction~~ |
| enter_tag | ~~entry_signal~~ |
| exit_reason | ~~exit_signal~~ |
| current_profit | ~~unrealized_pnl~~ |

---

## DESIGN REFERENCE

Match the prototype `strategies.html` exactly:
- Dark theme with CSS variables (--bg-0 through --bg-3, --text-0 through --text-3)
- Card hover: border-color → accent, translateY(-2px), box-shadow
- Lifecycle badge colors: LIVE=green, PAPER=amber, BACKTEST=cyan, DRAFT=text-3, RETIRED=red-dim
- Stats row: 4 columns with label above and value below
- Action bar at bottom of card with small buttons

---

## CODE QUALITY RULES

1. `"use client"` at top
2. No `any` types — use types from `@/types`
3. No `key={index}` — use `strategy.id`, `trade.trade_id`
4. All async calls in try/catch with toast error messages
5. `mountedRef` pattern for async safety
6. Loading skeletons for cards and drill-down sections
7. Empty states: "No strategies yet. Create one in Builder or Import .py"
8. Use `fmt()`, `fmtMoney()`, `profitColor()` from `@/lib/format`
9. Strategy cards fetch profit data with `Promise.allSettled` (non-blocking)

---

## VERIFICATION

```bash
cd frontend && npx next build
```
**Must produce 0 errors.**

Test the flow:
1. Strategies page loads → card grid with all strategies
2. Filter buttons work (All/Live/Paper/Backtest/Draft/Retired)
3. Cards show correct stats for each lifecycle
4. Click a card → drill-down view with all sections
5. "← All Strategies" → back to grid
6. Lifecycle actions work (Run Backtest, Start Paper, Go Live, Retire)
7. Import .py modal works
8. "New Strategy" navigates to Builder
