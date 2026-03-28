#!/bin/bash
##
## SSL Certificate Setup
##
## Usage:
##   ./scripts/ssl-setup.sh self-signed          # Generate self-signed cert
##   ./scripts/ssl-setup.sh letsencrypt           # Get Let's Encrypt cert
##   ./scripts/ssl-setup.sh letsencrypt --staging  # Test with LE staging
##
## After running, uncomment the HTTPS server block in nginx/conf.d/default.conf
## and uncomment the HTTP→HTTPS redirect.
##
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_DIR/nginx/ssl"

# Load .env if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

DOMAIN="${DOMAIN:-localhost}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@example.com}"

# Docker Compose prefixes volume names with project name
COMPOSE_PROJECT=$(cd "$PROJECT_DIR" && docker compose config --format json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','freqtrade-ui'))" 2>/dev/null || basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
VOL_CERTS="${COMPOSE_PROJECT}_certbot_certs"
VOL_WEBROOT="${COMPOSE_PROJECT}_certbot_webroot"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${BLUE}==> $1${NC}"; }
ok()   { echo -e "${GREEN}  OK: $1${NC}"; }
fail() { echo -e "${RED}  FAIL: $1${NC}"; exit 1; }

# ── Self-signed certificate ────────────────────────────────
generate_self_signed() {
    step "Generating self-signed certificate for: $DOMAIN"
    mkdir -p "$SSL_DIR"

    # Detect if DOMAIN is an IP address or a hostname
    if echo "$DOMAIN" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
        SAN_TYPE="IP"
    else
        SAN_TYPE="DNS"
    fi

    openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=FreqTradeUI/CN=$DOMAIN" \
        -addext "subjectAltName=${SAN_TYPE}:$DOMAIN" \
        2>/dev/null

    chmod 600 "$SSL_DIR/privkey.pem"
    chmod 644 "$SSL_DIR/fullchain.pem"

    ok "Self-signed certificate generated"
    echo "  Key:  $SSL_DIR/privkey.pem"
    echo "  Cert: $SSL_DIR/fullchain.pem"
    echo ""
    echo "Next steps:"
    echo "  1. Uncomment HTTPS server block in nginx/conf.d/default.conf"
    echo "  2. Uncomment 'return 301 https://...' in HTTP block"
    echo "  3. Run: docker compose restart nginx"
}

# ── Let's Encrypt certificate ──────────────────────────────
generate_letsencrypt() {
    local STAGING_FLAG=""
    if [ "${1:-}" = "--staging" ]; then
        STAGING_FLAG="--staging"
        step "Requesting Let's Encrypt STAGING certificate for: $DOMAIN"
    else
        step "Requesting Let's Encrypt PRODUCTION certificate for: $DOMAIN"
    fi

    # Ensure nginx is running (for ACME challenge)
    if ! docker compose ps nginx | grep -q "running"; then
        fail "Nginx must be running for Let's Encrypt. Run: docker compose up -d nginx"
    fi

    # Run certbot in a temporary container
    docker run --rm \
        -v "${VOL_CERTS}":/etc/letsencrypt \
        -v "${VOL_WEBROOT}":/var/www/certbot \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        $STAGING_FLAG

    # Copy certs to nginx ssl dir for the commented HTTPS block
    mkdir -p "$SSL_DIR"
    docker run --rm \
        -v "${VOL_CERTS}":/etc/letsencrypt:ro \
        -v "$SSL_DIR:/output" \
        alpine sh -c "
            cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /output/fullchain.pem
            cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /output/privkey.pem
            chmod 644 /output/fullchain.pem
            chmod 600 /output/privkey.pem
        "

    ok "Let's Encrypt certificate obtained"
    echo ""
    echo "Next steps:"
    echo "  1. Uncomment HTTPS server block in nginx/conf.d/default.conf"
    echo "  2. Uncomment 'return 301 https://...' in HTTP block"
    echo "  3. Run: docker compose restart nginx"
    echo ""
    echo "Auto-renewal: Add to crontab:"
    echo "  0 3 * * * cd $PROJECT_DIR && docker run --rm -v "${VOL_CERTS}":/etc/letsencrypt -v "${VOL_WEBROOT}":/var/www/certbot certbot/certbot renew --quiet && docker compose restart nginx"
}

# ── Main ───────────────────────────────────────────────────
case "${1:-}" in
    self-signed)
        generate_self_signed
        ;;
    letsencrypt)
        generate_letsencrypt "${2:-}"
        ;;
    *)
        echo "Usage: $0 {self-signed|letsencrypt [--staging]}"
        echo ""
        echo "  self-signed        Generate self-signed certificate (for testing/IP)"
        echo "  letsencrypt        Get Let's Encrypt certificate (requires domain)"
        echo "  letsencrypt --staging  Test with Let's Encrypt staging server"
        exit 1
        ;;
esac
