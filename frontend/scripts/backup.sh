#!/bin/sh
##
## PostgreSQL Backup Script
##
## Runs inside the pg-backup container (postgres:16-alpine).
## Scheduled via cron (daily at 02:00 UTC) + runs once at container start.
##
## Environment variables (from docker-compose):
##   POSTGRES_DB             — database name
##   POSTGRES_USER           — database user
##   PGPASSWORD              — database password (pg_dump uses this automatically)
##   BACKUP_RETENTION_DAYS   — how many days to keep backups
##
set -eu

BACKUP_DIR="/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

echo "======================================"
echo "PostgreSQL Backup — $(date -Iseconds)"
echo "======================================"
echo "Database: ${POSTGRES_DB}"
echo "User:     ${POSTGRES_USER}"
echo "Target:   ${BACKUP_FILE}"

# ── Create backup ──────────────────────────────────────────
pg_dump \
    -h postgres \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "OK: Backup created (${BACKUP_SIZE})"

# ── Verify backup is not empty ─────────────────────────────
MIN_SIZE=100  # bytes — a valid dump is at least a few hundred bytes
ACTUAL_SIZE=$(wc -c < "${BACKUP_FILE}")
if [ "${ACTUAL_SIZE}" -lt "${MIN_SIZE}" ]; then
    echo "ERROR: Backup file too small (${ACTUAL_SIZE} bytes) — likely failed"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# ── Prune old backups ──────────────────────────────────────
PRUNED_LIST=$(find "${BACKUP_DIR}" -name "${POSTGRES_DB}_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" 2>/dev/null)
if [ -n "${PRUNED_LIST}" ]; then
    echo "${PRUNED_LIST}" | while read -r OLD_FILE; do
        echo "  Pruned: $(basename "${OLD_FILE}")"
        rm -f "${OLD_FILE}"
    done
fi

# ── Summary ────────────────────────────────────────────────
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "${POSTGRES_DB}_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
echo ""
echo "Summary:"
echo "  Backups on disk: ${TOTAL_BACKUPS}"
echo "  Total size:      ${TOTAL_SIZE}"
echo "  Retention:       ${RETENTION_DAYS} days"
echo "  Next backup:     02:00 UTC tomorrow"
echo "======================================"
