# Real-Time Heatmap Analysis

Use the `heatmap_sd` and `heatmap_hd` channels to detect liquidity walls, support/resistance zones, and orderbook imbalances over time.

## Heatmap Data Fields

```typescript
interface HeatmapPublic {
  t: number;     // timestamp
  pg: number;    // price group (bucket size)
  p: number[];   // price levels
  s: number[];   // sizes at each price level
  si: number;    // split index — separates bids from asks
  lp: number;    // last traded price
  minp: number;  // min price in range
  maxp: number;  // max price in range
  mins: number;  // min size value
  maxs: number;  // max size value
}
```

## Split Index

The `si` (split index) divides the `p` and `s` arrays into bids and asks:
- Indices `0` to `si - 1` = **bids** (buy orders below last price)
- Indices `si` to `length - 1` = **asks** (sell orders above last price)

## SD vs HD

| Property | heatmap_sd (Standard Def) | heatmap_hd (High Def) |
|----------|---------------------------|-----------------------|
| Resolution | Lower granularity | Higher granularity |
| History | Longer lookback | Shorter lookback |
| Use case | Macro S/R zones | Precise level detection |
| Data volume | Smaller payloads | Larger payloads |

## TypeScript

```typescript
import WebSocket from "ws";

interface LiquidityWall {
  price: number;
  size: number;
  side: "bid" | "ask";
  strength: number; // relative to max size
}

interface SupportResistance {
  level: number;
  type: "support" | "resistance";
  strength: number;
  persistence: number; // how many snapshots it appeared in
}

class HeatmapAnalyzer {
  private history: { timestamp: number; walls: LiquidityWall[] }[] = [];
  private maxHistory = 60; // keep last 60 snapshots

  analyze(data: any): {
    walls: LiquidityWall[];
    bidDepth: number;
    askDepth: number;
    imbalance: number;
  } {
    const { p, s, si, lp, maxs } = data;
    const walls: LiquidityWall[] = [];
    let bidDepth = 0;
    let askDepth = 0;

    // Threshold: consider a wall if size > 50% of max size
    const wallThreshold = maxs * 0.5;

    for (let i = 0; i < p.length; i++) {
      const side = i < si ? "bid" : "ask";
      const size = s[i];

      if (side === "bid") bidDepth += size;
      else askDepth += size;

      if (size >= wallThreshold) {
        walls.push({
          price: p[i],
          size,
          side,
          strength: size / maxs,
        });
      }
    }

    // Imbalance: positive = more bids (bullish), negative = more asks (bearish)
    const totalDepth = bidDepth + askDepth;
    const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;

    this.history.push({ timestamp: data.t, walls });
    if (this.history.length > this.maxHistory) this.history.shift();

    return { walls, bidDepth, askDepth, imbalance };
  }

  // Find persistent liquidity walls (appear in multiple snapshots)
  findPersistentWalls(minOccurrences: number = 5): SupportResistance[] {
    const priceCount: Map<number, { count: number; totalSize: number; side: string }> = new Map();

    for (const snapshot of this.history) {
      for (const wall of snapshot.walls) {
        const key = wall.price;
        const existing = priceCount.get(key) || { count: 0, totalSize: 0, side: wall.side };
        existing.count++;
        existing.totalSize += wall.size;
        priceCount.set(key, existing);
      }
    }

    const levels: SupportResistance[] = [];
    for (const [price, data] of priceCount) {
      if (data.count >= minOccurrences) {
        levels.push({
          level: price,
          type: data.side === "bid" ? "support" : "resistance",
          strength: data.totalSize / data.count,
          persistence: data.count,
        });
      }
    }

    return levels.sort((a, b) => b.persistence - a.persistence);
  }

  // Detect wall spoofing (walls that appear and disappear quickly)
  detectSpoofing(recentN: number = 10): LiquidityWall[] {
    if (this.history.length < recentN * 2) return [];

    const recent = this.history.slice(-recentN);
    const previous = this.history.slice(-recentN * 2, -recentN);

    const recentPrices = new Set(recent.flatMap((s) => s.walls.map((w) => w.price)));
    const previousPrices = new Set(previous.flatMap((s) => s.walls.map((w) => w.price)));

    // Walls that existed before but vanished recently
    const spoofed: LiquidityWall[] = [];
    for (const snap of previous) {
      for (const wall of snap.walls) {
        if (previousPrices.has(wall.price) && !recentPrices.has(wall.price)) {
          spoofed.push(wall);
        }
      }
    }
    return spoofed;
  }
}

// --- Usage ---
const ws = new WebSocket("wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY");
const analyzer = new HeatmapAnalyzer();

ws.on("open", () => {
  ws.send(JSON.stringify({
    type: "subscribe", channel: "heatmap_sd",
    exchange: "binancef", symbol: "btc/usdt", tf: "1m",
  }));
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.channel !== "heatmap_sd") return;

  const result = analyzer.analyze(msg.data);
  console.log(`Imbalance: ${(result.imbalance * 100).toFixed(1)}% | Walls: ${result.walls.length}`);

  for (const wall of result.walls) {
    console.log(`  ${wall.side.toUpperCase()} wall @ ${wall.price} (strength: ${(wall.strength * 100).toFixed(0)}%)`);
  }

  const persistent = analyzer.findPersistentWalls();
  if (persistent.length > 0) {
    console.log("Persistent S/R levels:", persistent.slice(0, 3).map((l) =>
      `${l.type} @ ${l.level} (${l.persistence} occurrences)`
    ));
  }
});
```

## Python

```python
import asyncio
import json
from collections import deque, defaultdict
from dataclasses import dataclass
import websockets

@dataclass
class LiquidityWall:
    price: float
    size: float
    side: str  # "bid" or "ask"
    strength: float

class HeatmapAnalyzer:
    def __init__(self, max_history: int = 60):
        self.history: deque = deque(maxlen=max_history)

    def analyze(self, data: dict) -> dict:
        p, s, si = data["p"], data["s"], data["si"]
        maxs = data["maxs"]
        walls = []
        bid_depth = 0.0
        ask_depth = 0.0
        wall_threshold = maxs * 0.5

        for i in range(len(p)):
            side = "bid" if i < si else "ask"
            size = s[i]
            if side == "bid":
                bid_depth += size
            else:
                ask_depth += size

            if size >= wall_threshold:
                walls.append(LiquidityWall(
                    price=p[i], size=size, side=side,
                    strength=size / maxs if maxs > 0 else 0,
                ))

        total = bid_depth + ask_depth
        imbalance = (bid_depth - ask_depth) / total if total > 0 else 0

        self.history.append({"timestamp": data["t"], "walls": walls})
        return {"walls": walls, "bid_depth": bid_depth, "ask_depth": ask_depth, "imbalance": imbalance}

    def find_persistent_walls(self, min_occurrences: int = 5) -> list[dict]:
        price_count: dict[float, dict] = defaultdict(lambda: {"count": 0, "total_size": 0, "side": ""})

        for snapshot in self.history:
            for wall in snapshot["walls"]:
                entry = price_count[wall.price]
                entry["count"] += 1
                entry["total_size"] += wall.size
                entry["side"] = wall.side

        levels = []
        for price, info in price_count.items():
            if info["count"] >= min_occurrences:
                levels.append({
                    "level": price,
                    "type": "support" if info["side"] == "bid" else "resistance",
                    "strength": info["total_size"] / info["count"],
                    "persistence": info["count"],
                })
        return sorted(levels, key=lambda x: x["persistence"], reverse=True)

async def main():
    analyzer = HeatmapAnalyzer()
    uri = "wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY"

    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({
            "type": "subscribe", "channel": "heatmap_sd",
            "exchange": "binancef", "symbol": "btc/usdt", "tf": "1m",
        }))

        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("channel") != "heatmap_sd":
                continue
            result = analyzer.analyze(msg["data"])
            print(f"Imbalance: {result['imbalance'] * 100:.1f}%")
            for wall in result["walls"]:
                print(f"  {wall.side.upper()} @ {wall.price} (strength: {wall.strength * 100:.0f}%)")

asyncio.run(main())
```

## Rules

- Use `si` (split index) to correctly separate bids from asks — indices below `si` are bids, at or above are asks.
- Detect liquidity walls by comparing individual `s` values against `maxs` — values above 50% of `maxs` are significant.
- Track walls across multiple snapshots to find persistent support/resistance vs ephemeral spoofing.
- Use `heatmap_sd` for broader market structure and `heatmap_hd` for precise entry/exit levels.
- Calculate bid/ask imbalance from depth sums to gauge directional sentiment.
- Anchor all analysis to `lp` (last price) — walls far from last price are less immediately relevant.
- Heatmaps support multi-exchange aggregation with colon-separated exchange IDs.
