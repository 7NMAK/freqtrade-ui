# Multi-Symbol Monitoring

Subscribe to multiple symbols efficiently. Fan out data from a single connection to multiple strategy instances and detect cross-pair correlations.

## Subscription Limits by Tier

| Tier     | Max Subscriptions |
|----------|-------------------|
| Strict   | 15                |
| Standard | 100               |
| Premium  | 500               |

Each `subscribe` message counts as one subscription regardless of data volume. Plan your budget carefully.

## Fan-Out Pattern

Use a single WS connection to feed multiple strategy instances. The data layer routes messages to the correct strategy by symbol.

### TypeScript

```typescript
import WebSocket from "ws";

type SymbolHandler = (channel: string, data: any) => void;

class MultiSymbolMonitor {
  private ws: WebSocket | null = null;
  private handlers: Map<string, SymbolHandler[]> = new Map();
  private subCount = 0;
  private maxSubs = 100;

  constructor(private apiKey: string) {}

  connect() {
    this.ws = new WebSocket(`wss://eu-central-1.mmt.gg/api/v1/ws?api_key=${this.apiKey}`);

    this.ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "connected") {
        this.maxSubs = msg.max_subscriptions;
        return;
      }
      if (!msg.channel || !msg.symbol) return;

      const key = `${msg.exchange}:${msg.symbol}`;
      const handlers = this.handlers.get(key) || [];
      for (const handler of handlers) {
        handler(msg.channel, msg.data);
      }
    });
  }

  watch(exchange: string, symbol: string, channels: {channel: string; tf?: string}[], handler: SymbolHandler) {
    const key = `${exchange}:${symbol}`;
    if (!this.handlers.has(key)) this.handlers.set(key, []);
    this.handlers.get(key)!.push(handler);

    for (const ch of channels) {
      if (this.subCount >= this.maxSubs) {
        console.warn(`Subscription limit reached (${this.maxSubs}). Skipping ${ch.channel} for ${symbol}`);
        continue;
      }
      const msg: any = { type: "subscribe", channel: ch.channel, exchange, symbol };
      if (ch.tf) msg.tf = ch.tf;
      this.ws?.send(JSON.stringify(msg));
      this.subCount++;
    }
  }
}

// Usage: monitor multiple pairs with one connection
const monitor = new MultiSymbolMonitor("YOUR_API_KEY");
monitor.connect();

const pairs = ["btc/usdt", "eth/usdt", "sol/usdt", "doge/usdt"];
const channels = [
  { channel: "trades" },
  { channel: "candles", tf: "1m" },
];

for (const symbol of pairs) {
  monitor.watch("binancef", symbol, channels, (channel, data) => {
    // Each pair gets its own handler
    console.log(`[${symbol}] ${channel}:`, data);
  });
}
```

### Python

```python
import asyncio
import json
from collections import defaultdict
from typing import Callable
import websockets

class MultiSymbolMonitor:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.handlers: dict[str, list[Callable]] = defaultdict(list)
        self.sub_count = 0
        self.max_subs = 100
        self.ws = None

    async def connect(self):
        uri = f"wss://eu-central-1.mmt.gg/api/v1/ws?api_key={self.api_key}"
        async with websockets.connect(uri) as ws:
            self.ws = ws
            connected = json.loads(await ws.recv())
            self.max_subs = connected.get("max_subscriptions", 100)

            async for raw in ws:
                msg = json.loads(raw)
                if not msg.get("channel"):
                    continue
                key = f"{msg['exchange']}:{msg['symbol']}"
                for handler in self.handlers.get(key, []):
                    handler(msg["channel"], msg["data"])

    async def watch(self, exchange: str, symbol: str,
                    channels: list[dict], handler: Callable):
        key = f"{exchange}:{symbol}"
        self.handlers[key].append(handler)

        for ch in channels:
            if self.sub_count >= self.max_subs:
                print(f"Sub limit reached ({self.max_subs})")
                break
            msg = {"type": "subscribe", "channel": ch["channel"],
                   "exchange": exchange, "symbol": symbol}
            if "tf" in ch:
                msg["tf"] = ch["tf"]
            await self.ws.send(json.dumps(msg))
            self.sub_count += 1

# Usage
monitor = MultiSymbolMonitor("YOUR_API_KEY")

def handle_btc(channel, data):
    print(f"[BTC] {channel}: {data}")

def handle_eth(channel, data):
    print(f"[ETH] {channel}: {data}")

async def main():
    asyncio.create_task(monitor.connect())
    await asyncio.sleep(1)  # wait for connection
    channels = [{"channel": "trades"}, {"channel": "candles", "tf": "1m"}]
    await monitor.watch("binancef", "btc/usdt", channels, handle_btc)
    await monitor.watch("binancef", "eth/usdt", channels, handle_eth)
    await asyncio.sleep(3600)

asyncio.run(main())
```

## Cross-Pair Correlation Detection

Track price movements across pairs to detect when a BTC move leads to altcoin reactions.

```typescript
class CorrelationDetector {
  private priceChanges: Map<string, { timestamp: number; change: number }[]> = new Map();
  private windowMs = 60_000; // 1 minute window

  recordTrade(symbol: string, price: number, prevPrice: number, timestamp: number) {
    if (!this.priceChanges.has(symbol)) this.priceChanges.set(symbol, []);
    const changes = this.priceChanges.get(symbol)!;
    const change = (price - prevPrice) / prevPrice;
    changes.push({ timestamp, change });

    // Prune old entries
    const cutoff = timestamp - this.windowMs;
    while (changes.length > 0 && changes[0].timestamp < cutoff) {
      changes.shift();
    }
  }

  // Detect if leader's move is followed by follower
  detectLeadLag(leader: string, follower: string, thresholdPct: number): boolean {
    const leaderChanges = this.priceChanges.get(leader) || [];
    const followerChanges = this.priceChanges.get(follower) || [];
    if (leaderChanges.length === 0 || followerChanges.length === 0) return false;

    const leaderSum = leaderChanges.reduce((s, c) => s + c.change, 0);
    const followerSum = followerChanges.reduce((s, c) => s + c.change, 0);

    // Leader moved significantly, follower hasn't caught up yet
    return Math.abs(leaderSum) > thresholdPct && Math.abs(followerSum) < Math.abs(leaderSum) * 0.3;
  }
}
```

## Subscription Budget Planning

Plan subscriptions to stay within limits:

```
4 pairs x (trades + candles_1m + stats_1m) = 4 x 3 = 12 subscriptions  (fits Strict tier)
10 pairs x (trades + candles_1m) = 10 x 2 = 20 subscriptions             (needs Standard tier)
50 pairs x (trades + candles_1m + stats_1m + depth) = 50 x 4 = 200 subs (needs Premium tier)
```

## Rules

- Count subscriptions before sending — each `subscribe` message is one subscription.
- Use a single WS connection with fan-out routing rather than multiple connections.
- Budget subscriptions: prioritize high-value channels (trades, candles) over nice-to-haves.
- For cross-pair analysis, subscribe to `trades` on all pairs but `candles`/`stats` only on key pairs.
- Clean up handlers when removing a symbol to prevent memory leaks.
- Use `range_request` only on the primary symbols to avoid exhausting rate limit budget at startup.
