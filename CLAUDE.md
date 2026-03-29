# CLAUDE.md — FreqTrade Trading System

**Project:** Multi-Strategy Perpetual Futures Trading Platform (FreqTrade-based)
**Owner:** Novakus
**Version:** 2.1 (FreqTrade-first, anti-hallucination update)
**Updated:** 2026-03-28

---

## ⛔ STOP — READ THIS FIRST EVERY SESSION

**You are NOT building a custom trading platform.**
**You are building a PRETTIER UI for FreqTrade.**

FreqTrade = the brain. 100% of trading logic. 100% of features.
Our job = make FreqTrade easy for a normal user to use.

**If FreqTrade does it → we show it in our UI (using THEIR parameter names).**
**If FreqTrade doesn't do it → we DON'T add it.**
**The ONLY exceptions are: multi-bot orchestration, kill switch, and unified strategy-bot cards with lifecycle.**

---

## MANDATORY READ ORDER (EVERY SESSION, NO EXCEPTIONS)

Before writing ANY code, building ANY page, making ANY decision:

1. **Read `CLAUDE.md`** (this file) — rules, philosophy, what exists
2. **Read `docs/FT-UI-MAP.html`** — THE BLUEPRINT. Every FT feature → exact page → exact UI element. If a feature isn't in this map, it doesn't go in the UI.
3. **Read `docs/FREQTRADE_REFERENCE.md`** — complete FT documentation (34 sections). This is the ONLY source of truth for what features exist.
4. **Read `docs/STATUS.md`** — what's done, what's next
5. **Read `docs/PAGE_SPECS.md`** — 287 widgets mapped to FT sections
6. **Read `docs/ERROR_HANDLING.md`** — error handling patterns for all pages
7. **Read `docs/TYPES.ts`** — TypeScript interfaces (exact FT field names)
8. **Read `docs/TESTING_PLAN.md`** — test coverage plan
9. **Read `docs/IMPLEMENTATION_PLAN.md`** — phases and current state

**DO NOT read obsolete files:**
- ~~Trading_System_Architecture.docx~~ — old
- ~~Technical_Specification.docx~~ — old
- ~~RULES.md~~ — old
- ~~Master_Specification_v2/v3.docx~~ — superseded

---

## ANTI-HALLUCINATION PROTOCOL

### Before building ANY UI element, ask yourself:

1. **"Which section of FREQTRADE_REFERENCE.md does this come from?"**
   → If you can't point to a specific section number (§1-§34), DON'T BUILD IT.

2. **"What is the exact FT parameter name?"**
   → If you're using a name that's not in the reference, STOP. Look up the correct FT name.

3. **"Which FT API endpoint or CLI command provides this data?"**
   → If there's no API endpoint or CLI command for it, the data DOESN'T EXIST.

4. **"Is this already in FT-UI-MAP.html?"**
   → If it's not mapped, it doesn't get built. Add it to the map first if it's a real FT feature.

### FORBIDDEN actions:
- ❌ Inventing metrics (use FT's: profit_all_coin, close_profit_abs, etc.)
- ❌ Inventing field names (use FT's: open_rate NOT entry_price, close_rate NOT exit_price)
- ❌ Adding features FT doesn't have (no custom analytics, no invented dashboards)
- ❌ Building UI elements without checking FT-UI-MAP.html first
- ❌ Making "improvements" to FT's system (their system works, we just display it)
- ❌ Creating custom calculations from FT data (FT already calculates everything)

### REQUIRED actions:
- ✅ Check FT-UI-MAP.html before building ANY page
- ✅ Use EXACT FT parameter names from FREQTRADE_REFERENCE.md
- ✅ Map every input field to a specific config.json parameter
- ✅ Map every table column to a specific FT trade object field
- ✅ Map every button to a specific FT API endpoint or CLI command
- ✅ Test against FT REST API to verify data exists

---

## CORE PHILOSOPHY

**FreqTrade is the brain. We are the face.**

We make FreqTrade's existing features easier to use. Period.
No custom trading logic. No custom analytics. No custom risk calculations.
FreqTrade already does ALL of this — we just present it better.

**Standing rule:** "samo radi sta ti kazem i nista drugo" — only do what is asked, nothing else.

---

## WHAT IS OUR UI?

Our UI is a **form builder** for FreqTrade's config.json + a **display layer** for FreqTrade's API data.

That's it. Nothing more.

- **Settings page** = form that writes to config.json (§1 parameters)
- **Strategy Builder** = wizard that generates a .py strategy file (§2, §3, §4 callbacks)
- **Backtesting page** = form that runs `freqtrade backtesting` with arguments (§5) and `freqtrade hyperopt` (§6)
- **Dashboard** = displays data from FT REST API (§8 endpoints, §16 trade fields)
  - **RULE:** Dashboard shows ALL bots aggregated by default (portfolio-level stats). No bot selector required for top-level view. Clicking a bot card = drill-down into that single bot's details. Top stats are ALWAYS cross-portfolio.
- **FreqAI page** = form for freqai{} section of config.json (§24, §25, §26)
- **Analytics** = renders FT's plot_config (§19) and orderflow data (§29)
- **Data Management** = form that runs `freqtrade download-data` (§12) and utility commands (§18)
- **Risk page** = displays FT Protections status (§7) + our kill switch

---

## THREE-LAYER ARCHITECTURE

```
┌─────────────────────────────────────────────┐
│  LAYER 3: Frontend (Next.js 14)             │
│  Forms for config.json + display for API    │
├─────────────────────────────────────────────┤
│  LAYER 2: Orchestrator (Python/FastAPI)     │
│  ONLY: multi-bot manager, kill switch,      │
│  heartbeat, cross-bot portfolio aggregation │
├─────────────────────────────────────────────┤
│  LAYER 1: FreqTrade (UNMODIFIED)            │
│  ALL trading logic, ALL features            │
│  1 strategy = 1 FT bot container            │
└─────────────────────────────────────────────┘
```

**Key principle:** 1 strategy = 1 FreqTrade bot (Docker container). Orchestrator manages N bots via FT REST API.

### CUSTOM FEATURE: Unified Strategy-Bot Cards (approved deviation from FT)

FT treats strategies (.py files) and bots (processes) as separate concepts. We intentionally merge them into **one unified card** on the Strategies page because:
- 1 bot always runs 1 strategy with 1 config — they are always 1:1
- Even the same .py used on different pairs = different bot = different card
- Users need to see everything in one place: code + config + backtest results + hyperopt + trades + stats

**Strategies page** = the master list. Each card shows:
- Strategy name, description, pairs, timeframe, leverage
- Lifecycle status: DRAFT → BACKTEST → PAPER → LIVE → RETIRED
- Stats: total profit, win rate, max DD, trade count (from FT data, not invented)
- Actions based on status: Edit in Builder, Run Backtest, Start Paper, Go Live, View Bot, Clone, Export .py
- Drill-down on click: all backtests, all hyperopt runs, all trades, AI suggestions, config, full stats

**Dashboard** = monitoring only. Shows portfolio-level aggregation of all LIVE/PAPER bots. No strategy management.

**Lifecycle** (our custom metadata, stored in Orchestrator DB):
- DRAFT = .py exists, not tested yet → actions: Edit in Builder, Run Backtest
- BACKTEST = has backtest results → actions: View Results, Re-run, Edit, Start Paper
- PAPER = bot running with dry_run:true → actions: View Trades, Stats, Go Live
- LIVE = bot running with dry_run:false → actions: View Trades, Stats, Edit, Analytics
- RETIRED = bot stopped, kept for history → actions: View History, Clone, Export .py

This is documented as a custom feature alongside multi-bot orchestration and kill switch.

---

## FT-UI-MAP.html — THE BLUEPRINT

This file maps ALL 34 sections of FREQTRADE_REFERENCE.md to specific UI pages and elements.

**30 active sections → 8 pages:**
- **Builder:** §2 (Strategy Interface), §3 (19 Callbacks), §4 (6 Stoploss types), §7p (4 Protections), §10 (Leverage/Futures), §14 (Advanced Strategy)
- **Backtesting:** §5 (Backtesting CLI), §6 (Hyperopt + 12 loss functions + 6 samplers), §15 (Advanced Hyperopt), §21 (Lookahead Analysis), §22 (Recursive Analysis), §30 (Advanced Analysis groups 0-5)
- **Settings:** §1 (100+ config params), §7 (7 Pairlist handlers + 11 filters), §9 (Exchanges), §11 (Telegram), §13 (Webhook), §17 (Producer/Consumer), §28 (Multi-instance + logging)
- **FreqAI:** §24 (Core ML config), §25 (Reinforcement Learning), §26 (Feature processing + outlier detection)
- **Dashboard:** §8 (40+ REST API endpoints = data source), §16 (Trade object fields = table columns)
- **Analytics:** §19 (Plotting + plot_config), §20 (Jupyter/Data Analysis), §29 (Orderflow)
- **Data Mgmt:** §12 (download-data), §18 (Utility subcommands)
- **Risk:** §7p (Protections display) + Kill Switch (our only custom addition)

**4 skipped:** §23 (SQL internals), §31 (FreqUI — we replace it), §33 (Deprecated), §34 (V2→V3 migration)

---

## SERVER STATE

- **Server:** 204.168.187.107 (SSH as root)
- **FreqTrade:** 2026.2, Docker image `freqtradeorg/freqtrade:stable_freqai`
- **Container:** `freqtrade`, port 127.0.0.1:8080
- **FreqUI credentials:** novakus / ***REMOVED***
- **SSH tunnel:** `ssh -L 8080:127.0.0.1:8080 root@204.168.187.107`
- **Config:** dry_run: true, trading_mode: futures, margin_mode: isolated, exchange: binance
- **Data:** BTC/USDT futures (1h + daily from 2022-01-01)

### Docker Compose (`/opt/freqtrade/docker-compose.yml`)
```yaml
services:
  freqtrade:
    image: freqtradeorg/freqtrade:stable_freqai
    restart: unless-stopped
    container_name: freqtrade
    volumes:
      - "./user_data:/freqtrade/user_data"
    ports:
      - "127.0.0.1:8080:8080"
    command: >
      trade
      --logfile /freqtrade/user_data/logs/freqtrade.log
      --db-url sqlite:////freqtrade/user_data/tradesv3.sqlite
      --config /freqtrade/user_data/config.json
      --strategy SampleStrategy
```

### Installed Packages (in FT container)
- LightGBM 4.6.0, XGBoost 3.2.0, scikit-learn 1.8.0
- technical 1.5.4, ft-pandas-ta 0.3.16, ta 0.11.0

### Installed on Host
- ftui v0.1.13

### Content on Server
- 26 strategy files in /opt/freqtrade/user_data/strategies/
- 2 analysis notebooks in /opt/freqtrade/user_data/notebooks/

---

## FREQTRADE FIELD NAMES (ALWAYS USE THESE)

| Correct (FT) | NEVER use |
|--------------|-----------|
| open_rate | ~~entry_price~~ |
| close_rate | ~~exit_price~~ |
| close_profit_abs | ~~net_pnl~~ |
| fee_open | ~~entry_fee~~ |
| fee_close | ~~exit_fee~~ |
| stake_amount | ~~position_size~~ |
| open_date | ~~entry_time~~ |
| close_date | ~~exit_time~~ |
| is_open | ~~status~~ |
| trade_id | ~~custom id~~ |
| enter_tag | ~~entry_signal~~ |
| exit_reason | ~~exit_signal~~ |
| current_profit | ~~unrealized_pnl~~ |
| is_short | ~~direction~~ |

---

## WHAT WE BUILD (ONLY these things)

### Orchestrator (our code — Python/FastAPI)
These are the ONLY custom features we build. Everything else comes from FT:

1. **Multi-Bot Manager** — start/stop/configure N FT bot Docker containers
2. **Kill Switch** — Soft Kill (POST /api/v1/stop) + Hard Kill (POST /api/v1/forceexit + stop all)
3. **Heartbeat Monitor** — GET /api/v1/ping every 3s, 3 failures = HARD KILL
4. **Cross-Bot Portfolio Aggregation** — aggregate GET /api/v1/balance from all bots
5. **Strategy Lifecycle** — DRAFT → BACKTEST → PAPER → LIVE → RETIRED (metadata only)

### Orchestrator DB (PostgreSQL — ONLY cross-bot metadata)
- `bot_instances` — container mapping, status, health
- `strategies` — lifecycle state metadata (FT has the actual strategy code)
- `risk_events` — kill switch activations
- `audit_log` — immutable action log

**Trade data is NEVER duplicated.** Always read from FT API.

### Frontend (Next.js 14)
8 pages + login. Each page = display for FT API data + forms for FT config.

---

## IMPLEMENTATION PHASES

### Phase 1: FreqTrade Works Perfectly
- T1: Docker Compose + PostgreSQL + Redis + FT base config
- T2: Configure first FT bot, test via FreqUI

### Phase 2: Multi-Bot Orchestration
- T3: Multi-Bot Manager
- T4: Heartbeat + Kill Switch
- T5: Portfolio Aggregator

### Phase 3: Frontend
- T6: Next.js 14 project + auth + layout
- T7: All 8 pages (every element traced to FT-UI-MAP.html)

### Phase 4: Extras (ONLY after Phases 1-3)
- T8: AI Strategy Analyst (OpenRouter)

---

## SAFETY RULES (NON-NEGOTIABLE)

1. FreqTrade is the brain — NEVER bypass or duplicate
2. Trade data NEVER duplicated — always from FT API
3. Kill Switch always works — every page header
4. Heartbeat every 3s — 3 failures = HARD KILL
5. Exit orders ALWAYS MARKET
6. Recovery MANUAL ONLY
7. Database never deletes — soft-delete only
8. Backtesting mandatory before PAPER/LIVE
9. Audit log immutable
10. No custom features until ALL FT features displayed
11. Per-bot risk = FT Protections (not our code)
12. Orchestrator DB = cross-bot metadata ONLY
13. Wallet = trade-only permission, no withdrawal code

---

## TECH STACK

| Component | Technology |
|-----------|-----------|
| Trading Engine | FreqTrade 2026.2 (stable_freqai) |
| ML/AI | FreqAI (LightGBM, XGBoost, PyTorch, RL) |
| Orchestrator | Python 3.11+ / FastAPI |
| Database | PostgreSQL 16 (Orchestrator only) |
| Cache/Pub-Sub | Redis 7 |
| Frontend | Next.js 14 / React 18 / TailwindCSS |
| Charts | Recharts + D3 |
| Containerization | Docker + Docker Compose |
| Notifications | python-telegram-bot |
| Monitoring | Prometheus + Grafana |
| Terminal UI | ftui |

---

## DEVELOPMENT WORKFLOW

**Local development → Server testing.**

- Code lives locally and on GitHub (`7NMAK/freqtrade-ui`)
- Server (`204.168.187.107`) has the repo at `/opt/freqtrade-ui`
- FreqTrade runs on the server (Docker, port 8080)

**Deploy to server:**
```bash
./deploy.sh "commit message"
```
This script: `git push` → SSH pull on server → restart orchestrator.

**Test on server via SSH:**
```bash
ssh root@204.168.187.107 "cd /opt/freqtrade-ui && docker compose up -d"
ssh root@204.168.187.107 "curl localhost:8888/api/health"
```

**Run tests remotely:**
```bash
ssh root@204.168.187.107 "cd /opt/freqtrade-ui && docker compose exec orchestrator pytest"
```

---

## REFERENCE FILES

| File | Purpose | Read When |
|------|---------|-----------|
| `CLAUDE.md` | Rules, philosophy, state | Every session start |
| `docs/FT-UI-MAP.html` | Feature → page mapping | Before building ANY page |
| `docs/FREQTRADE_REFERENCE.md` | All FT features (34 sections) | When checking if feature exists |
| `docs/STATUS.md` | Task progress | To know what's done/next |
| `docs/PAGE_SPECS.md` | 287 widgets → FT sections | Before building ANY widget |
| `docs/ERROR_HANDLING.md` | Error handling patterns | When implementing error flows |
| `docs/TYPES.ts` | TypeScript interfaces | When writing frontend code |
| `docs/TESTING_PLAN.md` | Test coverage plan | When writing tests |
| `docs/IMPLEMENTATION_PLAN.md` | Phases and current state | When planning work |
