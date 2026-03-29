# Agent 1 — Dashboard: Multi-Bot Monitoring + Bot Management

## MANDATORY READ ORDER
1. `CLAUDE.md` — rules, philosophy, anti-hallucination protocol
2. `FT-UI-MAP.html` — feature-to-page blueprint
3. `FREQTRADE_REFERENCE.md` — §8 (REST API), §16 (Trade fields)
4. `prototypes/dashboard.html` — visual reference
5. `frontend/src/app/dashboard/page.tsx` — CURRENT CODE (already rewritten with two-view architecture)
6. `frontend/src/components/bots/BotManagementTable.tsx` — EXISTS, check what's there
7. `frontend/src/components/bots/BotRegisterModal.tsx` — EXISTS, check what's there
8. `frontend/src/components/bots/BotEditModal.tsx` — EXISTS, check what's there
9. `frontend/src/components/bots/BotDeleteDialog.tsx` — EXISTS, check what's there

---

## CONTEXT

Dashboard page.tsx was already rewritten (~1650 lines) with a two-view architecture:
- **All Bots View** (default, `selectedBotId === null`): portfolio stats, bot cards grid, all-bots positions table, daily P&L, equity curve, alerts, system health
- **Single Bot View** (click bot card): back button, bot header, controls, single-bot trades, weekly/monthly, performance, entry/exit analysis, config, sysinfo, logs

Bot management components exist in `/components/bots/` but may not be wired into the dashboard properly.

**Your job: audit what's there, fix what's broken, wire everything together, and make it work end-to-end.**

---

## TASK 1: Audit & Fix Dashboard Two-View Architecture

The dashboard already has the two-view system. Verify it works:

1. **All Bots View** (default):
   - Portfolio stat cards: Total Balance, Total P&L, Open Trades, Active Bots, Win Rate
   - Bot cards grid — each card shows: bot name, status dot (green/amber/red), strategy name, profit, trades, win rate
   - Bot cards are CLICKABLE → sets `selectedBotId`
   - All-bots open positions table with "Bot" column
   - Daily P&L bar chart (aggregated)
   - Equity curve (aggregated)
   - Alerts feed (from risk events)
   - System health grid

2. **Single Bot View** (after clicking a bot card):
   - "← All Bots" back button → sets `selectedBotId = null`
   - Bot header: name, status badge, strategy name
   - Control toolbar: Start, Stop, Pause, Stop Buy, Force Enter, Force Exit, Reload Config
   - Open positions table (no Bot column)
   - Weekly P&L chart
   - Monthly P&L chart
   - Per-pair performance table
   - Trade stats (avg duration, best/worst trade, etc.)
   - Entry/Exit analysis tables
   - Mix tags table
   - Bot config display
   - System info
   - Logs viewer
   - Whitelist display
   - Locks display
   - Closed trades table

**Fix any TypeScript errors, missing imports, or broken API calls.**

---

## TASK 2: Wire Bot Management Components

The 4 bot management components exist in `/components/bots/`. They need to be:

1. **Accessible from Dashboard** — add a "Manage Bots" button or section that shows BotManagementTable
2. **BotRegisterModal** — modal form to register a new bot:
   - Fields: name (required), description, api_url (required), api_port (required), api_username (required), api_password (required), strategy_name, dry_run (toggle)
   - Calls `registerBot()` from api.ts
   - On success: toast + refresh bot list

3. **BotEditModal** — modal form to edit existing bot:
   - Pre-fill with current bot values
   - Editable: name, description, strategy_name, dry_run
   - NOT editable: api_url, api_port, credentials (show as read-only)
   - Calls `updateBot(id, data)` from api.ts

4. **BotDeleteDialog** — confirmation dialog:
   - Show bot name, warn about data loss
   - Require typing bot name to confirm (safety)
   - Calls `deleteBot(id)` from api.ts

5. **BotManagementTable** — table showing all bots with:
   - Columns: Status (dot), Name, Strategy, Mode (Dry/Live), P&L, Trades, Actions
   - Actions per row: Start, Stop, Pause, Edit, Delete
   - "Register New Bot" button that opens BotRegisterModal

**Check if these components already work. If they have issues, fix them. Wire them into the dashboard.**

---

## API FUNCTIONS AVAILABLE

### Portfolio (All Bots — used in All Bots View)
```typescript
portfolioBalance()     → { bots: Record<string, FTBalance>, total_value, bot_count }
portfolioProfit()      → { bots: Record<string, FTProfit>, combined: { profit_all_coin, profit_all_fiat, profit_closed_coin, profit_closed_fiat, trade_count, closed_trade_count }, bot_count }
portfolioTrades()      → { trades: FTTrade[], trade_count, bot_count }
portfolioDaily()       → { bots: Record<string, FTDailyItem[]>, bot_count }
```

### Per-Bot (used in Single Bot View)
```typescript
botStatus(id)          → { ...FTStatus }
botTrades(id)          → { trades: FTTrade[], trades_count, total_trades }
botProfit(id)          → FTProfit
botDaily(id)           → { data: FTDailyItem[] }
botWeekly(id)          → FTWeeklyResponse
botMonthly(id)         → FTMonthlyResponse
botPerformance(id)     → FTPerformance[]
botEntries(id)         → FTEntry[]
botExits(id)           → FTExit[]
botMixTags(id)         → FTMixTag[]
botStats(id)           → FTStats
botConfig(id)          → FTShowConfig
botSysinfo(id)         → { cpu_pct, ram_pct }
botLogs(id, limit)     → FTLogsResponse
botWhitelist(id)       → FTWhitelist
botLocks(id)           → { locks: FTLock[] }
```

### Bot Control
```typescript
startBot(id)           → POST /bots/{id}/start
stopBot(id)            → POST /bots/{id}/stop
botPause(id)           → POST /bots/{id}/pause
botStopBuy(id)         → POST /bots/{id}/stopbuy
botForceEnter(id, data) → POST /bots/{id}/forcebuy
botForceExit(id, data)  → POST /bots/{id}/forcesell
reloadBotConfig(id)    → POST /bots/{id}/reload_config
```

### Bot CRUD
```typescript
getBots()              → Bot[]
registerBot(data)      → Bot
updateBot(id, data)    → Bot
deleteBot(id)          → void
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

## CODE QUALITY RULES

1. `"use client"` at top of every component with hooks
2. No `any` types — use proper types from `@/types`
3. No `key={index}` — use meaningful keys (trade_id, bot.id, etc.)
4. All async calls wrapped in try/catch with toast error messages
5. `mountedRef` pattern for preventing setState after unmount
6. Loading skeletons for every data section
7. Empty states with helpful messages ("No bots registered yet")
8. Use `fmt()`, `fmtMoney()`, `profitColor()` from `@/lib/format`
9. Use `REFRESH_INTERVALS` from `@/lib/constants` for polling intervals

---

## VERIFICATION

After all changes:
```bash
cd frontend && npx next build
```
**Must produce 0 errors.**

Test the flow:
1. Dashboard loads → shows All Bots View with portfolio stats
2. Click a bot card → shows Single Bot View with back button
3. Click "← All Bots" → back to All Bots View
4. Bot management table accessible with Start/Stop/Edit/Delete actions
5. Register new bot modal works
6. Edit bot modal pre-fills correctly
7. Delete bot requires name confirmation
