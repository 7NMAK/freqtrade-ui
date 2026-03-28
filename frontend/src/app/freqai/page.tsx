"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import { getBots, botConfig, saveBotConfig } from "@/lib/api";
import type { Bot } from "@/types";

/* ─── Toggle Component ─── */
function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: () => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onChange}
        className={`relative w-9 h-5 rounded-full border cursor-pointer transition-all flex-shrink-0 ${
          on ? "bg-green-bg border-green" : "bg-bg-3 border-border"
        }`}
      >
        <span
          className={`absolute top-[2px] w-3.5 h-3.5 rounded-full transition-all ${
            on ? "bg-green left-[17px]" : "bg-text-3 left-[2px]"
          }`}
        />
      </button>
      <div>
        <div className="text-xs text-text-1">{label}</div>
        {sub && <div className="text-[10px] text-text-3 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Chip (multi-select) ─── */
function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md border text-[11px] font-medium cursor-pointer transition-all ${
        selected
          ? "border-accent bg-accent-glow text-accent"
          : "border-border bg-bg-2 text-text-2 hover:border-border-hover hover:text-text-1 hover:bg-bg-3"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Section (collapsible) ─── */
function Section({
  id,
  icon,
  title,
  tag,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  tag: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-bg-2 border border-border rounded-card mb-6 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer select-none transition-colors hover:bg-bg-3"
      >
        <div className="text-[13px] font-semibold text-text-0 flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          {title}
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent-glow text-accent tracking-wide">
            {tag}
          </span>
        </div>
        <span className={`text-xs text-text-3 transition-transform ${collapsed ? "-rotate-90" : ""}`}>
          &#9660;
        </span>
      </button>
      {!collapsed && (
        <div className="px-6 py-6 border-t border-border">{children}</div>
      )}
    </div>
  );
}

/* ─── Array Tag Input ─── */
function ArrayTagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onChange([...values, input.trim()]);
      setInput("");
    }
  }

  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 px-2.5 rounded-md border border-border bg-bg-2 min-h-[40px] items-center cursor-text focus-within:border-accent">
      {values.map((v, i) => (
        <span key={`tag-${i}-${v}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-bg-3 text-text-0 text-[11px] font-mono">
          {v}
          <button type="button" onClick={() => remove(i)} className="text-text-3 text-xs hover:text-red cursor-pointer">
            x
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-none bg-transparent text-text-0 text-xs outline-none flex-1 min-w-[60px] placeholder:text-text-3"
      />
    </div>
  );
}

/* ─── KV Editor ─── */
function KvEditor({
  rows,
  onChange,
}: {
  rows: { key: string; value: string }[];
  onChange: (rows: { key: string; value: string }[]) => void;
}) {
  function updateRow(idx: number, field: "key" | "value", val: string) {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  }

  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  function addRow() {
    onChange([...rows, { key: "", value: "" }]);
  }

  return (
    <div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={`row-${i}`} className="flex gap-2 items-center">
            <input
              className="flex-1 px-2.5 py-2 rounded border border-border bg-bg-3 text-text-0 text-xs font-mono outline-none focus:border-accent"
              value={r.key}
              onChange={(e) => updateRow(i, "key", e.target.value)}
              placeholder="key"
            />
            <input
              className="flex-1 px-2.5 py-2 rounded border border-border bg-bg-3 text-text-0 text-xs font-mono outline-none focus:border-accent"
              value={r.value}
              onChange={(e) => updateRow(i, "value", e.target.value)}
              placeholder="value"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="w-7 h-7 rounded border border-border bg-bg-3 text-text-3 cursor-pointer flex items-center justify-center text-sm transition-all hover:border-red hover:text-red hover:bg-red-bg flex-shrink-0"
            >
              x
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border text-text-3 text-[11px] cursor-pointer transition-all hover:border-accent hover:text-accent mt-1.5 w-fit"
      >
        + Add Parameter
      </button>
    </div>
  );
}

/* ─── Form helpers ─── */
function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold text-text-2 uppercase tracking-wide mb-2 flex items-center gap-1.5">
      {children}
    </div>
  );
}

function FtParam({ name }: { name: string }) {
  return <span className="font-normal text-purple normal-case tracking-normal text-[10px] font-mono">{name}</span>;
}

function Hint({ text }: { text: string }) {
  return <span className="font-normal text-text-3 normal-case tracking-normal text-[10px]">{text}</span>;
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3.5 py-2.5 rounded-md border border-border bg-bg-2 text-text-0 text-[13px] outline-none transition-colors focus:border-accent placeholder:text-text-3"
    />
  );
}

function FormSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full px-3.5 py-2.5 rounded-md border border-border bg-bg-2 text-text-0 text-[13px] outline-none transition-colors focus:border-accent cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23808098%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_12px_center]"
    >
      {children}
    </select>
  );
}

/* ─── Slider ─── */
function SliderRow({
  min,
  max,
  value,
  onChange,
  format,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 appearance-none h-1 rounded bg-bg-3 outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg-0"
      />
      <span className="text-xs font-semibold text-text-0 min-w-[36px] text-right font-mono">
        {format(value)}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FREQAI PAGE
   ════════════════════════════════════════════════════════════ */
export default function FreqAIPage() {
  const toast = useToast();
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  // Section collapse state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setCollapsed((s) => ({ ...s, [id]: !s[id] }));

  // Master switch
  const [freqaiEnabled, setFreqaiEnabled] = useState(true);

  // Core Configuration (§24)
  const [identifier, setIdentifier] = useState("unique-freqai-model-1");
  const [model, setModel] = useState("LightGBMRegressor");
  const [trainPeriodDays, setTrainPeriodDays] = useState(30);
  const [backtestPeriodDays, setBacktestPeriodDays] = useState(7);
  const [liveRetrainHours, setLiveRetrainHours] = useState(8);
  const [expiredHours, setExpiredHours] = useState(48);
  const [purgeOldModels, setPurgeOldModels] = useState(2);
  const [continualLearning, setContinualLearning] = useState(true);
  const [activateTensorboard, setActivateTensorboard] = useState(false);
  const [waitForTrainingOnReload, setWaitForTrainingOnReload] = useState(false);
  const [overrideExchangeCheck, setOverrideExchangeCheck] = useState(false);

  // Feature Parameters (§24)
  const allTimeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(["5m", "15m", "1h"]);
  const allCorrPairs = ["BTC/USDT:USDT", "ETH/USDT:USDT", "SOL/USDT:USDT", "BNB/USDT:USDT", "XRP/USDT:USDT", "DOGE/USDT:USDT"];
  const [selectedCorrPairs, setSelectedCorrPairs] = useState<string[]>(["BTC/USDT:USDT", "ETH/USDT:USDT"]);
  const [includeShiftedCandles, setIncludeShiftedCandles] = useState(2);
  const [labelPeriodCandles, setLabelPeriodCandles] = useState(24);
  const [fitLivePredictions, setFitLivePredictions] = useState(100);
  const [indicatorPeriods, setIndicatorPeriods] = useState<string[]>(["10", "20", "50"]);
  const [testSize, setTestSize] = useState(25);

  // Feature Engineering Methods
  const methods = ["expand_all", "expand_basic", "standard", "set_targets"];
  const [selectedMethod, setSelectedMethod] = useState("expand_all");

  // Reinforcement Learning (§25)
  const [rlModelType, setRlModelType] = useState("PPO");
  const [rlPolicyType, setRlPolicyType] = useState("MlpPolicy");
  const [rlEnvironment, setRlEnvironment] = useState("Base4ActionRLEnv");
  const [trainCycles, setTrainCycles] = useState(25);
  const [maxTradeDuration, setMaxTradeDuration] = useState(300);
  const [maxTrainingDrawdown, setMaxTrainingDrawdown] = useState("0.8");
  const [addStateInfo, setAddStateInfo] = useState(true);
  const [rlCpuCount, setRlCpuCount] = useState(1);
  const [rlNetArch, setRlNetArch] = useState<string[]>(["128", "128"]);
  const [rlRandomizeStart, setRlRandomizeStart] = useState(false);
  const [rlDropOhlc, setRlDropOhlc] = useState(false);
  const [rlProgressBar, setRlProgressBar] = useState(true);
  const [rewardParams, setRewardParams] = useState([
    { key: "rr", value: "1" },
    { key: "profit_aim", value: "0.025" },
    { key: "win_reward_factor", value: "10" },
  ]);

  // Data Processing & Outlier Detection (§26)
  const [dataKitchenThreadCount, setDataKitchenThreadCount] = useState(4);
  const [bufferTrainDataCandles, setBufferTrainDataCandles] = useState(0);
  const [noiseStdDev, setNoiseStdDev] = useState("0.05");
  const [weightFactor, setWeightFactor] = useState(0);
  const [saveBacktestModels, setSaveBacktestModels] = useState(true);
  const [writeMetricsToDisk, setWriteMetricsToDisk] = useState(true);
  const [reduceDfFootprint, setReduceDfFootprint] = useState(false);
  const [shuffleAfterSplit, setShuffleAfterSplit] = useState(false);
  const [reverseTrainTestOrder, setReverseTrainTestOrder] = useState(false);
  const [principalComponentAnalysis, setPrincipalComponentAnalysis] = useState(false);
  const [useSVM, setUseSVM] = useState(true);
  const [svmNu, setSvmNu] = useState("0.1");
  const [useDBSCAN, setUseDBSCAN] = useState(false);
  const [diThreshold, setDiThreshold] = useState("1");
  const [outlierProtectionPct, setOutlierProtectionPct] = useState(30);
  const [plotFeatureImportances, setPlotFeatureImportances] = useState(0);
  const [svmParamsJson, setSvmParamsJson] = useState('{"shuffle": false, "nu": 0.1, "kernel": "rbf"}');

  // PyTorch Configuration
  const [learningRate, setLearningRate] = useState("0.001");
  const [epochs, setEpochs] = useState(10);
  const [batchSize, setBatchSize] = useState(64);
  const [convWidth, setConvWidth] = useState(2);

  // Loading state
  const [configLoading, setConfigLoading] = useState(false);
  const [botsLoading, setBotsLoading] = useState(true);

  // Populate form state from a loaded FT config object
  function applyConfig(cfg: Record<string, unknown>) {
    const fai = cfg.freqai as Record<string, unknown> | undefined;
    if (!fai) return;

    if (typeof fai.enabled === "boolean") setFreqaiEnabled(fai.enabled);
    if (typeof fai.identifier === "string") setIdentifier(fai.identifier);
    if (typeof fai.train_period_days === "number") setTrainPeriodDays(fai.train_period_days);
    if (typeof fai.backtest_period_days === "number") setBacktestPeriodDays(fai.backtest_period_days);
    if (typeof fai.live_retrain_hours === "number") setLiveRetrainHours(fai.live_retrain_hours);
    if (typeof fai.expired_hours === "number") setExpiredHours(fai.expired_hours);
    if (typeof fai.purge_old_models === "number") setPurgeOldModels(fai.purge_old_models);
    if (typeof fai.continual_learning === "boolean") setContinualLearning(fai.continual_learning);
    if (typeof fai.activate_tensorboard === "boolean") setActivateTensorboard(fai.activate_tensorboard);
    if (typeof fai.wait_for_training_iteration_on_reload === "boolean") setWaitForTrainingOnReload(fai.wait_for_training_iteration_on_reload);
    if (typeof fai.override_exchange_check === "boolean") setOverrideExchangeCheck(fai.override_exchange_check);
    if (typeof fai.fit_live_predictions_candles === "number") setFitLivePredictions(fai.fit_live_predictions_candles);
    if (typeof fai.save_backtest_models === "boolean") setSaveBacktestModels(fai.save_backtest_models);
    if (typeof fai.data_kitchen_thread_count === "number") setDataKitchenThreadCount(fai.data_kitchen_thread_count);
    if (typeof fai.noise_standard_deviation === "number") setNoiseStdDev(String(fai.noise_standard_deviation));
    if (typeof fai.weight_factor === "number") setWeightFactor(Math.round(fai.weight_factor * 10));
    if (typeof fai.buffer_train_data_candles === "number") setBufferTrainDataCandles(fai.buffer_train_data_candles);
    if (typeof fai.outlier_protection_percentage === "number") setOutlierProtectionPct(fai.outlier_protection_percentage);
    if (typeof fai.plot_feature_importances === "number") setPlotFeatureImportances(fai.plot_feature_importances);
    if (typeof fai.write_metrics_to_disk === "boolean") setWriteMetricsToDisk(fai.write_metrics_to_disk);
    if (typeof fai.reduce_df_footprint === "boolean") setReduceDfFootprint(fai.reduce_df_footprint);
    if (typeof fai.reverse_train_test_order === "boolean") setReverseTrainTestOrder(fai.reverse_train_test_order);

    // feature_engineering_method (custom per-strategy)
    if (typeof fai.feature_engineering_method === "string") setSelectedMethod(fai.feature_engineering_method);

    // model_training_parameters
    const mtp = fai.model_training_parameters as Record<string, unknown> | undefined;
    if (mtp && typeof mtp.model_type === "string") setModel(mtp.model_type);

    // feature_parameters
    const fp = fai.feature_parameters as Record<string, unknown> | undefined;
    if (fp) {
      if (Array.isArray(fp.include_timeframes)) setSelectedTimeframes(fp.include_timeframes as string[]);
      if (Array.isArray(fp.include_corr_pairlist)) setSelectedCorrPairs(fp.include_corr_pairlist as string[]);
      if (typeof fp.include_shifted_candles === "number") setIncludeShiftedCandles(fp.include_shifted_candles);
      if (typeof fp.label_period_candles === "number") setLabelPeriodCandles(fp.label_period_candles);
      if (Array.isArray(fp.indicator_periods_candles)) setIndicatorPeriods((fp.indicator_periods_candles as number[]).map(String));
      if (typeof fp.shuffle_after_split === "boolean") setShuffleAfterSplit(fp.shuffle_after_split);
      if (typeof fp.principal_component_analysis === "boolean") setPrincipalComponentAnalysis(fp.principal_component_analysis);
      if (typeof fp.use_SVM_to_remove_outliers === "boolean") setUseSVM(fp.use_SVM_to_remove_outliers);
      if (typeof fp.use_DBSCAN_to_remove_outliers === "boolean") setUseDBSCAN(fp.use_DBSCAN_to_remove_outliers);
      if (typeof fp.DI_threshold === "number") setDiThreshold(String(fp.DI_threshold));
      if (typeof fp.weight_factor === "number") setWeightFactor(Math.round(fp.weight_factor * 10));
      const svmP = fp.svm_params as Record<string, unknown> | undefined;
      if (svmP && typeof svmP.nu === "number") setSvmNu(String(svmP.nu));
    }

    // data_split_parameters
    const dsp = fai.data_split_parameters as Record<string, unknown> | undefined;
    if (dsp && typeof dsp.test_size === "number") setTestSize(Math.round(dsp.test_size * 100));

    // rl_config
    const rl = fai.rl_config as Record<string, unknown> | undefined;
    if (rl) {
      if (typeof rl.model_type === "string") setRlModelType(rl.model_type);
      if (typeof rl.policy_type === "string") setRlPolicyType(rl.policy_type);
      if (typeof rl.environment === "string") setRlEnvironment(rl.environment);
      if (typeof rl.train_cycles === "number") setTrainCycles(rl.train_cycles);
      if (typeof rl.max_trade_duration_candles === "number") setMaxTradeDuration(rl.max_trade_duration_candles);
      if (typeof rl.max_training_drawdown_pct === "number") setMaxTrainingDrawdown(String(rl.max_training_drawdown_pct));
      if (typeof rl.add_state_info === "boolean") setAddStateInfo(rl.add_state_info);
      if (typeof rl.cpu_count === "number") setRlCpuCount(rl.cpu_count);
      if (Array.isArray(rl.net_arch)) setRlNetArch((rl.net_arch as number[]).map(String));
      if (typeof rl.randomize_starting_position === "boolean") setRlRandomizeStart(rl.randomize_starting_position);
      if (typeof rl.drop_ohlc_from_features === "boolean") setRlDropOhlc(rl.drop_ohlc_from_features);
      if (typeof rl.progress_bar === "boolean") setRlProgressBar(rl.progress_bar);
      const mrp = rl.model_reward_parameters as Record<string, unknown> | undefined;
      if (mrp) {
        setRewardParams(Object.entries(mrp).map(([key, value]) => ({ key, value: String(value) })));
      }
    }

    // PyTorch config (inside model_training_parameters)
    if (mtp) {
      if (typeof mtp.learning_rate === "number") setLearningRate(String(mtp.learning_rate));
      const tk = mtp.trainer_kwargs as Record<string, unknown> | undefined;
      if (tk) {
        if (typeof tk.n_epochs === "number") setEpochs(tk.n_epochs);
        if (typeof tk.batch_size === "number") setBatchSize(tk.batch_size);
      }
      if (typeof mtp.conv_width === "number") setConvWidth(mtp.conv_width);
    }
  }

  // Load bot list on mount
  useEffect(() => {
    setBotsLoading(true);
    getBots().then((list) => {
      setBots(list);
      if (list.length > 0) setSelectedBotId(String(list[0].id));
    }).catch((err) => { toast.error(err instanceof Error ? err.message : "Failed to load bots."); }).finally(() => setBotsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load config when bot selection changes
  useEffect(() => {
    if (!selectedBotId) return;
    const botId = parseInt(selectedBotId, 10);
    if (isNaN(botId)) return;
    setConfigLoading(true);
    botConfig(botId)
      .then((cfg) => {
        applyConfig(cfg as Record<string, unknown>);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? `Failed to load config: ${err.message}` : "Failed to load config.");
      })
      .finally(() => setConfigLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBotId]);

  function toggleMulti(list: string[], setList: (v: string[]) => void, val: string) {
    setList(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);
  }

  async function handleSave() {
    if (!selectedBotId) { toast.warning("Select a bot first."); return; }
    const id = toast.loading("Saving FreqAI config...");
    try {
      const botId = parseInt(selectedBotId, 10);
      // Build config payload — orchestrator PATCH endpoint will apply to FT config.json
      // Build model_training_parameters (includes PyTorch config when applicable)
      const modelTrainingParams: Record<string, unknown> = { model_type: model };
      if (model.startsWith("PyTorch")) {
        modelTrainingParams.learning_rate = parseFloat(learningRate);
        modelTrainingParams.conv_width = convWidth;
        modelTrainingParams.trainer_kwargs = {
          n_epochs: epochs,
          batch_size: batchSize,
        };
      }

      const freqaiConfig = {
        enabled: freqaiEnabled,
        identifier,
        model_training_parameters: modelTrainingParams,
        train_period_days: trainPeriodDays,
        backtest_period_days: backtestPeriodDays,
        live_retrain_hours: liveRetrainHours,
        expired_hours: expiredHours,
        purge_old_models: purgeOldModels,
        continual_learning: continualLearning,
        activate_tensorboard: activateTensorboard,
        wait_for_training_iteration_on_reload: waitForTrainingOnReload,
        override_exchange_check: overrideExchangeCheck,
        fit_live_predictions_candles: fitLivePredictions,
        save_backtest_models: saveBacktestModels,
        write_metrics_to_disk: writeMetricsToDisk,
        reduce_df_footprint: reduceDfFootprint,
        reverse_train_test_order: reverseTrainTestOrder,
        feature_engineering_method: selectedMethod,
        feature_parameters: {
          include_timeframes: selectedTimeframes,
          include_corr_pairlist: selectedCorrPairs,
          include_shifted_candles: includeShiftedCandles,
          label_period_candles: labelPeriodCandles,
          indicator_periods_candles: indicatorPeriods.map(Number),
          shuffle_after_split: shuffleAfterSplit,
          principal_component_analysis: principalComponentAnalysis,
          use_SVM_to_remove_outliers: useSVM,
          svm_params: useSVM ? (() => { try { return JSON.parse(svmParamsJson); } catch {  return { nu: parseFloat(svmNu) }; } })() : undefined,
          use_DBSCAN_to_remove_outliers: useDBSCAN,
          DI_threshold: parseFloat(diThreshold),
          weight_factor: weightFactor / 10,
        },
        data_split_parameters: { test_size: testSize / 100 },
        rl_config: {
          model_type: rlModelType,
          policy_type: rlPolicyType,
          environment: rlEnvironment,
          train_cycles: trainCycles,
          max_trade_duration_candles: maxTradeDuration,
          max_training_drawdown_pct: parseFloat(maxTrainingDrawdown),
          add_state_info: addStateInfo,
          cpu_count: rlCpuCount,
          net_arch: rlNetArch.map(Number),
          randomize_starting_position: rlRandomizeStart,
          drop_ohlc_from_features: rlDropOhlc,
          progress_bar: rlProgressBar,
          model_reward_parameters: Object.fromEntries(rewardParams.map(r => [r.key, parseFloat(r.value)])),
        },
        data_kitchen_thread_count: dataKitchenThreadCount,
        buffer_train_data_candles: bufferTrainDataCandles,
        noise_standard_deviation: parseFloat(noiseStdDev),
        outlier_protection_percentage: outlierProtectionPct,
        plot_feature_importances: plotFeatureImportances,
      };
      // Save freqai config section to orchestrator DB (PUT /api/bots/{id}/config)
      // This stores the config and triggers FT reload automatically
      await saveBotConfig(botId, { freqai: freqaiConfig });
      toast.dismiss(id);
      toast.success(`FreqAI config saved and applied to bot ${bots.find(b => b.id === botId)?.name ?? botId}.`);
    } catch (err) {
      toast.dismiss(id);
      toast.error(
        err instanceof Error ? `Save failed: ${err.message}` : "Save failed.",
        { action: { label: "RETRY", onClick: handleSave } }
      );
    }
  }

  return (
    <AppShell title="FreqAI Configuration">

      {/* Bot selector */}
      <div className="flex items-center gap-3 mb-4 p-3 px-4 bg-bg-2 border border-border rounded-card text-xs">
        <span className="text-text-3 uppercase tracking-wide font-semibold shrink-0">Target Bot</span>
        <select
          value={selectedBotId}
          onChange={(e) => setSelectedBotId(e.target.value)}
          disabled={configLoading}
          className="bg-bg-1 border border-border rounded-btn px-3 py-1.5 text-[11px] text-text-1 outline-none focus:border-accent cursor-pointer min-w-[200px] disabled:opacity-50"
        >
          <option value="">Select bot...</option>
          {bots.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.is_dry_run ? "PAPER" : "LIVE"})</option>
          ))}
        </select>
        {configLoading && (
          <span className="text-[11px] text-accent animate-pulse">Loading config...</span>
        )}
      </div>

      {/* No bots available */}
      {!botsLoading && bots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4 opacity-40">&#129504;</div>
          <div className="text-sm font-semibold text-text-1 mb-1">No Bots Available</div>
          <div className="text-xs text-text-3 max-w-sm">
            Register a bot in the Settings page first, then come back here to configure FreqAI.
          </div>
        </div>
      )}

      {/* Loading spinner while fetching config */}
      {configLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-xs text-text-3">Loading FreqAI configuration...</span>
        </div>
      )}

      {/* Main content - hidden when no bots or loading */}
      {!configLoading && bots.length > 0 && <>

      {/* ═══ MASTER SWITCH ═══ */}
      <div className="flex items-center gap-3.5 p-4 px-[18px] bg-gradient-to-r from-accent/[0.06] to-purple/[0.04] border border-accent/20 rounded-card mb-6">
        <div className="text-2xl">&#129504;</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-text-0 mb-0.5">FreqAI Engine</div>
          <div className="text-[11px] text-text-3">freqai.enabled &mdash; Enable machine learning predictions for all configured bots</div>
        </div>
        <button
          type="button"
          onClick={() => setFreqaiEnabled(!freqaiEnabled)}
          className={`relative w-12 h-[26px] rounded-[13px] border cursor-pointer transition-all flex-shrink-0 ${
            freqaiEnabled ? "bg-green-bg border-green" : "bg-bg-3 border-border"
          }`}
        >
          <span
            className={`absolute top-[2px] w-5 h-5 rounded-full transition-all ${
              freqaiEnabled ? "bg-green left-6" : "bg-text-3 left-[2px]"
            }`}
          />
        </button>
      </div>

      {/* ═══ SECTION: Core Configuration (§24) ═══ */}
      <Section id="core" icon="&#9881;&#65039;" title="Core Configuration" tag="§24" collapsed={!!collapsed.core} onToggle={() => toggle("core")}>
        <div className="grid grid-cols-2 gap-3.5 mb-6">
          <div>
            <FormLabel>Identifier <FtParam name="freqai.identifier" /></FormLabel>
            <FormInput type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="unique-freqai-model-1" />
          </div>
          <div>
            <FormLabel>Model <FtParam name="freqai.model_training_parameters" /></FormLabel>
            <FormSelect value={model} onChange={(e) => setModel(e.target.value)}>
              <option>LightGBMRegressor</option>
              <option>LightGBMClassifier</option>
              <option>XGBoostRegressor</option>
              <option>XGBoostClassifier</option>
              <option>PyTorchRegressor</option>
              <option>PyTorchClassifier</option>
            </FormSelect>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3.5 mb-6">
          <div>
            <FormLabel>Train Period <FtParam name="train_period_days" /></FormLabel>
            <FormInput type="number" value={trainPeriodDays} onChange={(e) => setTrainPeriodDays(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Backtest Period <FtParam name="backtest_period_days" /></FormLabel>
            <FormInput type="number" value={backtestPeriodDays} onChange={(e) => setBacktestPeriodDays(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Live Retrain Hours <FtParam name="live_retrain_hours" /></FormLabel>
            <FormInput type="number" value={liveRetrainHours} onChange={(e) => setLiveRetrainHours(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Expired Hours <FtParam name="expired_hours" /></FormLabel>
            <FormInput type="number" value={expiredHours} onChange={(e) => setExpiredHours(Number(e.target.value))} min={1} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5 mb-6">
          <div>
            <FormLabel>Purge Old Models <FtParam name="purge_old_models" /></FormLabel>
            <FormInput type="number" value={purgeOldModels} onChange={(e) => setPurgeOldModels(Number(e.target.value))} min={0} />
          </div>
          <div className="flex flex-col justify-end">
            <Toggle on={continualLearning} onChange={() => setContinualLearning(!continualLearning)} label="Continual Learning" sub="freqai.continual_learning" />
          </div>
        </div>

        <Toggle on={activateTensorboard} onChange={() => setActivateTensorboard(!activateTensorboard)} label="Activate TensorBoard" sub="freqai.activate_tensorboard" />
        <div className="mt-3">
          <Toggle on={waitForTrainingOnReload} onChange={() => setWaitForTrainingOnReload(!waitForTrainingOnReload)} label="Wait for Training on Reload" sub="freqai.wait_for_training_iteration_on_reload" />
        </div>
        <div className="mt-3 p-3 px-3.5 rounded-md border border-red/30 bg-red/[0.04]">
          <Toggle on={overrideExchangeCheck} onChange={() => setOverrideExchangeCheck(!overrideExchangeCheck)} label="Override Exchange Check" sub="freqai.override_exchange_check — ⚠️ Force FreqAI on limited-support exchanges" />
        </div>
      </Section>

      {/* ═══ SECTION: Feature Parameters (§24) ═══ */}
      <Section id="features" icon="&#128208;" title="Feature Parameters" tag="§24" collapsed={!!collapsed.features} onToggle={() => toggle("features")}>
        <div className="mb-6">
          <FormLabel>Include Timeframes <FtParam name="include_timeframes" /></FormLabel>
          <div className="flex flex-wrap gap-1.5">
            {allTimeframes.map((tf) => (
              <Chip key={tf} label={tf} selected={selectedTimeframes.includes(tf)} onClick={() => toggleMulti(selectedTimeframes, setSelectedTimeframes, tf)} />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <FormLabel>Include Corr Pairlist <FtParam name="include_corr_pairlist" /></FormLabel>
          <div className="flex flex-wrap gap-1.5">
            {allCorrPairs.map((p) => (
              <Chip key={p} label={p} selected={selectedCorrPairs.includes(p)} onClick={() => toggleMulti(selectedCorrPairs, setSelectedCorrPairs, p)} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3.5 mb-6">
          <div>
            <FormLabel>Include Shifted Candles <FtParam name="include_shifted_candles" /></FormLabel>
            <FormInput type="number" value={includeShiftedCandles} onChange={(e) => setIncludeShiftedCandles(Number(e.target.value))} min={0} />
          </div>
          <div>
            <FormLabel>Label Period Candles <FtParam name="label_period_candles" /></FormLabel>
            <FormInput type="number" value={labelPeriodCandles} onChange={(e) => setLabelPeriodCandles(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Fit Live Predictions <FtParam name="fit_live_predictions_candles" /></FormLabel>
            <FormInput type="number" value={fitLivePredictions} onChange={(e) => setFitLivePredictions(Number(e.target.value))} min={0} />
          </div>
        </div>

        <div className="mb-6">
          <FormLabel>Indicator Periods (Candles) <FtParam name="indicator_periods_candles" /></FormLabel>
          <ArrayTagInput values={indicatorPeriods} onChange={setIndicatorPeriods} placeholder="Add period, press Enter" />
        </div>

        <div>
          <FormLabel>Test Size <FtParam name="data_split_parameters.test_size" /></FormLabel>
          <SliderRow min={0} max={100} value={testSize} onChange={setTestSize} format={(v) => (v / 100).toFixed(2)} />
        </div>
      </Section>

      {/* ═══ SECTION: Feature Engineering Methods (§24) ═══ */}
      <Section id="engineering" icon="&#128295;" title="Feature Engineering Methods" tag="§24" collapsed={!!collapsed.engineering} onToggle={() => toggle("engineering")}>
        <div className="mb-4">
          <FormLabel>Method Selector</FormLabel>
          <div className="flex flex-wrap gap-1.5">
            {methods.map((m) => (
              <Chip key={m} label={m} selected={selectedMethod === m} onClick={() => setSelectedMethod(m)} />
            ))}
          </div>
        </div>

        <div className="p-3 px-3.5 rounded-md bg-accent/[0.06] border border-accent/[0.15] text-[11px] text-text-2 leading-relaxed">
          <strong className="text-text-0">Feature Expansion</strong><br />
          Features are expanded as: <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">Periods</code> x{" "}
          <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">Timeframes</code> x{" "}
          <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">Shifted Candles</code> x{" "}
          <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">Corr Pairs</code>
          <br /><br />
          <strong className="text-text-0">Column Naming Convention</strong><br />
          <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">%</code> prefix = feature column (used for training)<br />
          <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">%%</code> prefix = plot-only column (not used in training)<br />
          <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">&amp;</code> prefix = target / label column<br />
          <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">do_predict</code> = outlier detection flag (1 = normal, 0 = outlier)
        </div>

        <div className="mt-4 p-3 px-3.5 rounded-md bg-bg-3 border border-border text-[11px] text-text-2 leading-relaxed">
          <strong className="text-text-0">set_freqai_targets()</strong> <span className="text-purple font-mono text-[10px]">IStrategy callback</span><br />
          Define target labels in your strategy&apos;s <code className="font-mono text-[11px] text-purple bg-bg-2 px-1 py-px rounded">set_freqai_targets()</code> method.
          Use the <code className="font-mono text-[11px] text-purple bg-bg-2 px-1 py-px rounded">&amp;</code> prefix for target columns (e.g. <code className="font-mono text-[11px] text-purple bg-bg-2 px-1 py-px rounded">&amp;-s_close</code>).
          This method is called automatically by FreqAI during training/prediction to set the labels your model will learn from.
        </div>
      </Section>

      {/* ═══ SECTION: Reinforcement Learning (§25) ═══ */}
      <Section id="rl" icon="&#127918;" title="Reinforcement Learning" tag="§25" collapsed={!!collapsed.rl} onToggle={() => toggle("rl")}>
        <div className="grid grid-cols-3 gap-3.5 mb-6">
          <div>
            <FormLabel>Model Type <FtParam name="rl_config.model_type" /></FormLabel>
            <FormSelect value={rlModelType} onChange={(e) => setRlModelType(e.target.value)}>
              <option>PPO</option>
              <option>A2C</option>
              <option>DQN</option>
            </FormSelect>
          </div>
          <div>
            <FormLabel>Policy Type <FtParam name="rl_config.policy_type" /></FormLabel>
            <FormSelect value={rlPolicyType} onChange={(e) => setRlPolicyType(e.target.value)}>
              <option>MlpPolicy</option>
              <option>CnnPolicy</option>
            </FormSelect>
          </div>
          <div>
            <FormLabel>Environment <Hint text="RL env class" /></FormLabel>
            <FormSelect value={rlEnvironment} onChange={(e) => setRlEnvironment(e.target.value)}>
              <option>Base3ActionRLEnv</option>
              <option>Base4ActionRLEnv</option>
              <option>Base5ActionRLEnv</option>
            </FormSelect>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3.5 mb-6">
          <div>
            <FormLabel>Train Cycles <FtParam name="rl_config.train_cycles" /></FormLabel>
            <FormInput type="number" value={trainCycles} onChange={(e) => setTrainCycles(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Max Trade Duration <FtParam name="max_trade_duration_candles" /></FormLabel>
            <FormInput type="number" value={maxTradeDuration} onChange={(e) => setMaxTradeDuration(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Max Training Drawdown <FtParam name="max_training_drawdown_pct" /></FormLabel>
            <FormInput type="number" value={maxTrainingDrawdown} onChange={(e) => setMaxTrainingDrawdown(e.target.value)} step={0.01} min={0} max={1} />
          </div>
        </div>

        <div className="mb-4">
          <Toggle on={addStateInfo} onChange={() => setAddStateInfo(!addStateInfo)} label="Add State Info" sub="rl_config.add_state_info" />
        </div>

        <div className="grid grid-cols-2 gap-3.5 mb-6">
          <div>
            <FormLabel>CPU Count <FtParam name="rl_config.cpu_count" /></FormLabel>
            <FormInput type="number" value={rlCpuCount} onChange={(e) => setRlCpuCount(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Net Architecture <FtParam name="rl_config.net_arch" /></FormLabel>
            <ArrayTagInput values={rlNetArch} onChange={setRlNetArch} placeholder="Add layer size, press Enter" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-y-3.5 gap-x-6 mb-6">
          <Toggle on={rlRandomizeStart} onChange={() => setRlRandomizeStart(!rlRandomizeStart)} label="Randomize Starting Position" sub="rl_config.randomize_starting_position" />
          <Toggle on={rlDropOhlc} onChange={() => setRlDropOhlc(!rlDropOhlc)} label="Drop OHLC from Features" sub="rl_config.drop_ohlc_from_features" />
          <Toggle on={rlProgressBar} onChange={() => setRlProgressBar(!rlProgressBar)} label="Show Progress Bar" sub="rl_config.progress_bar" />
        </div>

        <div className="mt-3.5">
          <FormLabel>Model Reward Parameters <FtParam name="model_reward_parameters" /></FormLabel>
          <KvEditor rows={rewardParams} onChange={setRewardParams} />
        </div>
      </Section>

      {/* ═══ SECTION: Data Processing & Outlier Detection (§26) ═══ */}
      <Section id="outlier" icon="&#128300;" title="Data Processing & Outlier Detection" tag="§26" collapsed={!!collapsed.outlier} onToggle={() => toggle("outlier")}>
        <div className="grid grid-cols-3 gap-3.5 mb-6">
          <div>
            <FormLabel>Data Kitchen Thread Count <FtParam name="data_kitchen_thread_count" /></FormLabel>
            <FormInput type="number" value={dataKitchenThreadCount} onChange={(e) => setDataKitchenThreadCount(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Buffer Train Data Candles <FtParam name="buffer_train_data_candles" /></FormLabel>
            <FormInput type="number" value={bufferTrainDataCandles} onChange={(e) => setBufferTrainDataCandles(Number(e.target.value))} min={0} />
          </div>
          <div>
            <FormLabel>Noise Std Deviation <FtParam name="noise_standard_deviation" /></FormLabel>
            <FormInput type="number" value={noiseStdDev} onChange={(e) => setNoiseStdDev(e.target.value)} step={0.01} min={0} />
          </div>
        </div>

        <div className="mb-6">
          <FormLabel>Weight Factor <FtParam name="weight_factor" /></FormLabel>
          <SliderRow min={0} max={100} value={weightFactor} onChange={setWeightFactor} format={(v) => (v / 10).toFixed(1)} />
        </div>

        {/* Toggles grid */}
        <div className="grid grid-cols-2 gap-y-3.5 gap-x-6 mb-6">
          <Toggle on={saveBacktestModels} onChange={() => setSaveBacktestModels(!saveBacktestModels)} label="Save Backtest Models" sub="save_backtest_models" />
          <Toggle on={writeMetricsToDisk} onChange={() => setWriteMetricsToDisk(!writeMetricsToDisk)} label="Write Metrics to Disk" sub="write_metrics_to_disk" />
          <Toggle on={reduceDfFootprint} onChange={() => setReduceDfFootprint(!reduceDfFootprint)} label="Reduce DF Footprint" sub="reduce_df_footprint" />
          <Toggle on={shuffleAfterSplit} onChange={() => setShuffleAfterSplit(!shuffleAfterSplit)} label="Shuffle After Split" sub="shuffle_after_split" />
          <Toggle on={reverseTrainTestOrder} onChange={() => setReverseTrainTestOrder(!reverseTrainTestOrder)} label="Reverse Train/Test Order" sub="reverse_train_test_order" />
          <Toggle on={principalComponentAnalysis} onChange={() => setPrincipalComponentAnalysis(!principalComponentAnalysis)} label="Principal Component Analysis" sub="principal_component_analysis" />
        </div>

        {/* Outlier Detection Methods */}
        <div className="border-t border-border pt-4 mt-1">
          <div className="text-xs font-semibold text-text-0 mb-3">Outlier Detection Methods</div>

          <div className="flex flex-col gap-3">
            {/* SVM */}
            <div className="p-3 px-3.5 rounded-md border border-border bg-bg-3">
              <div className="mb-2">
                <Toggle on={useSVM} onChange={() => setUseSVM(!useSVM)} label="SVM Outlier Removal" sub="use_SVM_to_remove_outliers" />
              </div>
              <div className="max-w-[300px]">
                <FormLabel>SVM Nu <FtParam name="svm_params.nu" /></FormLabel>
                <FormInput type="number" value={svmNu} onChange={(e) => setSvmNu(e.target.value)} step={0.01} min={0} max={1} />
              </div>
            </div>

            {/* DBSCAN */}
            <div className="p-3 px-3.5 rounded-md border border-border bg-bg-3">
              <Toggle on={useDBSCAN} onChange={() => setUseDBSCAN(!useDBSCAN)} label="DBSCAN Outlier Removal" sub="use_DBSCAN_to_remove_outliers" />
            </div>

            {/* DI Threshold */}
            <div className="p-3 px-3.5 rounded-md border border-border bg-bg-3">
              <div className="grid grid-cols-2 gap-3.5 max-w-[500px]">
                <div>
                  <FormLabel>DI Threshold <FtParam name="DI_threshold" /></FormLabel>
                  <FormInput type="number" value={diThreshold} onChange={(e) => setDiThreshold(e.target.value)} step={0.1} min={0} />
                </div>
                <div>
                  <FormLabel>Outlier Protection % <FtParam name="outlier_protection_percentage" /></FormLabel>
                  <FormInput type="number" value={outlierProtectionPct} onChange={(e) => setOutlierProtectionPct(Number(e.target.value))} min={0} max={100} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SVM Params JSON editor */}
        <div className="border-t border-border pt-4 mt-4">
          <FormLabel>SVM Parameters (JSON) <FtParam name="svm_params" /></FormLabel>
          <textarea
            value={svmParamsJson}
            onChange={(e) => setSvmParamsJson(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-md border border-border bg-bg-2 text-text-0 text-xs font-mono outline-none transition-colors focus:border-accent placeholder:text-text-3 resize-y"
            placeholder='{"shuffle": false, "nu": 0.1, "kernel": "rbf"}'
          />
        </div>

        {/* Plot Feature Importances */}
        <div className="mt-4 max-w-[300px]">
          <FormLabel>Plot Feature Importances <FtParam name="plot_feature_importances" /></FormLabel>
          <FormInput type="number" value={plotFeatureImportances} onChange={(e) => setPlotFeatureImportances(Number(e.target.value))} min={0} />
          <div className="text-[10px] text-text-3 mt-1">Number of top features to plot. 0 = disabled.</div>
        </div>
      </Section>

      {/* ═══ SECTION: PyTorch Configuration (§24) ═══ */}
      <Section id="pytorch" icon="&#128293;" title="PyTorch Configuration" tag="§24" collapsed={!!collapsed.pytorch} onToggle={() => toggle("pytorch")}>
        <div className="p-3 px-3.5 rounded-md bg-accent/[0.06] border border-accent/[0.15] text-[11px] text-text-2 leading-relaxed mb-4">
          These parameters apply when using <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">PyTorchRegressor</code> or{" "}
          <code className="font-mono text-[11px] text-purple bg-bg-3 px-1 py-px rounded">PyTorchClassifier</code> as the model type.
        </div>

        <div className="grid grid-cols-4 gap-3.5">
          <div>
            <FormLabel>Learning Rate <FtParam name="learning_rate" /></FormLabel>
            <FormInput type="text" value={learningRate} onChange={(e) => setLearningRate(e.target.value)} placeholder="e.g. 0.001" />
          </div>
          <div>
            <FormLabel>Epochs <FtParam name="trainer_kwargs.n_epochs" /></FormLabel>
            <FormInput type="number" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Batch Size <FtParam name="trainer_kwargs.batch_size" /></FormLabel>
            <FormInput type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} min={1} />
          </div>
          <div>
            <FormLabel>Conv Width <FtParam name="conv_width" /></FormLabel>
            <FormInput type="number" value={convWidth} onChange={(e) => setConvWidth(Number(e.target.value))} min={1} />
          </div>
        </div>
      </Section>

      {/* ═══ SAVE BAR ═══ */}
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!selectedBotId || configLoading}
          className="px-5 py-2.5 rounded-md bg-accent text-white text-[13px] font-semibold cursor-pointer transition-all hover:bg-accent-dim hover:-translate-y-px flex items-center gap-2 disabled:opacity-50"
        >
          💾 Save FreqAI Config
        </button>
        <button
          type="button"
          className="px-3.5 py-2 rounded-md border border-border bg-bg-2 text-text-1 text-xs font-medium cursor-pointer transition-all hover:border-border-hover hover:bg-bg-3 flex items-center gap-1.5"
        >
          ↵ Reset to Defaults
        </button>
      </div>

      </>}

    </AppShell>
  );
}
