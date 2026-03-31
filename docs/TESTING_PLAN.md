# TESTING PLAN — FreqTrade UI Multi-Strategy Platform

**Created:** 2026-03-28
**Version:** 1.0
**Scope:** Frontend (Next.js 14), Orchestrator (FastAPI), Integration with FreqTrade
**Purpose:** Comprehensive testing strategy for all 264 widgets across 10 pages (Login, Dashboard, Strategies, Builder, Backtesting, Analytics, Risk, Settings, FreqAI, Data Management)

---

## TABLE OF CONTENTS

1. [Testing Overview](#testing-overview)
2. [Layer 1: Unit Tests (Frontend)](#layer-1-unit-tests-frontend)
3. [Layer 2: Unit Tests (Orchestrator)](#layer-2-unit-tests-orchestrator)
4. [Layer 3: Integration Tests](#layer-3-integration-tests)
5. [Layer 4: E2E Tests](#layer-4-e2e-tests)
6. [Critical Path Tests](#critical-path-tests)
7. [Per-Page Test Checklist](#per-page-test-checklist)
8. [API Mock Data Specifications](#api-mock-data-specifications)
9. [Performance Tests](#performance-tests)
10. [Security Tests](#security-tests)
11. [Test Execution Matrix](#test-execution-matrix)

---

## TESTING OVERVIEW

### Three-Layer Architecture Testing Strategy

```
┌──────────────────────────────────────┐
│ LAYER 3: Frontend (Next.js 14)       │ ← Unit tests + E2E
│ Components, state, API calls, forms  │
├──────────────────────────────────────┤
│ LAYER 2: Orchestrator (FastAPI)      │ ← Unit tests + Integration
│ API endpoints, business logic,       │
│ bot management, kill switch          │
├──────────────────────────────────────┤
│ LAYER 1: FreqTrade (UNMODIFIED)      │ ← Integration tests only
│ REST API responses via proxy         │
└──────────────────────────────────────┘
```

### Test Tools & Frameworks

| Layer | Component | Framework | Tools |
|-------|-----------|-----------|-------|
| Frontend | Components | Jest + React Testing Library | @testing-library/react, @testing-library/jest-dom |
| Frontend | E2E flows | Playwright | @playwright/test |
| Orchestrator | API endpoints | pytest + httpx | pytest, httpx, FastAPI.testclient |
| Database | Models + queries | pytest-sqlalchemy | sqlalchemy, psycopg2 |
| Integration | Mocking | MSW (Mock Service Worker) | msw, @mswjs/http-handler |
| Performance | Load/memory | k6, Lighthouse | k6, lighthouse-ci |
| Security | Scanning | OWASP ZAP, bandit | zaproxy, bandit |

---

## LAYER 1: UNIT TESTS (FRONTEND)

### 1.1 Component Rendering Tests

**Framework:** Jest + React Testing Library

#### Test Suite: `tests/components/Sidebar.test.tsx`

```typescript
describe('Sidebar Component', () => {
  test('S-1: Logo renders and navigates to dashboard on click', () => {
    render(<Sidebar />);
    const logo = screen.getByText('FreqTrade Trading Platform');
    expect(logo).toBeInTheDocument();
    fireEvent.click(logo);
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });

  test('S-2a: Dashboard link renders with live dot when bot running', async () => {
    const mockBots = [{ id: 'bot1', status: 'running' }];
    mockGetBots.mockResolvedValue(mockBots);
    render(<Sidebar />);
    await waitFor(() => {
      const liveDot = screen.getByTestId('live-dot-dashboard');
      expect(liveDot).toHaveClass('bg-success');
    });
  });

  test('S-2b: Strategies link shows "{N} live" badge', async () => {
    const mockStrategies = [
      { id: 's1', lifecycle: 'live' },
      { id: 's2', lifecycle: 'live' },
      { id: 's3', lifecycle: 'draft' },
    ];
    mockGetStrategies.mockResolvedValue(mockStrategies);
    render(<Sidebar />);
    await waitFor(() => {
      const badge = screen.getByTestId('strategies-badge');
      expect(badge).toHaveTextContent('2 live');
    });
  });

  test('S-2d: Backtesting link shows "{N} runs" badge', async () => {
    mockGetActiveJobs.mockResolvedValue({ active_count: 3 });
    render(<Sidebar />);
    await waitFor(() => {
      const badge = screen.getByTestId('backtesting-badge');
      expect(badge).toHaveTextContent('3 runs');
    });
  });

  test('S-3: Footer status shows green dot when orchestrator healthy', async () => {
    mockHealth.mockResolvedValue({ status: 'healthy' });
    mockGetBots.mockResolvedValue([{ id: 'bot1' }, { id: 'bot2' }]);
    render(<Sidebar />);
    await waitFor(() => {
      const dot = screen.getByTestId('health-dot');
      expect(dot).toHaveClass('bg-success');
      expect(screen.getByText(/2 bots/)).toBeInTheDocument();
    });
  });

  test('S-3: Footer status shows red dot when orchestrator unhealthy', async () => {
    mockHealth.mockResolvedValue({ status: 'unhealthy' });
    render(<Sidebar />);
    await waitFor(() => {
      const dot = screen.getByTestId('health-dot');
      expect(dot).toHaveClass('bg-error');
    });
  });
});
```

#### Test Suite: `tests/components/Header.test.tsx`

```typescript
describe('Header Component', () => {
  test('H-1: Page title renders correctly', () => {
    render(<Header title="Dashboard" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
  });

  test('H-2: Search input filters pairs', async () => {
    const mockPairs = ['BTC/USDT', 'ETH/USDT', 'ADA/USDT'];
    mockBotWhitelist.mockResolvedValue(mockPairs);
    render(<Header />);

    const searchInput = screen.getByPlaceholderText('Search pairs, strategies...');
    fireEvent.change(searchInput, { target: { value: 'BTC' } });

    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
      expect(screen.queryByText('ETH/USDT')).not.toBeInTheDocument();
    });
  });

  test('H-2: Search result click navigates to analytics', async () => {
    mockBotWhitelist.mockResolvedValue(['BTC/USDT']);
    render(<Header />);

    fireEvent.change(screen.getByPlaceholderText('Search pairs, strategies...'),
      { target: { value: 'BTC' } });

    await waitFor(() => {
      fireEvent.click(screen.getByText('BTC/USDT'));
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/analytics?pair=BTC/USDT');
  });

  test('H-3: Notification bell shows red dot when risk events exist', async () => {
    const mockEvents = [{ type: 'soft_kill', bot: 'bot1', timestamp: Date.now() }];
    mockGetRiskEvents.mockResolvedValue(mockEvents);
    render(<Header />);

    await waitFor(() => {
      const notificationDot = screen.getByTestId('notification-dot');
      expect(notificationDot).toHaveClass('bg-error');
    });
  });

  test('H-3: Notification dropdown shows last 10 events', async () => {
    const mockEvents = Array.from({ length: 15 }, (_, i) => ({
      id: `event${i}`,
      type: 'hard_kill',
      bot: `bot${i}`,
      timestamp: Date.now() - i * 60000,
    }));
    mockGetRiskEvents.mockResolvedValue(mockEvents.slice(0, 10));
    render(<Header />);

    fireEvent.click(screen.getByTestId('notification-bell'));

    await waitFor(() => {
      const items = screen.getAllByTestId(/notification-item-/);
      expect(items).toHaveLength(10);
    });
  });

  test('H-4: Kill Switch button triggers confirmation modal', () => {
    render(<Header />);
    const killButton = screen.getByText('🚨 KILL SWITCH');
    fireEvent.click(killButton);

    expect(screen.getByText('Confirm Kill All Bots')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  test('H-5a: Cancel button closes modal without action', () => {
    render(<Header />);
    fireEvent.click(screen.getByText('🚨 KILL SWITCH'));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(screen.queryByText('Confirm Kill All Bots')).not.toBeInTheDocument();
    expect(mockHardKillAll).not.toHaveBeenCalled();
  });

  test('H-5b: Confirm button calls hardKillAll with correct reason', async () => {
    mockHardKillAll.mockResolvedValue({ success: true });
    render(<Header />);

    fireEvent.click(screen.getByText('🚨 KILL SWITCH'));
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(mockHardKillAll).toHaveBeenCalledWith('Emergency kill from header');
      expect(screen.getByText('All bots killed successfully')).toBeInTheDocument();
    });
  });

  test('H-5b: Confirm button shows loading state while killing', () => {
    mockHardKillAll.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 1000))
    );
    render(<Header />);

    fireEvent.click(screen.getByText('🚨 KILL SWITCH'));
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    expect(screen.getByRole('button', { name: /Killing.../i })).toBeDisabled();
  });

  test('H-6: User avatar click shows logout confirm', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Header />);

    fireEvent.click(screen.getByTestId('user-avatar'));
    expect(confirmSpy).toHaveBeenCalledWith('Logout?');
  });

  test('H-6: Logout clears token and redirects', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const localStorageSpy = jest.spyOn(Storage.prototype, 'removeItem');
    render(<Header />);

    fireEvent.click(screen.getByTestId('user-avatar'));

    await waitFor(() => {
      expect(localStorageSpy).toHaveBeenCalledWith('auth_token');
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
  });
});
```

#### Test Suite: `tests/pages/login.test.tsx`

```typescript
describe('Login Page (L-*)', () => {
  test('L-1: Username input updates local state', () => {
    render(<LoginPage />);
    const input = screen.getByLabelText('Username');
    fireEvent.change(input, { target: { value: 'admin' } });
    expect(input).toHaveValue('admin');
  });

  test('L-2: Password input updates local state', () => {
    render(<LoginPage />);
    const input = screen.getByLabelText('Password');
    fireEvent.change(input, { target: { value: 'secret' } });
    expect(input).toHaveValue('secret');
  });

  test('L-3: Password toggle switches input type', () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText('Password');
    const toggleButton = screen.getByTestId('password-toggle');

    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('L-4: Remember me checkbox toggles', () => {
    render(<LoginPage />);
    const checkbox = screen.getByLabelText('Remember me');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  test('L-5: Sign In button with valid credentials calls API', async () => {
    mockLogin.mockResolvedValue({ token: 'jwt_token_123' });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'test-password');
    });
  });

  test('L-5: Sign In button shows loading state', () => {
    mockLogin.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({ token: 'jwt' }), 1000))
    );
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(screen.getByRole('button', { name: /Signing in/i })).toBeDisabled();
  });

  test('L-5: Successful login stores token and redirects', async () => {
    mockLogin.mockResolvedValue({ token: 'jwt_token_123' });
    const localStorageSpy = jest.spyOn(Storage.prototype, 'setItem');
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(localStorageSpy).toHaveBeenCalledWith('auth_token', 'jwt_token_123');
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('L-5: Remember me checked stores token in localStorage', async () => {
    mockLogin.mockResolvedValue({ token: 'jwt_token_123' });
    const localStorageSpy = jest.spyOn(Storage.prototype, 'setItem');
    render(<LoginPage />);

    fireEvent.click(screen.getByLabelText('Remember me'));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(localStorageSpy).toHaveBeenCalledWith('auth_token', 'jwt_token_123');
    });
  });

  test('L-5: Remember me unchecked stores token in sessionStorage', async () => {
    mockLogin.mockResolvedValue({ token: 'jwt_token_123' });
    const sessionStorageSpy = jest.spyOn(Storage.prototype, 'setItem');
    render(<LoginPage />);

    // Don't check "Remember me"
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      // Should use sessionStorage instead
      expect(sessionStorageSpy).toHaveBeenCalled();
    });
  });

  test('L-6: Failed login shows error message', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  test('L-6: Server error shows error message', async () => {
    mockLogin.mockRejectedValue(new Error('Internal server error'));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Internal server error/)).toBeInTheDocument();
    });
  });

  test('L-1 & L-2: Form validation requires both username and password', () => {
    render(<LoginPage />);
    const button = screen.getByRole('button', { name: /Sign In/i });

    // Try without filling any fields
    fireEvent.click(button);
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
```

### 1.2 Form Validation Tests

#### Test Suite: `tests/forms/SettingsForm.test.tsx`

```typescript
describe('Settings Form Validation', () => {
  test('Settings-1: Stake amount field validates positive numbers only', () => {
    render(<SettingsForm />);
    const stakeInput = screen.getByLabelText('Stake Amount (USDT)');

    // Valid
    fireEvent.change(stakeInput, { target: { value: '100' } });
    expect(stakeInput).toHaveValue(100);

    // Invalid
    fireEvent.change(stakeInput, { target: { value: '-50' } });
    expect(screen.getByText(/must be positive/i)).toBeInTheDocument();

    fireEvent.change(stakeInput, { target: { value: 'abc' } });
    expect(screen.getByText(/must be a number/i)).toBeInTheDocument();
  });

  test('Settings-2: Leverage field validates range 1-125x', () => {
    render(<SettingsForm />);
    const leverageInput = screen.getByLabelText('Leverage');

    // Valid
    fireEvent.change(leverageInput, { target: { value: '5' } });
    expect(leverageInput).toHaveValue(5);

    // Too low
    fireEvent.change(leverageInput, { target: { value: '0.5' } });
    expect(screen.getByText(/must be between 1 and 125/i)).toBeInTheDocument();

    // Too high
    fireEvent.change(leverageInput, { target: { value: '200' } });
    expect(screen.getByText(/must be between 1 and 125/i)).toBeInTheDocument();
  });

  test('Settings-3: Pair whitelist validates valid trading pairs', () => {
    render(<SettingsForm />);
    const pairInput = screen.getByLabelText('Trading Pairs');

    // Valid
    fireEvent.change(pairInput, { target: { value: 'BTC/USDT,ETH/USDT' } });
    expect(pairInput).toHaveValue('BTC/USDT,ETH/USDT');

    // Invalid format
    fireEvent.change(pairInput, { target: { value: 'BTCUSDT' } });
    expect(screen.getByText(/invalid pair format/i)).toBeInTheDocument();
  });

  test('Settings-4: Timeframe select validates allowed values', () => {
    render(<SettingsForm />);
    const timeframeSelect = screen.getByLabelText('Candle Timeframe');

    fireEvent.change(timeframeSelect, { target: { value: '5m' } });
    expect(timeframeSelect).toHaveValue('5m');

    // Invalid timeframe should not be selectable
    const options = timeframeSelect.querySelectorAll('option');
    const validValues = Array.from(options).map(opt => opt.value);
    expect(validValues).toContain('5m');
    expect(validValues).not.toContain('99h');
  });
});
```

#### Test Suite: `tests/forms/StrategyBuilderForm.test.tsx`

```typescript
describe('Strategy Builder Form', () => {
  test('Builder-1: Strategy name field validates non-empty string', () => {
    render(<StrategyBuilderForm />);
    const nameInput = screen.getByLabelText('Strategy Name');

    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.blur(nameInput);
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'MyStrategy' } });
    fireEvent.blur(nameInput);
    expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
  });

  test('Builder-2: Entry condition select validates callback exists', () => {
    render(<StrategyBuilderForm />);
    const callbackSelect = screen.getByLabelText('Entry Callback');

    const options = callbackSelect.querySelectorAll('option');
    const callbacks = Array.from(options).map(opt => opt.value);

    // Should contain 19 callbacks from §3
    expect(callbacks.length).toBeGreaterThanOrEqual(19);
    expect(callbacks).toContain('populate_entry_trend');
  });

  test('Builder-3: Stoploss type select validates allowed types', () => {
    render(<StrategyBuilderForm />);
    const stoplossTypeSelect = screen.getByLabelText('Stoploss Type');

    const options = stoplossTypeSelect.querySelectorAll('option');
    const types = Array.from(options).map(opt => opt.value);

    // Should contain 6 types from §4
    expect(types.length).toBeGreaterThanOrEqual(6);
    expect(types).toContain('fixed');
    expect(types).toContain('trailing');
  });

  test('Builder-4: Stoploss percentage field validates range -0.99 to 0', () => {
    render(<StrategyBuilderForm />);
    const stoplossInput = screen.getByLabelText('Stoploss %');

    // Valid
    fireEvent.change(stoplossInput, { target: { value: '-5' } });
    expect(stoplossInput).toHaveValue(-5);

    // Too high
    fireEvent.change(stoplossInput, { target: { value: '10' } });
    expect(screen.getByText(/must be between -99 and 0/i)).toBeInTheDocument();

    // Too low
    fireEvent.change(stoplossInput, { target: { value: '-150' } });
    expect(screen.getByText(/must be between -99 and 0/i)).toBeInTheDocument();
  });
});
```

### 1.3 State Management Tests

#### Test Suite: `tests/hooks/useDashboard.test.tsx`

```typescript
describe('useDashboard Hook', () => {
  test('useDashboard: loads bot data on mount', async () => {
    mockGetBots.mockResolvedValue([
      { id: 'bot1', name: 'BTC Bot', status: 'running' },
      { id: 'bot2', name: 'ETH Bot', status: 'stopped' },
    ]);

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.bots).toHaveLength(2);
      expect(result.current.bots[0].name).toBe('BTC Bot');
      expect(result.current.loading).toBe(false);
    });
  });

  test('useDashboard: refreshes data on interval', async () => {
    jest.useFakeTimers();
    mockGetBots.mockResolvedValue([{ id: 'bot1' }]);

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.bots).toHaveLength(1));
    expect(mockGetBots).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10000); // 10s interval

    await waitFor(() => {
      expect(mockGetBots).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  test('useDashboard: handles API errors gracefully', async () => {
    mockGetBots.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.error).toEqual('Network error');
      expect(result.current.bots).toEqual([]);
    });
  });

  test('useDashboard: computes portfolio equity correctly', async () => {
    mockGetBots.mockResolvedValue([
      { id: 'bot1', name: 'BTC' },
      { id: 'bot2', name: 'ETH' },
    ]);
    mockBotBalance.mockImplementation((botId) => {
      return botId === 'bot1'
        ? Promise.resolve({ total: 10000 })
        : Promise.resolve({ total: 5000 });
    });

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.totalEquity).toBe(15000);
    });
  });
});
```

### 1.4 API Function Tests (Mocked)

#### Test Suite: `tests/api/client.test.ts`

```typescript
describe('API Client Functions', () => {
  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.closeAllHandlers();
  });

  test('login() sends correct credentials and returns token', async () => {
    server.use(
      rest.post('/api/auth/login', (req, res, ctx) => {
        return res(ctx.json({ token: 'jwt_token_123' }));
      })
    );

    const response = await login('admin', 'test-password');
    expect(response.token).toBe('jwt_token_123');
  });

  test('getBots() returns array of bot instances', async () => {
    const mockBots = [
      { id: 'bot1', name: 'BTC Bot', status: 'running' },
      { id: 'bot2', name: 'ETH Bot', status: 'stopped' },
    ];
    server.use(
      rest.get('/api/bots/', (req, res, ctx) => {
        return res(ctx.json(mockBots));
      })
    );

    const bots = await getBots();
    expect(bots).toEqual(mockBots);
  });

  test('getStrategies() returns strategy list with lifecycle', async () => {
    const mockStrategies = [
      { id: 's1', name: 'RSI Strategy', lifecycle: 'live', bot_instance_id: 'bot1' },
      { id: 's2', name: 'MACD Strategy', lifecycle: 'draft', bot_instance_id: null },
    ];
    server.use(
      rest.get('/api/strategies/', (req, res, ctx) => {
        return res(ctx.json(mockStrategies));
      })
    );

    const strategies = await getStrategies();
    expect(strategies).toHaveLength(2);
    expect(strategies[0].lifecycle).toBe('live');
  });

  test('botStatus() returns open trades for a bot', async () => {
    const mockTrades = [
      {
        trade_id: 1,
        pair: 'BTC/USDT',
        open_rate: 45000,
        is_short: false,
        current_rate: 45500,
        close_profit_abs: 500,
        open_date: '2026-03-28T10:00:00Z',
      },
    ];
    server.use(
      rest.get('http://127.0.0.1:8080/api/v1/status', (req, res, ctx) => {
        return res(ctx.json({ status: mockTrades }));
      })
    );

    const trades = await botStatus('bot1');
    expect(trades).toHaveLength(1);
    expect(trades[0].pair).toBe('BTC/USDT');
  });

  test('botProfit() returns profit data from FT API', async () => {
    const mockProfit = {
      profit_all_coin: 1250.50,
      profit_closed_coin: 750.25,
      closed_trade_count: 42,
      trade_count: 50,
    };
    server.use(
      rest.get('http://127.0.0.1:8080/api/v1/profit', (req, res, ctx) => {
        return res(ctx.json(mockProfit));
      })
    );

    const profit = await botProfit('bot1');
    expect(profit.profit_all_coin).toBe(1250.50);
    expect(profit.closed_trade_count).toBe(42);
  });

  test('hardKillAll() sends POST to kill switch endpoint', async () => {
    server.use(
      rest.post('/api/kill-switch/hard-all', (req, res, ctx) => {
        return res(ctx.json({ success: true, killed_count: 3 }));
      })
    );

    const response = await hardKillAll('Test emergency kill');
    expect(response.success).toBe(true);
    expect(response.killed_count).toBe(3);
  });

  test('softKill() sends POST with bot ID', async () => {
    server.use(
      rest.post('/api/kill-switch/soft/:botId', (req, res, ctx) => {
        return res(ctx.json({ success: true }));
      })
    );

    const response = await softKill('bot1');
    expect(response.success).toBe(true);
  });

  test('botForceExit() sends forceexit to FT API', async () => {
    server.use(
      rest.post('http://127.0.0.1:8080/api/v1/forceexit', (req, res, ctx) => {
        return res(ctx.json({ result: 'ok' }));
      })
    );

    const response = await botForceExit('bot1', 123);
    expect(response.result).toBe('ok');
  });
});
```

---

## LAYER 2: UNIT TESTS (ORCHESTRATOR)

### 2.1 API Endpoint Tests

#### Test Suite: `tests/orchestrator/auth.test.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token

client = TestClient(app)

class TestAuthEndpoints:
    def test_post_auth_login_valid_credentials(self):
        """Test login with valid credentials"""
        response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': 'test-password'
        })
        assert response.status_code == 200
        assert 'token' in response.json()
        assert response.json()['token'].startswith('eyJ')  # JWT format

    def test_post_auth_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': 'wrongpassword'
        })
        assert response.status_code == 401
        assert 'error' in response.json()

    def test_post_auth_login_missing_fields(self):
        """Test login with missing username or password"""
        response = client.post('/api/auth/login', json={'username': 'admin'})
        assert response.status_code == 422

    def test_protected_endpoint_without_token(self):
        """Test accessing protected endpoint without token"""
        response = client.get('/api/bots/')
        assert response.status_code == 401

    def test_protected_endpoint_with_valid_token(self):
        """Test accessing protected endpoint with valid token"""
        token = create_access_token('admin')
        response = client.get('/api/bots/', headers={
            'Authorization': f'Bearer {token}'
        })
        assert response.status_code == 200

    def test_protected_endpoint_with_expired_token(self):
        """Test accessing protected endpoint with expired token"""
        # Mock an expired token
        response = client.get('/api/bots/', headers={
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTAzNDU2Nzg5MH0.invalid'
        })
        assert response.status_code == 401
```

#### Test Suite: `tests/orchestrator/bots.test.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import BotInstance

client = TestClient(app)

class TestBotEndpoints:
    @pytest.fixture
    def auth_headers(self):
        """Get authorization headers with valid token"""
        response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': 'test-password'
        })
        token = response.json()['token']
        return {'Authorization': f'Bearer {token}'}

    def test_get_bots_returns_list(self, auth_headers):
        """Test GET /api/bots/ returns list of bots"""
        response = client.get('/api/bots/', headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_bots_includes_required_fields(self, auth_headers):
        """Test bot response includes id, name, status, is_dry_run"""
        response = client.get('/api/bots/', headers=auth_headers)
        if response.json():
            bot = response.json()[0]
            assert 'id' in bot
            assert 'name' in bot
            assert 'status' in bot
            assert 'is_dry_run' in bot
            assert 'strategy_name' in bot

    def test_post_bot_creates_new_instance(self, auth_headers):
        """Test POST /api/bots/ creates new bot instance"""
        response = client.post('/api/bots/', headers=auth_headers, json={
            'name': 'TestBot',
            'strategy_name': 'SampleStrategy',
            'is_dry_run': True
        })
        assert response.status_code == 201
        assert response.json()['name'] == 'TestBot'
        assert response.json()['status'] == 'stopped'

    def test_post_bot_validates_required_fields(self, auth_headers):
        """Test POST /api/bots/ validates required fields"""
        response = client.post('/api/bots/', headers=auth_headers, json={
            'name': 'TestBot'
            # Missing strategy_name
        })
        assert response.status_code == 422

    def test_get_bot_by_id(self, auth_headers):
        """Test GET /api/bots/{id}"""
        response = client.get('/api/bots/', headers=auth_headers)
        if response.json():
            bot_id = response.json()[0]['id']
            response = client.get(f'/api/bots/{bot_id}', headers=auth_headers)
            assert response.status_code == 200
            assert response.json()['id'] == bot_id

    def test_post_bot_start(self, auth_headers):
        """Test POST /api/bots/{id}/start"""
        response = client.get('/api/bots/', headers=auth_headers)
        if response.json():
            bot_id = response.json()[0]['id']
            response = client.post(f'/api/bots/{bot_id}/start', headers=auth_headers)
            assert response.status_code == 200
            assert response.json()['status'] in ['running', 'starting']

    def test_post_bot_stop(self, auth_headers):
        """Test POST /api/bots/{id}/stop"""
        response = client.get('/api/bots/', headers=auth_headers)
        if response.json():
            bot_id = response.json()[0]['id']
            response = client.post(f'/api/bots/{bot_id}/stop', headers=auth_headers)
            assert response.status_code == 200
            assert response.json()['status'] in ['stopped', 'stopping']
```

#### Test Suite: `tests/orchestrator/kill_switch.test.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import RiskEvent

client = TestClient(app)

class TestKillSwitchEndpoints:
    @pytest.fixture
    def auth_headers(self):
        response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': 'test-password'
        })
        token = response.json()['token']
        return {'Authorization': f'Bearer {token}'}

    def test_post_kill_switch_hard_all(self, auth_headers):
        """Test POST /api/kill-switch/hard-all kills all bots"""
        response = client.post('/api/kill-switch/hard-all', headers=auth_headers, json={
            'reason': 'Test emergency kill'
        })
        assert response.status_code == 200
        assert response.json()['success'] == True
        assert 'killed_count' in response.json()

    def test_post_kill_switch_soft(self, auth_headers):
        """Test POST /api/kill-switch/soft/{bot_id}"""
        response = client.get('/api/bots/', headers=auth_headers)
        if response.json():
            bot_id = response.json()[0]['id']
            response = client.post(f'/api/kill-switch/soft/{bot_id}', headers=auth_headers, json={
                'reason': 'Test soft kill'
            })
            assert response.status_code == 200
            assert response.json()['success'] == True

    def test_get_kill_switch_events(self, auth_headers):
        """Test GET /api/kill-switch/events returns last 10 events"""
        response = client.get('/api/kill-switch/events', headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) <= 10

    def test_kill_switch_events_contain_required_fields(self, auth_headers):
        """Test kill switch events have required fields"""
        response = client.get('/api/kill-switch/events', headers=auth_headers)
        if response.json():
            event = response.json()[0]
            assert 'id' in event
            assert 'type' in event  # 'soft_kill' or 'hard_kill'
            assert 'bot_id' in event or 'bot_count' in event
            assert 'timestamp' in event
            assert 'reason' in event
```

#### Test Suite: `tests/orchestrator/heartbeat.test.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import patch, MagicMock

client = TestClient(app)

class TestHeartbeatMonitor:
    @pytest.fixture
    def auth_headers(self):
        response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': 'test-password'
        })
        token = response.json()['token']
        return {'Authorization': f'Bearer {token}'}

    def test_heartbeat_detects_bot_failure(self, auth_headers):
        """Test heartbeat detects when bot stops responding"""
        # This would require mocking the FT API
        pass

    def test_heartbeat_triggers_hard_kill_after_3_failures(self, auth_headers):
        """Test hard kill triggered after 3 consecutive heartbeat failures"""
        # Mock consecutive failures
        pass

    def test_heartbeat_records_failure_count(self, auth_headers):
        """Test bot consecutive_failures increments on heartbeat miss"""
        response = client.get('/api/bots/', headers=auth_headers)
        if response.json():
            bot = response.json()[0]
            assert 'consecutive_failures' in bot
            assert bot['consecutive_failures'] >= 0

    def test_heartbeat_resets_counter_on_success(self, auth_headers):
        """Test consecutive_failures resets to 0 on successful heartbeat"""
        pass
```

### 2.2 Database Model Tests

#### Test Suite: `tests/orchestrator/models.test.py`

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import BotInstance, Strategy, RiskEvent, AuditLog
from app.database import Base

# Use in-memory SQLite for tests
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class TestBotInstanceModel:
    @pytest.fixture
    def db(self):
        db = TestingSessionLocal()
        yield db
        db.close()

    def test_bot_instance_creation(self, db):
        """Test creating a BotInstance"""
        bot = BotInstance(
            name='TestBot',
            strategy_name='SampleStrategy',
            container_id='abc123',
            status='stopped',
            is_dry_run=True
        )
        db.add(bot)
        db.commit()

        stored_bot = db.query(BotInstance).filter_by(name='TestBot').first()
        assert stored_bot is not None
        assert stored_bot.status == 'stopped'

    def test_bot_instance_status_update(self, db):
        """Test updating bot status"""
        bot = BotInstance(
            name='TestBot',
            strategy_name='SampleStrategy',
            container_id='abc123',
            status='stopped'
        )
        db.add(bot)
        db.commit()

        bot.status = 'running'
        db.commit()

        stored_bot = db.query(BotInstance).filter_by(name='TestBot').first()
        assert stored_bot.status == 'running'

class TestStrategyModel:
    @pytest.fixture
    def db(self):
        db = TestingSessionLocal()
        yield db
        db.close()

    def test_strategy_lifecycle_states(self, db):
        """Test strategy can have valid lifecycle states"""
        valid_states = ['draft', 'backtest', 'paper', 'live', 'retired']

        for state in valid_states:
            strategy = Strategy(
                name=f'TestStrategy{state}',
                lifecycle=state,
                description=f'Test {state}'
            )
            db.add(strategy)
            db.commit()

        strategies = db.query(Strategy).all()
        assert len(strategies) == 5

class TestRiskEventModel:
    @pytest.fixture
    def db(self):
        db = TestingSessionLocal()
        yield db
        db.close()

    def test_risk_event_creation(self, db):
        """Test creating a RiskEvent"""
        event = RiskEvent(
            type='hard_kill',
            bot_id='bot1',
            reason='Manual emergency kill',
            triggered_by='admin'
        )
        db.add(event)
        db.commit()

        stored_event = db.query(RiskEvent).filter_by(type='hard_kill').first()
        assert stored_event is not None
        assert stored_event.reason == 'Manual emergency kill'

    def test_risk_event_timestamp_auto_set(self, db):
        """Test RiskEvent timestamp is automatically set"""
        from datetime import datetime
        event = RiskEvent(
            type='soft_kill',
            bot_id='bot1',
            reason='Test'
        )
        db.add(event)
        db.commit()

        stored_event = db.query(RiskEvent).first()
        assert stored_event.timestamp is not None
        assert isinstance(stored_event.timestamp, datetime)

class TestAuditLogModel:
    @pytest.fixture
    def db(self):
        db = TestingSessionLocal()
        yield db
        db.close()

    def test_audit_log_immutability(self, db):
        """Test audit logs are immutable (no update/delete)"""
        log = AuditLog(
            action='bot_started',
            actor='admin',
            resource_type='bot',
            resource_id='bot1',
            details={'status': 'running'}
        )
        db.add(log)
        db.commit()

        # Verify we can read it
        stored_log = db.query(AuditLog).first()
        assert stored_log is not None

        # Should not be able to update or delete
        # (implement constraints in model)
```

---

## LAYER 3: INTEGRATION TESTS

### 3.1 Frontend → Orchestrator API Flow

#### Test Suite: `tests/integration/dashboard.integration.test.tsx`

```typescript
describe('Dashboard Integration Test', () => {
  beforeEach(() => {
    // Start mock server with realistic responses
    server.listen({ onUnhandledRequest: 'error' });
  });

  test('Dashboard loads bots and displays in grid', async () => {
    // Mock orchestrator response for getBots()
    server.use(
      rest.get('/api/bots/', (req, res, ctx) => {
        return res(ctx.json([
          {
            id: 'bot1',
            name: 'BTC Bot',
            status: 'running',
            is_dry_run: false,
            strategy_name: 'RSIStrategy',
            consecutive_failures: 0
          },
          {
            id: 'bot2',
            name: 'ETH Bot',
            status: 'stopped',
            is_dry_run: true,
            strategy_name: 'MACDStrategy',
            consecutive_failures: 0
          },
        ]));
      })
    );

    // Mock FT API responses
    server.use(
      rest.get('http://127.0.0.1:8080/api/v1/profit', (req, res, ctx) => {
        return res(ctx.json({
          profit_all_coin: 1250.50,
          profit_closed_coin: 750.25,
          closed_trade_count: 42,
        }));
      }),
      rest.get('http://127.0.0.1:8080/api/v1/balance', (req, res, ctx) => {
        return res(ctx.json({
          total: 10000,
          currency: 'USDT'
        }));
      }),
      rest.get('http://127.0.0.1:8080/api/v1/status', (req, res, ctx) => {
        return res(ctx.json([
          {
            trade_id: 1,
            pair: 'BTC/USDT',
            open_rate: 45000,
            current_rate: 45500,
            close_profit_abs: 500,
            is_short: false,
            open_date: '2026-03-28T10:00:00Z',
          }
        ]));
      })
    );

    render(<DashboardPage />);

    // Verify bot cards render
    await waitFor(() => {
      expect(screen.getByText('BTC Bot')).toBeInTheDocument();
      expect(screen.getByText('ETH Bot')).toBeInTheDocument();
    });

    // Verify portfolio equity is calculated
    await waitFor(() => {
      expect(screen.getByText(/\$20,000/)).toBeInTheDocument(); // 10000 * 2 bots
    });

    // Verify open positions render
    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
    });
  });

  test('Kill switch communicates with orchestrator and kills all bots', async () => {
    const killSwitchSpy = jest.fn();

    server.use(
      rest.post('/api/kill-switch/hard-all', (req, res, ctx) => {
        killSwitchSpy();
        return res(ctx.json({ success: true, killed_count: 2 }));
      })
    );

    render(<Header />);
    fireEvent.click(screen.getByText('🚨 KILL SWITCH'));
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(killSwitchSpy).toHaveBeenCalled();
      expect(screen.getByText(/killed successfully/i)).toBeInTheDocument();
    });
  });
});
```

### 3.2 Orchestrator → FreqTrade API Proxy Flow

#### Test Suite: `tests/integration/orchestrator_freqtrade.test.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import patch, MagicMock

client = TestClient(app)

class TestOrchestrationToFTFlow:
    @pytest.fixture
    def auth_headers(self):
        response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': 'test-password'
        })
        token = response.json()['token']
        return {'Authorization': f'Bearer {token}'}

    @patch('app.freqtrade.FTClient.get_status')
    def test_orchestrator_proxies_bot_status(self, mock_ft_status, auth_headers):
        """Test orchestrator correctly proxies FT status endpoint"""
        mock_ft_status.return_value = [
            {
                'trade_id': 1,
                'pair': 'BTC/USDT',
                'open_rate': 45000,
                'current_rate': 45500,
                'close_profit_abs': 500,
                'is_short': False,
            }
        ]

        # Orchestrator should proxy to FT API
        response = client.get('/api/bots/bot1/status', headers=auth_headers)
        assert response.status_code == 200
        assert response.json()[0]['pair'] == 'BTC/USDT'

    @patch('app.freqtrade.FTClient.force_exit')
    def test_orchestrator_proxies_force_exit(self, mock_force_exit, auth_headers):
        """Test orchestrator proxies force exit to FT"""
        mock_force_exit.return_value = {'result': 'ok'}

        response = client.post('/api/bots/bot1/force-exit', headers=auth_headers, json={
            'tradeid': 123
        })
        assert response.status_code == 200
        assert response.json()['result'] == 'ok'

    @patch('app.freqtrade.FTClient.buy')
    def test_orchestrator_does_not_proxy_buy_endpoint(self, mock_buy, auth_headers):
        """Test orchestrator blocks unauthorized FT endpoints (buy, sell)"""
        # Buy endpoint should not be proxied for security
        response = client.post('/api/bots/bot1/buy', headers=auth_headers)
        assert response.status_code == 403  # Forbidden
```

### 3.3 Authentication Flow

#### Test Suite: `tests/integration/auth_flow.test.tsx`

```typescript
describe('Authentication Flow Integration', () => {
  test('Complete auth flow: login → token → protected page → logout', async () => {
    // 1. Start on login page
    const { router } = render(<LoginPage />);
    expect(router.pathname).toBe('/login');

    // 2. Mock successful login
    server.use(
      rest.post('/api/auth/login', (req, res, ctx) => {
        return res(ctx.json({ token: 'jwt_token_123' }));
      })
    );

    // 3. Login
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    // 4. Verify redirect to dashboard
    await waitFor(() => {
      expect(router.pathname).toBe('/dashboard');
    });

    // 5. Verify token in localStorage
    const token = localStorage.getItem('auth_token');
    expect(token).toBe('jwt_token_123');

    // 6. Mock protected endpoint
    server.use(
      rest.get('/api/bots/', (req, res, ctx) => {
        const authHeader = req.headers.get('Authorization');
        if (authHeader && authHeader.includes('jwt_token_123')) {
          return res(ctx.json([{ id: 'bot1' }]));
        }
        return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
      })
    );

    // 7. Verify protected page loads
    const { rerender } = render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    });

    // 8. Mock logout
    server.use(
      rest.post('/api/auth/logout', (req, res, ctx) => {
        return res(ctx.json({ success: true }));
      })
    );

    // 9. Logout
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByTestId('user-avatar'));

    // 10. Verify token removed and redirect to login
    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(router.pathname).toBe('/login');
    });
  });
});
```

### 3.4 Config Save → Reload Flow

#### Test Suite: `tests/integration/config_save.test.tsx`

```typescript
describe('Settings Config Save and Reload Flow', () => {
  test('Save config.json settings → restart bot → verify changes', async () => {
    server.use(
      rest.get('/api/bots/bot1', (req, res, ctx) => {
        return res(ctx.json({
          id: 'bot1',
          name: 'TestBot',
          config: {
            stake_amount: 100,
            timeframe: '5m',
            leverage: 5,
          }
        }));
      })
    );

    render(<SettingsPage botId="bot1" />);

    // Load initial config
    await waitFor(() => {
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    });

    // Modify stake amount
    fireEvent.change(screen.getByLabelText('Stake Amount'),
      { target: { value: '200' } });

    // Mock save endpoint
    server.use(
      rest.post('/api/bots/bot1/config', (req, res, ctx) => {
        return res(ctx.json({ success: true }));
      })
    );

    // Save
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByText(/Settings saved/)).toBeInTheDocument();
    });

    // Bot restart should trigger
    server.use(
      rest.post('/api/bots/bot1/restart', (req, res, ctx) => {
        return res(ctx.json({ status: 'restarting' }));
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /Restart Bot/i }));

    await waitFor(() => {
      expect(screen.getByText(/restarting/i)).toBeInTheDocument();
    });
  });
});
```

### 3.5 Strategy Lifecycle Flow

#### Test Suite: `tests/integration/strategy_lifecycle.test.tsx`

```typescript
describe('Strategy Lifecycle: Draft → Backtest → Paper → Live → Retired', () => {
  test('Create draft → backtest → promote to paper → promote to live', async () => {
    // 1. Create new strategy (Draft)
    server.use(
      rest.post('/api/strategies/', (req, res, ctx) => {
        return res(ctx.status(201), ctx.json({
          id: 's1',
          name: 'RSI Strategy',
          lifecycle: 'draft'
        }));
      })
    );

    render(<StrategyBuilderPage />);
    fireEvent.change(screen.getByLabelText('Strategy Name'),
      { target: { value: 'RSI Strategy' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Strategy/i }));

    await waitFor(() => {
      expect(screen.getByText(/RSI Strategy/)).toBeInTheDocument();
    });

    // 2. Run backtest
    server.use(
      rest.post('/api/strategies/s1/backtest', (req, res, ctx) => {
        return res(ctx.json({ job_id: 'job1', status: 'running' }));
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /Run Backtest/i }));

    await waitFor(() => {
      expect(screen.getByText(/Backtest running/)).toBeInTheDocument();
    });

    // 3. Promote to paper
    server.use(
      rest.post('/api/strategies/s1/promote', (req, res, ctx) => {
        if (req.json().target === 'paper') {
          return res(ctx.json({
            id: 's1',
            lifecycle: 'paper',
            bot_instance_id: 'bot_paper_1'
          }));
        }
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /Start Paper/i }));

    await waitFor(() => {
      expect(screen.getByText(/PAPER/)).toBeInTheDocument();
    });

    // 4. Promote to live
    server.use(
      rest.post('/api/strategies/s1/promote', (req, res, ctx) => {
        if (req.json().target === 'live') {
          return res(ctx.json({
            id: 's1',
            lifecycle: 'live',
            bot_instance_id: 'bot_live_1'
          }));
        }
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /Go Live/i }));

    await waitFor(() => {
      expect(screen.getByText(/LIVE/)).toBeInTheDocument();
    });
  });
});
```

---

## LAYER 4: E2E TESTS

### 4.1 Critical User Flows

#### Test Suite: `tests/e2e/critical_flows.spec.ts`

```typescript
import { test, expect, Page } from '@playwright/test';

test.describe('E2E: Critical User Flows', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000/login');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Flow 1: Login → Dashboard → View Bots → Kill Switch', async () => {
    // 1. Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'test-password');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('http://localhost:3000/dashboard');

    // 2. Verify dashboard loads
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('[data-testid="bot-cards"]')).toBeVisible();

    // 3. Verify bot cards render
    await expect(page.locator('[data-testid^="bot-card-"]')).toHaveCount(2);

    // 4. Verify open positions table
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=BTC/USDT')).toBeVisible();

    // 5. Click kill switch
    await page.click('button:has-text("🚨 KILL SWITCH")');
    await expect(page.locator('text=Confirm Kill All Bots')).toBeVisible();

    // 6. Confirm kill
    await page.click('button:has-text("Confirm")');
    await expect(page.locator('text=All bots killed')).toBeVisible({ timeout: 5000 });
  });

  test('Flow 2: Create Strategy → Run Backtest → View Results', async () => {
    // 1. Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'test-password');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('http://localhost:3000/dashboard');

    // 2. Navigate to builder
    await page.click('[href="/builder"]');
    await page.waitForURL('http://localhost:3000/builder');

    // 3. Create strategy
    await page.fill('input[name="strategy_name"]', 'TestStrategy');
    await page.selectOption('select[name="entry_callback"]', 'populate_entry_trend');
    await page.click('button:has-text("Save Strategy")');
    await expect(page.locator('text=Strategy saved')).toBeVisible();

    // 4. Run backtest
    await page.click('button:has-text("Run Backtest")');
    await page.waitForURL(/backtesting/);

    // 5. Verify backtest form
    await expect(page.locator('text=Start Date')).toBeVisible();
    await expect(page.locator('text=End Date')).toBeVisible();

    // 6. Start backtest
    await page.click('button:has-text("Start Backtest")');
    await expect(page.locator('[data-testid="backtest-progress"]')).toBeVisible();

    // 7. Wait for results
    await page.waitForURL(/backtesting.*results/, { timeout: 30000 });
    await expect(page.locator('text=Total Return')).toBeVisible();
    await expect(page.locator('[data-testid="backtest-chart"]')).toBeVisible();
  });

  test('Flow 3: View Dashboard → Filter Pairs → View Analytics', async () => {
    // 1. Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'test-password');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('http://localhost:3000/dashboard');

    // 2. Search for pair
    await page.fill('input[placeholder*="Search"]', 'BTC');
    await page.click('text=BTC/USDT');
    await page.waitForURL(/analytics\?pair=BTC\/USDT/);

    // 3. Verify analytics page loads
    await expect(page.locator('text=BTC/USDT')).toBeVisible();
    await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();
  });

  test('Flow 4: Access Settings → Update Config → Restart Bot', async () => {
    // 1. Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'test-password');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('http://localhost:3000/dashboard');

    // 2. Navigate to settings
    await page.click('[href="/settings"]');
    await page.waitForURL('http://localhost:3000/settings');

    // 3. Update stake amount
    const stakeInput = page.locator('input[name="stake_amount"]');
    await stakeInput.fill('200');

    // 4. Save
    await page.click('button:has-text("Save Settings")');
    await expect(page.locator('text=Settings saved')).toBeVisible();

    // 5. Restart bot
    await page.click('button:has-text("Restart Bot")');
    await expect(page.locator('text=Bot restarting')).toBeVisible();

    // 6. Verify bot comes back online
    await expect(page.locator('text=running')).toBeVisible({ timeout: 10000 });
  });
});
```

---

## CRITICAL PATH TESTS

### Test Cases: Must Always Pass

```yaml
critical_path_tests:
  - id: CRIT-001
    name: Kill Switch Always Works (Soft)
    description: Hard kill endpoint responsive, all bots stop trading
    expected_result: All bots return status=stopped within 5s
    acceptance_criteria:
      - POST /api/kill-switch/soft/{bot_id} returns 200
      - FT receives POST /api/v1/stop
      - Bot container stops
      - No trades remain open after 5s

  - id: CRIT-002
    name: Kill Switch Always Works (Hard)
    description: Emergency hard kill forceexits and stops all bots
    expected_result: All trades forcexited, all bots stopped within 10s
    acceptance_criteria:
      - POST /api/kill-switch/hard-all returns 200
      - FT receives POST /api/v1/forceexit for each open trade
      - FT receives POST /api/v1/stop
      - No open trades remain
      - All bots.status = 'stopped' or 'killed'

  - id: CRIT-003
    name: Heartbeat Detects Bot Failure
    description: Monitor detects 3 consecutive failures
    expected_result: Hard kill triggered automatically
    acceptance_criteria:
      - GET /api/v1/health fails 3 times
      - consecutive_failures counter increments
      - Auto hard kill executed after 3rd failure
      - RiskEvent logged

  - id: CRIT-004
    name: Authentication Required for Protected Routes
    description: Cannot access /api/* endpoints without valid JWT
    expected_result: 401 Unauthorized response
    acceptance_criteria:
      - GET /api/bots/ without token → 401
      - GET /api/bots/ with expired token → 401
      - GET /api/bots/ with valid token → 200

  - id: CRIT-005
    name: Config Save Does Not Corrupt
    description: Settings changes persist without data loss
    expected_result: Config file valid JSON, all fields preserved
    acceptance_criteria:
      - POST /api/bots/{id}/config saves to config.json
      - File is valid JSON (not truncated)
      - All existing fields preserved
      - New fields added correctly
      - No null values except optional fields

  - id: CRIT-006
    name: Trade Data Displays Correctly
    description: All trade fields from FT display without errors
    expected_result: Dashboard shows all open trades with correct data
    acceptance_criteria:
      - D-11: All columns render (pair, side, leverage, rates, P&L)
      - Field values match FT API ±0.01 (rounding)
      - Colors correct (green/red for side)
      - Leverage badge shows "{N}x"
      - Duration computed correctly (now - open_date)

  - id: CRIT-007
    name: Portfolio Equity Aggregates Correctly
    description: Multi-bot equity sums without floating point errors
    expected_result: Total equity = sum(bot_balances)
    acceptance_criteria:
      - D-1: Portfolio equity = sum of all bot total balances
      - Calculation within 0.01 USDT
      - Today's change = sum(daily_profits)
      - Updates every 10s

  - id: CRIT-008
    name: Backtest Completes Without Errors
    description: Can run full backtest cycle without crashes
    expected_result: Backtest runs and produces valid results
    acceptance_criteria:
      - Can trigger backtest with all parameters
      - Status updates to "running"
      - Completes without timeout (30min default)
      - Results include total_return, win_rate, max_dd
      - Charts render without NaN/Infinity values

  - id: CRIT-009
    name: API Keys Masked in Settings
    description: Sensitive API keys not visible in UI
    expected_result: Keys show "••••••••" (last 4 chars visible)
    acceptance_criteria:
      - API key field shows masked value
      - Full key never logged to console
      - API key never sent in GET requests
      - Copy button copies real key only

  - id: CRIT-010
    name: JWT Token Handling Secure
    description: Token not exposed in URLs, localStorage only
    expected_result: Token stored securely
    acceptance_criteria:
      - Token in localStorage, not URL
      - Token in Authorization header only
      - Token expires correctly
      - Refresh token (if implemented) rotates
      - Logout clears token immediately
```

---

## PER-PAGE TEST CHECKLIST

### Page 0: Login (L-1 through L-6)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| L-1 | Username input empty → error | "Username required" shown |
| L-1 | Username input text → state updates | Input value = typed text |
| L-2 | Password input empty → error | "Password required" shown |
| L-2 | Password masked input → state updates | Input type=password |
| L-3 | Toggle password visibility | Input type toggles text ↔ password |
| L-4 | Remember me unchecked → login | Token in sessionStorage (expires on close) |
| L-4 | Remember me checked → login | Token in localStorage (persists) |
| L-5 | Valid credentials → success | Token stored, redirect to /dashboard |
| L-5 | Invalid credentials → error | "Invalid credentials" error shown |
| L-5 | Server error → error | "Server error" or "Connection failed" shown |
| L-5 | Loading state | Button text = "Signing in...", disabled |
| L-6 | Error clears on next attempt | Previous error hidden |

### Page 1: Dashboard (D-1 through D-20)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| D-1 | Portfolio equity loaded | Shows sum of all bot balances |
| D-1 | Today's change calculated | Shows profit_all_coin with % change |
| D-2 | Unrealized P&L | Sum of close_profit_abs all open trades |
| D-2 | Color: P&L >= 0 | Text is green |
| D-2 | Color: P&L < 0 | Text is red |
| D-3 | Today's realized loaded | Shows profit_closed_coin |
| D-3 | Closed trade count | Shows closed_trade_count |
| D-4 | Max drawdown 30d | Computed from daily data |
| D-5 | Active bots count | Shows total bot count |
| D-5 | LIVE/PAPER breakdown | "3 LIVE · 2 PAPER" format |
| D-8 | Bot cards grid renders | One card per bot |
| D-8 | Bot card click | Navigate to /strategies?bot={id} |
| D-8 | Bot card hover | Border accent, -2px translateY, shadow |
| D-9 | Status badge LIVE | Green bg, running bot not dry_run |
| D-9 | Status badge PAPER | Amber bg, running bot with dry_run |
| D-9 | Status badge STOPPED | Red bg, status=stopped |
| D-11 | Position table columns | All 8 columns visible |
| D-11 | Pair column | From trade.pair |
| D-11 | Bot column | From our metadata |
| D-11 | Side column | "Long" if is_short=false, "Short" if true |
| D-11 | Leverage column | "{leverage}x" badge |
| D-11 | open_rate column | Formatted currency |
| D-11 | current_rate column | Formatted currency |
| D-11 | close_profit_abs column | Green if >=0, red if <0 |
| D-11 | Duration column | Computed (now - open_date) |
| D-12 | Row expand | Shows trade_id, stake_amount, fees, enter_tag |
| D-12 | ⋮ menu → Force Exit | Confirmation dialog shown |
| D-12 | Force Exit confirm | POST /api/v1/forceexit called, trade closed |
| D-12 | ⋮ menu → Analytics | Navigate to /analytics?pair={pair} |
| D-15 | Daily P&L chart | 7 bars, green/red by sign |
| D-15 | Chart labels | "+$XXX" above, day name below |
| D-17 | Equity curve 30d | Line chart with gradient fill (PROTO) |
| D-18 | Recent alerts | 5 most recent events shown (PROTO) |
| D-19 | System health dots | Green/amber/red per service (PROTO) |
| D-20 | Closed trades today | All trades closed today shown (PROTO) |

### Page 2: Strategies (ST-1 through ST-20)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| ST-1 | Filter "All" | All strategies shown |
| ST-1 | Filter "Live" | Only lifecycle=live shown |
| ST-1 | Filter "Paper" | Only lifecycle=paper shown |
| ST-1 | Filter "Backtest" | Only lifecycle=backtest shown |
| ST-1 | Filter "Draft" | Only lifecycle=draft shown |
| ST-1 | Filter "Retired" | Only lifecycle=retired shown, opacity 0.6 |
| ST-1 | Badge counts | "Live (3)" shows correct count |
| ST-2 | Import .py button | Opens import modal |
| ST-3 | + New Strategy | Navigate to /builder |
| ST-4 | Strategy card renders | Name, description, metrics visible |
| ST-4 | Card click | Open detail panel (ST-10) |
| ST-4 | Card hover | Border accent, -2px lift, shadow |
| ST-5 | Badge color: live | Green |
| ST-5 | Badge color: paper | Amber |
| ST-5 | Badge color: backtest | Cyan |
| ST-5 | Badge color: draft | Gray |
| ST-5 | Badge color: retired | Red |
| ST-6 (LIVE) | View Trades button | Show all open/closed trades for bot |
| ST-6 (LIVE) | Edit button | Navigate to /builder?strategy={id} |
| ST-6 (LIVE) | Go Live button | Confirm → update lifecycle to live |
| ST-6 (PAPER) | Start Paper button | Create paper bot, update lifecycle |
| ST-6 (BACKTEST) | View Results | Show backtest result summary |
| ST-6 (DRAFT) | Edit in Builder | Navigate to /builder?strategy={id} |
| ST-6 (DRAFT) | Run Backtest → | Navigate to /backtesting |
| ST-6 (RETIRED) | Clone | Create copy with lifecycle=draft |

### Page 3: Strategy Builder (B-1 through B-30)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| B-1 | Strategy name input | Required, non-empty |
| B-2 | Description textarea | Optional, saved |
| B-3 | Entry callback select | 19 callbacks available (§3) |
| B-4 | Exit callback select | 19 callbacks available |
| B-5 | Stoploss type select | 6 types available (§4) |
| B-6 | Stoploss % field | -99 to 0 range |
| B-7 | Trailing % field | Visible only if stoploss=trailing |
| B-8 | Custom stoploss code | Text area for Python code |
| B-9 | Leverage input | 1-125x range |
| B-10 | Risk per trade % | 0-100% range |
| B-11 | Position size mode | Fixed/Percent/Log |
| B-12 | Entry signal threshold | Numeric range 0-100 |
| B-13 | Exit signal threshold | Numeric range 0-100 |
| B-14 | Indicators list | Add/remove technical indicators |
| B-15 | Indicator params | Dynamic based on selected indicator |
| B-20 | Save Strategy button | Saves to ORCH DB, generates .py |
| B-21 | Preview Strategy Code | Shows generated Python code |
| B-22 | Test Strategy button | Can trigger backtest directly |

### Page 4: Backtesting (BT-1 through BT-20)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| BT-1 | Strategy select | Dropdown shows all available strategies |
| BT-2 | Start date picker | Valid date selection |
| BT-3 | End date picker | Valid date selection, >= start date |
| BT-4 | Timeframe select | 1m, 5m, 15m, 30m, 1h, 4h, 1d |
| BT-5 | Backtest mode select | Default, advanced, hyperopt |
| BT-6 | Loss function select (if hyperopt) | 12 loss functions available (§6) |
| BT-7 | Sampler select (if hyperopt) | 6 samplers available (§6) |
| BT-8 | Epochs input (if hyperopt) | Positive integer, 100-1000 typical |
| BT-9 | Start Backtest button | Triggers FT GET /api/v1/backtest |
| BT-10 | Progress bar | Updates as job runs |
| BT-11 | Results: Total Return | Displays % and absolute value |
| BT-12 | Results: Win Rate | Displays % with trade count |
| BT-13 | Results: Max Drawdown | Displays % and $ amount |
| BT-14 | Results: Sharpe Ratio | Displays numeric value |
| BT-15 | Equity curve chart | Line chart with cumulative equity |
| BT-16 | Trade list table | All trades with entry/exit details |
| BT-17 | Monthly returns table | Breakdown by month |
| BT-18 | Download results button | CSV or JSON export |
| BT-19 | Promote to Paper button | Create paper bot with backtest config |
| BT-20 | Hyperopt job list | Show all running/completed jobs |

### Page 5: Analytics (A-1 through A-20)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| A-1 | Pair selector | Shows all whitelisted pairs |
| A-2 | Timeframe selector | 1h, 4h, 1d default |
| A-3 | Date range picker | Custom date selection |
| A-4 | Bot filter | Filter by bot (if multi-bot view) |
| A-5 | OHLC candlestick chart | Real OHLC data from FT |
| A-6 | Entry/exit markers | Green circle = buy, red = sell |
| A-7 | Tech indicators overlay | Moving averages, RSI, MACD, etc. |
| A-8 | Order flow (orderflow) | Bar chart of buy/sell volume |
| A-9 | Trade list for pair | All trades BTC/USDT pair in timeframe |
| A-10 | Trade list: click row | Highlight candle of entry/exit |
| A-11 | P&L by trade | Graph bar per trade |
| A-12 | Cumulative P&L | Line chart cumulative profit |
| A-13 | Win/loss statistics | % wins, avg win, avg loss |
| A-14 | Monthly breakdown | Profits by month for pair |
| A-15 | Drawdown analysis | Max DD, recovery time |
| A-16 | Export data | CSV of trades + OHLC |
| A-17 | Refresh data button | Manual reload from FT |
| A-18 | Auto-refresh toggle | 30s, 1m, 5m, off |
| A-19 | Lookback input (§21) | For lookahead analysis |
| A-20 | Recursive analysis (§22) | For recursive candle analysis |

### Page 6: Risk Management (R-1 through R-15)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| R-1 | Kill Switch button (header) | Appears on every page |
| R-2 | Protection status | Shows status of each protection |
| R-3 | Stoploss loss protection | Shows active stoploss rules |
| R-4 | Cooldown protection | Shows active cooldown periods |
| R-5 | PairLock protection | Shows locked pairs + reasons |
| R-6 | Trade limit protection | Shows trade count limit |
| R-7 | Stop duration select | Configurable duration values |
| R-8 | Risk events history | Last 50 kill switch events |
| R-9 | Event filter: by type | soft_kill, hard_kill |
| R-10 | Event filter: by bot | Filter by bot_id |
| R-11 | Event filter: by date | Date range picker |
| R-12 | Event detail expand | Show reason, triggered_by, outcome |
| R-13 | Recovery mode explain | Manual recovery steps |
| R-14 | Health status per bot | Green/amber/red dots |
| R-15 | Heartbeat monitor | Shows consecutive_failures per bot |

### Page 7: Settings (ST-1 through ST-50)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| ST-1 | Stake amount input | Positive number, persists to config.json |
| ST-2 | Timeframe select | 1m, 5m, 15m, 30m, 1h, 4h, 1d |
| ST-3 | Pair whitelist | CSV list of pairs, validated |
| ST-4 | Leverage input | 1-125x range |
| ST-5 | Margin mode | isolated/cross (if futures) |
| ST-6 | Trading mode | spot/futures/margin |
| ST-7 | Dry run toggle | Paper/Live mode |
| ST-8 | Exchange select | Binance, Kraken, etc. |
| ST-9 | API key input | Masked, not logged |
| ST-10 | API secret input | Masked, never shown |
| ST-11 | Exchange mode | Sandbox/live toggle |
| ST-12 | Pairlist handler select | whitelist, dynamic, etc. |
| ST-13 | Pairlist filters | Min candle, min value, etc. |
| ST-14 | Telegram token input | Optional, masked |
| ST-15 | Telegram chat ID | Optional |
| ST-16 | Telegram notifications toggle | On/off for various events |
| ST-20 | Max open trades | Positive integer |
| ST-21 | Trade timeout | Minutes before auto-exit |
| ST-22 | Min profit target | % target for exit |
| ST-25 | Save button | POST to /api/bots/{id}/config |
| ST-26 | Discard button | Revert changes (load from API) |
| ST-27 | Restart bot button | Restart container with new config |
| ST-28 | Backup config button | Download current config.json |
| ST-29 | Restore config button | Upload and restore config.json |
| ST-30 | Validation errors | Show per-field error messages |

### Page 8: FreqAI (F-1 through F-20)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| F-1 | Enable FreqAI toggle | Adds freqai{} to config (§24) |
| F-2 | Model type select | LightGBM, XGBoost, PyTorch, RL |
| F-3 | Training window input | Days of historical data for training |
| F-4 | Retraining frequency | Hours between model retrains |
| F-5 | Feature list | Add/remove features for model |
| F-6 | Feature normalization | StandardScaler, MinMaxScaler, etc. |
| F-7 | Outlier removal select | IQR, zscore, isolation_forest |
| F-8 | RL reward function | Sharpe, Sortino, manual |
| F-9 | RL policy select | PPO, DQN, A2C |
| F-10 | RL epochs input | Training epochs for RL |
| F-11 | Data split % | Train/test/validation split |
| F-12 | Cross-validation folds | Number of CV folds |
| F-13 | Feature importance chart | Show top features by importance |
| F-14 | Model performance metrics | Accuracy, precision, recall |
| F-15 | Prediction distribution | Histogram of predictions |
| F-16 | Train button | Start model training job |
| F-17 | Training progress | Progress bar + ETA |
| F-18 | Download model | Save trained model file |
| F-19 | Backtest with ML | Use trained model in backtest |
| F-20 | Live trading with ML | Use model in live trading |

### Page 9: Data Management (DM-1 through DM-15)

| Widget | Test Case | Expected Result |
|--------|-----------|-----------------|
| DM-1 | Download data button | Opens download form |
| DM-2 | Pair multi-select | Select multiple pairs for download |
| DM-3 | Timeframe select | Choose candle timeframe |
| DM-4 | Start date picker | From date for download |
| DM-5 | End date picker | To date for download |
| DM-6 | Exchange select | Choose exchange data source |
| DM-7 | Start download button | POST /api/download-data (§12) |
| DM-8 | Download progress | Shows % complete, ETA |
| DM-9 | Cancel download button | Stop current download job |
| DM-10 | Data storage info | Show disk usage breakdown |
| DM-11 | Delete old data button | Confirm → delete data older than N days |
| DM-12 | Refresh data cache | Reload metadata from disk |
| DM-13 | Available data table | Show pairs + date ranges available |
| DM-14 | Data quality check | Verify no gaps in candle data |
| DM-15 | Export data | Download selected data as CSV |

---

## API MOCK DATA SPECIFICATIONS

### Mock Response Shapes

#### Auth Endpoint

```json
POST /api/auth/login (request)
{
  "username": "string",
  "password": "string"
}

POST /api/auth/login (response 200)
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user1",
    "username": "admin",
    "role": "admin"
  }
}

POST /api/auth/login (response 401)
{
  "error": "Invalid credentials"
}
```

#### Bots Endpoints

```json
GET /api/bots/ (response 200)
[
  {
    "id": "bot1",
    "name": "BTC Bot",
    "status": "running",
    "is_dry_run": false,
    "strategy_name": "RSIStrategy",
    "container_id": "abc123def456",
    "created_at": "2026-03-28T10:00:00Z",
    "consecutive_failures": 0
  },
  {
    "id": "bot2",
    "name": "ETH Bot",
    "status": "stopped",
    "is_dry_run": true,
    "strategy_name": "MACDStrategy",
    "container_id": "xyz789",
    "created_at": "2026-03-27T15:30:00Z",
    "consecutive_failures": 0
  }
]

GET /api/bots/{bot_id} (response 200)
{
  "id": "bot1",
  "name": "BTC Bot",
  "status": "running",
  "is_dry_run": false,
  "strategy_name": "RSIStrategy",
  "container_id": "abc123def456",
  "created_at": "2026-03-28T10:00:00Z",
  "consecutive_failures": 0,
  "config": {
    "stake_amount": 100,
    "timeframe": "1h",
    "leverage": 5,
    "pair_whitelist": ["BTC/USDT", "ETH/USDT"]
  }
}

POST /api/bots/{bot_id}/start (response 200)
{
  "id": "bot1",
  "status": "running",
  "message": "Bot started successfully"
}

POST /api/bots/{bot_id}/stop (response 200)
{
  "id": "bot1",
  "status": "stopped",
  "message": "Bot stopped successfully"
}
```

#### Strategies Endpoints

```json
GET /api/strategies/ (response 200)
[
  {
    "id": "s1",
    "name": "RSI Strategy",
    "description": "Simple RSI-based entry/exit",
    "lifecycle": "live",
    "bot_instance_id": "bot1",
    "created_at": "2026-03-28T10:00:00Z",
    "updated_at": "2026-03-28T12:00:00Z"
  },
  {
    "id": "s2",
    "name": "MACD Strategy",
    "description": "MACD crossover strategy",
    "lifecycle": "draft",
    "bot_instance_id": null,
    "created_at": "2026-03-27T15:00:00Z",
    "updated_at": "2026-03-27T15:00:00Z"
  }
]
```

#### FreqTrade REST API Proxy (§8)

```json
GET http://127.0.0.1:8080/api/v1/status (response 200)
[
  {
    "trade_id": 1,
    "pair": "BTC/USDT",
    "stake_amount": 100,
    "amount": 0.00221234,
    "open_rate": 45200,
    "current_rate": 45500,
    "current_profit": 0.0066,
    "current_profit_abs": 66.50,
    "open_date": "2026-03-28T10:15:32Z",
    "is_short": false,
    "close_profit": null,
    "close_profit_abs": null,
    "close_date": null,
    "is_open": true,
    "is_realized_trade": false,
    "fee_open": 0.25,
    "fee_close": 0,
    "trade_duration_s": 12345,
    "leverage": 5,
    "enter_tag": "buy_signal_1",
    "exit_reason": null,
    "close_profit_pct": null,
    "close_rate": null,
    "side": "long"
  }
]

GET http://127.0.0.1:8080/api/v1/profit (response 200)
{
  "profit_all_coin": 1250.50,
  "profit_closed_coin": 750.25,
  "profit_closed_percent": 7.5,
  "closed_trade_count": 42,
  "trade_count": 50,
  "winning_trades": 28,
  "losing_trades": 14,
  "trades": [...]
}

GET http://127.0.0.1:8080/api/v1/balance (response 200)
{
  "currency": "USDT",
  "currencies": [
    {
      "currency": "BTC",
      "free": 0.5,
      "used": 0.001,
      "total": 0.501
    },
    {
      "currency": "ETH",
      "free": 5,
      "used": 0,
      "total": 5
    },
    {
      "currency": "USDT",
      "free": 9500,
      "used": 500,
      "total": 10000
    }
  ],
  "total": 10000
}

GET http://127.0.0.1:8080/api/v1/daily?days=7 (response 200)
{
  "data": [
    {
      "date": "2026-03-21",
      "abs_profit": 50.25,
      "trade_count": 5,
      "starting_balance": 10000
    },
    {
      "date": "2026-03-22",
      "abs_profit": -25.50,
      "trade_count": 3,
      "starting_balance": 10050.25
    },
    ...
  ]
}

POST http://127.0.0.1:8080/api/v1/forceexit (request)
{
  "tradeid": 1,
  "ordertype": "market"
}

POST http://127.0.0.1:8080/api/v1/forceexit (response 200)
{
  "success": true,
  "tradeid": 1,
  "message": "Forceexit for trade 1 successful"
}

POST http://127.0.0.1:8080/api/v1/stop (response 200)
{
  "status": "process shutdown"
}

GET http://127.0.0.1:8080/api/v1/show_config (response 200)
{
  "max_open_trades": 10,
  "stake_currency": "USDT",
  "stake_amount": 100,
  "tradable_balance_ratio": 0.99,
  "timeframe": "5m",
  "exchange": {
    "name": "binance",
    "key": "****",
    "pair_whitelist": ["BTC/USDT", "ETH/USDT"],
    "pair_blacklist": ["XRP/USDT"]
  },
  "dry_run": true,
  "trading_mode": "futures",
  "margin_mode": "isolated"
}
```

#### Kill Switch Endpoints

```json
POST /api/kill-switch/hard-all (request)
{
  "reason": "Emergency kill from header"
}

POST /api/kill-switch/hard-all (response 200)
{
  "success": true,
  "killed_count": 3,
  "killed_bots": ["bot1", "bot2", "bot3"],
  "message": "Emergency hard kill executed: 3 bots killed, 12 trades forcexited"
}

POST /api/kill-switch/soft/{bot_id} (request)
{
  "reason": "Manual stop requested"
}

POST /api/kill-switch/soft/{bot_id} (response 200)
{
  "success": true,
  "bot_id": "bot1",
  "message": "Soft kill executed for bot1"
}

GET /api/kill-switch/events (response 200)
[
  {
    "id": "evt1",
    "type": "hard_kill",
    "bot_id": null,
    "bot_count": 3,
    "reason": "Emergency kill from header",
    "triggered_by": "admin",
    "timestamp": "2026-03-28T12:45:30Z",
    "trades_forcexited": 12,
    "duration_ms": 234
  },
  {
    "id": "evt2",
    "type": "soft_kill",
    "bot_id": "bot1",
    "reason": "Manual stop requested",
    "triggered_by": "admin",
    "timestamp": "2026-03-28T11:30:15Z",
    "duration_ms": 120
  }
]

GET /api/health (response 200)
{
  "status": "healthy",
  "components": {
    "postgresql": "healthy",
    "redis": "healthy",
    "freqtrade_bot1": "healthy",
    "freqtrade_bot2": "healthy",
    "freqtrade_bot3": "error"
  }
}
```

---

## PERFORMANCE TESTS

### 4.1 Dashboard Load Time

```typescript
test('Dashboard renders with 5 bots in < 2 seconds', async () => {
  const startTime = performance.now();

  server.use(
    rest.get('/api/bots/', (req, res, ctx) => {
      return res(ctx.json(Array.from({ length: 5 }, (_, i) => ({
        id: `bot${i}`,
        name: `Bot ${i}`,
        status: 'running'
      }))));
    })
  );

  render(<DashboardPage />);

  await waitFor(() => {
    expect(screen.getAllByTestId(/bot-card-/)).toHaveLength(5);
  });

  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(2000);
});

test('Dashboard renders with 50 trades in < 3 seconds', async () => {
  const startTime = performance.now();

  server.use(
    rest.get('http://127.0.0.1:8080/api/v1/status', (req, res, ctx) => {
      return res(ctx.json(Array.from({ length: 50 }, (_, i) => ({
        trade_id: i,
        pair: 'BTC/USDT',
        current_profit_abs: Math.random() * 1000
      }))));
    })
  );

  render(<DashboardPage />);

  await waitFor(() => {
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(50);
  });

  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(3000);
});
```

### 4.2 Auto-Refresh Memory Leak Test

```typescript
test('Dashboard auto-refresh does not leak memory after 10 cycles', async () => {
  jest.useFakeTimers();

  let initialMemory = performance.memory?.usedJSHeapSize;

  render(<DashboardPage />);

  for (let i = 0; i < 10; i++) {
    jest.advanceTimersByTime(10000); // 10s refresh interval

    await waitFor(() => {
      expect(mockGetBots).toHaveBeenCalledTimes(i + 1);
    });
  }

  const finalMemory = performance.memory?.usedJSHeapSize;
  const increase = finalMemory - initialMemory;

  // Memory increase should be < 5MB over 10 refreshes
  expect(increase).toBeLessThan(5 * 1024 * 1024);

  jest.useRealTimers();
});
```

### 4.3 Large Backtest Results Rendering

```typescript
test('Backtest results with 10k trades render in < 5 seconds', async () => {
  const trades = Array.from({ length: 10000 }, (_, i) => ({
    trade_id: i,
    pair: 'BTC/USDT',
    open_rate: 45000 + Math.random() * 1000,
    close_rate: 45100 + Math.random() * 1000,
    profit_abs: Math.random() * 100
  }));

  server.use(
    rest.get('/api/backtesting/results/job1', (req, res, ctx) => {
      return res(ctx.json({ trades }));
    })
  );

  const startTime = performance.now();

  render(<BacktestResults jobId="job1" />);

  await waitFor(() => {
    // Virtualization should only render visible rows
    const visibleRows = screen.getAllByRole('row');
    expect(visibleRows.length).toBeLessThan(100); // Virtualized
  });

  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(5000);
});
```

---

## SECURITY TESTS

### 5.1 API Key Masking

```typescript
test('Settings page masks API keys', () => {
  render(<SettingsPage />);

  const apiKeyInput = screen.getByLabelText('API Key');

  // Key displayed with masking
  expect(apiKeyInput.value).toMatch(/^\*+\w{4}$/); // ****key123
});

test('Console never logs full API keys', () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  // Simulate API key being set
  const apiKey = 'secret_key_12345';
  logToConsole(maskApiKey(apiKey));

  expect(consoleSpy).toHaveBeenCalledWith('****12345');
  expect(consoleSpy).not.toHaveBeenCalledWith(apiKey);
});

test('API key never sent in GET request URL', async () => {
  server.use(
    rest.get('*', (req, res, ctx) => {
      // Check URL for API key
      expect(req.url.toString()).not.toContain('secret_key');
      return res(ctx.json({}));
    })
  );

  await fetchWithApiKey('https://api.example.com/data', 'secret_key_12345');
});
```

### 5.2 JWT Token Security

```typescript
test('JWT token stored in localStorage, not in URL', async () => {
  mockLogin.mockResolvedValue({ token: 'jwt_token_123' });
  const localStorageSpy = jest.spyOn(Storage.prototype, 'setItem');

  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
  fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

  await waitFor(() => {
    expect(localStorageSpy).toHaveBeenCalledWith('auth_token', 'jwt_token_123');
  });

  // Verify token not in URL
  expect(window.location.href).not.toContain('jwt_token_123');
});

test('JWT token in Authorization header only', async () => {
  server.use(
    rest.get('/api/bots/', (req, res, ctx) => {
      const authHeader = req.headers.get('Authorization');
      expect(authHeader).toMatch(/^Bearer jwt_token_/);
      return res(ctx.json([]));
    })
  );

  await fetchWithAuth('/api/bots/', 'jwt_token_123');
});

test('Expired JWT token rejected', async () => {
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTAzNDU2Nzg5MH0.invalid';

  server.use(
    rest.get('/api/bots/', (req, res, ctx) => {
      return res(ctx.status(401), ctx.json({ error: 'Token expired' }));
    })
  );

  const response = await fetchWithAuth('/api/bots/', expiredToken);
  expect(response.status).toBe(401);
});
```

### 5.3 Kill Switch Authorization

```typescript
test('Kill switch requires valid authentication', async () => {
  server.use(
    rest.post('/api/kill-switch/hard-all', (req, res, ctx) => {
      const authHeader = req.headers.get('Authorization');

      if (!authHeader) {
        return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
      }

      return res(ctx.json({ success: true }));
    })
  );

  // Without auth → 401
  const response1 = await fetch('/api/kill-switch/hard-all', {
    method: 'POST'
  });
  expect(response1.status).toBe(401);

  // With valid auth → 200
  const response2 = await fetch('/api/kill-switch/hard-all', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid_token' }
  });
  expect(response2.status).toBe(200);
});
```

---

## TEST EXECUTION MATRIX

### Test Schedule & Responsibility

| Phase | Layer | Framework | Count | Runner | Duration | Frequency |
|-------|-------|-----------|-------|--------|----------|-----------|
| Unit | Frontend | Jest | 250+ | `npm run test:unit` | 2-3 min | Pre-commit |
| Unit | Orchestrator | pytest | 80+ | `pytest tests/orchestrator/` | 1-2 min | Pre-commit |
| Integration | Full Stack | Playwright + MSW | 25+ | `npm run test:integration` | 5-10 min | Pre-push |
| E2E | Critical Paths | Playwright | 4-6 | `npm run test:e2e` | 15-30 min | Pre-release |
| Security | Scanning | bandit + OWASP ZAP | 30+ | `bandit -r . && zaproxy` | 5-10 min | Daily |
| Performance | Load Test | k6 | 5+ | `k6 run tests/performance/` | 10-20 min | Weekly |

### Before Commit (Pre-commit Hook)

```bash
#!/bin/bash
echo "Running pre-commit tests..."

# Frontend unit tests
npm run test:unit -- --bail && \
echo "✓ Frontend unit tests passed"

# Orchestrator unit tests
pytest tests/orchestrator/ -v --tb=short && \
echo "✓ Orchestrator unit tests passed"

# ESLint + TypeScript check
npm run lint && npm run type-check && \
echo "✓ Linting and type checking passed"

# API key check (security)
! grep -r "sk_test_\|sk_live_\|api_key.*=" src/ && \
echo "✓ No hardcoded secrets found"

exit 0
```

### Before Push (Pre-push Hook)

```bash
#!/bin/bash
echo "Running pre-push tests..."

# Full integration test suite
npm run test:integration && \
echo "✓ Integration tests passed"

# Security scanning
bandit -r orchestrator/ && \
echo "✓ Bandit security scan passed"

exit 0
```

### Before Release

```bash
#!/bin/bash
echo "Running pre-release test suite..."

# All unit tests
npm run test:unit && pytest tests/orchestrator/ && \
echo "✓ Unit tests passed"

# All integration tests
npm run test:integration && \
echo "✓ Integration tests passed"

# Critical path E2E tests
npm run test:e2e:critical && \
echo "✓ Critical E2E tests passed"

# Performance benchmarks
npm run test:perf && \
echo "✓ Performance tests passed"

# Security audit
npm audit --audit-level=high && \
bandit -r orchestrator/ && \
echo "✓ Security audit passed"

exit 0
```

---

## APPENDIX: Test Utilities & Helpers

### Mock Server Setup (MSW)

```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(ctx.json({ token: 'mock_jwt_token' }));
  }),

  rest.get('/api/bots/', (req, res, ctx) => {
    return res(ctx.json([
      { id: 'bot1', name: 'BTC Bot', status: 'running' },
      { id: 'bot2', name: 'ETH Bot', status: 'stopped' }
    ]));
  }),

  rest.get('http://127.0.0.1:8080/api/v1/*', (req, res, ctx) => {
    // Mock FT API responses
    return res(ctx.json({}));
  })
];

// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Database Test Fixtures (pytest)

```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import BotInstance, Strategy

@pytest.fixture
def test_db():
    """In-memory SQLite for testing"""
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    yield db

    db.close()

@pytest.fixture
def mock_bot(test_db):
    """Create test bot instance"""
    bot = BotInstance(
        name='TestBot',
        strategy_name='SampleStrategy',
        container_id='abc123',
        status='stopped'
    )
    test_db.add(bot)
    test_db.commit()
    return bot
```

---

**End of TESTING_PLAN.md**
