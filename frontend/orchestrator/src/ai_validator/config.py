"""
AI Validator — specific configuration with validation.

Reads from the main orchestrator Settings object and enforces
AI-specific constraints (weight sum, cost limits, key presence).
"""
from pydantic import model_validator
from pydantic_settings import BaseSettings


class AIValidatorConfig(BaseSettings):
    """
    AI Validation Layer configuration.

    All values come from environment variables (prefix ORCH_),
    loaded via the main Settings object. This class exists to
    provide extra validation logic on AI-specific fields.
    """

    # OpenRouter API key (required when ai_validation_enabled=True)
    ai_openrouter_api_key: str = ""
    ai_validation_enabled: bool = False
    ai_validation_interval: int = 60

    # Models
    ai_claude_model: str = "anthropic/claude-sonnet-4-5"
    ai_claude_fallback: str = "anthropic/claude-haiku-4-5-20251001"
    ai_grok_model: str = "x-ai/grok-4.1-fast"
    ai_grok_fallback: str = "x-ai/grok-3-mini-fast"

    # Weights
    ai_weight_freqai: float = 0.50
    ai_weight_claude: float = 0.30
    ai_weight_grok: float = 0.20

    # Cost controls
    ai_max_daily_cost_usd: float = 5.00
    ai_max_validations_per_hour: int = 30

    # Notifications
    ai_telegram_notify_disagree: bool = True

    # Hyperopt
    ai_hyperopt_enabled: bool = True
    ai_hyperopt_auto_post_analyze: bool = True

    model_config = {"env_file": ".env", "env_prefix": "ORCH_", "extra": "ignore"}

    @model_validator(mode="after")
    def validate_weights_sum(self) -> "AIValidatorConfig":
        """Weights must sum to 1.0 (within float precision)."""
        total = self.ai_weight_freqai + self.ai_weight_claude + self.ai_weight_grok
        if abs(total - 1.0) > 0.001:
            raise ValueError(
                f"AI weights must sum to 1.0, got {total:.3f} "
                f"(freqai={self.ai_weight_freqai}, claude={self.ai_weight_claude}, "
                f"grok={self.ai_weight_grok})"
            )
        return self

    @model_validator(mode="after")
    def validate_api_key_when_enabled(self) -> "AIValidatorConfig":
        """API key must be set when AI validation is enabled."""
        if self.ai_validation_enabled and not self.ai_openrouter_api_key:
            raise ValueError(
                "ORCH_AI_OPENROUTER_API_KEY must be set when ORCH_AI_VALIDATION_ENABLED=true. "
                "Get your key at https://openrouter.ai/keys"
            )
        return self

    @model_validator(mode="after")
    def validate_cost_limit(self) -> "AIValidatorConfig":
        """Daily cost limit must be positive."""
        if self.ai_max_daily_cost_usd <= 0:
            raise ValueError("ORCH_AI_MAX_DAILY_COST_USD must be > 0")
        return self

    def get_weights(self) -> dict[str, float]:
        """Return weights as a dict for ScoreCalculator."""
        return {
            "freqai": self.ai_weight_freqai,
            "claude": self.ai_weight_claude,
            "grok": self.ai_weight_grok,
        }
