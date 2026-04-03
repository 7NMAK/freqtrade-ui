# Cross-Exchange Arbitrage Detection

Use MMT's multi-exchange trade and stats streams to detect price discrepancies across exchanges in real time.

## Core Concept

MMT normalizes data from all exchanges into a single API. Subscribe to the same symbol on multiple exchanges and compare prices. The spread between exchanges represents a potential arbitrage opportunity.

```
Spread = (Price_A - Price_B) / Price_B
```

A positive spread means exchange A is trading at a premium. When spread exceeds transaction costs (fees + slippage), an opportunity may exist.

## TypeScript

```typescript
import WebSocket from "ws";

interface ExchangePrice {
  exchange: string;
  price: number;
  timestamp: number;
  source: "trade" | "mark";
}

interface ArbitrageSignal {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  spreadPct: number;
  buyPrice: number;
  sellPrice: number;
  timestamp: number;
}

class CrossExchangeDetector {
  private prices: Map<string, ExchangePrice> = new Map();
  private onSignal: ((signal: ArbitrageSignal) => void) | null = null;
  private minSpreadPct = 0.05; // 0.05% minimum spread to signal
  private maxAgeMs = 2000;     // discard prices older than 2 seconds

  constructor(private symbol: string, private exchanges: string[]) {}

  setSignalHandler(handler: (signal: ArbitrageSignal) => void) {
    this.onSignal = handler;
  }

  updatePrice(exchange: string, price: number, timestamp: number, source: "trade" | "mark") {
    this.prices.set(exchange, { exchange, price, timestamp, source });
    this.checkOpportunity();
  }

  private checkOpportunity() {
    const now = Date.now();
    const fresh: ExchangePrice[] = [];

    for (const ex of this.exchanges) {
      const p = this.prices.get(ex);
      if (p && (now - p.timestamp) < this.maxAgeMs) {
        fresh.push(p);
      }
    }

    if (fresh.length < 2) return;

    // Find min and max priced exchanges
    let minP = fresh[0], maxP = fresh[0];
    for (const p of fresh) {
      if (p.price < minP.price) minP = p;
      if (p.price > maxP.price) maxP = p;
    }

    const spreadPct = ((maxP.price - minP.price) / minP.price) * 100;

    if (spreadPct >= this.minSpreadPct) {
      this.onSignal?.({
        symbol: this.symbol,
        buyExchange: minP.exchange,   // buy on the cheaper exchange
        sellExchange: maxP.exchange,  // sell on the more expensive exchange
        spreadPct,
        buyPrice: minP.price,
        sellPrice: maxP.price,
        timestamp: now,
      });
    }
  }
}

// --- Setup WS and feed detector ---
const apiKey = "YOUR_API_KEY";
const ws = new WebSocket(`wss://eu-central-1.mmt.gg/api/v1/ws?api_key=${apiKey}`);
const detector = new CrossExchangeDetector("btc/usdt", ["binancef", "bybitf", "okxf"]);

detector.setSignalHandler((signal) => {
  console.log(`[ARB] ${signal.buyExchange} → ${signal.sellExchange} | ` +
    `spread: ${signal.spreadPct.toFixed(4)}% | ` +
    `buy@${signal.buyPrice} sell@${signal.sellPrice}`);
});

ws.on("open", () => {
  for (const exchange of ["binancef", "bybitf", "okxf"]) {
    ws.send(JSON.stringify({ type: "subscribe", channel: "trades", exchange, symbol: "btc/usdt" }));
    ws.send(JSON.stringify({ type: "subscribe", channel: "stats", exchange, symbol: "btc/usdt", tf: "1s" }));
  }
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.channel === "trades") {
    detector.updatePrice(msg.exchange, msg.data.p, msg.data.t, "trade");
  }
  if (msg.channel === "stats") {
    detector.updatePrice(msg.exchange, msg.data.mp, msg.data.t, "mark");
  }
});
```

## Python

```python
import asyncio
import json
import time
from dataclasses import dataclass
import websockets

@dataclass
class ExchangePrice:
    exchange: str
    price: float
    timestamp: float
    source: str  # "trade" or "mark"

@dataclass
class ArbitrageSignal:
    symbol: str
    buy_exchange: str
    sell_exchange: str
    spread_pct: float
    buy_price: float
    sell_price: float
    timestamp: float

class CrossExchangeDetector:
    def __init__(self, symbol: str, exchanges: list[str],
                 min_spread_pct: float = 0.05, max_age_s: float = 2.0):
        self.symbol = symbol
        self.exchanges = exchanges
        self.min_spread_pct = min_spread_pct
        self.max_age_s = max_age_s
        self.prices: dict[str, ExchangePrice] = {}
        self.signal_callback = None

    def on_signal(self, callback):
        self.signal_callback = callback

    def update_price(self, exchange: str, price: float, timestamp: float, source: str):
        self.prices[exchange] = ExchangePrice(exchange, price, timestamp, source)
        self._check_opportunity()

    def _check_opportunity(self):
        now = time.time()
        fresh = [p for p in self.prices.values()
                 if (now - p.timestamp) < self.max_age_s]

        if len(fresh) < 2:
            return

        min_p = min(fresh, key=lambda p: p.price)
        max_p = max(fresh, key=lambda p: p.price)
        spread_pct = ((max_p.price - min_p.price) / min_p.price) * 100

        if spread_pct >= self.min_spread_pct and self.signal_callback:
            self.signal_callback(ArbitrageSignal(
                symbol=self.symbol,
                buy_exchange=min_p.exchange,
                sell_exchange=max_p.exchange,
                spread_pct=spread_pct,
                buy_price=min_p.price,
                sell_price=max_p.price,
                timestamp=now,
            ))

async def main():
    detector = CrossExchangeDetector("btc/usdt", ["binancef", "bybitf", "okxf"])
    detector.on_signal(lambda s: print(
        f"[ARB] {s.buy_exchange} -> {s.sell_exchange} | "
        f"spread: {s.spread_pct:.4f}% | buy@{s.buy_price} sell@{s.sell_price}"
    ))

    uri = "wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY"
    async with websockets.connect(uri) as ws:
        for exchange in ["binancef", "bybitf", "okxf"]:
            await ws.send(json.dumps({"type": "subscribe", "channel": "trades",
                                      "exchange": exchange, "symbol": "btc/usdt"}))
            await ws.send(json.dumps({"type": "subscribe", "channel": "stats",
                                      "exchange": exchange, "symbol": "btc/usdt", "tf": "1s"}))

        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("channel") == "trades":
                detector.update_price(msg["exchange"], msg["data"]["p"],
                                      msg["data"]["t"], "trade")
            elif msg.get("channel") == "stats":
                detector.update_price(msg["exchange"], msg["data"]["mp"],
                                      msg["data"]["t"], "mark")

asyncio.run(main())
```

## Mark Price vs Last Price

- `trades` channel gives the last traded price — reflects actual fills.
- `stats` channel gives `mp` (mark price) — derived from index, more resistant to manipulation.
- For arbitrage detection, use `trades` for speed and `stats.mp` for validation.
- A discrepancy in mark prices across exchanges is stronger signal than last-trade discrepancy.

## Rules

- Discard stale prices (older than 2 seconds) before comparing — latency can create false signals.
- Account for exchange fees in spread calculation: real profit = spread - fee_A - fee_B.
- Use `stats` mark price (`mp`) for signal validation alongside trade price.
- Subscribe to `trades` on all target exchanges for a given symbol using a single WS connection.
- MMT is data-only — detection happens via MMT, execution happens via exchange APIs.
- Monitor funding rates (`fr` in stats) as persistent funding gaps are a form of arbitrage opportunity.
- Log all detected spreads with timestamps for post-hoc analysis and threshold tuning.
