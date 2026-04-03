# Rate Limit Budgeting

Allocate your rate limit budget across bot components to avoid throttling. WebSocket streams are free; REST and range_request cost tokens.

## Rate Limit Tiers

| Tier     | Weight/Min | Typical Use Case |
|----------|------------|------------------|
| Strict   | 1,000      | Trial / free tier |
| Standard | 10,000     | Production bots |
| Premium  | 100,000    | High-frequency systems |

## What Costs Tokens

| Operation | Costs Tokens? | Notes |
|-----------|---------------|-------|
| WS subscribe/unsubscribe | No | Free — use WS for all live data |
| WS live data messages | No | Free after subscription |
| WS range_request | Yes | Historical data via WS costs tokens |
| REST API calls | Yes | Every request costs tokens |
| WS ping/pong | No | Heartbeat is free |

## Weight Formula

```
weight = ceil(data_points / 1000) * stream_multiplier * aggregation_multiplier
```

- `data_points`: Number of points returned (e.g., 5000 candles = 5 weight)
- `stream_multiplier`: Varies by stream type (candles=1, heatmaps=higher)
- `aggregation_multiplier`: 1 for single exchange, increases with multi-exchange

## TypeScript

```typescript
interface BudgetAllocation {
  component: string;
  percentage: number;
  tokensPerMin: number;
}

class RateLimitBudget {
  private totalTokensPerMin: number;
  private allocations: Map<string, BudgetAllocation> = new Map();
  private usage: Map<string, { tokens: number; resetAt: number }> = new Map();

  constructor(tier: "strict" | "standard" | "premium") {
    const limits = { strict: 1000, standard: 10000, premium: 100000 };
    this.totalTokensPerMin = limits[tier];
  }

  allocate(component: string, percentage: number) {
    const tokensPerMin = Math.floor(this.totalTokensPerMin * (percentage / 100));
    this.allocations.set(component, { component, percentage, tokensPerMin });
    this.usage.set(component, { tokens: 0, resetAt: Date.now() + 60_000 });
  }

  // Check if a request is within budget before making it
  canSpend(component: string, weight: number): boolean {
    const alloc = this.allocations.get(component);
    const usage = this.usage.get(component);
    if (!alloc || !usage) return false;

    // Reset if window expired
    if (Date.now() >= usage.resetAt) {
      usage.tokens = 0;
      usage.resetAt = Date.now() + 60_000;
    }

    return (usage.tokens + weight) <= alloc.tokensPerMin;
  }

  spend(component: string, weight: number): boolean {
    if (!this.canSpend(component, weight)) return false;
    const usage = this.usage.get(component)!;
    usage.tokens += weight;
    return true;
  }

  // Estimate weight for a REST request
  estimateWeight(dataPoints: number, streamMultiplier: number = 1, aggMultiplier: number = 1): number {
    return Math.ceil(dataPoints / 1000) * streamMultiplier * aggMultiplier;
  }

  remainingBudget(component: string): number {
    const alloc = this.allocations.get(component);
    const usage = this.usage.get(component);
    if (!alloc || !usage) return 0;
    if (Date.now() >= usage.resetAt) return alloc.tokensPerMin;
    return Math.max(0, alloc.tokensPerMin - usage.tokens);
  }

  // Graceful degradation: reduce fetch frequency when budget is low
  getRecommendedInterval(component: string, baseIntervalMs: number): number {
    const remaining = this.remainingBudget(component);
    const alloc = this.allocations.get(component);
    if (!alloc) return baseIntervalMs;

    const usagePct = 1 - (remaining / alloc.tokensPerMin);
    if (usagePct > 0.9) return baseIntervalMs * 4;  // 90%+ used: slow down 4x
    if (usagePct > 0.7) return baseIntervalMs * 2;  // 70%+ used: slow down 2x
    return baseIntervalMs;
  }
}

// --- Example: Trading bot budget allocation ---
const budget = new RateLimitBudget("standard"); // 10K tokens/min

// WS streams are free — no budget needed for live data
// Budget only matters for REST and range_request
budget.allocate("bootstrap", 40);     // 4,000 tokens/min — initial state loading
budget.allocate("backfill", 30);      // 3,000 tokens/min — historical data
budget.allocate("ad_hoc", 20);        // 2,000 tokens/min — on-demand queries
budget.allocate("monitoring", 10);    // 1,000 tokens/min — /usage checks

// Before making a REST call
const weight = budget.estimateWeight(5000); // 5000 candle points
if (budget.canSpend("backfill", weight)) {
  budget.spend("backfill", weight);
  // Make the REST call
} else {
  const interval = budget.getRecommendedInterval("backfill", 5000);
  console.log(`Budget low — retry in ${interval}ms`);
}
```

## Python

```python
import time
import math

class RateLimitBudget:
    TIER_LIMITS = {"strict": 1000, "standard": 10000, "premium": 100000}

    def __init__(self, tier: str):
        self.total = self.TIER_LIMITS[tier]
        self.allocations: dict[str, dict] = {}
        self.usage: dict[str, dict] = {}

    def allocate(self, component: str, percentage: float):
        tokens = int(self.total * percentage / 100)
        self.allocations[component] = {"tokens_per_min": tokens, "pct": percentage}
        self.usage[component] = {"tokens": 0, "reset_at": time.time() + 60}

    def can_spend(self, component: str, weight: int) -> bool:
        alloc = self.allocations.get(component)
        usage = self.usage.get(component)
        if not alloc or not usage:
            return False
        if time.time() >= usage["reset_at"]:
            usage["tokens"] = 0
            usage["reset_at"] = time.time() + 60
        return (usage["tokens"] + weight) <= alloc["tokens_per_min"]

    def spend(self, component: str, weight: int) -> bool:
        if not self.can_spend(component, weight):
            return False
        self.usage[component]["tokens"] += weight
        return True

    @staticmethod
    def estimate_weight(data_points: int, stream_mult: float = 1,
                        agg_mult: float = 1) -> int:
        return math.ceil(data_points / 1000) * int(stream_mult) * int(agg_mult)

    def remaining(self, component: str) -> int:
        alloc = self.allocations.get(component)
        usage = self.usage.get(component)
        if not alloc or not usage:
            return 0
        if time.time() >= usage["reset_at"]:
            return alloc["tokens_per_min"]
        return max(0, alloc["tokens_per_min"] - usage["tokens"])

# Usage
budget = RateLimitBudget("standard")
budget.allocate("bootstrap", 40)
budget.allocate("backfill", 30)
budget.allocate("ad_hoc", 20)
budget.allocate("monitoring", 10)

weight = RateLimitBudget.estimate_weight(5000)
if budget.can_spend("backfill", weight):
    budget.spend("backfill", weight)
    print("Making REST call...")
else:
    print(f"Budget low. Remaining: {budget.remaining('backfill')} tokens")
```

## Monitoring Usage

Check your usage via the `/usage` endpoint:

```typescript
async function checkUsage(apiKey: string) {
  const res = await fetch("https://eu-central-1.mmt.gg/api/v1/usage", {
    headers: { "X-API-Key": apiKey },
  });
  const usage = await res.json();
  console.log("Rate limit usage:", usage);
}
```

## Budget Allocation Strategy

| Component | % of Budget | Rationale |
|-----------|-------------|-----------|
| Bootstrap (range_request) | 40% | One-time cost on startup, heavy but brief |
| Historical backfill | 30% | Ongoing but can be throttled |
| Ad-hoc queries | 20% | User-triggered or signal-triggered |
| Monitoring (/usage) | 10% | Low frequency health checks |

## Rules

- WebSocket subscriptions and live data are free — always prefer WS over REST for live data.
- Only REST calls and `range_request` consume rate limit tokens.
- Pre-check budget with `canSpend()` before every REST call to avoid 429 errors.
- Implement graceful degradation: reduce fetch frequency when budget runs low.
- Allocate most budget to startup/bootstrap, then taper to maintenance levels.
- Monitor usage via `/api/v1/usage` at regular intervals (but budget the monitoring itself).
- Multi-exchange aggregation increases weight — budget accordingly when using colon-separated exchange queries.
- Cache REST responses where possible to avoid redundant token spending.
