# Agent 4 — UX Polish: Tooltips, Knowledge Base, HTML/CSS Fixes, Design Standards, i18n

## MANDATORY READ ORDER
1. `CLAUDE.md` — rules, philosophy
2. `FREQTRADE_REFERENCE.md` — all 34 sections (needed for tooltip content)
3. ALL pages in `frontend/src/app/*/page.tsx` — audit each one
4. ALL components in `frontend/src/components/` — audit each one
5. `prototypes/*.html` — design reference for what things SHOULD look like

---

## CONTEXT

The application has 11 pages, all functional, but with UX issues:
- No tooltips on form fields (users don't know what FT parameters mean)
- Raw FT config keys showing in UI (e.g., `freqai.activate_tensorboard` visible as text)
- HTML/CSS inconsistencies (alignment, sizing, spacing issues)
- Design standards not uniform (some things bigger/smaller/wider on different pages)
- i18n not completed (some places show raw translation keys)

---

## TASK 1: Tooltip System + Hide Raw Config Keys

### 1A: Create Tooltip Component

Create `frontend/src/components/ui/Tooltip.tsx`:
```tsx
"use client";
import { useState, useRef, useEffect, ReactNode } from "react";

interface TooltipProps {
  content: string;
  configKey?: string;  // optional FT config key to show at bottom
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({ content, configKey, children, position = "top" }: TooltipProps) {
  // Hover-triggered tooltip
  // Shows: description text
  // If configKey provided, shows small "Config: freqai.activate_tensorboard" at bottom in monospace
  // Position: auto-adjust to stay within viewport
  // Animation: fade in 150ms
  // Style: bg-bg-3, border-border, text-text-1, max-width 280px, text-xs, rounded
}
```

### 1B: Create Tooltip Content Database

Create `frontend/src/lib/tooltips.ts`:
```typescript
export const TOOLTIPS: Record<string, { description: string; configKey?: string }> = {
  // §1 Config parameters
  stake_currency: {
    description: "The cryptocurrency used as the base currency for trading. All profits and losses are calculated in this currency.",
    configKey: "stake_currency",
  },
  stake_amount: {
    description: "Amount of stake_currency to use for each trade. Use 'unlimited' to allow FreqTrade to calculate based on available balance.",
    configKey: "stake_amount",
  },
  max_open_trades: {
    description: "Maximum number of trades that can be open simultaneously. Set to -1 for unlimited.",
    configKey: "max_open_trades",
  },
  // ... continue for ALL form fields across ALL pages
  // Minimum 150 entries covering all 8 pages
  // Source: FREQTRADE_REFERENCE.md sections §1-§30
};
```

**Generate entries for ALL of these categories:**
- §1: Core config (stake_currency, stake_amount, max_open_trades, timeframe, dry_run, trading_mode, margin_mode, etc.)
- §2: Strategy interface (minimal_roi, stoploss, trailing_stop, etc.)
- §4: Stoploss types (stoploss, trailing_stop, trailing_stop_positive, trailing_stop_positive_offset, trailing_only_offset_is_reached)
- §5: Backtesting parameters (timerange, enable_protections, cache, etc.)
- §6: Hyperopt (loss functions, epochs, spaces, samplers)
- §7: Pairlist handlers + Protections
- §9: Exchange settings
- §11: Telegram settings
- §13: Webhook settings
- §17: Producer/Consumer
- §24: FreqAI core config
- §25: Reinforcement Learning
- §26: Feature processing
- §28: Multi-instance + logging
- §29: Orderflow

### 1C: Apply Tooltips to ALL Form Fields

Go through EVERY page and wrap form labels with Tooltip:

**BEFORE:**
```tsx
<label>Activate TensorBoard</label>
<Toggle on={value} onChange={...} />
```

**AFTER:**
```tsx
<Tooltip content={TOOLTIPS.activate_tensorboard.description} configKey="freqai.activate_tensorboard">
  <label>Activate TensorBoard</label>
</Tooltip>
<Toggle on={value} onChange={...} />
```

### 1D: Hide Raw Config Keys

**CRITICAL:** Some components show raw FT config keys below labels (e.g., `freqai.activate_tensorboard` as visible text). These MUST be hidden.

Search for patterns like:
- `sub=` prop on Toggle/Input components
- Raw config key strings displayed as `<span>` or `<p>` below labels
- Any `configKey` or `paramKey` displayed directly in the UI

**Fix pattern:**
```
BEFORE: <Toggle label="Activate TensorBoard" sub="freqai.activate_tensorboard" />
AFTER:  <Tooltip content="..." configKey="freqai.activate_tensorboard">
          <Toggle label="Activate TensorBoard" />
        </Tooltip>
```

The config key moves INTO the tooltip (small monospace text at bottom), NOT displayed in the main UI.

---

## TASK 2: Knowledge Base Document

Create `frontend/src/app/docs/page.tsx` (or `docs/KNOWLEDGE_BASE.md` if simpler):

A searchable reference page with:
- All FT parameters grouped by category
- Each entry: parameter name, type, default value, description, which page it's on
- Search/filter functionality
- Links back to the relevant settings page

**OR** create a static markdown file `docs/KNOWLEDGE_BASE.md` that users can read:
- Organized by page (Settings, Builder, Backtesting, FreqAI, etc.)
- Each section lists all parameters with explanations
- Cross-references to FT official docs

---

## TASK 3: Fix Backtesting Multi-Strategy Comparison Display

The Backtesting page (`frontend/src/app/backtesting/page.tsx`) has a multi-strategy compare feature that partially works but has two bugs:

### Bug 1: TagInput `tags` prop is hardcoded empty
Line ~789: `<TagInput tags={[]} ...>` should be `<TagInput tags={btStrategyList} ...>`
Same issue on line ~918 for pair override: `tags={[]}` should be `tags={btPairOverride}`

### Bug 2: Only first strategy result is displayed
The helper function `getStrategyResult()` (line ~25) extracts only the FIRST strategy from backtest results:
```typescript
function getStrategyResult(btResult: FTBacktestResult | null): FTBacktestStrategyResult | null {
  // returns only first strategy
}
```

When `--strategy-list` is used, FT returns results for ALL strategies in `btResult.strategy`. The UI needs to:
1. Detect when multiple strategies exist in the result
2. Show a **comparison table** with one row per strategy: Strategy Name, Total Trades, Profit, Win Rate, Sharpe, Max DD, Avg Duration
3. Allow clicking a strategy row to see its full detailed results (the existing detail view)

### Fix approach:
- Keep `getStrategyResult()` for single-strategy display
- Add `getAllStrategyResults()` that returns array of all strategies
- When `Object.keys(btResult.strategy).length > 1`, render comparison table ABOVE the detail view
- Detail view shows whichever strategy is selected (default: first)

---

## TASK 4: HTML/CSS Consistency Fixes

Audit EVERY page and fix:

### Common issues to look for:
1. **Alignment** — form labels and inputs not vertically aligned
2. **Dropdown sizing** — some dropdowns are too small/narrow
3. **Spacing** — inconsistent padding/margin between sections
4. **Typography** — inconsistent font sizes for same element types
5. **Card sizing** — stat cards different heights on same row
6. **Table styling** — inconsistent column widths, header styles
7. **Button sizing** — action buttons different sizes on same toolbar
8. **Input widths** — some inputs full-width, some not, inconsistently
9. **Responsive** — check that pages don't break on smaller viewports
10. **Scrolling** — tables should scroll horizontally if needed, not overflow

### Page-by-page audit checklist:
- [ ] Dashboard — stat cards aligned, bot cards same height, tables consistent
- [ ] Strategies — card grid even, badges aligned, action buttons consistent
- [ ] Builder — wizard steps aligned, form groups consistent spacing
- [ ] Backtesting — results table columns right-aligned for numbers, left for text
- [ ] Settings — tabs consistent, form groups uniform width, toggles aligned
- [ ] FreqAI — same form patterns as Settings
- [ ] Analytics — charts sized consistently, tables match dashboard tables
- [ ] Data — forms and tables consistent with other pages
- [ ] Risk — kill switch buttons prominent, stats cards aligned
- [ ] Login — centered, consistent with overall theme

### Design tokens to enforce:
```css
/* These should be used EVERYWHERE consistently */
--radius: 10px;        /* cards, modals */
--radius-sm: 6px;      /* buttons, inputs, badges */
font-size: 13px;       /* base */
font-size: 11px;       /* labels, secondary text */
font-size: 14px;       /* card titles */
font-size: 16px;       /* page titles */
padding: 18px 20px;    /* card internal padding */
gap: 14px;             /* grid gap */
```

---

## TASK 5: Design Standards Enforcement

Create a shared CSS approach. Either:

### Option A: Tailwind classes standardization
Document and enforce standard Tailwind patterns:
```
Stat cards:  "bg-bg-2 border border-border rounded-[10px] p-5"
Form groups: "space-y-4"
Labels:      "text-xs text-text-2 font-medium"
Inputs:      "bg-bg-1 border border-border rounded-md px-3 py-2 text-sm text-text-0"
Buttons primary: "bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold"
Buttons secondary: "bg-bg-2 border border-border text-text-1 rounded-md px-3 py-2 text-sm"
Tables: "w-full text-sm" with "text-left text-text-2 text-xs font-medium uppercase" headers
```

### Option B: Create shared component variants
Extend Card, add FormGroup, add StandardTable, add ActionButton components with consistent styling.

**Either way, apply the standard to ALL pages.**

---

## TASK 6: i18n Completion

### Check current state:
- Is `next-intl` or similar installed?
- Are there translation files?
- Where do raw translation keys appear?

### If i18n is NOT set up:
1. Install: `npm install next-intl`
2. Create: `frontend/src/i18n/` with `en.json` (and `sr.json` for Serbian if desired)
3. Set up provider in layout
4. Replace all hardcoded strings with `t('key')` calls

### If i18n IS set up but incomplete:
1. Find all raw keys showing in UI (search for patterns like `settings.core.` or `common.`)
2. Add missing translations to the JSON files
3. Ensure all pages use the translation function consistently

### Priority strings to translate:
- Page titles and section headers
- Button labels
- Table column headers
- Empty state messages
- Error messages
- Toast notifications
- Form labels (these also get tooltips)

---

## CODE QUALITY RULES

1. Tooltip component must handle edge cases (long text, viewport boundaries)
2. tooltips.ts entries must come from FREQTRADE_REFERENCE.md — no invented descriptions
3. CSS fixes must not break existing functionality
4. All changes must be incremental (don't rewrite entire pages)
5. Test each page after changes

---

## VERIFICATION

```bash
cd frontend && npx next build
```
**Must produce 0 errors.**

Visual verification:
1. Hover over any form field → tooltip appears with description
2. No raw FT config keys visible in the main UI
3. All pages look consistent (same card sizes, same spacing, same font sizes)
4. No alignment issues, no tiny dropdowns, no overflow
5. i18n keys resolved to actual text everywhere
6. Knowledge Base page/document is accessible and useful
