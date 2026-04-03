# DS §30 — Bot Management Drawer (Pixel-Perfect Spec)

> **Source:** `DESIGN-LINEAR-EDGE-FULL.html` L511–L800  
> **Component:** `<aside id="bot-drawer">` — full-height sliding panel  
> **Trigger:** Click any bot card in Fleet column → `openBotDrawer(name, mode)`

---

## 30A. Drawer Container (CSS)

```css
.drawer {
  position: fixed;
  top: 0;
  height: 100vh;
  left: var(--drawer-left);     /* pushes past sidebar: 680px desktop */
  right: 0;
  width: auto;                  /* fills remaining space */
  background: #0C0C0C;
  border-left: 1px solid rgba(255,255,255,0.10);
  transform: translateX(100%);  /* hidden off-screen right */
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), left 0.25s ease;
  z-index: 60;
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 40px rgba(0,0,0,0.85);
}
.drawer.open {
  transform: translateX(0);     /* slide in */
}
```

> [!CAUTION]
> The drawer is NOT a fixed-width panel. It uses `left: var(--drawer-left)` + `right: 0` to fill all space to the right of the sidebar. This makes it responsive automatically.

---

## 30B. Drawer Header

```
┌─────────────────────────────────────────────────────────────────┐
│ p-4 pb-3 l-b bg-black flex flex-col gap-3 shrink-0             │
│                                                                  │
│  ┌─ flex justify-between items-start ─────────────────────────┐ │
│  │  ┌─ div ─────────────────────────────────────────────────┐  │ │
│  │  │  flex items-center gap-2.5 mb-1                       │  │ │
│  │  │  ┌ h2#drawer-bot-name ─────────────────────────────┐  │  │ │
│  │  │  │ text-base font-bold tracking-tight text-white   │  │  │ │
│  │  │  │ font-mono                                       │  │  │ │
│  │  │  │ "TrendFollowerV3_BTC"                           │  │  │ │
│  │  │  └─────────────────────────────────────────────────┘  │  │ │
│  │  │  ┌ span#drawer-bot-mode ────────────────────────────┐ │  │ │
│  │  │  │ px-1.5 py-[2px] bg-up/15 text-up                │ │  │ │
│  │  │  │ border border-up/25 text-[10px] font-bold rounded│ │  │ │
│  │  │  │ "LIVE"                                           │ │  │ │
│  │  │  └──────────────────────────────────────────────────┘ │  │ │
│  │  │  ┌ p ──────────────────────────────────────────────┐  │  │ │
│  │  │  │ text-[11px] text-muted font-mono uppercase      │  │  │ │
│  │  │  │ tracking-wide                                   │  │  │ │
│  │  │  │ "Strategy: TrendFollowerV3 · Binance · Running" │  │  │ │
│  │  │  └─────────────────────────────────────────────────┘  │  │ │
│  │  └───────────────────────────────────────────────────────┘  │ │
│  │  ┌ close button ──────────────────────────────────────────┐ │ │
│  │  │ hover:text-white text-muted p-1.5 hover:bg-white/10   │ │ │
│  │  │ rounded transition-colors                              │ │ │
│  │  │ <i data-lucide="x" class="w-5 h-5">                   │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ 9 ACTION BUTTONS ────────────────────────────────────────┐  │
│  │ flex items-center gap-1 flex-wrap                          │  │
│  │                                                            │  │
│  │ [▶ Start] [■ Stop] [⏸ Pause] [↻ Reload]                  │  │
│  │ [⊕ Force Trade] [✕ Force Exit All] [⊞ Stopbuy]           │  │
│  │ ──separator── [🛡 Soft Kill] [⚡ Hard Kill]               │  │
│  │                                                            │  │
│  │ Each button: class="bot-ctrl {variant}"                    │  │
│  │ Icon size inside drawer: w-3.5 h-3.5  (NOT w-3 h-3)      │  │
│  └────────────────────────────────────────────────────────────┘  │
│  Separator: <span class="w-px h-4 bg-white/15 mx-1">           │
└──────────────────────────────────────────────────────────────────┘
```

### Header HTML (exact)

```html
<div class="p-4 pb-3 l-b bg-black flex flex-col gap-3 shrink-0">
  <div class="flex justify-between items-start">
    <div>
      <div class="flex items-center gap-2.5 mb-1">
        <h2 id="drawer-bot-name" class="text-base font-bold tracking-tight text-white font-mono">TrendFollowerV3_BTC</h2>
        <span id="drawer-bot-mode" class="px-1.5 py-[2px] bg-up/15 text-up border border-up/25 text-[10px] font-bold rounded">LIVE</span>
      </div>
      <p class="text-[11px] text-muted font-mono uppercase tracking-wide">Strategy: TrendFollowerV3 · Binance · Running</p>
    </div>
    <button title="Close drawer" onclick="closeBotDrawer()" class="hover:text-white text-muted p-1.5 hover:bg-white/10 rounded transition-colors">
      <i data-lucide="x" class="w-5 h-5"></i>
    </button>
  </div>
  <!-- 9 ACTION BUTTONS -->
  <div class="flex items-center gap-1 flex-wrap">
    <button class="bot-ctrl ctrl-start" title="▶ Start Bot"><i data-lucide="play" class="w-3.5 h-3.5"></i></button>
    <button class="bot-ctrl ctrl-stop" title="■ Stop Bot"><i data-lucide="square" class="w-3.5 h-3.5"></i></button>
    <button class="bot-ctrl ctrl-pause" title="⏸ Pause"><i data-lucide="pause" class="w-3.5 h-3.5"></i></button>
    <button class="bot-ctrl" title="↻ Reload Config"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i></button>
    <button class="bot-ctrl ctrl-start" title="Force open trade"><i data-lucide="plus-circle" class="w-3.5 h-3.5"></i></button>
    <button class="bot-ctrl ctrl-stop" title="✕ Force Exit All"><i data-lucide="x-square" class="w-3.5 h-3.5"></i></button>
    <button class="bot-ctrl" title="⊞ Toggle Stopbuy"><i data-lucide="plus-square" class="w-3.5 h-3.5"></i></button>
    <span class="w-px h-4 bg-white/15 mx-1"></span>
    <button class="bot-ctrl" style="color:#facc15" title="🛡 Soft Kill"><i data-lucide="shield-alert" class="w-3.5 h-3.5"></i></button>
    <button class="bot-ctrl ctrl-stop" title="⚡ Hard Kill"><i data-lucide="zap" class="w-3.5 h-3.5"></i></button>
  </div>
</div>
```

### Mode Badge Variants

| Mode | Classes |
|------|---------|
| **LIVE** | `px-1.5 py-[2px] bg-up/15 text-up border border-up/25 text-[10px] font-bold rounded` |
| **DRY** | `px-1.5 py-[2px] bg-blue-500/15 text-blue-400 border border-blue-500/25 text-[10px] font-bold rounded` |
| **PAUSED** | `px-1.5 py-[2px] bg-yellow-400/15 text-yellow-400 border border-yellow-500/25 text-[10px] font-bold rounded` |
| **STOPPED** | `px-1.5 py-[2px] bg-down/15 text-down border border-down/25 text-[10px] font-bold rounded` |

---

## 30C. Tab Navigation Bar

```html
<div class="l-b flex items-end px-1 bg-black/50 shrink-0 overflow-x-auto gap-0">
  <!-- ACTIVE tab -->
  <button class="h-9 px-3.5 text-[10px] font-bold uppercase tracking-wider border-b-2 border-up text-white drawer-tab-btn whitespace-nowrap">
    Overview
  </button>
  <!-- INACTIVE tab -->
  <button class="h-9 px-3.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-white transition-colors drawer-tab-btn whitespace-nowrap">
    Trades
  </button>
</div>
```

### Tab Button Token Summary

| Property | Value |
|----------|-------|
| Height | `h-9` (36px) |
| Padding | `px-3.5` (14px) |
| Font size | `text-[10px]` |
| Font weight | `font-bold` |
| Text transform | `uppercase tracking-wider` |
| Active indicator | `border-b-2 border-up text-white` |
| Inactive | `text-muted hover:text-white transition-colors` |
| Container bg | `bg-black/50` |
| Wrap | `whitespace-nowrap` |
| Scroll | `overflow-x-auto` on container |

### 8 Tabs (in order)

1. **Overview** — KPIs, risk metrics, wallet, period P&L
2. **Trades** — Open positions + closed trades tables
3. **Performance** — Per-pair, entry tag, exit reason analysis
4. **Config** — Core config, risk management, whitelist, locks
5. **Backtest** — Results history for this strategy
6. **Hyperopt** — Optimization results
7. **FreqAI** — ML model results
8. **System & Log** — Health monitoring, logs

---

## 30D. Tab Content Area

```html
<div class="flex-1 overflow-y-auto">
  <div id="drawer-overview" class="drawer-tab-content p-4 flex flex-col gap-4">
    <!-- tab content -->
  </div>
</div>
```

| Property | Value |
|----------|-------|
| Container | `flex-1 overflow-y-auto` |
| Tab content | `drawer-tab-content p-4 flex flex-col gap-4` |
| Hidden tabs | `style="display:none"` |
| Gap between sections | `gap-4` (16px) |

---

## 30E. Overview Tab — KPI Cards (grid-cols-4)

```html
<div class="grid grid-cols-4 gap-2.5">
  <div class="bg-surface p-3 l-bd rounded">
    <div class="kpi-label">Closed P&L</div>
    <div class="text-up font-mono font-bold text-lg">+$4,210</div>
    <div class="text-up/50 text-[10px] font-mono mt-0.5">+14.2%</div>
  </div>
  <!-- more KPI cards -->
</div>
```

### KPI Card Pixel Spec

| Element | Classes |
|---------|---------|
| Card container | `bg-surface p-3 l-bd rounded` |
| Label | `kpi-label` (11px, uppercase, gray, tracking) |
| Value | `font-mono font-bold text-lg` (18px) |
| Sub-value | `text-[10px] font-mono mt-0.5` |
| Sub-value color (profit) | `text-up/50` |
| Sub-value color (neutral) | `text-white/35` |
| Grid | `grid grid-cols-4 gap-2.5` |

### Overview KPI Cards (4)

| Card | Label | Value color | Sub-value |
|------|-------|-------------|-----------|
| 1 | Closed P&L | `text-up` | `text-up/50` — percentage |
| 2 | Open P&L | `text-up` | `text-white/35` — "6 positions" |
| 3 | Win Rate | `text-white` | `text-white/35` — "297W / 115L" |
| 4 | Trades | `text-white` | `text-white/35` — "14d avg hold" |

---

## 30F. Overview Tab — Stats Grid (grid-cols-2)

```html
<div class="grid grid-cols-2 gap-2.5">
  <div class="bg-surface p-3 l-bd rounded">
    <div class="kpi-label mb-2">Risk Metrics</div>
    <div class="space-y-1.5 font-mono text-[12px]">
      <div class="flex justify-between">
        <span class="text-muted">Profit Factor</span>
        <span class="text-up font-bold">2.14</span>
      </div>
      <!-- more rows -->
    </div>
  </div>
</div>
```

### Stats Row Spec

| Element | Classes |
|---------|---------|
| Card | `bg-surface p-3 l-bd rounded` |
| Title | `kpi-label mb-2` |
| Row container | `space-y-1.5 font-mono text-[12px]` |
| Row | `flex justify-between` |
| Label | `text-muted` |
| Value (positive) | `text-up font-bold` |
| Value (negative) | `text-down font-bold` |
| Value (neutral) | `text-white` |

### Risk Metrics rows: Profit Factor, Max Drawdown, Sharpe Ratio, Sortino Ratio, Expectancy
### Bot Info rows: Exchange, Mode, Timeframe, Stake, Max Trades

---

## 30G. Overview Tab — Wallet Balance

```html
<div class="bg-surface p-3 l-bd rounded">
  <div class="kpi-label mb-2">Wallet Balance</div>
  <div class="grid grid-cols-3 gap-4 font-mono text-[12px]">
    <div>
      <span class="text-muted block text-[10px] mb-0.5">USDT</span>
      <span class="text-white font-bold">24,500.80</span>
    </div>
    <div>
      <span class="text-muted block text-[10px] mb-0.5">BTC</span>
      <span class="text-white font-bold">0.0000</span>
    </div>
    <div>
      <span class="text-muted block text-[10px] mb-0.5">Total Est.</span>
      <span class="text-white font-bold">$24,500</span>
    </div>
  </div>
</div>
```

---

## 30H. Overview Tab — Period P&L (grid-cols-3)

```html
<div class="grid grid-cols-3 gap-2.5">
  <div class="bg-surface p-3 l-bd rounded text-center">
    <div class="kpi-label">Today</div>
    <div class="text-up font-mono font-bold text-sm">+$142</div>
  </div>
  <div class="bg-surface p-3 l-bd rounded text-center">
    <div class="kpi-label">This Week</div>
    <div class="text-up font-mono font-bold text-sm">+$820</div>
  </div>
  <div class="bg-surface p-3 l-bd rounded text-center">
    <div class="kpi-label">This Month</div>
    <div class="text-up font-mono font-bold text-sm">+$2,140</div>
  </div>
</div>
```

---

## 30I. Trades Tab — Open Positions Table

```html
<h3 class="section-title mb-2 flex items-center gap-2">Open Positions <span class="text-white/30">(6)</span></h3>
<table class="w-full text-[13px] font-mono">
  <thead class="text-muted text-[13px] uppercase tracking-widest">
    <tr>
      <th class="text-left py-1.5 px-1 sortable filterable">Pair</th>
      <th class="text-left py-1.5 px-1 sortable filterable">Side</th>
      <th class="text-right py-1.5 px-1 sortable">Leverage</th>
      <th class="text-right py-1.5 px-1 sortable">Entry</th>
      <th class="text-right py-1.5 px-1 sortable">Current</th>
      <th class="text-right py-1.5 px-1 sortable">Stake</th>
      <th class="text-right py-1.5 px-1 sortable">P&L</th>
      <th class="text-right py-1.5 px-1 sortable">P&L %</th>
      <th class="text-right py-1.5 px-1 sortable">Duration</th>
      <th class="text-left py-1.5 px-1 sortable filterable">Enter Tag</th>
      <th class="text-right py-1.5 px-1 sortable">SL</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-white/[0.05]">
    <tr class="hover:bg-white/[0.04]">
      <td class="py-1.5 px-1 text-white font-medium">BTC/USDT</td>
      <td class="py-1.5 px-1"><span class="bg-up/12 text-up px-1 py-0.5 rounded text-[9px] font-bold">LONG</span></td>
      <td class="py-1.5 px-1 text-right">10x</td>
      <td class="py-1.5 px-1 text-right">64,220</td>
      <td class="py-1.5 px-1 text-right font-medium">65,110</td>
      <td class="py-1.5 px-1 text-right">100</td>
      <td class="py-1.5 px-1 text-right text-up font-bold">+$445</td>
      <td class="py-1.5 px-1 text-right text-up">+1.38%</td>
      <td class="py-1.5 px-1 text-right text-muted">2h14m</td>
      <td class="py-1.5 px-1 text-muted">ema_cross</td>
      <td class="py-1.5 px-1 text-right text-down">-10%</td>
    </tr>
  </tbody>
</table>
```

### Drawer Table Token Differences vs Standard

| Property | Standard (§4A) | Drawer Table |
|----------|-----------------|--------------|
| Cell padding | `px-5 py-3` | `py-1.5 px-1` |
| thead height | `h-10` sticky | inline, not sticky |
| thead font | `text-[11px]` | `text-[13px]` ← matches tbody |
| Container | `overflow-x-auto` | `overflow-x-auto` |

> [!WARNING]
> Drawer tables use **tighter padding** (`px-1 py-1.5`) because the drawer has limited width. The thead uses `text-[13px]` (not 11px) because these are narrower tables where visual density is already high.

---

## 30J. Config Tab — Key/Value Panels

```html
<div class="grid grid-cols-2 gap-2.5">
  <div class="bg-surface l-bd rounded p-3">
    <h3 class="section-title mb-2 flex items-center justify-between">
      Core Config
      <button class="text-[9px] text-muted hover:text-white l-bd px-1.5 py-0.5 rounded transition-colors">EDIT</button>
    </h3>
    <div class="space-y-1.5 font-mono text-[12px]">
      <div class="flex justify-between">
        <span class="text-muted">Strategy</span>
        <span class="text-white">TrendFollowerV3</span>
      </div>
    </div>
  </div>
</div>
```

### Config Section EDIT Button

```
text-[9px] text-muted hover:text-white l-bd px-1.5 py-0.5 rounded transition-colors
```

---

## 30K. Config Tab — Whitelist Badges

```html
<div class="flex flex-wrap gap-1.5">
  <span class="text-[9px] px-2 py-0.5 rounded bg-cyan-500/8 text-cyan-400 border border-cyan-500/20 font-medium">BTC/USDT</span>
</div>
```

---

## 30L. Bot Control Button CSS (`.bot-ctrl`)

```css
.bot-ctrl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;              /* EXACT: 28px × 28px */
  height: 28px;
  border-radius: 5px;
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.10);
  color: #9CA3AF;
  transition: all 0.15s;
  cursor: pointer;
}
.bot-ctrl:hover {
  background: #2a2a2a;
  color: #F5F5F5;
  border-color: rgba(255,255,255,0.20);
}
.bot-ctrl.ctrl-start:hover { color: #22c55e; border-color: rgba(34,197,94,0.3); }
.bot-ctrl.ctrl-stop:hover  { color: #ef4444; border-color: rgba(239,68,68,0.3); }
.bot-ctrl.ctrl-pause:hover { color: #eab308; border-color: rgba(234,179,8,0.3); }
```

### Icon sizing

| Context | Icon size |
|---------|-----------|
| Inside Fleet card (inline) | `w-3 h-3` (12px) |
| Inside Bot Drawer header | `w-3.5 h-3.5` (14px) |

### Separator between standard and kill buttons

```html
<span class="w-px h-4 bg-white/15 mx-1"></span>
```

### Soft Kill special color (always visible, not just hover)

```html
<button class="bot-ctrl" style="color:#facc15">
  <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i>
</button>
```

---

## 30M. Complete Visual Hierarchy (top to bottom)

```
┌───────────────────────────────────────────────────────┐
│ HEADER (p-4 pb-3 l-b bg-black shrink-0)               │
│   Bot Name + Mode Badge + Close Button                 │
│   9 Action Buttons (bot-ctrl)                          │
├───────────────────────────────────────────────────────┤
│ TABS (l-b bg-black/50 shrink-0 overflow-x-auto)       │
│   [Overview] [Trades] [Performance] [Config]           │
│   [Backtest] [Hyperopt] [FreqAI] [System & Log]       │
├───────────────────────────────────────────────────────┤
│ CONTENT (flex-1 overflow-y-auto)                       │
│   p-4 flex flex-col gap-4                              │
│                                                        │
│   ┌── KPI Row (grid-cols-4 gap-2.5) ───────────────┐ │
│   │ [P&L] [Open P&L] [Win Rate] [Trades]            │ │
│   └──────────────────────────────────────────────────┘ │
│   ┌── Stats (grid-cols-2 gap-2.5) ──────────────────┐ │
│   │ [Risk Metrics]     [Bot Info]                     │ │
│   └──────────────────────────────────────────────────┘ │
│   ┌── Wallet ────────────────────────────────────────┐ │
│   │ [USDT] [BTC] [Total Est.]                        │ │
│   └──────────────────────────────────────────────────┘ │
│   ┌── Period P&L (grid-cols-3 gap-2.5) ──────────────┐│
│   │ [Today] [This Week] [This Month]                  ││
│   └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

---

## 30N. JavaScript Functions

```javascript
// Open bot drawer — triggered by clicking a bot card in Fleet
function openBotDrawer(name, mode) {
  document.getElementById('drawer-bot-name').innerText = name;
  document.getElementById('drawer-bot-mode').innerText = mode;
  document.getElementById('bot-drawer').classList.add('open');
  document.getElementById('drawer-backdrop').classList.add('open');
}

// Close bot drawer
function closeBotDrawer() {
  document.getElementById('bot-drawer').classList.remove('open');
  document.getElementById('drawer-backdrop').classList.remove('open');
}

// Switch tabs inside drawer
function switchDrawerTab(tabId, btn) {
  document.querySelectorAll('.drawer-tab-content').forEach(el => el.style.display = 'none');
  document.getElementById(tabId).style.display = '';
  document.querySelectorAll('.drawer-tab-btn').forEach(b => {
    b.classList.remove('border-b-2', 'border-up', 'text-white');
    b.classList.add('text-muted');
  });
  btn.classList.add('border-b-2', 'border-up', 'text-white');
  btn.classList.remove('text-muted');
}
```

### Backdrop Overlay (MANDATORY)

```html
<!-- Place BEFORE the drawer in the DOM -->
<div id="drawer-backdrop" class="backdrop" onclick="closeBotDrawer()"></div>
<aside id="bot-drawer" class="drawer"> ... </aside>
```

```css
.backdrop {
  position: fixed;
  top: 0; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(2px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  z-index: 50;           /* below drawer z-60 */
}
.backdrop.open {
  opacity: 1;
  pointer-events: all;
}
```

> [!CAUTION]
> The `drawer-backdrop` MUST exist. When bot-drawer opens, backdrop opens too. Clicking backdrop calls `closeBotDrawer()`. Z-index: backdrop=50, drawer=60.

---

## 30O. Dashboard Right Sidebar Toggle

The dashboard has a 3-column layout. The RIGHT column (COL 3) can be collapsed, making the CENTER column (COL 2) expand to fill all available space.

### 3-Column Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ #page-dashboard  class="flex-1 overflow-hidden p-5 flex-col"   │
│                                                                 │
│  ┌ KPI BAR (shrink-0) ────────────────────────────────────────┐│
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌ LAYER 2: flex-1 flex gap-5 min-w-0 min-h-0 overflow-hidden ┐│
│  │                                                             ││
│  │ ┌─COL 1──────┐ ┌──COL 2────────────┐ ┌──COL 3──────┐      ││
│  │ │ w-[400px]   │ │ flex-1            │ │ w-[320px]    │      ││
│  │ │ min-w-[400] │ │ (auto-expands!)   │ │ min-w-[320]  │      ││
│  │ │ shrink-0    │ │ min-w-0           │ │ shrink-0     │      ││
│  │ │             │ │                   │ │              │      ││
│  │ │ Fleet List  │ │ Charts + Tables   │ │ Balance      │      ││
│  │ │ Bot Cards   │ │ Open Trades       │ │ Fees         │      ││
│  │ │ + Controls  │ │ Profit Chart      │ │ Telemetry    │      ││
│  │ │             │ │                   │ │              │      ││
│  │ └─────────────┘ └───────────────────┘ └──────────────┘      ││
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Column IDs and Classes

| Column | ID | Classes | Width |
|--------|-----|---------|-------|
| COL 1 Fleet | `dash-col-fleet` | `w-[400px] flex flex-col gap-5 min-w-[400px] shrink-0` | 400px fixed |
| COL 2 Center | `dash-col-center` | `flex-1 flex flex-col gap-5 min-w-0` | **auto-fills remaining** |
| COL 3 Sidebar | `dash-col-sidebar` | `w-[320px] flex flex-col gap-4 min-w-[320px] shrink-0 overflow-y-auto min-h-0` | 320px fixed |

> [!IMPORTANT]
> COL 2 is `flex-1` — it automatically expands to fill ALL space between COL 1 and COL 3. When COL 3 collapses to `width:0`, COL 2 grows by 320px+gap. **No manual width calculation needed on COL 2.**

### Toggle Button (inside COL 2 chart header)

```html
<button onclick="toggleRightSidebar()" 
  class="sidebar-toggle px-2 py-1 rounded text-muted hover:text-white hover:bg-white/8 transition-all opacity-40 hover:opacity-100" 
  title="Toggle right sidebar (Balance, Fees, Telemetry)">
  <i data-lucide="panel-right-close" class="w-3.5 h-3.5"></i>
</button>
```

When collapsed, icon changes to `panel-right-open`.

### Right Sidebar Collapse CSS

```css
#dash-col-sidebar {
  transition: width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
}
#dash-col-sidebar.collapsed {
  width: 0px !important;
  min-width: 0px !important;
  opacity: 0;
  overflow: hidden;
  padding: 0 !important;
  gap: 0 !important;
}
```

> [!CAUTION]
> **KEY MECHANISM:** The collapse works because:
> 1. `.collapsed` sets `width:0 !important; min-width:0 !important` → column disappears
> 2. `opacity:0; overflow:hidden` → content fades and clips
> 3. COL 2 is `flex-1` → it **automatically** grows to fill the freed space
> 4. All transitions animate smoothly (0.3s ease)
>
> You do NOT need to manually change COL 2's width. Flexbox handles it.

### Toggle JavaScript

```javascript
function toggleRightSidebar() {
  const sb = document.getElementById('dash-col-sidebar');
  const btn = document.querySelector('.sidebar-toggle');
  sb.classList.toggle('collapsed');
  btn.classList.toggle('rotated');
  // Swap icon
  const icon = btn.querySelector('[data-lucide]');
  if (sb.classList.contains('collapsed')) {
    icon.setAttribute('data-lucide', 'panel-right-open');
  } else {
    icon.setAttribute('data-lucide', 'panel-right-close');
  }
  setTimeout(() => lucide.createIcons(), 300);
}
```

---

## 30P. Fleet Column → Drawer Integration

### Fleet Card Click Handler

Every bot card in COL 1 must have:

```html
<div class="p-4 l-b hover:bg-white/[0.04] transition-colors group cursor-pointer"
     onclick="openBotDrawer('BotName', 'LIVE')">
  <!-- bot card content -->
</div>
```

### Bot Control Buttons Stop Propagation

All `.bot-ctrl` buttons inside fleet cards MUST have `onclick="event.stopPropagation()"` to prevent the card click from triggering the drawer:

```html
<button class="bot-ctrl ctrl-start" onclick="event.stopPropagation()">
  <i data-lucide="play" class="w-3 h-3"></i>
</button>
```

### Drawer Position Relative to Fleet

The drawer's `left` edge is calculated dynamically to sit right after the Fleet column:

```javascript
// Inside toggleSidebar(), recalculates on sidebar collapse:
const sidebarW = isCollapsed ? 56 : 240;       // left sidebar width
const fleetW = fleet ? fleet.offsetWidth : 400; // fleet column width
const padding = 20;                              // page padding
const gap = 20;                                  // flex gap
const left = sidebarW + padding + fleetW + gap;
document.documentElement.style.setProperty('--drawer-left', left + 'px');
```

```
  Sidebar   Page     Fleet Col     Gap   ← Drawer starts here
  (240px) + (20px) + (400px)    + (20px) = 680px
  --drawer-left: 680px
```

When left sidebar collapses (56px): `56 + 20 + 400 + 20 = 496px`
