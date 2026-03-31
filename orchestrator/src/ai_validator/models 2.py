"""
SQLAlchemy ORM models for AI Validation Layer.

Uses existing Base from src.models.base.
Tables: ai_validations, ai_accuracy, ai_hyperopt_analyses, ai_hyperopt_outcomes
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..models.base import Base


class AIValidation(Base):
    """
    One row per AI validation of a FreqAI signal.
    Created when a new trade is detected and queried against Claude + Grok.
    NEVER modified after creation — immutable audit record.
    """

    __tablename__ = "ai_validations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bot_id: Mapped[int] = mapped_column(Integer, ForeignKey("bot_instances.id"), nullable=False)
    ft_trade_id: Mapped[int] = mapped_column(Integer, nullable=False)
    pair: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # FreqAI signal
    freqai_direction: Mapped[str] = mapped_column(String(10), nullable=False)    # 'long' | 'short'
    freqai_confidence: Mapped[float] = mapped_column(Float, nullable=False)       # 0.0-1.0

    # Claude response
    claude_direction: Mapped[str] = mapped_column(String(10), nullable=False)
    claude_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    claude_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    claude_risk_factors: Mapped[list[Any]] = mapped_column(JSONB, server_default="[]")
    claude_sentiment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    claude_regime: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Grok response
    grok_direction: Mapped[str] = mapped_column(String(10), nullable=False)
    grok_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    grok_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    grok_risk_factors: Mapped[list[Any]] = mapped_column(JSONB, server_default="[]")
    grok_sentiment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    grok_regime: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Combined scores
    combined_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    agreement_pct: Mapped[float] = mapped_column(Float, nullable=False)
    all_agree: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    strong_disagree: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Cost tracking (filled from OpenRouter usage response)
    claude_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    grok_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)


class AIAccuracy(Base):
    """
    Accuracy record — created ONCE when a trade closes.
    Compares each advisor's prediction against actual trade result.
    """

    __tablename__ = "ai_accuracy"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    validation_id: Mapped[int] = mapped_column(Integer, ForeignKey("ai_validations.id"), nullable=False)
    advisor: Mapped[str] = mapped_column(String(10), nullable=False)              # 'freqai' | 'claude' | 'grok'
    predicted_direction: Mapped[str] = mapped_column(String(10), nullable=False)
    predicted_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    actual_profit: Mapped[float] = mapped_column(Float, nullable=False)           # close_profit_abs
    was_profitable: Mapped[bool] = mapped_column(Boolean, nullable=False)
    was_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    closed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AIHyperoptAnalysis(Base):
    """
    One row per AI analysis of a hyperopt run (pre or post).
    """

    __tablename__ = "ai_hyperopt_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bot_id: Mapped[int] = mapped_column(Integer, ForeignKey("bot_instances.id"), nullable=False)
    strategy_name: Mapped[str] = mapped_column(String(100), nullable=False)
    pair: Mapped[str] = mapped_column(String(30), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    analysis_type: Mapped[str] = mapped_column(String(20), nullable=False)       # 'pre_hyperopt' | 'post_hyperopt'

    # Pre-hyperopt suggestions
    suggested_loss_function: Mapped[str | None] = mapped_column(String(60), nullable=True)
    suggested_sampler: Mapped[str | None] = mapped_column(String(30), nullable=True)
    suggested_epochs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suggested_param_ranges: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    suggested_spaces: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)

    # Post-hyperopt analysis
    hyperopt_epochs_run: Mapped[int | None] = mapped_column(Integer, nullable=True)
    loss_function_used: Mapped[str | None] = mapped_column(String(60), nullable=True)
    results_analyzed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recommended_result_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overfitting_scores: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)

    # Baseline for comparison (§19.19)
    baseline_profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_trades: Mapped[int | None] = mapped_column(Integer, nullable=True)
    baseline_sharpe: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_max_drawdown: Mapped[float | None] = mapped_column(Float, nullable=True)

    # LLM raw responses
    claude_response: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    grok_response: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    claude_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    grok_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Cost
    claude_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    grok_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AIHyperoptOutcome(Base):
    """
    Tracks whether a user followed AI hyperopt advice and what profit resulted.
    Used to measure and improve AI suggestion quality over time.
    """

    __tablename__ = "ai_hyperopt_outcomes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int] = mapped_column(Integer, ForeignKey("ai_hyperopt_analyses.id"), nullable=False)
    used_ai_suggestion: Mapped[bool] = mapped_column(Boolean, nullable=False)
    final_params: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    paper_trade_result: Mapped[float | None] = mapped_column(Float, nullable=True)
    live_trade_result: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_feedback: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 'helpful' | 'neutral' | 'wrong'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
