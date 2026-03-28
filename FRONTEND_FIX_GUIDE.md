# Frontend Fix Guide — Final Issues

Read this file completely, then fix each issue in order.
After fixing ALL issues, run `npx tsc --noEmit` and `npx next lint` to verify zero errors.

---

## FIX 1 — CRITICAL: Dashboard duplicate portfolioTrades() call

**File:** `frontend/src/app/dashboard/page.tsx`
**Lines:** 274-291

**Problem:** `portfolioTrades()` is called TWICE — line 275 and line 284. The second call (`pt2`) fetches the exact same data. This doubles API load on every refresh.

**Fix:** Remove the second call. Use `pt` (already fetched) for both open and closed trades:

```
// BEFORE (line 284):
const pt2 = await portfolioTrades(); // reuse portfolio endpoint — already includes all
const todayClosed = pt2.trades.filter(

// AFTER:
const todayClosed = pt.trades.filter(
```

Remove line 284 entirely. Change `pt2.trades` to `pt.trades` on line 285.

---

## FIX 2 — CRITICAL: Dashboard auto-refresh should be 10s not 30s

**File:** `frontend/src/app/dashboard/page.tsx`
**Line:** 388

**Problem:** PAGE_SPECS.md specifies D-1 through D-5 refresh every 10 seconds. Code has 30000ms (30s).

**Fix:** Change `30000` to `10000`:

```
// BEFORE:
const interval = setInterval(() => loadData(false), 30000);

// AFTER:
const interval = setInterval(() => loadData(false), 10000);
```

---

## FIX 3 — CRITICAL: Backtesting pollResults memory leak

**File:** `frontend/src/app/backtesting/page.tsx`
**Lines:** 346-368

**Problem:** `pollResults()` creates a `setInterval` inside a Promise but does NOT clean it up if the component unmounts during polling. The interval keeps firing forever.

**Fix:** Store the interval ID in a ref and clear it on unmount. Replace the current pollResults implementation:

```typescript
// Add at top of component (with other state):
const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// Replace pollResults:
const pollResults = useCallback(async (botId: number, intervalMs = 3000, maxAttempts = 60) => {
  // Clear any existing poll
  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

  let attempts = 0;
  return new Promise<FTBacktestResult>((resolve, reject) => {
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const r = await botBacktestResults(botId);
        setBtResult(r);
        if (!r.running) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          resolve(r);
        }
      } catch (e) {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        reject(e);
      }
      if (attempts >= maxAttempts) {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        reject(new Error("Backtest timed out"));
      }
    }, intervalMs);
  });
}, []);

// Add cleanup useEffect:
useEffect(() => {
  return () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };
}, []);
```

Also add `useRef` to the React imports at the top of the file.

---

## FIX 4 — MEDIUM: Backtesting silent error in poll

**File:** `frontend/src/app/backtesting/page.tsx`

**Problem:** When pollResults() rejects (network error or timeout), the error is caught but the user sees nothing — no toast, no error state.

**Fix:** In the functions that call `pollResults()`, add toast notifications to the `.catch()` handler. Find where `pollResults` is awaited and ensure errors show a toast:

```typescript
// Find the pattern like:
pollResults(botId).catch(() => { /* nothing */ });

// Change to:
pollResults(botId).catch((err) => {
  toast.error(err instanceof Error ? err.message : "Backtest polling failed. Check the bot status.");
  setRunning(false); // or whatever stops the loading state
});
```

Do this for ALL places pollResults is called (both backtest and hyperopt flows).

---

## FIX 5 — LOW: Remove 9 dead API functions from api.ts

**File:** `frontend/src/lib/api.ts`

**Problem:** 9 exported functions are never imported by any page. Dead code.

**Action:** Do NOT delete them. Instead add a comment block marking them as available for future use:

```typescript
// ── Currently unused — available for Analytics & Dashboard expansion ──
export const botCount = ...
export const botVersion = ...
export const botEntries = ...
export const botExits = ...
export const botMixTags = ...
export const botPlotConfig = ...
export const botBlacklist = ...
export const botWeekly = ...
export const botMonthly = ...
```

These map to real FT endpoints and will be needed when Analytics page gets expanded (A-18 through A-23 in PAGE_SPECS.md). Do NOT remove them.

---

## FIX 6 — LOW: Dashboard staleCount closure issue

**File:** `frontend/src/app/dashboard/page.tsx`
**Line:** 373

**Problem:** `staleCount` is read inside `loadData` callback but is NOT in the dependency array (intentionally, via eslint-disable). This means `staleCount` is always `0` inside the callback due to stale closure.

**Fix:** Use functional update to read current value:

```typescript
// BEFORE (line 373):
if (staleCount === 0) {

// AFTER — use a ref to track stale count, or simpler: always show error on failure
// Simplest fix: remove the condition, always show error toast on failure
toast.error(
  err instanceof Error ? err.message : "Failed to load dashboard data.",
  { action: { label: "RETRY", onClick: () => loadData(true) } }
);
```

Or if you want to keep the "only show first failure" behavior, use a ref:

```typescript
// At top of component:
const staleCountRef = useRef(0);

// In the catch block:
staleCountRef.current += 1;
setStaleCount(staleCountRef.current);
if (staleCountRef.current === 1) {
  toast.error(...);
}

// In the success path:
staleCountRef.current = 0;
setStaleCount(0);
```

---

## VERIFICATION CHECKLIST

After all fixes, run:

```bash
cd frontend
npx tsc --noEmit        # Must show 0 errors
npx next lint           # Must show 0 warnings
```

Then verify:
- [ ] Dashboard: no duplicate portfolioTrades() call
- [ ] Dashboard: auto-refresh is 10s (10000ms)
- [ ] Dashboard: staleCount works correctly (not stale closure)
- [ ] Backtesting: pollResults cleans up interval on unmount
- [ ] Backtesting: poll errors show toast to user
- [ ] api.ts: dead functions marked with comment, NOT deleted

---

## SUMMARY

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | CRITICAL | dashboard/page.tsx:284 | Duplicate portfolioTrades() | Use `pt` for both |
| 2 | CRITICAL | dashboard/page.tsx:388 | 30s refresh, spec says 10s | Change to 10000 |
| 3 | CRITICAL | backtesting/page.tsx:346 | Memory leak in pollResults | useRef + cleanup |
| 4 | MEDIUM | backtesting/page.tsx | Silent poll errors | Add toast on catch |
| 5 | LOW | api.ts | 9 dead functions | Mark with comment |
| 6 | LOW | dashboard/page.tsx:373 | Stale closure on staleCount | Use ref |
