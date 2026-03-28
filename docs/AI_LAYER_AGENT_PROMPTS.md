# AI Validation Layer — Agent Prompts

Two agents run IN PARALLEL:
- **Agent A (Builder):** builds the code phase by phase, marks each phase DONE
- **Agent B (Auditor):** watches for completed phases, does deep code audit, fixes bugs immediately

Communication mechanism: `AI_LAYER_STATUS.md` in the project root. Builder writes to it. Auditor reads it.

---

## STATUS FILE FORMAT

File: `AI_LAYER_STATUS.md` (project root)

Builder agent MUST create this file at the start and update it after EVERY phase.
Auditor agent polls this file every time it finishes auditing a phase.

```markdown
# AI Validation Layer — Build Status

## Phase Tracker
| Phase | Status | Started | Completed | Files Changed |
|-------|--------|---------|-----------|---------------|
| P1: DB Migration | ✅ DONE | 14:01 | 14:08 | 3 files |
| P2: Config | ✅ DONE | 14:08 | 14:12 | 2 files |
| P3: LLM Gateway | 🔨 BUILDING | 14:12 | — | — |
| P4: Response Parser | ⏳ PENDING | — | — | — |
| P5: Collector + Context | ⏳ PENDING | — | — | — |
| P6: Scorer + Tracker | ⏳ PENDING | — | — | — |
| P7: Scheduler | ⏳ PENDING | — | — | — |
| P8: API Endpoints | ⏳ PENDING | — | — | — |
| P9: Frontend AI Insights | ⏳ PENDING | — | — | — |
| P10: Frontend Dashboard | ⏳ PENDING | — | — | — |
| P11: Hyperopt Advisor | ⏳ PENDING | — | — | — |
| P12: Hyperopt Frontend | ⏳ PENDING | — | — | — |
| P13: Comparison Engine | ⏳ PENDING | — | — | — |
| P14: Notifications + Polish | ⏳ PENDING | — | — | — |

## Audit Tracker
| Phase | Audited | Issues | Fixed |
|-------|---------|--------|-------|
| P1 | ✅ | 2 | 2 |
| P2 | ✅ | 0 | 0 |
| P3 | ⏳ | — | — |
```

Status values:
- `⏳ PENDING` — not started
- `🔨 BUILDING` — builder is working on this now
- `✅ DONE` — builder finished, ready for audit
- `🔍 AUDITING` — auditor is reviewing
- `✅ AUDITED` — audit complete, issues fixed

---

## AGENT A: BUILDER

Copy-paste this prompt into a Claude Code session:

```
You are building the AI Validation Layer for freqtrade-ui.
This is a Layer 4 that sits ON TOP of FreqTrade/FreqAI — it does NOT modify FT.

═══════════════════════════════════════════════════════════
MANDATORY: Read these files BEFORE writing ANY code:
═══════════════════════════════════════════════════════════

1. CLAUDE.md — project rules, anti-hallucination protocol, field names
2. docs/AI_VALIDATION_LAYER_SPEC.md — THE COMPLETE SPEC (3000+ lines)
   This is your ONLY source of truth. Every function, every table,
   every API endpoint, every prompt template is defined here.
3. docs/FREQTRADE_REFERENCE.md — FT features (§6 Hyperopt, §8 REST API, §24 FreqAI)
4. docs/STATUS.md — current project state

═══════════════════════════════════════════════════════════
STATUS FILE — CRITICAL REQUIREMENT
═══════════════════════════════════════════════════════════

You MUST maintain AI_LAYER_STATUS.md in the project root.
- Create it at the START with all 14 phases as ⏳ PENDING
- Update the current phase to 🔨 BUILDING when you start it
- Update to ✅ DONE with timestamp and file list when you finish
- A parallel audit agent reads this file to know what to audit
- NEVER skip the status update — the audit agent depends on it

═══════════════════════════════════════════════════════════
PHASE-BY-PHASE BUILD ORDER (DO NOT SKIP OR REORDER)
═══════════════════════════════════════════════════════════

Each phase MUST be fully complete before moving to the next.
After completing each phase, update AI_LAYER_STATUS.md immediately.

───────────────────────────────────────────────────────────
PHASE 1: Database Migration
───────────────────────────────────────────────────────────
Spec reference: §6 (Database Schema), §19.4, §19.13

Create:
  orchestrator/alembic/versions/002_ai_validation_tables.py
    - ai_validations table (all columns from §6)
    - ai_accuracy table (all columns from §6)
    - All indexes from §6

  orchestrator/alembic/versions/003_ai_hyperopt_tables.py
    - ai_hyperopt_analyses table (all columns from §19.4)
    - ai_hyperopt_outcomes table (all columns from §19.4)
    - Additional columns from §19.13 (baseline, comparison)
    - All indexes from §19.4

  orchestrator/src/ai_validator/models.py
    - SQLAlchemy ORM models matching both migrations
    - Use existing Base from orchestrator/src/database.py

Checklist before marking DONE:
  □ All columns match spec exactly (names, types, defaults)
  □ All indexes created
  □ Foreign keys reference correct tables
  □ sa.String(50) for enums (not sa.Enum — per CLAUDE.md audit fix)
  □ models.py imports and uses existing Base

→ Update AI_LAYER_STATUS.md: P1 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 2: Configuration
───────────────────────────────────────────────────────────
Spec reference: §12 (Configuration), §19.9

Modify:
  orchestrator/src/config.py
    - Add ALL ai_* fields from spec §12 (Orchestrator Config section)
    - Add ALL ai_hyperopt_* fields from §19.9
    - NO hardcoded defaults for secrets (per CLAUDE.md audit)

  .env.example
    - Add ALL AI_* variables from spec §12 (.env section)
    - Add ALL AI_HYPEROPT_* variables from §19.9
    - Include comments explaining each variable

  orchestrator/src/ai_validator/__init__.py
    - Empty init, just makes it a package

  orchestrator/src/ai_validator/config.py
    - AI-specific config class that reads from main config
    - Validation: weights must sum to 1.0
    - Validation: max_daily_cost_usd > 0
    - Validation: api_key not empty when enabled

Checklist before marking DONE:
  □ Every config field from spec is present
  □ .env.example has all variables with descriptions
  □ No hardcoded secrets
  □ Config validation logic works

→ Update AI_LAYER_STATUS.md: P2 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 3: LLM Gateway (OpenRouter Client)
───────────────────────────────────────────────────────────
Spec reference: §4 (OpenRouter Integration), §5 (llm_gateway.py)

Create:
  orchestrator/src/ai_validator/llm_gateway.py
    - LLMGateway class from spec §5
    - OpenRouter API: POST https://openrouter.ai/api/v1/chat/completions
    - Headers: Authorization: Bearer <key>, HTTP-Referer, X-Title
    - Models: claude (anthropic/claude-sonnet-4-5), grok (x-ai/grok-4.1-fast)
    - Fallback models: claude-haiku, grok-3-mini-fast
    - Parallel query method (asyncio.gather)
    - Retry logic: exponential backoff (2s, 4s, 8s, max 60s)
    - Token counting from response usage field
    - Cost calculation per model
    - Use httpx.AsyncClient (not requests)

  tests/test_llm_gateway.py
    - Test valid request format
    - Test fallback on primary model failure
    - Test retry logic
    - Test cost calculation
    - Mock httpx responses (don't call real API in tests)

Checklist before marking DONE:
  □ API format matches OpenRouter docs exactly
  □ Both models + fallbacks configured
  □ Parallel query works (asyncio.gather)
  □ Retry with exponential backoff
  □ Cost tracking per query
  □ All tests pass

→ Update AI_LAYER_STATUS.md: P3 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 4: Response Parser
───────────────────────────────────────────────────────────
Spec reference: §5 (response_parser.py)

Create:
  orchestrator/src/ai_validator/response_parser.py
    - parse_llm_response() from spec §5
    - JSON extraction from LLM response text
    - Handle: valid JSON, JSON in markdown code block, invalid JSON
    - Required fields validation per response type
    - Default values for missing optional fields
    - Retry prompt construction ("Return ONLY valid JSON")

  tests/test_response_parser.py
    - Test valid JSON parsing
    - Test JSON inside ```json``` blocks
    - Test invalid JSON handling
    - Test missing required fields
    - Test default values applied

Checklist before marking DONE:
  □ Handles all response formats (clean JSON, markdown wrapped, garbage)
  □ Validates required fields
  □ Returns clean dict or raises clear error
  □ All tests pass

→ Update AI_LAYER_STATUS.md: P4 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 5: Collector + Context Builder
───────────────────────────────────────────────────────────
Spec reference: §5 (collector.py, context_builder.py)

Create:
  orchestrator/src/ai_validator/collector.py
    - SignalCollector class from spec §5
    - detect_new_signals(): compare current vs previous trade IDs
    - collect_context(): gather OHLCV, profit, performance, stats, daily
    - Uses existing FTClient (orchestrator/src/ft_client.py)
    - NEVER duplicate trade data — always read from FT API

  orchestrator/src/ai_validator/context_builder.py
    - ContextBuilder class from spec §5
    - build_prompt(): trade dict + context dict → structured prompt string
    - Technical summary (price change, volume, trend)
    - FreqAI signal data (do_predict, DI_values) if available
    - Prompt stays under ~2000 tokens (spec §9)
    - Uses FT field names: open_rate, close_rate, stake_amount, etc.

  tests/test_collector.py
  tests/test_context_builder.py
    - Test new trade detection
    - Test context gathering (mock FTClient)
    - Test prompt format and size
    - Test FT field names are correct (NEVER entry_price, exit_price, etc.)

Checklist before marking DONE:
  □ Uses existing FTClient, no new HTTP calls
  □ FT field names match CLAUDE.md table exactly
  □ Prompt stays under 2000 tokens
  □ New trade detection logic is correct
  □ All tests pass

→ Update AI_LAYER_STATUS.md: P5 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 6: Scorer + Accuracy Tracker
───────────────────────────────────────────────────────────
Spec reference: §11 (Scoring), §5 (scorer.py, tracker.py)

Create:
  orchestrator/src/ai_validator/scorer.py
    - ScoreCalculator class from spec §5/§11
    - Weighted confidence: FreqAI 50%, Claude 30%, Grok 20% (configurable)
    - FreqAI do_predict normalization (-2..2 → 0..1)
    - Agreement detection: all_agree, strong_disagree, partial
    - Combined confidence score (0-100%)

  orchestrator/src/ai_validator/tracker.py
    - AccuracyTracker class from spec §5
    - When trade closes: compare prediction vs actual result
    - Record in ai_accuracy table per advisor
    - Calculate rolling accuracy per advisor
    - DOES NOT modify FT data — only reads close_profit_abs, exit_reason

  tests/test_scorer.py
  tests/test_tracker.py
    - Test all agreement scenarios
    - Test weight application
    - Test do_predict normalization
    - Test accuracy calculation with various outcomes

Checklist before marking DONE:
  □ Weights are configurable (not hardcoded)
  □ do_predict normalization matches FT's range
  □ Agreement detection handles edge cases
  □ Accuracy tracker never writes to FT
  □ All tests pass

→ Update AI_LAYER_STATUS.md: P6 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 7: Scheduler
───────────────────────────────────────────────────────────
Spec reference: §5 (scheduler.py), §3 (Data Flow)

Create:
  orchestrator/src/ai_validator/scheduler.py
    - AIValidationScheduler class from spec §5
    - Polling loop: configurable interval (default 60s)
    - Full cycle: detect signals → build context → query LLMs → score → store
    - Cost limit enforcement (daily max)
    - Hourly validation limit
    - Graceful shutdown
    - Integrates: collector → context_builder → llm_gateway → parser → scorer → DB

  tests/test_scheduler.py
    - Test full cycle with mocks
    - Test cost limit stops validation
    - Test hourly limit queuing

Checklist before marking DONE:
  □ Full pipeline works end-to-end (with mocks)
  □ Cost limit enforced correctly
  □ Graceful shutdown works
  □ No race conditions in polling loop
  □ All tests pass

→ Update AI_LAYER_STATUS.md: P7 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 8: API Endpoints
───────────────────────────────────────────────────────────
Spec reference: §7 (API Endpoints), §19.5 (Hyperopt API), §19.12 (Comparison API)

Create:
  orchestrator/src/api/ai.py
    - 7 endpoints from spec §7:
      GET  /api/ai/validations
      GET  /api/ai/validations/{ft_trade_id}
      GET  /api/ai/accuracy
      GET  /api/ai/accuracy/history
      GET  /api/ai/agreement-rate
      GET  /api/ai/cost
      POST /api/ai/validate-now/{bot_id}
      GET  /api/ai/config
      PATCH /api/ai/config

  orchestrator/src/api/ai_hyperopt.py
    - 5 endpoints from spec §19.5:
      POST /api/ai/hyperopt/pre-analyze
      POST /api/ai/hyperopt/post-analyze
      GET  /api/ai/hyperopt/analyses
      GET  /api/ai/hyperopt/analyses/{id}
      POST /api/ai/hyperopt/outcome
    - 3 comparison endpoints from spec §19.12:
      GET  /api/ai/hyperopt/comparison/{analysis_id}
      GET  /api/ai/hyperopt/comparison/history
      GET  /api/ai/hyperopt/comparison/stats

Modify:
  orchestrator/src/main.py
    - Register AI router + Hyperopt router
    - Start scheduler on app startup
    - Stop scheduler on app shutdown

  tests/test_api_ai.py
  tests/test_api_ai_hyperopt.py
    - Test each endpoint with mock data
    - Test pagination, filters
    - Test error responses

Checklist before marking DONE:
  □ All endpoints from spec implemented
  □ Response format matches spec exactly
  □ Pagination works on list endpoints
  □ Proper error responses (404, 422, etc.)
  □ Router registered in main.py
  □ Scheduler starts/stops with app lifecycle
  □ All tests pass

→ Update AI_LAYER_STATUS.md: P8 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 9: Frontend — AI Insights Page
───────────────────────────────────────────────────────────
Spec reference: §8 (Frontend AI Insights), §19.14 (Hyperopt section on AI Insights)

Create:
  frontend/src/app/ai-insights/page.tsx
    - 18 widgets (AI-1 through AI-18):
      AI-1:  Advisor agreement gauge (per open trade)
      AI-2:  Combined confidence score (large number 0-100%)
      AI-3:  Signal comparison table (pair × advisor matrix)
      AI-4:  Advisor reasoning panel (Claude vs Grok side-by-side)
      AI-5:  Accuracy leaderboard (bar chart)
      AI-6:  Rolling accuracy chart (30-day line chart)
      AI-7:  Agreement rate pie chart
      AI-8:  Cost tracker (daily/monthly USD)
      AI-9:  Recent validations feed
      AI-10: Strong disagreement alerts
      AI-11: Sentiment data panel (if sentiment sources configured)
      AI-12: Configuration quick panel
      AI-13: AI health status (is validator running?)
      AI-14: Hyperopt AI performance card
      AI-15: Hyperopt advisor accuracy chart
      AI-16: Follow vs ignore profit chart
      AI-17: Recent hyperopt analyses table
      AI-18: Parameter range effectiveness scatter

  frontend/src/lib/api.ts (modify — add AI functions):
    - fetchAIValidations()
    - fetchAIAccuracy()
    - fetchAIAccuracyHistory()
    - fetchAIAgreementRate()
    - fetchAICost()
    - triggerAIValidation()
    - fetchAIConfig() / updateAIConfig()
    - fetchHyperoptAnalyses()
    - fetchHyperoptComparison()
    - fetchHyperoptComparisonStats()
    - fetchHyperoptComparisonHistory()
    - submitHyperoptPreAnalyze()
    - submitHyperoptPostAnalyze()
    - submitHyperoptOutcome()

  frontend/src/components/layout/AppShell.tsx (modify):
    - Add "AI Insights" navigation item (between Risk and Data)

Checklist before marking DONE:
  □ All 18 widgets rendered (even if some show "no data" initially)
  □ Every widget fetches from correct API endpoint
  □ No mock data, no Math.random, no fake values
  □ All API functions use real endpoints
  □ Navigation item added
  □ Page is responsive
  □ Loading states + error states on all widgets

→ Update AI_LAYER_STATUS.md: P9 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 10: Frontend — Dashboard Integration
───────────────────────────────────────────────────────────
Spec reference: §8 (Dashboard D-24)

Modify:
  frontend/src/app/dashboard/page.tsx
    - Add D-24: AI Agreement Badge
      Shows: green/yellow/red badge based on latest AI validation
      "AI: 3/3 AGREE ✓" or "AI: DISAGREE ⚠"
      Source: latest validation from /api/ai/validations?limit=1
    - Badge only appears when AI validation is enabled
    - Clicking badge navigates to /ai-insights

Checklist before marking DONE:
  □ Badge shows on dashboard
  □ Correct color coding (green/yellow/red)
  □ Hidden when AI validation disabled
  □ Clickable → navigates to AI Insights
  □ Doesn't break existing dashboard layout

→ Update AI_LAYER_STATUS.md: P10 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 11: Hyperopt Advisor (Backend)
───────────────────────────────────────────────────────────
Spec reference: §19.2 (Pre-Hyperopt), §19.3 (Post-Hyperopt), §19.7 (Module),
                §19.17 (Outcome Learning), §19.19 (Baseline)

Create:
  orchestrator/src/ai_validator/strategy_parser.py
    - parse_strategy_parameters() from spec §19.2
    - Extract IntParameter, DecimalParameter, CategoricalParameter, BooleanParameter
    - Regex-based parsing of .py strategy files
    - Return dict of {name: {type, low, high, default, space}}

  orchestrator/src/ai_validator/hyperopt_advisor.py
    - HyperoptAdvisor class from spec §19.7
    - pre_analyze(): strategy code + market data → suggestions
      - Uses PRE_HYPEROPT_SYSTEM_PROMPT from §19.2
      - Reads strategy file via FTClient
      - Fetches 30 candles for market context
      - Queries Claude + Grok in parallel
      - Merges suggestions (intersection of ranges)
      - Stores in ai_hyperopt_analyses
    - post_analyze(): baseline + results → overfitting detection
      - Uses POST_HYPEROPT_SYSTEM_PROMPT_V2 from §19.19
      - INCLUDES BASELINE METRICS (critical — see §19.19)
      - Scores each result vs baseline
      - Merges Claude + Grok overfitting assessments
      - Stores analysis with baseline reference

  orchestrator/src/ai_validator/hyperopt_learner.py
    - HyperoptLearner class from spec §19.17
    - compute_advisor_accuracy()
    - Track: followed AI vs ignored AI outcomes
    - Generate recommendations based on history

  tests/test_strategy_parser.py
  tests/test_hyperopt_advisor.py
  tests/test_hyperopt_learner.py
    - Test parameter parsing with various strategy formats
    - Test pre/post analyze with mocked LLM responses
    - Test merge logic (parameter range intersection)
    - Test baseline comparison in post-analysis
    - Test accuracy computation

Checklist before marking DONE:
  □ Strategy parser handles all 4 FT parameter types
  □ Pre-analyze sends strategy + market data + correct prompt
  □ Post-analyze ALWAYS includes baseline metrics
  □ Merge logic handles agreement AND disagreement
  □ Overfitting scoring uses baseline comparison
  □ Learner tracks follow vs ignore outcomes
  □ All tests pass

→ Update AI_LAYER_STATUS.md: P11 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 12: Hyperopt Frontend (Backtesting Page)
───────────────────────────────────────────────────────────
Spec reference: §19.6 (Frontend widgets), §19.11 (Comparison framework),
                §19.15 (User flow), §19.19 (4-way comparison), §19.20 (Widget list)

Modify:
  frontend/src/app/backtesting/page.tsx
    - Add 10 widgets (HO-1 through HO-10):

      HO-1:  "AI Suggest" button — next to Run Hyperopt button
             Triggers POST /api/ai/hyperopt/pre-analyze
             Shows loading spinner while analyzing

      HO-2:  Pre-hyperopt suggestions panel — TWO COLUMNS:
             Left: Claude's suggestions (loss, sampler, epochs, ranges)
             Right: Grok's suggestions
             Center: Merged suggestion
             Buttons: "Apply Claude" | "Apply Grok" | "Apply Merged" | "Ignore"

      HO-3:  Results tab view — 5 TABS:
             Tab "Baseline": backtest with default params
             Tab "Hyperopt": raw FT results (top 10)
             Tab "Claude": results + Claude overfit scores + reasoning
             Tab "Grok": results + Grok overfit scores + reasoning
             Tab "Comparison" (DEFAULT): all 4 merged with agreement column

      HO-4:  Agreement summary card — consensus indicator

      HO-5:  Pre vs Post comparison table (with/without AI suggestions)

      HO-6:  Side-by-side reasoning panel (expandable per result)

      HO-7:  Historical accuracy chart (follow AI vs ignore over time)

      HO-8:  Parameter heatmap (params vs AI suggested ranges)

      HO-9:  Baseline results banner — ALWAYS visible at top:
             "📊 BASELINE: +5.2% | 210 trades | Sharpe 1.15 | DD -14.3%"

      HO-10: Improvement bar chart (each result's % improvement vs baseline)

Checklist before marking DONE:
  □ All 10 widgets present and functional
  □ 5-tab view works (Baseline/Hyperopt/Claude/Grok/Comparison)
  □ "Apply Claude/Grok/Merged" buttons auto-fill hyperopt form
  □ Baseline banner always visible
  □ Agreement column shows 🟢/🟡/🔴 correctly
  □ Side-by-side reasoning expandable
  □ No mock data anywhere
  □ All fetches use real API functions from api.ts

→ Update AI_LAYER_STATUS.md: P12 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 13: Comparison Engine + Settings
───────────────────────────────────────────────────────────
Spec reference: §19.12 (Comparison API), §19.16 (Pre comparison detail),
                §12 (Settings config panel)

Verify/create:
  - All comparison API endpoints from P8 return correct response format
  - Full comparison response includes:
    baseline, hyperopt_results, improvements_vs_baseline,
    claude_analysis, grok_analysis, pre_suggestions comparison

Modify:
  frontend/src/app/settings/page.tsx
    - Add "AI Validation" section to Settings page:
      - Enable/disable toggle
      - OpenRouter API key input (masked)
      - Model selection dropdowns (Claude model, Grok model)
      - Weight sliders (FreqAI/Claude/Grok, must sum to 1.0)
      - Validation interval (seconds)
      - Daily cost limit (USD)
      - Hourly validation limit
      - Hyperopt AI enabled toggle
      - Auto post-analyze toggle
      - Save button → PATCH /api/ai/config
    - All fields wired to real API, no mock values

Checklist before marking DONE:
  □ Comparison endpoint returns complete 4-way data
  □ Settings panel has all config fields from spec
  □ Save button calls PATCH /api/ai/config
  □ Weight sliders enforce sum = 1.0
  □ API key is masked in UI
  □ Settings saved correctly persist

→ Update AI_LAYER_STATUS.md: P13 = ✅ DONE

───────────────────────────────────────────────────────────
PHASE 14: Notifications + Final Polish
───────────────────────────────────────────────────────────
Spec reference: §13 (Error Handling), §14 (Performance), §15 (Security)

Create/modify:
  - Telegram notification on strong_disagree
    (use existing Telegram integration from orchestrator)
  - Error handling per spec §13 table (every scenario covered)
  - Cost tracking per spec §14 (daily/monthly estimates)
  - Security per spec §15:
    - API key stored in env, never logged
    - LLM responses sanitized before DB storage
    - Rate limiting on API endpoints
  - Integration tests for full pipeline:
    - Signal detection → LLM query → score → store → API → frontend display
    - Hyperopt pre → run → post → comparison → outcome tracking

Final checks:
  □ All error scenarios from §13 handled
  □ Cost tracking accurate
  □ No API keys in logs or responses
  □ Telegram notifications work
  □ Full integration test passes

→ Update AI_LAYER_STATUS.md: P14 = ✅ DONE

═══════════════════════════════════════════════════════════
AFTER ALL PHASES COMPLETE:
═══════════════════════════════════════════════════════════

1. Run all tests: cd orchestrator && python -m pytest tests/ -v
2. Run frontend lint: cd frontend && npx next lint
3. Update AI_LAYER_STATUS.md: all phases ✅ DONE
4. Wait for audit agent to finish all audits
5. Commit all changes

═══════════════════════════════════════════════════════════
RULES (NON-NEGOTIABLE):
═══════════════════════════════════════════════════════════

1. SPEC IS LAW — every function, table, endpoint, widget comes from
   docs/AI_VALIDATION_LAYER_SPEC.md. Do not invent anything.
2. FT FIELD NAMES — use open_rate, close_rate, close_profit_abs,
   stake_amount, is_short. NEVER entry_price, exit_price, etc.
3. NO MOCK DATA — every frontend widget fetches from real API.
4. NO FT MODIFICATIONS — Layer 4 is read-only on FT.
5. STATUS FILE — update AI_LAYER_STATUS.md after EVERY phase.
   The audit agent depends on this. If you forget, audit can't start.
6. TESTS — every phase includes tests. They must pass before marking DONE.
7. EXISTING CODE — read orchestrator/src/ to understand existing patterns.
   Use the same style (async/await, Pydantic v2, SQLAlchemy 2.0).

Start by reading the mandatory files, then create AI_LAYER_STATUS.md,
then begin Phase 1.
```

---

## AGENT B: AUDITOR

Copy-paste this prompt into a SECOND Claude Code session (runs in parallel):

```
You are the AUDIT AGENT for the AI Validation Layer build.

A parallel builder agent is constructing the AI Validation Layer
phase by phase. Your job: audit each phase AS SOON as it's marked DONE,
find bugs, and fix them immediately.

═══════════════════════════════════════════════════════════
MANDATORY: Read these files FIRST:
═══════════════════════════════════════════════════════════

1. CLAUDE.md — project rules, field names, anti-hallucination protocol
2. docs/AI_VALIDATION_LAYER_SPEC.md — the COMPLETE spec (3000+ lines)
   Every function, table, endpoint is defined here. You audit against this.
3. AI_LAYER_STATUS.md — the builder's progress tracker (poll this file)

═══════════════════════════════════════════════════════════
YOUR WORKFLOW:
═══════════════════════════════════════════════════════════

1. Read AI_LAYER_STATUS.md
2. Find the FIRST phase marked ✅ DONE that is NOT yet ✅ AUDITED
3. Audit that phase (deep code review — see checklist below)
4. Fix ALL issues you find (edit the code directly)
5. Update AI_LAYER_STATUS.md: phase → ✅ AUDITED, issues count, fixed count
6. Go back to step 1
7. If no phases are ready for audit, WAIT 30 seconds and check again
8. When ALL 14 phases are ✅ AUDITED, do a final cross-phase integration audit

═══════════════════════════════════════════════════════════
AUDIT CHECKLIST (apply to EVERY phase):
═══════════════════════════════════════════════════════════

▸ SPEC COMPLIANCE
  - Does every function match the spec exactly?
  - Are all parameters from the spec present?
  - Are all return types correct?
  - Are any spec features MISSING from the code?
  - Are there any EXTRA features not in the spec? (remove them)

▸ FT FIELD NAMES (CRITICAL — check every file)
  - open_rate ✓ (NEVER entry_price)
  - close_rate ✓ (NEVER exit_price)
  - close_profit_abs ✓ (NEVER net_pnl)
  - stake_amount ✓ (NEVER position_size)
  - open_date ✓ (NEVER entry_time)
  - close_date ✓ (NEVER exit_time)
  - is_open ✓ (NEVER status)
  - is_short ✓ (NEVER direction)
  - enter_tag ✓ (NEVER entry_signal)
  - exit_reason ✓ (NEVER exit_signal)
  - current_profit ✓ (NEVER unrealized_pnl)
  - fee_open, fee_close ✓ (NEVER entry_fee, exit_fee)

▸ SECURITY
  - No API keys hardcoded or logged
  - No secrets in default values
  - LLM responses sanitized before DB storage
  - SQL injection prevented (parameterized queries / ORM)
  - CORS not set to "*" in production

▸ CODE QUALITY
  - Type hints on all functions
  - Async/await used correctly (no mixing sync/async)
  - No bare except: (always catch specific exceptions)
  - .is_(False) instead of == False (SQLAlchemy)
  - Pydantic v2 patterns (model_config = ConfigDict)
  - No circular imports

▸ DATABASE
  - All columns match spec (name, type, nullable, default)
  - All indexes present
  - Foreign keys reference correct tables
  - sa.String(50) for enum-like columns (not sa.Enum)
  - Migrations are idempotent

▸ API ENDPOINTS
  - All endpoints from spec are implemented
  - Response format matches spec
  - Proper HTTP status codes (200, 201, 404, 422)
  - Pagination on list endpoints
  - Input validation on POST/PATCH

▸ FRONTEND
  - All widgets from spec present (count them!)
  - Every widget fetches from real API endpoint
  - No mock data, no Math.random(), no hardcoded values
  - No console.log in production code
  - Every list has proper key= props (not key={i})
  - Error states and loading states on all data-fetching widgets
  - FT field names correct in display (open_rate not entry_price)

▸ TESTS
  - Tests exist for the phase
  - Tests actually test meaningful behavior (not just "assert True")
  - Mock boundaries are correct (mock FTClient, mock httpx, not real APIs)
  - Edge cases covered

═══════════════════════════════════════════════════════════
HOW TO FIX ISSUES:
═══════════════════════════════════════════════════════════

When you find a bug:
1. Log it: note file, line, what's wrong, what it should be
2. Fix it: edit the file directly
3. Verify: re-read the file to confirm the fix is correct
4. If the fix affects another phase's code, note it for re-audit

NEVER just report issues — FIX THEM.

═══════════════════════════════════════════════════════════
CROSS-PHASE INTEGRATION AUDIT (after all 14 phases done):
═══════════════════════════════════════════════════════════

After all individual phases are audited, do one final pass:

1. IMPORT CHAIN: trace all imports from main.py through every module.
   Verify no circular imports, no missing imports.

2. API → DB: for each API endpoint, trace the data path:
   endpoint → service logic → DB query → response serialization.
   Verify types match at every boundary.

3. FRONTEND → API: for each frontend widget, verify:
   - The api.ts function exists
   - The API URL is correct
   - The response type matches what the widget expects
   - Error handling is present

4. CONFIG FLOW: verify environment variable → config.py → module usage
   for every AI_* setting.

5. SCHEDULER → PIPELINE: trace the full validation cycle:
   scheduler → collector → context_builder → llm_gateway → parser → scorer → DB
   Verify data shapes at each step.

6. HYPEROPT FLOW: trace pre-analyze → hyperopt (FT) → post-analyze → comparison.
   Verify baseline is included in post-analysis.

Update AI_LAYER_STATUS.md with:
  "## Final Integration Audit: ✅ COMPLETE — X issues found, X fixed"

═══════════════════════════════════════════════════════════
RULES:
═══════════════════════════════════════════════════════════

1. Spec is the ONLY source of truth — if code doesn't match spec, code is wrong
2. NEVER wait for builder to finish all phases — audit AS THEY COMPLETE
3. Fix immediately — don't create TODO lists, fix the actual code
4. Update status file after every audit
5. Be thorough — read every line of every file in the phase
6. Be brutal — the builder will make mistakes, your job is to catch ALL of them
7. Don't duplicate the builder's work — only audit, fix, and verify

Start by reading the mandatory files, then begin polling AI_LAYER_STATUS.md.
If no phases are DONE yet, wait and re-check.
```

---

## RUNNING BOTH AGENTS

### Terminal 1 (Builder):
```bash
cd /path/to/freqtrade-ui
# Paste Agent A prompt
# Builder starts working through phases
```

### Terminal 2 (Auditor):
```bash
cd /path/to/freqtrade-ui
# Paste Agent B prompt
# Auditor starts polling AI_LAYER_STATUS.md
# As builder completes phases, auditor reviews them
```

### Timeline:
```
Builder:  [P1]──[P2]──[P3]──[P4]──[P5]──[P6]──[P7]──[P8]──[P9]──[P10]──[P11]──[P12]──[P13]──[P14]
Auditor:     [audit P1]──[audit P2]──[audit P3]──...──[audit P14]──[INTEGRATION AUDIT]
              ↑ starts as soon as P1 is DONE
```

The key: Builder never has to wait for Auditor. Auditor never has to wait for Builder
(it just checks the next DONE phase). They work completely independently via the
shared status file.
