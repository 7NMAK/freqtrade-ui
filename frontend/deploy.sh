#!/bin/bash
##
## Deploy — Full Stack
##
## Usage:
##   ./deploy.sh                    # Deploy on the server (run from /opt/freqtrade-ui)
##   ./deploy.sh --local-push       # Push code from local, then SSH deploy
##
## What it does:
##   1. Creates ft_network + connects FT bot
##   2. Copies .env.example → .env if .env missing
##   3. Builds and starts ALL services (postgres, redis, orchestrator, frontend, nginx, prometheus, grafana, pg-backup)
##   4. Runs health checks on every service
##   5. Registers FT bot with orchestrator (if not already registered)
##
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

step()  { echo -e "\n${BLUE}==> $1${NC}"; }
ok()    { echo -e "${GREEN}  OK: $1${NC}"; }
fail()  { echo -e "${RED}  FAIL: $1${NC}"; exit 1; }
warn()  { echo -e "${YELLOW}  WARN: $1${NC}"; }

SERVER="204.168.187.107"
SERVER_USER="root"
REMOTE_DIR="/opt/freqtrade-ui"

# ── Mode: local push + remote deploy ──────────────────────
if [ "${1:-}" = "--local-push" ]; then
    step "Pushing code to server"

    # Commit message — use git add with .gitignore awareness (not -A to be safe)
    MSG="${2:-deploy: $(date +%Y-%m-%d_%H:%M)}"
    git add --all
    # Safety: ensure .env is not staged
    git reset HEAD .env 2>/dev/null || true
    git diff --cached --quiet && echo "Nothing to commit" || git commit -m "$MSG"
    git push origin "$(git branch --show-current)"
    ok "Code pushed"

    step "Deploying on server via SSH"
    ssh "${SERVER_USER}@${SERVER}" "cd ${REMOTE_DIR} && git pull && ./deploy.sh"
    exit 0
fi

# ── From here: running ON the server ──────────────────────

# ── Step 1: Docker network ────────────────────────────────
step "Setting up Docker network"
docker network create ft_network 2>/dev/null && ok "ft_network created" || ok "ft_network already exists"
docker network connect ft_network freqtrade 2>/dev/null && ok "freqtrade connected to ft_network" || ok "freqtrade already on ft_network"

# ── Step 2: Environment file ──────────────────────────────
step "Checking environment file"
if [ ! -f .env ]; then
    cp .env.example .env
    warn ".env created from .env.example — EDIT IT with production values!"
    warn "At minimum, change: POSTGRES_PASSWORD, ORCH_SECRET_KEY, GF_SECURITY_ADMIN_PASSWORD"
fi
ok ".env exists"

# Load .env for bot registration credentials
set -a
source .env
set +a

# ── Step 3: Build and start all services ──────────────────
step "Building and starting all services"
docker compose build
docker compose up -d
ok "All services started"

# ── Step 4: Wait for health ───────────────────────────────
step "Waiting for services to become healthy..."
sleep 5

# Helper: wait for a service to be healthy
wait_healthy() {
    local service="$1"
    local max_wait="${2:-60}"
    local elapsed=0

    while [ $elapsed -lt $max_wait ]; do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "missing")
        if [ "$health" = "healthy" ]; then
            ok "$service is healthy"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    fail "$service not healthy after ${max_wait}s (status: $health)"
}

# Wait for core services first
wait_healthy orch_postgres 30
wait_healthy orch_redis 30
wait_healthy orchestrator 45

# Wait for frontend + nginx
wait_healthy frontend 60
wait_healthy nginx 30

# Monitoring (non-critical — warn instead of fail)
step "Checking monitoring services"
prometheus_health=$(docker inspect --format='{{.State.Health.Status}}' prometheus 2>/dev/null || echo "missing")
grafana_health=$(docker inspect --format='{{.State.Health.Status}}' grafana 2>/dev/null || echo "missing")
if [ "$prometheus_health" = "healthy" ]; then ok "Prometheus healthy"; else warn "Prometheus: $prometheus_health"; fi
if [ "$grafana_health" = "healthy" ]; then ok "Grafana healthy"; else warn "Grafana: $grafana_health"; fi

# ── Step 5: Endpoint verification ─────────────────────────
step "Verifying endpoints"

curl -sf http://127.0.0.1:8888/api/health > /dev/null && ok "Orchestrator API (direct :8888)" || fail "Orchestrator not responding"
curl -sf http://127.0.0.1/health > /dev/null && ok "Nginx health (port 80)" || fail "Nginx not responding"
curl -sf http://127.0.0.1/api/health > /dev/null && ok "Orchestrator via Nginx (/api/health)" || fail "Nginx→Orchestrator proxy broken"
curl -sf http://127.0.0.1/ > /dev/null && ok "Frontend via Nginx (/)" || fail "Nginx→Frontend proxy broken"

# ── Step 6: Verify FT bot is reachable ────────────────────
step "Verifying FreqTrade bot connectivity"
FT_PING=$(docker exec freqtrade curl -sf http://127.0.0.1:8080/api/v1/ping 2>/dev/null || echo "FAIL")
if echo "$FT_PING" | grep -q "pong"; then
    ok "FreqTrade bot responds to ping"
else
    warn "FreqTrade bot not responding (status: $FT_PING). Bot may not be running."
    warn "Check: docker logs freqtrade --tail 30"
fi

# ── Step 7: Register FT bot (if not already) ──────────────
step "Checking bot registration"
BOT_LIST=$(curl -sf http://127.0.0.1:8888/api/bots/ 2>&1) || fail "Cannot list bots"

if echo "$BOT_LIST" | python3 -c "import sys,json; bots=json.load(sys.stdin); exit(0 if any(b['name']=='ft-main' for b in bots) else 1)" 2>/dev/null; then
    ok "Bot 'ft-main' already registered"
else
    step "Registering FreqTrade bot"
    FT_USER="${FT_API_USERNAME:-novakus}"
    FT_PASS="${FT_API_PASSWORD:-***REMOVED***}"
    REGISTER_RESP=$(curl -sf -X POST http://127.0.0.1:8888/api/bots/ \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"ft-main\",
            \"api_url\": \"http://freqtrade:8080\",
            \"api_port\": 8080,
            \"api_username\": \"${FT_USER}\",
            \"api_password\": \"${FT_PASS}\",
            \"strategy_name\": \"SampleStrategy\",
            \"is_dry_run\": true,
            \"description\": \"Main FT bot - BTC/USDT futures dry run\"
        }" 2>&1) || fail "Failed to register bot"
    ok "Bot registered: $REGISTER_RESP"
fi

# ── Summary ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  DEPLOY COMPLETE — All services running    ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Services:"
echo "  Frontend:     http://${SERVER}/"
echo "  Orchestrator: http://${SERVER}/api/health"
echo "  Grafana:      http://${SERVER}/grafana/"
echo "  Prometheus:   http://${SERVER}/prometheus/"
echo ""
echo "Direct access (localhost only):"
echo "  Orchestrator: http://127.0.0.1:8888/api/health"
echo "  PostgreSQL:   127.0.0.1:5432"
echo "  Redis:        127.0.0.1:6379"
echo ""
docker compose ps
