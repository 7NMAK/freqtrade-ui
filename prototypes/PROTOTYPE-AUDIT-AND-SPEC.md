# FreqTrade Prototype Audit & Whitelist Matrix Spec

## Part 1: Prototype vs Production Code — Coverage Audit

### What the Prototype Shows

| Prototype Section | Status | Production Equivalent |
|---|---|---|
| **KPI Bar** (7 metrics) | ⚠️ Partial | `dashboard/page.tsx` shows more: profit, balance, performance, stats |
| **Bot Fleet** (2 bots + controls) | ⚠️ Partial | `dashboard/page.tsx` + `BotDetailPanel.tsx` — has full bot grid w/ health |
| **P&L Chart** (bars + line) | ⚠️ Partial | Production uses daily/weekly/monthly endpoints — richer data |
| **Profit Distribution** (histogram) | 🆕 New | Not in production — new addition from prototype |
| **Open Trades Table** | ✅ Good | `dashboard/page.tsx` — matches `/api/v1/status` |
| **Closed Trades Table** | ✅ Good | `dashboard/page.tsx` — matches `/api/v1/trades` |
| **Whitelist Matrix** | 🆕 New | Prototype-only, data exists in API but no dedicated view |
| **Trade Actions Dropdown** | ✅ Good | Matches FreqTrade RPC: forceexit, reload, delete trade |
| **Bot Controls** (6 buttons) | ✅ Good | Matches: start/stop/pause/reload/forceexit-all/stopbuy |
| **System Telemetry** (CPU/RAM) | ⚠️ Partial | Production has `sysinfo` endpoint — prototype only shows 2 bars |
| **Terminal Logs** | ✅ Good | `dashboard/page.tsx` streams `/api/v1/logs` |
| **Bot Drawer** (config/stats/log) | ⚠️ Partial | `BotDetailPanel.tsx` has 700+ lines — much richer than prototype |
| **Backtest Tab** | ✅ Good | `backtesting/page.tsx` + `experiments/page.tsx` |
| **Hyperopt Tab** | ✅ Good | `experiments/page.tsx` tab |
| **FreqAI Tab** | ❌ Placeholder | `freqai/page.tsx` exists but both are minimal |
| **AI Review Tab** | ❌ Placeholder | `ai-insights/page.tsx` exists in code |
| **Validation Tab** | ❌ Placeholder | No production equivalent |
| **Global Search** | ❌ Visual only | Not implemented in production either |

---

### What Exists in Production but NOT in Prototype

| Feature | Page | API Used |
|---|---|---|
| **Strategy Builder** | `builder/page.tsx` | Custom orchestrator endpoints |
| **Strategy Lifecycle Grid** | `strategies/page.tsx` | `GET /api/v1/strategy/{name}`, orchestrator DB |
| **Risk Management** | `risk/page.tsx` | `botLocks()`, `botWhitelist()`, protections |
| **Data Management** | `data/page.tsx` | Pair candle download, pairlist testing |
| **Analytics Dashboard** | `analytics/page.tsx` | Performance, entries, exits, mix_tags |
| **AI Insights** | `ai-insights/page.tsx` | OpenAI strategy review |
| **Settings / Config** | `settings/page.tsx` | System settings |
| **Login / Auth** | `login/page.tsx` | Auth flow |
| **Docs Viewer** | `docs/page.tsx` | Documentation |
| **Balance Breakdown** | Inside dashboard | `GET /api/v1/balance` |
| **Performance by Pair** | Inside dashboard | `GET /api/v1/performance` |
| **Entry/Exit Tag Analysis** | Inside dashboard | `GET /api/v1/entries`, `/exits`, `/mix_tags` |
| **Pair Candle Charts** | Inside dashboard | `GET /api/v1/pair_candles` |

---

## Part 2: Whitelist Matrix — Feature Specification

### Overview

The **Whitelist Matrix** is a unified dashboard view that combines data from multiple FreqTrade API endpoints to provide a real-time overview of all trading pairs across all bots. It answers the question: *"What am I watching, what can I trade, and what's blocked?"*

### Data Sources (Already Available)

```
┌─────────────────────────────────────────────────┐
│ API Endpoints (per bot)                         │
├─────────────────────────────────────────────────┤
│ GET /api/v1/whitelist    → pair list + method   │
│ GET /api/v1/locks        → locked pairs + timer │
│ GET /api/v1/status       → open trades count    │
│ GET /api/v1/show_config  → pair_whitelist array │
│ GET /api/v1/performance  → profit by pair       │
│ DELETE /api/v1/locks/{id}→ unlock a pair        │
│ POST /api/v1/locks       → lock a pair          │
└─────────────────────────────────────────────────┘
```

### TypeScript Types (Already Exist)

```typescript
// types/index.ts
interface FTWhitelist {
  whitelist: string[];    // Active pair list
  length: number;         // Count
  method: string[];       // e.g. ["StaticPairList", "VolumePairList"]
}

interface FTLock {
  id: number;
  active: boolean;
  strategy: string;
  lock_end_time: string;      // ISO timestamp
  lock_end_timestamp: number; // Unix ms
  pair: string;
  reason: string;             // "Stoploss Guard", "LowProfitPairs", etc.
  side: string;               // "long", "short", "*"
}

interface FTLocksResponse {
  lock_count: number;
  locks: FTLock[];
}
```

### API Functions (Already Exist)

```typescript
// lib/api.ts
botWhitelist(id: number)                        → Promise<FTWhitelist>
botLocks(id: number)                            → Promise<FTLocksResponse>
botDeleteLock(id, lockId)                       → Promise<void>
botAddLock(id, pair, until, reason)             → Promise<FTLock>
```

### Matrix Data Model (Needs to be Built)

For the Whitelist Matrix, we need to aggregate data from ALL bots into a unified pair-centric view:

```typescript
interface WhitelistMatrixRow {
  pair: string;                    // e.g. "BTC/USDT"
  status: "active" | "locked" | "cooldown";
  assignedBots: Array<{
    botId: number;
    botName: string;
    isLocked: boolean;
    lockReason?: string;
    lockEndTime?: string;
    lockId?: number;
  }>;
  openPositionCount: number;       // Count of open trades across all bots
  lockTimeRemaining?: string;      // Human readable "14m left"
}
```

### Aggregation Logic

```
For each pair across ALL bots:
1. Collect all bots that have this pair in their whitelist
2. Check locks: if ANY bot has an active lock → show status
3. Count open positions: sum open trades on this pair across all bots
4. Calculate lock timer: time remaining on the latest lock
5. Merge into a single row per pair
```

### UI Specification

#### Table Columns

| # | Column | Source | Align | Notes |
|---|---|---|---|---|
| 1 | **Pair** | `whitelist[]` | Left | Bold white, e.g. `BTC/USDT` |
| 2 | **Status** | Derived from locks | Center | Badge: `ACTIVE` green / `LOCKED` red / `COOLDOWN` yellow |
| 3 | **Assigned Bots** | Bot whitelist cross-ref | Left | Comma-separated bot names, 11px muted |
| 4 | **Price** | (Optional) exchange data | Right | Current price, mono font |
| 5 | **24h Change** | (Optional) exchange data | Right | `+2.14%` green / `-0.82%` red |
| 6 | **Spread** | (Optional) exchange data | Right | Bid-ask spread % |
| 7 | **24h Volume** | (Optional) exchange data | Right | `$1.2B` formatted |
| 8 | **Volatility** | (Optional) calculated | Right | `Low`/`Med`/`High` w/ colors |
| 9 | **Open Positions** | `/api/v1/status` count | Center | Bold number |
| 10 | **Lock Timer** | `lock_end_time` | Center | `14m left` or `—` |
| 11 | **Controls** | `POST/DELETE /locks` | Center | `LOCK` / `UNLOCK` button |

> **Note:** Columns 4-8 (Price, Change, Spread, Volume, Volatility) require exchange ticker API integration. They are optional enhancements. The core matrix (columns 1-3, 9-11) works with existing API data only.

#### Status Badge Logic

```
if (pair has active lock on ANY bot):
  if (lock.reason contains "Cooldown" or "CooldownPeriod"):
    status = "COOLDOWN" (yellow badge)
  else:
    status = "LOCKED" (red badge)
else:
  status = "ACTIVE" (green badge)
```

#### Lock Timer Display

```
remainingMs = lock_end_timestamp - Date.now()
if remainingMs <= 0: show "—"
if remainingMs < 60_000: show "Xs left"
if remainingMs < 3_600_000: show "Xm left"
else: show "Xh Xm left"
```

#### Actions

| Button | API Call | Visual |
|---|---|---|
| **LOCK** | `POST /api/bots/{botId}/locks` | Dark bg, red hover |
| **UNLOCK** | `DELETE /api/bots/{botId}/locks/{lockId}` | Dark bg, green hover |

When clicking LOCK, show a small modal:
- Which bot(s) to lock for (dropdown or "all")
- Duration (5m, 15m, 1h, 4h, 24h, Custom)
- Reason (free text, optional)

### Integration Points

The Whitelist Matrix should:
1. Live in the **Dashboard** page as a third tab alongside Open Trades / Closed Trades
2. Auto-refresh every 10 seconds (same interval as other dashboard data)
3. Show a loading skeleton while data aggregates
4. Optionally be accessible standalone under a `/whitelist` route

### Risk Page Relationship

The `risk/page.tsx` already has a "Pair Locks" table and "Lock Pair" form.
The Whitelist Matrix is NOT a replacement — it's a **complementary quick-view**:
- **Risk Page**: Full lock management, protections config, portfolio exposure analysis
- **Whitelist Matrix**: Quick glance at pair status from Dashboard, one-click lock/unlock
