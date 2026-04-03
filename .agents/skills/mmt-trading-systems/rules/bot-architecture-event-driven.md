# Event-Driven Bot Architecture

Structure trading bots as layered, event-driven systems with MMT WebSocket streams as the primary data source.

## Architecture Layers

1. **Data Layer** — WebSocket connections to MMT, message parsing, normalization
2. **Strategy Layer** — Signal generation from market events, indicator calculation
3. **Execution Layer** — Order management via exchange APIs (external to MMT)

Keep these layers fully decoupled. The data layer emits typed events; the strategy layer consumes events and emits signals; the execution layer acts on signals. MMT provides data only — all order execution happens through exchange APIs directly.

## Event Flow

```
MMT WS → [trades, candles, stats] → Data Layer → Event Bus → Strategy Layer → Signal → Execution Layer
```

## TypeScript

```typescript
import WebSocket from "ws";

// --- Types ---
interface TradeEvent {
  kind: "trade";
  exchange: string;
  symbol: string;
  price: number;
  quantity: number;
  isBuy: boolean;
  timestamp: number;
}

interface CandleEvent {
  kind: "candle";
  exchange: string;
  symbol: string;
  o: number; h: number; l: number; c: number;
  vb: number; vs: number;
  timestamp: number;
}

interface Signal {
  action: "buy" | "sell" | "none";
  symbol: string;
  exchange: string;
  reason: string;
  price: number;
  timestamp: number;
}

type MarketEvent = TradeEvent | CandleEvent;
type EventHandler = (event: MarketEvent) => void;

// --- Data Layer ---
class DataLayer {
  private ws: WebSocket | null = null;
  private handlers: EventHandler[] = [];

  constructor(private apiKey: string) {}

  onEvent(handler: EventHandler) {
    this.handlers.push(handler);
  }

  connect() {
    this.ws = new WebSocket(`wss://eu-central-1.mmt.gg/api/v1/ws?api_key=${this.apiKey}`);

    this.ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "connected" || msg.type === "pong") return;

      const event = this.normalize(msg);
      if (event) this.handlers.forEach((h) => h(event));
    });

    this.ws.on("open", () => {
      this.subscribe("trades", "binancef", "btc/usdt");
      this.subscribe("candles", "binancef", "btc/usdt", "1m");
      this.subscribe("stats", "binancef", "btc/usdt", "1m");
    });
  }

  private subscribe(channel: string, exchange: string, symbol: string, tf?: string) {
    const msg: any = { type: "subscribe", channel, exchange, symbol };
    if (tf) msg.tf = tf;
    this.ws?.send(JSON.stringify(msg));
  }

  private normalize(msg: any): MarketEvent | null {
    if (msg.channel === "trades") {
      return {
        kind: "trade",
        exchange: msg.exchange,
        symbol: msg.symbol,
        price: msg.data.p,
        quantity: msg.data.q,
        isBuy: msg.data.b,
        timestamp: msg.data.t,
      };
    }
    if (msg.channel === "candles") {
      return {
        kind: "candle",
        exchange: msg.exchange,
        symbol: msg.symbol,
        o: msg.data.o, h: msg.data.h, l: msg.data.l, c: msg.data.c,
        vb: msg.data.vb, vs: msg.data.vs,
        timestamp: msg.data.t,
      };
    }
    return null;
  }
}

// --- Strategy Layer ---
class MomentumStrategy {
  private lastCandle: CandleEvent | null = null;
  private signalCallback: ((signal: Signal) => void) | null = null;

  onSignal(cb: (signal: Signal) => void) {
    this.signalCallback = cb;
  }

  process(event: MarketEvent) {
    if (event.kind === "candle") {
      if (this.lastCandle && event.c > this.lastCandle.h) {
        this.emit({
          action: "buy",
          symbol: event.symbol,
          exchange: event.exchange,
          reason: "breakout_above_prev_high",
          price: event.c,
          timestamp: event.timestamp,
        });
      }
      this.lastCandle = event;
    }
  }

  private emit(signal: Signal) {
    this.signalCallback?.(signal);
  }
}

// --- Execution Layer (external to MMT) ---
class ExecutionLayer {
  async execute(signal: Signal) {
    if (signal.action === "none") return;
    console.log(`[EXEC] ${signal.action} ${signal.symbol} @ ${signal.price} — ${signal.reason}`);
    // Call exchange API (Binance, Bybit, etc.) to place order
  }
}

// --- Wire it up ---
const data = new DataLayer("YOUR_API_KEY");
const strategy = new MomentumStrategy();
const executor = new ExecutionLayer();

data.onEvent((e) => strategy.process(e));
strategy.onSignal((s) => executor.execute(s));
data.connect();
```

## Python

```python
import asyncio
import json
from dataclasses import dataclass
from typing import Callable
import websockets

@dataclass
class TradeEvent:
    kind: str = "trade"
    exchange: str = ""
    symbol: str = ""
    price: float = 0
    quantity: float = 0
    is_buy: bool = False
    timestamp: int = 0

@dataclass
class CandleEvent:
    kind: str = "candle"
    exchange: str = ""
    symbol: str = ""
    o: float = 0; h: float = 0; l: float = 0; c: float = 0
    vb: float = 0; vs: float = 0
    timestamp: int = 0

@dataclass
class Signal:
    action: str  # "buy", "sell", "none"
    symbol: str
    exchange: str
    reason: str
    price: float
    timestamp: int

class DataLayer:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.handlers: list[Callable] = []

    def on_event(self, handler: Callable):
        self.handlers.append(handler)

    async def connect(self):
        uri = f"wss://eu-central-1.mmt.gg/api/v1/ws?api_key={self.api_key}"
        async with websockets.connect(uri) as ws:
            await ws.send(json.dumps({"type": "subscribe", "channel": "trades", "exchange": "binancef", "symbol": "btc/usdt"}))
            await ws.send(json.dumps({"type": "subscribe", "channel": "candles", "exchange": "binancef", "symbol": "btc/usdt", "tf": "1m"}))

            async for raw in ws:
                msg = json.loads(raw)
                event = self._normalize(msg)
                if event:
                    for handler in self.handlers:
                        handler(event)

    def _normalize(self, msg: dict):
        if msg.get("channel") == "trades":
            d = msg["data"]
            return TradeEvent(exchange=msg["exchange"], symbol=msg["symbol"],
                              price=d["p"], quantity=d["q"], is_buy=d["b"], timestamp=d["t"])
        if msg.get("channel") == "candles":
            d = msg["data"]
            return CandleEvent(exchange=msg["exchange"], symbol=msg["symbol"],
                               o=d["o"], h=d["h"], l=d["l"], c=d["c"],
                               vb=d["vb"], vs=d["vs"], timestamp=d["t"])
        return None

class MomentumStrategy:
    def __init__(self):
        self.last_candle: CandleEvent | None = None
        self.signal_callback: Callable | None = None

    def on_signal(self, cb: Callable):
        self.signal_callback = cb

    def process(self, event):
        if event.kind == "candle":
            if self.last_candle and event.c > self.last_candle.h:
                self._emit(Signal("buy", event.symbol, event.exchange,
                                  "breakout_above_prev_high", event.c, event.timestamp))
            self.last_candle = event

    def _emit(self, signal: Signal):
        if self.signal_callback:
            self.signal_callback(signal)

# Wire up
data = DataLayer("YOUR_API_KEY")
strategy = MomentumStrategy()
data.on_event(strategy.process)
strategy.on_signal(lambda s: print(f"[EXEC] {s.action} {s.symbol} @ {s.price} — {s.reason}"))
asyncio.run(data.connect())
```

## Rules

- Use WebSocket streams as the single source of truth for market data.
- Never mix data fetching and strategy logic in the same module.
- Keep the execution layer independent — MMT provides data, not order placement.
- Use typed event objects at layer boundaries for safety and clarity.
- Process events synchronously within each layer; use queues if async processing is needed.
- Subscribe only to the channels your strategy actually needs to minimize noise.
