'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import {
  AI_MODELS,
} from '@/lib/experiments';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AiReviewTab({ strategy: _strategy }: { strategy: string }) {
  const [scope, setScope] = useState<'all' | 'selected' | 'backtest' | 'hyperopt' | 'freqai'>('all');
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].value);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const handleRunAnalysis = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasRun(true);
    }, 2000);
  };

  return (
    <div className="flex gap-6 pb-12">
      {/* LEFT PANEL: FORM (380px) */}
      <div className="w-[380px] flex-shrink-0">
        <div className="bg-bg-1 border border-border rounded-card p-4">
          <h3 className="text-[12px] font-semibold text-text-0 mb-4">AI Strategy Analyst</h3>

          <div className="space-y-4">
            {/* Scope */}
            <div>
              <label className={LABEL}>Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
                className={SELECT}
              >
                <option value="all">All tests (Svi testovi)</option>
                <option value="selected">Selected test</option>
                <option value="backtest">Backtest results only</option>
                <option value="hyperopt">Hyperopt results only</option>
                <option value="freqai">FreqAI results only</option>
              </select>
            </div>

            {/* AI Model */}
            <div>
              <label className={LABEL}>AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={SELECT}
              >
                {AI_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label} ({model.cost})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-text-3 mt-2 font-medium">
                Estimated cost: <strong>~$0.03</strong>
              </p>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className="w-full h-[34px] inline-flex items-center justify-center gap-[6px] rounded-btn text-[12px] font-medium border bg-accent border-accent text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <>
                  <div className="animate-spin">
                    <Zap size={14} />
                  </div>
                  Running Analysis...
                </>
              ) : (
                <>
                  <span>▶</span>
                  Run AI Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: RESULTS (flex) */}
      <div className="flex-1 min-w-0">
        {!hasRun ? (
          <div className="bg-bg-1 border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[400px]">
            <div className="text-[32px] mb-3 opacity-30">AI</div>
            <div className="text-[13px] font-semibold text-text-2 mb-1">No AI analysis yet</div>
            <div className="text-[11px] text-text-3 text-center max-w-[280px]">
              Select a backtest result and click &quot;Run Analysis&quot; to get AI-powered strategy review.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-[12px] text-text-2">Analysis results will appear here once complete.</p>
          </div>
        )}
      </div>
    </div>
  );
}
