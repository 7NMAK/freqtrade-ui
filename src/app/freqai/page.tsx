"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import { TOOLTIPS } from "@/lib/tooltips";
import { getBots, botConfig, saveBotConfig } from "@/lib/api";
import type { Bot, FTShowConfig } from "@/types";

/* ─── Toggle Component ─── */
function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onChange}
        className={`relative w-9 h-5 rounded-full border cursor-pointer transition-all flex-shrink-0 ${
          on ? "bg-emerald-500/10 border-emerald-500" : "bg-muted border-border"
        }`}
      >
        <span
          className={`absolute top-[2px] w-3.5 h-3.5 rounded-full transition-all ${
            on ? "bg-green left-[17px]" : "bg-text-3 left-[2px]"
          }`}
        />
      </button>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
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
      className={`px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-all ${
        selected
          ? "border-primary bg-primary-glow text-primary"
          : "border-border bg-muted/50 text-muted-foreground hover:border-border-border hover:border-ring hover:text-muted-foreground hover:bg-muted"
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
    <div id={id} className="bg-muted/50 border border-border rounded-card mb-6 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer select-none transition-colors hover:bg-muted"
      >
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          {title}
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-glow text-primary tracking-wide">
            {tag}
          </span>
        </div>
        <span className={`text-xs text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`}>
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
    <div className="flex flex-wrap gap-1.5 p-2 px-2.5 rounded-md border border-border bg-muted/50 min-h-[40px] items-center cursor-text focus-within:border-primary">
      {values.map((v, i) => (
        <span key={`tag-${i}-${v}`} className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-foreground text-xs font-mono">
          {v}
          <button type="button" onClick={() => remove(i)} className="text-muted-foreground text-xs hover:text-rose-500 cursor-pointer">
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
        className="border-none bg-transparent text-foreground text-xs outline-none flex-1 min-w-[60px] placeholder:text-muted-foreground"
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
          <div key={`kv-${i}-${r.key}`} className="flex gap-2 items-center">
            <input
              className="flex-1 px-2.5 py-2 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary"
              value={r.key}
              onChange={(e) => updateRow(i, "key", e.target.value)}
              placeholder="key"
            />
            <input
              className="flex-1 px-2.5 py-2 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary"
              value={r.value}
              onChange={(e) => updateRow(i, "value", e.target.value)}
              placeholder="value"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="w-7 h-7 rounded border border-border bg-muted text-muted-foreground cursor-pointer flex items-center justify-center text-sm transition-all hover:border-rose-500 hover:text-rose-500 hover:bg-rose-500/10 flex-shrink-0"
            >
              x
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border text-muted-foreground text-xs cursor-pointer transition-all hover:border-primary hover:text-primary mt-1.5 w-fit"
      >
        + Add Parameter
      </button>
    </div>
  );
}

/* ─── Form helpers ─── */
function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
      {children}
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <span className="font-normal text-muted-foreground normal-case tracking-normal text-xs">{text}</span>;
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
    />
  );
}

function FormSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none transition-colors focus:border-primary cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23808098%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_12px_center]"
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
        className="flex-1 appearance-none h-1 rounded bg-muted outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg-0"
      />
      <span className="text-xs font-semibold text-foreground min-w-[36px] text-right font-mono">
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

  // Populate form state from a loaded FT config object — typed via FTShowConfig
  function applyConfig(cfg: FTShowConfig) {
    const fai = cfg.freqai;
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

    // model_training_parameters — typed via FTModelTrainingParameters
    const mtp = fai.model_training_parameters;
    if (mtp && typeof mtp.model_type === "string") setModel(mtp.model_type);

    // feature_parameters — typed via FTFeatureParameters
    const fp = fai.feature_parameters;
    if (fp) {
      if (Array.isArray(fp.include_timeframes)) setSelectedTimeframes(fp.include_timeframes);
      if (Array.isArray(fp.include_corr_pairlist)) setSelectedCorrPairs(fp.include_corr_pairlist);
      if (typeof fp.include_shifted_candles === "number") setIncludeShiftedCandles(fp.include_shifted_candles);
      if (typeof fp.label_period_candles === "number") setLabelPeriodCandles(fp.label_period_candles);
      if (Array.isArray(fp.indicator_periods_candles)) setIndicatorPeriods(fp.indicator_periods_candles.map(String));
      if (typeof fp.shuffle_after_split === "boolean") setShuffleAfterSplit(fp.shuffle_after_split);
      if (typeof fp.principal_component_analysis === "boolean") setPrincipalComponentAnalysis(fp.principal_component_analysis);
      if (typeof fp.use_SVM_to_remove_outliers === "boolean") setUseSVM(fp.use_SVM_to_remove_outliers);
      if (typeof fp.use_DBSCAN_to_remove_outliers === "boolean") setUseDBSCAN(fp.use_DBSCAN_to_remove_outliers);
      if (typeof fp.DI_threshold === "number") setDiThreshold(String(fp.DI_threshold));
      if (typeof fp.weight_factor === "number") setWeightFactor(Math.round(fp.weight_factor * 10));
      if (fp.svm_params && typeof fp.svm_params.nu === "number") setSvmNu(String(fp.svm_params.nu));
    }

    // data_split_parameters — typed via FTDataSplitParameters
    const dsp = fai.data_split_parameters;
    if (dsp && typeof dsp.test_size === "number") setTestSize(Math.round(dsp.test_size * 100));

    // rl_config — typed via FTRLConfig
    const rl = fai.rl_config;
    if (rl) {
      if (typeof rl.model_type === "string") setRlModelType(rl.model_type);
      if (typeof rl.policy_type === "string") setRlPolicyType(rl.policy_type);
      if (typeof rl.environment === "string") setRlEnvironment(rl.environment);
      if (typeof rl.train_cycles === "number") setTrainCycles(rl.train_cycles);
      if (typeof rl.max_trade_duration_candles === "number") setMaxTradeDuration(rl.max_trade_duration_candles);
      if (typeof rl.max_training_drawdown_pct === "number") setMaxTrainingDrawdown(String(rl.max_training_drawdown_pct));
      if (typeof rl.add_state_info === "boolean") setAddStateInfo(rl.add_state_info);
      if (typeof rl.cpu_count === "number") setRlCpuCount(rl.cpu_count);
      if (Array.isArray(rl.net_arch)) setRlNetArch(rl.net_arch.map(String));
      if (typeof rl.randomize_starting_position === "boolean") setRlRandomizeStart(rl.randomize_starting_position);
      if (typeof rl.drop_ohlc_from_features === "boolean") setRlDropOhlc(rl.drop_ohlc_from_features);
      if (typeof rl.progress_bar === "boolean") setRlProgressBar(rl.progress_bar);
      if (rl.model_reward_parameters) {
        setRewardParams(Object.entries(rl.model_reward_parameters).map(([key, value]) => ({ key, value: String(value) })));
      }
    }

    // PyTorch config (inside model_training_parameters) — typed via FTModelTrainingParameters
    if (mtp) {
      if (typeof mtp.learning_rate === "number") setLearningRate(String(mtp.learning_rate));
      if (mtp.trainer_kwargs) {
        const tk = mtp.trainer_kwargs;
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
        applyConfig(cfg);
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


  function resetToDefaults() {
    setFreqaiEnabled(true);
    setIdentifier("unique-freqai-model-1");
    setModel("LightGBMRegressor");
    setTrainPeriodDays(30);
    setBacktestPeriodDays(7);
    setLiveRetrainHours(8);
    setExpiredHours(48);
    setPurgeOldModels(2);
    setContinualLearning(true);
    setActivateTensorboard(false);
    setWaitForTrainingOnReload(false);
    setOverrideExchangeCheck(false);
    setIncludeShiftedCandles(2);
    setLabelPeriodCandles(24);
    setFitLivePredictions(100);
    setTestSize(25);
    setSelectedMethod("expand_all");
    setRlModelType("PPO");
    setRlPolicyType("MlpPolicy");
    toast.success("Reset to defaults.");
  }
  return (
    <AppShell title="FreqAI Configuration">

      {/* Bot selector */}
      <div className="flex items-center gap-3 mb-4 p-3 px-4 bg-muted/50 border border-border rounded-card text-xs">
        <span className="text-muted-foreground uppercase tracking-wide font-semibold shrink-0">Target Bot</span>
        <select
          value={selectedBotId}
          onChange={(e) => setSelectedBotId(e.target.value)}
          disabled={configLoading}
          className="bg-card border border-border rounded-btn px-3 py-1.5 text-xs text-muted-foreground outline-none focus:border-primary cursor-pointer min-w-[200px] disabled:opacity-50"
        >
          <option value="">Select bot...</option>
          {bots.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.is_dry_run ? "PAPER" : "LIVE"})</option>
          ))}
        </select>
        {configLoading && (
          <span className="text-xs text-primary animate-pulse">Loading config...</span>
        )}
      </div>

      {/* No bots available */}
      {!botsLoading && bots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4 opacity-40">&#129504;</div>
          <div className="text-sm font-semibold text-muted-foreground mb-1">No Bots Available</div>
          <div className="text-xs text-muted-foreground max-w-sm">
            Register a bot in the Settings page first, then come back here to configure FreqAI.
          </div>
        </div>
      )}

      {/* Loading spinner while fetching config */}
      {configLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-xs text-muted-foreground">Loading FreqAI configuration...</span>
        </div>
      )}

      {/* Main content - hidden when no bots or loading */}
      {!configLoading && bots.length > 0 && <>

      {/* ═══ MASTER SWITCH ═══ */}
      <div className="flex items-center gap-3.5 p-4 px-[18px] bg-gradient-to-r from-accent/[0.06] to-purple/[0.04] border border-primary/20 rounded-card mb-6">
        <div className="text-2xl">&#129504;</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground mb-0.5">FreqAI Engine</div>
          <div className="text-xs text-muted-foreground">freqai.enabled &mdash; Enable machine learning predictions for all configured bots</div>
        </div>
        <button
          type="button"
          onClick={() => setFreqaiEnabled(!freqaiEnabled)}
          className={`relative w-12 h-[26px] rounded-[13px] border cursor-pointer transition-all flex-shrink-0 ${
            freqaiEnabled ? "bg-emerald-500/10 border-emerald-500" : "bg-muted border-border"
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
            <Tooltip content={TOOLTIPS.freqai_identifier?.description ?? "Unique identifier for this FreqAI model"} configKey="freqai.identifier">
              <FormLabel>Identifier</FormLabel>
            </Tooltip>
            <FormInput type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="unique-freqai-model-1" />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_model_training_parameters?.description ?? "Type of model to train (LightGBM, XGBoost, PyTorch, etc)"} configKey="freqai.model_training_parameters">
              <FormLabel>Model</FormLabel>
            </Tooltip>
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
            <Tooltip content={TOOLTIPS.freqai_train_period_days?.description ?? "Days of historical data to use for training"} configKey="train_period_days">
              <FormLabel>Train Period</FormLabel>
            </Tooltip>
            <FormInput type="number" value={trainPeriodDays} onChange={(e) => setTrainPeriodDays(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_backtest_period_days?.description ?? "Days of data to backtest the model against"} configKey="backtest_period_days">
              <FormLabel>Backtest Period</FormLabel>
            </Tooltip>
            <FormInput type="number" value={backtestPeriodDays} onChange={(e) => setBacktestPeriodDays(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_live_retrain_hours?.description ?? "Hours between retraining the model during live trading"} configKey="live_retrain_hours">
              <FormLabel>Live Retrain Hours</FormLabel>
            </Tooltip>
            <FormInput type="number" value={liveRetrainHours} onChange={(e) => setLiveRetrainHours(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_expired_hours?.description ?? "Hours after which a model prediction expires"} configKey="expired_hours">
              <FormLabel>Expired Hours</FormLabel>
            </Tooltip>
            <FormInput type="number" value={expiredHours} onChange={(e) => setExpiredHours(Number(e.target.value))} min={1} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5 mb-6">
          <div>
            <Tooltip content={TOOLTIPS.freqai_purge_old_models?.description ?? "Number of old models to keep before deletion"} configKey="purge_old_models">
              <FormLabel>Purge Old Models</FormLabel>
            </Tooltip>
            <FormInput type="number" value={purgeOldModels} onChange={(e) => setPurgeOldModels(Number(e.target.value))} min={0} />
          </div>
          <div className="flex flex-col justify-end">
            <Tooltip content={TOOLTIPS.freqai_continual_learning?.description ?? "Enable continual/incremental learning"} configKey="freqai.continual_learning">
              <Toggle on={continualLearning} onChange={() => setContinualLearning(!continualLearning)} label="Continual Learning" />
            </Tooltip>
          </div>
        </div>

        <Tooltip content={TOOLTIPS.freqai_activate_tensorboard?.description ?? "Enable TensorBoard logging for training metrics"} configKey="freqai.activate_tensorboard">
          <Toggle on={activateTensorboard} onChange={() => setActivateTensorboard(!activateTensorboard)} label="Activate TensorBoard" />
        </Tooltip>
        <div className="mt-3">
          <Tooltip content={TOOLTIPS.freqai_wait_for_training?.description ?? "Wait for training iteration to complete on reload"} configKey="freqai.wait_for_training_iteration_on_reload">
            <Toggle on={waitForTrainingOnReload} onChange={() => setWaitForTrainingOnReload(!waitForTrainingOnReload)} label="Wait for Training on Reload" />
          </Tooltip>
        </div>
        <div className="mt-3 p-3 px-3.5 rounded-md border border-rose-500/30 bg-red/[0.04]">
          <Tooltip content={TOOLTIPS.freqai_override_exchange_check?.description ?? "Force FreqAI on limited-support exchanges"} configKey="freqai.override_exchange_check">
            <Toggle on={overrideExchangeCheck} onChange={() => setOverrideExchangeCheck(!overrideExchangeCheck)} label="Override Exchange Check ⚠️" />
          </Tooltip>
        </div>
      </Section>

      {/* ═══ SECTION: Feature Parameters (§24) ═══ */}
      <Section id="features" icon="&#128208;" title="Feature Parameters" tag="§24" collapsed={!!collapsed.features} onToggle={() => toggle("features")}>
        <div className="mb-6">
          <Tooltip content={TOOLTIPS.freqai_include_timeframes?.description ?? "Timeframes to include in feature generation"} configKey="include_timeframes">
            <FormLabel>Include Timeframes</FormLabel>
          </Tooltip>
          <div className="flex flex-wrap gap-1.5">
            {allTimeframes.map((tf) => (
              <Chip key={tf} label={tf} selected={selectedTimeframes.includes(tf)} onClick={() => toggleMulti(selectedTimeframes, setSelectedTimeframes, tf)} />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <Tooltip content={TOOLTIPS.freqai_include_corr_pairlist?.description ?? "Correlated pairs to include in feature generation"} configKey="include_corr_pairlist">
            <FormLabel>Include Corr Pairlist</FormLabel>
          </Tooltip>
          <div className="flex flex-wrap gap-1.5">
            {allCorrPairs.map((p) => (
              <Chip key={p} label={p} selected={selectedCorrPairs.includes(p)} onClick={() => toggleMulti(selectedCorrPairs, setSelectedCorrPairs, p)} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3.5 mb-6">
          <div>
            <Tooltip content={TOOLTIPS.freqai_include_shifted_candles?.description ?? "Number of shifted candles to include"} configKey="include_shifted_candles">
              <FormLabel>Include Shifted Candles</FormLabel>
            </Tooltip>
            <FormInput type="number" value={includeShiftedCandles} onChange={(e) => setIncludeShiftedCandles(Number(e.target.value))} min={0} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_label_period_candles?.description ?? "Number of candles in a training label"} configKey="label_period_candles">
              <FormLabel>Label Period Candles</FormLabel>
            </Tooltip>
            <FormInput type="number" value={labelPeriodCandles} onChange={(e) => setLabelPeriodCandles(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_fit_live_predictions?.description ?? "Number of candles to fit in live predictions"} configKey="fit_live_predictions_candles">
              <FormLabel>Fit Live Predictions</FormLabel>
            </Tooltip>
            <FormInput type="number" value={fitLivePredictions} onChange={(e) => setFitLivePredictions(Number(e.target.value))} min={0} />
          </div>
        </div>

        <div className="mb-6">
          <Tooltip content={TOOLTIPS.freqai_indicator_periods?.description ?? "Periods to use for indicator calculations"} configKey="indicator_periods_candles">
            <FormLabel>Indicator Periods (Candles)</FormLabel>
          </Tooltip>
          <ArrayTagInput values={indicatorPeriods} onChange={setIndicatorPeriods} placeholder="Add period, press Enter" />
        </div>

        <div>
          <Tooltip content={TOOLTIPS.freqai_test_size?.description ?? "Proportion of data to use for testing"} configKey="data_split_parameters.test_size">
            <FormLabel>Test Size</FormLabel>
          </Tooltip>
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

        <div className="p-3 px-3.5 rounded-md bg-primary/[0.06] border border-primary/[0.15] text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Feature Expansion</strong><br />
          Features are expanded as: <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">Periods</code> x{" "}
          <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">Timeframes</code> x{" "}
          <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">Shifted Candles</code> x{" "}
          <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">Corr Pairs</code>
          <br /><br />
          <strong className="text-foreground">Column Naming Convention</strong><br />
          <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">%</code> prefix = feature column (used for training)<br />
          <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">%%</code> prefix = plot-only column (not used in training)<br />
          <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">&amp;</code> prefix = target / label column<br />
          <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">do_predict</code> = outlier detection flag (1 = normal, 0 = outlier)
        </div>

        <div className="mt-4 p-3 px-3.5 rounded-md bg-muted border border-border text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">set_freqai_targets()</strong> <span className="text-purple font-mono text-xs">IStrategy callback</span><br />
          Define target labels in your strategy&apos;s <code className="font-mono text-xs text-purple bg-muted/50 px-1 py-px rounded">set_freqai_targets()</code> method.
          Use the <code className="font-mono text-xs text-purple bg-muted/50 px-1 py-px rounded">&amp;</code> prefix for target columns (e.g. <code className="font-mono text-xs text-purple bg-muted/50 px-1 py-px rounded">&amp;-s_close</code>).
          This method is called automatically by FreqAI during training/prediction to set the labels your model will learn from.
        </div>
      </Section>

      {/* ═══ SECTION: Reinforcement Learning (§25) ═══ */}
      <Section id="rl" icon="&#127918;" title="Reinforcement Learning" tag="§25" collapsed={!!collapsed.rl} onToggle={() => toggle("rl")}>
        <div className="grid grid-cols-3 gap-3.5 mb-6">
          <div>
            <Tooltip content={TOOLTIPS.freqai_rl_model_type?.description ?? "Reinforcement learning model algorithm"} configKey="rl_config.model_type">
              <FormLabel>Model Type</FormLabel>
            </Tooltip>
            <FormSelect value={rlModelType} onChange={(e) => setRlModelType(e.target.value)}>
              <option>PPO</option>
              <option>A2C</option>
              <option>DQN</option>
            </FormSelect>
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_rl_policy_type?.description ?? "Policy network architecture"} configKey="rl_config.policy_type">
              <FormLabel>Policy Type</FormLabel>
            </Tooltip>
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
            <Tooltip content={TOOLTIPS.freqai_rl_train_cycles?.description ?? "Number of training cycles for RL"} configKey="rl_config.train_cycles">
              <FormLabel>Train Cycles</FormLabel>
            </Tooltip>
            <FormInput type="number" value={trainCycles} onChange={(e) => setTrainCycles(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_max_trade_duration?.description ?? "Maximum candles a trade can stay open"} configKey="max_trade_duration_candles">
              <FormLabel>Max Trade Duration</FormLabel>
            </Tooltip>
            <FormInput type="number" value={maxTradeDuration} onChange={(e) => setMaxTradeDuration(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_max_training_drawdown?.description ?? "Maximum drawdown allowed during training"} configKey="max_training_drawdown_pct">
              <FormLabel>Max Training Drawdown</FormLabel>
            </Tooltip>
            <FormInput type="number" value={maxTrainingDrawdown} onChange={(e) => setMaxTrainingDrawdown(e.target.value)} step={0.01} min={0} max={1} />
          </div>
        </div>

        <div className="mb-4">
          <Tooltip content={TOOLTIPS.freqai_rl_add_state_info?.description ?? "Add agent state info to observations"} configKey="rl_config.add_state_info">
            <Toggle on={addStateInfo} onChange={() => setAddStateInfo(!addStateInfo)} label="Add State Info" />
          </Tooltip>
        </div>

        <div className="grid grid-cols-2 gap-3.5 mb-6">
          <div>
            <Tooltip content={TOOLTIPS.freqai_rl_cpu_count?.description ?? "Number of CPUs for parallel training"} configKey="rl_config.cpu_count">
              <FormLabel>CPU Count</FormLabel>
            </Tooltip>
            <FormInput type="number" value={rlCpuCount} onChange={(e) => setRlCpuCount(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_rl_net_arch?.description ?? "Neural network layer architecture"} configKey="rl_config.net_arch">
              <FormLabel>Net Architecture</FormLabel>
            </Tooltip>
            <ArrayTagInput values={rlNetArch} onChange={setRlNetArch} placeholder="Add layer size, press Enter" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-y-3.5 gap-x-6 mb-6">
          <Tooltip content={TOOLTIPS.freqai_rl_randomize_start?.description ?? "Randomize starting position in RL"} configKey="rl_config.randomize_starting_position">
            <Toggle on={rlRandomizeStart} onChange={() => setRlRandomizeStart(!rlRandomizeStart)} label="Randomize Starting Position" />
          </Tooltip>
          <Tooltip content={TOOLTIPS.freqai_rl_drop_ohlc?.description ?? "Drop OHLC data from features"} configKey="rl_config.drop_ohlc_from_features">
            <Toggle on={rlDropOhlc} onChange={() => setRlDropOhlc(!rlDropOhlc)} label="Drop OHLC from Features" />
          </Tooltip>
          <Tooltip content={TOOLTIPS.freqai_rl_progress_bar?.description ?? "Show progress bar during training"} configKey="rl_config.progress_bar">
            <Toggle on={rlProgressBar} onChange={() => setRlProgressBar(!rlProgressBar)} label="Show Progress Bar" />
          </Tooltip>
        </div>

        <div className="mt-3.5">
          <Tooltip content={TOOLTIPS.freqai_model_reward_parameters?.description ?? "Reward function parameters for RL"} configKey="model_reward_parameters">
            <FormLabel>Model Reward Parameters</FormLabel>
          </Tooltip>
          <KvEditor rows={rewardParams} onChange={setRewardParams} />
        </div>
      </Section>

      {/* ═══ SECTION: Data Processing & Outlier Detection (§26) ═══ */}
      <Section id="outlier" icon="&#128300;" title="Data Processing & Outlier Detection" tag="§26" collapsed={!!collapsed.outlier} onToggle={() => toggle("outlier")}>
        <div className="grid grid-cols-3 gap-3.5 mb-6">
          <div>
            <Tooltip content={TOOLTIPS.freqai_data_kitchen_thread_count?.description ?? "Number of threads for data kitchen processing"} configKey="data_kitchen_thread_count">
              <FormLabel>Data Kitchen Thread Count</FormLabel>
            </Tooltip>
            <FormInput type="number" value={dataKitchenThreadCount} onChange={(e) => setDataKitchenThreadCount(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_buffer_train_data?.description ?? "Buffer candles before training"} configKey="buffer_train_data_candles">
              <FormLabel>Buffer Train Data Candles</FormLabel>
            </Tooltip>
            <FormInput type="number" value={bufferTrainDataCandles} onChange={(e) => setBufferTrainDataCandles(Number(e.target.value))} min={0} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_noise_std_dev?.description ?? "Standard deviation of noise for augmentation"} configKey="noise_standard_deviation">
              <FormLabel>Noise Std Deviation</FormLabel>
            </Tooltip>
            <FormInput type="number" value={noiseStdDev} onChange={(e) => setNoiseStdDev(e.target.value)} step={0.01} min={0} />
          </div>
        </div>

        <div className="mb-6">
          <Tooltip content={TOOLTIPS.freqai_weight_factor?.description ?? "Weight factor for sample importance"} configKey="weight_factor">
            <FormLabel>Weight Factor</FormLabel>
          </Tooltip>
          <SliderRow min={0} max={100} value={weightFactor} onChange={setWeightFactor} format={(v) => (v / 10).toFixed(1)} />
        </div>

        {/* Toggles grid */}
        <div className="grid grid-cols-2 gap-y-3.5 gap-x-6 mb-6">
          <Tooltip content={TOOLTIPS.freqai_save_backtest_models?.description ?? "Save models created during backtesting"} configKey="save_backtest_models">
            <Toggle on={saveBacktestModels} onChange={() => setSaveBacktestModels(!saveBacktestModels)} label="Save Backtest Models" />
          </Tooltip>
          <Tooltip content={TOOLTIPS.freqai_write_metrics?.description ?? "Write training metrics to disk"} configKey="write_metrics_to_disk">
            <Toggle on={writeMetricsToDisk} onChange={() => setWriteMetricsToDisk(!writeMetricsToDisk)} label="Write Metrics to Disk" />
          </Tooltip>
          <Tooltip content={TOOLTIPS.freqai_reduce_df_footprint?.description ?? "Reduce dataframe memory footprint"} configKey="reduce_df_footprint">
            <Toggle on={reduceDfFootprint} onChange={() => setReduceDfFootprint(!reduceDfFootprint)} label="Reduce DF Footprint" />
          </Tooltip>
          <Tooltip content={TOOLTIPS.freqai_shuffle_after_split?.description ?? "Shuffle data after train/test split"} configKey="shuffle_after_split">
            <Toggle on={shuffleAfterSplit} onChange={() => setShuffleAfterSplit(!shuffleAfterSplit)} label="Shuffle After Split" />
          </Tooltip>
          <Tooltip content={TOOLTIPS.freqai_reverse_train_test?.description ?? "Reverse train/test order for validation"} configKey="reverse_train_test_order">
            <Toggle on={reverseTrainTestOrder} onChange={() => setReverseTrainTestOrder(!reverseTrainTestOrder)} label="Reverse Train/Test Order" />
          </Tooltip>
          <Tooltip content={TOOLTIPS.freqai_principal_component_analysis?.description ?? "Apply principal component analysis"} configKey="principal_component_analysis">
            <Toggle on={principalComponentAnalysis} onChange={() => setPrincipalComponentAnalysis(!principalComponentAnalysis)} label="Principal Component Analysis" />
          </Tooltip>
        </div>

        {/* Outlier Detection Methods */}
        <div className="border-t border-border pt-4 mt-1">
          <div className="text-xs font-semibold text-foreground mb-3">Outlier Detection Methods</div>

          <div className="flex flex-col gap-3">
            {/* SVM */}
            <div className="p-3 px-3.5 rounded-md border border-border bg-muted">
              <div className="mb-2">
                <Tooltip content={TOOLTIPS.freqai_use_SVM_to_remove_outliers?.description ?? "Use Support Vector Machine for outlier removal"} configKey="use_SVM_to_remove_outliers">
                  <Toggle on={useSVM} onChange={() => setUseSVM(!useSVM)} label="SVM Outlier Removal" />
                </Tooltip>
              </div>
              <div className="max-w-[300px]">
                <Tooltip content={TOOLTIPS.freqai_svm_nu?.description ?? "Nu parameter for SVM"} configKey="svm_params.nu">
                  <FormLabel>SVM Nu</FormLabel>
                </Tooltip>
                <FormInput type="number" value={svmNu} onChange={(e) => setSvmNu(e.target.value)} step={0.01} min={0} max={1} />
              </div>
            </div>

            {/* DBSCAN */}
            <div className="p-3 px-3.5 rounded-md border border-border bg-muted">
              <Tooltip content={TOOLTIPS.freqai_use_DBSCAN_to_remove_outliers?.description ?? "Use DBSCAN for outlier removal"} configKey="use_DBSCAN_to_remove_outliers">
                <Toggle on={useDBSCAN} onChange={() => setUseDBSCAN(!useDBSCAN)} label="DBSCAN Outlier Removal" />
              </Tooltip>
            </div>

            {/* DI Threshold */}
            <div className="p-3 px-3.5 rounded-md border border-border bg-muted">
              <div className="grid grid-cols-2 gap-3.5 max-w-[500px]">
                <div>
                  <Tooltip content={TOOLTIPS.freqai_di_threshold?.description ?? "Diversity index threshold"} configKey="DI_threshold">
                    <FormLabel>DI Threshold</FormLabel>
                  </Tooltip>
                  <FormInput type="number" value={diThreshold} onChange={(e) => setDiThreshold(e.target.value)} step={0.1} min={0} />
                </div>
                <div>
                  <Tooltip content={TOOLTIPS.freqai_outlier_protection?.description ?? "Percentage protection for outliers"} configKey="outlier_protection_percentage">
                    <FormLabel>Outlier Protection %</FormLabel>
                  </Tooltip>
                  <FormInput type="number" value={outlierProtectionPct} onChange={(e) => setOutlierProtectionPct(Number(e.target.value))} min={0} max={100} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SVM Params JSON editor */}
        <div className="border-t border-border pt-4 mt-4">
          <Tooltip content={TOOLTIPS.freqai_svm_params?.description ?? "SVM parameters in JSON format"} configKey="svm_params">
            <FormLabel>SVM Parameters (JSON)</FormLabel>
          </Tooltip>
          <textarea
            value={svmParamsJson}
            onChange={(e) => setSvmParamsJson(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-xs font-mono outline-none transition-colors focus:border-primary placeholder:text-muted-foreground resize-y"
            placeholder='{"shuffle": false, "nu": 0.1, "kernel": "rbf"}'
          />
        </div>

        {/* Plot Feature Importances */}
        <div className="mt-4 max-w-[300px]">
          <Tooltip content={TOOLTIPS.freqai_plot_feature_importances?.description ?? "Number of top features to plot (0 = disabled)"} configKey="plot_feature_importances">
            <FormLabel>Plot Feature Importances</FormLabel>
          </Tooltip>
          <FormInput type="number" value={plotFeatureImportances} onChange={(e) => setPlotFeatureImportances(Number(e.target.value))} min={0} />
          <div className="text-xs text-muted-foreground mt-1">Number of top features to plot. 0 = disabled.</div>
        </div>
      </Section>

      {/* ═══ SECTION: PyTorch Configuration (§24) ═══ */}
      <Section id="pytorch" icon="&#128293;" title="PyTorch Configuration" tag="§24" collapsed={!!collapsed.pytorch} onToggle={() => toggle("pytorch")}>
        <div className="p-3 px-3.5 rounded-md bg-primary/[0.06] border border-primary/[0.15] text-xs text-muted-foreground leading-relaxed mb-4">
          These parameters apply when using <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">PyTorchRegressor</code> or{" "}
          <code className="font-mono text-xs text-purple bg-muted px-1 py-px rounded">PyTorchClassifier</code> as the model type.
        </div>

        <div className="grid grid-cols-4 gap-3.5">
          <div>
            <Tooltip content={TOOLTIPS.freqai_learning_rate?.description ?? "Learning rate for PyTorch optimizer"} configKey="learning_rate">
              <FormLabel>Learning Rate</FormLabel>
            </Tooltip>
            <FormInput type="text" value={learningRate} onChange={(e) => setLearningRate(e.target.value)} placeholder="e.g. 0.001" />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_epochs?.description ?? "Number of training epochs for PyTorch"} configKey="trainer_kwargs.n_epochs">
              <FormLabel>Epochs</FormLabel>
            </Tooltip>
            <FormInput type="number" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_batch_size?.description ?? "Batch size for PyTorch training"} configKey="trainer_kwargs.batch_size">
              <FormLabel>Batch Size</FormLabel>
            </Tooltip>
            <FormInput type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} min={1} />
          </div>
          <div>
            <Tooltip content={TOOLTIPS.freqai_conv_width?.description ?? "Convolutional layer width"} configKey="conv_width">
              <FormLabel>Conv Width</FormLabel>
            </Tooltip>
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
          className="px-5 py-2.5 rounded-md bg-primary text-white text-sm font-semibold cursor-pointer transition-all hover:bg-primary-dim hover:-translate-y-px flex items-center gap-2 disabled:opacity-50"
        >
          💾 Save FreqAI Config
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="px-3.5 py-2 rounded-md border border-border bg-muted/50 text-muted-foreground text-xs font-medium cursor-pointer transition-all hover:border-border-border hover:border-ring hover:bg-muted flex items-center gap-1.5"
        >
          ↵ Reset to Defaults
        </button>
      </div>

      </>}

    </AppShell>
  );
}
