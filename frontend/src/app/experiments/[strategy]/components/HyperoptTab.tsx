"use client";

import { useState, useMemo } from "react";
import {
  LOSS_FUNCTIONS,
  SAMPLERS,
  SPACE_PRESETS,
  ALL_SPACES,
} from "@/lib/experiments";
import Tooltip from "@/components/ui/Tooltip";

interface HyperoptTabProps {
  strategy: string;
}

// ── Design System ────────────────────────────────────────────────────────
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

// ── Toggle switch ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-text-1">{label}</span>
      <label className="relative w-[36px] h-[20px] cursor-pointer inline-block flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`absolute inset-0 rounded-[10px] border transition-all ${checked ? "bg-[rgba(34,197,94,0.08)] border-green" : "bg-bg-3 border-border"}`} />
        <span className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${checked ? "left-[19px]" : "left-[3px]"}`} />
      </label>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function HyperoptTab({ strategy }: HyperoptTabProps) {
  const [testName, setTestName] = useState("BollingerBreak hyperopt v2");
  const [epochs, setEpochs] = useState(100);
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>(["buy", "sell", "roi", "stoploss"]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["signals", "signals_risk", "signals_trailing", "full"]);
  const [activeLosses, setActiveLosses] = useState<string[]>(LOSS_FUNCTIONS.map((l) => l.value));
  const [minTrades, setMinTrades] = useState(10);
  const [maxTrades, setMaxTrades] = useState(999);
  const [randomState, setRandomState] = useState(42);
  const [jobs, setJobs] = useState(-1);
  const [effort, setEffort] = useState(1.0);
  const [earlyStop, setEarlyStop] = useState(false);

  // Auto-description
  const autoDesc = useMemo(() => {
    const spaceStr = selectedSpaces.length === ALL_SPACES.length ? "all spaces" : selectedSpaces.join(", ");
    const presetStr = selectedPresets.length === SPACE_PRESETS.length ? "all presets" : `${selectedPresets.length} presets`;
    return `${strategy} · ${epochs} epochs · ${spaceStr} · ${presetStr} · ${activeLosses.length} loss fns · ${startDate} → ${endDate}`;
  }, [strategy, epochs, selectedSpaces, selectedPresets, activeLosses, startDate, endDate]);

  const toggleSpace = (space: string) => {
    setSelectedSpaces((prev) => prev.includes(space) ? prev.filter((s) => s !== space) : [...prev, space]);
  };
  const togglePreset = (preset: string) => {
    setSelectedPresets((prev) => prev.includes(preset) ? prev.filter((p) => p !== preset) : [...prev, preset]);
  };
  const toggleLoss = (loss: string) => {
    setActiveLosses((prev) => prev.includes(loss) ? prev.filter((l) => l !== loss) : [...prev, loss]);
  };

  const selectedPresetCount = SPACE_PRESETS.filter((p) => selectedPresets.includes(p.key)).length;
  const totalRuns = selectedPresetCount * activeLosses.length * SAMPLERS.length;
  const estimatedHours = Math.ceil(totalRuns / 120);

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-5">
      {/* LEFT PANEL — FORM */}
      <div className="space-y-4">
        {/* Optimization Config */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="text-[12px] font-semibold text-text-0 mb-3 flex items-center gap-2">⚙️ Optimization Config</div>

          {/* Test Name */}
          <div className="mb-3">
            <label className={LABEL}>Test Name</label>
            <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)} className={INPUT} placeholder="My optimization run" />
          </div>

          {/* Auto Description */}
          <div className="mb-3">
            <label className={LABEL}>Description (auto)</label>
            <div className="w-full h-[34px] py-0 px-3 bg-bg-2 border border-border rounded-btn text-[11px] text-text-2 flex items-center truncate">
              {autoDesc}
            </div>
          </div>

          {/* Epochs + Dates */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className={LABEL}>Epochs</label>
              <input type="number" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
            </div>
          </div>

          {/* Optimization Spaces */}
          <div>
            <label className={LABEL}>Optimization Spaces</label>
            <div className="flex flex-wrap gap-[6px]">
              {ALL_SPACES.map((space) => (
                <Tooltip key={space.value} content={space.tip}>
                  <button
                    onClick={() => toggleSpace(space.value)}
                    className={`inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-btn text-[11px] cursor-pointer border transition-all ${
                      selectedSpaces.includes(space.value)
                        ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                        : "bg-bg-2 border-border text-text-2"
                    }`}
                  >
                    <input type="checkbox" checked={selectedSpaces.includes(space.value)} readOnly className="w-3 h-3 accent-accent" />
                    {space.label}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className={LABEL}>Presets</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {SPACE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => togglePreset(preset.key)}
                className={`inline-flex items-center gap-[6px] h-[30px] px-3 rounded-btn text-[11px] font-medium cursor-pointer border transition-all ${
                  selectedPresets.includes(preset.key)
                    ? "bg-accent border-accent text-white hover:bg-[#5558e6]"
                    : "border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Info Box */}
          <div className="bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] rounded-btn px-3 py-2 text-[11px] text-accent mb-3">
            ℹ️ Full Matrix: {selectedPresetCount || 4} preset{selectedPresetCount !== 1 ? "s" : ""} × {activeLosses.length} loss × {SAMPLERS.length} sampler = {totalRuns} runs. ~{estimatedHours}-{estimatedHours + 2}h
          </div>

          {/* Batch Builder — 2x2 Grid */}
          <label className={LABEL}>Batch Presets <span className="font-normal text-text-3">(active)</span></label>
          <div className="grid grid-cols-2 gap-[6px] mb-2">
            {selectedPresets.length === 0 ? (
              <div className="col-span-2 text-[10px] text-text-3 py-2">No presets selected</div>
            ) : (
              SPACE_PRESETS.map((preset) =>
                selectedPresets.includes(preset.key) && (
                  <div key={preset.key} className="bg-bg-3 border border-accent rounded-btn p-2 relative">
                    <div className="text-[11px] font-semibold text-text-0">
                      {SPACE_PRESETS.findIndex((p) => p.key === preset.key) + 1}. {preset.label}
                    </div>
                    <div className="text-[9px] text-text-3 mt-[2px]">{preset.desc} · {preset.epochs} ep</div>
                    <div className="text-[9px] text-accent mt-[2px]">72 runs</div>
                    <span
                      className="absolute top-1 right-[6px] text-[9px] cursor-pointer text-text-3 hover:text-text-1"
                      onClick={(e) => { e.stopPropagation(); togglePreset(preset.key); }}
                    >✕</span>
                  </div>
                )
              )
            )}
          </div>
          <div className="text-[10px] text-text-3 text-right">
            Total: {totalRuns} runs · Est: {estimatedHours}-{estimatedHours + 2}h
          </div>
        </div>

        {/* Loss Functions */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className={LABEL}>Loss Functions ({activeLosses.length})</label>
          <div className="flex flex-wrap gap-[6px]">
            {LOSS_FUNCTIONS.map((loss) => (
              <Tooltip key={loss.value} content={loss.tip}>
                <button
                  onClick={() => toggleLoss(loss.value)}
                  className={`inline-flex items-center gap-1 h-[26px] px-2 rounded-btn text-[10px] font-medium cursor-pointer border transition-all ${
                    activeLosses.includes(loss.value)
                      ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                      : "bg-bg-2 border-border text-text-2 hover:text-text-1"
                  }`}
                >
                  {loss.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Samplers */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className={LABEL}>Samplers (always tested)</label>
          <div className="flex flex-wrap gap-[6px]">
            {SAMPLERS.map((sampler) => (
              <Tooltip key={sampler.value} content={sampler.tip}>
                <div className="inline-flex items-center gap-1 h-[26px] px-2 rounded-btn text-[10px] font-medium bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] text-accent">
                  {sampler.label}
                </div>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Advanced Options — FLAT, no dropdown */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="text-[12px] font-semibold text-text-0 mb-3">⚡ Advanced Options</div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>Min Trades</label>
              <input type="number" value={minTrades} onChange={(e) => setMinTrades(Number(e.target.value))} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Max Trades</label>
              <input type="number" value={maxTrades} onChange={(e) => setMaxTrades(Number(e.target.value))} className={INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>Random State (Seed)</label>
              <input type="number" value={randomState} onChange={(e) => setRandomState(Number(e.target.value))} className={INPUT} placeholder="42" />
            </div>
            <div>
              <label className={LABEL}>Jobs (Parallel)</label>
              <select value={jobs} onChange={(e) => setJobs(Number(e.target.value))} className={SELECT}>
                <option value={-1}>-1 (All CPUs)</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
                <option value={16}>16</option>
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className={LABEL}>
              Effort (Quality vs Speed) <span className="text-text-1 font-normal ml-1">{effort.toFixed(2)}x</span>
            </label>
            <input type="range" min="0.5" max="2.0" step="0.1" value={effort} onChange={(e) => setEffort(Number(e.target.value))} className="w-full accent-accent" />
          </div>

          <Toggle checked={earlyStop} onChange={setEarlyStop} label="Early Stop (stop if no improvement)" />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button className="flex-1 inline-flex items-center justify-center gap-[6px] h-[34px] rounded-btn text-[12px] font-medium cursor-pointer bg-accent border border-accent text-white hover:bg-[#5558e6] transition-all">
            ⚡ Run Batch
          </button>
          <button className="flex-1 inline-flex items-center justify-center gap-[6px] h-[34px] rounded-btn text-[12px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3 transition-all">
            ▶ Run Single
          </button>
          <button className="h-[34px] px-3 rounded-btn text-[12px] font-medium cursor-pointer bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-red hover:bg-[rgba(239,68,68,0.15)] transition-all">
            ⏹
          </button>
        </div>
      </div>

      {/* RIGHT PANEL — EMPTY STATE */}
      <div className="bg-bg-1 border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-[32px] mb-3 opacity-30">⚡</div>
        <div className="text-[13px] font-semibold text-text-2 mb-1">No hyperopt results yet</div>
        <div className="text-[11px] text-text-3 text-center max-w-[280px]">
          Configure your optimization parameters and click &quot;Run Batch&quot; to start a real FreqTrade hyperopt run.
        </div>
      </div>
    </div>
  );
}
