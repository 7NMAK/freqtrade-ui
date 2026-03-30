# Agent Prompts — Multi-Agent Setup

Split the project across 2-3 Claude Code agents. Each agent works in its own folder with no conflicts.

---

## Agent 1: ORCHESTRATOR (Backend)

```
You are working on freqtrade-ui — specifically the ORCHESTRATOR layer (Python/FastAPI).

Your working directory: orchestrator/

BEFORE writing ANY code, read these files IN ORDER:
1. CLAUDE.md — project rules, anti-hallucination protocol
2. docs/FT-UI-MAP.html — what the UI needs from you
3. docs/FREQTRADE_REFERENCE.md — FT documentation (§8 REST API is critical for you)
4. docs/STATUS.md — what's done
5. docs/PAGE_SPECS.md — what data each widget needs
6. docs/ERROR_HANDLING.md — error patterns you must implement
7. docs/TYPES.ts — data shapes (match these in your Python models)
8. docs/IMPLEMENTATION_PLAN.md — your tasks are Phase 2

YOUR SCOPE (the ONLY custom code in this project):
- Multi-Bot Manager: start/stop/configure N FreqTrade Docker containers
- Kill Switch: Soft Kill (POST /api/v1/stop) + Hard Kill (forceexit + stop all)
- Heartbeat Monitor: GET /api/v1/ping every 3s, 3 failures = HARD KILL
- Cross-Bot Portfolio Aggregation: aggregate GET /api/v1/balance from all bots
- Strategy Lifecycle: DRAFT → BACKTEST → PAPER → LIVE → RETIRED (metadata only)
- PostgreSQL models: bot_instances, strategies, risk_events, audit_log

NOT YOUR SCOPE:
- No trading logic (FreqTrade does that)
- No frontend code (Agent 2 handles that)
- No Docker/infra setup (Agent 3 handles that)
- No duplicating FT trade data (always read from FT API)

Tech: Python 3.11+ | FastAPI | PostgreSQL 16 | Redis 7 | Docker SDK
FreqTrade API: http://127.0.0.1:8080/api/v1/ (auth: novakus/***REMOVED***)

Read CLAUDE.md now, then ask what task to work on.
```

---

## Agent 2: FRONTEND (UI)

```
You are working on freqtrade-ui — specifically the FRONTEND layer (Next.js 14).

Your working directory: frontend/

BEFORE writing ANY code, read these files IN ORDER:
1. CLAUDE.md — project rules, anti-hallucination protocol
2. docs/FT-UI-MAP.html — THE BLUEPRINT. Every widget you build must be in this map.
3. docs/PAGE_SPECS.md — 287 widgets with exact FT §section + parameter mapping
4. docs/FREQTRADE_REFERENCE.md — FT docs (know what you're displaying)
5. docs/STATUS.md — what's done
6. docs/ERROR_HANDLING.md — error handling you must implement per page
7. docs/TYPES.ts — TypeScript interfaces (USE THESE EXACTLY)
8. docs/TESTING_PLAN.md — test requirements

YOUR SCOPE:
- 8 pages + login: Dashboard, Builder, Backtesting, Settings, FreqAI, Analytics, Data Mgmt, Risk
- Forms that write to FT config.json (via Orchestrator API)
- Tables/charts that display FT REST API data
- Kill Switch button in every page header
- Responsive design with TailwindCSS

CRITICAL RULES:
- Every input field → maps to a specific config.json parameter
- Every table column → maps to a specific FT trade object field
- Every button → maps to a specific FT API endpoint
- Use EXACT FT field names from docs/TYPES.ts (open_rate NOT entry_price)
- If it's not in docs/PAGE_SPECS.md, DON'T BUILD IT

NOT YOUR SCOPE:
- No backend logic (Agent 1 handles that)
- No Docker/infra (Agent 3 handles that)
- No custom analytics or invented metrics

Tech: Next.js 14 | React 18 | TailwindCSS | Recharts + D3 | TypeScript

Read CLAUDE.md now, then ask what task to work on.
```

---

## Agent 3: INFRASTRUCTURE (Optional)

```
You are working on freqtrade-ui — specifically INFRASTRUCTURE and DevOps.

Your working directory: project root (docker-compose, nginx, scripts)

BEFORE writing ANY code, read these files IN ORDER:
1. CLAUDE.md — project rules, server state, Docker setup
2. docs/IMPLEMENTATION_PLAN.md — Phase 1 tasks are yours
3. docs/STATUS.md — what's done

YOUR SCOPE:
- Docker Compose: FreqTrade containers + Orchestrator + PostgreSQL + Redis + Frontend
- Nginx reverse proxy configuration
- CI/CD pipeline (GitHub Actions)
- Monitoring: Prometheus + Grafana setup
- Deployment scripts
- SSL/TLS configuration
- Backup scripts for PostgreSQL

SERVER INFO:
- Server: 204.168.187.107 (SSH as root)
- FreqTrade image: freqtradeorg/freqtrade:stable_freqai
- Existing FT container: port 127.0.0.1:8080
- Config: /opt/freqtrade/user_data/config.json

NOT YOUR SCOPE:
- No application code (Agents 1 & 2 handle that)
- No FreqTrade modifications
- No trading logic

Tech: Docker | Docker Compose | Nginx | GitHub Actions | Prometheus | Grafana

Read CLAUDE.md now, then ask what task to work on.
```

---

## How to Run

Each agent runs in its own terminal on the server:

```bash
# Terminal 1 — Orchestrator agent
ssh root@204.168.187.107 -t "cd /opt/freqtrade-ui && claude"
# Paste Agent 1 prompt

# Terminal 2 — Frontend agent
ssh root@204.168.187.107 -t "cd /opt/freqtrade-ui && claude"
# Paste Agent 2 prompt

# Terminal 3 — Infra agent (optional)
ssh root@204.168.187.107 -t "cd /opt/freqtrade-ui && claude"
# Paste Agent 3 prompt
```

## Conflict Prevention

Agents work in separate directories so there are no git merge conflicts:
- Agent 1: only touches `orchestrator/`
- Agent 2: only touches `frontend/`
- Agent 3: only touches root config files (`docker-compose.yml`, `nginx/`, `scripts/`, `.github/`)

Each agent commits to its own branch, then you merge:
```bash
# Agent 1 works on: orchestrator-dev
# Agent 2 works on: frontend-dev
# Agent 3 works on: infra-dev
# You merge into main when ready
```
