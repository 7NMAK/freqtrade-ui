#!/bin/bash
##
## Deploy to server: push to GitHub → pull on server → restart orchestrator
## Usage: ./deploy.sh "commit message"
##

set -e

MSG="${1:-auto deploy}"
SERVER="root@204.168.187.107"
REMOTE_DIR="/opt/freqtrade-ui"

echo "=== 1. Commit & Push ==="
git add -A
git diff --cached --quiet && echo "Nothing to commit" || git commit -m "$MSG"
git push origin main

echo ""
echo "=== 2. Pull on server ==="
ssh $SERVER "cd $REMOTE_DIR && git pull origin main"

echo ""
echo "=== 3. Restart orchestrator (if running) ==="
ssh $SERVER "cd $REMOTE_DIR && docker compose restart orchestrator 2>/dev/null || echo 'Orchestrator not running yet — skip restart'"

echo ""
echo "=== Done ==="
echo "Server synced: $SERVER:$REMOTE_DIR"
