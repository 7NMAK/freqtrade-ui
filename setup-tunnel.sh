#!/bin/bash
# FreqTrade Persistent SSH Tunnel — Setup Script
# Run this ONCE on your Mac. After that, tunnel starts automatically on boot.

set -e

echo "================================================"
echo "  FreqTrade Tunnel — Setup"
echo "================================================"
echo ""

# Step 1: Install autossh
echo "[1/4] Installing autossh..."
if command -v autossh &>/dev/null; then
    echo "  Already installed: $(which autossh)"
else
    brew install autossh
    echo "  Done."
fi
echo ""

# Step 2: Check SSH key
echo "[2/4] Checking SSH key..."
if [ -f ~/.ssh/id_ed25519 ]; then
    echo "  Key exists: ~/.ssh/id_ed25519"
elif [ -f ~/.ssh/id_rsa ]; then
    echo "  Key exists: ~/.ssh/id_rsa"
else
    echo "  No SSH key found. Creating one..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
    echo "  Done."
fi

echo "  Copying key to server (enter server password if asked)..."
ssh-copy-id -o StrictHostKeyChecking=no root@204.168.187.107 2>/dev/null || echo "  Key already on server or copy failed — test manually."
echo ""

# Step 3: Detect autossh path (Intel vs Apple Silicon)
echo "[3/4] Installing LaunchAgent..."
AUTOSSH_PATH=$(which autossh)
PLIST_SRC="$(dirname "$0")/com.freqtrade.tunnel.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.freqtrade.tunnel.plist"

# Update path in plist if needed
if [ "$AUTOSSH_PATH" != "/opt/homebrew/bin/autossh" ]; then
    echo "  Detected autossh at: $AUTOSSH_PATH (updating plist)"
    sed "s|/opt/homebrew/bin/autossh|$AUTOSSH_PATH|g" "$PLIST_SRC" > "$PLIST_DST"
else
    cp "$PLIST_SRC" "$PLIST_DST"
fi
echo "  Installed: $PLIST_DST"
echo ""

# Step 4: Activate
echo "[4/4] Activating tunnel..."
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
echo "  Done."
echo ""

sleep 2

# Verify
echo "================================================"
if curl -sf http://localhost:8080/api/v1/ping &>/dev/null; then
    echo "  Tunnel is ACTIVE"
    echo ""
    echo "  ┌──────────────────────────────────────────────┐"
    echo "  │  UI:          http://localhost:8000           │"
    echo "  │  FreqUI:      http://localhost:8080           │"
    echo "  │  Orchestrator: http://localhost:8888          │"
    echo "  └──────────────────────────────────────────────┘"
else
    echo "  Tunnel started but FreqTrade not responding yet."
    echo "  Check logs: cat /tmp/freqtrade-tunnel.log"
    echo "  Check errors: cat /tmp/freqtrade-tunnel.err"
fi
echo ""
echo "  Tunnel will auto-start on every boot."
echo "  To stop:  launchctl unload ~/Library/LaunchAgents/com.freqtrade.tunnel.plist"
echo "  To start: launchctl load ~/Library/LaunchAgents/com.freqtrade.tunnel.plist"
echo "  Logs:     cat /tmp/freqtrade-tunnel.log"
echo "================================================"
