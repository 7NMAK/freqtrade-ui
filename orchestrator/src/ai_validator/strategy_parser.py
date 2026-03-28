"""
Strategy Parser — extracts FreqTrade hyperopt parameter definitions from strategy .py files.

Handles all 4 FT parameter types:
- IntParameter
- DecimalParameter
- CategoricalParameter
- BooleanParameter

Uses regex-based parsing (no code execution / eval — safe for arbitrary strategies).
"""
from __future__ import annotations

import re
from typing import Any


def parse_strategy_parameters(strategy_code: str) -> dict[str, dict[str, Any]]:
    """
    Extract hyperopt parameter definitions from a FreqTrade strategy source file.

    Args:
        strategy_code: Full text of the strategy .py file.

    Returns:
        {
            "param_name": {
                "type": "IntParameter" | "DecimalParameter" | "CategoricalParameter" | "BooleanParameter",
                "low": <number>,   # IntParameter / DecimalParameter only
                "high": <number>,  # IntParameter / DecimalParameter only
                "default": <value>,
                "decimals": <int>, # DecimalParameter only
                "options": [...],  # CategoricalParameter only
                "space": "buy" | "sell" | "roi" | "stoploss" | "trailing",
                "optimize": True,  # default True for all
            }
        }
    """
    params: dict[str, dict[str, Any]] = {}
    params.update(_parse_int_parameters(strategy_code))
    params.update(_parse_decimal_parameters(strategy_code))
    params.update(_parse_categorical_parameters(strategy_code))
    params.update(_parse_boolean_parameters(strategy_code))
    return params


# ── IntParameter ──────────────────────────────────────────────────────────────

_INT_PATTERN = re.compile(
    r"(\w+)\s*=\s*IntParameter\s*\(\s*"
    r"(\d+)\s*,\s*(\d+)"                           # low, high (required)
    r"(?:\s*,\s*default\s*=\s*(\d+))?"             # default (optional)
    r"(?:\s*,\s*space\s*=\s*[\"'](\w+)[\"'])?"     # space (optional)
    r"(?:\s*,\s*optimize\s*=\s*(True|False))?"     # optimize (optional)
    r"(?:\s*,\s*load\s*=\s*(True|False))?"         # load (optional, ignore)
    r"\s*\)",
    re.MULTILINE,
)


def _parse_int_parameters(code: str) -> dict[str, dict[str, Any]]:
    params = {}
    for m in _INT_PATTERN.finditer(code):
        name, low, high, default, space, optimize, _ = m.groups()
        params[name] = {
            "type": "IntParameter",
            "low": int(low),
            "high": int(high),
            "default": int(default) if default is not None else int(low),
            "space": space or "buy",
            "optimize": optimize != "False",
        }
    return params


# ── DecimalParameter ──────────────────────────────────────────────────────────

_DEC_PATTERN = re.compile(
    r"(\w+)\s*=\s*DecimalParameter\s*\(\s*"
    r"([\d.]+)\s*,\s*([\d.]+)"                         # low, high
    r"(?:\s*,\s*default\s*=\s*([\d.]+))?"              # default
    r"(?:\s*,\s*decimals\s*=\s*(\d+))?"                # decimals
    r"(?:\s*,\s*space\s*=\s*[\"'](\w+)[\"'])?"         # space
    r"(?:\s*,\s*optimize\s*=\s*(True|False))?"         # optimize
    r"(?:\s*,\s*load\s*=\s*(True|False))?"             # load
    r"\s*\)",
    re.MULTILINE,
)


def _parse_decimal_parameters(code: str) -> dict[str, dict[str, Any]]:
    params = {}
    for m in _DEC_PATTERN.finditer(code):
        name, low, high, default, decimals, space, optimize, _ = m.groups()
        params[name] = {
            "type": "DecimalParameter",
            "low": float(low),
            "high": float(high),
            "default": float(default) if default is not None else float(low),
            "decimals": int(decimals) if decimals is not None else 3,
            "space": space or "buy",
            "optimize": optimize != "False",
        }
    return params


# ── CategoricalParameter ──────────────────────────────────────────────────────

_CAT_PATTERN = re.compile(
    r"(\w+)\s*=\s*CategoricalParameter\s*\(\s*"
    r"\[(.*?)\]"                                        # options list
    r"(?:\s*,\s*default\s*=\s*([^,)]+?))?"             # default
    r"(?:\s*,\s*space\s*=\s*[\"'](\w+)[\"'])?"         # space
    r"(?:\s*,\s*optimize\s*=\s*(True|False))?"         # optimize
    r"\s*\)",
    re.MULTILINE | re.DOTALL,
)


def _parse_categorical_parameters(code: str) -> dict[str, dict[str, Any]]:
    params = {}
    for m in _CAT_PATTERN.finditer(code):
        name, options_str, default, space, optimize = m.groups()

        # Parse option values from the list string
        options = [
            _clean_value(o.strip())
            for o in options_str.split(",")
            if o.strip()
        ]

        params[name] = {
            "type": "CategoricalParameter",
            "options": options,
            "default": _clean_value(default.strip()) if default else (options[0] if options else None),
            "space": space or "buy",
            "optimize": optimize != "False",
        }
    return params


# ── BooleanParameter ──────────────────────────────────────────────────────────

_BOOL_PATTERN = re.compile(
    r"(\w+)\s*=\s*BooleanParameter\s*\(\s*"
    r"(?:default\s*=\s*(True|False))?"                 # default
    r"(?:\s*,\s*space\s*=\s*[\"'](\w+)[\"'])?"         # space
    r"(?:\s*,\s*optimize\s*=\s*(True|False))?"         # optimize
    r"\s*\)",
    re.MULTILINE,
)


def _parse_boolean_parameters(code: str) -> dict[str, dict[str, Any]]:
    params = {}
    for m in _BOOL_PATTERN.finditer(code):
        name, default, space, optimize = m.groups()
        params[name] = {
            "type": "BooleanParameter",
            "options": [True, False],
            "default": default == "True" if default is not None else True,
            "space": space or "buy",
            "optimize": optimize != "False",
        }
    return params


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean_value(raw: str) -> Any:
    """Strip quotes from a string value; try numeric conversion."""
    raw = raw.strip().strip("\"'")
    # Try int
    try:
        return int(raw)
    except ValueError:
        pass
    # Try float
    try:
        return float(raw)
    except ValueError:
        pass
    # Try bool
    if raw == "True":
        return True
    if raw == "False":
        return False
    return raw


def format_param_ranges(params: dict[str, dict[str, Any]]) -> str:
    """Format parameter ranges for LLM prompt."""
    if not params:
        return "No explicit parameter ranges found in strategy."

    lines = []
    for name, info in params.items():
        p_type = info.get("type", "unknown")
        space = info.get("space", "buy")

        if p_type in ("IntParameter", "DecimalParameter"):
            low = info.get("low", "?")
            high = info.get("high", "?")
            default = info.get("default", "?")
            lines.append(f"- {name} ({p_type}, space={space}): range=[{low}, {high}], default={default}")
        elif p_type == "CategoricalParameter":
            options = info.get("options", [])
            default = info.get("default", "?")
            lines.append(f"- {name} ({p_type}, space={space}): options={options}, default={default}")
        elif p_type == "BooleanParameter":
            default = info.get("default", True)
            lines.append(f"- {name} (BooleanParameter, space={space}): default={default}")

    return "\n".join(lines)
