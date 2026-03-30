'use client';

import React, { useState } from 'react';

const SELECT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer appearance-none transition-all";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-[4px]";

type AnalysisTab = 'enterTags' | 'exitReasons' | 'tradingList' | 'rejectedSignals' | 'indicatorAnalysis' | 'signalAnalysis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tests: any[] = [];

export default function AnalysisOverlay({ onClose }: { onClose: () => void; strategy: string }) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('enterTags');

  const tabs: { id: AnalysisTab; label: string }[] = [
    { id: 'enterTags', label: 'Enter Tag Stats' },
    { id: 'exitReasons', label: 'Exit Reason Stats' },
    { id: 'tradingList', label: 'Trading List' },
    { id: 'rejectedSignals', label: 'Rejected Signals' },
    { id: 'indicatorAnalysis', label: 'Indicator Analysis' },
    { id: 'signalAnalysis', label: 'Signal Analysis' },
  ];

  const hasTests = tests.length > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Analysis</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition text-[16px]"
          >
            ✕
          </button>
        </div>

        {/* Test Selector */}
        <div className="space-y-2">
          <label className={LABEL}>Select Test</label>
          <select className={SELECT} disabled={!hasTests}>
            <option>Select a test...</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty state */}
      {!hasTests && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-sm font-semibold text-muted-foreground mb-[8px]">No analysis data available</div>
          <div className="text-xs text-muted-foreground max-w-xs text-center">
            Run a backtest with --export trades first.
          </div>
        </div>
      )}

      {/* Content (only show when tests exist) */}
      {hasTests && (
        <>
          {/* Sub-Navigation Tabs */}
          <div className="border-b border-border px-6 flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition border-b-2 ${
                  activeTab === tab.id
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-muted-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            <div className="px-6 py-4">
              <div className="bg-card border border-border rounded-card p-3 text-center text-muted-foreground text-xs">
                Analysis data will appear here
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
