#!/bin/bash
# FreqTrade SSH Tunnel
# Double-click this file to open tunnel, then access:
#   FreqUI:  http://localhost:8080

echo "================================================"
echo "  FreqTrade Tunnel - Connecting..."
echo "================================================"
echo ""

ssh -N -L 8080:127.0.0.1:8080 root@204.168.187.107 &
SSH_PID=$!

sleep 2

if kill -0 $SSH_PID 2>/dev/null; then
    echo "  Connected! Opening FreqUI..."
    echo ""
    echo "  FreqUI:  http://localhost:8080"
    echo ""
    echo "  Login: novakus / FreqTrade2026!"
    echo ""
    echo "  Press Ctrl+C to disconnect."
    echo "================================================"
    open http://localhost:8080
    wait $SSH_PID
else
    echo "  Connection failed. Check your SSH key."
    echo "================================================"
    read -p "Press Enter to close..."
fi
