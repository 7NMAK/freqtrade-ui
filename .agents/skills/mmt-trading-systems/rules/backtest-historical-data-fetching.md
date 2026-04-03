# Historical Data Fetching for Backtesting

Paginate REST requests to fetch large time ranges of historical data. Chunk requests to stay within point limits and rate budgets.

## Point Limits per Request

| Stream | Max Points |
|--------|-----------|
| candles | 100,000 |
| stats | 100,000 |
| volumes | 20,000 |
| oi | 100,000 |
| vd | 100,000 |
| heatmap_sd | 5,000 |
| heatmap_hd | 4,000 |
| flat_heatmap_sd | 5,000 |
| flat_heatmap_hd | 4,000 |

## Chunking Strategy

Calculate chunk size based on timeframe and point limit:

```
chunk_duration = max_points * tf_seconds
```

For 1-minute candles (tf=1m) with 100K point limit:
```
chunk_duration = 100,000 * 60 = 6,000,000 seconds = ~69 days per request
```

For 1-second stats (tf=1s):
```
chunk_duration = 100,000 * 1 = 100,000 seconds = ~27.7 hours per request
```

## TypeScript

```typescript
interface FetchOptions {
  exchange: string;
  symbol: string;
  tf: string;    // e.g. "1m", "1h", "1d"
  from: number;  // unix seconds
  to: number;    // unix seconds
  stream: string; // "candles", "stats", "volumes", etc.
}

const TF_SECONDS: Record<string, number> = {
  '1s': 1, '5s': 5, '15s': 15, '30s': 30,
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '4h': 14400, '12h': 43200, '1d': 86400, '1w': 604800,
};

const MAX_POINTS: Record<string, number> = {
  candles: 100_000,
  stats: 100_000,
  volumes: 20_000,
  oi: 100_000,
  vd: 100_000,
  heatmap_sd: 5_000,
  heatmap_hd: 4_000,
  flat_heatmap_sd: 5_000,
  flat_heatmap_hd: 4_000,
};

class HistoricalFetcher {
  private apiKey: string;
  private baseUrl = "https://eu-central-1.mmt.gg/api/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Calculate time chunks for paginated fetching
  private getChunks(from: number, to: number, tf: string, stream: string): { from: number; to: number }[] {
    const maxPoints = MAX_POINTS[stream] || 100_000;
    const tfSec = TF_SECONDS[tf] || 60;
    const chunkDuration = maxPoints * tfSec;
    const chunks: { from: number; to: number }[] = [];

    let cursor = from;
    while (cursor < to) {
      const chunkEnd = Math.min(cursor + chunkDuration, to);
      chunks.push({ from: cursor, to: chunkEnd });
      cursor = chunkEnd;
    }

    return chunks;
  }

  // Fetch a single chunk
  private async fetchChunk(stream: string, params: Record<string, string | number>): Promise<any[]> {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      query.set(k, String(v));
    }

    const res = await fetch(`${this.baseUrl}/${stream}?${query}`, {
      headers: { "X-API-Key": this.apiKey },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60");
      console.log(`Rate limited. Waiting ${retryAfter}s...`);
      await this.sleep(retryAfter * 1000);
      return this.fetchChunk(stream, params); // retry
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    return res.json();
  }

  // Fetch full range with automatic pagination
  async fetchRange(opts: FetchOptions): Promise<any[]> {
    const chunks = this.getChunks(opts.from, opts.to, opts.tf, opts.stream);
    console.log(`Fetching ${opts.stream}: ${chunks.length} chunks, tf=${opts.tf}`);

    const allData: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`  Chunk ${i + 1}/${chunks.length}: ${new Date(chunk.from * 1000).toISOString()} → ${new Date(chunk.to * 1000).toISOString()}`);

      const data = await this.fetchChunk(opts.stream, {
        exchange: opts.exchange,
        symbol: opts.symbol,
        tf: opts.tf,
        from: chunk.from,
        to: chunk.to,
      });

      allData.push(...data);

      // Polite delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await this.sleep(200);
      }
    }

    // Deduplicate by timestamp (overlapping boundaries)
    const seen = new Set<number>();
    return allData.filter((item) => {
      const t = item.t;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// --- Usage ---
const fetcher = new HistoricalFetcher("YOUR_API_KEY");

// Fetch 30 days of 1-minute candles
const now = Math.floor(Date.now() / 1000);
const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

const candles = await fetcher.fetchRange({
  exchange: "binancef",
  symbol: "btc/usdt",
  tf: "1m",
  from: thirtyDaysAgo,
  to: now,
  stream: "candles",
});

console.log(`Fetched ${candles.length} candles`);
```

## Python

```python
import asyncio
import time
import aiohttp

TF_SECONDS = {
    "1s": 1, "5s": 5, "15s": 15, "30s": 30,
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "4h": 14400, "12h": 43200, "1d": 86400, "1w": 604800,
}

MAX_POINTS = {
    "candles": 100_000, "stats": 100_000, "volumes": 20_000,
    "oi": 100_000, "vd": 100_000, "heatmap_sd": 5_000, "heatmap_hd": 4_000,
    "flat_heatmap_sd": 5_000, "flat_heatmap_hd": 4_000,
}

class HistoricalFetcher:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://eu-central-1.mmt.gg/api/v1"

    def _get_chunks(self, from_ts: int, to_ts: int, tf: str, stream: str) -> list[dict]:
        max_points = MAX_POINTS.get(stream, 100_000)
        tf_sec = TF_SECONDS.get(tf, 60)
        chunk_duration = max_points * tf_sec
        chunks = []
        cursor = from_ts
        while cursor < to_ts:
            chunk_end = min(cursor + chunk_duration, to_ts)
            chunks.append({"from": cursor, "to": chunk_end})
            cursor = chunk_end
        return chunks

    async def fetch_range(self, exchange: str, symbol: str, tf: str,
                          from_ts: int, to_ts: int, stream: str) -> list[dict]:
        chunks = self._get_chunks(from_ts, to_ts, tf, stream)
        print(f"Fetching {stream}: {len(chunks)} chunks, tf={tf}")

        all_data = []
        async with aiohttp.ClientSession() as session:
            for i, chunk in enumerate(chunks):
                print(f"  Chunk {i+1}/{len(chunks)}")
                params = {
                    "exchange": exchange, "symbol": symbol,
                    "tf": tf, "from": chunk["from"], "to": chunk["to"],
                }
                async with session.get(
                    f"{self.base_url}/{stream}",
                    params=params,
                    headers={"X-API-Key": self.api_key},
                ) as resp:
                    if resp.status == 429:
                        retry_after = int(resp.headers.get("Retry-After", "60"))
                        print(f"Rate limited. Waiting {retry_after}s...")
                        await asyncio.sleep(retry_after)
                        continue  # retry this chunk
                    resp.raise_for_status()
                    data = await resp.json()
                    all_data.extend(data)

                if i < len(chunks) - 1:
                    await asyncio.sleep(0.2)

        # Deduplicate
        seen = set()
        unique = []
        for item in all_data:
            if item["t"] not in seen:
                seen.add(item["t"])
                unique.append(item)
        return unique

# Usage
async def main():
    fetcher = HistoricalFetcher("YOUR_API_KEY")
    now = int(time.time())
    thirty_days_ago = now - 30 * 24 * 60 * 60

    candles = await fetcher.fetch_range(
        exchange="binancef", symbol="btc/usdt", tf="1m",
        from_ts=thirty_days_ago, to_ts=now, stream="candles",
    )
    print(f"Fetched {len(candles)} candles")

asyncio.run(main())
```

## Choosing the Right Timeframe

| Analysis Period | Recommended TF | Approximate Points/Day |
|----------------|----------------|----------------------|
| Tick-level | 1s | 86,400 |
| Intraday | 1m | 1,440 |
| Daily patterns | 5m | 288 |
| Multi-day | 1h | 24 |
| Weekly+ | 1d | 1 |

Use the coarsest timeframe that meets your analysis needs. Fetching 1s data for a year consumes 31.5M points vs 525K for 1m data.

## Handling Gaps

Data gaps can occur during exchange downtime or low-activity periods. Handle them gracefully:

```typescript
const TF_SECONDS: Record<string, number> = {
  '1s': 1, '5s': 5, '15s': 15, '30s': 30,
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '4h': 14400, '12h': 43200, '1d': 86400, '1w': 604800,
};

function fillGaps(candles: any[], tf: string): any[] {
  const tfSec = TF_SECONDS[tf] || 60;
  const filled: any[] = [];
  for (let i = 0; i < candles.length; i++) {
    filled.push(candles[i]);
    if (i < candles.length - 1) {
      const gap = candles[i + 1].t - candles[i].t;
      if (gap > tfSec * 2) {
        // Gap detected — fill with last known close
        let t = candles[i].t + tfSec;
        while (t < candles[i + 1].t) {
          filled.push({
            t, o: candles[i].c, h: candles[i].c,
            l: candles[i].c, c: candles[i].c,
            vb: 0, vs: 0, tb: 0, ts: 0,
          });
          t += tfSec;
        }
      }
    }
  }
  return filled;
}
```

## Rules

- Calculate chunk size from `max_points * tf_seconds` to avoid exceeding point limits.
- Add a polite delay (200ms+) between paginated requests to avoid rate limiting.
- Handle HTTP 429 responses by reading `Retry-After` header and waiting.
- Deduplicate results by timestamp — chunk boundaries may overlap.
- Use the coarsest timeframe that meets your analysis needs to minimize API calls.
- Fill data gaps with last-known values rather than leaving holes in your dataset.
- Budget rate limit tokens for backfill operations separately from live data.
- For very large backfills, use higher timeframes (1h, 1d) and reconstruct finer granularity only where needed.
