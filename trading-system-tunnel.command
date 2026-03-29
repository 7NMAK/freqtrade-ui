#!/bin/bash
# FreqTrade Trading System — Full SSH Tunnel
# Double-click to connect. All services via localhost only.
#
# Tunnels:
#   :8000 → Nginx (UI + API + Grafana + Prometheus)
#   :8080 → FreqUI (direct FreqTrade)
#   :8888 → Orchestrator API (direct, bypass nginx)

clear
echo "================================================"
echo "  FreqTrade Trading System — Connecting..."
echo "================================================"
echo ""

# Kill any existing tunnels on these ports
for PORT in 8000 8080 8888; do
    lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
done

ssh -N \
    -L 8000:127.0.0.1:80 \
    -L 8080:127.0.0.1:8080 \
    -L 8888:127.0.0.1:8888 \
    root@204.168.187.107 &
SSH_PID=$!

sleep 2

if kill -0 $SSH_PID 2>/dev/null; then
    echo "  Connected!"
    echo ""
    echo "  ┌──────────────────────────────────────────────┐"
    echo "  │  UI:          http://localhost:8000           │"
    echo "  │  FreqUI:      http://localhost:8080           │"
    echo "  │  API:         http://localhost:8000/api/health │"
    echo "  │  Grafana:     http://localhost:8000/grafana/   │"
    echo "  │  Prometheus:  http://localhost:8000/prometheus/ │"
    echo "  ├──────────────────────────────────────────────┤"
    echo "  │  UI Login:    admin / ***REMOVED***          │"
    echo "  │  FreqUI:      novakus / ***REMOVED***        │"
    echo "  └──────────────────────────────────────────────┘"
    echo ""
    echo "  Press Ctrl+C to disconnect."
    echo "================================================"
    open http://localhost:8000
    wait $SSH_PID
else
    echo "  Connection failed. Check your SSH key."
    echo "================================================"
    read -p "Press Enter to close..."
fi
