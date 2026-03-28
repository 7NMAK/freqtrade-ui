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
- [x] FreqUI working (port 8080, novakus/***REMOVED***)

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

### 1. Deploy & Test Orchestrator on Server
- [x] Fixed Docker networking: all services on ft_network, network set to external
- [x] Created Alembic initial migration (4 tables: bot_instances, strategies, risk_events, audit_log)
- [x] Updated alembic/env.py to read ORCH_DATABASE_URL from environment
- [x] Created deploy.sh — automated deploy + 14-step test suite
- [x] Deep audit: all 24 Python files syntax-verified, all safety rules checked
- [ ] Run deploy.sh on server (204.168.187.107) — `bash deploy.sh`
- [ ] Verify heartbeat monitor works (3s ping cycle)
- [ ] Verify all 14 test steps pass end-to-end

### 2. Remaining HTML Prototypes (5 pages)
- [ ] Backtesting page — §5, §6, §15, §21, §22, §30
- [ ] Settings page — §1, §7, §9, §11, §13, §17, §28
- [ ] FreqAI page — §24, §25, §26
- [ ] Analytics page — §19, §20, §29
- [ ] Data Management page — §12, §18, §27
- [ ] Risk page — §7 protections + kill switch
- [ ] Login page

### 3. Next.js 14 Frontend (Phase 3)
- [ ] Project setup + auth + layout
- [ ] Convert HTML prototypes to React components
- [ ] Connect to orchestrator API

### 4. Extras (Phase 4 — ONLY after 1-3)
- [ ] AI Strategy Analyst (OpenRouter)
- [ ] Polymarket Integration
