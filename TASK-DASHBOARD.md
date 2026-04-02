# TASK: Rebuild Dashboard Page — Pixel Perfect from DESIGN-LINEAR-EDGE-FULL.html

## STATUS: FROM SCRATCH
Treat this as a COMPLETE REBUILD. Delete the contents of every component file and rewrite from zero using the design HTML as the only source of truth.

---

## MANDATORY READ ORDER (BEFORE ANY CODE)
1. `CLAUDE.md` — rules, philosophy, field names
2. `prototypes/DESIGN-LINEAR-EDGE-FULL.html` lines 1085–2011 (Dashboard) + lines 3497–3690 (Fleet Management) — THE ONLY SOURCE OF TRUTH for this task
3. `docs/PAGE_SPECS.md` — widget checklist (D-1 through D-20)
4. `docs/TYPES.ts` — TypeScript interfaces
5. `docs/ERROR_HANDLING.md` — error handling patterns
6. `docs/FT-UI-MAP.html` — Dashboard API mapping

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
**⚠ THESE ARE COPY-PASTED FROM THE ACTUAL CSS (lines 21-173). DO NOT APPROXIMATE.**

### Custom CSS Classes (define in globals.css or equivalent)
```css
/* Borders — line 23-25 */
.l-bd { border: 1px solid rgba(255,255,255,0.10); }
.l-b  { border-bottom: 1px solid rgba(255,255,255,0.10); }
.l-r  { border-right: 1px solid rgba(255,255,255,0.10); }
.l-t  { border-top: 1px solid rgba(255,255,255,0.10); }

/* Scrollbar — line 27-29 */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

/* Grid background for charts — line 26 */
.l-grid { background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px); background-size: 24px 24px; }

/* KPI — line 134-135 */
.kpi-label { font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500; margin-bottom: 4px; }
.kpi-value { font-family: 'JetBrains Mono', monospace; font-weight: 700; }

/* Section Title — line 136 */
.section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF; }

/* Sortable Table Headers — line 32-38 */
th.sortable { cursor: pointer; user-select: none; position: relative; white-space: nowrap; }
th.sortable:hover { color: #fff; background: rgba(255,255,255,0.04); }
th.sortable::after { content: '⇅'; margin-left: 4px; opacity: 0.25; font-size: 10px; }
th.sortable:hover::after { opacity: 0.6; }
th.sortable.sort-asc::after { content: '↑'; opacity: 0.9; color: #fff; }
th.sortable.sort-desc::after { content: '↓'; opacity: 0.9; color: #fff; }
th.sortable.sort-asc, th.sortable.sort-desc { color: #fff; background: rgba(255,255,255,0.04); }

/* Filterable Column Headers — line 40-55 */
th.filterable { position: relative; cursor: pointer; }
th.filterable::before { content: ''; display: inline-block; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid rgba(255,255,255,0.2); margin-right: 5px; vertical-align: middle; transition: border-color 0.15s; }
th.filterable:hover::before { border-top-color: rgba(255,255,255,0.6); }
th.filterable.filter-active::before { border-top-color: #22d3ee; }
th.filterable.filter-active { color: #22d3ee; }

/* Bot Control Buttons — line 140-144 */
.bot-ctrl { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 5px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.10); color: #9CA3AF; transition: all 0.15s; cursor: pointer; }
.bot-ctrl:hover { background: #2a2a2a; color: #F5F5F5; border-color: rgba(255,255,255,0.20); }
.bot-ctrl.ctrl-start:hover { color: #22c55e; border-color: rgba(34,197,94,0.3); }
.bot-ctrl.ctrl-stop:hover { color: #ef4444; border-color: rgba(239,68,68,0.3); }
.bot-ctrl.ctrl-pause:hover { color: #eab308; border-color: rgba(234,179,8,0.3); }

/* Action Menu (trade row actions) — line 158-166 */
.action-menu { position: relative; display: inline-block; }
.action-menu-btn { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.10); padding: 4px 10px; border-radius: 5px; color: #9CA3AF; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 5px; }
.action-menu-btn:hover { background: #2a2a2a; color: #F5F5F5; }
.action-dropdown { display: none; position: absolute; right: 0; bottom: 100%; margin-bottom: 4px; min-width: 200px; background: #151515; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 4px; z-index: 40; box-shadow: 0 -8px 30px rgba(0,0,0,0.6); }
.action-dropdown.open { display: block; animation: fadeIn 0.15s; }
.action-dropdown button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 12px; font-size: 12px; color: #d4d4d8; background: transparent; border: none; border-radius: 5px; cursor: pointer; transition: background 0.1s; text-align: left; font-family: 'Inter', sans-serif; }
.action-dropdown button:hover { background: rgba(255,255,255,0.06); color: #fff; }
.action-dropdown button.danger { color: #ef4444; }
.action-dropdown button.danger:hover { background: rgba(239,68,68,0.1); }
.action-dropdown .sep { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 8px; }

/* Sidebar Toggle — line 171-172 */
.sidebar-toggle { transition: transform 0.3s ease; }
.sidebar-toggle.rotated { transform: rotate(180deg); }

/* Trade Tab Buttons — responsive (line 187, 197) */
/* At smaller screens: .trade-tab-btn { px: 12px→8px, font-size: 11px→10px } */
```

### KEY DIFFERENCES vs what you might assume:
| Token | WRONG assumption | CORRECT from CSS |
|-------|-----------------|------------------|
| kpi-label size | text-[9px] | **text-[11px]** (10px responsive) |
| kpi-label color | text-white/30 | **text-[#6B7280]** |
| kpi-label weight | font-bold (700) | **font-medium** (500) |
| section-title size | text-[11px] | **text-[12px]** |
| section-title color | text-white/40 | **text-muted** (#9CA3AF) |
| bot-ctrl size | w-6 h-6 | **w-[28px] h-[28px]** |
| bot-ctrl bg | bg-white/10 | **bg-[#1a1a1a]** |
| bot-ctrl border | border-white/[0.08] | **border-white/[0.10]** |
| bot-ctrl radius | rounded | **rounded-[5px]** |
| l-b border | border-white/[0.08] | **border-white/[0.10]** |
| action-dropdown bg | bg-black | **bg-[#151515]** |
| action-dropdown radius | rounded-md | **rounded-lg** (8px) |

---

## FILE STRUCTURE
```
frontend/src/app/dashboard/
├── page.tsx                              — Dashboard master layout (KPI bar + 3 columns)
├── fleet/
│   └── page.tsx                          — Fleet Management compare view (full table)
└── components/
    ├── KpiBar.tsx                        — 14 KPI cards in 2 rows (7+7)
    ├── FleetManagement.tsx               — COL 1: Bot list with control buttons
    ├── ProfitChart.tsx                   — COL 2 top: Profit Over Time + Distribution
    ├── TradeTable.tsx                    — COL 2 bottom: Master Tabular Engine (6 tabs)
    ├── BalanceSidebar.tsx                — COL 3: Balance + Fees + Telemetry + Terminal
    ├── FleetTable.tsx                    — Fleet page table (shared columns/styling)
    └── BotDrawer.tsx                     — Slide-out bot detail drawer (if needed)
```

---

## ELEMENT-BY-ELEMENT SPECIFICATION

### 1. Dashboard Page Container (design line 1086)
Container: `flex flex-1 overflow-hidden l-grid p-5 flex-col gap-5`
- Page background uses `l-grid` class (grid background pattern)
- No separate page header — Dashboard integrates directly with the app shell's nav
- **⚠ NOTE:** Design HTML has `flex-col gap-5` but omits `flex` (display:flex). The prototype works because the parent is flex. In our React implementation, ADD `flex` explicitly — without it, `flex-col` and `gap-5` have no effect.

---

### 2. KPI Bar — LAYER 1 (design lines 1089–1150)
Outer container: `rounded-md bg-white/10 l-bd shrink-0 overflow-hidden`

**Row 1** (7 cards): `grid grid-cols-7 gap-px`
Each card: `bg-black p-4 flex flex-col hover:bg-white/[0.04] transition-colors`

| # | Label | Value | Value Color | Sub-value |
|---|-------|-------|-------------|-----------|
| 1 | Total Equity | $127,450.80 | `kpi-value text-xl` (default white) | — |
| 2 | Locked in Trades | $45,120 | `kpi-value text-xl` (default white) | `(35%)` in `text-[11px] text-muted font-sans font-normal` |
| 3 | Today's P&L | +$1,420.10 | `kpi-value text-xl text-up` | `+1.12%` in `text-[11px] font-sans font-normal` (inherits text-up) |
| 4 | Total P&L (Closed) | +$18,940.20 | `kpi-value text-xl text-up` | `+14.86%` in `text-[11px] font-sans font-normal` (inherits text-up) |
| 5 | Open P&L (Unreal.) | +$432.60 | `kpi-value text-xl text-up` | `+0.96%` in `text-[11px] font-sans font-normal` (inherits text-up) |
| 6 | Open Trades | 42 | `kpi-value text-xl` (default white) | `/ 100 max` in `text-[11px] text-muted font-sans font-normal` |
| 7 | Max Drawdown | -4.12% | `kpi-value text-xl text-down` | — |

**Row 2** (7 cards): `grid grid-cols-7 gap-px border-t border-white/10`
Each card: `bg-black p-3 flex flex-col hover:bg-white/[0.04] transition-colors`
**NOTE:** Row 2 has `p-3` (not `p-4` like Row 1) and `text-base` (not `text-xl`)

| # | Label | Value | Value Color | Sub-value |
|---|-------|-------|-------------|-----------|
| 8 | Win Rate | 68.4% | `kpi-value text-base` (default white) | `876W / 405L` in `text-[10px] text-muted font-sans font-normal` |
| 9 | Profit Factor | 2.14 | `kpi-value text-base text-up` | — |
| 10 | Avg Duration | 2h 45m | `kpi-value text-base` (default white) | — |
| 11 | Total Trades | 1,284 | `kpi-value text-base` (default white) | — |
| 12 | Best Pair | SOL/USDT | `kpi-value text-base text-up` | `+8.12%` in `text-[10px]` (inherits text-up) |
| 13 | Sharpe Ratio | 1.82 | `kpi-value text-base` (default white) | — |
| 14 | Trading Volume | $2.4M | `kpi-value text-base` (default white) | — |

**CRITICAL DETAILS:**
- Row 1 sub-value spans: `text-[11px]` — NOT text-[10px]
- Row 2 sub-value spans: `text-[10px]` — different from Row 1!
- `gap-px` between cards (1px gap, filled by the bg-white/10 outer container = visible separator)
- Row 2 has `border-t border-white/10` on the grid wrapper
- Labels use `kpi-label` class, values use `kpi-value` class
- P&L values that are positive: `text-up`, negative: `text-down`
- Neutral values (no sign): default white
- Sub-values for percentage changes INHERIT the parent's text-up/text-down color

---

### 3. Master 3-Column Layout — LAYER 2 (design line 1153)
Container: `flex-1 flex gap-5 min-w-0 min-h-0 overflow-hidden`

Three columns:
- **COL 1** (Fleet Management): `w-[400px] min-w-[400px] shrink-0`
- **COL 2** (Main Workspace): `flex-1 min-w-0`
- **COL 3** (Sidebar): `w-[320px] min-w-[320px] shrink-0 overflow-y-auto min-h-0`

---

### 4. COL 1: Fleet Management (design lines 1156–1310)
Outer: `w-[400px] flex flex-col gap-5 min-w-[400px] shrink-0`
Inner card: `flex-1 bg-surface l-bd rounded-md flex flex-col shadow-xl overflow-hidden`

**Header bar:** `h-12 l-b flex items-center justify-between px-5 bg-black/40 shrink-0`
- Title: `section-title flex items-center gap-2.5`
  - Lucide `Layers` icon: `w-4 h-4 text-muted`
  - Text: `Fleet Management (312)`
- Compare button: `bg-white/10 px-3 py-1 rounded text-[11px] hover:bg-white/20 transition-colors font-medium flex items-center gap-1.5` title="Open Fleet Management — Compare all bots side by side"
  - Lucide `GitCompare` icon: `w-3 h-3`
  - Text: `Compare View`

**Bot list container:** `flex-1 overflow-y-auto flex flex-col font-mono text-xs`

#### Bot Row Format (expanded)
Each bot row: `p-4 l-b hover:bg-white/[0.04] transition-colors group cursor-pointer`
- Every OTHER row adds: `bg-white/[0.015]` (alternating background)
- Has `onclick` to open bot drawer

**Row structure — 3 sections vertically:**

**Section 1 — Top line** (`flex items-start justify-between mb-2.5`):
- LEFT (`flex items-center gap-2`):
  - Status LED: `w-2 h-2 rounded-full` + color per status:
    - LIVE running: `bg-up shadow-[0_0_4px_#22c55e]`
    - PAUSED: `bg-yellow-400` (NO shadow)
    - STOPPED: `bg-down` (NO shadow)
  - Bot name: `font-bold uppercase text-[12px] tracking-wide` + color per status:
    - LIVE: `text-white`
    - PAUSED: `text-white/60`
    - STOPPED: `text-white/40`
  - Status badge per status:
    - LIVE: `text-[10px] border border-white/20 px-1.5 py-[1px] rounded text-white/60 font-medium`
    - PAUSED: `text-[10px] border border-yellow-500/30 px-1.5 py-[1px] rounded text-yellow-400 font-medium`
    - STOPPED: `text-[10px] border border-down/30 px-1.5 py-[1px] rounded text-down font-medium`
- RIGHT: P&L display — **⚠ STRUCTURAL INCONSISTENCY IN DESIGN HTML:**
  - **Bot 1-2 (expanded HTML):** P&L dollar and percent are TWO SEPARATE sibling `<span>` elements (3 children in the flex container: left-div, span, span). Percent has `ml-1`.
  - **Bot 3, 5, 6 (compact HTML):** P&L is wrapped in `<div class="text-right">` container (2 children in flex: left-div, right-div). Percent has NO `ml-1` (spacing via text space character).
  - **Bot 4 (PAUSED):** Only dollar `<span>`, NO percentage span at all.
  - **CANONICAL: Use the `<div class="text-right">` wrapper version** (Bot 3+ pattern) — it produces correct 2-child justify-between layout. Bot 1-2's 3-child layout is a design HTML typo.
  - P&L dollar: `font-bold text-[13px]` + `text-up` (positive) or `text-down` (negative) or `text-muted` (zero/PAUSED)
  - P&L percent: `text-[10px]` with **inline style** (NOT Tailwind class):
    - Positive: `style="color:rgba(34,197,94,0.5)"`
    - Negative: `style="color:rgba(239,68,68,0.5)"`
    - **PAUSED bots: NO percentage span at all — just dollar value**
    - **⚠ CRITICAL:** The percentage color uses inline rgba at 50% opacity, NOT text-up/text-down!

**Section 2 — Stats grid** (`grid grid-cols-2 gap-y-1.5 text-muted text-[12px] mb-3`):
Each stat row: `flex justify-between w-full` (left column adds `pr-5`)
- 4 stats: Trades, Win, Drawdown, Avg. Dur
- Label: inherits `text-muted`
- Value: `text-white/70` for normal, `text-down` for Drawdown values

**Section 3 — Controls bar** (`flex justify-between items-center opacity-50 group-hover:opacity-100 transition-opacity`):
- LEFT: Sparkline bars (`flex gap-[2px] h-4 items-end`):
  - Each bar: `w-1.5 rounded-sm` + `bg-up` or `bg-down` + dynamic height (%)
- RIGHT: 8 control buttons (`flex gap-1`):
  1. `bot-ctrl ctrl-start` — Lucide `Play` w-3 h-3 — title="▶ Start Bot — Resume trading engine"
  2. `bot-ctrl ctrl-stop` — Lucide `Square` w-3 h-3 — title="■ Stop Bot — Gracefully stop trading"
  3. `bot-ctrl ctrl-pause` — Lucide `Pause` w-3 h-3 — title="⏸ Pause — Stop opening new trades"
  4. `bot-ctrl` (no variant) — Lucide `RefreshCw` w-3 h-3 — title="↻ Reload Config — Hot-reload strategy config"
  5. `bot-ctrl ctrl-stop` — Lucide `XSquare` w-3 h-3 — title="✕ Force Exit All — Close all open positions"
  6. `bot-ctrl` (no variant) — Lucide `PlusSquare` w-3 h-3 — title="⊞ Toggle Stopbuy — Prevent new buy orders"
  7. SEPARATOR: `w-px h-3 bg-white/15 mx-0.5`
  8. `bot-ctrl` + **inline style** `style="color:#facc15"` — Lucide `ShieldAlert` w-3 h-3 — title="Soft Kill — exits all trades, keeps bot" (Bot 1-2 title) OR title="🛡 Soft Kill — Exit all trades, keep bot alive" (Bot 3+)
  9. `bot-ctrl ctrl-stop` — Lucide `Zap` w-3 h-3 — title="Hard Kill — force stop bot + container" (Bot 1-2) OR title="⚡ Hard Kill — Force stop bot + container" (Bot 3+)
  - **ALL** buttons have `onclick="event.stopPropagation()"` to prevent triggering the row's click handler

**⚠ TITLE ATTRIBUTE INCONSISTENCY (from design HTML):**
Bot 1 and Bot 2 use plain titles for Soft/Hard Kill:
- `"Soft Kill — exits all trades, keeps bot"`
- `"Hard Kill — force stop bot + container"`

Bot 3+ use emoji-prefixed titles:
- `"🛡 Soft Kill — Exit all trades, keep bot alive"`
- `"⚡ Hard Kill — Force stop bot + container"`

**DECISION: Use the Bot 1-2 format (no emoji) as the canonical version for consistency. Document this discrepancy.**

#### Sample Bot Data (6 bots in design):
| # | Name | Status | LED | P&L $ | P&L % | Trades | Win | DD | Avg Dur | Alt BG |
|---|------|--------|-----|-------|-------|--------|-----|-----|---------|--------|
| 1 | TrendFollowerV3_BTC | LIVE | bg-up+shadow | +$48.20 | +2.4% | 412 | 72% | -1.2% | 1.5h | No |
| 2 | TrendFollowerV3_ETH | LIVE | bg-up+shadow | -$12.40 | -0.7% | 188 | 41% | -4.2% | 3.2h | Yes |
| 3 | ScalpBot_XRP | LIVE | bg-up+shadow | +$92.10 | +3.1% | 620 | 71% | -2.1% | 0.4h | No |
| 4 | MomentumRider_SOL | PAUSED | bg-yellow-400 | $0.00 | — | 156 | 62% | -5.2% | 3.2h | Yes |
| 5 | MemeScalper_DOGE | STOPPED | bg-down | -$420 | -17.5% | 18 | 28% | -12.4% | 0.8h | No |
| 6 | BreakoutHunter_AVAX | LIVE | bg-up+shadow | +$220.40 | +8.2% | 210 | 68% | -3.4% | 1.8h | Yes |

**CRITICAL per-status styling details:**
- LIVE bots: LED has `shadow-[0_0_4px_#22c55e]`, name is `text-white`
- PAUSED bots: LED has NO shadow, name is `text-white/60`, P&L shows `text-muted` $0.00
- STOPPED bots: LED has NO shadow, name is `text-white/40`, Win% shows `text-down` (28%)
- STOPPED bot Win%: `text-down` when low (<30%), contrast with normal `text-white/70`

---

### 5. COL 2: Main Workspace (design lines 1313–1902)
Container: `flex-1 flex flex-col gap-5 min-w-0`

Two sections stacked:
1. **Profit Charts** (h-[280px], shrink-0)
2. **Trade Table** (flex-1, fills remaining)

---

### 5A. Profit Over Time + Distribution (design lines 1316–1420)
Outer: `h-[280px] bg-surface l-bd rounded-md flex shadow-xl shrink-0 overflow-hidden relative`

Two panels side by side:

#### LEFT: Profit Over Time (`flex-1 flex flex-col relative`)

**Header** (`flex items-center justify-between px-5 py-3 shrink-0 gap-3`):
- Title: `section-title text-white/50 whitespace-nowrap` — "Profit Over Time"
- Controls (flex gap-0 shrink-0):
  - **Time range buttons** (3 buttons, button group):
    - "Days" (active): `px-3 py-1 text-[10px] font-bold uppercase bg-white/10 text-white rounded-l`
    - "Weeks": `px-3 py-1 text-[10px] font-bold uppercase text-muted hover:text-white l-bd border-l-0 transition-colors`
    - "Months": `px-3 py-1 text-[10px] font-bold uppercase text-muted hover:text-white l-bd border-l-0 rounded-r transition-colors`
  - Spacer: `w-3` (div)
  - **Value mode buttons** (2 buttons, button group):
    - "Abs $" (active): `px-3 py-1 text-[10px] font-bold uppercase bg-up/15 text-up rounded-l border border-up/25`
    - "Rel %": `px-3 py-1 text-[10px] font-bold uppercase text-muted l-bd border-l-0 rounded-r hover:text-white transition-colors`
  - Spacer: `w-2` (div)
  - **Sidebar toggle**: `sidebar-toggle px-2 py-1 rounded text-muted hover:text-white hover:bg-white/8 transition-all opacity-40 hover:opacity-100` title="Toggle right sidebar (Balance, Fees, Telemetry)"
    - Lucide `PanelRightClose` icon: `w-3.5 h-3.5`

**Button title attributes:**
- "Days": title="Show daily chart"
- "Weeks": title="Show weekly chart"
- "Months": title="Show monthly chart"
- "Abs $": title="Show absolute dollar values"
- "Rel %": title="Show relative percentage values"
- Sidebar toggle: title="Toggle right sidebar (Balance, Fees, Telemetry)"

**Chart area** (`flex-1 px-5 pb-4 relative`):
- Legend: `absolute top-0 right-2 flex items-center gap-4 text-[9px] font-mono text-white/40 z-10`
  - Profit: `w-3 h-[2px] bg-[#22c55e] rounded inline-block` + "Profit"
  - Trade Count: `w-3 h-2.5 bg-white/15 rounded-sm inline-block` + "Trade Count"
- Grid overlay: `absolute inset-0 l-grid opacity-20`
- Left Y-axis: `absolute left-1 top-0 bottom-4 flex flex-col justify-between text-[9px] font-mono text-white/25` — values: 40, 20, 0, -20, -40
- **Chart** (SVG with viewBox="0 0 200 100"):
  - Zero line: `stroke="rgba(255,255,255,0.08)" stroke-width="0.5" stroke-dasharray="3,3"` at y=50
  - Trade count bars: `fill="rgba(255,255,255,0.10)"` to `rgba(255,255,255,0.18)` (gradient bars from bottom)
  - P&L line: `stroke="#22c55e" stroke-width="0.4" stroke-linejoin="round"` polyline
  - Dots on line: `r="1.2"` circles, `fill="#22c55e"` (positive) or `fill="#ef4444"` (negative). **⚠ NOTE:** One dot at (175,38) is above y=50 but red — design HTML inconsistency. In Recharts implementation, use data sign to determine color, not SVG position.
- X-axis: `flex justify-between text-[9px] font-mono text-white/25 mt-1` — "03-12" through "03-30"

**NOTE:** In production, use Recharts/D3 for the chart. The SVG in the design is mock data showing the visual target.

#### RIGHT: Profit Distribution (`w-[300px] flex flex-col relative bg-black/20`)

**Header**: `px-5 py-3 shrink-0` → `section-title text-white/50` — "Profit Distribution"

**Histogram area** (`flex-1 px-5 pb-4 flex items-end gap-[3px]`):
- 11 bars, each `flex-1 rounded-t` with inline height style
- Negative side: `bg-down/60`, `bg-down/40`, `bg-down/30`, `bg-down/20`, `bg-down/20`
- Center: `bg-white/8`
- Positive side: `bg-up/20`, `bg-up/30`, `bg-up/40`, `bg-up/60`, `bg-up/80`

**X-axis**: `flex justify-between text-[9px] font-mono text-white/25 px-5 pb-2` — "-0.02", "0", "+0.01"

**DD stats** (`px-5 pb-4 grid grid-cols-2 gap-4`):
| Stat | Label class | Value | Value class |
|------|-------------|-------|-------------|
| Absolute DD | `kpi-label` | -$5,210 | `text-base font-bold font-mono text-down` |
| Relative DD | `kpi-label` | -4.12% | `text-base font-bold font-mono text-down` |

---

### 5B. Master Tabular Engine (design lines 1423–1901)
Outer: `flex-1 bg-surface l-bd rounded-md shadow-xl flex flex-col min-h-0 overflow-hidden`

**Tab bar**: `h-12 l-b flex items-center bg-black/40 shrink-0 border-b-2 border-transparent overflow-x-auto whitespace-nowrap`

6 tabs + CSV button:

| Tab | Text | Active Class | Default Class | Title |
|-----|------|-------------|---------------|-------|
| Open Trades | Open Trades (42) | `h-full px-5 font-bold text-[12px] uppercase tracking-wide border-b-2 border-up text-white trade-tab-btn shrink-0` | (switch from active to default on click) | "Currently active trades" |
| Closed | Closed (1284) | same active pattern | `h-full px-5 font-bold text-[12px] uppercase tracking-wide text-muted hover:text-white transition-colors trade-tab-btn shrink-0` | "Completed trade history" |
| Whitelist Matrix | Whitelist Matrix | same | same | "Pair monitoring and lock management" |
| Performance | Performance | same | same | "Performance by trading pair" |
| Entry Tags | Entry Tags | same | same | "Entry signal tag analysis" |
| Exit Reasons | Exit Reasons | same | same | "Exit reason analysis" |

**CSV button** (ml-auto mr-5): `px-2 py-1 rounded text-[10px] text-muted hover:text-white hover:bg-white/6 transition-colors flex items-center gap-1 opacity-50 hover:opacity-100` title="Export table data as CSV"
- Lucide `Download` icon: `w-3 h-3 inline` + "CSV"

**CRITICAL:** Active tab has `border-b-2 border-up` — the border color is `up` (#22c55e), NOT white or accent. The tab bar itself has `border-b-2 border-transparent` to create space for the active indicator.

**Tab content IDs and classes:**
- `trades-open` — `trade-tab-content` + visible by default
- `trades-closed` — `trade-tab-content` + `style="display:none"`
- `trades-whitelist` — `trade-tab-content` + `style="display:none"`
- `trades-performance` — `trade-tab-content` + `style="display:none"`
- `trades-entry` — `trade-tab-content` + `style="display:none"`
- `trades-exit` — `trade-tab-content` + `style="display:none"`

---

#### 5B-1. Open Trades Table (design lines 1438–1515)
Container: `trade-tab-content flex-1 overflow-x-auto overflow-y-auto flex flex-col`

**Table**: `w-full text-left border-collapse whitespace-nowrap text-[13px]`
**Thead**: `sticky top-0 bg-surface l-b font-mono text-[11px] uppercase tracking-widest text-muted z-10 shadow-lg`
**Tbody**: `font-mono text-white/85 divide-y divide-white/[0.05]`

**Columns** (12 columns):
| # | Header | Classes | Sortable | Filterable |
|---|--------|---------|----------|------------|
| 1 | Date & Time | `px-5 py-3.5 font-medium` | YES + `sort-desc` (default) | No |
| 2 | Pair | `px-5 py-3.5 font-medium` | YES | YES |
| 3 | Bot Logic | `px-5 py-3.5 font-medium` | YES | YES |
| 4 | Side | `px-5 py-3.5 font-medium text-center` | YES | YES |
| 5 | Size | `px-5 py-3.5 font-medium text-right` | YES | No |
| 6 | Entry | `px-5 py-3.5 font-medium text-right` | YES | No |
| 7 | Mark Price | `px-5 py-3.5 font-medium text-right` | YES | No |
| 8 | Profit % | `px-5 py-3.5 font-medium text-right bg-black/20` | YES | No |
| 9 | Value | `px-5 py-3.5 font-medium text-right bg-black/20` | YES | No |
| 10 | Fee | `px-5 py-3.5 font-medium text-right` | YES | No |
| 11 | Age | `px-5 py-3.5 font-medium` | YES | No |
| 12 | Actions | `px-5 py-3.5 font-medium border-l border-white/8 text-center` | No | No |

**NOTE:** Columns 8-9 (Profit %, Value) have `bg-black/20` on the header — highlighted columns.

**Row styling:** `hover:bg-white/[0.04] transition-colors group`
- `group` class is needed for the Actions column opacity animation (opacity-40 → group-hover:opacity-100)
- Alternating: every other row adds `bg-white/[0.015]`
- **NOTE:** Only Open Trades has `group` class. Closed/Whitelist/Performance use `hover:bg-white/[0.04] transition-colors` (no `group`). Entry Tags/Exit Reasons use just `hover:bg-white/[0.04]` (no `transition-colors`, no `group`).

**Per-column value colors:**
| Column | Cell classes |
|--------|-------------|
| Date & Time | `px-5 py-3` — date in white, time in `text-white/35 ml-1` |
| Pair | `px-5 py-3 font-bold text-white` |
| Bot Logic | `px-5 py-3 text-muted font-sans text-[12px]` |
| Side | `px-5 py-3 text-center` — badge: LONG=`bg-up/12 text-up border border-up/25 px-2 py-0.5 rounded text-[11px] font-medium`, SHORT=`bg-down/12 text-down border border-down/25 px-2 py-0.5 rounded text-[11px] font-medium` |
| Size | `px-5 py-3 text-right text-muted` |
| Entry | `px-5 py-3 text-right` (default white) |
| Mark Price | `px-5 py-3 text-right font-medium` |
| Profit % | Positive: `px-5 py-3 text-right bg-up/5 text-up font-bold`, Negative: `px-5 py-3 text-right bg-down/5 text-down font-bold` |
| Value | Positive: `px-5 py-3 text-right bg-up/5 text-up`, Negative: `px-5 py-3 text-right bg-down/5 text-down` |
| Fee | `px-5 py-3 text-right text-muted text-[11px]` |
| Age | `px-5 py-3 text-muted` |
| Actions | `px-5 py-3 border-l border-white/8 text-center opacity-40 group-hover:opacity-100 transition-opacity` |

**Action Menu** (per-row dropdown):
Container: `action-menu`
Button: `action-menu-btn` title="Trade actions menu"
- Lucide `ChevronDown` w-3 h-3 + "Actions"

Dropdown (`action-dropdown`, opens upward with `bottom: 100%`):
1. "Forceexit limit" — Lucide `LogOut` w-3.5 h-3.5 text-muted — title="Close trade at limit price"
2. "Forceexit market" — Lucide `Zap` w-3.5 h-3.5 text-muted — title="Close trade at market price"
3. "Forceexit partial" — Lucide `Scissors` w-3.5 h-3.5 text-muted — title="Close partial position"
4. SEPARATOR (`.sep`)
5. "Increase position" — Lucide `PlusCircle` w-3.5 h-3.5 text-muted — title="Add to existing position"
6. "Reload" — Lucide `RefreshCw` w-3.5 h-3.5 text-muted — title="Reload trade from exchange"
7. SEPARATOR (`.sep`)
8. "Delete trade" — `class="danger"` — Lucide `Trash2` w-3.5 h-3.5 — title="🗑 Delete trade — Remove from history permanently"

**⚠ CRITICAL:** Dropdown opens UPWARD (`bottom: 100%; margin-bottom: 4px`), NOT downward.

---

#### 5B-2. Closed Trades Table (design lines 1517–1563)
Container: `trade-tab-content flex-1 overflow-x-auto overflow-y-auto` + `style="display:none"`

**Columns** (11 columns):
| # | Header | Sortable | Filterable | Align |
|---|--------|----------|------------|-------|
| 1 | Date | YES | No | left |
| 2 | Pair | YES | YES | left |
| 3 | Bot | YES | YES | left |
| 4 | Side | YES | YES | center |
| 5 | Entry | YES | No | right |
| 6 | Exit | YES | No | right |
| 7 | Profit % | YES | No | right + `bg-black/20` |
| 8 | Value | YES | No | right + `bg-black/20` |
| 9 | Fee | YES | No | right |
| 10 | Duration | YES | No | left |
| 11 | Exit Reason | YES | YES | left |

**Per-column value colors:**
| Column | Cell classes |
|--------|-------------|
| Date | date default, time `text-white/35 ml-1` |
| Pair | `font-bold text-white` |
| Bot | `text-muted font-sans text-[12px]` |
| Side | same badge pattern as Open Trades |
| Entry | default white |
| Exit | default white |
| Profit % | positive=`bg-up/5 text-up font-bold`, negative=`bg-down/5 text-down font-bold` |
| Value | positive=`bg-up/5 text-up`, negative=`bg-down/5 text-down` |
| Fee | `text-muted text-[11px]` |
| Duration | `text-muted` |
| Exit Reason | `text-muted font-sans text-[11px]` — **EXCEPT** `stoploss` = `text-down font-sans text-[11px]` |

**⚠ CRITICAL:** Exit Reason "stoploss" uses `text-down` (red), other exit reasons use `text-muted`.

**Sticky header:** YES — `sticky top-0` on thead (same as Open Trades)

---

#### 5B-3. Whitelist Matrix Table (design lines 1566–1661)
Container: `trade-tab-content flex-1 overflow-x-auto overflow-y-auto` + `style="display:none"`

**Columns** (11 columns):
| # | Header | Sortable | Filterable | Align |
|---|--------|----------|------------|-------|
| 1 | Pair | YES | YES | left |
| 2 | Status | YES | YES | center |
| 3 | Assigned Bots | YES | No | left |
| 4 | Price | YES | No | right |
| 5 | 24h Change | YES | No | right |
| 6 | Spread | YES | No | right |
| 7 | 24h Vol | YES | No | right |
| 8 | Volatility | YES | No | right |
| 9 | Open Pos | YES | No | center |
| 10 | Lock | YES | No | center |
| 11 | Controls | No | No | center + `border-l border-white/8` |

**Status badges:**
- ACTIVE: `bg-up/12 text-up border border-up/25 px-2 py-0.5 rounded text-[10px] font-bold`
- LOCKED: `bg-down/12 text-down border border-down/25 px-2 py-0.5 rounded text-[10px] font-bold`
- COOLDOWN: `bg-yellow-500/12 text-yellow-400 border border-yellow-500/25 px-2 py-0.5 rounded text-[10px] font-bold`

**Per-column value colors:**
| Column | Cell classes |
|--------|-------------|
| Pair | `font-bold text-white` |
| Assigned Bots | `text-muted font-sans text-[11px]` |
| Price | default white |
| 24h Change | positive=`text-up font-medium`, negative=`text-down font-medium` |
| Spread | `text-muted` — EXCEPT high spread `text-yellow-400` (DOGE 0.12%) |
| 24h Vol | `text-muted` |
| Volatility | Low=`text-up`, Med=`text-yellow-400`, High=`text-down` |
| Open Pos | `text-center font-bold` |
| Lock | `text-center` — active lock: `text-down text-[10px] font-bold` ("14m left"), cooldown: `text-yellow-400 text-[10px] font-bold` ("5m left"), no lock: "—" |

**Control buttons:**
- LOCK button (for ACTIVE pairs): `bg-black l-bd hover:bg-down/20 text-muted hover:text-down px-2 py-0.5 rounded text-[10px] font-bold transition-colors` title="Lock pair"
- UNLOCK button (for LOCKED/COOLDOWN pairs): `bg-black l-bd hover:bg-up/20 text-muted hover:text-up px-2 py-0.5 rounded text-[10px] font-bold transition-colors` title="Unlock pair"

---

#### 5B-4. Performance Table (design lines 1663–1736)
Container: `trade-tab-content flex-1 overflow-x-auto overflow-y-auto` + `style="display:none"`

**Columns** (9 columns):
| # | Header | Sortable | Filterable | Align |
|---|--------|----------|------------|-------|
| 1 | Pair | YES | YES | left |
| 2 | Trades | YES | No | right |
| 3 | Wins | YES | No | right |
| 4 | Losses | YES | No | right |
| 5 | Win Rate | YES | No | right |
| 6 | Profit % | YES | No | right + `bg-black/20` |
| 7 | Profit Abs | YES | No | right + `bg-black/20` |
| 8 | Avg Profit | YES | No | right |
| 9 | Total Fees | YES | No | right |

**Per-column value colors:**
| Column | Cell classes |
|--------|-------------|
| Pair | `font-bold text-white` |
| Trades | default white |
| Wins | `text-up` |
| Losses | `text-down` |
| Win Rate | above 50%=`text-up font-medium`, below 50%=`text-down font-medium`, near 50% (ETH 61.1%)=just `font-medium` (no color class!) |
| Profit % | positive=`bg-up/5 text-up font-bold`, negative=`bg-down/5 text-down font-bold` |
| Profit Abs | positive=`bg-up/5 text-up`, negative=`bg-down/5 text-down` |
| Avg Profit | positive=`text-up`, negative=`text-down` |
| Total Fees | `text-muted` |

**⚠ CRITICAL Win Rate color nuance:** ETH at 61.1% has just `font-medium` without `text-up`, while SOL (75.0%) and BTC (68.8%) have `text-up font-medium`. The threshold appears to be ~65%. XRP (43.8%) and DOGE (27.8%) use `text-down font-medium`.

---

#### 5B-5. Entry Tags Table (design lines 1739–1818)
Container: `trade-tab-content flex-1 overflow-x-auto overflow-y-auto` + `style="display:none"`

**⚠ Row class difference:** Entry Tags rows use `hover:bg-white/[0.04]` ONLY — NO `transition-colors`, NO `group`. This differs from Open Trades/Closed/Whitelist/Performance which all have `transition-colors`.

**Columns** (10 columns):
| # | Header | Sortable | Filterable | Align |
|---|--------|----------|------------|-------|
| 1 | Tag | YES | YES | left |
| 2 | Trades | YES | No | right |
| 3 | Wins | YES | No | right |
| 4 | Losses | YES | No | right |
| 5 | Win Rate | YES | No | right |
| 6 | Avg P&L % | YES | No | right |
| 7 | Total P&L | YES | No | right |
| 8 | Avg Duration | YES | No | right |
| 9 | Best Pair | YES | YES | left |
| 10 | Expectancy | YES | No | right |

**Per-column value colors:**
| Column | Cell classes |
|--------|-------------|
| Tag | `text-white font-medium` |
| Trades | default white |
| Wins | `text-up` |
| Losses | `text-down` |
| Win Rate | ≥65%=`text-up font-medium`, ~50%=just `font-medium`, <40%=`text-down font-medium` |
| Avg P&L % | positive=`text-up`, negative=`text-down` |
| Total P&L | positive=`text-up font-bold`, negative=`text-down font-bold` |
| Avg Duration | `text-muted` |
| Best Pair | `text-white/70` |
| Expectancy | positive=`text-up font-bold` or just `text-up`, negative=`text-down` |

---

#### 5B-6. Exit Reasons Table (design lines 1821–1900)
Container: `trade-tab-content flex-1 overflow-x-auto overflow-y-auto` + `style="display:none"`

**⚠ Row class difference:** Same as Entry Tags — rows use `hover:bg-white/[0.04]` ONLY, NO `transition-colors`.

**Columns** (10 columns — SAME structure as Entry Tags):
| # | Header | Sortable | Filterable | Align |
|---|--------|----------|------------|-------|
| 1 | Reason | YES | YES | left |
| 2 | Exits | YES | No | right |
| 3 | Wins | YES | No | right |
| 4 | Losses | YES | No | right |
| 5 | Win Rate | YES | No | right |
| 6 | Avg P&L % | YES | No | right |
| 7 | Total P&L | YES | No | right |
| 8 | Avg Duration | YES | No | right |
| 9 | Best Pair | YES | YES | left |
| 10 | Expectancy | YES | No | right |

**Per-column value colors:** Same as Entry Tags, with these specifics:
| Column | Cell classes |
|--------|-------------|
| Reason | `text-white font-medium` |
| Wins/Losses | `text-up` / `text-down` — **EXCEPT** roi row Losses=0 shows `text-down` (the 0 value), stoploss row Wins=0 shows `text-up` (the 0 value) |
| Win Rate | 100%=`text-up font-medium`, 0%=`text-down font-medium` |
| Total P&L | positive=`text-up font-bold`, negative=`text-down font-bold` |
| Expectancy | positive=`text-up font-bold`, negative=`text-down font-bold` or `text-down` |

---

### 6. COL 3: Right Sidebar (design lines 1905–2007)
Container: `w-[320px] flex flex-col gap-4 min-w-[320px] shrink-0 overflow-y-auto min-h-0`
**⚠ CRITICAL:** COL 3 uses `gap-4` (16px) — DIFFERENT from COL 1 and COL 2 which use `gap-5` (20px). This is intentional: tighter spacing for the sidebar panels.

Four panels stacked:

#### 6A. Balance Breakdown (design lines 1908–1938)
Card: `bg-surface l-bd rounded-md shadow-xl overflow-hidden shrink-0`
Header: `h-10 l-b flex items-center px-4 bg-black/40 shrink-0`
- Title: `section-title` — "Balance"

Body: `p-4 font-mono text-[12px] space-y-2.5`
Each currency row: `flex items-center` (NOT flex justify-between — uses w-10 + ml-auto for layout)

| Row | Left | Center | Right |
|-----|------|--------|-------|
| USDT | `text-muted w-10` | `text-white font-medium` 82,330.80 | `text-muted text-[10px] ml-auto` "free" |
| BTC | `text-muted w-10` | `text-white font-medium` 0.4821 | `text-white/30 text-[10px] ml-auto` "≈ $31,420" |
| ETH | `text-muted w-10` | `text-white font-medium` 3.200 | `text-white/30 text-[10px] ml-auto` "≈ $12,420" |
| SOL | `text-muted w-10` | `text-white font-medium` 8.50 | `text-white/30 text-[10px] ml-auto` "≈ $1,280" |

Footer row: `pt-2 flex justify-between` (NOTE: different from currency rows — uses justify-between, NOT items-center)
- Label: `text-white/50 text-[11px] uppercase font-sans font-medium` — "Starting Capital"
- Value: `text-white font-medium` — "$108,510.00"

**⚠ CRITICAL:** USDT row right column says "free" in `text-muted`, while other coin rows say "≈ $X" in `text-white/30`. Different opacity!

#### 6B. Fees & Costs (design lines 1941–1971)
Card: `bg-surface l-bd rounded-md shadow-xl overflow-hidden shrink-0`
Header: `h-10 l-b flex items-center px-4 bg-black/40 shrink-0`
- Title: `section-title` — "Fees & Costs"

Body: `p-4 font-mono text-[12px] space-y-3`

| Row | Label | Value | Value color |
|-----|-------|-------|-------------|
| Total Fees Paid | `text-muted` | -$647.00 | `text-down font-bold` |
| Entry Fees (avg) | `text-muted` | 0.04% | `text-white/70` |
| Exit Fees (avg) | `text-muted` | 0.04% | `text-white/70` |
| Funding Fees | `text-muted` | -$124.50 | `text-down` |
| — separator: `pt-2.5` — | | | |
| Fees / Gross Profit | `text-muted` | 3.4% | `text-yellow-400 font-bold` |
| Net vs Gross | `text-muted` | $19,587 / $20,234 | `text-white/70` |

Each row: `flex justify-between items-center`
After Funding Fees, the next row has `pt-2.5` for visual spacing.

#### 6C. Node Telemetry (design lines 1974–1990)
Card: `bg-surface l-bd rounded-md p-4 flex flex-col gap-4 shadow-xl shrink-0`
**NOTE:** This card has NO header bar — the title is inline in the body padding.
- Title: `section-title` — "Node Telemetry"

**Progress bars:**
CPU:
- Label row: `flex justify-between text-[12px] font-mono mb-1.5` — "CPU" (`text-muted`) + "14%" (`text-white font-medium`)
- Bar: `h-1.5 w-full bg-white/10 rounded-full overflow-hidden`
  - Fill: `h-full bg-white/70 rounded-full` style="width: 14%"

RAM:
- Label row: same — "RAM" (`text-muted`) + "82%" (`text-yellow-400 font-medium`)
- Bar: same outer
  - Fill: `h-full bg-yellow-400 rounded-full` style="width: 82%"

**⚠ CRITICAL:** CPU value is `text-white font-medium` with white bar fill (`bg-white/70`). RAM value is `text-yellow-400 font-medium` with yellow bar fill (`bg-yellow-400`). The color changes based on usage level.

**Stats grid** (`grid grid-cols-2 gap-3 text-[11px] font-mono`):
| Label | Value | Value color |
|-------|-------|-------------|
| Binance | 32ms | `text-up` |
| Kraken | 45ms | `text-up` |
| FT Process | 1.2s ago | `text-white/70` |
| DB Sync | OK | `text-up` |

Each: `flex justify-between` with label in `text-muted`

#### 6D. Terminal StdOut (design lines 1993–2006)
Card: `bg-black l-bd rounded-md flex flex-col shadow-xl overflow-hidden p-3 font-mono text-[11px] leading-relaxed text-muted shrink-0 h-[320px]`
**NOTE:** This card uses `bg-black` (not bg-surface) and has fixed height `h-[320px]`.

**Header** (`flex justify-between items-center mb-3 px-1`):
- Title: `section-title text-white/50` — "Terminal StdOut"
- Status: `flex items-center gap-1.5 text-green-400 text-[11px]`
  - LED: `w-2 h-2 bg-green-400 rounded-full animate-pulse`
  - Text: "Streaming"
  - **⚠ NOTE:** Design HTML has `<div>` inside `<span>` (invalid in React). Use `<span>` or `<div>` consistently — e.g. outer `<div>` with inner `<span>` for the LED.

**Body** (`flex-1 overflow-y-auto l-bd rounded p-3 bg-black`):
Log entries, each `mb-2`:
- Timestamp: `text-white/35 pr-2` — e.g. "14:02:11"
- Level badge colors:
  - INFO: `text-blue-400 font-medium`
  - BUY: `text-up font-bold`
  - HTTP: `text-yellow-500 font-medium`
  - FILL: `text-up font-bold`
  - WARN: `text-down font-bold`

Sample log entries:
```
14:02:11 INFO TrendFollowerV3_BTC evaluated rules.
14:02:11 BUY  Executing LONG on BTC/USDT (Size: 0.50).
14:02:12 HTTP Binance API /order sent. Latency 32ms.
14:02:12 FILL Order Filled at 64,220.00.
14:03:00 INFO DB heartbeat synchronized.
14:05:00 WARN High volatility detected on SOL/USDT.
```

---

---

### 7. Fleet Management Page — Compare View (design lines 3497–3690)
**This is a SEPARATE PAGE (`page-fleet`) navigated to from the Dashboard's "Compare View" button.**

Page container: `flex-1 overflow-y-auto flex-col p-5 gap-5`
**⚠ NOTE:** Same issue as Dashboard page — needs `flex` added for `flex-col` to work.

#### 7A. Fleet Header (design lines 3500–3514)
Container: `flex items-center justify-between mb-5 shrink-0`

**LEFT side** (`flex items-center gap-4`):
- Back button: `text-muted hover:text-white transition-colors flex items-center gap-1.5 text-[12px] font-medium` title="Back to Dashboard"
  - Lucide `ArrowLeft` icon: `w-4 h-4`
  - Text: "Dashboard"
- Separator: `text-white/15` — "|"
- Title: `text-[16px] font-bold uppercase tracking-widest text-white/80` — "Fleet Management"
- Bot count badge: `bg-white/10 px-2.5 py-1 rounded text-[11px] font-mono text-muted` — "312 bots"
- Running count: `flex items-center gap-1.5 text-up text-[11px] font-mono`
  - LED: `w-2 h-2 bg-up rounded-full animate-pulse`
  - Text: "284 running"
- Paused count: `flex items-center gap-1.5 text-yellow-400 text-[11px] font-mono` — "16 paused" (NO LED)
- Stopped count: `flex items-center gap-1.5 text-down text-[11px] font-mono` — "12 stopped" (NO LED)

**RIGHT side** (`flex items-center gap-2`):
- Compare Selected button: `px-3 py-1.5 border border-white/12 rounded text-[11px] hover:bg-white/10 font-medium transition-colors flex items-center gap-1.5` title="Compare selected bots side by side"
  - Lucide `GitCompare` icon: `w-3.5 h-3.5`
  - Text: "Compare Selected"
- Export CSV button: `px-3 py-1.5 border border-white/12 rounded text-[11px] hover:bg-white/10 font-medium transition-colors flex items-center gap-1.5` title="Export fleet data as CSV"
  - Lucide `Download` icon: `w-3.5 h-3.5`
  - Text: "Export CSV"

**⚠ NOTE:** Running count has an animated LED (`animate-pulse`), Paused and Stopped do NOT.

#### 7B. Fleet Table (design lines 3517–3688)
Outer: `flex-1 bg-surface l-bd rounded-md shadow-xl overflow-hidden flex flex-col`
Table wrapper: `flex-1 overflow-x-auto overflow-y-auto`
Table: `w-full text-left border-collapse whitespace-nowrap text-[13px]`
Thead: `sticky top-0 bg-surface l-b font-mono text-[11px] uppercase tracking-widest text-muted z-10 shadow-lg`
Tbody: `font-mono text-white/85 divide-y divide-white/[0.05]`

**Columns** (15 columns):
| # | Header | Sortable | Filterable | Align | Header px |
|---|--------|----------|------------|-------|-----------|
| 1 | (checkbox) | No | No | left | `px-3 py-3 w-8` |
| 2 | Status | YES | YES | left | `px-3 py-3` |
| 3 | Bot Name | No | No | left | `px-4 py-3` |
| 4 | Strategy | YES | No | left | `px-3 py-3` |
| 5 | Exchange | YES | YES | left | `px-3 py-3` |
| 6 | Balance | YES | No | right | `px-3 py-3` |
| 7 | Today P&L | YES | No | right + `bg-black/20` | `px-3 py-3` |
| 8 | Total P&L | YES | No | right + `bg-black/20` | `px-3 py-3` |
| 9 | P&L % | YES | No | right + `bg-black/20` | `px-3 py-3` |
| 10 | Win Rate | YES | No | right | `px-3 py-3` |
| 11 | Trades | YES | No | right | `px-3 py-3` |
| 12 | Open | YES | No | right | `px-3 py-3` |
| 13 | Drawdown | YES | No | right | `px-3 py-3` |
| 14 | Avg Dur | YES | No | right | `px-3 py-3` |
| 15 | Actions | YES | No | center | `px-3 py-3` |

**⚠ CRITICAL differences from Dashboard tables:**
- Uses `px-3 py-3` headers (not `px-5 py-3.5`)
- Uses `px-3 py-2.5` / `px-4 py-2.5` for cell padding (tighter than Dashboard's `px-5 py-3`)
- Bot Name column uses `px-4` (not `px-3`) for extra breathing room
- Checkbox column first: `<input type="checkbox">` with `onclick="event.stopPropagation()"`
- Header checkbox: `<input type="checkbox" class="rounded" title="Select all">`

**Status badges** (different format from Dashboard fleet cards!):
- RUN: `flex items-center gap-1.5` → LED `w-2 h-2 bg-up rounded-full shadow-[0_0_4px_#22c55e]` + `text-up text-[10px] font-bold` "RUN"
- PAUSE: `flex items-center gap-1.5` → LED `w-2 h-2 bg-yellow-400 rounded-full` (NO shadow) + `text-yellow-400 text-[10px] font-bold` "PAUSE"
- STOP: `flex items-center gap-1.5` → LED `w-2 h-2 bg-down rounded-full` (NO shadow) + `text-down text-[10px] font-bold` "STOP"

**Per-column value colors:**
| Column | Cell classes |
|--------|-------------|
| Bot Name | LIVE: `font-bold text-white`, PAUSED: `font-bold text-white/60`, STOPPED: `font-bold text-white/40` |
| Strategy | `text-muted font-sans text-[11px]` |
| Exchange | `text-muted` |
| Balance | default white |
| Today P&L | Positive: `bg-up/5 text-up font-bold`, Negative: `bg-down/5 text-down font-bold`, PAUSED/STOPPED zero: `text-muted` ("$0.00" or "—") |
| Total P&L | Positive: `bg-up/5 text-up`, Negative: `bg-down/5 text-down` |
| P&L % | Positive: `bg-up/5 text-up text-[11px]`, Negative: `bg-down/5 text-down text-[11px]` |
| Win Rate | High (≥65%): `text-up`, Normal: default, Low (<50%): `text-down` |
| Trades | default white |
| Open | default, zero for PAUSED/STOPPED: `text-muted` |
| Drawdown | `text-down` (always negative) |
| Avg Dur | default white |

**⚠ CRITICAL — Actions Column: SMALLER bot-ctrl buttons!**
Fleet table buttons use **inline style** to override the default 28×28px bot-ctrl size:
- Each button: `bot-ctrl` + `style="width:22px;height:22px"` (22px, NOT 28px!)
- Icons: `w-2.5 h-2.5` (NOT w-3 h-3 like Dashboard fleet cards!)
- Container: `flex gap-0.5 justify-center` (gap-0.5, NOT gap-1 like Dashboard!)
- Soft Kill: `style="width:22px;height:22px;color:#facc15"` (combined inline style)
- Same 8 buttons + separator as Dashboard fleet cards
- Same title attributes (emoji variant: 🛡/⚡)

**Row classes:** `hover:bg-white/[0.04] transition-colors cursor-pointer`
- Every other row adds: `bg-white/[0.015]` (alternating background)
- ALL rows are clickable (onclick → open bot drawer), even though the design HTML only has onclick on the first 2 rows (prototype shortcut)
- **NOTE:** Fleet rows do NOT have `group` class (unlike Dashboard Open Trades rows) — no opacity animation needed here

#### 7C. Fleet Footer (design lines 3680–3687)
Container: `h-10 l-b bg-black/40 flex items-center justify-between px-5 shrink-0 font-mono text-[11px] text-muted`

- LEFT: "Showing 8 of 312 bots"
- RIGHT (`flex items-center gap-3`):
  - "Sort: P&L ▼"
  - "Filter: All"
  - Page indicator: `text-white/50` — "Page 1 / 39"

#### Fleet Page Title Attributes (additional to Dashboard):
- Back button: `"Back to Dashboard"`
- Select all checkbox: `"Select all"` (on the `<input>` element)
- Compare Selected: `"Compare selected bots side by side"`
- Export CSV: `"Export fleet data as CSV"`

#### Fleet Page File Structure Addition:
```
frontend/src/app/dashboard/
├── fleet/
│   └── page.tsx                          — Fleet Management compare view (full table)
```

#### Sample Fleet Data (8 bots in design):
| # | Name | Status | Strategy | Exchange | Balance | Today | Total | P&L% | Win | Trades | Open | DD | Dur | Alt BG |
|---|------|--------|----------|----------|---------|-------|-------|------|-----|--------|------|-----|-----|--------|
| 1 | TrendFollowerV3_BTC | RUN | TrendFollowerV3 | Binance | $24,500 | +$48.20 | +$4,210 | +17.2% | 72% | 412 | 6 | -1.2% | 1.5h | No |
| 2 | TrendFollowerV3_ETH | RUN | TrendFollowerV3 | Binance | $18,200 | -$12.40 | -$320 | -1.8% | 48% | 84 | 3 | -3.8% | 2.1h | Yes |
| 3 | ScalpBot_XRP_Fast | RUN | ScalperV2 | Binance | $8,400 | +$92.10 | +$1,840 | +21.9% | 71% | 620 | 4 | -2.1% | 0.4h | No |
| 4 | MomentumRider_SOL | PAUSE | MomentumV1 | Kraken | $12,100 | $0.00 | +$890 | +7.4% | 62% | 156 | 0 | -5.2% | 3.2h | Yes |
| 5 | MemeScalper_DOGE | STOP | MemeScalperV1 | Binance | $2,400 | — | -$420 | -17.5% | 28% | 18 | 0 | -12.4% | 0.8h | No |
| 6 | GridBot_BNB_DCA | RUN | GridDCA_V2 | Binance | $5,800 | +$14.80 | +$640 | +11.0% | 81% | 340 | 8 | -0.8% | 4.2h | Yes |
| 7 | BreakoutHunter_AVAX | RUN | BreakoutV3 | Kraken | $6,200 | +$220.40 | +$3,120 | +50.3% | 68% | 210 | 2 | -3.4% | 1.8h | No |
| 8 | MeanRevert_LINK | RUN | MeanRevertV1 | Binance | $4,100 | -$8.50 | +$280 | +6.8% | 55% | 92 | 1 | -6.1% | 5.4h | Yes |

**⚠ Key data differences from Dashboard fleet cards:**
- Fleet table has MORE data per bot (Strategy name, Exchange, Balance, separate Total vs Today P&L)
- PAUSED bot Today P&L shows "$0.00" (not "—"), Open shows "0" in `text-muted`
- STOPPED bot Today P&L shows "—" in `text-muted`, Open shows "0" in `text-muted`
- Bot 2 (TrendFollowerV3_ETH) has DIFFERENT data: Total P&L -$320 (Dashboard shows as LIVE with -$12.40 today only)
- Bot 8 (MeanRevert_LINK) is a NEW bot NOT in the Dashboard fleet panel (Dashboard only shows 6, Fleet shows 8)

---

## BUTTON TITLE ATTRIBUTES (Complete List — 33 unique in design HTML)

### Fleet Management Header
1. Compare View: `"Open Fleet Management — Compare all bots side by side"`

### Bot Control Buttons (per bot — 8 buttons)
2. Start: `"▶ Start Bot — Resume trading engine"`
3. Stop: `"■ Stop Bot — Gracefully stop trading"`
4. Pause: `"⏸ Pause — Stop opening new trades"`
5. Reload Config: `"↻ Reload Config — Hot-reload strategy config"`
6. Force Exit All: `"✕ Force Exit All — Close all open positions"`
7. Toggle Stopbuy: `"⊞ Toggle Stopbuy — Prevent new buy orders"`
8. Soft Kill: `"Soft Kill — exits all trades, keeps bot"`
9. Hard Kill: `"Hard Kill — force stop bot + container"`

### Chart Controls
10. Days: `"Show daily chart"`
11. Weeks: `"Show weekly chart"`
12. Months: `"Show monthly chart"`
13. Abs $: `"Show absolute dollar values"`
14. Rel %: `"Show relative percentage values"`
15. Sidebar toggle: `"Toggle right sidebar (Balance, Fees, Telemetry)"`

### Trade Table Tabs
16. Open Trades: `"Currently active trades"`
17. Closed: `"Completed trade history"`
18. Whitelist Matrix: `"Pair monitoring and lock management"`
19. Performance: `"Performance by trading pair"`
20. Entry Tags: `"Entry signal tag analysis"`
21. Exit Reasons: `"Exit reason analysis"`
22. CSV: `"Export table data as CSV"`

### Open Trades Actions
23. Actions dropdown trigger: `"Trade actions menu"`
24. Forceexit limit: `"Close trade at limit price"`
25. Forceexit market: `"Close trade at market price"`
26. Forceexit partial: `"Close partial position"`
27. Increase position: `"Add to existing position"`
28. Reload: `"Reload trade from exchange"`
29. Delete trade: `"🗑 Delete trade — Remove from history permanently"`

### Whitelist Matrix Controls
30. Lock: `"Lock pair"`
31. Unlock: `"Unlock pair"`

### Fleet Management Page (page-fleet)
32. Back to Dashboard: `"Back to Dashboard"`
33. Select all: `"Select all"` (on checkbox input)
34. Compare Selected: `"Compare selected bots side by side"`
35. Export CSV: `"Export fleet data as CSV"`

### Variant titles (Bot 3+ in design — use canonical versions above instead)
36. Soft Kill variant: `"🛡 Soft Kill — Exit all trades, keep bot alive"` (use #8 instead)
37. Hard Kill variant: `"⚡ Hard Kill — Force stop bot + container"` (use #9 instead)

---

## TAB VISIBILITY DEFAULTS

**Trade tabs:** `trade-tab-content` class on each panel
- Open Trades: VISIBLE (no display:none — default active)
- Closed, Whitelist Matrix, Performance, Entry Tags, Exit Reasons: `style="display:none"` (hidden)

---

## VERIFICATION CHECKLIST

### Widgets Count: ~60+ distinct widgets

**KPI Bar (14 widgets):**
- [ ] Total Equity KPI
- [ ] Locked in Trades KPI (with % sub-value)
- [ ] Today's P&L KPI (text-up, with % sub-value)
- [ ] Total P&L (Closed) KPI (text-up, with % sub-value)
- [ ] Open P&L KPI (text-up, with % sub-value)
- [ ] Open Trades KPI (with "/ 100 max" sub-value)
- [ ] Max Drawdown KPI (text-down)
- [ ] Win Rate KPI (with W/L sub-value)
- [ ] Profit Factor KPI (text-up)
- [ ] Avg Duration KPI
- [ ] Total Trades KPI
- [ ] Best Pair KPI (text-up, with % sub-value)
- [ ] Sharpe Ratio KPI
- [ ] Trading Volume KPI

**Fleet Management (per bot × 6 = ~30 widgets):**
- [ ] Fleet header with icon + count + Compare button
- [ ] Bot row: status LED + name + status badge
- [ ] Bot row: P&L dollar + P&L percent (inline rgba color)
- [ ] Bot row: 4-stat grid (Trades, Win, DD, Avg Dur)
- [ ] Bot row: sparkline bars (5 bars)
- [ ] Bot row: 8 control buttons + separator
- [ ] Alternating row backgrounds (bg-white/[0.015])
- [ ] PAUSED bot styling (yellow LED, text-white/60, $0.00 text-muted)
- [ ] STOPPED bot styling (red LED, text-white/40, low win% text-down)

**Profit Charts:**
- [ ] Profit Over Time: title + time range buttons (Days/Weeks/Months)
- [ ] Profit Over Time: value mode buttons (Abs $/Rel %)
- [ ] Profit Over Time: sidebar toggle button
- [ ] Profit Over Time: legend (Profit line + Trade Count bars)
- [ ] Profit Over Time: left Y-axis labels
- [ ] Profit Over Time: chart area (line + bars + dots)
- [ ] Profit Over Time: X-axis date labels
- [ ] Profit Distribution: histogram bars (11 bars, color gradient)
- [ ] Profit Distribution: X-axis labels (-0.02, 0, +0.01)
- [ ] Profit Distribution: Absolute DD + Relative DD stats

**Trade Table:**
- [ ] Tab bar with 6 tabs + CSV button
- [ ] Active tab: border-b-2 border-up
- [ ] Open Trades: 12 columns, sticky header, sortable/filterable
- [ ] Open Trades: Side badges (LONG green, SHORT red)
- [ ] Open Trades: Action menu dropdown (7 items + 2 separators)
- [ ] Closed Trades: 11 columns, Exit Reason stoploss=text-down
- [ ] Whitelist Matrix: 11 columns, Status badges (ACTIVE/LOCKED/COOLDOWN)
- [ ] Whitelist Matrix: Lock/Unlock buttons
- [ ] Performance: 9 columns, Win Rate color thresholds
- [ ] Entry Tags: 10 columns
- [ ] Exit Reasons: 10 columns

**Right Sidebar:**
- [ ] Balance: 4 currency rows + Starting Capital footer
- [ ] Fees & Costs: 6 stat rows with correct colors
- [ ] Node Telemetry: CPU + RAM progress bars + 4 stats
- [ ] Terminal StdOut: streaming indicator + log entries with colored levels

**Fleet Management Page (page-fleet):**
- [ ] Fleet header: Back button + title + bot counts (3 status counts)
- [ ] Fleet header: running count with animated LED
- [ ] Fleet header: Compare Selected + Export CSV buttons
- [ ] Fleet table: 15 columns with checkbox first
- [ ] Fleet table: Select All checkbox in header
- [ ] Fleet table: Status badges (RUN/PAUSE/STOP with LED)
- [ ] Fleet table: Bot name per-status colors (text-white/text-white/60/text-white/40)
- [ ] Fleet table: Smaller bot-ctrl buttons (22×22px inline style, w-2.5 h-2.5 icons)
- [ ] Fleet table: gap-0.5 for button container (NOT gap-1)
- [ ] Fleet table: 3 highlighted columns (Today P&L, Total P&L, P&L %) with bg-black/20
- [ ] Fleet footer: showing count, sort, filter, pagination

### Custom CSS Classes (must be in globals.css):
`l-bd`, `l-b`, `l-r`, `l-t`, `l-grid`, `kpi-label`, `kpi-value`, `section-title`, `sortable`, `filterable`, `bot-ctrl`, `ctrl-start`, `ctrl-stop`, `ctrl-pause`, `action-menu`, `action-menu-btn`, `action-dropdown`, `sidebar-toggle`, `trade-tab-btn`, `trade-tab-content`

---

## DO NOT:
- Use default Tailwind sizes when the design specifies exact pixel sizes
- Skip any widget — even if it seems "minor", it must exist
- Invent classes — use ONLY what's in the design HTML
- Use generic placeholder text — use the exact mock data from the design
- Hardcode data in a way that can't be replaced with API data later (use variables/state)
- Forget empty states for when there's no data
- Use text-up/text-down for P&L percentages in bot rows — they use INLINE RGBA styles
- Use bg-surface for the Terminal card — it uses bg-black
- Forget the shadow-lg on sticky thead
- Miss the border-l border-white/8 on Actions column
- Forget action dropdown opens UPWARD (bottom: 100%)
