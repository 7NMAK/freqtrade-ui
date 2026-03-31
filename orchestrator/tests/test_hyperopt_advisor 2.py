"""
Tests for HyperoptAdvisor — merge logic for pre/post analysis.
Tests the pure-Python merge functions without network calls.
"""
from __future__ import annotations

from src.ai_validator.hyperopt_advisor import _merge_pre_hyperopt, _merge_post_hyperopt, _summarize_market


class TestMergePreHyperopt:

    def test_merge_prefers_claude_loss_when_both_present(self):
        """Recommended loss function from Claude takes priority."""
        claude = {
            "recommended_loss_function": "SharpeHyperOptLossDaily",
            "recommended_sampler": "TPESampler",
            "recommended_epochs": 300,
            "spaces_to_optimize": ["buy", "sell"],
            "parameter_suggestions": [],
            "confidence": 0.8,
        }
        grok = {
            "recommended_loss_function": "SortinoHyperOptLossDaily",
            "recommended_sampler": "CmaEsSampler",
            "recommended_epochs": 400,
            "spaces_to_optimize": ["buy", "sell", "roi"],
            "parameter_suggestions": [],
            "confidence": 0.7,
        }
        result = _merge_pre_hyperopt(claude, grok, {})
        assert result["recommended_loss_function"] == "SharpeHyperOptLossDaily"

    def test_merge_epochs_uses_minimum(self):
        """Merged epochs uses the minimum of Claude + Grok (conservative)."""
        claude = {"recommended_epochs": 300, "spaces_to_optimize": [], "parameter_suggestions": []}
        grok = {"recommended_epochs": 500, "spaces_to_optimize": [], "parameter_suggestions": []}
        result = _merge_pre_hyperopt(claude, grok, {})
        assert result["recommended_epochs"] == 300

    def test_merge_spaces_union(self):
        """Merged spaces is the union of both advisors' suggestions."""
        claude = {"spaces_to_optimize": ["buy", "sell"], "parameter_suggestions": [], "recommended_epochs": 100}
        grok = {"spaces_to_optimize": ["sell", "roi", "stoploss"], "parameter_suggestions": [], "recommended_epochs": 100}
        result = _merge_pre_hyperopt(claude, grok, {})
        spaces = set(result["spaces_to_optimize"])
        assert "buy" in spaces
        assert "sell" in spaces
        assert "roi" in spaces
        assert "stoploss" in spaces

    def test_param_intersection_tighter_range(self):
        """Merged parameter ranges use intersection (tighter range)."""
        claude = {
            "parameter_suggestions": [
                {"param_name": "buy_rsi", "suggested_range": [15, 45], "reasoning": "narrow"}
            ],
            "spaces_to_optimize": [], "recommended_epochs": 100,
        }
        grok = {
            "parameter_suggestions": [
                {"param_name": "buy_rsi", "suggested_range": [20, 50], "reasoning": "ok"}
            ],
            "spaces_to_optimize": [], "recommended_epochs": 100,
        }
        current_params = {
            "buy_rsi": {"type": "IntParameter", "low": 10, "high": 60, "default": 30}
        }
        result = _merge_pre_hyperopt(claude, grok, current_params)
        param_suggestion = next(p for p in result["parameter_suggestions"] if p["param_name"] == "buy_rsi")
        # intersection of [15, 45] and [20, 50] = [20, 45]
        assert param_suggestion["suggested_range"][0] == 20
        assert param_suggestion["suggested_range"][1] == 45

    def test_advisors_agree_flag(self):
        """advisors_agree_on_loss is True when both recommend same loss function."""
        same = {"recommended_loss_function": "CalmarHyperOptLoss", "spaces_to_optimize": [], "parameter_suggestions": []}
        result = _merge_pre_hyperopt(same, same, {})
        assert result["advisors_agree_on_loss"] is True

    def test_empty_responses_fallback_to_defaults(self):
        """Empty Claude + Grok responses produce safe defaults."""
        result = _merge_pre_hyperopt({}, {}, {})
        assert result["recommended_loss_function"] == "SharpeHyperOptLossDaily"
        assert result["recommended_sampler"] == "TPESampler"
        assert result["recommended_epochs"] == 500


class TestMergePostHyperopt:

    def test_both_agree_uses_shared_recommendation(self):
        """When both advisors agree on result index, that index is returned."""
        claude = {
            "recommended_result_index": 2,
            "overfitting_risk_scores": [
                {"result_index": 0, "risk_score": 0.7, "verdict": "LIKELY_OVERFIT", "risk_factors": []},
                {"result_index": 1, "risk_score": 0.4, "verdict": "CAUTION", "risk_factors": []},
                {"result_index": 2, "risk_score": 0.2, "verdict": "SAFE", "risk_factors": []},
            ],
            "confidence": 0.85,
        }
        grok = {
            "recommended_result_index": 2,
            "overfitting_risk_scores": [
                {"result_index": 0, "risk_score": 0.8, "verdict": "DANGEROUS", "risk_factors": []},
                {"result_index": 1, "risk_score": 0.35, "verdict": "CAUTION", "risk_factors": []},
                {"result_index": 2, "risk_score": 0.15, "verdict": "SAFE", "risk_factors": []},
            ],
            "confidence": 0.78,
        }
        result = _merge_post_hyperopt(claude, grok)
        assert result["recommended_result_index"] == 2
        assert result["advisors_agree"] is True

    def test_disagreement_picks_lower_risk(self):
        """When advisors disagree, the result with lower risk score wins."""
        claude = {
            "recommended_result_index": 0,
            "overfitting_risk_scores": [
                {"result_index": 0, "risk_score": 0.8, "verdict": "DANGEROUS", "risk_factors": []},
                {"result_index": 1, "risk_score": 0.2, "verdict": "SAFE", "risk_factors": []},
            ],
            "confidence": 0.6,
        }
        grok = {
            "recommended_result_index": 1,
            "overfitting_risk_scores": [
                {"result_index": 0, "risk_score": 0.75, "verdict": "LIKELY_OVERFIT", "risk_factors": []},
                {"result_index": 1, "risk_score": 0.18, "verdict": "SAFE", "risk_factors": []},
            ],
            "confidence": 0.7,
        }
        result = _merge_post_hyperopt(claude, grok)
        assert result["advisors_agree"] is False
        # Result 0 has merged risk ~0.775, result 1 has ~0.19 → picks result 1
        assert result["recommended_result_index"] == 1

    def test_verdict_buckets(self):
        """Correct SAFE/CAUTION/LIKELY_OVERFIT/DANGEROUS verdicts based on avg risk."""
        claude = {
            "recommended_result_index": 0,
            "overfitting_risk_scores": [
                {"result_index": 0, "risk_score": 0.1, "verdict": "SAFE", "risk_factors": []},
                {"result_index": 1, "risk_score": 0.4, "verdict": "CAUTION", "risk_factors": []},
                {"result_index": 2, "risk_score": 0.65, "verdict": "LIKELY_OVERFIT", "risk_factors": []},
                {"result_index": 3, "risk_score": 0.85, "verdict": "DANGEROUS", "risk_factors": []},
            ],
            "confidence": 0.8,
        }
        grok = claude.copy()
        result = _merge_post_hyperopt(claude, grok)
        verdicts = {s["result_index"]: s["verdict"] for s in result["overfitting_risk_scores"][:4]}
        assert verdicts[0] == "SAFE"
        assert verdicts[1] == "CAUTION"
        assert verdicts[2] == "LIKELY_OVERFIT"
        assert verdicts[3] == "DANGEROUS"

    def test_empty_responses_no_crash(self):
        """Empty responses return minimal valid structure."""
        result = _merge_post_hyperopt({}, {})
        assert "recommended_result_index" in result
        assert "advisors_agree" in result


class TestSummarizeMarket:

    def test_uptrend_detected(self):
        """Strong uptrend correctly classified."""
        candles = [{"close": 100.0 + i * 5} for i in range(20)]  # +100% move
        summary = _summarize_market(candles)
        assert "UPTREND" in summary

    def test_downtrend_detected(self):
        """Downtrend correctly classified."""
        candles = [{"close": 500.0 - i * 25} for i in range(20)]
        summary = _summarize_market(candles)
        assert "DOWNTREND" in summary

    def test_empty_candles(self):
        """Empty candles returns safe message."""
        summary = _summarize_market([])
        assert "No" in summary

    def test_ranging_market(self):
        """Minimal price change = RANGING."""
        candles = [{"close": 100.0 + (i % 3) * 0.1} for i in range(10)]
        summary = _summarize_market(candles)
        assert "RANGING" in summary
