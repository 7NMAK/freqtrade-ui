# Agent 3 — Strategy Builder + Deploy + Code Editor

## MANDATORY READ ORDER
1. `CLAUDE.md` — rules, philosophy
2. `FT-UI-MAP.html` — Builder section mapping
3. `FREQTRADE_REFERENCE.md` — §2 (Strategy Interface), §3 (19 Callbacks), §4 (Stoploss types), §14 (Advanced Strategy)
4. `prototypes/builder.html` — visual reference (if it exists)
5. `frontend/src/app/builder/page.tsx` — CURRENT CODE (~2144 lines, already substantial)
6. `frontend/src/lib/api.ts` — strategy and bot API functions
7. `frontend/src/types/index.ts` — Strategy type definition

---

## CONTEXT

The Builder page already exists (2144 lines) and generates strategy .py code from a wizard UI. Three features are missing:

1. **Strategy Deploy** — after Builder saves, deploy the .py file to a FT bot container
2. **Strategy Re-edit** — load an existing strategy back into the Builder wizard
3. **Strategy Code Editor** — see and edit the raw Python code (currently read-only preview)

---

## TASK 1: Strategy Deploy Flow

After the Builder generates and saves a strategy, the user needs to deploy it to a FreqTrade bot.

### Flow:
```
Builder → Save → Deploy Modal → Select Bot → Upload .py → Reload Config → Done
```

### Deploy Modal UI:
```
┌──────────────────────────────────────────┐
│  Deploy Strategy                    [×]  │
│                                          │
│  Strategy: MomentumRSI.py                │
│                                          │
│  Select Bot:                             │
│  ┌──────────────────────────────────┐    │
│  │ ▼ ft-main (running, dry_run)    │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ☐ Set as active strategy                │
│    (updates bot config to use this       │
│     strategy and reloads)                │
│                                          │
│  [Cancel]              [Deploy →]        │
└──────────────────────────────────────────┘
```

### Implementation:

1. **Save strategy** — `createStrategy({ name, code, description, exchange, timeframe, lifecycle: 'draft' })`
2. **Show deploy modal** — dropdown with registered bots from `getBots()`
3. **Deploy** — `importStrategy(botId, strategyFile)` — uploads .py to bot's strategy directory
4. **Set active (optional)** — if checkbox checked:
   - `saveBotConfig(botId, { strategy: strategyName })` — update config
   - `reloadBotConfig(botId)` — reload so FT picks up new strategy
5. **Update strategy record** — `updateStrategy(strategyId, { bot_instance_id: botId })`
6. **Success toast** — "Strategy deployed to {botName}"

### Where to add this:
- The Builder page already has a save/download section
- Add a "Deploy to Bot" button next to the existing Save/Download buttons
- Modal component can be inline in builder/page.tsx or a separate component

---

## TASK 2: Strategy Re-edit (Load into Builder)

When user clicks "Edit in Builder" on the Strategies page, the Builder should load that strategy's data.

### Flow:
```
Strategies page → "Edit in Builder" → /builder?strategyId=123 → Builder loads existing data
```

### Implementation:

1. **URL parameter** — Builder reads `strategyId` from URL search params
2. **Load strategy** — `getStrategy(strategyId)` → get name, code, description, exchange, timeframe
3. **Parse code** — extract configuration from the .py code:
   - Strategy name (class name)
   - Timeframe
   - Indicators used
   - Buy/sell signals
   - Stoploss settings
   - ROI table
   - Protections
4. **Pre-fill wizard** — populate all Builder form fields with parsed data
5. **Code → Wizard mapping** — this is the hardest part. Options:
   - **Option A (recommended):** Store wizard state as JSON in the strategy DB record (not just the .py code). When re-editing, load the JSON, not parse the .py.
   - **Option B:** Parse .py code with regex/AST to extract parameters back into wizard fields.

### Recommended approach (Option A):
- When Builder saves, store both:
  - `code` — the generated .py file content
  - `builder_state` — JSON blob with all wizard form values
- On re-edit, load `builder_state` JSON and pre-fill the wizard
- This avoids fragile .py parsing

### Changes needed:
1. **Strategy type** — may need `builder_state: Record<string, unknown> | null` field
2. **Builder page** — add `useSearchParams()` to read strategyId from URL
3. **Builder page** — add `useEffect` to load strategy when strategyId present
4. **Builder page** — add logic to pre-fill form state from loaded data
5. **Save flow** — save `builder_state` alongside `code`

---

## TASK 3: Strategy Code Editor

Replace the read-only code preview with an editable code editor.

### Install Monaco Editor:
```bash
cd frontend && npm install @monaco-editor/react
```

### Implementation:

1. **Visual/Code toggle** — two tabs in the Builder:
   - **Visual** — the existing wizard UI
   - **Code** — Monaco editor with the generated .py code

2. **Monaco setup:**
```tsx
import Editor from "@monaco-editor/react";

<Editor
  height="600px"
  language="python"
  theme="vs-dark"
  value={generatedCode}
  onChange={(value) => setGeneratedCode(value || "")}
  options={{
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    wordWrap: "on",
    automaticLayout: true,
    readOnly: false,
  }}
/>
```

3. **Two-way sync (optional, advanced):**
   - Visual → Code: already works (wizard generates code)
   - Code → Visual: NOT required (too complex). If user edits code manually, wizard state becomes "detached" and shows a warning: "Code was edited manually. Visual editor may not reflect all changes."

4. **Code-only mode:**
   - For BACKTEST/PAPER/LIVE strategies being re-edited, if no `builder_state` exists, show Code tab only
   - User can edit the raw .py and re-deploy

---

## API FUNCTIONS TO USE

```typescript
// Strategy CRUD
createStrategy(data)               → Strategy
getStrategy(id)                    → Strategy
updateStrategy(id, data)           → Strategy
importStrategy(botId, file)        → uploads .py to bot container

// Bot operations
getBots()                          → Bot[]
saveBotConfig(botId, config)       → saves config.json
reloadBotConfig(botId)             → POST reload_config

// Strategy listing (for bot's available strategies)
botFtStrategies(botId)             → string[] (list of .py files in bot's strategy dir)
botFtStrategy(botId, name)         → { strategy: string, code: string }
```

---

## CODE QUALITY RULES

1. `"use client"` at top
2. No `any` types
3. All async calls in try/catch with toast
4. Monaco Editor: lazy load with `dynamic(() => import(...), { ssr: false })` to avoid SSR issues
5. Deploy modal: loading state on deploy button
6. Re-edit: loading state while fetching strategy
7. Handle edge cases: bot not running, strategy not found, network errors

---

## VERIFICATION

```bash
cd frontend && npx next build
```
**Must produce 0 errors.**

Test the flow:
1. Builder → create strategy → Save → Deploy modal appears
2. Select bot in deploy modal → Deploy → success toast
3. Strategies page → click "Edit in Builder" on existing strategy → Builder opens with data pre-filled
4. Visual/Code toggle works — Visual tab shows wizard, Code tab shows Monaco editor
5. Edit code in Monaco → Save → code is preserved
6. Deploy edited strategy → works correctly
