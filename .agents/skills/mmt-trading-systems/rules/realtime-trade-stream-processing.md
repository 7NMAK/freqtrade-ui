# Real-Time Trade Stream Processing

Process the `trades` channel for VWAP calculation, large trade detection, trade aggregation, and activity spike detection.

## Trade Data Fields

Each trade message contains:
- `id` — Trade ID (string)
- `t` — Timestamp (unix milliseconds)
- `p` — Price
- `q` — Quantity
- `b` — Is buy (boolean)

## TypeScript

```typescript
import WebSocket from "ws";

interface Trade {
  id: string;
  timestamp: number;
  price: number;
  quantity: number;
  isBuy: boolean;
}

// --- VWAP Calculator ---
class VWAPCalculator {
  private cumPriceVol = 0;
  private cumVol = 0;
  private windowStart: number;
  private windowMs: number;
  private trades: { timestamp: number; pv: number; vol: number }[] = [];

  constructor(windowSeconds: number) {
    this.windowMs = windowSeconds * 1000;
    this.windowStart = Date.now();
  }

  addTrade(trade: Trade) {
    const pv = trade.price * trade.quantity;
    this.cumPriceVol += pv;
    this.cumVol += trade.quantity;
    this.trades.push({ timestamp: trade.timestamp * 1000, pv, vol: trade.quantity });
    this.prune();
  }

  private prune() {
    const cutoff = Date.now() - this.windowMs;
    while (this.trades.length > 0 && this.trades[0].timestamp < cutoff) {
      const old = this.trades.shift()!;
      this.cumPriceVol -= old.pv;
      this.cumVol -= old.vol;
    }
  }

  get vwap(): number {
    return this.cumVol > 0 ? this.cumPriceVol / this.cumVol : 0;
  }

  get volume(): number {
    return this.cumVol;
  }
}

// --- Large Trade Detector ---
class LargeTradeDetector {
  private recentSizes: number[] = [];
  private maxHistory = 1000;
  private threshold: number; // USD value threshold

  constructor(thresholdUsd: number) {
    this.threshold = thresholdUsd;
  }

  check(trade: Trade): { isLarge: boolean; usdValue: number; percentile: number } {
    const usdValue = trade.price * trade.quantity;
    this.recentSizes.push(usdValue);
    if (this.recentSizes.length > this.maxHistory) {
      this.recentSizes.shift();
    }

    // Calculate percentile of this trade
    const sorted = [...this.recentSizes].sort((a, b) => a - b);
    const idx = sorted.findIndex((v) => v >= usdValue);
    const percentile = (idx / sorted.length) * 100;

    return {
      isLarge: usdValue >= this.threshold,
      usdValue,
      percentile,
    };
  }
}

// --- Trade Aggregator (custom time windows) ---
class TradeAggregator {
  private bucketMs: number;
  private currentBucket: number = 0;
  private buyVol = 0;
  private sellVol = 0;
  private buyCount = 0;
  private sellCount = 0;
  private onFlush: ((bucket: AggBucket) => void) | null = null;

  constructor(bucketSeconds: number) {
    this.bucketMs = bucketSeconds * 1000;
  }

  setFlushHandler(handler: (bucket: AggBucket) => void) {
    this.onFlush = handler;
  }

  addTrade(trade: Trade) {
    const bucket = Math.floor((trade.timestamp * 1000) / this.bucketMs) * this.bucketMs;

    if (this.currentBucket !== 0 && bucket !== this.currentBucket) {
      this.flush();
    }

    this.currentBucket = bucket;
    if (trade.isBuy) {
      this.buyVol += trade.price * trade.quantity;
      this.buyCount++;
    } else {
      this.sellVol += trade.price * trade.quantity;
      this.sellCount++;
    }
  }

  private flush() {
    this.onFlush?.({
      timestamp: this.currentBucket,
      buyVolume: this.buyVol,
      sellVolume: this.sellVol,
      buyCount: this.buyCount,
      sellCount: this.sellCount,
      delta: this.buyVol - this.sellVol,
    });
    this.buyVol = 0;
    this.sellVol = 0;
    this.buyCount = 0;
    this.sellCount = 0;
  }
}

interface AggBucket {
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
  buyCount: number;
  sellCount: number;
  delta: number;
}

// --- Activity Spike Detection using Stats ---
class ActivityDetector {
  private tpsHistory: number[] = [];
  private maxHistory = 60;

  update(stats: { mxt: number; it: number }) {
    this.tpsHistory.push(stats.it); // instant TPS
    if (this.tpsHistory.length > this.maxHistory) {
      this.tpsHistory.shift();
    }
  }

  isSpike(multiplier: number = 3): boolean {
    if (this.tpsHistory.length < 10) return false;
    const avg = this.tpsHistory.slice(0, -1).reduce((a, b) => a + b, 0) / (this.tpsHistory.length - 1);
    const current = this.tpsHistory[this.tpsHistory.length - 1];
    return current > avg * multiplier;
  }
}

// --- Wire up ---
const ws = new WebSocket("wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY");
const vwap = new VWAPCalculator(300); // 5 minute VWAP
const detector = new LargeTradeDetector(100_000); // $100K threshold
const aggregator = new TradeAggregator(10); // 10 second buckets

aggregator.setFlushHandler((bucket) => {
  console.log(`[AGG] delta: $${bucket.delta.toFixed(0)} | buy: $${bucket.buyVolume.toFixed(0)} | sell: $${bucket.sellVolume.toFixed(0)}`);
});

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "subscribe", channel: "trades", exchange: "binancef", symbol: "btc/usdt" }));
  ws.send(JSON.stringify({ type: "subscribe", channel: "stats", exchange: "binancef", symbol: "btc/usdt", tf: "1s" }));
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.channel === "trades") {
    const trade: Trade = {
      id: msg.data.id, timestamp: msg.data.t,
      price: msg.data.p, quantity: msg.data.q, isBuy: msg.data.b,
    };
    vwap.addTrade(trade);
    aggregator.addTrade(trade);
    const result = detector.check(trade);
    if (result.isLarge) {
      console.log(`[WHALE] ${trade.isBuy ? "BUY" : "SELL"} $${result.usdValue.toFixed(0)} (p${result.percentile.toFixed(0)})`);
    }
  }
});
```

## Python

```python
import asyncio
import json
import time
from collections import deque
from dataclasses import dataclass
import websockets

@dataclass
class Trade:
    id: str
    timestamp: float
    price: float
    quantity: float
    is_buy: bool

class VWAPCalculator:
    def __init__(self, window_seconds: int):
        self.window_s = window_seconds
        self.trades: deque = deque()
        self.cum_pv = 0.0
        self.cum_vol = 0.0

    def add_trade(self, trade: Trade):
        pv = trade.price * trade.quantity
        self.cum_pv += pv
        self.cum_vol += trade.quantity
        self.trades.append((trade.timestamp, pv, trade.quantity))
        self._prune()

    def _prune(self):
        cutoff = time.time() - self.window_s
        while self.trades and self.trades[0][0] < cutoff:
            _, pv, vol = self.trades.popleft()
            self.cum_pv -= pv
            self.cum_vol -= vol

    @property
    def vwap(self) -> float:
        return self.cum_pv / self.cum_vol if self.cum_vol > 0 else 0

class LargeTradeDetector:
    def __init__(self, threshold_usd: float):
        self.threshold = threshold_usd
        self.recent: deque = deque(maxlen=1000)

    def check(self, trade: Trade) -> dict:
        usd_value = trade.price * trade.quantity
        self.recent.append(usd_value)
        sorted_sizes = sorted(self.recent)
        idx = next((i for i, v in enumerate(sorted_sizes) if v >= usd_value), len(sorted_sizes))
        percentile = (idx / len(sorted_sizes)) * 100
        return {"is_large": usd_value >= self.threshold, "usd_value": usd_value, "percentile": percentile}

class TradeAggregator:
    def __init__(self, bucket_seconds: int):
        self.bucket_s = bucket_seconds
        self.current_bucket = 0
        self.buy_vol = 0.0
        self.sell_vol = 0.0
        self.on_flush = None

    def add_trade(self, trade: Trade):
        bucket = int(trade.timestamp // self.bucket_s) * self.bucket_s
        if self.current_bucket != 0 and bucket != self.current_bucket:
            self._flush()
        self.current_bucket = bucket
        usd = trade.price * trade.quantity
        if trade.is_buy:
            self.buy_vol += usd
        else:
            self.sell_vol += usd

    def _flush(self):
        if self.on_flush:
            self.on_flush({
                "timestamp": self.current_bucket,
                "buy_volume": self.buy_vol,
                "sell_volume": self.sell_vol,
                "delta": self.buy_vol - self.sell_vol,
            })
        self.buy_vol = 0.0
        self.sell_vol = 0.0

async def main():
    vwap = VWAPCalculator(300)
    detector = LargeTradeDetector(100_000)
    agg = TradeAggregator(10)
    agg.on_flush = lambda b: print(f"[AGG] delta: ${b['delta']:.0f}")

    uri = "wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY"
    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"type": "subscribe", "channel": "trades",
                                  "exchange": "binancef", "symbol": "btc/usdt"}))
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("channel") != "trades":
                continue
            d = msg["data"]
            trade = Trade(d["id"], d["t"], d["p"], d["q"], d["b"])
            vwap.add_trade(trade)
            agg.add_trade(trade)
            result = detector.check(trade)
            if result["is_large"]:
                side = "BUY" if trade.is_buy else "SELL"
                print(f"[WHALE] {side} ${result['usd_value']:.0f}")

asyncio.run(main())
```

## VD Bucket Groups for Size Analysis

Use the `vd` channel with bucket groups to analyze trade size distribution without processing individual trades:

| Bucket | Range         |
|--------|---------------|
| 1      | All           |
| 2      | $1 - $1K      |
| 3      | $1K - $10K    |
| 4      | $10K - $25K   |
| 5      | $25K - $50K   |
| 6      | $50K - $100K  |
| 7      | $100K - $250K |
| 8      | $250K - $500K |
| 9      | $500K - $1M   |
| 10     | $1M - $5M     |
| 11     | $5M+          |

## Rules

- Use a sliding window for VWAP — prune trades older than the window to avoid unbounded growth.
- Detect large trades by USD value (`price * quantity`), not raw quantity.
- Use `stats` channel `it` (instant TPS) and `mxt` (max TPS) for activity spike detection.
- Aggregate trades into custom time buckets for volume delta analysis.
- Use VD bucket groups to analyze institutional vs retail flow without parsing every trade.
- Flush aggregation buckets when the timestamp crosses a boundary, not on a timer.
