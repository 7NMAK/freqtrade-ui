"""
Hyperopt output parser — extracts best-epoch metrics and params from FT CLI output.

FT hyperopt output format (example):
  500/500:    123 trades. Avg profit   1.23%. Total profit  0.12345678 BTC (59.22%).
  Avg duration 2:30:00 min. Objective: -12.34567

  # Buy hyperspace params:
  buy_rsi = IntParameter(20, ...)
  ...

  ROI table:
  {  0: 0.05, 20: 0.04, 30: 0.03, 60: 0.01}
  Stoploss: -0.10
  Trailing stop:
    trailing_stop = True
    trailing_stop_positive = 0.01
    ...

  Dumping parameters to /freqtrade/user_data/strategies/StrategyName.json
"""
import re
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


def parse_hyperopt_output(output: str) -> dict:
    """
    Parse FT hyperopt CLI output text and extract best result metrics.

    Returns dict with:
      - epoch: int (best epoch number)
      - total_epochs: int
      - total_trades: int
      - avg_profit_pct: Decimal
      - profit_abs: Decimal (total profit in coin)
      - profit_pct: Decimal (total profit %)
      - avg_duration: str
      - objective: Decimal
      - win: int
      - draw: int
      - loss: int
      - win_rate: Decimal
      - max_drawdown: Decimal (if present)
      - params: dict (ROI, stoploss, trailing, buy/sell params)
      - dumped_json: str or None (path to dumped .json)
    """
    result = {
        "epoch": None,
        "total_epochs": None,
        "total_trades": None,
        "avg_profit_pct": None,
        "profit_abs": None,
        "profit_pct": None,
        "avg_duration": None,
        "objective": None,
        "win": None,
        "draw": None,
        "loss": None,
        "win_rate": None,
        "max_drawdown": None,
        "params": {},
        "dumped_json": None,
    }

    if not output:
        return result

    # ── Best epoch line ──
    # Pattern: "  500/500:    123 trades. Avg profit   1.23%. Total profit  0.12345678 BTC (59.22%)."
    best_match = re.search(
        r"(\d+)/(\d+):\s+(\d+)\s+trades\.\s+Avg profit\s+([\d.-]+)%\.\s+Total profit\s+([\d.-]+)\s+\S+\s+\(([\d.-]+)%\)",
        output,
    )
    if best_match:
        result["epoch"] = int(best_match.group(1))
        result["total_epochs"] = int(best_match.group(2))
        result["total_trades"] = int(best_match.group(3))
        result["avg_profit_pct"] = Decimal(best_match.group(4))
        result["profit_abs"] = Decimal(best_match.group(5))
        result["profit_pct"] = Decimal(best_match.group(6))

    # ── Avg duration ──
    dur_match = re.search(r"Avg duration\s+([\d:hm ]+)\s*min", output)
    if dur_match:
        result["avg_duration"] = dur_match.group(1).strip()

    # ── Objective ──
    obj_match = re.search(r"Objective:\s+([\d.-]+)", output)
    if obj_match:
        result["objective"] = Decimal(obj_match.group(1))

    # ── Win/Draw/Loss ──
    # Pattern: "Win 100 Draw  5 Loss  18"
    wdl_match = re.search(r"Win\s+(\d+)\s+Draw\s+(\d+)\s+Loss\s+(\d+)", output)
    if wdl_match:
        result["win"] = int(wdl_match.group(1))
        result["draw"] = int(wdl_match.group(2))
        result["loss"] = int(wdl_match.group(3))
        total = result["win"] + result["draw"] + result["loss"]
        if total > 0:
            result["win_rate"] = Decimal(str(round(result["win"] / total * 100, 2)))

    # ── Max drawdown ──
    dd_match = re.search(r"Max Drawdown\s+([\d.]+)%", output, re.IGNORECASE)
    if dd_match:
        result["max_drawdown"] = Decimal(dd_match.group(1))
    # Alternative format: "Drawdown              0.00%"
    dd_match2 = re.search(r"Drawdown\s+([\d.]+)%", output)
    if dd_match2 and result["max_drawdown"] is None:
        result["max_drawdown"] = Decimal(dd_match2.group(1))

    # ── ROI table ──
    roi_match = re.search(r"ROI table:\s*\n\s*(\{[^}]+\})", output)
    if roi_match:
        try:
            import ast
            result["params"]["roi"] = ast.literal_eval(roi_match.group(1))
        except (ValueError, SyntaxError):
            result["params"]["roi_raw"] = roi_match.group(1)

    # ── Stoploss ──
    sl_match = re.search(r"Stoploss:\s*([\d.-]+)", output)
    if sl_match:
        result["params"]["stoploss"] = float(sl_match.group(1))

    # ── Trailing stop ──
    trailing = {}
    ts_match = re.search(r"trailing_stop\s*=\s*(True|False)", output)
    if ts_match:
        trailing["trailing_stop"] = ts_match.group(1) == "True"
    tsp_match = re.search(r"trailing_stop_positive\s*=\s*([\d.]+)", output)
    if tsp_match:
        trailing["trailing_stop_positive"] = float(tsp_match.group(1))
    tspo_match = re.search(r"trailing_stop_positive_offset\s*=\s*([\d.]+)", output)
    if tspo_match:
        trailing["trailing_stop_positive_offset"] = float(tspo_match.group(1))
    tsod_match = re.search(r"trailing_only_offset_is_reached\s*=\s*(True|False)", output)
    if tsod_match:
        trailing["trailing_only_offset_is_reached"] = tsod_match.group(1) == "True"
    if trailing:
        result["params"]["trailing"] = trailing

    # ── Dumped JSON path ──
    dump_match = re.search(r"Dumping parameters to\s+(\S+)", output)
    if dump_match:
        result["dumped_json"] = dump_match.group(1)

    return result
