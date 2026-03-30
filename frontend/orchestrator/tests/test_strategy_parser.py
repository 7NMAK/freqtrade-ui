"""
Tests for StrategyParser — parameter extraction from FT strategy files.
"""
from __future__ import annotations

import pytest

from src.ai_validator.strategy_parser import parse_strategy_parameters, format_param_ranges


_SAMPLE_STRATEGY = '''
class SampleStrategy:
    buy_rsi = IntParameter(10, 60, default=30, space="buy")
    sell_rsi = IntParameter(60, 100, default=80, space="sell")
    buy_ema_short = IntParameter(5, 20, default=9, space="buy")
    buy_atr_mult = DecimalParameter(1.0, 3.0, default=1.5, decimals=2, space="buy")
    sell_atr_mult = DecimalParameter(0.5, 2.0, default=1.0, space="sell")
    buy_trigger = CategoricalParameter(["rsi", "ema", "macd"], default="rsi", space="buy")
    use_custom_stoploss = BooleanParameter(default=True, space="stoploss")

    def populate_entry_trend(self, dataframe, metadata):
        if self.buy_rsi.value < dataframe["rsi"]:
            pass
'''


class TestParseStrategyParameters:

    def test_int_parameter_basic(self):
        """IntParameter with all fields is parsed correctly."""
        params = parse_strategy_parameters("buy_rsi = IntParameter(10, 60, default=30, space=\"buy\")")
        assert "buy_rsi" in params
        p = params["buy_rsi"]
        assert p["type"] == "IntParameter"
        assert p["low"] == 10
        assert p["high"] == 60
        assert p["default"] == 30
        assert p["space"] == "buy"
        assert p["optimize"] is True

    def test_decimal_parameter(self):
        """DecimalParameter with decimals field."""
        params = parse_strategy_parameters("buy_atr = DecimalParameter(1.0, 3.0, default=1.5, decimals=2, space=\"buy\")")
        assert "buy_atr" in params
        p = params["buy_atr"]
        assert p["type"] == "DecimalParameter"
        assert p["low"] == pytest.approx(1.0)
        assert p["high"] == pytest.approx(3.0)
        assert p["default"] == pytest.approx(1.5)
        assert p["decimals"] == 2

    def test_categorical_parameter(self):
        """CategoricalParameter with string list."""
        params = parse_strategy_parameters("trigger = CategoricalParameter([\"rsi\", \"ema\", \"macd\"], default=\"rsi\", space=\"buy\")")
        assert "trigger" in params
        p = params["trigger"]
        assert p["type"] == "CategoricalParameter"
        assert "rsi" in p["options"]
        assert "ema" in p["options"]
        assert p["default"] == "rsi"

    def test_boolean_parameter(self):
        """BooleanParameter with default True."""
        params = parse_strategy_parameters("use_custom_sl = BooleanParameter(default=True, space=\"stoploss\")")
        assert "use_custom_sl" in params
        p = params["use_custom_sl"]
        assert p["type"] == "BooleanParameter"
        assert p["default"] is True
        assert p["space"] == "stoploss"

    def test_full_strategy_all_params_found(self):
        """All 4 parameter types found in a realistic strategy."""
        params = parse_strategy_parameters(_SAMPLE_STRATEGY)
        assert "buy_rsi" in params
        assert "sell_rsi" in params
        assert "buy_atr_mult" in params
        assert "buy_trigger" in params
        assert "use_custom_stoploss" in params
        assert len(params) == 7  # all 7 defined

    def test_no_params_returns_empty(self):
        """Strategy with no parameters returns empty dict."""
        code = 'class EmptyStrategy:\n    def populate_entry_trend(self):\n        pass'
        params = parse_strategy_parameters(code)
        assert params == {}

    def test_int_without_default(self):
        """IntParameter without explicit default uses low as default."""
        params = parse_strategy_parameters("buy_period = IntParameter(5, 50, space=\"buy\")")
        assert "buy_period" in params
        assert params["buy_period"]["default"] == 5  # low is used

    def test_optimize_false(self):
        """optimize=False is correctly parsed."""
        params = parse_strategy_parameters("fixed_val = IntParameter(10, 20, optimize=False, space=\"buy\")")
        assert params["fixed_val"]["optimize"] is False


class TestFormatParamRanges:

    def test_format_int_params(self):
        """IntParameter formatted correctly in prompt."""
        params = {"buy_rsi": {"type": "IntParameter", "low": 10, "high": 60, "default": 30, "space": "buy"}}
        output = format_param_ranges(params)
        assert "buy_rsi" in output
        assert "IntParameter" in output
        assert "10" in output
        assert "60" in output

    def test_format_categorical_params(self):
        """CategoricalParameter shows options."""
        params = {"trigger": {"type": "CategoricalParameter", "options": ["rsi", "ema"], "default": "rsi", "space": "buy"}}
        output = format_param_ranges(params)
        assert "trigger" in output
        assert "rsi" in output
        assert "ema" in output

    def test_empty_params_message(self):
        """Empty params dict returns informative message."""
        output = format_param_ranges({})
        assert "No" in output  # "No explicit parameter ranges"
