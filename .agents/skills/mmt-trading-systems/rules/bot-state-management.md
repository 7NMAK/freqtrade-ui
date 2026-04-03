# Bot State Management

Maintain local state derived from MMT streams. Track candles, rolling windows, and positions with proper initialization and persistence.

## State Categories

1. **Market State** — Latest candle per symbol/tf, current price, spread
2. **Derived State** — Rolling windows for indicators (SMA, EMA, RSI), VWAP accumulators
3. **Position State** — Open positions, P&L, exposure tracking
4. **Session State** — Connection metadata, subscription list, last sequence numbers

## Bootstrapping State on Connect

Use `range_request` to fetch recent historical data before processing live events. This avoids cold-start gaps.

### TypeScript

```typescript
interface CandleState {
  current: OHLCVT | null;
  history: OHLCVT[];
  maxHistory: number;
}

interface OHLCVT {
  t: number; o: number; h: number; l: number; c: number;
  vb: number; vs: number; tb: number; ts: number;
}

class BotStateManager {
  private candles: Map<string, CandleState> = new Map();
  private positions: Map<string, Position> = new Map();

  // Bootstrap from historical data before going live
  bootstrapCandles(key: string, ws: WebSocket, exchange: string, symbol: string, tf: string) {
    const TF_SECONDS: Record<string, number> = {
      '1s': 1, '5s': 5, '15s': 15, '30s': 30,
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '12h': 43200, '1d': 86400, '1w': 604800,
    };
    const tfSec = TF_SECONDS[tf] || 60;
    const now = Math.floor(Date.now() / 1000);
    const from = now - tfSec * 200; // fetch last 200 candles

    ws.send(JSON.stringify({
      type: "subscribe",
      channel: "candles",
      exchange,
      symbol,
      tf,
      range_request: { from, to: now },
    }));

    this.candles.set(key, { current: null, history: [], maxHistory: 200 });
  }

  updateCandle(key: string, candle: OHLCVT) {
    const state = this.candles.get(key);
    if (!state) return;

    // If new candle timestamp, rotate current into history
    if (state.current && candle.t !== state.current.t) {
      state.history.push(state.current);
      if (state.history.length > state.maxHistory) {
        state.history.shift();
      }
    }
    state.current = candle;
  }

  // Rolling SMA over candle closes
  getSMA(key: string, period: number): number | null {
    const state = this.candles.get(key);
    if (!state || state.history.length < period) return null;
    const closes = state.history.slice(-period).map((c) => c.c);
    return closes.reduce((a, b) => a + b, 0) / period;
  }

  // EMA with smoothing factor
  getEMA(key: string, period: number): number | null {
    const state = this.candles.get(key);
    if (!state || state.history.length < period) return null;
    const k = 2 / (period + 1);
    let ema = state.history[state.history.length - period].c;
    for (let i = state.history.length - period + 1; i < state.history.length; i++) {
      ema = state.history[i].c * k + ema * (1 - k);
    }
    return ema;
  }

  getCandles(key: string): OHLCVT[] {
    const state = this.candles.get(key);
    if (!state) return [];
    return state.current ? [...state.history, state.current] : [...state.history];
  }
}

interface Position {
  symbol: string;
  exchange: string;
  side: "long" | "short";
  entryPrice: number;
  size: number;
  openedAt: number;
}

class PositionTracker {
  private positions: Map<string, Position> = new Map();

  open(pos: Position) {
    this.positions.set(`${pos.exchange}:${pos.symbol}`, pos);
  }

  close(exchange: string, symbol: string): Position | undefined {
    const key = `${exchange}:${symbol}`;
    const pos = this.positions.get(key);
    this.positions.delete(key);
    return pos;
  }

  unrealizedPnl(exchange: string, symbol: string, currentPrice: number): number {
    const pos = this.positions.get(`${exchange}:${symbol}`);
    if (!pos) return 0;
    const direction = pos.side === "long" ? 1 : -1;
    return (currentPrice - pos.entryPrice) * pos.size * direction;
  }
}
```

### Python

```python
from dataclasses import dataclass, field
from collections import deque
import json

@dataclass
class OHLCVT:
    t: int; o: float; h: float; l: float; c: float
    vb: float; vs: float; tb: int; ts: int

@dataclass
class CandleState:
    current: OHLCVT | None = None
    history: deque = field(default_factory=lambda: deque(maxlen=200))

class BotStateManager:
    def __init__(self):
        self.candles: dict[str, CandleState] = {}

    TF_SECONDS = {
        "1s": 1, "5s": 5, "15s": 15, "30s": 30,
        "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
        "1h": 3600, "4h": 14400, "12h": 43200, "1d": 86400, "1w": 604800,
    }

    def bootstrap_candles(self, key: str, ws, exchange: str, symbol: str, tf: str):
        """Send range_request for recent history to seed state."""
        import time
        tf_sec = self.TF_SECONDS.get(tf, 60)
        now = int(time.time())
        from_ts = now - tf_sec * 200
        ws.send(json.dumps({
            "type": "subscribe", "channel": "candles",
            "exchange": exchange, "symbol": symbol, "tf": tf,
            "range_request": {"from": from_ts, "to": now},
        }))
        self.candles[key] = CandleState()

    def update_candle(self, key: str, data: dict):
        state = self.candles.get(key)
        if not state:
            return
        candle = OHLCVT(t=data["t"], o=data["o"], h=data["h"], l=data["l"],
                        c=data["c"], vb=data["vb"], vs=data["vs"],
                        tb=data["tb"], ts=data["ts"])
        if state.current and candle.t != state.current.t:
            state.history.append(state.current)
        state.current = candle

    def get_sma(self, key: str, period: int) -> float | None:
        state = self.candles.get(key)
        if not state or len(state.history) < period:
            return None
        closes = [c.c for c in list(state.history)[-period:]]
        return sum(closes) / period

    def get_ema(self, key: str, period: int) -> float | None:
        state = self.candles.get(key)
        if not state or len(state.history) < period:
            return None
        k = 2 / (period + 1)
        hist = list(state.history)
        ema = hist[-period].c
        for candle in hist[-period + 1:]:
            ema = candle.c * k + ema * (1 - k)
        return ema

@dataclass
class Position:
    symbol: str
    exchange: str
    side: str  # "long" or "short"
    entry_price: float
    size: float
    opened_at: int

class PositionTracker:
    def __init__(self):
        self.positions: dict[str, Position] = {}

    def open(self, pos: Position):
        self.positions[f"{pos.exchange}:{pos.symbol}"] = pos

    def close(self, exchange: str, symbol: str) -> Position | None:
        return self.positions.pop(f"{exchange}:{symbol}", None)

    def unrealized_pnl(self, exchange: str, symbol: str, current_price: float) -> float:
        pos = self.positions.get(f"{exchange}:{symbol}")
        if not pos:
            return 0.0
        direction = 1 if pos.side == "long" else -1
        return (current_price - pos.entry_price) * pos.size * direction
```

## Persistence for Restarts

Serialize state to disk periodically so the bot can resume without a full re-bootstrap.

```typescript
import { writeFileSync, readFileSync, existsSync } from "fs";

function saveState(state: BotStateManager, path: string) {
  writeFileSync(path, JSON.stringify({
    candles: Object.fromEntries(state.candles),
    savedAt: Date.now(),
  }));
}

function loadState(path: string): any | null {
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, "utf-8"));
  const age = Date.now() - data.savedAt;
  if (age > 5 * 60 * 1000) return null; // stale if > 5 minutes
  return data;
}
```

## Rules

- Always bootstrap state with `range_request` on first connect to avoid cold-start gaps.
- Use bounded collections (deque, circular buffer) for rolling windows — never let history grow unbounded.
- Rotate candle state when the timestamp changes, not on every update.
- Persist state periodically and validate freshness on reload — discard if too stale.
- Track positions independently from exchange state; reconcile on reconnection.
- Key state maps by `exchange:symbol:tf` to avoid collisions across multiple feeds.
