"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ══════════════════════════════════════
   FREQAI — ML Model Configuration (Interactive)
   ══════════════════════════════════════ */

const MODELS: Record<string, string[]> = {
  Regression: ["LightGBMRegressor", "XGBoostRegressor", "CatboostRegressor", "SKLearnLineRegressor"],
  Classification: ["LightGBMClassifier", "XGBoostClassifier", "CatboostClassifier"],
  "Reinforcement Learning": ["ReinforcementLearner", "ReinforcementLearner_multiproc", "ReinforcementLearner_4ac", "ReinforcementLearner_5ac"],
};

const FEATURE_METHODS = [
  { name: "feature_engineering_expand_all()", desc: "Auto-expand all features across timeframes" },
  { name: "feature_engineering_expand_basic()", desc: "Expand basic features (OHLCV)" },
  { name: "feature_engineering_standard()", desc: "Standard feature set with RSI, BB, etc." },
];

const CALLBACK_HOOKS = [
  { name: "set_freqai_targets()", desc: "Define ML prediction targets" },
  { name: "feature_engineering_expand_all()", desc: "Feature expansion across TFs" },
  { name: "freqai_predictions_handler()", desc: "Post-processing of predictions" },
];

export default function FreqAIPage() {
  const [activeTab, setActiveTab] = useState("model");

  // Model tab state
  const [selectedModel, setSelectedModel] = useState("LightGBMRegressor");
  const [nEstimators, setNEstimators] = useState("1000");
  const [learningRate, setLearningRate] = useState("0.05");
  const [maxDepth, setMaxDepth] = useState("-1");
  const [numLeaves, setNumLeaves] = useState("31");
  const [noiseStdDev, setNoiseStdDev] = useState("0.05");
  const [diThreshold, setDiThreshold] = useState("0.9");
  const [convolutionFilter, setConvolutionFilter] = useState(false);

  // Features tab state
  const [timeframes, setTimeframes] = useState<Record<string, boolean>>({
    "5m": false, "15m": true, "1h": true, "4h": true, "1d": false,
  });
  const [indicatorPeriods, setIndicatorPeriods] = useState("[10, 20]");
  const [labelPeriod, setLabelPeriod] = useState(24);
  const [shuffleAfterSplit, setShuffleAfterSplit] = useState(true);
  const [bufferTrainData, setBufferTrainData] = useState(false);
  const [featureMethodToggles, setFeatureMethodToggles] = useState<Record<string, boolean>>({
    "feature_engineering_expand_all()": false,
    "feature_engineering_expand_basic()": false,
    "feature_engineering_standard()": false,
  });

  // Training tab state
  const [trainPeriod, setTrainPeriod] = useState("90");
  const [backtestPeriod, setBacktestPeriod] = useState("7");
  const [purgeOldModels, setPurgeOldModels] = useState("2");
  const [predictionOffset, setPredictionOffset] = useState("1");
  const [fitLive, setFitLive] = useState(true);
  const [followMode, setFollowMode] = useState(false);
  const [callbackToggles, setCallbackToggles] = useState<Record<string, boolean>>({
    "set_freqai_targets()": false,
    "feature_engineering_expand_all()": false,
    "freqai_predictions_handler()": false,
  });

  // RL tab state
  const [rewardNadirSlippage, setRewardNadirSlippage] = useState("0.998");
  const [rewardProfitFactor, setRewardProfitFactor] = useState("1.0");
  const [rewardHoldPenalty, setRewardHoldPenalty] = useState("-0.0001");
  const [rewardDrawdownWeight, setRewardDrawdownWeight] = useState("0.4");
  const [maxTradeDuration, setMaxTradeDuration] = useState("300");
  const [addStateInfo, setAddStateInfo] = useState(false);
  const [actionSpace, setActionSpace] = useState("5ac");

  // Training status state
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingComplete, setTrainingComplete] = useState(false);
  const [lossCurve, setLossCurve] = useState<number[]>([]);
  const [featureImportance, setFeatureImportance] = useState<Array<{name: string, imp: number}>>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTraining = useCallback(() => {
    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingComplete(false);
  }, []);

  const stopTraining = useCallback(() => {
    setIsTraining(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isTraining && !trainingComplete) {
      intervalRef.current = setInterval(() => {
        setTrainingProgress(prev => {
          if (prev >= 100) {
            setIsTraining(false);
            setTrainingComplete(true);
            // Simulate receiving the final data payload
            setLossCurve([0.85, 0.72, 0.61, 0.52, 0.45, 0.39, 0.34, 0.30, 0.27, 0.25]);
            setFeatureImportance([
              { name: "rsi_14_1h", imp: 0.18 },
              { name: "bb_width_20_4h", imp: 0.14 },
              { name: "ema_diff_15m", imp: 0.11 },
              { name: "volume_mean_24_1h", imp: 0.09 },
              { name: "macd_signal_4h", imp: 0.07 },
            ]);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 100;
          }
          return prev + 2; // 0->100 in 5 seconds at ~100ms intervals
        });
      }, 100);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isTraining, trainingComplete]);

  const toggleTimeframe = (tf: string) => {
    setTimeframes(prev => ({ ...prev, [tf]: !prev[tf] }));
  };

  const toggleFeatureMethod = (name: string) => {
    setFeatureMethodToggles(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleCallback = (name: string) => {
    setCallbackToggles(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            FreqAI <Badge className="bg-ft-purple/15 text-ft-purple border-ft-purple/20">ML</Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Machine learning model configuration and training</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs" onClick={() => console.log("Load config dialog would open here")}>
            Load Config
          </Button>
          <Button
            className="text-xs bg-ft-purple hover:bg-ft-purple/90"
            onClick={() => {
              setActiveTab("status");
              startTraining();
            }}
          >
            Start Training
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 bg-primary/20 p-1">
          <TabsTrigger value="model" className="text-xs">Model</TabsTrigger>
          <TabsTrigger value="features" className="text-xs">Features</TabsTrigger>
          <TabsTrigger value="training" className="text-xs">Training</TabsTrigger>
          <TabsTrigger value="rl" className="text-xs">RL Params</TabsTrigger>
          <TabsTrigger value="status" className="text-xs">Status</TabsTrigger>
        </TabsList>

        {/* Model Selection */}
        <TabsContent value="model">
          <div className="grid grid-cols-[1fr_1fr] gap-4">
            <Card>
              <CardHeader className="py-4 px-5">
                <CardTitle className="text-sm font-bold">Model Selection</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                {Object.entries(MODELS).map(([group, models]) => (
                  <div key={group}>
                    <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-2 block">{group}</Label>
                    <div className="space-y-1">
                      {models.map(m => (
                        <label key={m} className="flex items-center gap-2 py-2 px-3 rounded-btn cursor-pointer hover:bg-primary/30 transition-colors">
                          <input
                            type="radio"
                            name="model"
                            checked={selectedModel === m}
                            onChange={() => setSelectedModel(m)}
                            className="accent-[hsl(262,83%,58%)]"
                          />
                          <span className="text-xs font-mono text-foreground">{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4 px-5">
                <CardTitle className="text-sm font-bold">Model Parameters</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-2xs text-muted-foreground">n_estimators</Label>
                    <Input value={nEstimators} onChange={e => setNEstimators(e.target.value)} className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label className="text-2xs text-muted-foreground">learning_rate</Label>
                    <Input value={learningRate} onChange={e => setLearningRate(e.target.value)} className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label className="text-2xs text-muted-foreground">max_depth</Label>
                    <Input value={maxDepth} onChange={e => setMaxDepth(e.target.value)} className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label className="text-2xs text-muted-foreground">num_leaves</Label>
                    <Input value={numLeaves} onChange={e => setNumLeaves(e.target.value)} className="mt-1 font-mono" />
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-xs font-bold mb-2 block">Noise & Regularization</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">noise_standard_deviation</Label>
                      <Input value={noiseStdDev} onChange={e => setNoiseStdDev(e.target.value)} className="w-24 font-mono" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">DI threshold</Label>
                      <Input value={diThreshold} onChange={e => setDiThreshold(e.target.value)} className="w-24 font-mono" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch id="conv-width" checked={convolutionFilter} onCheckedChange={setConvolutionFilter} />
                      <Label htmlFor="conv-width" className="text-xs">Convolution Filter</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Feature Engineering */}
        <TabsContent value="features">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-4 px-5">
                <CardTitle className="text-sm font-bold">Feature Configuration</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                <div>
                  <Label className="text-xs mb-2 block">Include Timeframes</Label>
                  <div className="flex flex-wrap gap-2">
                    {["5m", "15m", "1h", "4h", "1d"].map(tf => (
                      <label
                        key={tf}
                        className={`flex items-center gap-1.5 text-xs cursor-pointer px-3 py-1.5 rounded-full border transition-colors ${
                          timeframes[tf]
                            ? "border-ft-purple/50 text-ft-purple bg-ft-purple/10"
                            : "border-border text-muted-foreground hover:border-ft-purple/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={timeframes[tf]}
                          onChange={() => toggleTimeframe(tf)}
                          className="accent-[hsl(262,83%,58%)]"
                        />
                        {tf}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">indicator_periods_candles</Label>
                  <Input value={indicatorPeriods} onChange={e => setIndicatorPeriods(e.target.value)} className="mt-1 font-mono" placeholder="JSON array" />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">label_period_candles: <span className="text-primary font-mono">{labelPeriod}</span></Label>
                  <Slider value={[labelPeriod]} onValueChange={v => setLabelPeriod(v[0])} max={100} step={1} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={shuffleAfterSplit} onCheckedChange={setShuffleAfterSplit} />
                  <Label className="text-xs">shuffle_after_split</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={bufferTrainData} onCheckedChange={setBufferTrainData} />
                  <Label className="text-xs">buffer_train_data_candles</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4 px-5">
                <CardTitle className="text-sm font-bold">Feature Methods</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-3">
                {FEATURE_METHODS.map(m => (
                  <div key={m.name} className="flex items-center justify-between py-3 px-3 bg-primary/20 rounded-btn">
                    <div>
                      <div className="text-xs font-mono font-semibold text-ft-purple">{m.name}</div>
                      <div className="text-2xs text-muted-foreground">{m.desc}</div>
                    </div>
                    <Switch
                      checked={featureMethodToggles[m.name] ?? false}
                      onCheckedChange={() => toggleFeatureMethod(m.name)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Training */}
        <TabsContent value="training">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">train_period_days</Label>
                  <Input value={trainPeriod} onChange={e => setTrainPeriod(e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">backtest_period_days</Label>
                  <Input value={backtestPeriod} onChange={e => setBacktestPeriod(e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">purge_old_models</Label>
                  <Input value={purgeOldModels} onChange={e => setPurgeOldModels(e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">prediction_offset</Label>
                  <Input value={predictionOffset} onChange={e => setPredictionOffset(e.target.value)} className="mt-1 font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Switch checked={fitLive} onCheckedChange={setFitLive} />
                  <Label className="text-xs">fit_live_predictions_candles</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={followMode} onCheckedChange={setFollowMode} />
                  <Label className="text-xs">follow_mode</Label>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs font-bold mb-2 block">Callback Hooks</Label>
                <div className="space-y-2">
                  {CALLBACK_HOOKS.map(cb => (
                    <div key={cb.name} className="flex items-center justify-between py-2 px-3 bg-primary/20 rounded-btn">
                      <div>
                        <div className="text-xs font-mono font-semibold text-ft-purple">{cb.name}</div>
                        <div className="text-2xs text-muted-foreground">{cb.desc}</div>
                      </div>
                      <Switch
                        checked={callbackToggles[cb.name] ?? false}
                        onCheckedChange={() => toggleCallback(cb.name)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RL Parameters */}
        <TabsContent value="rl">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">reward_nadir_slippage</Label>
                  <Input value={rewardNadirSlippage} onChange={e => setRewardNadirSlippage(e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">reward_profit_factor</Label>
                  <Input value={rewardProfitFactor} onChange={e => setRewardProfitFactor(e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">reward_hold_penalty</Label>
                  <Input value={rewardHoldPenalty} onChange={e => setRewardHoldPenalty(e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">reward_drawdown_weight</Label>
                  <Input value={rewardDrawdownWeight} onChange={e => setRewardDrawdownWeight(e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">max_trade_duration_candles</Label>
                  <Input value={maxTradeDuration} onChange={e => setMaxTradeDuration(e.target.value)} className="mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">add_state_info</Label>
                  <Switch checked={addStateInfo} onCheckedChange={setAddStateInfo} />
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs font-bold mb-2 block">Action Space</Label>
                <Select value={actionSpace} onValueChange={setActionSpace}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3ac">3 Actions (buy, sell, hold)</SelectItem>
                    <SelectItem value="4ac">4 Actions (long, short, hold, exit)</SelectItem>
                    <SelectItem value="5ac">5 Actions (long, short, hold, close_long, close_short)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Monitor */}
        <TabsContent value="status">
          <Card>
            <CardContent className="p-5 space-y-4">
              {!isTraining && !trainingComplete && (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-3 h-3 rounded-full bg-ft-green animate-pulse" />
                    <span className="text-sm font-bold text-foreground">No training in progress</span>
                  </div>
                  <div className="bg-primary/20 rounded-lg p-8 text-center">
                    <div className="text-3xl mb-3">🤖</div>
                    <div className="text-sm text-muted-foreground">Start a training job to see real-time progress, loss curves, and feature importance here.</div>
                    <Button className="mt-4 bg-ft-purple hover:bg-ft-purple/90" onClick={startTraining}>
                      Start Training
                    </Button>
                  </div>
                </>
              )}

              {isTraining && (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-3 h-3 rounded-full bg-ft-yellow animate-pulse" />
                    <span className="text-sm font-bold text-foreground">Training in progress... {trainingProgress}%</span>
                  </div>
                  <div className="space-y-3">
                    <div className="w-full bg-primary/30 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-ft-purple rounded-full transition-all duration-100"
                        style={{ width: `${trainingProgress}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-primary/20 rounded-lg p-3">
                        <div className="text-2xs text-muted-foreground">Model</div>
                        <div className="text-xs font-bold text-foreground">{selectedModel}</div>
                      </div>
                      <div className="bg-primary/20 rounded-lg p-3">
                        <div className="text-2xs text-muted-foreground">Epoch</div>
                        <div className="text-xs font-bold text-foreground">{Math.floor(trainingProgress / 10)}/10</div>
                      </div>
                      <div className="bg-primary/20 rounded-lg p-3">
                        <div className="text-2xs text-muted-foreground">Loss</div>
                        <div className="text-xs font-bold text-ft-yellow">{(0.85 - trainingProgress * 0.006).toFixed(4)}</div>
                      </div>
                    </div>
                    <Button variant="outline" className="text-xs text-ft-red border-ft-red/30 hover:bg-ft-red/10" onClick={stopTraining}>
                      Stop Training
                    </Button>
                  </div>
                </>
              )}

              {trainingComplete && (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-3 h-3 rounded-full bg-ft-green" />
                    <span className="text-sm font-bold text-foreground">Training complete</span>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-primary/20 rounded-lg p-3 text-center">
                        <div className="text-2xs text-muted-foreground">Accuracy</div>
                        <div className="text-lg font-bold text-ft-green">87.3%</div>
                      </div>
                      <div className="bg-primary/20 rounded-lg p-3 text-center">
                        <div className="text-2xs text-muted-foreground">Final Loss</div>
                        <div className="text-lg font-bold text-foreground">0.2481</div>
                      </div>
                      <div className="bg-primary/20 rounded-lg p-3 text-center">
                        <div className="text-2xs text-muted-foreground">Val Loss</div>
                        <div className="text-lg font-bold text-foreground">0.2794</div>
                      </div>
                      <div className="bg-primary/20 rounded-lg p-3 text-center">
                        <div className="text-2xs text-muted-foreground">Epochs</div>
                        <div className="text-lg font-bold text-foreground">10</div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-bold mb-2 block">Loss Curve</Label>
                      <div className="bg-primary/20 rounded-lg p-3 flex items-end gap-1 h-24">
                        {lossCurve.map((v, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-ft-purple/60 rounded-t"
                            style={{ height: `${v * 100}%` }}
                            title={`Epoch ${i + 1}: ${v.toFixed(4)}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-bold mb-2 block">Top Feature Importance</Label>
                      <div className="space-y-1.5">
                        {featureImportance.map(f => (
                          <div key={f.name} className="flex items-center gap-2">
                            <span className="text-2xs font-mono text-muted-foreground w-32 truncate">{f.name}</span>
                            <div className="flex-1 bg-primary/30 rounded-full h-2 overflow-hidden">
                              <div className="h-full bg-ft-purple rounded-full" style={{ width: `${f.imp * 100 / 0.18 * 100}%` }} />
                            </div>
                            <span className="text-2xs font-mono text-foreground w-10 text-right">{(f.imp * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="text-xs bg-ft-purple hover:bg-ft-purple/90"
                      onClick={() => {
                        setTrainingComplete(false);
                        startTraining();
                      }}
                    >
                      Re-train
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
