"use client";

import React, { useState } from "react";
import { startBot, stopBot, botPause } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { profitColor, fmt } from "@/lib/format";
import type { Bot, FTProfit } from "@/types";
import BotRegisterModal from "./BotRegisterModal";
import BotEditModal from "./BotEditModal";
import BotDeleteDialog from "./BotDeleteDialog";

interface BotManagementTableProps {
  bots: Bot[];
  botProfits: Record<number, Partial<FTProfit>>;
  onRefresh: () => void;
}

export default function BotManagementTable({ bots, botProfits, onRefresh }: BotManagementTableProps) {
  const toast = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [editBot, setEditBot] = useState<Bot | null>(null);
  const [deleteBot, setDeleteBot] = useState<Bot | null>(null);

  async function handleAction(label: string, botId: number, fn: () => Promise<unknown>) {
    setActionLoading(`${label}-${botId}`);
    try {
      await fn();
      toast.success(`${label} successful.`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-0">Bot Management</h2>
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-accent text-white hover:brightness-110 cursor-pointer transition-all"
        >
          + Register New Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-3 bg-bg-2 border border-border rounded-card">
          No bots registered yet. Click &quot;Register New Bot&quot; to get started.
        </div>
      ) : (
        <div className="overflow-x-auto bg-bg-2 border border-border rounded-card">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Status", "Name", "Strategy", "Mode", "P&L (closed)", "Trades", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => {
                const profit = botProfits[bot.id];
                const isRunning = bot.status === "running";
                const loadingKey = (label: string) => `${label}-${bot.id}`;

                return (
                  <tr key={bot.id} className="hover:bg-bg-3 transition-colors">
                    <td className="px-4 py-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        isRunning && bot.is_healthy ? "bg-green shadow-[0_0_6px_var(--color-green)]"
                          : bot.status === "error" ? "bg-red animate-pulse"
                          : isRunning ? "bg-amber" : "bg-bg-3"
                      }`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-text-0">{bot.name}</div>
                      {bot.description && <div className="text-2xs text-text-3 truncate max-w-[160px]">{bot.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-2">{bot.strategy_name ?? "\u2014"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${
                        bot.is_dry_run
                          ? "bg-amber-bg text-amber border-amber/20"
                          : "bg-green-bg text-green border-green/20"
                      }`}>
                        {bot.is_dry_run ? "Paper" : "Live"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs font-bold ${profitColor(profit?.profit_closed_coin)}`}>
                      {profit ? `${fmt(profit.profit_closed_coin, 2)} USDT` : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-2">
                      {profit ? profit.trade_count : "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {!isRunning ? (
                          <ActionBtn
                            label="Start"
                            loading={actionLoading === loadingKey("Start")}
                            disabled={actionLoading !== null}
                            onClick={() => handleAction("Start", bot.id, () => startBot(bot.id))}
                            className="border-green/30 text-green bg-green-bg hover:bg-green/[0.18]"
                          />
                        ) : (
                          <>
                            <ActionBtn
                              label="Stop"
                              loading={actionLoading === loadingKey("Stop")}
                              disabled={actionLoading !== null}
                              onClick={() => handleAction("Stop", bot.id, () => stopBot(bot.id))}
                              className="border-red/30 text-red bg-red-bg hover:bg-red/[0.18]"
                            />
                            <ActionBtn
                              label="Pause"
                              loading={actionLoading === loadingKey("Pause")}
                              disabled={actionLoading !== null}
                              onClick={() => handleAction("Pause", bot.id, () => botPause(bot.id))}
                              className="border-amber/30 text-amber bg-amber-bg hover:bg-amber/[0.18]"
                            />
                          </>
                        )}
                        <ActionBtn
                          label="Edit"
                          onClick={() => setEditBot(bot)}
                          className="border-border text-text-2 bg-bg-1 hover:bg-bg-3"
                        />
                        <ActionBtn
                          label="Del"
                          onClick={() => setDeleteBot(bot)}
                          className="border-red/20 text-red/70 bg-bg-1 hover:bg-red-bg hover:text-red"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BotRegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} onSuccess={onRefresh} />
      <BotEditModal open={!!editBot} bot={editBot} onClose={() => setEditBot(null)} onSuccess={onRefresh} />
      <BotDeleteDialog open={!!deleteBot} bot={deleteBot} onClose={() => setDeleteBot(null)} onSuccess={onRefresh} />
    </>
  );
}

function ActionBtn({
  label, onClick, className, loading, disabled,
}: {
  label: string; onClick: () => void; className: string; loading?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`text-[10px] font-semibold px-2 py-1 rounded border disabled:opacity-50 cursor-pointer transition-all ${className}`}
    >
      {loading ? "..." : label}
    </button>
  );
}
