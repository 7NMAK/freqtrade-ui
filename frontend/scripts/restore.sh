#!/bin/bash
##
## PostgreSQL Restore Script
##
## Usage (run from project root):
##   ./scripts/restore.sh                      # Restore latest backup
##   ./scripts/restore.sh orchestrator_20260328_020000.sql.gz  # Restore specific
##
## WARNING: This DROPS and recreates the database.
##
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${BLUE}==> $1${NC}"; }
ok()   { echo -e "${GREEN}  OK: $1${NC}"; }
fail() { echo -e "${RED}  FAIL: $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}  WARN: $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

DB_NAME="${POSTGRES_DB:-orchestrator}"
DB_USER="${POSTGRES_USER:-orchestrator}"

# ── Find backup file ──────────────────────────────────────
if [ -n "${1:-}" ]; then
    BACKUP_NAME="$1"
else
    step "Finding latest backup..."
    BACKUP_NAME=$(docker compose exec pg-backup sh -c "ls -t /backups/${DB_NAME}_*.sql.gz 2>/dev/null | head -1 | xargs basename" 2>/dev/null) || fail "No backups found"
    if [ -z "$BACKUP_NAME" ]; then
        fail "No backups found in pg-backup container"
    fi
    ok "Latest backup: $BACKUP_NAME"
fi

# ── Confirm ────────────────────────────────────────────────
echo ""
warn "This will DROP and recreate database '$DB_NAME'."
warn "All current data will be replaced with the backup."
echo ""
read -p "Type 'RESTORE' to confirm: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
    echo "Aborted."
    exit 0
fi

# ── Stop orchestrator (prevent writes during restore) ──────
step "Stopping orchestrator..."
docker compose stop orchestrator
ok "Orchestrator stopped"

# ── Restore ────────────────────────────────────────────────
step "Restoring from: $BACKUP_NAME"

docker compose exec -T postgres sh -c "
    dropdb -U $DB_USER --if-exists $DB_NAME
    createdb -U $DB_USER $DB_NAME
" || fail "Failed to recreate database"

docker compose exec -T pg-backup sh -c "
    gunzip -c /backups/$BACKUP_NAME | psql -h postgres -U $DB_USER -d $DB_NAME
" || fail "Failed to restore backup"

ok "Database restored from $BACKUP_NAME"

# ── Restart orchestrator ───────────────────────────────────
step "Restarting orchestrator..."
docker compose start orchestrator
ok "Orchestrator restarted"

echo ""
echo -e "${GREEN}Restore complete.${NC}"
echo "Verify: curl http://localhost:8888/api/health"
