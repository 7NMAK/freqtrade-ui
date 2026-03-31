# PROMPT: Whitelist Matrix Tab — Implementation Spec

## Goal

Build a **Whitelist Matrix** tab inside the Dashboard trade table area (alongside Open Trades and Closed Trades). This tab shows a unified, real-time overview of ALL trading pairs across ALL bots — their status, which bots are assigned to them, open positions, and lock controls.

## What It Answers

> "Which pairs am I monitoring? Can my bots enter new trades on them? Are any pairs locked or cooling down?"

---

## Data Sources

All API endpoints already exist in `frontend/src/lib/api.ts`:

| Endpoint | Function | Returns |
|---|---|---|
| `GET /api/v1/whitelist` | `botWhitelist(botId)` | `{ whitelist: string[], length, method[] }` |
| `GET /api/v1/locks` | `botLocks(botId)` | `{ lock_count, locks: FTLock[] }` |
| `GET /api/v1/status` | `botStatus(botId)` | `FTTrade[]` (open trades) |
| `GET /api/v1/show_config` | `botConfig(botId)` | `FTShowConfig` (NB: route is `/config`) |
| `POST /api/v1/locks` | `botLockAdd(botId, { pair, until, reason })` | Creates a pair lock |
| `DELETE /api/v1/locks/{id}` | `botDeleteLock(botId, lockId)` | Removes a pair lock |

## Types (Already in `types/index.ts`)

```typescript
interface FTWhitelist {
  whitelist: string[];
  length: number;
  method: string[];
}

interface FTLock {
  id: number;
  active: boolean;
  strategy: string;
  lock_end_time: string;
  lock_end_timestamp: number;
  pair: string;
  reason: string;
  side: string;
}

interface FTLocksResponse {
  lock_count: number;
  locks: FTLock[];
}
```

## New Data Model to Build

```typescript
interface WhitelistMatrixRow {
  pair: string;                       // "BTC/USDT"
  status: "active" | "locked" | "cooldown";
  assignedBots: Array<{
    botId: number;
    botName: string;
    isLocked: boolean;
    lockReason?: string;
    lockEndTime?: string;
    lockId?: number;
  }>;
  openPositionCount: number;          // Open trades on this pair (all bots)
  lockTimeRemaining?: string;         // "14m left" or null
  latestLockEndTimestamp?: number;     // For countdown timer
}
```

## Aggregation Logic

```
Input: Array of running bots (from orchestrator)

For EACH running bot:
  1. Fetch whitelist → get pair list
  2. Fetch locks → get active locks
  3. Fetch open trades → count per pair

MERGE into unified pair map:
  - Key: pair name (e.g. "BTC/USDT")
  - Value: WhitelistMatrixRow

For each pair:
  - assignedBots = all bots that have this pair in whitelist
  - openPositionCount = SUM of open trades on this pair across all bots
  - status logic:
    if ANY bot has active lock with reason containing "Cooldown":
      status = "cooldown"
    else if ANY bot has active lock:
      status = "locked"
    else:
      status = "active"
  - lockTimeRemaining = formatDistance(latestLockEndTimestamp - now)

Sort: locked/cooldown pairs first, then alphabetical
```

## UI Table Columns

| Column | Data | Align | Style |
|---|---|---|---|
| **Pair** | `row.pair` | Left | `font-bold text-white` |
| **Status** | `row.status` | Center | Badge: ACTIVE=green, LOCKED=red, COOLDOWN=yellow |
| **Assigned Bots** | `row.assignedBots[].botName` | Left | Comma join, `text-muted text-[11px]` |
| **Open Positions** | `row.openPositionCount` | Center | Bold number |
| **Lock Timer** | `row.lockTimeRemaining` | Center | `text-down text-[10px]` or "—" |
| **Controls** | LOCK/UNLOCK button | Center | See Actions below |

> Optional columns for later: Price, 24h Change, Spread, Volume, Volatility
> (These need exchange ticker data which we may not have yet)

## Status Badge Styling

```
ACTIVE   → bg-up/12 text-up border-up/25
LOCKED   → bg-down/12 text-down border-down/25
COOLDOWN → bg-yellow-500/12 text-yellow-400 border-yellow-500/25
```

## Lock Timer Formatting

```typescript
function formatLockTimer(endTimestamp: number): string {
  const remaining = endTimestamp - Date.now();
  if (remaining <= 0) return "—";
  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return `${Math.floor(remaining / 1000)}s left`;
}
```

## Actions

### LOCK Button
- Visible when pair is ACTIVE
- Style: `bg-black border hover:bg-down/20 text-muted hover:text-down`
- On click → show modal with:
  - **Bot selector**: dropdown of bots that have this pair (or "All Bots")
  - **Duration**: 5m / 15m / 1h / 4h / 24h / Custom input
  - **Reason**: optional text input
  - **Confirm** button
- API: `POST /api/bots/{botId}/locks` with `{ pair, until: ISO_string, reason }`
  - Function: `botLockAdd(botId, { pair, until, reason })`

### UNLOCK Button
- Visible when pair is LOCKED or COOLDOWN
- Style: `bg-black border hover:bg-up/20 text-muted hover:text-up`
- On click → immediately call `DELETE /api/bots/{botId}/locks/{lockId}`
- If multiple bots have locks on same pair → unlock all of them
- Refresh matrix after action

## Refresh Behavior

- Auto-refresh every 10 seconds (same as dashboard cycle)
- Show loading skeleton on first load
- Optimistic UI: immediately update status on lock/unlock, revert on error

## Placement

- Third tab in dashboard trade table (after "Open Trades" and "Closed Trades")
- Tab label: `Whitelist Matrix`
- Same table styling as Open/Closed Trades (mono font, alternating rows, sticky header)

## Relationship to Risk Page

The Risk page (`/risk`) already has full lock management. The Whitelist Matrix is a **quick-access summary** — not a replacement. Users who need advanced lock features (bulk operations, protection rules) go to Risk page.

---

## Reference: Existing Implementation in Risk Page

Check `frontend/src/app/risk/page.tsx` lines 166-228 for how locks are currently loaded and aggregated across bots. The same pattern should be reused for the Whitelist Matrix.
