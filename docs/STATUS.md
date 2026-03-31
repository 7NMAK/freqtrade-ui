# STATUS.md — Project Progress

**Updated:** 2026-03-28

---

## ACTIVE FILES (root folder)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Rules, philosophy, anti-hallucination protocol — READ FIRST |
| `FT-UI-MAP.html` | Blueprint: every FT feature → UI page/element |
| `FREQTRADE_REFERENCE.md` | Complete FT docs (34 sections) — source of truth |
| `STATUS.md` | This file — what's done, what's next |
| `docker-compose.yml` | PostgreSQL + Redis + Orchestrator services |
| `orchestrator/` | Python/FastAPI backend (multi-bot, kill switch, heartbeat) |
| `dashboard.html` | HTML prototype — Dashboard page |
| `strategies.html` | HTML prototype — Strategies page |
| `builder.html` | HTML prototype — Strategy Builder page |
| `_BACKUP/` | All old files (old specs, old code, old tasks) |

---

## DONE

### Infrastructure
- [x] FreqTrade 2026.2 running (stable_freqai Docker on 204.168.187.107)
- [x] FreqAI packages (LightGBM, XGBoost, scikit-learn)
- [x] TA libraries (technical, ft-pandas-ta, ta)
- [x] 26 strategies loaded, ftui on host
- [x] BTC/USDT futures data (1h + daily from 2022)
- [x] FreqUI working (port 8080, credentials via env var)

### Documentation
- [x] FREQTRADE_REFERENCE.md — 34 sections, verified against official docs
- [x] FT-UI-MAP.html — all 34 sections mapped to 8 pages
- [x] CLAUDE.md v2.1 — anti-hallucination protocol, FT-first rules

### HTML Prototypes (3/8 pages)
- [x] dashboard.html
- [x] strategies.html
- [x] builder.html

### Orchestrator Backend (COMPLETE)
- [x] `docker-compose.yml` — PostgreSQL + Redis + Orchestrator
- [x] `orchestrator/Dockerfile`
- [x] `orchestrator/requirements.txt`
- [x] `orchestrator/alembic.ini` + `alembic/env.py` — DB migrations
- [x] `src/config.py` — Pydantic Settings (env vars, ORCH_ prefix)
- [x] `src/database.py` — async SQLAlchemy (metadata ONLY, no trade data)
- [x] `src/models/` — 4 models:
  - `BotInstance` (status, health, container mapping)
  - `Strategy` (lifecycle: DRAFT→BACKTEST→PAPER→LIVE→RETIRED)
  - `RiskEvent` (immutable kill switch log)
  - `AuditLog` (immutable action log)
- [x] `src/ft_client.py` — complete async FT REST API client (40+ endpoints)
- [x] `src/main.py` — FastAPI app, lifespan (heartbeat+kill switch wired)
- [x] `src/bot_manager/manager.py` — multi-bot CRUD + FT API passthrough
- [x] `src/heartbeat/monitor.py` — ping every 3s, 3 failures → HARD KILL
- [x] `src/kill_switch/kill_switch.py` — soft kill + hard kill (single + all)
- [x] `src/portfolio/aggregator.py` — cross-bot balance/profit/trades
- [x] `src/api/bots.py` — bot management endpoints
- [x] `src/api/kill_switch.py` — kill switch endpoints + risk events
- [x] `src/api/portfolio.py` — portfolio aggregation endpoints
- [x] `src/api/strategies.py` — strategy lifecycle endpoints
- [x] **Audit passed** — 24 Python files, all syntax OK, all safety rules verified

---

## NEXT STEPS (in order)

### 1. Deploy & Test Orchestrator on Server ✓
- [x] Deployed to server (204.168.187.107) — repo at /opt/freqtrade-ui
- [x] `docker compose up -d` — postgres + redis + orchestrator running
- [x] Registered FT bot — "ft-main" (id=1, http://freqtrade:8080, on ft_network)
- [x] Fix: asyncpg enum mismatch — `native_enum=False` on all Enum columns
- [x] Fix: httpx network errors wrapped as FTClientError in ft_client.py
- [x] Tested: health endpoint → OK
- [x] Tested: start/stop bot → OK (FT responds correctly)
- [x] Tested: soft kill → OK (risk event logged, trigger=manual)
- [x] Tested: hard kill → OK (forceexit all + stop, risk event logged)
- [x] Tested: portfolio balance → OK (FT balance fields preserved exactly)
- [x] Tested: portfolio profit → OK (profit_all_coin, profit_closed_fiat, etc.)
- [x] Tested: portfolio open trades → OK (open_rate, stake_amount, current_profit)
- [x] Tested: heartbeat monitor → OK (3 failures → auto HARD KILL, trigger=heartbeat)
- [x] Tested: manual recovery after kill → OK (bot returns to running/healthy)
- [x] Tested: strategy lifecycle → OK (draft→backtest, invalid transitions blocked)

### 2. HTML Prototypes — ALL COMPLETE ✓
- [x] Backtesting page — §5, §6, §15, §21, §22, §30
- [x] Settings page — §1, §7, §9, §11, §13, §17, §28
- [x] FreqAI page — §24, §25, §26
- [x] Analytics page — §19, §20, §29
- [x] Data Management page — §12, §18, §27
- [x] Risk page — §7 protections + kill switch
- [x] Login page

### 3. Next.js 14 Frontend (Phase 3)
- [x] Project setup + auth + layout
- [x] Convert HTML prototypes to React components
- [x] Connect to orchestrator API
- [x] ZERO TOLERANCE audit (key={i}, silent catches, typing, constants, ErrorBoundary)

### 4. Remaining Work — Agent Prompts (docs/AGENT_*.md)

**Agent 1 — Dashboard** (`docs/AGENT_1_DASHBOARD.md`)
- [x] Dashboard two-view architecture (All Bots default + Single Bot drill-down) — REWRITTEN
- [ ] Wire Bot Management components (BotRegisterModal, BotEditModal, BotDeleteDialog, BotManagementTable)
- [ ] Verify all API calls work end-to-end

**Agent 2 — Strategies** (`docs/AGENT_2_STRATEGIES.md`)
- [ ] Rewrite strategies page with unified strategy-bot card grid (matching prototype)
- [ ] Build drill-down view (backtests, hyperopt, trades, stats, AI, config, timeline)
- [ ] Lifecycle actions (Run Backtest, Start Paper, Go Live, Retire, Clone, Export)
- [ ] Import .py modal

**Agent 3 — Builder + Deploy** (`docs/AGENT_3_BUILDER_DEPLOY.md`)
- [ ] Deploy flow: Builder → Save → Deploy modal → Select bot → Upload .py → Reload
- [ ] Re-edit: Load existing strategy into Builder wizard (via builder_state JSON)
- [ ] Code Editor: Install Monaco, Visual/Code toggle tabs

**Agent 4 — UX Polish** (`docs/AGENT_4_UX_POLISH.md`)
- [x] Tooltip component (components/ui/Tooltip.tsx)
- [x] Tooltip database (lib/tooltips.ts — 193 entries from §1-§29)
- [x] FreqAI page — tooltips applied, raw config keys hidden
- [x] Settings page — tooltips applied, paramRef removed
- [x] Backtesting — TagInput bug fixed, multi-strategy comparison table added
- [x] Knowledge Base document (docs/KNOWLEDGE_BASE.md)
- [x] i18n check — no i18n lib installed, "raw codes" were config keys (now fixed)
- [ ] Tooltips on remaining pages (Backtesting, Builder, Data, Analytics, Risk)
- [ ] HTML/CSS consistency fixes (all pages)
- [ ] Design standards enforcement (all pages)

**Agent 5 — Server** (`docs/AGENT_5_SERVER_DIAGNOSTICS.md`)
- [ ] Diagnose why default FT bot won't start on server
- [ ] Fix and verify bot responds on port 8080

### 5. Extras (Phase 4 — ONLY after above)
- [ ] AI Strategy Analyst (OpenRouter)
