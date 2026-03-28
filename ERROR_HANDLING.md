# ERROR_HANDLING.md — FreqTrade UI Error Handling Guide

**Version:** 2.1
**Updated:** 2026-03-28
**Status:** COMPREHENSIVE SPECIFICATION

---

## CRITICAL PRINCIPLE

**Kill Switch MUST ALWAYS WORK**, even when:
- Orchestrator is down
- FreqTrade API is unreachable
- Database is unavailable
- Network is degraded
- Frontend is partially broken

All other errors are degraded-mode acceptable. Kill Switch errors are NOT.

---

## GLOBAL ERROR HANDLING

### Error Severity Levels

```
LEVEL 1 (CRITICAL)
├─ Kill Switch unavailable
├─ Heartbeat polling failed (3+ failures)
└─ Forced logout (401 from Orchestrator)

LEVEL 2 (WARNING)
├─ Single API call timeout
├─ Partial data load (some bots respond, others timeout)
├─ Stale data (auto-refresh failed, showing last cached)
└─ Form validation error (client-side)

LEVEL 3 (INFO)
├─ Slow API response (>2s)
├─ Cached data being displayed
├─ Retrying failed request
└─ Data was last updated X minutes ago
```

### Toast Notification System

All errors surface via toast notifications (bottom-right corner, stacked).

**Duration rules:**
- CRITICAL errors: 10s (user must dismiss or close)
- WARNING errors: 6s (auto-dismiss)
- INFO messages: 3s (auto-dismiss)

**Toast types:**
```
error:    Red background, X icon, always closable
warning:  Yellow background, ! icon, always closable
info:     Blue background, ℹ icon, auto-dismiss
success:  Green background, ✓ icon, auto-dismiss
loading:  Gray background, spinner, not closable
```

**Toast actions:**
- `RETRY` button: Re-execute the failed request
- `LEARN MORE` button: Show error details in modal
- `CONFIGURE` button: Redirect to relevant settings page

### Error Boundary Component

Every page is wrapped in `<ErrorBoundary>` which catches unhandled errors.

**Behavior:**
1. Render error message: "Something went wrong. Please reload the page."
2. Log error to console and audit log (POST `/api/v1/audit` with error stack)
3. Show "Reload" button
4. If reload fails, show "Contact Support" with session ID

**Does NOT catch:**
- Network errors (handled by API interceptor)
- Async errors in API calls (handled by try/catch)
- User navigation errors (caught by middleware)

### API Error Interceptor (Axios)

All HTTP requests use Axios with a global error interceptor.

**Interceptor logic:**
```
1. Response received with error status
   ├─ 401: Clear auth token → redirect to /login → show "Session expired"
   ├─ 403: Show "Permission denied" → no retry
   ├─ 404: Show "Resource not found" → no retry
   ├─ 429: Rate limited → retry after X-RateLimit-Reset header
   ├─ 500-599: Show "Server error" → auto-retry after 2s (max 3 times)
   └─ Network error: Show "No connection" → auto-retry after 5s (max 5 times)

2. All retries logged to audit log
3. After max retries exhausted: show "Unable to recover" + MANUAL RETRY button
4. If Kill Switch API fails: fallback to direct container stop (see Kill Switch section)
```

**Retry backoff:**
```
Attempt 1: 2s
Attempt 2: 4s
Attempt 3: 8s
Max total wait: 14s
```

### Authentication & Token Management

**Initial login flow:**
1. User enters credentials (POST `/api/v1/login`)
2. Response includes `access_token` (JWT) + `refresh_token` (long-lived)
3. Store in localStorage: `{ access_token, refresh_token, expires_at }`
4. Set Authorization header: `Bearer <access_token>`

**Token refresh logic:**
1. Before every API call: check if `expires_at < now() + 5min`
2. If expired: POST `/api/v1/refresh` with `refresh_token`
3. On success: update `access_token` + `expires_at`
4. On failure: clear tokens → redirect to /login → show "Session expired"

**Session timeout:**
1. If API returns 401 on ANY request:
   - Clear all tokens
   - Redirect to /login
   - Show toast: "Your session has expired. Please log in again."
   - Preserve intended destination in URL query: `/login?redirect=/dashboard`

**Forced logout (admin revocation):**
1. If API returns `{ code: "SESSION_REVOKED" }`:
   - Clear all tokens immediately
   - Redirect to /login
   - Show toast: "Your session has been revoked by an administrator."
   - Do NOT allow re-login for 30s (prevent token reuse attacks)

### WebSocket Reconnection Logic

WebSocket connects for heartbeat polling (every 3s) and real-time bot status.

**Connection lifecycle:**
```
CONNECTING
    ↓
  (success)
    ↓
  CONNECTED ← [heartbeat every 3s]
    ↓
  (failure or close)
    ↓
  RECONNECTING [backoff: 2s, 4s, 8s, 16s, max 30s]
    ↓
  (success) → CONNECTED
    ↓
  (exhausted retries) → DISCONNECTED
```

**Behavior on DISCONNECTED:**
1. Show status banner: "Connection lost. Showing last known status." (yellow)
2. Dashboard shows "STALE DATA - Last update 2 minutes ago"
3. Manual refresh button: "Refresh now" (GET `/api/v1/status` via HTTP)
4. Continue attempting WebSocket reconnection every 30s in background
5. If reconnect succeeds: hide banner, resume real-time updates

**WebSocket message errors:**
1. If server sends error event: `{ type: "error", code: "...", message: "..." }`
2. Handle based on code:
   - `AUTH_FAILED`: Force logout (same as 401)
   - `RATE_LIMIT`: Back off polling to 5s (instead of 3s) for 1 minute
   - `INTERNAL_ERROR`: Show "Live updates unavailable" + retry in 30s
   - Unknown: Log to console, continue polling

### Rate Limiting Handling

Orchestrator returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers.

**Client behavior:**
1. If `Remaining < Limit * 0.2` (less than 20% remaining):
   - Show warning toast: "High API usage. Requests may be rate limited."
   - Increase polling intervals by 2x (dashboard: 20s instead of 10s)
   - User can dismiss warning (does NOT reset interval)

2. If 429 response:
   - Extract `X-RateLimit-Reset` header (Unix timestamp)
   - Wait until that timestamp before retrying
   - Show countdown: "Rate limited. Retrying in 45 seconds..."

3. After rate limit clears:
   - Resume normal polling intervals
   - Show toast: "Rate limit cleared."

### Retry Logic Best Practices

**Auto-retry scenarios:**
- ✅ Network timeout (5xx, network error)
- ✅ 429 (rate limit)
- ✅ WebSocket disconnect
- ❌ 401 (auth error — redirect instead)
- ❌ 403 (permission error — show error only)
- ❌ 404 (resource not found — show error only)
- ❌ Form validation (client-side — show validation message)

**User-triggered retry:**
- Manual "Retry" button on error toast
- Retry counter shown: "Retrying (2/3)..."
- If all retries fail: show "Unable to recover" + final error message

---

## PER-PAGE ERROR HANDLING

### Page 0: Login (`/login`)

**API endpoint:** POST `/api/v1/login`

#### Error Scenarios

| Scenario | Status | Response | UI Behavior | Recovery |
|----------|--------|----------|-------------|----------|
| Invalid credentials | 401 | `{ code: "INVALID_CREDENTIALS" }` | Show "Invalid username or password" below login form (red text) | User re-enters credentials |
| User account locked | 401 | `{ code: "ACCOUNT_LOCKED", locked_until: "timestamp" }` | Show "Account locked until HH:MM" (red banner) | User waits or contacts support |
| Orchestrator down | 500+ | Network timeout | Show "Unable to reach server" (red banner) | RETRY button triggers another attempt |
| Rate limited | 429 | `X-RateLimit-Reset: timestamp` | Show "Too many login attempts. Try again in 60s." | Countdown timer, then retry automatically |
| Network error | — | Connection refused | Show "No internet connection" (red banner) | RETRY button |
| CORS error | — | CORS headers missing | Log to console only (user sees timeout) | User refreshes page manually |

#### Form Validation (Client-Side)

Before submitting to Orchestrator:
1. **Username**: required, 3-32 chars, alphanumeric + underscores
   - Error: "Username must be 3-32 characters"
2. **Password**: required, 6+ chars
   - Error: "Password must be at least 6 characters"

Errors shown inline below input fields (red text).

#### Loading State

- Submit button disabled, shows spinner: "Logging in..."
- Username/password inputs disabled
- If login takes >5s: show "Still connecting..." toast (info level)

#### Special Cases

**First-time login (no JWT in localStorage):**
- User can log in normally
- Store tokens as described in Authentication section

**Token refresh during login:**
- If user already has valid token but it expires mid-login:
  - Logout happens automatically
  - Redirect to /login with query: `?refresh=expired`
  - Show "Your session expired during login. Please log in again."

**Concurrent login attempts:**
- If user clicks "Login" multiple times:
  - Disable button after first click (prevent duplicate requests)
  - Cancel previous in-flight request if user submits new one

---

### Page 1: Dashboard (`/dashboard`)

**Primary API endpoints:**
- GET `/api/v1/status` (bot statuses)
- GET `/api/v1/balance` (portfolio aggregated)
- GET `/api/v1/trades` (all trades from all bots)
- GET `/api/v1/health` (orchestrator health)
- WebSocket `/ws/status` (real-time updates)

**Auto-refresh:** Every 10s (unless WebSocket is connected, then manual refresh only)

#### Error Scenarios

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Orchestrator down | All API calls fail | Show "Unable to load dashboard" + stale data from cache (if available) | RETRY button or wait for WebSocket reconnect |
| Single bot timeout | Partial failure | Show bot as "UNKNOWN" status + gray color | Single bot retry or wait 10s |
| FreqTrade API down (single bot) | Partial failure | Show bot with status "OFFLINE" + error icon | Manual bot restart or admin intervention |
| All bots offline | Critical | Show "No active bots" (orange banner) + empty dashboard | User must start bots in Risk page or Settings |
| Balance API fails | Partial failure | Show portfolio section as "Loading..." spinner | Auto-retry in 10s |
| Trades API fails | Partial failure | Show trades table as "Loading..." spinner | Auto-retry in 10s |
| WebSocket disconnects | Non-critical | Hide live status banner, show "Last update 2min ago" | Manual refresh button, auto-reconnect in background |
| 401 during auto-refresh | Critical | Redirect to /login → show "Session expired" | User must log in again |

#### Loading States

**Page load:**
1. Show skeleton loaders for:
   - Bot status cards (4 cards)
   - Portfolio summary (4 stats)
   - Trades table (10 rows)
2. Show "Loading dashboard..." toast (info)

**Auto-refresh (10s interval):**
1. If succeeds: silently update dashboard
2. If timeout (>5s): show "Updating..." next to last-updated timestamp
3. If fails:
   - Show warning toast: "Unable to refresh live data"
   - Keep displaying previous data (marked as stale)
   - Retry in 10s automatically

**WebSocket updates:**
1. If WebSocket connected: real-time updates (no spinner)
2. If WebSocket disconnected but HTTP polling works: show "Showing cached data" banner (yellow)
3. If both fail: show "Stale data - manual refresh recommended" banner (orange)

#### Empty States

| Condition | Display |
|-----------|---------|
| No bots exist | "No bots configured. Go to Settings to create one." (link to /settings) |
| All bots inactive | "All bots paused. Go to Risk to manage bot state." (link to /risk) |
| No trades | "No trades yet. Configure strategies and start bots." |
| Zero portfolio balance | "Portfolio balance not yet available." (with "Refresh" button) |

#### Stale Data Handling

If auto-refresh fails >3 times in a row:
1. Stop auto-refreshing (prevent hammering API)
2. Show banner: "Live updates paused (errors detected)" (orange)
3. Show "Refresh now" button (manual HTTP GET)
4. Attempt WebSocket reconnection (separate from HTTP polling)
5. Resume auto-refresh when either:
   - User clicks "Refresh now" (and succeeds)
   - WebSocket reconnects (and sends status update)

#### Trade Table Partial Failures

If trades API times out but bot status succeeds:
1. Show bot status normally
2. Show trades table with "Loading trades..." spinner
3. User can still use Risk page (kill switch works independently)
4. If trade load persists >10s: show "Trades unavailable" message with retry button

#### Heartbeat Monitoring

Dashboard monitors heartbeat health (WebSocket-based).

**Heartbeat every 3s:**
1. If missing for 3 consecutive intervals (9s total): trigger LEVEL 1 WARNING
2. Show red banner: "Heartbeat lost. Initiating safety protocol..."
3. Start countdown: "Auto kill-switch in 10 seconds unless heartbeat resumes"
4. If heartbeat resumes: cancel kill-switch, hide banner
5. If countdown hits 0: auto-trigger kill switch (see Kill Switch section)

#### Partial Failures

Example: Bot A responds, Bot B times out, Bot C returns error.

**UI behavior:**
1. Show Bot A status normally (green)
2. Show Bot B as "LOADING..." with spinner
3. Show Bot C with error icon + tooltip "Failed to load: Server error (500)"
4. Portfolio section shows partial data (only Bot A balance)
5. Single retry buttons for each failed bot (not global retry)

---

### Page 2: Strategies (`/strategies`)

**Primary API endpoints:**
- GET `/api/v1/strategies` (list all strategies)
- DELETE `/api/v1/strategies/:id` (delete a strategy)
- POST `/api/v1/strategies/:id/backtest` (queue backtest)
- GET `/api/v1/strategies/:id/status` (fetch status: DRAFT/BACKTEST/PAPER/LIVE/RETIRED)

#### Error Scenarios

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Strategies list fails | Critical | Show "Unable to load strategies" | RETRY button |
| Strategy details fail | Partial | Show strategy in list but "click for details" fails | Show error modal, offer RETRY |
| Delete fails (409 conflict) | Non-critical | Show "Can't delete active strategy" | User must move strategy to RETIRED first |
| Delete fails (500) | Non-critical | Show "Delete failed" toast | RETRY button |
| Backtest queue fails | Non-critical | Show "Unable to queue backtest" toast | RETRY button |
| Strategy status outdated | Info | Show strategy with "(Last updated 5min ago)" note | Manual refresh button |

#### Loading States

**Page load:**
1. Show skeleton loaders for strategy cards (3 cards visible)
2. Show "Loading strategies..." (info toast)

**Strategy detail view (modal):**
1. Show "Loading details..." spinner inside modal
2. If load takes >3s: show "Still loading..." message

**Delete action:**
1. Show confirmation modal: "Delete strategy 'RSI_Strategy'? This cannot be undone."
2. If user confirms:
   - Disable delete button, show spinner: "Deleting..."
   - If succeeds: close modal, refresh list, show "Strategy deleted" (success toast)
   - If fails: show error, re-enable delete button with retry option

**Backtest queue:**
1. Button changes to: "Queuing backtest..." (spinner)
2. If succeeds: show "Backtest queued" (success toast) + show "View backtest" link
3. If fails: show error toast + retry button

#### Empty States

| Condition | Display |
|-----------|---------|
| No strategies | "No strategies yet. Create one in Strategy Builder." (link to /builder) |
| Search returns empty | "No strategies match '…'. Clear search to see all." |

#### Stale Data Handling

Strategy status (DRAFT/BACKTEST/LIVE/etc) can change from other pages.

1. Show "(Last updated 5min ago)" timestamp on each strategy
2. Manual refresh button: "Refresh strategies"
3. If status becomes outdated (>10min old):
   - Show info badge: "Status may be out of date"
   - Add refresh button to strategy card
4. Click refresh: GET `/api/v1/strategies/:id/status` (single bot API call, not full page reload)

#### Partial Failures

If strategies list succeeds but individual strategy detail fails:
1. Show strategy in list normally
2. Show "!" icon next to strategy name
3. Click strategy: show error modal instead of detail modal
4. User can dismiss error and retry, or go back

---

### Page 3: Strategy Builder (`/builder`)

**Primary API endpoints:**
- POST `/api/v1/strategies` (save new strategy)
- PUT `/api/v1/strategies/:id` (update existing strategy)
- GET `/api/v1/strategies/:id` (load for editing)
- POST `/api/v1/strategies/validate` (validate strategy syntax)

**Wizard steps:** 1. Basic Info → 2. Indicators → 3. Entry Logic → 4. Exit Logic → 5. Stoploss → 6. Review

#### Error Scenarios

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Load strategy for edit (404) | Non-critical | Show "Strategy not found" → redirect to /strategies | User starts new strategy |
| Load strategy for edit (500) | Non-critical | Show error modal with RETRY button | Retry or start new |
| Validation fails (client-side) | Non-critical | Show validation errors inline | User fixes and retries |
| Validation fails (server-side) | Non-critical | Show "Validation error" toast with details | User fixes code and retries |
| Save fails (409 conflict) | Non-critical | Show "Strategy name already exists" | User changes name and retries |
| Save fails (500) | Non-critical | Show "Unable to save strategy" toast | RETRY button |
| Unsaved changes (page navigation) | Warning | Show confirmation modal: "Discard unsaved changes?" | User confirms or goes back |
| Code syntax error | Non-critical | Show inline error in code editor (red squiggly) | User fixes and validates again |

#### Form Validation (Client-Side)

**Step 1 (Basic Info):**
- Strategy name: required, 3-50 chars, no special chars except underscores
  - Error: "Name must be 3-50 characters, alphanumeric + underscores"
- Description: optional, max 500 chars
  - Error: "Description must be under 500 characters"

**Steps 2-5:**
- All indicators/logic must reference existing indicators
  - Error: "Indicator 'RSI' not defined" (shown in code editor)
- All callbacks must return valid types (bool, float, Order, etc)
  - Error shown by server validation, not client

**Step 6 (Review):**
- No form validation (just display)
- Syntax check happens before showing step 6
  - If syntax invalid: show error, stay on step 5

#### Loading States

**Wizard load (editing existing strategy):**
1. Show skeleton loaders for all fields
2. Show "Loading strategy..." (info toast)
3. If load takes >3s: show "Still loading..." message

**Code editor:**
1. Real-time syntax highlighting (client-side, no API calls)
2. Validation button: "Validate" (POST `/api/v1/strategies/validate`)
3. If validating: button shows "Validating..." spinner
4. Result shown inline: "✓ Valid" (green) or "✗ 5 errors" (red)

**Save action (Step 6):**
1. "Save Strategy" button disabled, shows spinner: "Saving..."
2. If succeeds:
   - Show "Strategy saved" (success toast)
   - Redirect to /strategies with new strategy highlighted
3. If fails:
   - Re-enable button, show error toast with RETRY button

**Step navigation:**
1. "Next" button validates current step before advancing
2. If validation fails: show error on current step, don't advance
3. "Previous" button always works (no validation)
4. "Save" only available on step 6

#### Empty States

**New strategy (step 1):**
- All fields blank
- Show placeholder text: "Enter strategy name"

#### Unsaved Changes Detection

1. Track form state (dirty flag)
2. If user navigates away without saving:
   - Show modal: "You have unsaved changes. Discard?"
   - Options: "Save Now", "Discard", "Cancel"
3. If "Save Now": attempt to save (show validation errors if any)
4. If save succeeds: navigate away
5. If save fails: show error, stay on page

#### Code Editor Errors

Real-time validation (no API calls needed):

1. **Syntax errors**: Show in editor with red squiggly underline
   - Hover to see error message
   - Example: "Unexpected token '='"

2. **Semantic errors**: Checked by server validation
   - Show "Validate" button
   - Click to POST `/api/v1/strategies/validate`
   - Server returns detailed errors:
     ```
     {
       "valid": false,
       "errors": [
         {
           "line": 42,
           "column": 10,
           "message": "Indicator 'RSI_CUSTOM' is not defined. Did you mean 'RSI'?"
         }
       ]
     }
     ```

3. **When validating:**
   - Show spinner on "Validate" button
   - Highlight error lines in editor (light red background)
   - Show error list below editor
   - User can click error to jump to line

---

### Page 4: Backtesting (`/backtesting`)

**Primary API endpoints:**
- GET `/api/v1/backtests` (list all backtests)
- POST `/api/v1/backtests` (start new backtest)
- GET `/api/v1/backtests/:id` (fetch results)
- POST `/api/v1/backtests/:id/hyperopt` (start hyperopt)
- GET `/api/v1/backtests/:id/hyperopt` (fetch hyperopt results)

**Three tabs:** Backtest | Hyperopt | Validation

#### Error Scenarios

**All tabs:**

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Backtests list fails | Critical | Show "Unable to load backtests" | RETRY button |
| Backtest form fails to load | Critical | Show "Unable to load form" | RETRY button |

**Backtest tab:**

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Strategy not found (404) | Non-critical | Show "Strategy not found" in dropdown | User selects different strategy |
| Start backtest fails (409 conflict) | Non-critical | Show "Backtest already running for this strategy" | User waits or cancels existing backtest |
| Start backtest fails (500) | Non-critical | Show "Unable to start backtest" toast | RETRY button |
| Backtest timeout (>30min no result) | Non-critical | Show "Backtest timeout. Still running?" + cancel button | User manually checks server or cancels |
| Backtest results load fails (500) | Non-critical | Show "Unable to load results" | RETRY button, backtest itself still running |
| Backtest cancelled by user | Non-critical | Show "Backtest cancelled" (info toast) | User can start new backtest |
| Backtest cancelled by system (server restart) | Non-critical | Show "Backtest interrupted" + show last known progress | User can restart |

**Hyperopt tab:**

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Hyperopt not available (no backtest results) | Non-critical | Show "Run backtest first" message | User goes to Backtest tab |
| Hyperopt parameters invalid | Non-critical | Show "Invalid hyperopt parameters" with details | User fixes and retries |
| Hyperopt timeout (>60min) | Non-critical | Show "Hyperopt timeout" + show best trial so far | User can retry or check server |
| Loss function not available | Non-critical | Show "Loss function not available" | User selects different loss |
| Sampler error (invalid sampler type) | Non-critical | Show "Sampler configuration invalid" | User picks valid sampler |

**Validation tab:**

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Validation data missing | Non-critical | Show "Need backtest + hyperopt results first" | User completes those tabs |
| Validation compute timeout (>15min) | Non-critical | Show "Validation taking longer than expected..." | User waits or cancels |
| Validation fails (no valid data) | Non-critical | Show "Validation failed: insufficient data" | User adjusts date range and retries |

#### Form Validation (Client-Side)

**Backtest tab:**
- Strategy: required (dropdown select)
- Date range: required, from < to
  - Error: "Start date must be before end date"
- Timeframe: required (dropdown select, default 1h)
- Stake amount: required, positive number
  - Error: "Stake amount must be positive"

**Hyperopt tab:**
- Epochs: required, positive integer
  - Error: "Epochs must be positive"
- Loss function: required (dropdown)
- Sampler: required (dropdown, default TPE)
- Min value: required, number
- Max value: required, number, Max > Min
  - Error: "Max must be greater than Min"

**Validation tab:**
- No form validation (just display)

#### Loading States

**Page load:**
1. Show skeleton loaders for:
   - Backtests list (5 items)
   - Form fields (all inputs)
   - Results section (chart placeholder)
2. Show "Loading backtests..." (info toast)

**Start backtest:**
1. "Run Backtest" button disabled, shows spinner: "Starting backtest..."
2. After submit:
   - Show "Backtest queued" (success toast)
   - Show progress section: "Progress: 0% (0/1000 bars)"
   - Poll GET `/api/v1/backtests/:id` every 2s to update progress
   - If poll timeout: show "Checking progress..." message

**Backtest completion:**
1. Hide spinner, show "Results loaded"
2. Display results:
   - Charts (PnL, drawdown, etc)
   - Statistics table
   - Trade list
3. If results load fails: show "Unable to load results" with RETRY button

**Hyperopt:**
1. "Run Hyperopt" button disabled, shows spinner: "Starting hyperopt..."
2. After submit:
   - Show "Hyperopt started" (success toast)
   - Show progress: "Epoch 1/100" with spinner
   - Poll every 5s for epoch completion
3. On each epoch completion:
   - Update progress: "Epoch 15/100 — Best loss: 0.0523"
   - Show live chart of loss vs epoch
4. On completion:
   - Show "Hyperopt finished" (success toast)
   - Show best parameters
   - Show "Apply to strategy" button

**Validation:**
1. Button shows "Run Validation..." spinner
2. After submit: "Validation in progress... (this may take 10+ minutes)"
3. Show progress: "Validation step 3/5..."
4. On completion: show results

#### Empty States

| Condition | Display |
|-----------|---------|
| No backtests | "No backtests yet. Create one using the form." |
| No backtest results (just started) | "Backtest still running. Check back soon." (with 10s auto-refresh) |
| Empty backtest results (no trades) | "Backtest complete but no trades generated. Try different dates or parameters." |

#### Stale Data Handling

Backtest results can become stale if user runs same backtest again.

1. Show timestamp: "Last run 2 hours ago"
2. Show "Refresh results" button
3. If running new backtest with same params:
   - Show warning: "New backtest with same parameters will overwrite previous results"
   - Show confirmation: "Run anyway?"

#### Partial Failures

Example: Backtest succeeds but hyperopt fails.

**UI behavior:**
1. Show backtest results normally
2. Show hyperopt tab with error message: "Hyperopt failed: loss function not available"
3. User can:
   - Fix loss function and retry
   - Proceed without hyperopt
   - Cancel and try different backtest params

#### Long-Running Operations

All three operations (backtest, hyperopt, validation) are long-running.

**Polling strategy:**
- Every 2s for backtest (fast)
- Every 5s for hyperopt (medium)
- Every 10s for validation (slow)

**Timeout handling:**
- Backtest: timeout after 30min (show "timeout" message)
- Hyperopt: timeout after 60min (show best result so far)
- Validation: timeout after 15min (show "timeout" message)

**User can cancel:**
- Show "Cancel" button while running
- Click = POST `/api/v1/backtests/:id/cancel`
- On success: show "Cancelled" (info toast)
- On failure: show "Unable to cancel" (warning toast)

---

### Page 5: Analytics (`/analytics`)

**Primary API endpoints:**
- GET `/api/v1/analytics/equity` (equity curve data)
- GET `/api/v1/analytics/trades` (trade statistics)
- GET `/api/v1/analytics/orderflow` (orderflow data)
- GET `/api/v1/analytics/drawdown` (drawdown data)
- GET `/api/v1/analytics/plot-config` (FreqTrade plot config)

#### Error Scenarios

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Analytics data fails | Critical | Show "Unable to load analytics" | RETRY button |
| Single chart fails (equity curve) | Non-critical | Show "Unable to load equity curve" in chart area | Retry button on chart |
| Orderflow fails | Non-critical | Show "Orderflow data unavailable" | Retry button |
| Plot config fails | Non-critical | Show default charts (no custom config) | Manual refresh or retry |
| Date range invalid | Non-critical | Show "Invalid date range" | User adjusts dates and retries |
| No data in date range | Non-critical | Show "No data available for selected dates" | User expands date range |

#### Form Validation (Client-Side)

- Start date: required, date format
- End date: required, date format, End > Start
  - Error: "End date must be after start date"
- Indicators: optional multi-select
- Strategy filter: optional dropdown

#### Loading States

**Page load:**
1. Show skeleton loaders for:
   - Equity chart (placeholder box)
   - Trades table (5 rows)
   - Orderflow (placeholder)
   - Stats cards (4 cards)
2. Show "Loading analytics..." (info toast)

**Chart load:**
1. Each chart shows "Loading..." message inside
2. If load takes >5s: show "Still loading chart..." message

**Date range change:**
1. Show "Refreshing with new dates..." spinner on charts
2. Disable date picker during refresh
3. Auto-refresh all charts with new date range

#### Empty States

| Condition | Display |
|-----------|---------|
| No analytics data | "No analytics data yet. Run backtests or live trades." |
| Empty date range | "No data available for selected dates. Expand range." |
| No trades in range | "No trades in selected date range." |

#### Stale Data Handling

Analytics data is historical and doesn't change often.

1. Show timestamp: "Last updated 1 hour ago"
2. Manual refresh button: "Refresh analytics"
3. Auto-refresh every 30min (slower than dashboard)
4. If refresh fails:
   - Show warning toast: "Unable to refresh analytics"
   - Keep displaying old data (marked as stale)
   - Retry every 30min automatically

#### Partial Failures

Example: Equity chart succeeds, orderflow fails.

**UI behavior:**
1. Show equity chart normally
2. Show orderflow section as "Loading... (failed)" with error message
3. User can retry orderflow independently

#### Chart Interaction Errors

User interacts with charts (zoom, pan, hover, click).

1. Chart interaction is client-side (no API calls, no errors expected)
2. If chart library throws error: catch in ErrorBoundary
3. Show "Chart rendering error" (info toast)
4. Chart becomes non-interactive but still visible

#### Large Dataset Handling

Analytics pages may display large datasets (1000+ trades, months of data).

**Performance handling:**
1. Paginate trades table (20 per page)
2. Lazy-load chart data (fetch in chunks)
3. If dataset too large (>10k trades):
   - Show warning: "Large dataset. Chart may be slow. Consider narrowing date range."
   - Show date range suggestion: "Try last 30 days"

---

### Page 6: Risk Management (`/risk`)

**Primary API endpoints:**
- GET `/api/v1/status` (bot statuses for kill switch trigger)
- POST `/api/v1/kill-switch/soft` (soft kill: graceful stop)
- POST `/api/v1/kill-switch/hard` (hard kill: forceexit all + stop)
- GET `/api/v1/protections` (protection status)
- GET `/api/v1/heartbeat` (heartbeat health)

#### CRITICAL: Kill Switch Must Always Work

Kill Switch has **THREE LAYERS** for maximum reliability:

**Layer 1: Orchestrator API (primary)**
- POST `/api/v1/kill-switch/soft` → graceful stop
- POST `/api/v1/kill-switch/hard` → forceexit all trades then stop

**Layer 2: Direct FreqTrade API (fallback if Layer 1 fails)**
- POST `/api/v1/stop` → stops the bot
- POST `/api/v1/forceexit` → force exit all positions

**Layer 3: Container kill (emergency if Layers 1-2 fail)**
- Direct `docker kill <container>` from Orchestrator host
- Last resort: kill the process directly

**Fallback logic:**
```
User clicks "KILL SWITCH"
    ↓
Attempt Layer 1: POST /api/v1/kill-switch/hard
    ├─ Success: show "Kill switch activated" → done
    ├─ Timeout (5s): move to Layer 2
    └─ Error: move to Layer 2

Attempt Layer 2: POST /api/v1/stop + POST /api/v1/forceexit
    ├─ Success: show "Kill switch activated via direct API" → done
    ├─ Timeout (5s): move to Layer 3
    └─ Error: move to Layer 3

Attempt Layer 3: docker kill <container>
    ├─ Success: show "Kill switch activated (emergency stop)" → done
    └─ Error: show "CRITICAL: Kill switch failed. Manual intervention required."
           Email ops team immediately
           Show persistent banner: "BOT NOT STOPPED"
           Disable all trading buttons
```

**Kill Switch button:**
- Always visible in top-right corner (all pages)
- Always red, always prominent
- Label: "KILL SWITCH" (all caps)
- Confirm before executing: "Immediately stop all trading. Can be undone."
- On execution: show countdown "Stopping bot in 3... 2... 1..."
- After success: show green banner "Bot stopped at 14:23:45"
- If fails: show red banner "KILL SWITCH FAILED" + persistent error

#### Error Scenarios (Kill Switch)

| Scenario | Behavior |
|----------|----------|
| Layer 1 times out (5s) | Move to Layer 2, show "Initiating fallback stop..." |
| Layer 1 fails (500) | Move to Layer 2, show "Retrying with direct API..." |
| Layer 2 times out (5s) | Move to Layer 3, show "Initiating emergency stop..." |
| Layer 2 fails (500) | Move to Layer 3, show "Initiating emergency stop..." |
| Layer 3 fails | Show "CRITICAL: Kill switch failed" + email ops + disable all trading |
| All layers fail (consecutive timeouts) | After 30s total: assume kill switch failed, show critical error |

#### Error Scenarios (Other Risk Features)

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Protections list fails | Non-critical | Show "Unable to load protections" | RETRY button |
| Heartbeat check fails | Critical | Trigger kill switch countdown | See Heartbeat section |
| Bot status fails (for kill switch) | Critical | Disable kill switch button, show "Unable to determine bot status" | User can retry or manual intervention |

#### Heartbeat Monitoring

Heartbeat is separate from kill switch but triggers kill switch if it fails.

**Heartbeat logic:**
1. WebSocket sends heartbeat every 3s
2. Dashboard monitors heartbeat
3. If heartbeat missing for 9s (3 intervals):
   - Risk page shows warning banner: "Heartbeat lost"
   - Start countdown: "Auto kill-switch in 10 seconds unless heartbeat resumes"
4. Options:
   - "Cancel" button: stop countdown, keep waiting
   - "Kill Switch Now" button: skip countdown, kill immediately
   - Wait: countdown reaches 0 → auto-trigger hard kill switch

**Heartbeat recovery:**
1. If heartbeat resumes during countdown:
   - Hide banner, cancel countdown
   - Show "Heartbeat restored" (success toast)
2. If WebSocket reconnects:
   - Resume normal heartbeat polling
   - Dismiss any warnings

#### Form Validation (Client-Side)

**Protections form:**
- Max consecutive losses: required, positive integer
  - Error: "Must be positive"
- Min stoploss: required, negative number
  - Error: "Must be negative (e.g., -0.05 for 5%)"
- Stoploss timeout: required, positive integer (minutes)
  - Error: "Must be positive"

#### Loading States

**Page load:**
1. Show skeleton loaders for:
   - Bot status cards (3 cards)
   - Protections section (4 items)
   - Heartbeat indicator (1 item)
2. Show "Loading risk settings..." (info toast)

**Kill switch execution:**
1. Show modal: "Stopping bot..."
2. Show progress: "Layer 1 (Orchestrator API)..." spinner
3. If Layer 1 times out: "Layer 2 (Direct API)..." spinner
4. If Layer 2 times out: "Layer 3 (Emergency stop)..." spinner
5. On success: modal closes, show success banner

**Protections update:**
1. "Save Protections" button disabled, shows spinner: "Saving..."
2. On success: show "Protections updated" (success toast)
3. On failure: show error toast with RETRY button

#### Empty States

| Condition | Display |
|-----------|---------|
| No protections configured | "No protections enabled. Add at least one protection." |
| Protections disabled | "Protections are disabled. Enable to use." (toggle) |
| No heartbeat data | "Heartbeat not yet available. Check back soon." |

#### Kill Switch UI States

**States:**
1. **Ready** (normal): Red button, clickable
2. **Executing**: Gray button, spinner, "Stopping bot..."
3. **Success**: Green button, checkmark, "Bot stopped"
4. **Failed**: Red button with X, "Kill switch failed"
5. **Fallback**: Yellow button, "Attempting fallback stop..."

**After kill switch:**
1. Disable all other buttons on Risk page for 10s
2. Show countdown: "Bot starting in 10s..." (can restart now if needed)
3. User can click "Restart Bot" to begin recovery

---

### Page 7: Settings (`/settings`)

**Primary API endpoints:**
- GET `/api/v1/config` (fetch current config.json)
- PUT `/api/v1/config` (save updated config.json)
- POST `/api/v1/config/validate` (validate config syntax/values)
- GET `/api/v1/config/schema` (fetch JSON schema for form generation)

#### Error Scenarios

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Config load fails (500) | Critical | Show "Unable to load settings" | RETRY button |
| Config schema fails | Critical | Show "Unable to load form" | RETRY button |
| Validation fails (schema) | Non-critical | Show "Invalid configuration" with details | User fixes and retries |
| Validation fails (semantic) | Non-critical | Show "Invalid parameter value: X must be > 0" | User fixes and retries |
| Save fails (409 conflict) | Non-critical | Show "Configuration changed by another user. Reload?" | User reloads or merges changes |
| Save fails (500) | Non-critical | Show "Unable to save configuration" toast | RETRY button |
| Unsaved changes (page navigation) | Warning | Show confirmation modal: "Discard unsaved changes?" | User confirms or goes back |
| Invalid JSON in text editor | Non-critical | Show "Invalid JSON" in editor | User fixes syntax |
| Backup fails | Non-critical | Show "Unable to create backup" (warning toast) | User can retry |
| Restore fails | Non-critical | Show "Unable to restore backup" (warning toast) | User can try different backup |

#### Form Validation (Client-Side)

Settings has two modes:
1. **Form mode**: Visual form with validated inputs
2. **JSON mode**: Raw JSON editor with syntax checking

**Form mode validation:**
- stake_amount: required, positive number
  - Error: "Stake amount must be positive"
- pair_whitelist: required, list of pairs
  - Error: "At least one pair required"
- dry_run: required, boolean
  - No error (toggle)
- timeframe: required, select from dropdown
  - Error: "Invalid timeframe"

**JSON mode validation:**
- Real-time syntax checking (no API calls)
- Show "✓ Valid JSON" (green) or "✗ Invalid JSON: ..." (red)
- Prevent save if JSON invalid

#### Loading States

**Page load:**
1. Show skeleton loaders for:
   - All form fields
   - JSON editor placeholder
2. Show "Loading settings..." (info toast)

**Config fetch:**
1. If load takes >3s: show "Still loading configuration..." message

**Save action:**
1. "Save Settings" button disabled, shows spinner: "Saving..."
2. Before save: validate client-side
   - If invalid: show validation errors, don't submit
3. After submit:
   - POST `/api/v1/config/validate` first (validation only, no save)
   - If validation fails: show errors, enable button again
   - If validation passes: POST `/api/v1/config` (actual save)
4. On success:
   - Show "Settings saved" (success toast)
   - Mark form as clean (no unsaved changes)
5. On failure:
   - Show error toast with RETRY button
   - Keep form dirty (allow manual retry)

**Config reload:**
1. Show modal: "Reload configuration from server?"
2. If confirm: GET `/api/v1/config` (overwrite local changes)
3. Show "Configuration reloaded" (info toast)

#### Empty States

**No exchange configured:**
- Show "Configure an exchange first" message
- Show "Go to Exchange Settings" link

**Config is empty:**
- Show "Default configuration will be applied" message
- Show "Load sample config" button

#### Unsaved Changes Detection

1. Track form state (dirty flag)
2. If user navigates away without saving:
   - Show modal: "You have unsaved changes. Save?"
   - Options: "Save Now", "Discard", "Cancel"
3. If "Save Now": attempt to save (show validation errors if any)
4. If save succeeds: navigate away
5. If save fails: show error, stay on page

#### Backup & Restore

Settings page includes backup/restore functionality.

**Create backup:**
1. Button: "Backup Config"
2. On click: POST `/api/v1/config/backup`
3. Server creates backup with timestamp
4. Show "Backup created" (success toast)
5. Show in backups list: "config-2026-03-28T14:23:45Z" (with delete/restore buttons)

**Restore backup:**
1. Click "Restore" on backup
2. Show confirmation: "Restore config from [timestamp]? This will overwrite current settings."
3. On confirm: POST `/api/v1/config/restore/:timestamp`
4. Reload page with restored config
5. Show "Config restored" (success toast)

**Delete backup:**
1. Click "Delete" on backup
2. Show confirmation: "Delete backup? This cannot be undone."
3. On confirm: DELETE `/api/v1/config/backup/:timestamp`
4. Remove from list
5. Show "Backup deleted" (success toast)

#### Exchange Configuration

If exchange section fails:

1. Show "Unable to load exchange settings" in that section
2. RETRY button on that section only
3. Other sections still load normally
4. User can fix exchange settings without full page reload

#### Mode Switching (Form ↔ JSON)

1. Show toggle: "Edit mode: Form | JSON"
2. Switching from Form to JSON:
   - If form has unsaved changes:
     - Show confirmation: "Apply unsaved changes to JSON?"
     - Clicking "Yes" syncs form to JSON
     - Clicking "No" shows original JSON
3. Switching from JSON to Form:
   - If JSON invalid: show "Fix JSON syntax before switching to form mode"
   - If JSON valid: convert to form fields

---

### Page 8: FreqAI (`/freqai`)

**Primary API endpoints:**
- GET `/api/v1/freqai/config` (fetch FreqAI config section)
- PUT `/api/v1/freqai/config` (save FreqAI config)
- POST `/api/v1/freqai/validate` (validate FreqAI config)
- GET `/api/v1/freqai/models` (list trained models)
- POST `/api/v1/freqai/train` (start training)
- GET `/api/v1/freqai/train/:id` (fetch training status)

#### Error Scenarios

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| FreqAI config load fails | Critical | Show "Unable to load FreqAI settings" | RETRY button |
| FreqAI not installed | Critical | Show "FreqAI not available. Install to use." | User installs FreqAI |
| Validation fails (config) | Non-critical | Show "Invalid FreqAI configuration" with details | User fixes and retries |
| Validation fails (features) | Non-critical | Show "No valid features for prediction" | User adds more features |
| Train fails (no data) | Non-critical | Show "Unable to train: no historical data" | User needs more backtest data |
| Train fails (GPU error) | Non-critical | Show "GPU error during training. Try again or use CPU." | User retries or changes device |
| Train timeout (>1 hour) | Non-critical | Show "Training timeout" + show checkpoints so far | User can use last checkpoint |
| Models list fails | Non-critical | Show "Unable to load models" | RETRY button |
| Model delete fails | Non-critical | Show "Unable to delete model" | RETRY button |

#### Form Validation (Client-Side)

**FreqAI section:**
- Use_FreqAI: boolean toggle
- TimeRange: required if enabled, valid string (e.g., "20220101-20230101")
- Data_split_percentage: required, 0-99 number
  - Error: "Must be between 0 and 99"
- Train_size: required, positive integer
  - Error: "Must be positive"
- Test_size: required, positive integer
  - Error: "Must be positive"
- Validation_size: optional, positive integer

**Feature engineering:**
- Feature list: at least 1 feature required
  - Error: "At least one feature must be selected"
- Feature scale: required, dropdown (StandardScaler, MinMaxScaler, etc)

**Model config:**
- Model type: required, dropdown (LightGBM, XGBoost, etc)
- Learning rate: required, 0.001-1.0
  - Error: "Must be between 0.001 and 1.0"
- Max depth: required, positive integer
  - Error: "Must be positive"

#### Loading States

**Page load:**
1. Show skeleton loaders for:
   - All form fields
   - Models list (5 items)
2. Show "Loading FreqAI settings..." (info toast)

**Training:**
1. "Train Model" button disabled, shows spinner: "Starting training..."
2. After submit: show "Training in progress..."
3. Poll GET `/api/v1/freqai/train/:id` every 5s
4. Update UI: "Training progress: epoch 3/10, loss: 0.0523"
5. Show live chart of loss vs epoch (if available)
6. On completion: show "Training complete" (success toast)

**Model loading:**
1. Show skeleton loaders for models list
2. If load takes >3s: show "Still loading models..." message

#### Empty States

| Condition | Display |
|-----------|---------|
| FreqAI disabled | "Enable FreqAI to train models" (toggle) |
| No models | "No models trained yet. Create one." |
| No features selected | "Select at least one feature to train." |

#### Models List Management

**List shows for each model:**
- Model name
- Created date
- Last train loss
- Checkpoint count
- Action buttons: Load, Delete, Download

**Load model:**
1. Click "Load" on a model
2. Show confirmation: "Load model '[name]'? This will set it as active."
3. On confirm: POST `/api/v1/freqai/models/:id/load`
4. Show "Model loaded" (success toast)

**Delete model:**
1. Click "Delete" on a model
2. Show confirmation: "Delete model '[name]'? This cannot be undone."
3. On confirm: DELETE `/api/v1/freqai/models/:id`
4. Remove from list, show "Model deleted" (success toast)
5. If delete fails: show error toast with RETRY button

**Download model:**
1. Click "Download" on a model
2. Requires explicit user permission (see action_types rules)
3. Ask: "Download model file? Size: 125MB"
4. On confirm: GET `/api/v1/freqai/models/:id/download`
5. Browser downloads .zip file

#### Training Interruption

User can cancel training while it's running.

**Cancel training:**
1. Show "Cancel" button during training
2. Click: POST `/api/v1/freqai/train/:id/cancel`
3. Show "Training cancelled" (info toast)
4. Show "Last checkpoint saved" message

#### Feature Engineering Errors

**Feature validation:**
1. Show list of available features from data
2. User selects features to use
3. On "Validate Features": POST `/api/v1/freqai/validate`
4. Server checks:
   - Feature exists in data
   - Feature has sufficient variance
   - No NaN values
5. If validation fails:
   - Show "Feature validation failed"
   - List problematic features with reasons:
     - "Feature 'RSI' has > 50% NaN values"
     - "Feature 'volume' has zero variance"
   - Highlight problematic features in list

#### Reinforcement Learning Special Cases

If RL model type selected:

1. Show additional fields:
   - Reward function: code editor
   - Action space: dropdown (Discrete, Continuous)
   - Environment type: dropdown (trading, custom)

2. Validate reward function:
   - Show "Validate" button
   - POST `/api/v1/freqai/validate-reward` with code
   - Server checks syntax and returns errors
   - Highlight errors in code editor

3. Training UI shows additional info:
   - Current episode: "Episode 50/100"
   - Cumulative reward: "Total reward: 0.523"
   - Loss breakdown: "Policy loss: 0.04, Value loss: 0.02"

---

### Page 9: Data Management (`/data`)

**Primary API endpoints:**
- GET `/api/v1/data/available` (list downloaded data)
- POST `/api/v1/data/download` (start download-data)
- GET `/api/v1/data/download/:id` (fetch download progress)
- DELETE `/api/v1/data/download/:id` (delete downloaded data)
- POST `/api/v1/data/refresh` (refresh existing data)
- GET `/api/v1/data/info` (get data statistics)

#### Error Scenarios

| Scenario | Impact | UI Behavior | Recovery |
|----------|--------|-------------|----------|
| Available data list fails | Critical | Show "Unable to load available data" | RETRY button |
| Download fails (exchange error) | Non-critical | Show "Exchange error: insufficient data for pair" | User tries different pair |
| Download fails (network) | Non-critical | Show "Network error during download" | RETRY button |
| Download timeout (>1 hour) | Non-critical | Show "Download timeout" + show downloaded so far | User can resume or delete |
| Download quota exceeded | Non-critical | Show "Exchange rate limit reached. Retry in X minutes." | Wait or retry later |
| Delete data fails | Non-critical | Show "Unable to delete data" | RETRY button |
| Data info fails | Non-critical | Show "Unable to load data info" | RETRY button |
| Invalid pair format | Non-critical | Show "Invalid pair format. Use XXX/YYY" | User fixes pair name |
| Missing exchange config | Critical | Show "Configure exchange first" (link to Settings) | User configures exchange |

#### Form Validation (Client-Side)

**Download form:**
- Pair: required, format XXX/YYY
  - Error: "Invalid pair format. Use XXX/YYY (e.g., BTC/USDT)"
- Timeframe: required, dropdown (1m, 5m, 15m, 1h, etc)
- Exchange: required, dropdown
- Start date: required, date format
- End date: required, date format, End > Start
  - Error: "End date must be after start date"
- Data type: optional multi-select (OHLCV, trades, funding_rate)

#### Loading States

**Page load:**
1. Show skeleton loaders for:
   - Data list (10 items)
   - Form fields
   - Data statistics (4 stats cards)
2. Show "Loading data information..." (info toast)

**Download:**
1. "Download Data" button disabled, shows spinner: "Starting download..."
2. After submit: show "Download in progress..."
3. Poll GET `/api/v1/data/download/:id` every 2s
4. Update UI: "Downloaded: 500/2000 candles (25%)" with progress bar
5. Show estimated time remaining
6. On completion: show "Download complete" (success toast)

**Delete data:**
1. Click "Delete" on data row
2. Show confirmation: "Delete [pair] data? This cannot be undone."
3. On confirm: show "Deleting..." spinner
4. On success: remove from list, show "Data deleted" (success toast)
5. On failure: show error toast with RETRY button

**Refresh data:**
1. Click "Refresh" on data row
2. Show confirmation: "Re-download [pair] data to get latest candles?"
3. On confirm: POST `/api/v1/data/refresh` with pair/timeframe
4. Show progress: "Refreshing: 0/100 candles..."
5. On completion: show "Data refreshed" (success toast)

#### Empty States

| Condition | Display |
|-----------|---------|
| No data downloaded | "No data downloaded yet. Create a download." |
| Search returns empty | "No data matches your search." |

#### Data Download Progress

During download, show detailed progress:

```
Download Progress
─────────────────────────────
Pair: BTC/USDT (1h)
Status: Downloading
Progress: 500/2000 candles (25%)
[████░░░░░░░░░░░░░░░░░░░░░░]
Est. time: 5 minutes remaining
Download speed: 100 candles/sec
Cancel | Pause | Resume
```

**Cancel download:**
1. Click "Cancel" button
2. POST `/api/v1/data/download/:id/cancel`
3. Show "Download cancelled" (info toast)
4. Partially downloaded data kept (user can resume)

**Pause/Resume:**
1. Click "Pause": POST `/api/v1/data/download/:id/pause`
2. Button changes to "Resume"
3. Click "Resume": POST `/api/v1/data/download/:id/resume`
4. Continue from last downloaded candle

#### Data Statistics

Show for each downloaded pair:

```
BTC/USDT (1h)
─────────────────────────────
Size: 125 MB
Candles: 8,500
Date range: 2022-01-01 to 2026-03-28
Gaps: 2 (missing 1h on 2023-01-15, 2h on 2024-06-20)
Last updated: 2 hours ago
Status: ✓ Complete
```

**If data incomplete:**
- Show warning icon: "Data incomplete"
- Show "Fill gaps" button: POST `/api/v1/data/download/:id/fill-gaps`
- Show reason: "Missing 10 candles from 2023-01-15"

#### Batch Operations

Allow multiple data downloads/refreshes in one request.

**Select multiple:**
1. Show checkboxes on each data row
2. "Select all" checkbox at top
3. Bulk action buttons: "Download All", "Delete All", "Refresh All"

**Bulk download:**
1. User selects multiple pairs
2. Click "Download All"
3. Show "Queued 5 downloads" (info toast)
4. Start them sequentially (not in parallel)
5. Show progress for current download
6. Show queue: "1/5 BTC/USDT (in progress), 2/5 ETH/USDT (queued)..."
7. On each completion: move to next
8. Show final: "All 5 downloads complete" (success toast)

#### Utility Subcommands

Show buttons for FreqTrade utility commands:

1. **Rebuild cache**
   - Button: "Rebuild indicator cache"
   - POST `/api/v1/data/rebuild-cache`
   - Show "Rebuilding cache..." spinner
   - Show "Cache rebuilt" on success

2. **List exchanges**
   - Button: "Show available exchanges"
   - GET `/api/v1/data/exchanges`
   - Show modal with list of exchanges

3. **Plot config**
   - Button: "Show plot configuration"
   - GET `/api/v1/data/plot-config`
   - Show JSON in modal

---

## AUTHENTICATION & SESSION ERRORS

### Token Expiration

**While user is active:**
1. Before each API call, check if token expires in <5 minutes
2. If expired: refresh token automatically (POST `/api/v1/refresh`)
3. User doesn't notice (silent refresh)

**While user is idle:**
1. If user returns after >1 hour:
   - Token may be expired
   - First API call fails with 401
   - Catch 401: redirect to /login
   - Show "Your session has expired. Please log in again."

**During form submission:**
1. If token expires while form is being filled:
   - Form is still editable (no error yet)
   - When user clicks "Save": token is refreshed (transparent)
   - Form saves normally

2. If token refresh fails during form submission:
   - Clear form changes (undo)
   - Redirect to /login
   - Show "Session expired while saving. Please log in again."

### Forced Session Revocation

Admin can revoke a user's session.

**During normal operation:**
1. Next API call returns 401 with code "SESSION_REVOKED"
2. Clear all tokens
3. Redirect to /login
4. Show "Your session has been revoked by an administrator. Contact support if you believe this is an error."

**If user has multiple tabs open:**
1. First tab to make API call gets 401
2. Clears localStorage (tokens)
3. All other tabs also lose tokens on next API call
4. All tabs redirect to /login

### Concurrent Login Prevention

Prevent same user from logging in on multiple devices.

**Behavior:**
1. User A logs in on Device 1 (gets token A1)
2. User A logs in on Device 2 (gets token A2)
3. Device 1 makes API call: succeeds (A1 still valid)
4. Admin sees User A logged in from 2 devices
5. Admin revokes A1 token
6. Device 1 gets 401 on next API call → redirect to /login
7. Device 2 continues with A2 token (unaffected)

---

## WEBSOCKET ERROR HANDLING

WebSocket is used for heartbeat polling (3s interval) and real-time status updates.

### Connection Errors

**Initial connection fails:**
1. User opens dashboard
2. WebSocket tries to connect (ws://api/ws/status)
3. Connection fails (server down, CORS error, etc)
4. Fallback to HTTP polling (GET `/api/v1/status` every 10s)
5. Show yellow banner: "Real-time updates unavailable. Using periodic updates."
6. Continue attempting WebSocket reconnection every 30s

**Connection drops mid-session:**
1. WebSocket was connected (receiving updates)
2. Server closes connection (network issue, server restart)
3. Client detects disconnect (onclose event)
4. Start reconnection backoff: 2s, 4s, 8s, 16s, max 30s
5. Show yellow banner: "Connection lost. Reconnecting..."
6. On reconnect: hide banner, resume real-time updates

### Message Errors

**Server sends error message:**
1. WebSocket message: `{ type: "error", code: "...", message: "..." }`
2. Handle by code:
   ```
   AUTH_FAILED:
     → Force logout (same as 401)

   RATE_LIMIT:
     → Throttle polling: 3s → 5s for 1 minute
     → Show "Rate limited" toast

   HEARTBEAT_FAILURE:
     → Start kill switch countdown (see Risk section)

   INTERNAL_ERROR:
     → Show "Server error" toast
     → Fallback to HTTP polling
     → Retry WebSocket in 30s

   UNKNOWN:
     → Log to console
     → Show "Unexpected error" toast
     → Continue polling
   ```

### Stale Data During Disconnection

When WebSocket is disconnected:

1. Dashboard shows last known data
2. Add banner: "Showing last known status (X minutes ago)"
3. Add "Refresh now" button: manual HTTP GET
4. Continue displaying data with "STALE" indicator
5. Auto-retry WebSocket connection every 30s
6. When WebSocket reconnects: remove "STALE" indicator

### Data Sync After Reconnection

After WebSocket reconnects:

1. Send full status refresh: GET `/api/v1/status`
2. Compare with cached data
3. If data changed:
   - Update UI smoothly (no jarring transitions)
   - Show "Data updated" (brief info toast)
4. If data same:
   - No toast (silent update)
5. Resume normal polling

---

## RATE LIMITING

Orchestrator implements per-user rate limiting.

### Rate Limit Headers

Every response includes:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1711616400  (Unix timestamp)
```

### Client Behavior

**Monitor rate limit:**
1. After each API call, check headers
2. If `Remaining < Limit * 0.2` (less than 20%):
   - Show warning toast: "High API usage. Requests may be rate limited."
   - Increase polling intervals (dashboard: 10s → 20s)
   - User can dismiss warning (does NOT reset interval)

**When rate limited (429 response):**
1. Extract `X-RateLimit-Reset` header
2. Calculate wait time: `Reset - now()`
3. Show countdown: "Rate limited. Retrying in 45 seconds..."
4. Wait until that timestamp before retrying
5. Auto-retry request after countdown
6. On success: resume normal polling, show "Rate limit cleared" toast

**Adaptive backoff:**
1. If consistently hitting rate limit:
   - Reduce polling frequency globally
   - Dashboard: 10s → 20s → 30s
   - WebSocket: 3s → 5s → 10s
2. Show banner: "API overloaded. Switching to slower updates."
3. When rate limit clears: gradually resume normal frequency

---

## ERROR LOGGING & AUDIT TRAIL

All errors are logged for debugging and compliance.

### Audit Log Entry

When error occurs:

```
POST /api/v1/audit
{
  "timestamp": "2026-03-28T14:23:45Z",
  "user_id": "user123",
  "action": "API_ERROR",
  "endpoint": "GET /api/v1/status",
  "status_code": 500,
  "error_message": "Database connection timeout",
  "error_stack": "...",
  "client_info": {
    "browser": "Chrome 98",
    "page": "/dashboard"
  }
}
```

**What's logged:**
- ✅ API errors (4xx, 5xx)
- ✅ Network errors (timeouts, disconnects)
- ✅ Form validation errors
- ✅ Kill switch activations
- ✅ Authentication failures
- ✅ WebSocket errors
- ❌ Client-side form display errors (non-critical)
- ❌ Hover/tooltip errors (non-critical)

### Error Boundaries Logging

When ErrorBoundary catches error:

```
POST /api/v1/audit
{
  "timestamp": "2026-03-28T14:23:45Z",
  "user_id": "user123",
  "action": "ERROR_BOUNDARY",
  "page": "/dashboard",
  "error_message": "Cannot read property 'trades' of undefined",
  "error_stack": "...",
  "component": "TradesTable"
}
```

---

## RECOVERY STRATEGIES

### Automatic Recovery

Some errors auto-recover without user intervention:

1. **Transient network errors:**
   - Timeout, connection refused → auto-retry after 2-5s
   - Up to 3 retries with exponential backoff

2. **Token expiration:**
   - Auto-refresh token before expiry
   - Silent to user

3. **WebSocket disconnection:**
   - Auto-reconnect with backoff
   - Resume polling

4. **Rate limiting:**
   - Wait until `X-RateLimit-Reset`, then auto-retry

### Manual Recovery

Some errors require user action:

1. **Authentication errors (401, 403):**
   - Redirect to /login
   - User must log in again

2. **Validation errors:**
   - Show validation message
   - User must fix and retry

3. **Resource not found (404):**
   - Show error message
   - No retry (resource doesn't exist)

4. **Kill switch failed:**
   - Show critical error
   - User must investigate or call support

5. **Configuration errors:**
   - Show validation errors
   - User must fix and retry

### Admin Recovery

Some errors require admin intervention:

1. **Kill switch permanently failed:**
   - Show "CRITICAL" error
   - Email ops team
   - Admin must manually stop bots

2. **Orchestrator down:**
   - Show "Server unavailable" message
   - Admin must restart Orchestrator

3. **Persistent rate limiting:**
   - Show "API overloaded" message
   - Admin must scale API or adjust rate limits

---

## TESTING ERROR SCENARIOS

### Test Cases for Each Error Type

| Error | Test Scenario | How to Trigger |
|-------|---------------|----------------|
| 401 Unauthorized | Login with wrong password | Enter wrong credentials |
| 403 Forbidden | User without permission | Try to access restricted endpoint |
| 404 Not Found | Fetch missing resource | Request non-existent strategy |
| 500 Server Error | Backend error | Trigger error on server (e.g., /error endpoint) |
| 429 Rate Limited | Exceed rate limit | Spam requests rapidly |
| Timeout | Slow network | Mock slow API response (>5s) |
| WebSocket disconnect | Network failure | Kill WebSocket connection |
| Validation error | Invalid form input | Submit form with invalid data |
| Partial failure | Some APIs work, others fail | Stop one FreqTrade bot, others running |
| Token expiration | Token expires during use | Wait for token to expire (or mock) |

### Manual Testing Checklist

- [ ] All 404 errors redirect to not found page
- [ ] All 401 errors redirect to login
- [ ] All 500 errors show retry button
- [ ] Kill switch works even when API is down
- [ ] WebSocket reconnects after disconnect
- [ ] Form validation shows before API call
- [ ] Stale data marked as stale (if auto-refresh fails)
- [ ] Toast notifications stack properly
- [ ] Error modals show error details
- [ ] Audit log captures all errors

---

## SUMMARY TABLE

| Error Category | Handling | UI Behavior | Recovery |
|---|---|---|---|
| **API Errors** | Show toast + details | "Error: Server not responding" | RETRY button |
| **Auth Errors** | Redirect to login | "Session expired" | Login again |
| **Network Errors** | Auto-retry up to 3x | "Connection error" | Wait or RETRY |
| **Validation Errors** | Show inline messages | Red text on field | Fix and resubmit |
| **Kill Switch Errors** | Show critical + fallback | "Kill switch activated" | Layers 1-2-3 |
| **WebSocket Errors** | Fallback to HTTP | "Real-time unavailable" | Auto-reconnect |
| **Rate Limiting** | Wait until reset | Countdown timer | Auto-retry |
| **Timeout Errors** | Show stale data | "Last update 5min ago" | Manual refresh |
| **Partial Failures** | Show affected sections | Mix of success + error | Retry failed sections |
| **Empty States** | Show helpful message | "No data yet" | Create/configure |

---

**END OF ERROR_HANDLING.md**
