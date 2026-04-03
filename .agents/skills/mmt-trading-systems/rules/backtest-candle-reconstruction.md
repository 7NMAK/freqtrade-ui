# Candle Reconstruction

Build custom timeframe candles from base candles using OHLCVT aggregation math. Validate reconstruction accuracy against server-side candles.

## OHLCVT Aggregation Rules

When combining N base candles into one higher-timeframe candle:

| Field | Aggregation | Description |
|-------|-------------|-------------|
| `t` | First candle's `t` | Timestamp of the period start |
| `o` | First candle's `o` | Open of the first base candle |
| `h` | `max(all h)` | Highest high across all candles |
| `l` | `min(all l)` | Lowest low across all candles |
| `c` | Last candle's `c` | Close of the final base candle |
| `vb` | `sum(all vb)` | Total buy volume |
| `vs` | `sum(all vs)` | Total sell volume |
| `tb` | `sum(all tb)` | Total buy trade count |
| `ts` | `sum(all ts)` | Total sell trade count |

## Timeframe Alignment

All candles align to UTC boundaries:

- 1m candles start at `XX:XX:00`
- 5m candles start at `XX:X0:00` or `XX:X5:00`
- 1h candles start at `XX:00:00`
- 4h candles start at `00:00`, `04:00`, `08:00`, `12:00`, `16:00`, `20:00`
- 1d candles start at `00:00:00 UTC`

Alignment formula:
```
aligned_timestamp = floor(timestamp / tf_seconds) * tf_seconds
```

## TypeScript

```typescript
interface OHLCVT {
  t: number;  // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
  vb: number;
  vs: number;
  tb: number;
  ts: number;
}

class CandleReconstructor {
  /**
   * Build higher-timeframe candles from base candles.
   * @param baseCandles Sorted array of base candles (ascending by t)
   * @param baseTf Base timeframe in seconds (e.g., 60 for 1m candles)
   * @param targetTf Target timeframe in seconds (e.g., 14400 for 4h candles)
   */
  static reconstruct(baseCandles: OHLCVT[], baseTf: number, targetTf: number): OHLCVT[] {
    if (targetTf % baseTf !== 0) {
      throw new Error(`Target tf (${targetTf}) must be a multiple of base tf (${baseTf})`);
    }

    // Group candles by target timeframe bucket
    const buckets: Map<number, OHLCVT[]> = new Map();

    for (const candle of baseCandles) {
      const bucketTime = Math.floor(candle.t / targetTf) * targetTf;
      if (!buckets.has(bucketTime)) buckets.set(bucketTime, []);
      buckets.get(bucketTime)!.push(candle);
    }

    // Aggregate each bucket
    const result: OHLCVT[] = [];
    const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);

    for (const bucketTime of sortedKeys) {
      const candles = buckets.get(bucketTime)!;
      result.push(this.aggregate(candles, bucketTime));
    }

    return result;
  }

  static aggregate(candles: OHLCVT[], timestamp: number): OHLCVT {
    return {
      t: timestamp,
      o: candles[0].o,
      h: Math.max(...candles.map((c) => c.h)),
      l: Math.min(...candles.map((c) => c.l)),
      c: candles[candles.length - 1].c,
      vb: candles.reduce((s, c) => s + c.vb, 0),
      vs: candles.reduce((s, c) => s + c.vs, 0),
      tb: candles.reduce((s, c) => s + c.tb, 0),
      ts: candles.reduce((s, c) => s + c.ts, 0),
    };
  }

  /**
   * Validate reconstruction by comparing with server-side candles.
   * Useful for verifying your aggregation logic is correct.
   */
  static validate(reconstructed: OHLCVT[], serverCandles: OHLCVT[], tolerancePct: number = 0.01): {
    matches: number;
    mismatches: { index: number; field: string; expected: number; got: number }[];
  } {
    const mismatches: { index: number; field: string; expected: number; got: number }[] = [];
    let matches = 0;

    for (let i = 0; i < Math.min(reconstructed.length, serverCandles.length); i++) {
      const r = reconstructed[i];
      const s = serverCandles[i];

      if (r.t !== s.t) {
        mismatches.push({ index: i, field: "t", expected: s.t, got: r.t });
        continue;
      }

      let match = true;
      for (const field of ["o", "h", "l", "c", "vb", "vs"] as const) {
        const diff = Math.abs(r[field] - s[field]);
        const pctDiff = s[field] !== 0 ? (diff / Math.abs(s[field])) * 100 : (diff === 0 ? 0 : 100);
        if (pctDiff > tolerancePct) {
          mismatches.push({ index: i, field, expected: s[field], got: r[field] });
          match = false;
        }
      }
      if (match) matches++;
    }

    return { matches, mismatches };
  }
}

// --- Example: Build 4h candles from 1h candles ---
async function buildCustomCandles(apiKey: string) {
  // Fetch 1h candles
  const now = Math.floor(Date.now() / 1000);
  const from = now - 7 * 24 * 3600; // 1 week

  const res = await fetch(
    `https://eu-central-1.mmt.gg/api/v1/candles?exchange=binancef&symbol=btc/usdt&tf=1h&from=${from}&to=${now}`,
    { headers: { "X-API-Key": apiKey } }
  );
  const hourlyCandles: OHLCVT[] = await res.json();

  // Reconstruct 4h candles
  const fourHourCandles = CandleReconstructor.reconstruct(hourlyCandles, 3600, 14400);
  console.log(`Built ${fourHourCandles.length} 4h candles from ${hourlyCandles.length} 1h candles`);

  // Validate against server-side 4h candles
  const serverRes = await fetch(
    `https://eu-central-1.mmt.gg/api/v1/candles?exchange=binancef&symbol=btc/usdt&tf=4h&from=${from}&to=${now}`,
    { headers: { "X-API-Key": apiKey } }
  );
  const serverCandles: OHLCVT[] = await serverRes.json();

  const validation = CandleReconstructor.validate(fourHourCandles, serverCandles);
  console.log(`Matches: ${validation.matches}, Mismatches: ${validation.mismatches.length}`);
  for (const m of validation.mismatches.slice(0, 5)) {
    console.log(`  [${m.index}] ${m.field}: expected=${m.expected}, got=${m.got}`);
  }
}
```

## Python

```python
import asyncio
import aiohttp
import math
from collections import defaultdict
from dataclasses import dataclass

@dataclass
class OHLCVT:
    t: int; o: float; h: float; l: float; c: float
    vb: float; vs: float; tb: int; ts: int

class CandleReconstructor:
    @staticmethod
    def reconstruct(base_candles: list[OHLCVT], base_tf: int, target_tf: int) -> list[OHLCVT]:
        if target_tf % base_tf != 0:
            raise ValueError(f"Target tf ({target_tf}) must be multiple of base tf ({base_tf})")

        buckets: dict[int, list[OHLCVT]] = defaultdict(list)
        for candle in base_candles:
            bucket_time = (candle.t // target_tf) * target_tf
            buckets[bucket_time].append(candle)

        result = []
        for bucket_time in sorted(buckets.keys()):
            candles = buckets[bucket_time]
            result.append(CandleReconstructor._aggregate(candles, bucket_time))
        return result

    @staticmethod
    def _aggregate(candles: list[OHLCVT], timestamp: int) -> OHLCVT:
        return OHLCVT(
            t=timestamp,
            o=candles[0].o,
            h=max(c.h for c in candles),
            l=min(c.l for c in candles),
            c=candles[-1].c,
            vb=sum(c.vb for c in candles),
            vs=sum(c.vs for c in candles),
            tb=sum(c.tb for c in candles),
            ts=sum(c.ts for c in candles),
        )

    @staticmethod
    def validate(reconstructed: list[OHLCVT], server: list[OHLCVT],
                 tolerance_pct: float = 0.01) -> dict:
        mismatches = []
        matches = 0
        for i in range(min(len(reconstructed), len(server))):
            r, s = reconstructed[i], server[i]
            if r.t != s.t:
                mismatches.append({"index": i, "field": "t", "expected": s.t, "got": r.t})
                continue
            match = True
            for field in ["o", "h", "l", "c", "vb", "vs"]:
                rv, sv = getattr(r, field), getattr(s, field)
                diff = abs(rv - sv)
                pct = (diff / abs(sv) * 100) if sv != 0 else (0 if diff == 0 else 100)
                if pct > tolerance_pct:
                    mismatches.append({"index": i, "field": field, "expected": sv, "got": rv})
                    match = False
            if match:
                matches += 1
        return {"matches": matches, "mismatches": mismatches}

async def build_custom_candles():
    import time
    api_key = "YOUR_API_KEY"
    now = int(time.time())
    from_ts = now - 7 * 24 * 3600

    async with aiohttp.ClientSession() as session:
        # Fetch 1h base candles
        async with session.get(
            "https://eu-central-1.mmt.gg/api/v1/candles",
            params={"exchange": "binancef", "symbol": "btc/usdt",
                    "tf": "1h", "from": from_ts, "to": now},
            headers={"X-API-Key": api_key},
        ) as resp:
            raw = await resp.json()
            hourly = [OHLCVT(t=c["t"], o=c["o"], h=c["h"], l=c["l"], c=c["c"],
                              vb=c["vb"], vs=c["vs"], tb=c["tb"], ts=c["ts"]) for c in raw]

        # Reconstruct 4h
        four_hour = CandleReconstructor.reconstruct(hourly, 3600, 14400)
        print(f"Built {len(four_hour)} 4h candles from {len(hourly)} 1h candles")

        # Validate against server
        async with session.get(
            "https://eu-central-1.mmt.gg/api/v1/candles",
            params={"exchange": "binancef", "symbol": "btc/usdt",
                    "tf": "4h", "from": from_ts, "to": now},
            headers={"X-API-Key": api_key},
        ) as resp:
            raw_server = await resp.json()
            server = [OHLCVT(t=c["t"], o=c["o"], h=c["h"], l=c["l"], c=c["c"],
                              vb=c["vb"], vs=c["vs"], tb=c["tb"], ts=c["ts"]) for c in raw_server]

        result = CandleReconstructor.validate(four_hour, server)
        print(f"Matches: {result['matches']}, Mismatches: {len(result['mismatches'])}")

asyncio.run(build_custom_candles())
```

## Common Reconstruction Scenarios

| From | To | Multiplier | Use Case |
|------|----|-----------|----------|
| 1m (60s) | 5m (300s) | 5x | Intraday scalping analysis |
| 1m (60s) | 15m (900s) | 15x | Swing trade entries |
| 1h (3600s) | 4h (14400s) | 4x | Position trading |
| 1h (3600s) | 1d (86400s) | 24x | Daily trend analysis |
| 1d (86400s) | 1w (604800s) | 7x | Weekly charts |

## Live Candle Aggregation

For real-time custom timeframes, aggregate WS candle updates on the fly:

```typescript
class LiveCandleAggregator {
  private currentCandle: OHLCVT | null = null;
  private targetTf: number;
  private onCandle: ((candle: OHLCVT) => void) | null = null;

  constructor(targetTf: number) {
    this.targetTf = targetTf;
  }

  setHandler(handler: (candle: OHLCVT) => void) {
    this.onCandle = handler;
  }

  update(baseCandle: OHLCVT) {
    const bucket = Math.floor(baseCandle.t / this.targetTf) * this.targetTf;

    if (this.currentCandle && bucket !== this.currentCandle.t) {
      // New bucket — emit completed candle and start fresh
      this.onCandle?.(this.currentCandle);
      this.currentCandle = null;
    }

    if (!this.currentCandle) {
      this.currentCandle = { ...baseCandle, t: bucket };
    } else {
      this.currentCandle.h = Math.max(this.currentCandle.h, baseCandle.h);
      this.currentCandle.l = Math.min(this.currentCandle.l, baseCandle.l);
      this.currentCandle.c = baseCandle.c;
      this.currentCandle.vb += baseCandle.vb;
      this.currentCandle.vs += baseCandle.vs;
      this.currentCandle.tb += baseCandle.tb;
      this.currentCandle.ts += baseCandle.ts;
    }
  }
}
```

## Rules

- Target timeframe must be an exact multiple of the base timeframe.
- Align bucket timestamps using `floor(timestamp / target_tf) * target_tf` in UTC.
- Aggregation: O=first open, H=max highs, L=min lows, C=last close, V=sum volumes, T=sum trades.
- Validate reconstructed candles against server-side candles at matching timeframes to verify correctness.
- Allow a small tolerance (0.01%) for floating-point rounding differences.
- For live aggregation, emit the completed candle when the bucket boundary is crossed.
- Prefer fetching the native timeframe from the server when available — reconstruction is for custom timeframes the server does not directly support.
- Handle incomplete buckets at the edges of your time range (first and last may have fewer base candles).
