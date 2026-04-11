"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Spread data computed from WebSocket orderbook messages.
 * Maps pair → { bid, ask, spread, spreadPct }
 */
export interface SpreadData {
  bid: number;
  ask: number;
  spread: number;
  spreadPct: number;
  updatedAt: number;
}

interface WSMessage {
  type: string;
  data?: {
    pair?: string;
    best_bid?: number;
    best_ask?: number;
    [key: string]: unknown;
  };
}

/**
 * Connect to the FreqTrade WebSocket proxy and compute real-time spread data.
 * Uses the orchestrator's /api/bots/{id}/ws endpoint.
 *
 * @param botIds - Array of bot IDs to connect to
 * @param enabled - Whether the hook should actively connect
 * @returns Record mapping pair → SpreadData
 */
export function useWebSocket(
  botIds: number[],
  enabled: boolean = true,
): Record<string, SpreadData> {
  const [spreads, setSpreads] = useState<Record<string, SpreadData>>({});
  const wsRefs = useRef<Map<number, WebSocket>>(new Map());
  const reconnectTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const connect = useCallback((botId: number) => {
    // Don't connect if already connected
    const existing = wsRefs.current.get(botId);
    if (existing && (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = localStorage.getItem("orch_token") ?? "";

    const url = `${protocol}//${window.location.host}/api/bots/${botId}/ws?token=${token}`;

    try {
      const ws = new WebSocket(url);
      wsRefs.current.set(botId, ws);

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data as string);
          if (msg.data?.pair && msg.data.best_bid != null && msg.data.best_ask != null) {
            const bid = msg.data.best_bid;
            const ask = msg.data.best_ask;
            const spread = ask - bid;
            const spreadPct = (spread / ask) * 100;

            setSpreads((prev) => ({
              ...prev,
              [msg.data!.pair!]: {
                bid,
                ask,
                spread,
                spreadPct,
                updatedAt: Date.now(),
              },
            }));
          }
        } catch {
          /* non-blocking — skip malformed messages */
        }
      };

      ws.onclose = () => {
        wsRefs.current.delete(botId);
        // Reconnect after 5s
        const timer = setTimeout(() => {
          reconnectTimers.current.delete(botId);
          if (enabledRef.current) connect(botId);
        }, 5000);
        reconnectTimers.current.set(botId, timer);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      /* non-blocking — WebSocket construction failed */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || botIds.length === 0) return;

    // Connect to all bots
    for (const botId of botIds) {
      connect(botId);
    }

    return () => {
      // Cleanup all connections
      Array.from(wsRefs.current.values()).forEach((ws) => ws.close());
      wsRefs.current.clear();
      Array.from(reconnectTimers.current.values()).forEach((timer) => clearTimeout(timer));
      reconnectTimers.current.clear();
    };
  }, [botIds, enabled, connect]);

  // Prune stale data (older than 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSpreads((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [pair, data] of Object.entries(next)) {
          if (now - data.updatedAt > 30_000) {
            delete next[pair];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  return spreads;
}
