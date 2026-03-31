# FreqTrade Orchestrator — Design System v1.0

> **This document is the single source of truth for all UI across the platform.**
> Every page, component, and widget MUST conform to these specifications.
> Any deviation requires explicit approval and documentation here first.

---

## 1. Color Palette

### Core Tokens (Tailwind Config)

| Token | Value | Usage |
|---|---|---|
| `background` | `#000000` | Page background, full-bleed |
| `surface` | `#0C0C0C` | Cards, panels, table containers |
| `border` | `rgba(255,255,255,0.10)` | Default border for all elements |
| `borderHover` | `rgba(255,255,255,0.22)` | Hover state for interactive borders |
| `muted` | `#9CA3AF` | Secondary text, labels, placeholders |
| `foreground` | `#F5F5F5` | Primary text (rarely used — prefer `text-white`) |
| `accent` | `#FFFFFF` | Active state text, emphasis |
| `up` | `#22c55e` | Profit, positive values, success, live status |
| `down` | `#ef4444` | Loss, negative values, danger, errors |

### Semantic Opacity Scale (White-Based)

| Class | Usage |
|---|---|
| `text-white` | Primary headings, active states |
| `text-white/85` | Table body text |
| `text-white/80` | Secondary data in tables |
| `text-white/70` | Tertiary info (best pair, etc.) |
| `text-white/50` | Section titles, faded content |
| `text-white/30` | Right-aligned metadata (balance USD equivalent) |
| `text-white/25` | Chart axis labels |
| `text-white/20` | Faintest data/grid lines |
| `text-white/15` | Separators (`\|` dividers) |

### Background Opacity Scale

| Class | Usage |
|---|---|
| `bg-black` | Sidebar, top bar, dropdown menus |
| `bg-black/40` | Tab bars, header rows |
| `bg-black/20` | Sub-headers, secondary thead rows |
| `bg-surface` | Cards, widget containers |
| `bg-white/10` | Active nav buttons, active toggle |
| `bg-white/[0.04]` | Table row hover |
| `bg-white/[0.015]` | Alternating table row stripe |
| `bg-white/6` | Subtle button hover |
| `bg-up/5` | Profit cell highlight |
| `bg-up/15` | Active profit toggle (Abs $) |
| `bg-down/5` | Loss cell highlight |

### Status Colors

| Status | Text | Background | Border |
|---|---|---|---|
| LIVE | `text-up` | `bg-up/12` | — |
| PAUSED | `text-yellow-400` | `bg-yellow-500/12` | — |
| STOPPED | `text-down` | `bg-down/12` | — |
| LONG | `text-up` | `bg-up/12` | — |
| SHORT | `text-down` | `bg-down/12` | — |
| COOLDOWN | `text-yellow-400` | `bg-yellow-500/12` | — |

---

## 2. Typography

### Font Families

| Token | Font | Usage |
|---|---|---|
| `font-sans` | `Inter` | UI text, labels, buttons, headings |
| `font-mono` | `JetBrains Mono` | Numbers, data, KPI values, table bodies, terminal |

### Font Size Scale

| Size | Usage |
|---|---|
| `text-[8px]` | Micro labels (rare) |
| `text-[9px]` | Chart axis labels, chart legend |
| `text-[10px]` | Toggle buttons (Days/Weeks), filter triangles, CSV button, sidebar toggle |
| `text-[11px]` | KPI labels, fee values, status badges, bot stats, thead uppercase |
| `text-[12px]` | Section titles, trade tab buttons, bot card text, nav buttons |
| `text-[13px]` | Table body text, nav items, page title |
| `text-[16px]` | Fleet page heading, large KPI values at 1600px |
| `text-xl` | KPI primary values (largest) |

### Font Weights

| Weight | Class | Usage |
|---|---|---|
| 400 | (default) | Body text |
| 500 | `font-medium` | KPI labels, table headers, metadata |
| 600 | `font-semibold` | Active nav button |
| 700 | `font-bold` | KPI values, section titles, tab buttons, profit/loss values |

### Text Transforms

| Class | Usage |
|---|---|
| `uppercase tracking-wide` | Tab buttons (0.025em) |
| `uppercase tracking-widest` | Section titles, thead (0.08em) |
| `uppercase tracking-wider` | Drawer tab buttons |

---

## 3. Spacing System

### Padding

| Scale | Usage |
|---|---|
| `p-4` / `px-4` | Widget inner padding, card content |
| `p-5` / `px-5` | Page padding, table cell padding |
| `px-3 py-1` | Small buttons (toggles) |
| `px-3 py-2.5` | Nav buttons |
| `px-5 py-3` | Table cells (standard) |
| `px-5 py-3.5` | Table header cells |

### Gaps

| Scale | Usage |
|---|---|
| `gap-1` | Bot control button groups |
| `gap-1.5` | Icon + text in buttons |
| `gap-2` | Inline elements, button groups |
| `gap-2.5` | Balance widget rows |
| `gap-3` | Chart header items |
| `gap-4` | Sidebar widget stack, column gaps |
| `gap-5` | Main column gap, dashboard padding |

### Height Tokens

| Token | Usage |
|---|---|
| `h-9` | Drawer tab buttons |
| `h-10` | Widget headers |
| `h-12` | Trade tab bar |
| `h-14` | Top bar, sidebar header |
| `h-[280px]` | Chart container |
| `h-[320px]` | Terminal widget |

---

## 4. Border System

### Utility Classes

| Class | CSS | Usage |
|---|---|---|
| `l-bd` | `border: 1px solid rgba(255,255,255,0.10)` | Card/panel borders |
| `l-b` | `border-bottom: 1px solid rgba(255,255,255,0.10)` | Separators, headers |
| `l-r` | `border-right: 1px solid rgba(255,255,255,0.10)` | Sidebar right edge |

### Border Radius

| Class | Usage |
|---|---|
| `rounded-sm` | Tiny elements (chart bars, status dots) |
| `rounded` | Buttons, badges |
| `rounded-md` | Cards, panels, widgets |
| `rounded-lg` | Search input, large containers |
| `rounded-full` | Status indicator dots |
| `rounded-l` / `rounded-r` | Button group ends (Days/Months, Abs$/Rel%) |
| `rounded-t` | Histogram bars (top corners only) |

---

## 5. Shadow System

| Class | Usage |
|---|---|
| `shadow-lg` | Sticky table headers |
| `shadow-xl` | Cards, panels, widgets |
| `shadow-[0_0_6px_#22c55e]` | Live status pulse glow |
| `shadow-[0_0_4px_#22c55e]` | Bot status glow (smaller) |

---

## 6. Z-Index Scale

| Level | Value | Usage |
|---|---|---|
| Base | `z-10` | Sticky table headers |
| Navigation | `z-20` | Top bar, sidebar |
| Dropdown | `z-40` | Action menus |
| Backdrop | `z-50` | Drawer backdrop |
| Drawer | `z-60` | Bot drawer overlay |

---

## 7. Component Specifications

### 7.1 Section Title

```
.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9CA3AF;
}
```
Usage: Widget headers (Balance, Fees, Telemetry, Profit Over Time, etc.)

### 7.2 KPI Card

```html
<div class="flex flex-col">
  <span class="kpi-label">LABEL TEXT</span>               <!-- 11px, #6B7280, uppercase, tracking 0.08em -->
  <span class="kpi-value text-xl text-white">$VALUE</span> <!-- JetBrains Mono, bold -->
</div>
```
- Grid: `grid-cols-7` (desktop) → `grid-cols-4` (1280px) → `grid-cols-3` (1024px)
- Background: `bg-surface l-b`
- Padding: `px-5 py-3`

### 7.3 Data Table

```
Container: bg-surface l-bd rounded-md shadow-xl flex flex-col min-h-0 overflow-hidden
Tab bar:   h-12 l-b flex items-center bg-black/40 overflow-x-auto whitespace-nowrap
Thead:     sticky top-0 bg-surface l-b font-mono text-[11px] uppercase tracking-widest text-muted z-10 shadow-lg
Th cell:   px-5 py-3.5 font-medium
Tbody:     font-mono text-white/85 divide-y divide-white/[0.05]
Td cell:   px-5 py-3
Row hover: hover:bg-white/[0.04] transition-colors
Alt row:   bg-white/[0.015]
```

### 7.4 Tab Button

```
Base:    h-full px-5 font-bold text-[12px] uppercase tracking-wide shrink-0
Active:  border-b-2 border-white text-white
Inactive: text-muted hover:text-white transition-colors
```
Class: `.trade-tab-btn`

### 7.5 Widget Card

```
Container: bg-surface l-bd rounded-md shadow-xl overflow-hidden shrink-0
Header:    h-10 l-b flex items-center px-4 bg-black/40 shrink-0
Content:   p-4 font-mono text-[12px]
```

### 7.6 Bot Control Button

```css
.bot-ctrl {
  width: 28px; height: 28px;
  border-radius: 5px;
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.10);
  color: #9CA3AF;
  transition: all 0.15s;
}
.bot-ctrl:hover { background: #2a2a2a; color: #F5F5F5; }
```
Variants: `.ctrl-start` (green hover), `.ctrl-stop` (red hover), `.ctrl-pause` (yellow hover)

### 7.7 Status Badge

```html
<span class="bg-up/12 text-up border border-up/25 px-2 py-0.5 rounded text-[10px] font-bold uppercase">LIVE</span>
<span class="bg-down/12 text-down border border-down/25 ...">STOPPED</span>
<span class="bg-yellow-500/12 text-yellow-400 border border-yellow-500/25 ...">PAUSED</span>
```

### 7.8 Action Dropdown

```
Trigger: .action-menu-btn — #1a1a1a bg, 11px, semibold, flex items-center gap-5px
Panel:   .action-dropdown — position: absolute; bottom: 100%; min-width: 200px; bg: #151515; z-40
Items:   12px, flex, gap-10px, full-width, 8px 12px padding, rounded-5
Danger:  .danger — color: #ef4444, hover bg: rgba(239,68,68,0.1)
Divider: .sep — 1px, rgba(255,255,255,0.06), margin: 4px 8px
```

### 7.9 Toggle Button (Subtle)

```
px-2 py-1 rounded text-[10px] text-muted
hover:text-white hover:bg-white/6
opacity-50 hover:opacity-100
transition-colors
```
Usage: CSV export, sidebar toggle, secondary actions

### 7.10 Button Group (Toggle Set)

```
Left:   rounded-l [bg-white/10 text-white] or [text-muted l-bd]
Middle: border-l-0 [text-muted l-bd]
Right:  rounded-r border-l-0 [text-muted l-bd]
Active: bg-white/10 text-white (or bg-up/15 text-up for semantic)
Size:   px-3 py-1 text-[10px] font-bold uppercase
```

### 7.11 Search Input

```
w-96 h-9 bg-black l-bd rounded-lg pl-9 pr-10
text-sm text-foreground font-mono
focus:outline-none focus:border-white/30
Icon: absolute left-3 top-2.5 h-4 w-4 text-muted (lucide search)
```

### 7.12 Nav Button (Sidebar)

```
text-left px-3 py-2.5 rounded-md flex items-center gap-3 text-[13px]
Active:   text-white bg-white/10 font-semibold
Inactive: text-muted hover:text-white hover:bg-white/5 transition-colors
Icon:     w-[18px] h-[18px] shrink-0
Label:    .nav-label (hidden when collapsed)
```

---

## 8. Layout Architecture

### Three-Column Dashboard Grid

```
┌──────────┬──────────────────────────────┬──────────┐
│  Fleet   │        Center               │  Sidebar │
│  400px   │        flex-1               │  320px   │
│ shrink-0 │       min-w-0               │ shrink-0 │
│ scroll-y │                              │ scroll-y │
└──────────┴──────────────────────────────┴──────────┘
```

| Column | ID | Default Width | Min Width |
|---|---|---|---|
| Fleet | `#dash-col-fleet` | 400px | 400px |
| Center | `#dash-col-center` | flex-1 | min-w-0 |
| Sidebar | `#dash-col-sidebar` | 320px | 320px |

### Responsive Breakpoints

| Breakpoint | Fleet | Sidebar | KPI Grid | Trade Tabs | Drawer |
|---|---|---|---|---|---|
| ≥1600px | 400px | 320px | 7-col | 12px/px-5 | 680px |
| ≤1440px | 320px | 260px | 7-col compact | 11px/px-3 | 600px |
| ≤1280px | 280px | **hidden** | 4-col | 10px/px-2 | 500px |
| ≤1024px | 100% stack | **hidden** | 3-col | 10px/px-2 | full-width |

### Left Sidebar

- **Default: COLLAPSED** (56px, icons only)
- Expanded: 240px
- Toggle: `toggleSidebar()` → `.collapsed` class
- Transition: `width 0.25s ease`

### Right Sidebar

- **Default: VISIBLE** (320px)
- Collapsed: 0px (hidden)
- Toggle: `toggleRightSidebar()` → `.collapsed` class
- Transition: `width 0.3s ease, opacity 0.3s ease`
- Toggle button: inside chart header bar

---

## 9. Animation & Transitions

### Standard Durations

| Duration | Usage |
|---|---|
| `0.15s` | Button hover, bot controls, dropdown items |
| `0.25s` | Sidebar collapse, drawer positioning |
| `0.3s` | Page fade-in, drawer slide, right sidebar collapse |

### Keyframes

```css
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
```

### Easing

| Easing | Usage |
|---|---|
| `ease` | Sidebar width, drawer left position |
| `cubic-bezier(0.16, 1, 0.3, 1)` | Drawer slide-in (spring-like) |

---

## 10. Icon System

**Library**: Lucide Icons (CDN)
**Default size**: `w-4 h-4` (16px)
**Small size**: `w-3 h-3` (12px) — in buttons, table controls
**Large size**: `w-[18px] h-[18px]` — sidebar nav icons
**Color**: inherits from parent `text-*` class

### Standard Icons

| Icon | Usage |
|---|---|
| `layout-dashboard` | Control Room nav |
| `flask-conical` | Experiments nav |
| `list` | Strategies nav |
| `settings` | System nav |
| `play` / `square` / `pause` | Bot start/stop/pause |
| `refresh-cw` | Reload |
| `x-square` | Force exit all |
| `shield-alert` | Soft kill |
| `zap` | Hard kill |
| `chevron-down` | Action dropdown trigger |
| `chevrons-left` | Sidebar toggle |
| `panel-right-close/open` | Right sidebar toggle |
| `download` | CSV export |
| `search` | Global search |
| `arrow-left` | Back navigation |
| `git-compare` | Compare view |
| `trash-2` | Delete (danger) |
| `log-out` | Forceexit |
| `scissors` | Partial exit |
| `plus-circle` | Increase position |

---

## 11. Sortable & Filterable Headers

### Sortable (`th.sortable`)

```css
th.sortable { cursor: pointer; user-select: none; }
th.sortable::after { content: '⇅'; margin-left: 6px; opacity: 0.25; }
th.sortable:hover::after { opacity: 0.6; }
th.sort-asc::after { content: '↑'; opacity: 1; color: #fff; }
th.sort-desc::after { content: '↓'; opacity: 1; color: #fff; }
th.sort-asc, th.sort-desc { color: #fff; background: rgba(255,255,255,0.04); }
```

### Filterable (`th.filterable`)

```css
th.filterable::before { /* downward triangle */ border-top: 5px solid rgba(255,255,255,0.2); }
th.filterable:hover::before { border-top-color: rgba(255,255,255,0.6); }
th.filter-active { color: #22d3ee; } /* cyan */
th.filter-active::before { border-top-color: #22d3ee; }
```
- Click opens inline dropdown with unique column values
- Multi-select checkbox style
- "All" option to reset

---

## 12. Drawer System

### Structure

```
Backdrop: fixed inset-0 z-50, bg-black/60, blur(4px)
Drawer:   fixed top-0 bottom-0 z-60, width calc(100vw - var(--drawer-left))
          left: var(--drawer-left), bg-surface, l-bd
Transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)
Closed:   transform: translateX(100%)
Open:     transform: translateX(0)
```

### Tab Bar

```
h-9, overflow-x-auto, whitespace-nowrap
Button: text-[10px] font-bold uppercase tracking-wider
Active: border-b-2 border-white text-white
```

---

## 13. Accessibility Rules

1. **Every `<button>` MUST have a `title` attribute** — descriptive tooltip text
2. **Every sortable/filterable header MUST have `cursor: pointer`**
3. **All interactive elements MUST have hover states** — minimum opacity or color change
4. **Tab focus visible** — default browser outline (do not suppress)
5. **Semantic HTML** — use `<aside>`, `<nav>`, `<header>`, `<table>`/`<thead>`/`<tbody>`
6. **No `<div>` for clickable actions** — always use `<button>`

---

## 14. Data Formatting Rules

| Data Type | Format | Example |
|---|---|---|
| Currency (USD) | `$XX,XXX.XX` | `$18,940.20` |
| Percentage | `XX.X%` or `+X.XX%` | `68.4%`, `+1.02%` |
| Profit (positive) | `+$X,XXX` green | `+$4,210` |
| Loss (negative) | `-$X,XXX` red | `-$680` |
| Date/Time | `DD.MM.YY HH:mm` | `26.10.23 14:02` |
| Duration | `Xh XXm` | `2h 15m` |
| Coin quantity | Raw number | `0.4821`, `3.200` |
| Leverage | `Xs` suffix | `10x`, `5x` |
| Ratio | `X.XX` | `1.82`, `2.14` |
| Chart dates | `MM-DD` | `03-12`, `03-30` |
| Drawdown | `-X.XX%` red | `-4.12%` |

---

## 15. File Naming Convention

| Type | Pattern | Example |
|---|---|---|
| Design prototype | `DESIGN-{VARIANT}.html` | `DESIGN-LINEAR-EDGE-FULL.html` |
| Prompt spec | `PROMPT-{FEATURE}.md` | `PROMPT-DASHBOARD-CONTROL-ROOM.md` |
| Design system | `DESIGN-SYSTEM.md` | This file |

---

## Changelog

| Date | Change |
|---|---|
| 2026-03-31 | v1.0 — Initial extraction from production prototype |
