# Arbitrage Execution Patterns

MMT provides real-time signals. Execution happens through exchange APIs. This rule covers the pattern: detect via MMT, validate with depth, execute externally.

## Signal-to-Execution Pipeline

```
MMT trades → Spread Detection → Depth Validation → Size Calculation → Exchange API Execution
```

Each stage gates the next. A spread signal that fails depth validation never reaches execution.

## TypeScript

```typescript
import WebSocket from "ws";

interface ArbitrageSignal {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  spreadPct: number;
  buyPrice: number;
  sellPrice: number;
}

interface OrderbookSide {
  levels: [number, number][]; // [price, size][]
}

interface DepthState {
  asks: OrderbookSide;
  bids: OrderbookSide;
  lastUpdated: number;
}

class ArbitrageExecutor {
  private depthState: Map<string, DepthState> = new Map();
  private minProfitPct = 0.02;  // minimum profit after fees
  private feeRate = 0.04;       // 0.04% per side (taker)

  updateDepth(exchange: string, symbol: string, data: any) {
    const key = `${exchange}:${symbol}`;
    this.depthState.set(key, {
      asks: { levels: data.a },
      bids: { levels: data.b },
      lastUpdated: Date.now(),
    });
  }

  // Estimate slippage for a given size
  estimateSlippage(exchange: string, symbol: string, side: "buy" | "sell", usdSize: number): number | null {
    const depth = this.depthState.get(`${exchange}:${symbol}`);
    if (!depth || Date.now() - depth.lastUpdated > 5000) return null; // stale depth

    const levels = side === "buy" ? depth.asks.levels : depth.bids.levels;
    let remaining = usdSize;
    let totalCost = 0;
    let totalQty = 0;

    for (const [price, size] of levels) {
      const levelUsd = price * size;
      const fillUsd = Math.min(remaining, levelUsd);
      const fillQty = fillUsd / price;
      totalCost += fillQty * price;
      totalQty += fillQty;
      remaining -= fillUsd;
      if (remaining <= 0) break;
    }

    if (remaining > 0) return null; // not enough liquidity
    return totalCost / totalQty;    // volume-weighted average fill price
  }

  validate(signal: ArbitrageSignal, tradeSize: number): {
    valid: boolean;
    expectedProfitPct: number;
    buyFillPrice: number;
    sellFillPrice: number;
  } {
    const buyFill = this.estimateSlippage(signal.buyExchange, signal.symbol, "buy", tradeSize);
    const sellFill = this.estimateSlippage(signal.sellExchange, signal.symbol, "sell", tradeSize);

    if (!buyFill || !sellFill) {
      return { valid: false, expectedProfitPct: 0, buyFillPrice: 0, sellFillPrice: 0 };
    }

    // Profit after fees on both sides
    const grossPct = ((sellFill - buyFill) / buyFill) * 100;
    const netPct = grossPct - (this.feeRate * 2); // fee on buy + fee on sell

    return {
      valid: netPct >= this.minProfitPct,
      expectedProfitPct: netPct,
      buyFillPrice: buyFill,
      sellFillPrice: sellFill,
    };
  }

  async execute(signal: ArbitrageSignal, tradeSize: number) {
    const validation = this.validate(signal, tradeSize);

    if (!validation.valid) {
      console.log(`[SKIP] ${signal.symbol} spread=${signal.spreadPct.toFixed(4)}% ` +
        `but net profit ${validation.expectedProfitPct.toFixed(4)}% below threshold`);
      return;
    }

    console.log(`[EXEC] ${signal.symbol} buy@${signal.buyExchange} sell@${signal.sellExchange} ` +
      `net: ${validation.expectedProfitPct.toFixed(4)}%`);

    // Execute BOTH legs simultaneously via exchange APIs
    // MMT does NOT handle execution — use exchange SDKs directly
    await Promise.all([
      this.placeBuyOrder(signal.buyExchange, signal.symbol, tradeSize),
      this.placeSellOrder(signal.sellExchange, signal.symbol, tradeSize),
    ]);
  }

  private async placeBuyOrder(exchange: string, symbol: string, usdSize: number) {
    // Placeholder: call Binance/Bybit/OKX API
    console.log(`  → BUY ${usdSize} USD of ${symbol} on ${exchange}`);
  }

  private async placeSellOrder(exchange: string, symbol: string, usdSize: number) {
    // Placeholder: call exchange API
    console.log(`  → SELL ${usdSize} USD of ${symbol} on ${exchange}`);
  }
}

// --- Integration with MMT ---
const ws = new WebSocket("wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY");
const executor = new ArbitrageExecutor();

ws.on("open", () => {
  // Subscribe to depth on exchanges for slippage estimation
  for (const exchange of ["binancef", "bybitf"]) {
    ws.send(JSON.stringify({ type: "subscribe", channel: "depth", exchange, symbol: "btc/usdt" }));
  }
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.channel === "depth") {
    executor.updateDepth(msg.exchange, msg.symbol, msg.data);
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
class ArbitrageSignal:
    symbol: str
    buy_exchange: str
    sell_exchange: str
    spread_pct: float
    buy_price: float
    sell_price: float

class ArbitrageExecutor:
    def __init__(self, min_profit_pct: float = 0.02, fee_rate: float = 0.04):
        self.depth_state: dict[str, dict] = {}
        self.min_profit_pct = min_profit_pct
        self.fee_rate = fee_rate  # percent per side

    def update_depth(self, exchange: str, symbol: str, data: dict):
        key = f"{exchange}:{symbol}"
        self.depth_state[key] = {
            "asks": data["a"], "bids": data["b"],
            "updated": time.time(),
        }

    def estimate_slippage(self, exchange: str, symbol: str,
                          side: str, usd_size: float) -> float | None:
        state = self.depth_state.get(f"{exchange}:{symbol}")
        if not state or time.time() - state["updated"] > 5:
            return None

        levels = state["asks"] if side == "buy" else state["bids"]
        remaining = usd_size
        total_cost = 0.0
        total_qty = 0.0

        for price, size in levels:
            level_usd = price * size
            fill_usd = min(remaining, level_usd)
            fill_qty = fill_usd / price
            total_cost += fill_qty * price
            total_qty += fill_qty
            remaining -= fill_usd
            if remaining <= 0:
                break

        if remaining > 0:
            return None
        return total_cost / total_qty

    def validate(self, signal: ArbitrageSignal, trade_size: float) -> dict:
        buy_fill = self.estimate_slippage(signal.buy_exchange, signal.symbol, "buy", trade_size)
        sell_fill = self.estimate_slippage(signal.sell_exchange, signal.symbol, "sell", trade_size)

        if not buy_fill or not sell_fill:
            return {"valid": False, "net_pct": 0}

        gross_pct = ((sell_fill - buy_fill) / buy_fill) * 100
        net_pct = gross_pct - (self.fee_rate * 2)
        return {"valid": net_pct >= self.min_profit_pct, "net_pct": net_pct}

    async def execute(self, signal: ArbitrageSignal, trade_size: float):
        result = self.validate(signal, trade_size)
        if not result["valid"]:
            print(f"[SKIP] net profit {result['net_pct']:.4f}% below threshold")
            return

        print(f"[EXEC] buy@{signal.buy_exchange} sell@{signal.sell_exchange} "
              f"net: {result['net_pct']:.4f}%")
        # Execute via exchange APIs — not MMT
        await asyncio.gather(
            self._place_buy(signal.buy_exchange, signal.symbol, trade_size),
            self._place_sell(signal.sell_exchange, signal.symbol, trade_size),
        )

    async def _place_buy(self, exchange, symbol, size):
        print(f"  -> BUY {size} USD of {symbol} on {exchange}")

    async def _place_sell(self, exchange, symbol, size):
        print(f"  -> SELL {size} USD of {symbol} on {exchange}")
```

## Latency Considerations

- MMT provides sub-second trade data, but execution latency varies by exchange (50-500ms).
- Total round-trip: MMT signal (~10ms) + validation (~1ms) + exchange API (~100-300ms).
- The opportunity may close during execution. Protect with limit orders, not market orders.
- Use MMT `depth` channel data to estimate realistic fill prices before executing.

## Rules

- Always validate with orderbook depth before executing — spread without liquidity is not real.
- Execute both legs simultaneously using `Promise.all` / `asyncio.gather` to minimize leg risk.
- Use limit orders with aggressive pricing rather than market orders to control slippage.
- Account for fees on both sides: real profit = gross spread - buy fee - sell fee.
- Discard stale depth data (older than 5 seconds) — it no longer reflects market state.
- MMT handles data; exchange APIs handle execution. Never conflate the two.
- Log every signal, validation result, and execution outcome for post-trade analysis.
- Start with paper trading (log signals, skip execution) to validate your spread thresholds.
