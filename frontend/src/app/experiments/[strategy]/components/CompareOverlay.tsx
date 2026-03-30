'use client';

import React, { useState } from 'react';

const SELECT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer appearance-none transition-all";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-[4px]";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tests: any[] = [];

export default function CompareOverlay({ onClose }: { onClose: () => void; strategy?: string }) {
  const [testAId, setTestAId] = useState('');
  const [testBId, setTestBId] = useState('');

  const hasTests = tests.length >= 2;

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Compare Tests</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* Test Selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Test A (Baseline)</label>
            <select
              value={testAId}
              onChange={(e) => setTestAId(e.target.value)}
              className={SELECT}
              disabled={!hasTests}
            >
              <option value="">Select test...</option>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL}>Test B (Comparison)</label>
            <select
              value={testBId}
              onChange={(e) => setTestBId(e.target.value)}
              className={SELECT}
              disabled={!hasTests}
            >
              <option value="">Select test...</option>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Run Comparison Button */}
        <button
          disabled={!testAId || !testBId}
          className="w-full mt-4 h-[34px] px-4 bg-primary hover:bg-[#5558e3] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-btn transition"
        >
          Run Comparison
        </button>
      </div>

      {/* Empty state */}
      {!hasTests && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-sm font-semibold text-muted-foreground mb-[8px]">No tests available</div>
          <div className="text-xs text-muted-foreground max-w-xs text-center">
            Run at least two tests first.
          </div>
        </div>
      )}

      {/* Content */}
      {hasTests && (
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div className="bg-card border border-border rounded-card p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Select tests above to compare
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
