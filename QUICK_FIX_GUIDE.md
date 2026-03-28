# Quick Fix Guide - Remaining Pages

## Priority 1: ANALYTICS PAGE

### Step 1: Remove mock data arrays (lines 15-94)
DELETE these entirely:
```typescript
const candles = [...]  // 20 objects
const rsiBars = [...]  // 20 bars
const macdBars = [...]  // 20 values
const volumeBars = [...] // 20 objects
const footprintData = [...] // 6 price levels
const deltaBars = [...]  // 16 values
const imbalances = [...]
const analysisStats = [...]
const heatmapRows = [...]
const notebooks = [...]
```

### Step 2: Transform candlesData to render real candles (line ~295)

BEFORE:
```typescript
{candles.map((c, i) => (
  <div key={i} className="flex-1 flex flex-col items-center relative h-full">
    {/* render from mock c.wick, c.body, c.marker */}
  </div>
))}
```

AFTER:
```typescript
{candlesData?.data?.length ? (
  candlesData.data.slice(-20).map((row, i) => {
    // row = [time, open, high, low, close, volume]
    const open = row[1], high = row[2], low = row[3], close = row[4];
    const isGreen = close >= open;
    const range = high - low || 1;
    const wickTop = (high - low) / range * 100;
    const wickBot = (low - open) / range * 100;
    const bodyTop = Math.max(open, close);
    const bodyBot = Math.min(open, close);
    
    return (
      <div key={i} className="flex-1 flex flex-col items-center relative h-full">
        <div className={`absolute w-px left-1/2 -translate-x-1/2 ${isGreen ? "bg-green" : "bg-red"}`}
          style={{ bottom: `${wickBot}%`, height: `${wickTop}%` }} />
        <div className={`absolute w-[60%] rounded-[1px] ${isGreen ? "bg-green" : "bg-red"}`}
          style={{ bottom: `${bodyBot}%`, height: `${bodyTop - bodyBot}%` }} />
      </div>
    );
  })
) : (
  <div className="flex items-center justify-center w-full h-full text-text-3">
    No data available
  </div>
)}
```

### Step 3: Wire performance stats
Change analysisStats to use real data from perfData:
```typescript
const analysisStatsDisplay = perfData.length > 0 ? [
  { label: "Pairs Analyzed", value: String(perfData.length), sub: "all pairs", subClass: "text-text-3" },
  { label: "Best Pair", value: perfData[0]?.pair ?? "—", valueClass: "!text-base text-green", 
    sub: `+${perfData[0]?.profit_abs?.toFixed(2) ?? 0}`, subClass: "text-green" },
  { label: "Worst Pair", value: perfData[perfData.length-1]?.pair ?? "—", valueClass: "!text-base text-red",
    sub: `${perfData[perfData.length-1]?.profit_abs?.toFixed(2) ?? 0}`, subClass: "text-red" },
] : [];
```

---

## Priority 2: DATA MANAGEMENT PAGE

### Step 1: Add API functions to api.ts
```typescript
export const botDownloadData = (id: number, pairs: string[], timeframe: string, stake: string = "USDT") =>
  request(`/api/bots/${id}/download-data`, {
    method: "POST",
    body: JSON.stringify({ pairs, timeframe, stake }),
  });

export const botDownloadStatus = (id: number) =>
  request<{ status: string; progress: number; completed: number; total: number }>(
    `/api/bots/${id}/download-status`
  );

export const botConvertData = (id: number, pairs: string[], timeframe: string, format: string) =>
  request(`/api/bots/${id}/convert-data`, {
    method: "POST",
    body: JSON.stringify({ pairs, timeframe, format }),
  });
```

### Step 2: Replace fake startDownload handler
BEFORE:
```typescript
const startDownload = useCallback(() => {
  setDownloading(true);
  setProgress(0);
  const interval = setInterval(() => {
    setProgress((p) => Math.min(p + Math.random() * 20, 95));
  }, 500);
  setTimeout(() => {
    clearInterval(interval);
    setProgress(100);
    setDownloading(false);
  }, 3000);
}, []);
```

AFTER:
```typescript
const startDownload = useCallback(async () => {
  if (!selectedBot || !selectedPairs.length) {
    toast.error("Select a bot and pairs");
    return;
  }
  
  const toastId = toast.loading("Starting download...");
  setDownloading(true);
  setProgress(0);
  
  try {
    const botId = parseInt(selectedBot, 10);
    await botDownloadData(botId, selectedPairs, selectedTimeframe);
    toast.dismiss(toastId);
    toast.success("Download started");
    
    // Poll for status every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        const status = await botDownloadStatus(botId);
        const pct = status.total > 0 ? (status.completed / status.total) * 100 : 0;
        setProgress(Math.min(pct, 99));
        
        if (status.status === "completed") {
          clearInterval(pollInterval);
          setProgress(100);
          setDownloading(false);
          toast.success("Download complete!");
          // Reload data list
          await loadDataList();
        }
      } catch (e) {
        // Continue polling on error
      }
    }, 2000);
    
    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(err instanceof Error ? err.message : "Download failed");
    setDownloading(false);
  }
}, [selectedBot, selectedPairs, selectedTimeframe, toast]);
```

---

## Priority 3: BACKTESTING PAGE

### Step 1: Remove mock result arrays (lines 78-98)
DELETE:
```typescript
const pairResults = [...]
const analysisData = [...]
const breakdownData = [...]
```

### Step 2: Wire form submission
```typescript
const handleStartBacktest = useCallback(async () => {
  if (!selectedBot) {
    toast.error("Select a bot first");
    return;
  }
  
  const toastId = toast.loading("Starting backtest...");
  try {
    const botId = parseInt(selectedBot, 10);
    const { job_id } = await botBacktestStart(botId, {
      strategy: selectedStrategy,
      stake_amount: parseFloat(stakeAmount),
      dry_run: true,
      // ... other params
    });
    
    toast.dismiss(toastId);
    toast.success(`Backtest started: ${job_id}`);
    
    // Poll for results
    const pollInterval = setInterval(async () => {
      try {
        const results = await botBacktestResults(botId);
        if (!results.running) {
          clearInterval(pollInterval);
          // Display results.backtest_result
          setBacktestResults(results.backtest_result);
        }
      } catch (e) {
        // Continue polling
      }
    }, 2000);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(err instanceof Error ? err.message : "Backtest failed");
  }
}, [selectedBot, selectedStrategy, stakeAmount, toast]);
```

---

## Priority 4: SETTINGS PAGE

### Step 1: Replace mock data with state
```typescript
const [roiTable, setRoiTable] = useState<Array<{time: number; roi: number}>>([]);
const [whitelist, setWhitelist] = useState<string[]>([]);
const [blacklist, setBlacklist] = useState<string[]>([]);
const [selectedExchange, setSelectedExchange] = useState("binance");
const [stakeAmount, setStakeAmount] = useState("100");
const [maxOpenTrades, setMaxOpenTrades] = useState("3");
```

### Step 2: Load from botConfig on mount
```typescript
useEffect(() => {
  if (selectedBotId) {
    botConfig(parseInt(selectedBotId, 10))
      .then(config => {
        setStakeAmount(String(config.stake_amount));
        setMaxOpenTrades(String(config.max_open_trades));
        setWhitelist(config.pair_whitelist);
        setSelectedExchange(config.exchange);
        
        // Parse minimal_roi
        if (config.minimal_roi) {
          const roi = Object.entries(config.minimal_roi).map(([k, v]) => ({
            time: parseInt(k),
            roi: v as number
          }));
          setRoiTable(roi);
        }
      })
      .catch(err => toast.error("Failed to load config"));
  }
}, [selectedBotId, toast]);
```

### Step 3: Add onChange handlers
```typescript
<input
  type="number"
  value={stakeAmount}
  onChange={(e) => setStakeAmount(e.target.value)}
  className="..."
/>

<textarea
  value={whitelist.join(", ")}
  onChange={(e) => setWhitelist(e.target.value.split(",").map(p => p.trim()))}
  className="..."
/>
```

### Step 4: Wire save button
```typescript
const handleSaveConfig = useCallback(async () => {
  if (!selectedBotId) return;
  
  const toastId = toast.loading("Saving config...");
  try {
    const botId = parseInt(selectedBotId, 10);
    await updateBot(botId, {
      stake_amount: parseFloat(stakeAmount),
      max_open_trades: parseInt(maxOpenTrades, 10),
      pair_whitelist: whitelist,
      // Add other config fields
    });
    
    toast.dismiss(toastId);
    toast.success("Config saved!");
    
    // Reload config from API to verify
    const updated = await botConfig(botId);
    // Update state with latest
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(err instanceof Error ? err.message : "Save failed");
  }
}, [selectedBotId, stakeAmount, maxOpenTrades, whitelist, toast]);
```

---

## Priority 5: FREQAI PAGE

### Step 1: Add state for ML config
```typescript
const [freqaiEnabled, setFreqaiEnabled] = useState(false);
const [modelType, setModelType] = useState("LightGBMRegressor");
const [featureCount, setFeatureCount] = useState("50");
const [trainPeriod, setTrainPeriod] = useState("30");
```

### Step 2: Load from config
```typescript
useEffect(() => {
  if (selectedBotId) {
    botConfig(parseInt(selectedBotId, 10))
      .then(config => {
        if (config.freqai) {
          setFreqaiEnabled(config.freqai.enabled ?? false);
          setModelType(config.freqai.model_type ?? "LightGBMRegressor");
          // Load other config values
        }
      });
  }
}, [selectedBotId]);
```

### Step 3: Wire save
```typescript
const handleSaveFreqAI = useCallback(async () => {
  if (!selectedBotId) return;
  
  const toastId = toast.loading("Saving FreqAI config...");
  try {
    const botId = parseInt(selectedBotId, 10);
    await updateBot(botId, {
      freqai: {
        enabled: freqaiEnabled,
        model_type: modelType,
        feature_parameters: { feature_count: parseInt(featureCount) },
        train_period_days: parseInt(trainPeriod),
      }
    });
    
    toast.dismiss(toastId);
    toast.success("FreqAI config saved!");
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(err instanceof Error ? err.message : "Save failed");
  }
}, [selectedBotId, freqaiEnabled, modelType, featureCount, trainPeriod, toast]);
```

---

## Priority 6: BUILDER PAGE

### Step 1: Wire indicator selections
```typescript
const [selectedIndicators, setSelectedIndicators] = useState<string[]>(["EMA (20)", "EMA (50)", "RSI", "ADX"]);

const toggleIndicator = (name: string) => {
  setSelectedIndicators(prev => 
    prev.includes(name) 
      ? prev.filter(i => i !== name)
      : [...prev, name]
  );
};
```

### Step 2: Add code generation
```typescript
const generateStrategyCode = () => {
  const indicators = selectedIndicators.join(", ");
  const roiDict = roiTable.reduce((acc, r) => ({ ...acc, [r.minutes]: r.roi / 100 }), {});
  
  return `
class CustomStrategy(IStrategy):
    INDICATORS = [${indicators}]
    minimal_roi = ${JSON.stringify(roiDict)}
    stoploss = ${stoploss / 100}
    trailing_stop = ${trailingStop}
    
    # ... auto-generated entries and exits
  `;
};
```

### Step 3: Wire create button
```typescript
const handleCreateStrategy = useCallback(async () => {
  if (!strategyName) {
    toast.error("Enter a strategy name");
    return;
  }
  
  const toastId = toast.loading("Creating strategy...");
  try {
    const code = generateStrategyCode();
    
    // Call API to create strategy file
    const strategyFile = new File([code], `${strategyName}.py`, { type: "text/plain" });
    const botId = parseInt(selectedBot, 10);
    
    await importStrategy(botId, strategyFile);
    
    toast.dismiss(toastId);
    toast.success("Strategy created and imported!");
    
    // Redirect or reset form
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(err instanceof Error ? err.message : "Creation failed");
  }
}, [strategyName, selectedBot, generateStrategyCode, toast]);
```

---

## Implementation Checklist

- [ ] Strategies page: DONE ✅
- [ ] Analytics page: Remove mock, wire real data
- [ ] Data Management: Add download API, replace fake progress
- [ ] Backtesting: Remove hardcoded results, wire form
- [ ] Settings: Add state, onChange handlers, API sync
- [ ] FreqAI: Add state, load/save config
- [ ] Builder: Wire selections, add code generation
- [ ] Test all pages end-to-end
- [ ] Verify API calls in Network tab
- [ ] Check for console errors
- [ ] Test error scenarios (offline API, invalid input)

---

## Common Patterns Used

All remaining fixes follow these patterns:

1. **State:** `const [value, setValue] = useState(initialValue)`
2. **Load:** useEffect on mount calls API with `botConfig()` or similar
3. **Input:** onChange handler updates state immediately
4. **Save:** Button onClick calls API with state values, then reloads
5. **Error:** Try/catch with toast.error on failure
6. **Loading:** Show toast.loading, then toast.dismiss + toast.success

This ensures consistency across all pages and makes the codebase predictable.
