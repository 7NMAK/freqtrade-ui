#!/bin/bash
##
## Deploy & Test Orchestrator
##
## Run on the server (204.168.187.107) from the freqtrade-ui directory.
##
## Prerequisites:
##   - Docker + Docker Compose installed
##   - FreqTrade bot running in container "freqtrade" on port 8080
##
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${BLUE}==> $1${NC}"; }
ok()   { echo -e "${GREEN}  OK: $1${NC}"; }
fail() { echo -e "${RED}  FAIL: $1${NC}"; exit 1; }

# ── Step 1: Create shared Docker network ──────────────────────
step "Creating ft_network (if not exists)"
docker network create ft_network 2>/dev/null && ok "ft_network created" || ok "ft_network already exists"

# ── Step 2: Connect existing FT bot to ft_network ────────────
step "Connecting freqtrade container to ft_network"
docker network connect ft_network freqtrade 2>/dev/null && ok "freqtrade connected to ft_network" || ok "freqtrade already on ft_network"

# ── Step 3: Build and start orchestrator stack ────────────────
step "Building and starting orchestrator stack (postgres + redis + orchestrator)"
docker compose up -d --build
ok "Docker Compose up"

# Wait for services to be healthy
step "Waiting for services to be healthy..."
sleep 5

# Check postgres
docker compose exec postgres pg_isready -U orchestrator > /dev/null 2>&1 && ok "PostgreSQL healthy" || fail "PostgreSQL not healthy"

# Check redis
docker compose exec redis redis-cli ping > /dev/null 2>&1 && ok "Redis healthy" || fail "Redis not healthy"

# Check orchestrator is running
sleep 3
docker compose logs orchestrator --tail=20

# ── Step 4: Test orchestrator health endpoint ─────────────────
step "Testing orchestrator health endpoint"
HEALTH=$(curl -sf http://127.0.0.1:8888/api/health 2>&1) || fail "Orchestrator not responding on port 8888"
echo "  Response: $HEALTH"
echo "$HEALTH" | grep -q '"status":"ok"' && ok "Health endpoint works" || fail "Unexpected health response"

# ── Step 5: Register existing FT bot ─────────────────────────
step "Registering existing FreqTrade bot with orchestrator"
REGISTER_RESP=$(curl -sf -X POST http://127.0.0.1:8888/api/bots/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ft-main",
    "api_url": "http://freqtrade:8080",
    "api_port": 8080,
    "api_username": "novakus",
    "api_password": "***REMOVED***",
    "strategy_name": "SampleStrategy",
    "is_dry_run": true,
    "description": "Main FT bot - BTC/USDT futures dry run"
  }' 2>&1) || fail "Failed to register bot"
echo "  Response: $REGISTER_RESP"
BOT_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null) || fail "Could not extract bot_id"
ok "Bot registered with id=$BOT_ID"

# ── Step 6: Test bot listing ─────────────────────────────────
step "Testing bot listing"
LIST_RESP=$(curl -sf http://127.0.0.1:8888/api/bots/ 2>&1) || fail "Bot listing failed"
echo "  Response: $LIST_RESP"
ok "Bot listing works"

# ── Step 7: Test FT API passthrough (ping via status) ────────
step "Testing FT API passthrough: GET /api/bots/$BOT_ID/config"
CONFIG_RESP=$(curl -sf "http://127.0.0.1:8888/api/bots/$BOT_ID/config" 2>&1) || fail "FT API passthrough failed — is freqtrade on ft_network?"
echo "  Response (first 200 chars): ${CONFIG_RESP:0:200}"
ok "FT API passthrough works"

# ── Step 8: Test bot start (POST /api/v1/start via orchestrator) ──
step "Testing bot start via orchestrator"
START_RESP=$(curl -sf -X POST "http://127.0.0.1:8888/api/bots/$BOT_ID/start" 2>&1) || echo "  Note: start may fail if already running — that's OK"
echo "  Response: $START_RESP"
ok "Bot start endpoint called"

# ── Step 9: Test bot status (open trades from FT) ────────────
step "Testing FT API passthrough: GET /api/bots/$BOT_ID/status (open trades)"
STATUS_RESP=$(curl -sf "http://127.0.0.1:8888/api/bots/$BOT_ID/status" 2>&1) || fail "Status passthrough failed"
echo "  Response: $STATUS_RESP"
ok "Status passthrough works"

# ── Step 10: Test portfolio aggregation ───────────────────────
step "Testing portfolio endpoints"
BALANCE_RESP=$(curl -sf "http://127.0.0.1:8888/api/portfolio/balance" 2>&1) || fail "Portfolio balance failed"
echo "  Balance: $BALANCE_RESP"
ok "Portfolio balance works"

PROFIT_RESP=$(curl -sf "http://127.0.0.1:8888/api/portfolio/profit" 2>&1) || fail "Portfolio profit failed"
echo "  Profit: ${PROFIT_RESP:0:200}"
ok "Portfolio profit works"

# ── Step 11: Test kill switch (soft kill) ─────────────────────
step "Testing kill switch: soft kill"
SOFT_RESP=$(curl -sf -X POST "http://127.0.0.1:8888/api/kill-switch/soft/$BOT_ID" \
  -H "Content-Type: application/json" \
  -d '{"reason": "deploy test — soft kill verification"}' 2>&1) || fail "Soft kill failed"
echo "  Response: $SOFT_RESP"
ok "Soft kill works"

# ── Step 12: Test risk events ─────────────────────────────────
step "Testing risk events log"
EVENTS_RESP=$(curl -sf "http://127.0.0.1:8888/api/kill-switch/events" 2>&1) || fail "Risk events failed"
echo "  Response: $EVENTS_RESP"
ok "Risk events endpoint works"

# ── Step 13: Test strategy lifecycle ──────────────────────────
step "Testing strategy lifecycle: create"
STRAT_RESP=$(curl -sf -X POST http://127.0.0.1:8888/api/strategies/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SampleStrategy",
    "description": "Default FT sample strategy",
    "bot_instance_id": '"$BOT_ID"'
  }' 2>&1) || fail "Strategy create failed"
echo "  Response: $STRAT_RESP"
STRAT_ID=$(echo "$STRAT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null) || fail "Could not extract strategy_id"
ok "Strategy created with id=$STRAT_ID"

step "Testing strategy lifecycle: promote DRAFT -> BACKTEST"
PROMOTE_RESP=$(curl -sf -X PATCH "http://127.0.0.1:8888/api/strategies/$STRAT_ID" \
  -H "Content-Type: application/json" \
  -d '{"lifecycle": "backtest"}' 2>&1) || fail "Strategy promote failed"
echo "  Response: $PROMOTE_RESP"
ok "Strategy promoted to BACKTEST"

# ── Step 14: Verify heartbeat is running ──────────────────────
step "Checking heartbeat monitor in logs"
docker compose logs orchestrator --tail=30 2>&1 | grep -i "heartbeat\|ping" || echo "  (heartbeat may not have logged yet if no RUNNING bots)"
ok "Heartbeat check done"

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ALL TESTS PASSED - Orchestrator deployed  ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Orchestrator API: http://127.0.0.1:8888"
echo "  - Health:     GET  /api/health"
echo "  - Bots:       GET  /api/bots/"
echo "  - Portfolio:  GET  /api/portfolio/balance"
echo "  - Kill:       POST /api/kill-switch/soft/{id}"
echo "  - Strategies: GET  /api/strategies/"
echo "  - Events:     GET  /api/kill-switch/events"
echo ""
echo "FT bot registered as: ft-main (id=$BOT_ID)"
echo "FT bot reachable at: http://freqtrade:8080 (via ft_network)"
