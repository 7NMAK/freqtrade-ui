"""
Response Parser — validates and normalises LLM JSON responses.

Handles:
- Clean JSON responses
- JSON wrapped in markdown ```json``` code blocks
- Missing optional fields (supplies defaults)
- Required field validation
- Retry prompt construction
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

# Required fields for signal validation responses (spec §4)
_SIGNAL_REQUIRED_FIELDS = {
    "confidence",
    "direction",
    "agreement_with_freqai",
    "reasoning",
    "risk_factors",
    "sentiment_assessment",
    "market_regime",
}

# Required fields for pre-hyperopt responses (spec §19.2)
_PRE_HYPEROPT_REQUIRED_FIELDS = {
    "recommended_loss_function",
    "recommended_sampler",
    "recommended_epochs",
    "parameter_suggestions",
    "spaces_to_optimize",
    "confidence",
}

# Required fields for post-hyperopt responses (spec §19.3)
_POST_HYPEROPT_REQUIRED_FIELDS = {
    "recommended_result_index",
    "overfitting_risk_scores",
    "general_analysis",
    "confidence",
}

# Default values for optional signal fields
_SIGNAL_DEFAULTS: dict[str, object] = {
    "suggested_tp_adjustment": None,
    "suggested_sl_adjustment": None,
    "risk_factors": [],
}


def parse_llm_response(
    raw: object,
    required_fields: set[str] | None = None,
) -> dict:
    """
    Parse and validate an LLM response into a clean dict.

    Args:
        raw: Either a dict (already parsed), a string (JSON text), or an
             exception (from asyncio.gather return_exceptions=True).
        required_fields: Set of field names that must be present.
                         Defaults to _SIGNAL_REQUIRED_FIELDS.

    Returns:
        Validated dict with defaults applied for missing optional fields.

    Raises:
        ValueError: If required fields are missing after parsing.
        json.JSONDecodeError: If the response cannot be parsed as JSON.
    """
    if required_fields is None:
        required_fields = _SIGNAL_REQUIRED_FIELDS

    # If caller passes a result dict from LLMGateway (has "content" key)
    if isinstance(raw, dict) and "content" in raw:
        data = raw["content"]
    elif isinstance(raw, dict):
        data = raw
    elif isinstance(raw, str):
        data = _extract_json(raw)
    elif isinstance(raw, Exception):
        # Propagate exceptions from asyncio.gather
        raise raw
    else:
        raise TypeError(f"Unexpected response type: {type(raw)}")

    if not isinstance(data, dict):
        raise ValueError(f"LLM response must be a JSON object, got {type(data)}")

    # Apply defaults for optional fields (signal validation only)
    for field, default in _SIGNAL_DEFAULTS.items():
        if field not in data:
            data[field] = default

    # Validate required fields
    missing = required_fields - data.keys()
    if missing:
        raise ValueError(
            f"LLM response missing required fields: {sorted(missing)}. "
            f"Got keys: {sorted(data.keys())}"
        )

    # Clamp confidence to [0.0, 1.0]
    if "confidence" in data:
        data["confidence"] = max(0.0, min(1.0, float(data["confidence"])))

    return data


def _extract_json(text: str) -> dict:
    """
    Extract JSON from various response formats:
    1. Pure JSON string
    2. JSON wrapped in ```json ... ``` markdown block
    3. JSON wrapped in ``` ... ``` block
    """
    text = text.strip()

    # Try direct parse first (fastest path)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    # Matches: ```json\n{...}\n``` or ```\n{...}\n```
    code_block_match = re.search(
        r"```(?:json)?\s*(\{.*?\})\s*```",
        text,
        re.DOTALL,
    )
    if code_block_match:
        try:
            return json.loads(code_block_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find any JSON object in the text
    # This handles cases where the LLM adds extra text before/after JSON
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError(
        f"Could not extract JSON from LLM response: {text[:300]}",
        text,
        0,
    )


def parse_pre_hyperopt_response(raw: object) -> dict:
    """Parse and validate a pre-hyperopt LLM response."""
    return parse_llm_response(raw, required_fields=_PRE_HYPEROPT_REQUIRED_FIELDS)


def parse_post_hyperopt_response(raw: object) -> dict:
    """Parse and validate a post-hyperopt LLM response."""
    return parse_llm_response(raw, required_fields=_POST_HYPEROPT_REQUIRED_FIELDS)
