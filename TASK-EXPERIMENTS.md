# TASK: Rebuild Experiments Section — Pixel Perfect from DESIGN-LINEAR-EDGE-FULL.html

## STATUS: FROM SCRATCH
The previous attempt changed less than 2% of the design. Treat this as a COMPLETE REBUILD. Delete the contents of every component file and rewrite from zero using the design HTML as the only source of truth.

---

## MANDATORY READ ORDER (BEFORE ANY CODE)
1. `CLAUDE.md` — rules, philosophy, field names
2. `prototypes/DESIGN-LINEAR-EDGE-FULL.html` lines 2011–2901 — THE ONLY SOURCE OF TRUTH for this task
3. `docs/PAGE_SPECS.md` — widget checklist
4. `docs/TYPES.ts` — TypeScript interfaces
5. `docs/ERROR_HANDLING.md` — error handling patterns

---

## TAILWIND CONFIG (MUST be in tailwind.config.js)
The design HTML defines these custom Tailwind colors. If they're not in the project's tailwind.config.js, ADD THEM:

```js
// FROM prototypes/DESIGN-LINEAR-EDGE-FULL.html line 11-19
theme: {
  extend: {
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      mono: ['"JetBrains Mono"', 'monospace']
    },
    colors: {
      background: "#000000",
      surface: "#0C0C0C",     // bg-surface
      border: "rgba(255,255,255,0.12)",
      borderHover: "rgba(255,255,255,0.22)",
      muted: "#9CA3AF",       // text-muted
      foreground: "#F5F5F5",  // text-foreground
      accent: "#FFFFFF",
      up: "#22c55e",          // text-up, bg-up
      down: "#ef4444"         // text-down, bg-down
    }
  }
}
```

## FONTS (MUST be loaded)
- **Inter** — body text (font-sans)
- **JetBrains Mono** — all data, tables, KPI values, terminals (font-mono)

---

## DESIGN SYSTEM TOKENS — EXACT CSS from DESIGN-LINEAR-EDGE-FULL.html
**⚠ THESE ARE COPY-PASTED FROM THE ACTUAL CSS (lines 21-98). DO NOT APPROXIMATE.**

### Custom CSS Classes (define in globals.css or equivalent)
```css
/* Borders — line 23-25 */
.l-bd { border: 1px solid rgba(255,255,255,0.10); }
.l-b  { border-bottom: 1px solid rgba(255,255,255,0.10); }
.l-r  { border-right: 1px solid rgba(255,255,255,0.10); }
/* NOTE: .l-t is used in design HTML but NOT defined in CSS. Define it as: */
.l-t  { border-top: 1px solid rgba(255,255,255,0.10); }

/* Scrollbar — line 27-29 */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

/* Grid background for charts — line 26 */
.l-grid { background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px); background-size: 24px 24px; }

/* Toggle — line 73-76 */
.builder-toggle { width: 36px; height: 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.10); background: #1a1a1a; cursor: pointer; position: relative; transition: all 0.2s; }
.builder-toggle.on { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.3); }
.builder-toggle .dot { width: 14px; height: 14px; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: all 0.2s; background: #9CA3AF; }
.builder-toggle.on .dot { left: 18px; background: #22c55e; }

/* Pill — line 86-89 */
.builder-pill { padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.18); font-size: 11px; cursor: pointer; transition: all 0.15s; background: transparent; color: #9CA3AF; }
.builder-pill:hover { border-color: rgba(255,255,255,0.22); color: #F5F5F5; }
.builder-pill.selected { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #F5F5F5; }
/* NOTE: In Experiments HTML, pills OVERRIDE with: text-[10px] px-2.5 py-1.5 text-center */

/* Input — line 90-92 */
.builder-input { width: 100%; height: 36px; padding: 0 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.22); background: #1a1a1a; color: #F5F5F5; font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; transition: border-color 0.15s; }
.builder-input:focus { border-color: rgba(255,255,255,0.30); }
.builder-input::placeholder { color: #9CA3AF; }

/* Select — line 93-94 */
.builder-select { height: 36px; padding: 0 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.22); background: #1a1a1a; color: #F5F5F5; font-size: 12px; font-family: 'JetBrains Mono', monospace; outline: none; cursor: pointer; -webkit-appearance: none; appearance: none; }
.builder-select:focus { border-color: rgba(255,255,255,0.30); }

/* Label — line 95 */
.builder-label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 6px; display: block; }

/* Card — line 96 */
.builder-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 16px; }

/* KPI — line 134-135 + responsive 177-178, 184-185 */
.kpi-label { font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500; margin-bottom: 4px; }
.kpi-value { font-family: 'JetBrains Mono', monospace; font-weight: 700; }
/* Responsive: kpi-value becomes 16px, kpi-label becomes 10px at smaller screens */

/* Section Title — line 136 */
.section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF; }

/* Sortable Table Headers — line 32-38 */
th.sortable { cursor: pointer; user-select: none; position: relative; white-space: nowrap; }
th.sortable:hover { color: #fff; background: rgba(255,255,255,0.04); }
th.sortable::after { content: '⇅'; margin-left: 4px; opacity: 0.25; font-size: 10px; }
th.sortable:hover::after { opacity: 0.6; }
th.sortable.sort-asc::after { content: '↑'; opacity: 0.9; color: #fff; }
th.sortable.sort-desc::after { content: '↓'; opacity: 0.9; color: #fff; }

/* Filterable Column Headers — line 40-55 */
th.filterable { position: relative; cursor: pointer; }
th.filterable::before { content: ''; display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid rgba(255,255,255,0.2); margin-right: 5px; vertical-align: middle; transition: border-color 0.15s; }
th.filterable:hover::before { border-top-color: rgba(255,255,255,0.6); }

/* Tab visibility — line 66-67 */
.exp-tab { display: none; }
.exp-tab.active { display: flex; }
```

### KEY DIFFERENCES vs what you might assume:
| Token | WRONG assumption | CORRECT from CSS |
|-------|-----------------|------------------|
| builder-input height | h-[34px] | **h-[36px]** (height: 36px) |
| builder-input border | border-white/[0.10] | **border-white/[0.22]** (rgba 0.22) |
| builder-input color | text-white/80 | **text-foreground** (#F5F5F5) |
| builder-select border | border-white/[0.10] | **border-white/[0.22]** (rgba 0.22) |
| builder-label size | text-[10px] | **text-[11px]** (font-size: 11px) |
| builder-label color | text-white/40 | **text-muted** (#9CA3AF) |
| builder-label margin | mb-1 | **mb-1.5** (margin-bottom: 6px) |
| builder-toggle size | w-8 h-4 | **w-[36px] h-[20px]** |
| builder-toggle bg | bg-white/15 | **bg-[#1a1a1a]** |
| builder-toggle .on bg | bg-[#22c55e] | **bg-[rgba(34,197,94,0.12)]** (subtle!) |
| builder-pill border | border-white/[0.10] | **border-white/[0.18]** |
| builder-pill radius | rounded | **rounded-lg** (8px) |
| builder-pill bg | bg-white/[0.03] | **bg-transparent** |
| builder-card bg | bg-black/40 | **bg-white/[0.06]** |
| builder-card border | border-white/[0.08] | **border-white/[0.18]** |
| builder-card padding | p-3 | **p-4** (16px) |
| section-title size | text-[11px] | **text-[12px]** |
| section-title color | text-white/40 | **text-muted** (#9CA3AF) |
| kpi-label size | text-[9px] | **text-[11px]** (10px responsive) |
| kpi-label color | text-white/30 | **text-[#6B7280]** |
| kpi-label weight | font-bold (700) | **font-medium** (500) |
| l-b border | border-white/[0.08] | **border-white/[0.10]** |

---

## FILE STRUCTURE
```
frontend/src/app/experiments/
├── page.tsx                              — Experiments LIST page (strategy cards)
└── [strategy]/
    ├── page.tsx                          — Strategy detail page (header + pipeline + tabs + overlays)
    └── components/
        ├── BacktestTab.tsx               — Backtest config + results
        ├── HyperoptTab.tsx               — Hyperopt config + results
        ├── FreqAITab.tsx                 — FreqAI config + results
        ├── AiReviewTab.tsx               — AI Review tab
        ├── ValidationTab.tsx             — Validation config + results
        ├── AllTestsOverlay.tsx           — All Tests overlay
        ├── CompareOverlay.tsx            — Compare overlay
        └── AnalysisOverlay.tsx           — Analysis overlay
```

---

## ELEMENT-BY-ELEMENT SPECIFICATION

### 0. Experiments LIST Page (experiments/page.tsx)
**NOTE:** The design HTML does NOT have a separate experiments list page — `page-experiments` goes straight to the detail view. However, our app NEEDS a list page. Build it using the **Strategies page pattern** (page-strategies, design line 3376+) adapted for experiments:

- Same bg-black page background
- Header bar: h-12 with "Experiments" title + filter/search controls
- Grid of strategy cards showing: name, lifecycle status, pipeline progress (mini pipeline tracker), test count, best result, last test date
- Cards use `strat-card` pattern: `bg-white/[0.03] border border-white/[0.12] hover:bg-white/[0.06] hover:border-white/[0.20] rounded-md cursor-pointer`
- Clicking a card navigates to `/experiments/[strategyName]`
- This is the ONLY page where you have creative freedom — match the overall design language but there's no pixel-perfect reference

---

### 1. Strategy Header (design line 2013–2029)
Container: `h-14 bg-black l-b flex items-center px-5 gap-4 shrink-0`

LEFT side (flex items-center gap-3 flex-1 min-w-0):
- Back button: `flex items-center gap-1.5 px-2.5 py-1 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors shrink-0` — ArrowLeft icon w-3.5 h-3.5 + "Back"
- Divider: `h-5 w-px bg-white/10`
- Flask icon: `w-4 h-4 text-white/40 shrink-0`
- Strategy name: `text-[13px] font-bold text-white truncate`
- Status badge: `px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[9px] uppercase font-bold tracking-wider rounded shrink-0`

RIGHT side (flex items-center gap-1.5 shrink-0):
- All Tests button: `flex items-center gap-1.5 px-3 py-1.5 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors` — 📋 All Tests `<span class="text-white/30">(142)</span>`
- Compare button: same classes — ⚖️ Compare
- Analysis button: same classes — 📊 Analysis
- Divider: `h-5 w-px bg-white/10 mx-1`
- + New Test: `flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black text-[11px] font-bold rounded hover:bg-white/85 transition-colors`

### 2. Pipeline Tracker (design line 2031–2042)
Container: `h-10 bg-black l-b flex items-center px-5 shrink-0 overflow-x-auto`

Inner wrapper: `flex items-center gap-0`
7 steps in sequence: Backtest → Hyperopt → FreqAI → Validation → AI Review → Paper → Live
Each step container: `flex items-center gap-1.5 px-2.5`
Each circle: `w-4 h-4 rounded-full flex items-center justify-center text-[8px]`
Each label: `text-[10px]`
States:
- Completed: circle adds `border border-up text-up font-bold` with ✓, label `text-up font-bold`, connector `w-5 h-px bg-up/50`
- Skipped: circle adds `border-dashed border border-white/20 text-white/20` (NO font-bold) with ⊘, label `text-white/30`, connector `w-5 h-px border-t border-dashed border-white/15`
- Active: circle adds `border border-white bg-white text-black font-bold animate-pulse` with ●, label `text-white font-bold` — **sub-label inside:** `<span class="text-white/30 font-normal ml-1">Day 12/30</span>`
- Pending: circle adds `border border-white/15 text-white/20` with ○, label `text-white/30`, NO connector after last step

### 3. Tab Bar (design line 2045–2052)
Container: `l-b flex items-end px-1 bg-black/50 shrink-0 overflow-x-auto gap-0`

5 tabs: Backtest, Hyperopt, FreqAI, AI Review, Validation
Each tab: `h-9 px-3.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap`
Active: `border-b-2 border-up text-white`
Inactive: `border-b-2 border-transparent text-muted hover:text-white transition-colors`

### 4. Tab Content Area
Container: `flex-1 p-4 overflow-hidden relative`

---

### 5. BACKTEST TAB (design lines 2057–2282) — BacktestTab.tsx
Tab layout: `h-full flex flex-row gap-3` (all left/right tabs use this)

#### Left Panel — Config (w-[400px])
Container: `w-[400px] flex flex-col gap-0 bg-surface l-bd rounded-md shadow-xl shrink-0 h-full overflow-hidden`
Header: `h-10 l-b flex items-center px-4 bg-black/40 shrink-0` → section-title "Backtest Configuration"
Body: `p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto`

Form fields (EXACT order):
1. **Strategy** — builder-select, full width
2. **Timerange Start / End** — 2x builder-input type="date", flex gap-2
3. **Timeframe / Timeframe Detail** — builder-select + builder-select, flex gap-2
4. **Starting Capital / Stake Amount** — builder-input number + builder-input text, flex gap-2
5. **Max Open Trades / Fee** — builder-input number + builder-input text, flex gap-2
6. **Flags** (l-t pt-3) — builder-label "Flags" + toggle container `flex flex-col gap-2.5 mt-1` — 4 toggles: Enable Protections (on), Dry Run Wallet, Position Stacking, Enable Shorts — each: flex items-center justify-between, text-muted text-[11px] + builder-toggle
7. **Breakdown** (l-t pt-3) — builder-label "Breakdown" + pill grid `grid grid-cols-3 gap-1.5 mt-1` — 3 pills: day, week, ✓ month (selected) — builder-pill text-[10px] px-2.5 py-1.5 text-center
8. **Cache** (l-t pt-3) — builder-select: day, none, week, month
9. **Strategy Config Preview** (l-t pt-3) — builder-label: `Strategy Config <span class="text-muted text-[8px] normal-case font-normal">(read from strategy)</span>` + `builder-card space-y-1.5 text-[11px] font-mono` with 5 rows: stoploss (text-down font-bold), trailing_stop (text-up), trailing_stop_positive (text-white), use_exit_signal (text-up), minimal_roi (`text-white text-[9px]` — smaller font for JSON) — each row `flex justify-between`, label `text-muted`
10. **Run buttons** (flex gap-1.5 l-t pt-3) — all share: `py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors`
    - ▶ Start Backtest: `flex-1 bg-white text-black hover:bg-white/85`
    - ⏹ Stop: `px-3 l-bd text-down hover:bg-down/10`
    - ↺ Reset: `px-3 l-bd text-muted hover:text-white hover:bg-white/5`
11. **Progress** (l-t pt-3) — `flex justify-between text-[11px] font-mono mb-1.5` → `<span class="text-muted">Progress</span>` + `<span class="text-white font-bold">Completed · 142 trades · ETA —</span>` + bar: `w-full h-1.5 bg-white/10 rounded-full` → inner `h-full bg-up rounded-full transition-all` with dynamic width
12. **Terminal Output** (l-t pt-3) — builder-label "Terminal Output" + `mt-1 bg-black rounded p-3 font-mono text-[10px] text-muted leading-relaxed l-bd max-h-[300px] overflow-y-auto` — log line colors: default=text-muted, important=`text-white`, success=`text-up font-bold`

#### Right Panel — Results (flex-1)
Container: `flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1`

Widgets (EXACT order):
1. **Winner Banner** — `bg-up/[0.04] l-bd rounded-md p-3 shadow-xl border-l-2 border-l-up relative overflow-hidden`
   - Decorative circle: `absolute top-0 right-0 w-24 h-24 bg-up/[0.03] rounded-full -translate-y-8 translate-x-8`
   - Title row (`flex justify-between items-center mb-2 relative z-10`):
     - Left: `text-white font-mono text-[12px] font-bold` "★ AlphaTrend_V5 · 1h · 142 trades"
     - Right (`flex items-center gap-2`):
       - Badge: `px-1.5 py-0.5 text-[9px] font-bold bg-up/12 text-up rounded border border-up/25` "COMPLETED"
       - Deploy button: `h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up` **with INLINE STYLE:** `style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#F5F5F5"` — "Deploy"
   - KPI row: `grid grid-cols-7 gap-2 text-[11px] font-mono relative z-10`
     Each KPI: label `text-muted block text-[9px]` + value (colored appropriately)
     7 KPIs: Profit (+42.12%), Profit $ (+$4,212), Trades (142), Win Rate (72.4%), Sharpe (3.92), Max DD (-2.1%), Duration (365 days)

2. **KPI Cards** — `grid grid-cols-6 gap-2`
   6 cards: Total Profit, Win Rate, Trades, Max Drawdown, Sharpe Ratio, Sortino Ratio
   Each: `bg-surface p-2.5 l-bd rounded` → kpi-label + kpi-value + optional sub-text `text-[9px] font-mono`
   Sub-text colors: Total Profit=`text-up`, Win Rate=`text-muted`, Trades=`text-muted`, Max DD=`text-down`, last 2 have no sub-text

3. **Advanced Stats** — `grid grid-cols-2 gap-2`
   Left card (5 rows): Profit Factor, Expectancy, SQN, Calmar Ratio, CAGR
   Right card (5 rows): Starting Balance, Final Balance, Best Day, Worst Day, Avg Duration
   Each card: `bg-surface l-bd rounded p-2.5 space-y-1.5 text-[11px] font-mono`

4. **Profit Over Time Chart** — `h-[200px] bg-surface l-bd rounded-md flex flex-col overflow-hidden relative`
   Header (`flex items-center justify-between px-5 py-2.5 shrink-0 gap-3`): section-title "Profit Over Time" `text-white/50 whitespace-nowrap` + toggle button groups in `flex gap-0 shrink-0` (see CRITICAL DETAILS → Chart Toggle Button Groups)
   Chart body: `flex-1 px-5 pb-4 relative`
   Grid background: `<div class="absolute inset-0 l-grid opacity-20"></div>`
   Legend (see CRITICAL DETAILS → Chart Legend): "Profit" line + "Trade Count" bars
   Y-axis labels (see CRITICAL DETAILS → Chart Axis Labels): 14k, 12k, 10k, 8k
   X-axis labels: 01-15 through 12-15
   Use Recharts for actual chart (line + bar combo). Design shows green profit line + grey trade count bars.

5. **Master Table** — `flex-1 bg-surface l-bd rounded-md flex flex-col min-h-[250px] overflow-hidden`
   Tab bar: `h-10 l-b flex items-center bg-black/40 shrink-0 border-b-2 border-transparent overflow-x-auto whitespace-nowrap` with 5 sub-tabs:
   Each sub-tab button: `h-full px-4 font-bold text-[11px] uppercase tracking-wide shrink-0`
   Active: `border-b-2 border-up text-white` | Inactive: `text-muted hover:text-white transition-colors`
   Each tab content panel: `flex-1 overflow-x-auto overflow-y-auto` (some have `p-0`, some have `p-4`)

   Sub-tabs:
   - **Closed Trades** — columns: Date, Pair, Side, Entry, Exit, Profit %, Value, Fee, Duration, Exit Reason
   - **Per-Pair** — columns: Pair, Trades, profit_abs, profit_ratio, Win Rate, Avg Profit, Avg Dur.
   - **Entry Tags** — columns: Tag, Trades, Wins, Losses, Win Rate, Avg P&L %, Total P&L, Avg Dur., Best Pair, Expectancy — **Tag column uses colored badges** (see CRITICAL DETAILS → Entry Tag Badges)
   - **Exit Reasons** — columns: Reason, Exits, Wins, Losses, Win Rate, Avg P&L %, Total P&L, Avg Dur., Best Pair, Expectancy
   - **History** — columns: #, Run Date, TF, Timerange, Trades, Profit, Win%, Sharpe, Actions (Load/Del — see CRITICAL DETAILS → History Table Action Buttons for exact styles)

   Table styling: `text-[13px] font-mono whitespace-nowrap`
   Header: `sticky top-0 bg-surface z-10` → row: `text-muted text-[11px] uppercase tracking-widest`
   **Cell padding in Backtest/Hyperopt/Validation tables: `px-2 py-1.5`** (smaller than overlays!)
   Header cells: `px-2 py-1.5 font-semibold` + sortable/filterable classes where applicable
   Body: `divide-y divide-white/[0.05]`
   Rows: `hover:bg-white/[0.04]`
   Winner row: `bg-up/[0.02]` with ★ prefix
   Side badges: LONG = `bg-up/12 text-up px-1 py-0.5 rounded text-[9px] font-bold`, SHORT = `bg-down/12 text-down`

   **⚠ Load More button at bottom of Closed Trades:**
   `w-full py-1.5 text-[10px] text-muted font-mono hover:bg-white/5 transition-colors l-t` — "Load More (138 remaining)"

---

### 6. HYPEROPT TAB (design lines 2284–2573) — HyperoptTab.tsx

#### Left Panel — Config (w-[400px])
Same container pattern as Backtest.

Form fields (EXACT order):
1. **Strategy** — builder-select
2. **Loss Function** (l-t) — grid-cols-3 gap-1.5, 6 pills: Sharpe, Sortino, Calmar, MaxDrawDown, OnlyProfit, ProfitDD
3. **Sampler** (l-t pt-3) — grid-cols-3 gap-1.5, 5 pills: TPE, Random, CmaEs, NSGAII, QMC
4. **Epochs / Min Trades** — 2x builder-input number, flex gap-2
5. **Timerange Start / End** — 2x builder-input date, flex gap-2
6. **Timeframe / Jobs** — builder-select + builder-select, flex gap-2
7. **Max Open Trades / Stake Amount** — builder-input + builder-input, flex gap-2
8. **Fee / Random State** — builder-input + builder-input number, flex gap-2
9. **Early Stop / Pairs** — builder-input + builder-input, flex gap-2
10. **Spaces** (l-t pt-3) — grid-cols-3 gap-1.5, 6 pills: buy, sell, roi, stoploss, trailing, protection
11. **Flags** (l-t pt-3) — 4 toggles: Enable Protections, Position Stacking, Disable Max Positions, Print All Results
12. **Run** — same 3-button pattern (▶ Start Hyperopt, ⏹, ↺)
13. **Progress** — same pattern (Epoch X/Y)
14. **Terminal Output** — same pattern

#### Right Panel — Results (flex-1)
1. **Winner Banner** — same pattern, title "★ Best Epoch #147 · SharpeHyperOptLoss", badge "BEST: -0.1555"
   KPI row grid-cols-7: Profit, Profit $, Trades, Win Rate, Sharpe, Max DD, Avg Dur.

2. **Convergence Chart** — `h-[200px] bg-surface l-bd rounded-md flex flex-col overflow-hidden shadow-xl relative`
   Header (`flex items-center justify-between px-5 py-3 shrink-0 gap-3`): section-title "Convergence" `text-white/50 whitespace-nowrap` + toggle button groups in `flex gap-0 shrink-0` (see CRITICAL DETAILS → Chart Toggle Button Groups)
   Chart body: `flex-1 px-5 pb-4 relative`
   Grid background: `<div class="absolute inset-0 l-grid opacity-20"></div>`
   Legend (see CRITICAL DETAILS → Chart Legend): "Best Objective" line + "Trades/Epoch" bars
   Y-axis: 0.0, -0.05, -0.10, -0.15, -0.20
   X-axis: 0, 50, 100, 150, 200
   Recharts line chart showing best objective over epochs + trades/epoch bars

3. **Tabbed Results** — `flex-1 bg-surface l-bd rounded-md flex flex-col min-h-[250px] overflow-hidden shadow-xl`, 5 sub-tabs:
   - **Epoch Results** — columns: Epoch, Trades, Avg Profit, Total Profit, Profit $, Avg Dur., Win%, Max DD, Objective
   - **Best Parameters** — formatted Python dict display with Copy Python/Copy JSON/CSV buttons (see CRITICAL DETAILS → Hyperopt Best Parameters Tab for full layout + color coding)
   - **Param Importance** — horizontal bar chart with color-coded importance levels (see CRITICAL DETAILS → Hyperopt Param Importance Tab for exact classes)
   - **Compare Runs** — metric comparison table: Metric, Run #1, Run #2, Run #3, Δ Best
   - **Run History** — columns: #, Date, Strategy, Loss Fn, Epochs, Best, Profit, Trades, Objective, Actions

---

### 7. FREQAI TAB (design lines 2575–2694) — FreqAITab.tsx

#### Left Panel — Config (w-[400px])
Form fields:
1. **Source HO Epoch** — builder-select (references hyperopt results)
2. **Train Start / Train End** — date inputs
3. **BT Start / BT End** — date inputs
4. **Feature Period / Label Period** — number inputs
5. **ML Models** (l-t pt-3) — builder-label "ML Models" + `flex flex-col gap-2.5` (no mt-1 here!) — 4 toggles: LightGBM-Regressor (on), XGBoost-Regressor (on), CatBoost-Regressor, LightGBM-Classifier
6. **Outlier Detection** (l-t pt-3) — builder-label "Outlier Detection" + top row `flex gap-2 mb-2`: Method select + DI Threshold input — then bottom `flex flex-col gap-2.5 mt-2` (note: mt-2 not mt-1!): 3 toggles: Use PCA, Add Noise (on), Correlated Pairs (on)
7. **Matrix Calculation** (l-t pt-3) — builder-card with **blue** info badge (see CRITICAL DETAILS → FreqAI Matrix Calculation Info Badge for exact colors) showing "X models × Y outlier × Z PCA × W noise = N tests" + Est. Time
8. **Run** — ▶ Run Matrix (N), ⏹, ↺
9. **Progress** — X/Y runs
10. **Terminal Output**

#### Right Panel — Results (flex-1)
1. **Winner Banner** — "★ LightGBM-R · DI · No PCA · Noise", badge "★ BEST"
   KPI row grid-cols-7: Profit, Profit $, Trades, Win Rate, Sharpe, Max DD, Avg Dur.

2. **Matrix Results** — standalone `<h3 class="section-title">Matrix Results</h3>` + `<div class="overflow-x-auto">` wrapper around table
   Columns: ★, Model, Outlier, PCA, Noise, profit_% (sort-desc), Sharpe, Max DD, Trades, Win%

---

### 8. AI REVIEW TAB (design lines 2696–2748) — AiReviewTab.tsx
Layout: `h-full flex flex-col gap-3 overflow-y-auto` (NO left/right split — single column)

1. **Header bar** (`flex items-center gap-3`) — section-title "AI Review" + right side (`flex items-center gap-2 ml-auto`): Scope badge, Model select (builder-select), Cost badge, ▶ Analyze button (see CRITICAL DETAILS → AI Review Header Bar Detail for exact classes)
2. **Score Cards** — `grid grid-cols-5 gap-2`
   Each: `bg-surface p-3 l-bd rounded` → kpi-label + kpi-value + rating text
   **EXACT per-card colors (from design HTML):**
   - Robustness: kpi-value `text-up text-xl` → 82, rating `text-[10px] text-up font-mono` "Excellent"
   - Risk: kpi-value `text-xl` (NO color class = white) → 65, rating `text-[10px] text-muted font-mono` "Moderate"
   - Execution: kpi-value `text-xl` → 78, rating `text-[10px] text-muted font-mono` "Good"
   - Overfitting: kpi-value `text-up text-xl` → 88, rating `text-[10px] text-up font-mono` "Low Risk"
   - Overall: `border-l-2 border-l-up` on card, kpi-value `text-white text-xl` → 78, rating `text-[10px] text-up font-mono` "Production Ready"
3. **Analysis Content** — `grid grid-cols-2 gap-2.5`
   Each card: `bg-surface l-bd rounded p-3 text-[11px] font-mono space-y-2`
   Left: ✓ Strengths (header: see CRITICAL DETAILS → AI Review Strengths/Concerns Headers)
   Right: ⚠ Concerns (header: see CRITICAL DETAILS)
4. **Recommendation** — `bg-surface l-bd rounded p-3 text-[11px] font-mono border-l-2 border-l-white/30` — sub-header (see CRITICAL DETAILS → AI Review Recommendation Sub-header) + text `text-muted leading-relaxed`
5. **Analysis History** — standalone `<h3 class="section-title">Analysis History</h3>` + BARE table (NO bg-surface l-bd rounded-md wrapper — unlike other tables!) — columns: Date (sort-desc), Source, Model, Score, Cost, Actions (View button)

---

### 9. VALIDATION TAB (design lines 2750–2875) — ValidationTab.tsx

#### Left Panel — Config (w-[400px])
Form fields:
1. **Source Test** — builder-select
2. **Verification Name** — builder-input text
3. **OOS Start / OOS End** — date inputs
4. **Pass/Fail Thresholds** label (l-t pt-3)
5. **Min Profit % / Max DD %** — number inputs
6. **Min Trades % / Min Win Rate %** — number inputs
7. **Validation Checks** (l-t pt-3) — 4 toggles: OOS Backtest, Lookahead Bias Check, Recursive Stability, Walk-Forward
8. **Warning box** — `bg-yellow-500/[0.04] border border-yellow-500/15 rounded px-3 py-2 flex gap-2` — `<span class="text-yellow-400">⚠</span>` + text `text-[10px] text-muted` with `<b class="text-yellow-400">NOT overlap</b>` bold yellow
9. **Run** — ▶ Run Verification, ⏹, ↺
10. **Progress** — X/X checks
11. **Terminal Output**

#### Right Panel — Results (flex-1)
1. **Winner Banner/Verdict** — same banner pattern, title "✓ PASS — All Validations (3/3)", badge "PRODUCTION READY"
   Action buttons (TWO buttons with DIFFERENT inline styles):
   - → Paper: `h-7 px-3 rounded-md text-[10px] font-bold` with **inline style:** `background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#F5F5F5`
   - → Live: `h-7 px-3 rounded-md text-[10px] font-bold` with **GREEN inline style:** `background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.20);color:#22c55e`
   KPI row grid-cols-7: OOS Profit (+31.2%), Ratio (74.1%), Trades (89), Win Rate (68.5%), Sharpe (3.14), Max DD (-2.8%), Lookahead (Clean)

2. **Training vs OOS Comparison** — `bg-surface l-bd rounded-md flex flex-col min-h-[200px] overflow-hidden shadow-xl`
   Header: `h-10 l-b flex items-center px-4 bg-black/40 shrink-0` → section-title "Training vs OOS Comparison"
   Body: `flex-1 overflow-y-auto`
   Table columns: Metric, Training, OOS, Ratio, Threshold, Status (✓ or info)
   7 rows: Profit %, Max DD, Trades, Win Rate, Sharpe, Sortino, Profit Factor

3. **Lookahead + Recursive** — `grid grid-cols-2 gap-3`
   - Lookahead card: `bg-surface l-bd rounded-md p-3 shadow-xl` — header `flex justify-between items-center mb-2`: section-title "Lookahead Bias" + ✓ CLEAN badge `text-up font-bold text-[10px]` + description `text-[11px] text-muted font-mono mb-2` + 3 stat rows (`space-y-1.5 text-[11px] font-mono`, each flex justify-between)
   - Recursive card: `bg-surface l-bd rounded-md p-3 shadow-xl` — header `flex justify-between items-center mb-2`: section-title "Recursive Stability" + ✓ STABLE badge `text-up font-bold text-[10px]` + description `text-[11px] text-muted font-mono mb-2` + table (Iter, Shift, Profit, Δ) — **NOTE: cell padding here is `px-2 py-1` NOT py-1.5!**

4. **Final Badge** — `bg-up/[0.04] border border-up/15 rounded-md px-4 py-3 text-center shadow-xl` — "✓ All Validations Passed" `text-up font-bold text-[13px]` + detail text `text-muted text-[11px] ml-3 font-mono`

---

### 10. OVERLAYS (design lines 2877–2897)

Overlay container: `absolute inset-0 bg-surface z-30 flex flex-col` (hidden by default, toggle with state)
Header: `h-10 bg-black l-b flex items-center px-4 gap-3 shrink-0`
- Title: `text-[12px] font-bold text-white uppercase tracking-wider`
- Spacer: `flex-1`
- Close button: `px-3 py-1 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors` → "✕ Close"

#### AllTestsOverlay.tsx
Body: `flex-1 p-4 overflow-y-auto`

Filter bar (`flex gap-3 mb-4 items-center`):
- Search input: `bg-[#1a1a1a] l-bd px-3 py-2 text-white outline-none rounded text-[12px] font-mono w-[240px]` placeholder="Search tests..."
- Type select: `bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono` — options: All Types, Backtest, Hyperopt, FreqAI
- Status select: same style — options: All Status, Completed, Running, Failed
- Spacer: `flex-1`
- Page info: `text-[10px] text-white/30 font-mono` — "142 total · Page 1/8"

Table container: `bg-surface l-bd rounded-md overflow-hidden`
Table: `w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono`
Header: `bg-surface l-b text-[11px] uppercase tracking-widest text-muted` — cells `px-4 py-2.5`
Columns: # (sortable), Type (sortable filterable), Name (sortable), Date (sortable sort-desc), Profit% (text-right sortable), Sharpe (text-right sortable), Trades (text-right sortable), Status (text-center sortable filterable), Actions (text-center)
Body: `divide-y divide-white/[0.05] text-white/70` — cells `px-4 py-2`
Type badge: `px-1.5 py-0.5 rounded text-[8px] bg-white/5 border border-white/10 text-white/50` — "HO", "BT", "FAI"
Actions: Promote button `text-[9px] px-2 py-0.5 bg-up/10 border border-up/20 text-up rounded hover:bg-up/20` or Load button `text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 text-white/50 rounded hover:bg-white/10`

#### CompareOverlay.tsx
Body: `flex-1 p-4 overflow-y-auto`

Selector row (`flex gap-4 mb-4`):
- Test A: `flex-1` — label `text-white/45 mb-1 text-[10px] uppercase tracking-wider font-bold` "Test A" + select `w-full bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono`
- VS divider: `flex items-end pb-2 text-white/20 text-[11px] font-bold` "VS"
- Test B: same as Test A

Table container: `bg-surface l-bd rounded-md overflow-hidden`
Table: `w-full text-[13px] font-mono`
Header: `bg-surface l-b text-[11px] uppercase tracking-widest text-muted` — Metric (text-left), Test A (text-right), Test B (text-right), Winner (text-center)
Body: `divide-y divide-white/[0.05] text-white/60` — cells `px-4 py-2`
Rows: Profit %, Sharpe, Max DD, Win Rate, Trades
Winner column: `text-up` with "A ✓" or "B ✓", or `text-muted` with "—"

#### AnalysisOverlay.tsx
Body: `flex-1 p-4 overflow-y-auto`

Selector row (`flex gap-3 mb-4`):
- Run select: label `text-white/45 mb-1 text-[10px] uppercase tracking-wider font-bold` "Select Run" + select `bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono`
- View tabs (`flex items-end gap-1 pb-0.5`): 3 buttons — Trades (active: `bg-white/10 text-white`), Per Pair, Exit Reasons. All: `px-3 py-2 l-bd text-[10px] font-bold rounded uppercase tracking-wider`. Inactive: `bg-white/[0.03] text-white/40 hover:text-white`

Table container: `bg-surface l-bd rounded-md overflow-hidden`
Table: `w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono`
Header: `bg-surface l-b text-[11px] uppercase tracking-widest text-muted` — cells `px-3 py-2.5`
Columns: # (sortable), Pair (sortable filterable), Side (sortable filterable), Profit% (text-right sortable sort-desc), Profit$ (text-right sortable), Open (sortable), Close (sortable), Duration (text-right sortable), Exit (sortable filterable)
Body: `divide-y divide-white/[0.05] text-white/70` — cells `px-3 py-2`

---

## PIXEL PERFECT RULES

1. **Every class from the design HTML must be replicated EXACTLY** — don't substitute, don't simplify, don't "improve"
2. **Use the CSS classes defined above** — builder-toggle, builder-pill, builder-input, builder-select, builder-label, builder-card, section-title, kpi-label, kpi-value, l-bd, l-b, l-t, l-grid, sortable, filterable
3. **DO NOT use Tailwind approximations for CSS classes** — if the design uses `.builder-input` (which is CSS with height:36px, border 0.22), do NOT replace with `h-[34px] border-white/[0.10]`. Use the actual CSS class or replicate its EXACT properties.
4. **bg-surface = #0C0C0C** — defined in Tailwind config, use `bg-surface`
5. **l-bd = border: 1px solid rgba(255,255,255,0.10)** — not 0.08, not 0.12, exactly 0.10
6. **l-b = border-bottom: 1px solid rgba(255,255,255,0.10)** — same opacity as l-bd (0.10, NOT 0.08)
7. **builder-input/select height = 36px** — NOT 34px, NOT 32px
8. **builder-input/select border = rgba(255,255,255,0.22)** — THICKER than l-bd. This is intentional.
9. **builder-label font-size = 11px** — NOT 10px
10. **kpi-label color = #6B7280** — NOT white/30, it's a specific gray
11. **kpi-label weight = 500 (medium)** — NOT bold (700)
12. **section-title font-size = 12px** — NOT 11px
13. **font-mono** on ALL data display, tables, KPI values, terminal output
14. **divide-y divide-white/[0.05]** on ALL table bodies
15. **hover:bg-white/[0.04]** on ALL table rows
16. **Winner rows get bg-up/[0.02]** and ★ prefix
17. **LONG/SHORT badges** — bg-up/12 text-up vs bg-down/12 text-down, BOTH px-1 py-0.5 rounded text-[9px] font-bold
18. **builder-pill in Experiments HTML overrides base CSS** — pills use `text-[10px] px-2.5 py-1.5 text-center` which OVERRIDES the CSS's 11px/6px-14px padding. Copy the HTML exactly.
19. **builder-toggle .on background is SUBTLE** — rgba(34,197,94,0.12), NOT solid green. The dot turns green, not the track.
20. **Fonts: Inter (body) + JetBrains Mono (data)** — both must be loaded

---

## FUNCTIONAL REQUIREMENTS

1. **Tabs switch content** — only one tab visible at a time (Backtest, Hyperopt, FreqAI, AI Review, Validation)
2. **Sub-tabs within tabs** — Backtest has 5 sub-tabs, Hyperopt has 5 sub-tabs
3. **Overlays** — All Tests, Compare, Analysis open as full overlays over the tab content
4. **Toggles** — builder-toggle must toggle on/off with visual state change
5. **Pills** — builder-pill must toggle selected/unselected state
6. **Progress bar** — animated width transition
7. **Pipeline tracker** — dynamic based on strategy state
8. **All data display with mock data** — every table, every KPI card, every chart should show realistic mock data matching the design values
9. **Charts** — use Recharts. Profit Over Time = ComposedChart with Bar (trade count) + Line (profit). Convergence = same pattern.
10. **Terminal output** — scrollable div with log-style entries, colored timestamps

---

## WORKFLOW

```
frontend-coder builds ALL files
        │
        ▼
code-reviewer checks ALL files against this spec
        │ NEEDS_CHANGES?
        ▼
frontend-coder fixes ALL issues
        │
        ▼
code-reviewer checks ALL files again (not just fixes — EVERYTHING)
        │ APPROVED?
        ▼
QA runs: npx tsc --noEmit && npx next lint && npm run build
        │ FAIL?
        ▼
frontend-coder fixes build errors
        │
        ▼
code-reviewer checks ALL again
        │ APPROVED?
        ▼
QA runs again
        │ PASS?
        ▼
DONE ✓
```

**CRITICAL:** Code reviewer must check ALL files after EVERY fix cycle, not just the changed files. The reviewer's job is to compare EVERY element in this spec against the code, line by line, every time.

**Max 3 loops.** If still failing after 3 coder→reviewer cycles, stop and report all remaining issues.

---

## GIT WARNING
The `[strategy]` directory path with brackets causes issues with git. After any `git pull`, run:
```bash
git checkout HEAD -- "frontend/src/app/experiments"
```
This restores any files that git empties due to the bracket path issue.

---

## VERIFICATION CHECKLIST (reviewer must count these)

### Strategy Header: 7 elements
- [ ] Back button with ArrowLeft icon
- [ ] Divider
- [ ] Flask icon
- [ ] Strategy name
- [ ] Status badge
- [ ] All Tests / Compare / Analysis buttons
- [ ] + New Test button (white bg)

### Pipeline Tracker: 7 steps
- [ ] Backtest, Hyperopt, FreqAI, Validation, AI Review, Paper, Live
- [ ] 4 visual states working (completed, skipped, active, pending)
- [ ] Connectors between steps

### Tab Bar: 5 tabs
- [ ] Backtest, Hyperopt, FreqAI, AI Review, Validation
- [ ] Active state with border-b-2 border-up
- [ ] Tab switching works

### Backtest Tab: 17 config fields + 5 result widgets + 5 sub-tabs = 27 widgets
Config panel:
- [ ] Strategy select
- [ ] Timerange Start/End
- [ ] Timeframe/Timeframe Detail
- [ ] Starting Capital/Stake Amount
- [ ] Max Open Trades/Fee
- [ ] 4 Flag toggles
- [ ] 3 Breakdown pills
- [ ] Cache select
- [ ] Strategy Config Preview (5 rows)
- [ ] 3 Run buttons (Start/Stop/Reset)
- [ ] Progress bar
- [ ] Terminal output

Results panel:
- [ ] Winner Banner (7 KPIs in grid-cols-7)
- [ ] 6 KPI Cards (grid-cols-6)
- [ ] Advanced Stats (2 cards, 5 rows each)
- [ ] Profit Over Time chart (with toggles)
- [ ] Master Table with 5 sub-tabs (Closed Trades, Per-Pair, Entry Tags, Exit Reasons, History)

### Hyperopt Tab: 18 config fields + 3 result widgets + 5 sub-tabs = 26 widgets
Config:
- [ ] Strategy select
- [ ] 6 Loss Function pills
- [ ] 5 Sampler pills
- [ ] Epochs/Min Trades
- [ ] Timerange Start/End
- [ ] Timeframe/Jobs
- [ ] Max Open Trades/Stake Amount
- [ ] Fee/Random State
- [ ] Early Stop/Pairs
- [ ] 6 Spaces pills
- [ ] 4 Flag toggles
- [ ] 3 Run buttons
- [ ] Progress bar
- [ ] Terminal output

Results:
- [ ] Winner Banner (7 KPIs)
- [ ] Convergence Chart (with toggles)
- [ ] Tabbed Results (Epoch Results, Best Parameters, Param Importance, Compare Runs, Run History)

### FreqAI Tab: 13 config fields + 2 result widgets = 15 widgets
Config:
- [ ] Source HO Epoch select
- [ ] Train Start/End
- [ ] BT Start/End
- [ ] Feature Period/Label Period
- [ ] 4 ML Model toggles
- [ ] Outlier Method/Threshold
- [ ] 3 Outlier toggles (PCA, Noise, Correlated)
- [ ] Matrix Calculation info card
- [ ] 3 Run buttons
- [ ] Progress bar
- [ ] Terminal output

Results:
- [ ] Winner Banner (7 KPIs)
- [ ] Matrix Results table

### AI Review Tab: 5 widgets
- [ ] Header bar (Scope, Model select, Cost, Analyze button)
- [ ] 5 Score Cards (grid-cols-5)
- [ ] Strengths/Concerns (grid-cols-2)
- [ ] Recommendation card
- [ ] Analysis History table

### Validation Tab: 13 config fields + 4 result widgets = 17 widgets
Config:
- [ ] Source Test select
- [ ] Verification Name input
- [ ] OOS Start/End
- [ ] Thresholds label
- [ ] Min Profit %/Max DD %
- [ ] Min Trades %/Min Win Rate %
- [ ] 4 Validation Check toggles
- [ ] Warning box
- [ ] 3 Run buttons
- [ ] Progress bar
- [ ] Terminal output

Results:
- [ ] Winner Banner/Verdict (7 KPIs + Paper/Live buttons)
- [ ] Training vs OOS Comparison table (7 rows)
- [ ] Lookahead + Recursive cards (grid-cols-2)
- [ ] Final Badge

### Overlays: 3
- [ ] All Tests overlay (filter bar + table)
- [ ] Compare overlay (A vs B + table)
- [ ] Analysis overlay (run selector + tabs + table)

### TOTAL: ~100+ widgets across all tabs

---

## CRITICAL DETAILS AGENTS ALWAYS MISS

### Table Cell Padding — THREE different sizes:
- **Backtest/Hyperopt/FreqAI/Validation tables:** cells use `px-2 py-1.5` (compact)
- **Overlay tables (AllTests, Compare):** cells use `px-4 py-2` body / `px-4 py-2.5` header (spacious)
- **Analysis Overlay:** uses `px-3 py-2` body / `px-3 py-2.5` header (medium)
- **Recursive Stability table (Validation):** cells use `px-2 py-1` (tightest!) — NOT py-1.5!
- DO NOT use the same padding everywhere!

### Deploy Button — used in Backtest, Hyperopt, FreqAI, Validation winner banners:
ALL deploy buttons use inline styles, NOT just Tailwind classes:
```html
<button class="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up"
  style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#F5F5F5">Deploy</button>
```

### Chart Toggle Button Groups (Backtest Profit Over Time + Hyperopt Convergence):
These charts share the SAME toggle button pattern in their headers:
```
Group 1 (time): active: px-3 py-1 text-[10px] font-bold uppercase bg-white/10 text-white rounded-l
                middle: px-3 py-1 text-[10px] font-bold uppercase text-muted hover:text-white l-bd border-l-0 transition-colors
                last:   px-3 py-1 text-[10px] font-bold uppercase text-muted hover:text-white l-bd border-l-0 rounded-r transition-colors
<div class="w-3"></div>  ← spacer between groups
Group 2 (value): active: px-3 py-1 text-[10px] font-bold uppercase bg-up/15 text-up rounded-l border border-up/25
                 last:   px-3 py-1 text-[10px] font-bold uppercase text-muted l-bd border-l-0 rounded-r hover:text-white transition-colors
```
- Backtest: Days/Weeks/Months + Abs $/Rel %
- Hyperopt: Epochs/Time + Loss/Profit%

### Chart Legend (appears in both Profit Over Time and Convergence charts):
Position: `absolute top-0 right-2 flex items-center gap-4 text-[9px] font-mono text-white/40 z-10`
Each item: `flex items-center gap-1.5`
- Line indicator: `w-3 h-[2px] bg-[#22c55e] rounded inline-block`
- Bar indicator: `w-3 h-2.5 bg-white/15 rounded-sm inline-block`
- Backtest legend: "Profit" (line) + "Trade Count" (bar)
- Hyperopt legend: "Best Objective" (line) + "Trades/Epoch" (bar)

### Chart Axis Labels:
**Backtest Profit Over Time:**
- Y-axis: `absolute left-1 top-0 bottom-4 flex flex-col justify-between text-[9px] font-mono text-white/25` → "14k", "12k", "10k", "8k"
- X-axis: `flex justify-between text-[9px] font-mono text-white/25 mt-1` → "01-15", "02-15", ... "12-15"

**Hyperopt Convergence:**
- Y-axis: same positioning → "0.0", "-0.05", "-0.10", "-0.15", "-0.20"
- X-axis: same styling → "0", "50", "100", "150", "200"

### Entry Tag Badges (Backtest → Entry Tags sub-tab):
Tags are NOT plain text — they have colored badges:
`px-1.5 py-0.5 bg-blue-500/12 text-blue-400 rounded text-[9px]`
Examples: "rsi_oversold", "ema_cross", "bb_squeeze", "macd_divergence", "vol_breakout"

### History Table Action Buttons (Backtest + Hyperopt):
- **Load:** `px-2 py-0.5 l-bd rounded text-[9px] text-muted hover:text-white hover:bg-white/5 transition-colors`
- **Del:** `px-2 py-0.5 l-bd rounded text-[9px] text-down/60 hover:text-down hover:bg-down/10 transition-colors`

### AllTests Overlay — Load vs Promote buttons:
- **Promote** (for top results): `text-[9px] px-2 py-0.5 bg-up/10 border border-up/20 text-up rounded hover:bg-up/20`
- **Load** (for other results): `text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 text-white/50 rounded hover:bg-white/10`

### AllTests Overlay — Type badges:
`px-1.5 py-0.5 rounded text-[8px] bg-white/5 border border-white/10 text-white/50` — text: "HO", "BT", "FAI"

### Hyperopt Best Parameters Tab — Full Spec:
Tab body wrapper: `flex-1 overflow-y-auto p-4` (p-4 padding on tab content!)
Header: `flex justify-between items-center mb-3` → `section-title` "Optimized Parameters · Epoch #147" + 3 buttons:
- Copy Python: `px-2.5 py-1 l-bd rounded text-[10px] text-muted hover:text-white hover:bg-white/5 transition-colors font-mono` → "📋 Copy Python"
- Copy JSON: same classes → "📋 Copy JSON"
- CSV: same classes → "⬇ CSV"

Code display: `bg-black rounded p-3 font-mono text-[11px] leading-relaxed l-bd space-y-0.5`
Color coding inside code:
- Buy param keys: `text-up` (green)
- Sell param keys: `text-down` (red)
- Values: `text-white font-bold`
- Operators/punctuation: `text-muted`
- Comments: `text-muted`
- Section variable names: `text-white`
- Indented lines: `pl-4`

### Hyperopt Param Importance Tab — Bar Chart Spec:
Tab body wrapper: `flex-1 overflow-y-auto p-4` (p-4 padding on tab content!)
Title: `<h3 class="section-title mb-3">Parameter Importance (Impact on Objective)</h3>`
Container: `space-y-2.5`
Each row: `flex items-center gap-3 text-[11px] font-mono`
- Name: `w-[180px] text-muted truncate`
- Bar track: `flex-1 h-2 bg-white/10 rounded-full overflow-hidden`
- Bar fill: `h-full rounded-full` with dynamic width
- Percentage: `w-12 text-right font-bold`
Color by importance: ≥70% = `bg-up text-up` | 50-69% = `bg-white text-white` | <50% = `bg-white/60 text-muted`

### FreqAI Matrix Calculation Info Badge:
Blue color scheme — `text-[#60a5fa]` for text
Badge icon: `px-1.5 py-0.5 bg-[#60a5fa]/10 border border-[#60a5fa]/25 rounded text-[10px]` → "ℹ"
Formula text: model count, outlier count, PCA count, noise count all `text-white font-bold`
Result count: `text-up font-bold`

### AI Review — Header Bar Detail:
Scope badge: `bg-surface l-bd rounded px-2.5 py-1.5 text-[11px] font-mono` → `<span class="text-muted">Scope:</span> <span class="text-white">BT #1 — 142 trades</span>`
Cost badge: same classes → `<span class="text-muted">Cost:</span> <span class="text-muted">~$0.03</span>`
Analyze button: `px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-white text-black rounded hover:bg-white/85 transition-colors`

### AI Review — Strengths/Concerns Headers:
- Strengths: `text-up font-bold text-[10px] uppercase tracking-wider` → "✓ Strengths"
- Concerns: `text-down font-bold text-[10px] uppercase tracking-wider` → "⚠ Concerns"
- Bullet items: `text-muted leading-relaxed` (use • prefix)

### AI Review — Recommendation Sub-header:
`text-white font-bold text-[10px] uppercase tracking-wider mb-2` → "→ Recommendation"

### Validation Warning Box — Bold Yellow Text:
Inside the warning, "NOT overlap" is styled with `<b class="text-yellow-400">NOT overlap</b>` — bold and yellow, not just plain text.

### Validation Final Badge — Missing shadow-xl:
Full classes: `bg-up/[0.04] border border-up/15 rounded-md px-4 py-3 text-center shadow-xl`

### Pipeline Connector Types (detail):
- Completed → Completed: `w-5 h-px bg-up/50` (solid green)
- Skipped: `w-5 h-px border-t border-dashed border-white/15` (dashed white)
- Active → Pending: `w-5 h-px bg-white/15` (solid dim white)

### Header Buttons — transition-colors:
ALL header buttons (Back, All Tests, Compare, Analysis, + New Test) have `transition-colors` class.

### Terminal Output — Log Line Color Patterns (ALL tabs):
All terminal outputs share the same structure: `mt-1 bg-black rounded p-3 font-mono text-[10px] text-muted leading-relaxed l-bd max-h-[300px] overflow-y-auto`
Log line colors — 3 levels:
- Default (INFO): no extra class, inherits `text-muted`
- Important (key results): `class="text-white"` on the div
- Success (final result): `class="text-up font-bold"` on the div
- Inline highlights: `<span class="text-up">New best:</span>` or `<span class="text-up font-bold">New best:</span>` inside muted lines

### Common Sub-Section Pattern (flags, pills, toggles):
All l-t pt-3 sections follow: `<div class="l-t pt-3">` → builder-label → content container with `mt-1` (for toggle containers and pill grids)
Exception: ML Models in FreqAI uses `flex flex-col gap-2.5` WITHOUT mt-1
Exception: Outlier Detection toggles in FreqAI use `mt-2` (not mt-1)

### Tab Content Wrappers:
- Tables (Closed Trades, Per-Pair, etc): `flex-1 overflow-x-auto overflow-y-auto p-0`
- Rich content (Best Parameters, Param Importance): `flex-1 overflow-y-auto p-4`

### shrink-0 Classes (prevent flex shrinking):
These elements MUST have `shrink-0`: Back button, Flask icon, Status badge, sub-tab buttons, chart header toggle container, all header/panel headers

---

## DO NOT:
- Use default Tailwind sizes when the design specifies exact pixel sizes
- Skip any widget — even if it seems "minor", it must exist
- Invent classes — use ONLY what's in the design HTML
- Use generic placeholder text — use the exact mock data from the design
- Hardcode data in a way that can't be replaced with API data later (use variables/state)
- Forget empty states for when there's no data
- Forget loading states for async operations
