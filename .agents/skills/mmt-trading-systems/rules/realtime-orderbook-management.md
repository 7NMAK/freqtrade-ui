# Real-Time Orderbook Management

Build and maintain a local orderbook from the `depth` channel. Handle snapshots, deltas, and sequence tracking for data integrity.

## Depth Channel Protocol

1. Subscribe to `depth` channel — no timeframe needed.
2. First message has `snapshot: true` with the full book.
3. Subsequent messages are deltas: price levels to insert, update, or remove.
4. Each message has a `seq` (sequence number). Seq numbers do **not** increment by +1. Only discard messages where `seq < lastSeq` (backwards/stale). The server sends periodic snapshots (~60s) that handle consistency automatically.
5. A level with `size = 0` means remove that price level.
6. Cap the local book at 3x your display depth to avoid accumulating thousands of unused levels.

## TypeScript

```typescript
import WebSocket from "ws";

interface OrderbookLevel {
  price: number;
  size: number;
}

class LocalOrderbook {
  asks: Map<number, number> = new Map(); // price -> size
  bids: Map<number, number> = new Map();
  lastPrice: number = 0;
  lastSeq: number = -1;
  isReady: boolean = false;

  private maxLevels: number;

  constructor(displayLevels: number = 25) {
    // Cap at 3x display depth to avoid accumulating thousands of unused levels
    this.maxLevels = displayLevels * 3;
  }

  applyMessage(data: any) {
    // Discard stale messages (seq went backwards). MMT seq numbers do NOT
    // increment by +1 — only reject if seq < lastSeq. Periodic server
    // snapshots (~60s) handle consistency automatically.
    if (!data.snapshot && this.lastSeq >= 0 && data.seq < this.lastSeq) {
      return true; // Stale message, ignore silently
    }

    if (data.snapshot) {
      // Full snapshot — replace entire book
      this.asks.clear();
      this.bids.clear();
      for (const [price, size] of data.a) {
        this.asks.set(price, size);
      }
      for (const [price, size] of data.b) {
        this.bids.set(price, size);
      }
      this.isReady = true;
    } else {
      // Delta update
      for (const [price, size] of data.a) {
        if (size === 0) this.asks.delete(price);
        else this.asks.set(price, size);
      }
      for (const [price, size] of data.b) {
        if (size === 0) this.bids.delete(price);
        else this.bids.set(price, size);
      }
    }

    this.lastPrice = data.lp;
    this.lastSeq = data.seq;

    // Trim book to maxLevels after every snapshot to prevent unbounded growth
    if (data.snapshot) {
      this.trimLevels();
    }

    return true;
  }

  private trimLevels() {
    if (this.asks.size > this.maxLevels) {
      const sorted = [...this.asks.keys()].sort((a, b) => a - b);
      for (let i = this.maxLevels; i < sorted.length; i++) {
        this.asks.delete(sorted[i]);
      }
    }
    if (this.bids.size > this.maxLevels) {
      const sorted = [...this.bids.keys()].sort((a, b) => b - a);
      for (let i = this.maxLevels; i < sorted.length; i++) {
        this.bids.delete(sorted[i]);
      }
    }
  }

  bestAsk(): OrderbookLevel | null {
    if (this.asks.size === 0) return null;
    const price = Math.min(...this.asks.keys());
    return { price, size: this.asks.get(price)! };
  }

  bestBid(): OrderbookLevel | null {
    if (this.bids.size === 0) return null;
    const price = Math.max(...this.bids.keys());
    return { price, size: this.bids.get(price)! };
  }

  spread(): number | null {
    const ask = this.bestAsk();
    const bid = this.bestBid();
    if (!ask || !bid) return null;
    return ask.price - bid.price;
  }

  // Get top N levels sorted
  topAsks(n: number): OrderbookLevel[] {
    return [...this.asks.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, n)
      .map(([price, size]) => ({ price, size }));
  }

  topBids(n: number): OrderbookLevel[] {
    return [...this.bids.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, n)
      .map(([price, size]) => ({ price, size }));
  }

  // Total depth within a price range
  depthWithinPct(side: "ask" | "bid", pct: number): number {
    const ref = this.lastPrice;
    const levels = side === "ask" ? this.asks : this.bids;
    let total = 0;
    for (const [price, size] of levels) {
      const dist = Math.abs(price - ref) / ref;
      if (dist <= pct / 100) {
        total += price * size;
      }
    }
    return total;
  }
}

// --- Usage ---
const ws = new WebSocket("wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY");
const book = new LocalOrderbook();

ws.on("open", () => {
  ws.send(JSON.stringify({
    type: "subscribe", channel: "depth",
    exchange: "binancef", symbol: "btc/usdt",
  }));
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.channel !== "depth") return;

  const ok = book.applyMessage(msg.data);
  if (!ok) {
    // Sequence gap — fetch fresh snapshot via REST
    console.log("Requesting fresh snapshot...");
    fetchSnapshot("binancef", "btc/usdt").then((snap) => book.applyMessage(snap));
  }

  if (book.isReady) {
    const spread = book.spread();
    console.log(`Spread: ${spread?.toFixed(2)} | Ask depth (1%): $${book.depthWithinPct("ask", 1).toFixed(0)}`);
  }
});

async function fetchSnapshot(exchange: string, symbol: string): Promise<any> {
  const res = await fetch(
    `https://eu-central-1.mmt.gg/api/v1/orderbook?exchange=${exchange}&symbol=${symbol}&levels=1000`,
    { headers: { "X-API-Key": "YOUR_API_KEY" } }
  );
  const data = await res.json();
  data.snapshot = true;
  return data;
}
```

## Python

```python
import asyncio
import json
import aiohttp
import websockets

class LocalOrderbook:
    def __init__(self):
        self.asks: dict[float, float] = {}
        self.bids: dict[float, float] = {}
        self.last_price: float = 0
        self.last_seq: int = -1
        self.is_ready: bool = False

    def apply_message(self, data: dict) -> bool:
        # Discard stale messages (seq went backwards). MMT seq numbers do NOT
        # increment by +1 — only reject if seq < last_seq.
        if not data.get("snapshot") and self.last_seq >= 0 and data.get("seq", 0) < self.last_seq:
            return True  # Stale message, ignore silently

        if data.get("snapshot"):
            self.asks = {p: s for p, s in data["a"]}
            self.bids = {p: s for p, s in data["b"]}
            self.is_ready = True
        else:
            for p, s in data.get("a", []):
                if s == 0:
                    self.asks.pop(p, None)
                else:
                    self.asks[p] = s
            for p, s in data.get("b", []):
                if s == 0:
                    self.bids.pop(p, None)
                else:
                    self.bids[p] = s

        self.last_price = data.get("lp", self.last_price)
        self.last_seq = data.get("seq", self.last_seq)
        return True

    def best_ask(self) -> tuple[float, float] | None:
        if not self.asks:
            return None
        price = min(self.asks.keys())
        return (price, self.asks[price])

    def best_bid(self) -> tuple[float, float] | None:
        if not self.bids:
            return None
        price = max(self.bids.keys())
        return (price, self.bids[price])

    def spread(self) -> float | None:
        ask = self.best_ask()
        bid = self.best_bid()
        if not ask or not bid:
            return None
        return ask[0] - bid[0]

    def depth_within_pct(self, side: str, pct: float) -> float:
        levels = self.asks if side == "ask" else self.bids
        total = 0.0
        for price, size in levels.items():
            dist = abs(price - self.last_price) / self.last_price
            if dist <= pct / 100:
                total += price * size
        return total

async def main():
    book = LocalOrderbook()
    uri = "wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY"

    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({
            "type": "subscribe", "channel": "depth",
            "exchange": "binancef", "symbol": "btc/usdt",
        }))

        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("channel") != "depth":
                continue

            ok = book.apply_message(msg["data"])
            if not ok:
                # Fetch fresh snapshot via REST
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        "https://eu-central-1.mmt.gg/api/v1/orderbook",
                        params={"exchange": "binancef", "symbol": "btc/usdt", "levels": "1000"},
                        headers={"X-API-Key": "YOUR_API_KEY"},
                    ) as resp:
                        snap = await resp.json()
                        snap["snapshot"] = True
                        book.apply_message(snap)

            if book.is_ready:
                spread = book.spread()
                depth = book.depth_within_pct("ask", 1)
                print(f"Spread: {spread:.2f} | Ask depth (1%): ${depth:.0f}")

asyncio.run(main())
```

## Rules

- Always wait for the initial snapshot (`snapshot: true`) before processing deltas.
- MMT depth `seq` numbers do **not** increment by +1. Only discard messages where `seq < lastSeq` (backwards/stale). Never reset the entire book on a seq skip or repeat.
- Periodic server snapshots (~60s) handle consistency automatically — you do not need to request REST snapshots on seq gaps.
- Remove levels where `size = 0`; do not keep them with zero size.
- Cap the local book at 3x your display depth (e.g., 75 levels if displaying 25). Trim after every snapshot to prevent unbounded Map growth.
- Use sorted access for best bid/ask rather than sorting the entire book on every update.
- Fetch REST snapshot at `/api/v1/orderbook` only as a last resort if the book appears corrupt (e.g., crossed spread persists for multiple messages).
- Depth data is per-exchange only — aggregated orderbooks are not available. Subscribe per exchange.
- Consider using CBOR format (`format=cbor`) for depth channels to reduce bandwidth on high-frequency updates.
