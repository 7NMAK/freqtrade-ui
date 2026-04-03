# Risk & Position Management

Use MMT's `stats` channel to monitor funding rates, liquidation data, market skews, and depth imbalances for comprehensive risk management.

## Stats Channel Fields

| Field | Description |
|-------|-------------|
| `mp` | Mark price |
| `lp` | Last traded price |
| `fr` | Funding rate (% per funding interval) |
| `lb` | Liquidation buy volume (short squeezes) |
| `ls` | Liquidation sell volume (long liquidations) |
| `tlb` | Total liquidation buy count |
| `tls` | Total liquidation sell count |
| `vb` | Buy volume |
| `vs` | Sell volume |
| `tb` | Buy trade count |
| `ts` | Sell trade count |
| `sk` | Skews array (market sentiment) |
| `as` | Ask sums array (sell-side depth) |
| `bs` | Bid sums array (buy-side depth) |
| `mxt` | Max TPS in period |
| `it` | Instant TPS |

## TypeScript

```typescript
import WebSocket from "ws";

interface RiskAlert {
  type: "funding_spike" | "liquidation_cascade" | "depth_imbalance" | "skew_extreme";
  severity: "info" | "warning" | "critical";
  exchange: string;
  symbol: string;
  message: string;
  data: any;
}

class RiskMonitor {
  private alertCallback: ((alert: RiskAlert) => void) | null = null;
  private fundingHistory: Map<string, number[]> = new Map();
  private liqHistory: Map<string, { lb: number; ls: number; t: number }[]> = new Map();

  // Thresholds
  private fundingWarn = 0.01;    // 0.01% per interval
  private fundingCrit = 0.05;    // 0.05% per interval
  private liqSpikeMultiplier = 5; // 5x normal liquidation volume
  private depthImbalanceThresh = 0.7; // 70% one-sided

  onAlert(cb: (alert: RiskAlert) => void) {
    this.alertCallback = cb;
  }

  processStats(exchange: string, symbol: string, stats: any) {
    this.checkFundingRate(exchange, symbol, stats);
    this.checkLiquidations(exchange, symbol, stats);
    this.checkDepthImbalance(exchange, symbol, stats);
    this.checkSkews(exchange, symbol, stats);
  }

  private checkFundingRate(exchange: string, symbol: string, stats: any) {
    const key = `${exchange}:${symbol}`;
    if (!this.fundingHistory.has(key)) this.fundingHistory.set(key, []);
    const history = this.fundingHistory.get(key)!;
    history.push(stats.fr);
    if (history.length > 100) history.shift();

    const fr = Math.abs(stats.fr);
    if (fr >= this.fundingCrit) {
      this.emit({
        type: "funding_spike",
        severity: "critical",
        exchange, symbol,
        message: `Funding rate ${stats.fr > 0 ? "+" : ""}${(stats.fr * 100).toFixed(4)}% — extreme level`,
        data: { fundingRate: stats.fr, direction: stats.fr > 0 ? "longs_pay" : "shorts_pay" },
      });
    } else if (fr >= this.fundingWarn) {
      this.emit({
        type: "funding_spike",
        severity: "warning",
        exchange, symbol,
        message: `Funding rate elevated: ${(stats.fr * 100).toFixed(4)}%`,
        data: { fundingRate: stats.fr },
      });
    }
  }

  private checkLiquidations(exchange: string, symbol: string, stats: any) {
    const key = `${exchange}:${symbol}`;
    if (!this.liqHistory.has(key)) this.liqHistory.set(key, []);
    const history = this.liqHistory.get(key)!;
    history.push({ lb: stats.lb, ls: stats.ls, t: stats.t });
    if (history.length > 60) history.shift();

    if (history.length < 10) return;

    const avgLb = history.slice(0, -1).reduce((s, h) => s + h.lb, 0) / (history.length - 1);
    const avgLs = history.slice(0, -1).reduce((s, h) => s + h.ls, 0) / (history.length - 1);

    if (stats.lb > avgLb * this.liqSpikeMultiplier && avgLb > 0) {
      this.emit({
        type: "liquidation_cascade",
        severity: "critical",
        exchange, symbol,
        message: `Short squeeze: liquidation buy vol ${stats.lb.toFixed(0)} (${(stats.lb / avgLb).toFixed(1)}x avg)`,
        data: { liqBuyVol: stats.lb, avgLiqBuyVol: avgLb },
      });
    }

    if (stats.ls > avgLs * this.liqSpikeMultiplier && avgLs > 0) {
      this.emit({
        type: "liquidation_cascade",
        severity: "critical",
        exchange, symbol,
        message: `Long liquidation cascade: sell vol ${stats.ls.toFixed(0)} (${(stats.ls / avgLs).toFixed(1)}x avg)`,
        data: { liqSellVol: stats.ls, avgLiqSellVol: avgLs },
      });
    }
  }

  private checkDepthImbalance(exchange: string, symbol: string, stats: any) {
    if (!stats.as || !stats.bs || stats.as.length === 0) return;

    // Use first element (closest to price) for immediate imbalance
    const askSum = stats.as[0];
    const bidSum = stats.bs[0];
    const total = askSum + bidSum;
    if (total === 0) return;

    const bidRatio = bidSum / total;
    if (bidRatio > this.depthImbalanceThresh) {
      this.emit({
        type: "depth_imbalance",
        severity: "warning",
        exchange, symbol,
        message: `Bid-heavy imbalance: ${(bidRatio * 100).toFixed(1)}% bid depth`,
        data: { bidRatio, askSum, bidSum },
      });
    } else if ((1 - bidRatio) > this.depthImbalanceThresh) {
      this.emit({
        type: "depth_imbalance",
        severity: "warning",
        exchange, symbol,
        message: `Ask-heavy imbalance: ${((1 - bidRatio) * 100).toFixed(1)}% ask depth`,
        data: { bidRatio, askSum, bidSum },
      });
    }
  }

  private checkSkews(exchange: string, symbol: string, stats: any) {
    if (!stats.sk || stats.sk.length === 0) return;
    const skew = stats.sk[0]; // first skew level

    if (Math.abs(skew) > 0.3) {
      this.emit({
        type: "skew_extreme",
        severity: skew > 0.5 || skew < -0.5 ? "critical" : "warning",
        exchange, symbol,
        message: `Market skew: ${(skew * 100).toFixed(1)}% (${skew > 0 ? "buy-heavy" : "sell-heavy"})`,
        data: { skew, allSkews: stats.sk },
      });
    }
  }

  private emit(alert: RiskAlert) {
    this.alertCallback?.(alert);
  }
}

// --- Usage ---
const ws = new WebSocket("wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY");
const risk = new RiskMonitor();

risk.onAlert((alert) => {
  console.log(`[${alert.severity.toUpperCase()}] ${alert.type} on ${alert.exchange}/${alert.symbol}: ${alert.message}`);
});

ws.on("open", () => {
  // Monitor multiple timeframes for comprehensive view
  for (const tf of ["1s", "1m", "5m"]) {
    ws.send(JSON.stringify({
      type: "subscribe", channel: "stats",
      exchange: "binancef", symbol: "btc/usdt", tf,
    }));
  }
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.channel === "stats") {
    risk.processStats(msg.exchange, msg.symbol, msg.data);
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
class RiskAlert:
    type: str
    severity: str
    exchange: str
    symbol: str
    message: str

class RiskMonitor:
    def __init__(self):
        self.funding_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.liq_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=60))
        self.alert_callback = None

    def on_alert(self, cb):
        self.alert_callback = cb

    def process_stats(self, exchange: str, symbol: str, stats: dict):
        key = f"{exchange}:{symbol}"

        # Funding rate check
        fr = stats.get("fr", 0)
        self.funding_history[key].append(fr)
        if abs(fr) >= 0.0005:
            self._emit(RiskAlert("funding_spike",
                "critical" if abs(fr) >= 0.0005 else "warning",
                exchange, symbol,
                f"Funding rate: {fr * 100:.4f}%"))

        # Liquidation check
        lb, ls = stats.get("lb", 0), stats.get("ls", 0)
        self.liq_history[key].append({"lb": lb, "ls": ls})
        hist = list(self.liq_history[key])
        if len(hist) >= 10:
            avg_lb = sum(h["lb"] for h in hist[:-1]) / (len(hist) - 1)
            if avg_lb > 0 and lb > avg_lb * 5:
                self._emit(RiskAlert("liquidation_cascade", "critical",
                    exchange, symbol, f"Short squeeze: liq buy {lb:.0f} ({lb/avg_lb:.1f}x avg)"))

        # Depth imbalance
        ask_sums = stats.get("as", [])
        bid_sums = stats.get("bs", [])
        if ask_sums and bid_sums:
            total = ask_sums[0] + bid_sums[0]
            if total > 0:
                bid_ratio = bid_sums[0] / total
                if bid_ratio > 0.7 or bid_ratio < 0.3:
                    self._emit(RiskAlert("depth_imbalance", "warning",
                        exchange, symbol,
                        f"Depth imbalance: {bid_ratio*100:.1f}% bids"))

    def _emit(self, alert: RiskAlert):
        if self.alert_callback:
            self.alert_callback(alert)

async def main():
    risk = RiskMonitor()
    risk.on_alert(lambda a: print(f"[{a.severity.upper()}] {a.type}: {a.message}"))

    uri = "wss://eu-central-1.mmt.gg/api/v1/ws?api_key=YOUR_API_KEY"
    async with websockets.connect(uri) as ws:
        for tf in ["1s", "1m", "5m"]:
            await ws.send(json.dumps({
                "type": "subscribe", "channel": "stats",
                "exchange": "binancef", "symbol": "btc/usdt", "tf": tf,
            }))
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("channel") == "stats":
                risk.process_stats(msg["exchange"], msg["symbol"], msg["data"])

asyncio.run(main())
```

## Rules

- Monitor funding rates (`fr`) on every stats update — sudden spikes signal overcrowded positions.
- Track liquidation volumes (`lb`/`ls`) relative to recent averages — 5x spikes indicate cascades.
- Use `as`/`bs` (ask/bid sums) for depth imbalance — a ratio above 70% one-sided is significant.
- Subscribe to multiple timeframes (1s, 1m, 5m) for different risk horizons.
- Use `stats` multi-exchange aggregation (`exchange=binancef:bybitf:okxf`) for market-wide risk view.
- Log all alerts with timestamps for post-incident analysis and threshold tuning.
- Combine multiple signals: funding spike + liquidation surge + skew extreme = high-confidence alert.
