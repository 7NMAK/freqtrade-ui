# Design System v1.4 — ZERO TOLERANCE SPEC

> **Source of truth:** `DESIGN-LINEAR-EDGE-FULL.html`  
> **Last audit:** 2026-04-03 — ZERO TOLERANCE SYNC  
> **Rule:** Every new element MUST use tokens from this document. No ad-hoc values.

---

## 1. CSS Custom Properties

```css
--drawer-left: 680px;   /* Desktop drawer */
--drawer-left: 600px;   /* Tablet */
--drawer-left: 500px;   /* Small */
--drawer-left: 0px;     /* Mobile collapsed */
```

---

## 2. Color Palette

### Semantic Colors
| Token | Usage | Count |
|---|---|---|
| `text-up` / `bg-up` | Profit, bullish, success | 534 / 92 |
| `text-down` / `bg-down` | Loss, bearish, danger | 281 / 36 |
| `text-muted` | Secondary text, labels, headers | 988 |
| `bg-surface` | Card backgrounds, panels | 137 |
| `text-white` | Primary text | 503 |
| `text-white/70` | Secondary body text | 52 |
| `text-white/80` | Pair names, emphasis body | 14 |
| `text-white/50` | Tertiary labels | 15 |
| `text-white/30` | Disabled, placeholder-level | 30 |
| `text-blue-400` / `bg-blue-500/12` | Entry tags, info badges, MANUAL trigger | 36 / 30 |
| `text-purple-400` / `bg-purple-500/12` | AI features, HEARTBEAT trigger | 14 |
| `text-yellow-400` | Warnings | 19 |
| `text-cyan-400` / `bg-cyan-500/12` | FreqAI, ML features, DRAWDOWN trigger | 16 |
| `text-black` | Text on light backgrounds | 18 |
| `text-[#f59e0b]` / `bg-[#f59e0b]/12` | Amber — warnings, SOFT KILL, overlap badges | 71 |
| `text-[#ef4444]` / `bg-[#ef4444]/12` | Rose — errors, HARD KILL, failures | 15 |
| `text-[#60a5fa]` / `bg-[#60a5fa]/10` | Blue-400 hex — inline blue accents | 3 |
| `text-emerald-500` / `border-emerald-500` | Wizard step checkmarks | 5 |
| `#facc15` | Yellow-500 (brighter yellow, chart highlights) | 15 |
| `#0C0C0C` | Deep black (sidebar bg, near-black) | 3 |
| `#6366f1` | Indigo-500 (chart legend, MA line) | 2 |
| `#151515` | Custom select dropdown bg | 2 |
| `#d4d4d8` | Zinc-300 (custom select hover text) | 2 |
| `#2a2a2a` | Bot control hover bg | 2 |

### Background Opacity Scale
| Token | Usage |
|---|---|
| `bg-white/[0.04]` | Row hover, subtle highlight |
| `bg-white/[0.015]` | Zebra-stripe alternating rows |
| `bg-white/5` | Button hover fills |
| `bg-white/10` | Active button fills |
| `bg-white/15` | Strong emphasis fills |
| `bg-black` | Terminal backgrounds, deep surfaces |
| `bg-black/40` | Panel header overlays |
| `bg-up/12` | Bullish badge background |
| `bg-down/12` | Bearish badge background |
| `bg-up/[0.02]` | Best/starred row tint |
| `bg-up/[0.03]` | Subtle green tint |
| `bg-up/[0.04]` | Selected row green tint |
| `bg-up/5` | Profit cell background highlight (37x) |
| `bg-up/15` | Strong profit emphasis |
| `bg-up/20` | Profit bar segments |
| `bg-up/40` | Chart bar fills (order book) |
| `bg-up/50` | Dense chart bars |
| `bg-up/60` | Prominent chart bars |
| `bg-down/5` | Loss cell background highlight (16x) |
| `bg-down/20` | Loss bar segments |
| `bg-down/40` | Chart bar fills (order book) |
| `bg-down/60` | Prominent loss bars |
| `bg-down/[0.06]` | Subtle bearish row tint |

---

## 3. Typography Scale

| Token | px | Usage | Count |
|---|---|---|---|
| `text-[8px]` | 8 | Sidebar compact thead, micro badges | 30 |
| `text-[9px]` | 9 | Badges, tiny buttons, action labels | 314 |
| `text-[10px]` | 10 | KPI sublabels, sidebar mini-tables, nav tabs | 321 |
| `text-[11px]` | 11 | **THEAD standard**, section-title, tab buttons, KPI labels | 436 |
| `text-[12px]` | 12 | Input fields, select dropdowns, medium labels | 92 |
| `text-[13px]` | 13 | **TABLE BODY standard** — all `<table>` elements | 110 |
| `text-[14px]` | 14 | Large emphasis text (rare) | — |
| `text-[15px]` | 15 | Kill switch CTA titles (Risk page only) | 2 |
| `text-[16px]` | 16 | Page section h2 titles (Fleet) | 1 |
| `text-[32px]` | 32 | Kill switch emoji icons (Risk page only) | 2 |

### KPI Value Size Variants
| Pattern | Usage |
|---|---|
| `kpi-value text-2xl` | Hero KPI (Risk Portfolio, AI Insights) |
| `kpi-value text-xl` | Primary KPI cards (Dashboard, Experiments) |
| `kpi-value text-lg` | Strategy detail KPIs |
| `kpi-value text-base` | Compact KPI (sidebar) |

> [!CAUTION]
> **MANDATORY:** All `<table>` elements MUST use `text-[13px]`. All `<thead>` elements MUST use `text-[11px]`. Exception: sidebar compact table uses `text-[10px]`/`text-[8px]`.
> Non-standard sizes (`text-[15px]`, `text-[16px]`, `text-[32px]`) are ONLY allowed for Kill Switch CTA and page headings.

### Font Families
- `font-mono` — All table data, KPI values, numeric content
- System default — UI labels, nav items, section titles

### Letter Spacing
| Token | Usage |
|---|---|
| `tracking-widest` | **THEAD** — table headers (mandatory) |
| `tracking-wider` | Tab buttons, form labels |
| `tracking-wide` | Navigation items, small buttons |

### Text Transform
- `uppercase` — All thead text, section titles, KPI labels, nav tabs

---

## 4. Table System

### 4A. Full-Width Tables (Dashboard, Fleet)

```html
<table class="w-full text-left border-collapse whitespace-nowrap text-[13px]">
  <thead class="sticky top-0 bg-surface l-b font-mono text-[11px] uppercase tracking-widest text-muted z-10 shadow-lg">
    <tr>
      <th class="px-5 py-3.5 font-medium sortable">Column</th>
      <th class="px-5 py-3.5 font-medium sortable filterable">Filterable</th>
      <th class="px-5 py-3.5 font-medium sortable sort-desc">Default Sort</th>
      <th class="px-5 py-3.5 font-medium text-center">Actions</th> <!-- NO sortable -->
    </tr>
  </thead>
  <tbody class="font-mono text-white/85 divide-y divide-white/[0.05]">
    <tr class="hover:bg-white/[0.04] transition-colors">
      <td class="px-5 py-3">Data</td>
      <td class="px-5 py-3 text-right">$1,234</td>
      <td class="px-5 py-3 text-right text-up font-bold">+42.1%</td>
    </tr>
  </tbody>
</table>
```

### 4B. Compact Tables (Experiments panels, Strategy Drawer)

```html
<table class="w-full text-[13px] font-mono whitespace-nowrap">
  <thead class="sticky top-0 bg-surface z-10 font-mono text-[11px] uppercase tracking-widest text-muted l-b shadow-lg">
    <tr>
      <th class="text-left px-2 py-1.5 font-semibold sortable filterable">Pair</th>
      <th class="text-right px-2 py-1.5 font-semibold sortable sort-desc">Profit</th>
      <th class="text-right px-2 py-1.5 font-semibold sortable">Value</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-white/[0.05]">
    <tr class="hover:bg-white/[0.04]">
      <td class="px-2 py-1.5 text-white">BTC/USDT</td>
      <td class="px-2 py-1.5 text-right text-up font-bold">+42.1%</td>
    </tr>
  </tbody>
</table>
```

> [!CAUTION]
> **TOKENS ON `<thead>`, NOT `<tr>`:** All thead tokens (uppercase, tracking-widest, text-muted, text-[11px]) MUST be on the `<thead>` element, never on the inner `<tr>`. The `<tr>` inside `<thead>` should be a bare `<tr>` with no classes.

### 4C. Overlay Tables (full-screen overlay panels)

```html
<table class="w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono">
  <thead class="bg-surface l-b text-[11px] uppercase tracking-widest text-muted">
    <tr>
      <th class="px-4 py-2.5 sortable">#</th>
      <th class="px-4 py-2.5 sortable filterable">Type</th>
      <th class="px-3 py-2.5 text-center">Actions</th>
    </tr>
  </thead>
  <tbody class="divide-y divide-white/[0.05] text-white/70">
    <tr class="hover:bg-white/[0.04]">
      <td class="px-4 py-2">Data</td>
    </tr>
  </tbody>
</table>
```

### 4D. Fleet Table

```html
<table class="w-full text-left border-collapse whitespace-nowrap text-[13px]">
  <thead class="sticky top-0 bg-surface l-b font-mono text-[11px] uppercase tracking-widest text-muted z-10 shadow-lg">
    <th class="px-3 py-3 font-medium sortable filterable">Column</th>
  </thead>
  <tbody ...>
    <tr><td class="px-3 py-2.5">Data</td></tr>
  </tbody>
</table>
```

### Table Rules (MANDATORY)

> [!CAUTION]
> 1. Every `<th>` with data MUST have `sortable` class  
> 2. Categorical columns (Pair, Side, Strategy, Tag, Status, Exit Reason, Model) MUST also have `filterable`  
> 3. Actions/Controls columns NEVER get `sortable`  
> 4. Exactly ONE column per table MUST have `sort-desc` (default sort)  
> 5. `<tbody>` divider is ALWAYS `divide-white/[0.05]` — never 0.03 or 0.04  
> 6. Row hover is ALWAYS `hover:bg-white/[0.04]` — never 0.03 or 0.02  
> 7. `<thead>` background is ALWAYS `bg-surface` — never `bg-black`  
> 8. Starred/best rows use `bg-up/[0.02]` tint and `text-up font-bold` on rank cell

### Sortable/Filterable CSS

```css
th.sortable { cursor: pointer; user-select: none; position: relative; white-space: nowrap; }
th.sortable:hover { color: #fff; background: rgba(255,255,255,0.04); }
th.sortable::after { content: '⇅'; margin-left: 4px; opacity: 0.25; font-size: 10px; }
th.sortable:hover::after { opacity: 0.6; }
th.sortable.sort-asc::after { content: '↑'; opacity: 0.9; color: #fff; }
th.sortable.sort-desc::after { content: '↓'; opacity: 0.9; color: #fff; }

th.filterable { position: relative; cursor: pointer; }
th.filterable::before { /* dropdown triangle indicator */ }
th.filterable.filter-active { color: #22d3ee; }
```

---

## 5. Card / Surface Pattern

| Pattern | Count | Usage |
|---|---|---|
| `bg-surface l-bd rounded` | 40 | Standard card |
| `bg-surface l-bd rounded-md` | 34 | Panel card with medium radius |
| `bg-surface l-bd rounded-md shadow-xl` | — | Elevated panel (docked panels) |

```html
<!-- Standard card -->
<div class="bg-surface l-bd rounded p-3">
  <h3 class="section-title mb-2">Title</h3>
  <!-- content -->
</div>

<!-- Panel card (Experiments config, etc.) -->
<div class="bg-surface l-bd rounded-md shadow-xl">
  <div class="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
    <h3 class="section-title">Panel Title</h3>
  </div>
  <div class="p-4"><!-- content --></div>
</div>
```

---

## 6. Section Title

```css
.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9CA3AF;
}
```

---

## 7. KPI Label

```css
.kpi-label {
  font-size: 11px;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
  margin-bottom: 4px;
}
```

### `.kpi-value`
```css
.kpi-value {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
}
```

Size variants: `text-2xl` (hero) → `text-xl` (primary) → `text-lg` (detail) → `text-base` (compact)

---

## 8. Badge / Tag System

### 8A. Standard Badges
| Type | Classes | Usage |
|---|---|---|
| **Entry tag** | `px-1.5 py-0.5 bg-blue-500/12 text-blue-400 rounded text-[9px]` | `rsi_oversold`, `ema_cross` |
| **Side LONG** | `bg-up/12 text-up px-1.5 py-0.5 rounded text-[9px] font-bold` | Trade side |
| **Side SHORT** | `bg-down/12 text-down px-1.5 py-0.5 rounded text-[9px] font-bold` | Trade side |
| **AI badge** | `px-1.5 py-0.5 bg-purple-500/12 text-purple-400 rounded text-[9px] font-bold` | AI validation |
| **Type badge** | `px-1.5 py-0.5 rounded text-[8px] bg-white/5 border border-white/10 text-white/50` | BT/HO/AI type |
| **Status dot** | `w-2 h-2 rounded-full bg-up` (or `bg-down`, `bg-yellow-400`) | Online/offline |

### 8B. Risk Page Badges
| Type | Classes | Usage |
|---|---|---|
| **SOFT KILL** | `px-2 py-0.5 bg-[#f59e0b]/12 text-[#f59e0b] border border-[#f59e0b]/20 text-[9px] uppercase font-bold tracking-wider rounded` | Kill type |
| **HARD KILL** | `px-2 py-0.5 bg-[#ef4444]/12 text-[#ef4444] border border-[#ef4444]/20 text-[9px] uppercase font-bold tracking-wider rounded` | Kill type |
| **MANUAL trigger** | `px-2 py-0.5 bg-blue-500/12 text-blue-400 border border-blue-500/20 text-[9px] uppercase font-bold tracking-wider rounded` | Trigger |
| **HEARTBEAT trigger** | `px-2 py-0.5 bg-purple-500/12 text-purple-400 border border-purple-500/20 text-[9px] uppercase font-bold tracking-wider rounded` | Trigger |
| **DRAWDOWN trigger** | `px-2 py-0.5 bg-cyan-500/12 text-cyan-400 border border-cyan-500/20 text-[9px] uppercase font-bold tracking-wider rounded` | Trigger |
| **Active status** | `px-2 py-0.5 bg-up/12 text-up border border-up/25 text-[9px] uppercase font-bold tracking-wider rounded-full` | Protection/lock active |
| **Triggered status** | `px-2 py-0.5 bg-down/12 text-down border border-down/25 text-[9px] uppercase font-bold tracking-wider rounded-full` | Protection triggered |
| **Expired status** | `px-2 py-0.5 bg-white/5 text-muted text-[9px] uppercase font-bold tracking-wider rounded-full` | Lock expired |
| **Flagged pair** | `text-[10px] font-bold text-[#f59e0b] bg-[#f59e0b]/12 border border-[#f59e0b]/20 rounded px-2 py-0.5` | LowProfit pairs |
| **Overlap count** | `px-2 py-0.5 bg-[#f59e0b]/12 text-[#f59e0b] border border-[#f59e0b]/20 rounded text-[10px] font-bold` | Matrix cells |

---

## 9. Button Hierarchy

### Primary Action
```html
<button class="px-3 py-1.5 bg-up text-black font-bold text-[10px] rounded-md 
  hover:bg-up/90 transition-colors uppercase tracking-wider">
  Start
</button>
```

### Secondary Action
```html
<button class="px-2 py-0.5 l-bd rounded text-[9px] text-muted 
  hover:text-white hover:bg-white/5 transition-colors">
  Load
</button>
```

### Destructive Action
```html
<button class="px-2 py-0.5 l-bd rounded text-[9px] text-down/60 
  hover:text-down hover:bg-down/10 transition-colors">
  Del
</button>
```

### Tab Button
```html
<button class="h-full px-4 font-bold text-[11px] uppercase tracking-wide 
  text-muted hover:text-white transition-colors">
  Tab Name
</button>
```

### Header Action Button (next to inputs/selects)

> [!CAUTION]
> **MANDATORY:** Any action button placed alongside `builder-input` or `builder-select` controls MUST use the `.builder-action` class to match the 36px height. Never use ad-hoc `py-1.5` buttons next to 36px-tall form controls.

```html
<button class="builder-action bg-white text-black hover:bg-white/85">
  + New Item
</button>
```

```css
.builder-action {
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
  white-space: nowrap;
}
```

> [!WARNING]
> Height is `32px` (not 36px). This matches the actual CSS in the HTML. The `builder-input` and `builder-select` are 36px, but action buttons are intentionally 32px for visual hierarchy.

---

## 10. Input / Select Fields

### Standard Input
```html
<input class="bg-[#1a1a1a] l-bd px-3 py-2 text-white outline-none 
  rounded text-[12px] font-mono" />
```

### Standard Select
```html
<select class="bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 
  appearance-none rounded text-[12px] font-mono">
```

### Compact Input (inside panels)
```html
<input class="bg-black l-bd px-2 py-1.5 text-white outline-none 
  rounded text-[11px] font-mono w-full" />
```

---

## 11. Border Tokens

| Token | CSS | Usage | Count |
|---|---|---|---|
| `l-bd` | `border: 1px solid rgba(255,255,255,0.06)` | Standard border | 183 |
| `l-b` | `border-bottom: 1px solid rgba(255,255,255,0.06)` | Bottom separator | 50 |
| `l-r` | `border-right: 1px solid rgba(255,255,255,0.06)` | Right separator (matrix row headers) | 4 |
| `border-white/8` | `border-color: rgba(255,255,255,0.08)` | Slightly stronger | 9 |
| `border-white/[0.06]` | Same as l-bd but inline | Explicit border | 7 |
| `border-up/20` | Green-tinted border | Success state | 17 |
| `border-up/25` | Green-tinted border | Active status badges | — |
| `border-up/30` | Green-tinted border | Strong success emphasis | 6 |
| `border-down/20` | Red-tinted border | Error states | 3 |
| `border-down/25` | Red-tinted border | Triggered/error badges | — |
| `border-white/12` | Slightly visible border | Chart panels, dividers | 3 |
| `border-white/25` | Medium visible border | Active/hover borders | 3 |
| `border-[#f59e0b]/20` | Amber-tinted border | Warning badges, overlap | — |
| `border-[#ef4444]/20` | Rose-tinted border | Kill badges, failure | — |

> [!IMPORTANT]
> Always use `l-bd` for structural borders. Never use `border border-white/10` or similar ad-hoc borders.
> Semantic colored borders (amber, rose, up, down) are allowed on badges and status indicators.

---

## 12. Shadow Tokens

| Token | Usage |
|---|---|
| `shadow-xl` | Elevated panels, docked sidebars (25x) |
| `shadow-lg` | Sticky thead (7x) |
| `shadow-[0_0_4px_#22c55e]` | Status glow (green) |
| `shadow-[0_0_4px_#eab308]` | Status glow (yellow/warning) |
| `shadow-[0_0_4px_#3b82f6]` | Status glow (blue/info) |

---

## 13. Spacing Scale

| Gap | Count | Usage |
|---|---|---|
| `gap-1` | 13 | Tight inline groups |
| `gap-1.5` | 42 | Compact card content |
| `gap-2` | 111 | Standard card content |
| `gap-2.5` | 12 | Between cards in grid |  
| `gap-3` | 60 | Panel sections |
| `gap-4` | 11 | Major section gaps |

---

## 14. Profit/Loss Formatting

```html
<!-- Positive -->
<td class="text-right text-up font-bold">+42.1%</td>
<td class="text-right text-up">+$4,212</td>

<!-- Negative -->
<td class="text-right text-down font-bold">-5.2%</td>
<td class="text-right text-down">-$520</td>

<!-- Neutral -->
<td class="text-right text-muted">0.00%</td>
```

> [!IMPORTANT]
> - Positive values ALWAYS start with `+`
> - Negative values ALWAYS start with `-`
> - Dollar values use comma separator: `$4,212`
> - Primary profit column gets `font-bold`

---

## 15. Status Indicators

```html
<!-- Online/Running -->
<div class="w-2 h-2 rounded-full bg-up shadow-[0_0_4px_#22c55e]"></div>

<!-- Warning -->
<div class="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_4px_#eab308]"></div>

<!-- Offline/Error -->
<div class="w-2 h-2 rounded-full bg-down"></div>

<!-- Checkmark status -->
<span class="text-[8px] text-up font-bold">✓</span>
```

---

## 16. Navigation Pattern

### Top Nav
```html
<nav class="h-[46px] bg-[#0a0a0a] l-b flex items-center px-5">
  <!-- logo + nav items -->
</nav>
```

### Sub-Nav Tabs
```html
<div class="h-10 l-b flex items-center gap-[2px] px-2 bg-black/40 shrink-0 overflow-x-auto">
  <button class="h-full px-4 font-bold text-[11px] uppercase tracking-wide 
    text-white border-b-2 border-up">Active</button>
  <button class="h-full px-4 font-bold text-[11px] uppercase tracking-wide 
    text-muted hover:text-white transition-colors">Inactive</button>
</div>
```

---

## 17. Page-Level Padding

| Context | Padding |
|---|---|
| Page content | `p-5` |
| Card content | `p-3` or `p-4` |
| Panel header | `px-4` (with `h-10 l-b flex items-center`) |
| Table thead cell | `px-5 py-3.5` (full) or `px-2 py-1.5` (compact) |
| Table tbody cell | `px-5 py-3` (full) or `px-2 py-1.5` (compact) |

---

## Compliance Checklist

Before merging any UI change, verify:

- [ ] All toggles use `.builder-toggle` with `.dot` child (not inline Tailwind)
- [ ] All inputs use `.builder-input` (not ad-hoc classes)
- [ ] All selects use `.builder-select` (not ad-hoc classes)
- [ ] Panel headers use `h-10 l-b flex items-center justify-between px-4 bg-black/40`
- [ ] Bot cards use exact DS §20 pattern (p-4 l-b, status dot, name, badge, stats grid, sparkline)
- [ ] **EVERY chart panel has filter controls** in header (selector + timeframe buttons) per §22A
- [ ] Line charts use thin stroke (0.4px), colored dots (green/red), trade count bars per §22B
- [ ] Profit values use `text-up`/`text-down` + `font-bold`
- [ ] Borders use `l-bd` token (not ad-hoc)
- [ ] Cards use `bg-surface l-bd rounded` pattern

---

## 18. Toggle Switch (`.builder-toggle`)

> [!CAUTION]
> NEVER use inline Tailwind (e.g. `w-8 h-4 bg-up rounded-full`) on toggle elements. ALWAYS use the CSS class.

### CSS (defined in `<style>` block)
```css
.builder-toggle {
  width: 36px; height: 20px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  background: #1a1a1a; cursor: pointer;
  position: relative; transition: all 0.2s;
}
.builder-toggle.on {
  background: rgba(34,197,94,0.12);
  border-color: rgba(34,197,94,0.3);
}
.builder-toggle .dot {
  width: 14px; height: 14px; border-radius: 50%;
  position: absolute; top: 2px; left: 2px;
  transition: all 0.2s; background: #9CA3AF;
}
.builder-toggle.on .dot {
  left: 18px; background: #22c55e;
}
```

### HTML (standard usage)
```html
<!-- OFF state -->
<div class="builder-toggle" onclick="this.classList.toggle('on')">
  <div class="dot"></div>
</div>

<!-- ON state -->
<div class="builder-toggle on" onclick="this.classList.toggle('on')">
  <div class="dot"></div>
</div>
```

### Layout pattern (label + toggle)
```html
<div class="flex items-center justify-between">
  <span class="text-muted text-[11px]">Enable Feature</span>
  <div class="builder-toggle on" onclick="this.classList.toggle('on')">
    <div class="dot"></div>
  </div>
</div>
```

---

## 19. Form Controls

### `.builder-input`
```css
.builder-input {
  width: 100%; height: 36px; padding: 0 12px;
  border-radius: 6px; border: 1px solid rgba(255,255,255,0.22);
  background: #1a1a1a; color: #F5F5F5;
  font-size: 12px; font-family: 'JetBrains Mono', monospace;
  outline: none; transition: border-color 0.15s;
}
.builder-input:focus { border-color: rgba(255,255,255,0.30); }
.builder-input::placeholder { color: #9CA3AF; }
```

```html
<div class="flex flex-col gap-1">
  <label class="builder-label">Field Name</label>
  <input type="text" class="builder-input w-full" value="value">
</div>
```

### `.builder-select`
```css
.builder-select {
  height: 36px; padding: 0 10px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.22);
  background: #1a1a1a; color: #F5F5F5;
  font-size: 12px; font-family: 'JetBrains Mono', monospace;
  outline: none; cursor: pointer;
  -webkit-appearance: none; appearance: none;
}
```

```html
<select class="builder-select text-[11px] font-mono">
  <option>BTC/USDT:USDT</option>
</select>
```

### `.builder-label`
```css
.builder-label {
  font-size: 11px; color: #9CA3AF;
  text-transform: uppercase; letter-spacing: 0.08em;
  font-weight: 700; margin-bottom: 6px; display: block;
}
```

### `.builder-num-input`
```css
.builder-num-input {
  width: 80px; height: 32px; padding: 0 8px;
  border-radius: 6px; border: 1px solid rgba(255,255,255,0.22);
  background: #1a1a1a; color: #F5F5F5;
  font-size: 12px; font-family: 'JetBrains Mono', monospace;
  text-align: center; outline: none;
}
```

### `.builder-pill` (selectable option)
```css
.builder-pill {
  padding: 6px 14px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.18);
  font-size: 11px; cursor: pointer;
  transition: all 0.15s; background: transparent; color: #9CA3AF;
}
.builder-pill:hover { border-color: rgba(255,255,255,0.22); color: #F5F5F5; }
.builder-pill.selected { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: #F5F5F5; }
```

---

## 20. Bot Card Pattern

> [!IMPORTANT]
> Bot cards are used in Dashboard (Fleet column) and Analytics (left sidebar). The structure is identical — only control buttons differ.

### Container
```html
<!-- Standard row -->
<div class="p-4 l-b hover:bg-white/[0.04] transition-colors group cursor-pointer">
<!-- Zebra-striped row -->
<div class="p-4 l-b hover:bg-white/[0.04] transition-colors group cursor-pointer bg-white/[0.015]">
```

### Name + Status Row
```html
<div class="flex items-start justify-between mb-2.5">
  <div class="flex items-center gap-2">
    <div class="w-2 h-2 bg-up rounded-full shadow-[0_0_4px_#22c55e]"></div>
    <span class="font-bold text-white uppercase text-[12px] tracking-wide">BotName</span>
    <span class="text-[10px] border border-white/20 px-1.5 py-[1px] rounded text-white/60 font-medium">LIVE</span>
  </div>
  <span class="text-up font-bold text-[13px]">+$48.20</span>
</div>
```

Status dot variants:
- LIVE: `bg-up shadow-[0_0_4px_#22c55e]`
- PAUSED: `bg-yellow-400` (no shadow)
- STOPPED: `bg-down` (no shadow)

Badge variants:
- LIVE: `border-white/20 text-white/60`
- PAUSED: `border-yellow-500/30 text-yellow-400`
- STOPPED: `border-down/30 text-down`

### Stats Grid
```html
<div class="grid grid-cols-2 gap-y-1.5 text-muted text-[12px] mb-3">
  <div class="flex justify-between w-full pr-5"><span>Trades:</span> <span class="text-white/70">412</span></div>
  <div class="flex justify-between w-full"><span>Win:</span> <span class="text-white/70">72%</span></div>
  <div class="flex justify-between w-full pr-5"><span>Drawdown:</span> <span class="text-down">-1.2%</span></div>
  <div class="flex justify-between w-full"><span>Avg. Dur:</span> <span class="text-white/70">1.5h</span></div>
</div>
```

### Sparkline
```html
<div class="flex justify-between items-center opacity-50 group-hover:opacity-100 transition-opacity">
  <div class="flex gap-[2px] h-4 items-end">
    <div class="w-1.5 bg-up h-[40%] rounded-sm"></div>
    <div class="w-1.5 bg-up h-[60%] rounded-sm"></div>
    <div class="w-1.5 bg-down h-[20%] rounded-sm"></div>
    <div class="w-1.5 bg-up h-[100%] rounded-sm"></div>
    <div class="w-1.5 bg-up h-[80%] rounded-sm"></div>
  </div>
  <!-- Dashboard: add bot-ctrl buttons here -->
  <!-- Analytics: no buttons -->
</div>
```

---

## 21. Panel Header Standard

> [!CAUTION]
> Every panel MUST use this header pattern. NEVER omit `justify-between` or the right-side info badge.

```html
<div class="h-10 l-b flex items-center justify-between px-4 bg-black/40">
  <h3 class="section-title flex items-center gap-2">
    <span>🔥</span>Panel Title
  </h3>
  <span class="text-[10px] text-muted font-mono">info badge</span>
</div>
```

### Sidebar panel header (h-12, taller)
```html
<div class="h-12 l-b flex items-center justify-between px-5 bg-black/40 shrink-0">
  <span class="section-title flex items-center gap-2.5">
    <i data-lucide="icon" class="w-4 h-4 text-muted"></i> Title
  </span>
  <span class="text-[10px] text-muted font-mono">count</span>
</div>
```

---

## 22. Chart Panel Pattern

> [!CAUTION]
> **MANDATORY:** EVERY chart panel MUST have filter controls in the header. No exceptions. A chart without filters violates DS rules.

### 22A. Chart Panel Header (MANDATORY structure)

```html
<div class="h-10 l-b flex items-center justify-between px-4 bg-black/40">
  <h3 class="section-title flex items-center gap-2">
    <span>📉</span>Chart Title
  </h3>
  <div class="flex items-center gap-2.5">
    <!-- 1. Selector (pair or bot) -->
    <select class="builder-select text-[11px] font-mono">
      <option>BTC/USDT:USDT</option>
    </select>
    <!-- 2. Timeframe button group -->
    <div class="flex gap-0 l-bd rounded-md overflow-hidden">
      <button class="px-2.5 py-1 text-[10px] font-medium text-muted hover:text-white transition-colors">7d</button>
      <button class="px-2.5 py-1 text-[10px] font-medium bg-white/10 text-white">30d</button> <!-- ACTIVE -->
      <button class="px-2.5 py-1 text-[10px] font-medium text-muted hover:text-white transition-colors">90d</button>
    </div>
    <!-- 3. Optional action button -->
    <button class="px-2 py-0.5 l-bd rounded text-[9px] text-muted hover:text-white hover:bg-white/5 transition-colors">Export</button>
  </div>
</div>
```

Timeframe options per chart type:
- **Candlestick**: `5m | 15m | 1h | 4h | 1d`
- **Cumulative Profit**: `7d | 30d | 90d | All`
- **Delta/Footprint**: `1h | 4h | 1d`

### 22B. Line Chart Body Pattern (Cumulative Profit, etc.)

```html
<div class="flex-1 px-5 pb-4 pt-2 relative">
  <!-- Legend (top-right) -->
  <div class="absolute top-1 right-2 flex items-center gap-4 text-[9px] font-mono text-white/40 z-10">
    <span class="flex items-center gap-1.5"><span class="w-3 h-[2px] bg-[#22c55e] rounded inline-block"></span>Profit</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-2.5 bg-white/15 rounded-sm inline-block"></span>Trade Count</span>
  </div>
  <!-- Grid -->
  <div class="absolute inset-0 l-grid opacity-20"></div>
  <!-- Y-axis -->
  <div class="absolute left-1 top-2 bottom-4 flex flex-col justify-between text-[9px] font-mono text-white/25">
    <span>+$5k</span><span>$0</span><span>-$1k</span>
  </div>
  <!-- SVG: bars + line + dots -->
  <svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 100">
    <line x1="0" y1="70" x2="400" y2="70" stroke="rgba(255,255,255,0.08)" stroke-width="0.5" stroke-dasharray="3,3"/>
    <!-- Trade count bars: rgba(255,255,255,0.10-0.18) -->
    <rect x="8" y="94" width="10" height="6" rx="0.5" fill="rgba(255,255,255,0.10)"/>
    <!-- P&L thin line: stroke-width="0.4" -->
    <polyline points="..." fill="none" stroke="#22c55e" stroke-width="0.4" stroke-linejoin="round"/>
    <!-- Dots: r="1.2", green=#22c55e for profit, red=#ef4444 for loss -->
    <circle cx="13" cy="85" r="1.2" fill="#22c55e"/>
    <circle cx="163" cy="68" r="1.2" fill="#ef4444"/>
  </svg>
  <!-- X-axis (OUTSIDE svg, below) -->
  <div class="flex justify-between text-[9px] font-mono text-white/25 mt-1">
    <span>03/01</span><span>03/08</span><span>03/15</span>
  </div>
</div>
```

### 22C. Overlay Toggle (in chart footer)
```html
<label class="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
  <span class="w-2.5 h-[3px] rounded bg-yellow-500 inline-block"></span>
  <div class="builder-toggle on" onclick="this.classList.toggle('on')">
    <div class="dot"></div>
  </div>
  overlay_name
</label>
```

### 22D. Subchart Tabs (RSI/MACD/Volume)
```html
<div class="flex gap-0 l-b items-center">
  <button class="px-4 py-2 text-[11px] font-bold uppercase border-b-2 border-up text-white">RSI</button> <!-- ACTIVE -->
  <button class="px-4 py-2 text-[11px] font-bold uppercase border-b-2 border-transparent text-muted hover:text-white transition-colors">MACD</button>
</div>
```

### 22E. Chart Legend
```html
<div class="flex items-center gap-4 px-4 py-2 l-b bg-surface">
  <div class="flex items-center gap-1.5 text-[10px] text-muted">
    <span class="text-up">△</span>Buy
  </div>
  <div class="flex items-center gap-1.5 text-[10px] text-muted">
    <span class="w-2 h-2 rounded-full bg-up inline-block"></span>enter_tag
  </div>
</div>
```


---

## 23. Sparkline Mini-Bar Pattern

```html
<div class="flex gap-[2px] h-4 items-end">
  <div class="w-1.5 bg-up h-[40%] rounded-sm"></div>
  <div class="w-1.5 bg-down h-[60%] rounded-sm"></div>
  <div class="w-1.5 bg-up h-[100%] rounded-sm"></div>
</div>
```

Rules:
- Height container: `h-4` (16px)
- Bar width: `w-1.5` (6px)
- Gap: `gap-[2px]`
- Colors: `bg-up` for profit bars, `bg-down` for loss bars
- Radius: `rounded-sm`

---

## 24. Split Layout Pattern

For pages with left sidebar + right workspace (Dashboard, Analytics):

```html
<div class="flex-1 flex overflow-hidden p-5 gap-5">
  <!-- Left sidebar -->
  <div class="w-[320px] min-w-[320px] shrink-0">
    <div class="flex-1 bg-surface l-bd rounded-md flex flex-col shadow-xl overflow-hidden h-full">
      <!-- h-12 header -->
      <div class="flex-1 overflow-y-auto"><!-- scrollable content --></div>
    </div>
  </div>
  <!-- Right workspace -->
  <div class="flex-1 overflow-y-auto flex flex-col gap-4">
    <!-- Scrollable panels -->
  </div>
</div>
```

Width standards:
- Dashboard Fleet: `w-[400px]` (wider, has control buttons)
- Analytics Bot List: `w-[320px]` (narrower, observation only)

---

## 25. Heatmap Grid Pattern

```html
<div class="grid gap-px bg-white/[0.05] l-bd rounded-md overflow-hidden"
     style="grid-template-columns: 90px repeat(7, 1fr)">
  <!-- Header row -->
  <div class="bg-surface text-muted text-[9px] font-semibold uppercase tracking-widest text-center px-1.5 py-2"></div>
  <div class="bg-surface text-muted text-[9px] font-semibold uppercase tracking-widest text-center px-1.5 py-2">Mon</div>
  <!-- Data cells -->
  <div class="bg-surface text-muted text-[11px] font-semibold text-left px-2.5 py-2">BTC</div>
  <div class="bg-up/[0.08] text-up text-[11px] font-medium text-center px-1.5 py-2">+1.2%</div>
  <div class="bg-down/[0.08] text-down text-[11px] font-medium text-center px-1.5 py-2">-0.3%</div>
</div>
```

Cell background rules:
- Positive < 1.5%: `bg-up/[0.08]`
- Positive ≥ 1.5%: `bg-up/[0.15]`
- Negative < -1%: `bg-down/[0.08]`
- Negative ≥ -1%: `bg-down/[0.15]`
- Neutral: `bg-surface text-muted`

---

## 26. Risk Page Widgets

### 26A. Kill Switch Control Panel
```html
<div class="rounded-lg overflow-hidden" style="background:linear-gradient(135deg, #111 0%, rgba(239,68,68,0.04) 100%); border:1px solid rgba(239,68,68,0.18)">
  <!-- Header with last event -->
  <div class="px-5 py-3.5 flex items-center justify-between" style="border-bottom:1px solid rgba(239,68,68,0.12)">
    <h3 class="section-title">🚨 Kill Switch Control</h3>
    <span class="text-[11px] text-[#f59e0b] font-bold font-mono">LAST EVENT</span>
  </div>
  <!-- Big kill buttons (grid-cols-2), Per-bot select + soft/hard kill -->
</div>
```

> [!CAUTION]
> Kill Switch panel uses an inline gradient border, NOT `l-bd`. This is the ONLY exception to the border rule.

### 26B. Heartbeat Monitor Cards
```html
<div class="bg-black/40 l-bd rounded-lg p-4">           <!-- OK state -->
<div class="bg-black/40 rounded-lg p-4"                  <!-- WARN: style="border:1px solid rgba(245,158,11,0.3)" -->
<div class="bg-black/40 rounded-lg p-4"                  <!-- FAIL: style="border:1px solid rgba(239,68,68,0.3)" + pulse dot -->
```

Failure dot indicator: `w-2 h-2 rounded-full` with:
- Empty: `bg-white/10 border border-white/15`
- Warn: `background:#f59e0b; border:1px solid #f59e0b`
- Fail: `background:#ef4444; border:1px solid #ef4444; box-shadow:0 0 4px #ef4444`

Health thresholds: `>=3 failures = FAIL`, `>=1 = WARN`, `0 = OK`

### 26C. FT Protection Status Cards
2×2 grid of protection configs (Stoploss Guard, MaxDrawdown, LowProfitPairs, CooldownPeriod). Each card:
- Config params: `text-[9px] text-muted uppercase tracking-wider` label + `text-[11px] font-bold text-muted font-mono` value
- Drawdown progress bar: `h-1.5 bg-white/10 rounded-full` container + colored fill
- Status badge: Active (bg-up/12) or Triggered (bg-down/12)

### 26D. Progress Bar (Drawdown)
```html
<div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
  <div class="h-full rounded-full" style="width:82.6%; background:#f59e0b"></div>
</div>
```

Color rules:
- `<50%`: `background:var(--clr-up)` (green)
- `50-80%`: `background:#f59e0b` (amber)
- `>80%`: `background:#ef4444` (red)

### 26E. Portfolio Exposure Bars
```html
<div class="flex items-center gap-3">
  <div class="text-[11px] font-bold min-w-[130px] text-white truncate">BotName</div>
  <div class="flex-1 h-4 bg-white/10 rounded overflow-hidden">
    <div class="h-full rounded" style="width:52%; background:linear-gradient(90deg, #22d3ee, rgba(34,211,238,0.5))"></div>
  </div>
  <div class="text-[11px] font-bold min-w-[75px] text-right text-white font-mono">$6,480</div>
  <div class="text-[11px] min-w-[40px] text-right text-muted font-mono">52.0%</div>
</div>
```

### 26F. Pair Locks Table
Standard sortable table (§4A pattern) with columns: Pair, Bot, Lock Until (sort-desc), Reason, Status, Actions.
- Pair/Bot: `sortable filterable`
- Status: Active/Expired badges (§8B)  
- Actions: Unlock button (`builder-action`)
- Lock Pair: header `builder-action` button

### 26G. Risk Events Log (Audit Trail)
Standard sortable table with columns: Timestamp (sort-desc), Bot ID, Kill Type, Trigger, Reason, Triggered By.
- Kill Type: SOFT KILL / HARD KILL badges (§8B)
- Trigger: MANUAL / HEARTBEAT / DRAWDOWN badges (§8B)
- Max height with `overflow-y-auto` scroll, `max-h-[280px]`

### 26H. Cross-Bot Overlap Matrix
Correlation table with:
- Diagonal cells: `style="background:rgba(255,255,255,0.015)"` + `text-muted` (self pair count)
- Off-diagonal overlaps: amber badge `bg-[#f59e0b]/12 text-[#f59e0b]`
- Zero overlap: `text-muted` plain "0"
- Row headers: `font-bold text-white l-r` (right border separator)

---

## 27. Responsive Breakpoints

```css
@media (max-width: 1600px) {
  --drawer-left: 600px;
  .kpi-label { font-size: 10px; }
  .kpi-value { font-size: 16px; }
}
@media (max-width: 1440px) {
  --drawer-left: 500px;
  .kpi-value { font-size: 14px; }
  .kpi-value.text-xl { font-size: 16px !important; }
}
@media (max-width: 1280px) {
  --drawer-left: 0px; /* collapse drawer */
}
@media (max-width: 1024px) {
  /* sidebar collapse, page padding adjustments */
}
@media (max-width: 640px) {
  /* mobile: single column, collapsed sidebar */
}
```

---

## 28. CSS Class Registry

All custom CSS classes defined in the `<style>` block:

### Layout
| Class | Usage |
|---|---|
| `.page-view` | Page content container (flex-1, overflow-y-auto) |
| `.drawer-tab-content` | Sidebar drawer tab panels |
| `.nav-label` | Sidebar nav button text (hidden when collapsed) |
| `.sidebar-header` | Sidebar header container |
| `.sidebar-title` | Sidebar title text |
| `.sidebar-footer-text` | Sidebar footer text |
| `.sidebar-toggle` | Sidebar collapse toggle button |

### Tables & Data
| Class | Usage |
|---|---|
| `.an-tab` | Analytics page tab buttons |
| `.exp-tab` | Experiments page tab buttons |
| `.trade-tab-btn` | Trade detail tab buttons |
| `.toggle-btn` | Table toggle button (expand/collapse) |
| `.grid-cols-7` | 7-column grid (heatmap) |

### Strategy Builder
| Class | Usage |
|---|---|
| `.builder-card` | Builder config section card |
| `.builder-step-panel` | Builder wizard step panel |
| `.builder-step-num` | Builder step number indicator |
| `.builder-collapse-arrow` | Collapsible section arrow |
| `.builder-cb-section` | Builder checkbox section |
| `.cb-body` | Checkbox section body content |
| `.strat-card` | Strategy list card |
| `.rotated` | Rotated arrow state |

### Dropdown/Modal
| Class | Usage |
|---|---|
| `.action-menu` | Dropdown action menu container |
| `.action-menu-btn` | Dropdown trigger button |
| `.action-dropdown` | Dropdown options container |
| `.custom-select` | Custom select wrapper |
| `.custom-select-trigger` | Custom select trigger |
| `.custom-select-options` | Custom select options list |
| `.custom-select-option` | Individual option |
| `.deploy-modal` | Deploy modal overlay |
| `.deploy-modal-body` | Deploy modal body |
| `.backdrop` | Modal backdrop |
| `.pill-x` | Pill close button |

### Code Syntax (Python viewer)
| Class | Usage |
|---|---|
| `.py-kw` | Python keyword | 
| `.py-fn` | Python function |
| `.py-str` | Python string |
| `.py-num` | Python number |
| `.py-cmt` | Python comment |
| `.py-dec` | Python decorator |
| `.py-op` | Python operator |

### State Classes
| Class | Usage |
|---|---|
| `.open` | Open state (dropdowns, panels) |
| `.done` | Completed state (wizard steps) |
| `.enabled` | Enabled state (toggles) |

### Bot Controls (Dashboard Fleet)
| Class | Usage |
|---|---|
| `.bot-ctrl` | Bot action button base (w-7 h-7 l-bd rounded) |
| `.ctrl-start` | Start hover: `color:#22c55e; border-color:rgba(34,197,94,0.3)` |
| `.ctrl-pause` | Pause hover: `color:#eab308; border-color:rgba(234,179,8,0.3)` |
| `.ctrl-stop` | Stop hover: `color:#ef4444; border-color:rgba(239,68,68,0.3)` |

---

## 29. rgba() Reference Values

Common inline style rgba() values used across the HTML:

| Value | Usage | Count |
|---|---|---|
| `rgba(255,255,255,0.06)` | Standard border (l-bd, l-b) | 100+ |
| `rgba(255,255,255,0.12)` | Slightly stronger border | 20 |
| `rgba(255,255,255,0.15)` | Hover borders, emphasis borders | 22 |
| `rgba(255,255,255,0.22)` | builder-input/select borders | 14 |
| `rgba(34,197,94,0.3)` | Green button borders (bot ctrl) | 10 |
| `rgba(34,197,94,0.5)` | Green gradient endpoints | 10 |
| `rgba(0,0,0,0.6)` | Modal/backdrop overlay | 4 |
| `rgba(239,68,68,0.18)` | Kill switch panel border | 2 |
| `rgba(245,158,11,0.3)` | Amber heartbeat border | 2 |

---

## 30. Bot Management Drawer

> [!IMPORTANT]
> Full pixel-perfect specification: **[ds_bot_drawer.md](file:///Users/novakus/.gemini/antigravity/brain/24ab1317-6f11-4eb7-8900-194196984f42/ds_bot_drawer.md)**

Quick reference:
- **Container:** `<aside id="bot-drawer" class="drawer">` — fixed, full-height, slides from right
- **Position:** `left: var(--drawer-left); right: 0` — fills space beyond sidebar
- **Background:** `#0C0C0C`, `border-left: 1px solid rgba(255,255,255,0.10)`
- **Z-index:** 60, backdrop z-index: 50
- **Animation:** `transform: translateX(100%)` → `translateX(0)` on `.open`
- **Backdrop:** `#drawer-backdrop` with `backdrop-filter: blur(2px)` — click closes drawer
- **Header:** `p-4 pb-3 l-b bg-black` — bot name (`text-base font-bold font-mono`), mode badge, 9 bot-ctrl buttons
- **Tabs:** 8 tabs, `h-9 px-3.5 text-[10px] font-bold uppercase tracking-wider`, active = `border-b-2 border-up text-white`
- **Content:** `flex-1 overflow-y-auto`, tab panels use `p-4 flex flex-col gap-4`
- **Bot-ctrl button:** `28px × 28px`, `border-radius: 5px`, `bg: #1a1a1a`, icon `w-3.5 h-3.5` (drawer) or `w-3 h-3` (fleet card)
- **Drawer tables:** `py-1.5 px-1` padding (tighter than standard `px-5 py-3`)
- **Fleet→Drawer:** Cards use `onclick="openBotDrawer('Name','LIVE')"`, control buttons have `event.stopPropagation()`
- **Right sidebar toggle:** `#dash-col-sidebar.collapsed` → `width:0 !important` + COL 2 `flex-1` auto-expands
- **--drawer-left calculation:** `sidebarW + 20 + fleetW + 20` (680px desktop, 496px collapsed)


