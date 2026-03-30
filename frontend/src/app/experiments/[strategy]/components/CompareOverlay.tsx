'use client';

import React, { useState } from 'react';

const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tests: any[] = [];

export default function CompareOverlay({ onClose }: { onClose: () => void; strategy?: string }) {
  const [testAId, setTestAId] = useState('');
  const [testBId, setTestBId] = useState('');

  const hasTests = tests.length >= 2;

  return (
    <div className="flex h-full w-full flex-col bg-bg-0 text-text-0">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold">Compare Tests</h2>
          <button
            onClick={onClose}
            className="text-text-2 hover:text-text-0 transition text-lg"
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
          className="w-full mt-4 h-[34px] px-4 bg-accent hover:bg-[#5558e3] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold rounded-btn transition"
        >
          Run Comparison
        </button>
      </div>

      {/* Empty state */}
      {!hasTests && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-[14px] font-semibold text-text-1 mb-[8px]">No tests available</div>
          <div className="text-[12px] text-text-2 max-w-xs text-center">
            Run at least two tests first.
          </div>
        </div>
      )}

      {/* Content */}
      {hasTests && (
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div className="bg-bg-1 border border-border rounded-card p-4 text-center">
              <p className="text-[12px] text-text-2">
                Select tests above to compare
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
