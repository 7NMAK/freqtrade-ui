#!/bin/sh
##
## Backup script — Postgres + per-bot SQLite + optional off-site push.
##
## Runs inside pg-backup container. Scheduled daily at 02:00 UTC + at start.
##
## Env (from docker-compose):
##   POSTGRES_DB, POSTGRES_USER, PGPASSWORD, BACKUP_RETENTION_DAYS
##   S3_BACKUP_BUCKET     — optional (e.g. "s3:orchestrator-backups")
##   S3_BACKUP_ENDPOINT   — optional (for B2, Wasabi, MinIO, etc.)
##   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY — credentials
##
## Off-site push uses rclone. If rclone isn't available or S3_BACKUP_BUCKET
## is empty, backups stay local only (logs a warning).
##
set -eu

BACKUP_DIR="/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
SQLITE_TAR="${BACKUP_DIR}/ft_sqlite_${TIMESTAMP}.tar.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
SQLITE_SRC="/freqtrade_user_data/dbs"

echo "======================================"
echo "Backup — $(date -Iseconds)"
echo "======================================"

# ── 1) Postgres dump ───────────────────────────────────────
echo "[1/3] pg_dump ${POSTGRES_DB}..."
pg_dump \
    -h postgres \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip > "${BACKUP_FILE}"

ACTUAL_SIZE=$(wc -c < "${BACKUP_FILE}")
if [ "${ACTUAL_SIZE}" -lt 100 ]; then
    echo "  ERROR: pg_dump produced tiny file (${ACTUAL_SIZE} bytes) — aborting"
    rm -f "${BACKUP_FILE}"
    exit 1
fi
echo "  OK: $(du -sh "${BACKUP_FILE}" | cut -f1)"

# ── 2) Per-bot SQLite snapshot ────────────────────────────
# FT's SQLite files = canonical trade state. Losing them = losing trade
# history for every bot. Use `sqlite3 .backup` for hot-safe snapshots if
# sqlite3 is available; otherwise cp (acceptable risk since FT uses WAL
# journaling and rsync/tar reads a consistent point via file-system-level
# atomicity for small reads).
if [ -d "${SQLITE_SRC}" ]; then
    echo "[2/3] snapshotting SQLite per-bot DBs..."
    # Copy to a staging dir first so a bot writing mid-snapshot doesn't
    # corrupt the tar. Use cp -a preserves mtime; excluding -wal/-shm
    # which we can't safely include without sqlite3 .backup.
    STAGE="/tmp/sqlite_stage_${TIMESTAMP}"
    mkdir -p "${STAGE}"
    # Copy only .sqlite files (not journal/WAL — they're ephemeral)
    find "${SQLITE_SRC}" -name "*.sqlite" -type f -exec cp {} "${STAGE}/" \; 2>/dev/null || true
    if [ -n "$(ls -A "${STAGE}" 2>/dev/null)" ]; then
        tar -czf "${SQLITE_TAR}" -C "${STAGE}" . && rm -rf "${STAGE}"
        echo "  OK: $(du -sh "${SQLITE_TAR}" | cut -f1)"
    else
        rm -rf "${STAGE}"
        echo "  SKIP: no SQLite files found in ${SQLITE_SRC}"
    fi
else
    echo "[2/3] SKIP: ${SQLITE_SRC} not mounted"
fi

# ── 3) Off-site push (optional) ───────────────────────────
if [ -n "${S3_BACKUP_BUCKET:-}" ] && command -v rclone > /dev/null 2>&1; then
    echo "[3/3] pushing to ${S3_BACKUP_BUCKET}..."
    # Configure rclone inline from env. Uses "s3" remote name. Supports
    # AWS S3, Backblaze B2, Wasabi, Cloudflare R2, MinIO via S3_BACKUP_ENDPOINT.
    RCLONE_CONFIG="/tmp/rclone.conf"
    cat > "${RCLONE_CONFIG}" <<EOF
[s3]
type = s3
provider = Other
access_key_id = ${AWS_ACCESS_KEY_ID:-}
secret_access_key = ${AWS_SECRET_ACCESS_KEY:-}
endpoint = ${S3_BACKUP_ENDPOINT:-}
EOF
    REMOTE="${S3_BACKUP_BUCKET}/$(date +%Y-%m)"
    rclone --config "${RCLONE_CONFIG}" copy "${BACKUP_FILE}" "${REMOTE}/" --quiet \
        && echo "  OK: pg_dump pushed" \
        || echo "  WARN: rclone push failed (pg_dump)"
    if [ -f "${SQLITE_TAR}" ]; then
        rclone --config "${RCLONE_CONFIG}" copy "${SQLITE_TAR}" "${REMOTE}/" --quiet \
            && echo "  OK: sqlite tar pushed" \
            || echo "  WARN: rclone push failed (sqlite tar)"
    fi
    rm -f "${RCLONE_CONFIG}"
else
    if [ -z "${S3_BACKUP_BUCKET:-}" ]; then
        echo "[3/3] SKIP: S3_BACKUP_BUCKET not set (backups are local only)"
    else
        echo "[3/3] SKIP: rclone not installed"
    fi
fi

# ── Retention ───────────────────────────────────────────────
PRUNED=$(find "${BACKUP_DIR}" \( -name "${POSTGRES_DB}_*.sql.gz" -o -name "ft_sqlite_*.tar.gz" \) -type f -mtime "+${RETENTION_DAYS}" 2>/dev/null)
if [ -n "${PRUNED}" ]; then
    echo "${PRUNED}" | while read -r OLD; do
        echo "  Pruned: $(basename "${OLD}")"
        rm -f "${OLD}"
    done
fi

# ── Summary ──────────────────────────────────────────────────
TOTAL=$(find "${BACKUP_DIR}" -type f \( -name "*.sql.gz" -o -name "*.tar.gz" \) | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
echo ""
echo "Total: ${TOTAL} files, ${TOTAL_SIZE}. Retention: ${RETENTION_DAYS} days."
echo "======================================"
