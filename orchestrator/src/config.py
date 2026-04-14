"""
Orchestrator configuration.
Loaded from environment variables / .env file.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database (PostgreSQL — orchestrator metadata ONLY, never trade data)
    database_url: str = "postgresql+asyncpg://orchestrator:orchestrator@localhost:5432/orchestrator"

    # Redis (pub/sub for heartbeat events + caching)
    redis_url: str = "redis://localhost:6379/0"

    # Orchestrator API
    api_host: str = "0.0.0.0"
    api_port: int = 8888
    secret_key: str
    access_token_expire_minutes: int = 10080  # 7 days
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Heartbeat settings
    heartbeat_interval_seconds: int = 3
    heartbeat_max_failures: int = 3  # 3 failures = HARD KILL

    # Docker settings (for multi-bot management)
    docker_socket: str = "unix:///var/run/docker.sock"
    ft_docker_image: str = "freqtradeorg/freqtrade:stable_freqai"
    ft_base_port: int = 8080  # First bot gets 8080, second 8081, etc.

    # FreqTrade default credentials (per bot, overridable)
    ft_default_username: str = "freqtrade"
    ft_default_password: str = ""

    # ── AI Validation Layer (§12) ────────────────────────────
    # OpenRouter API key — required only when ai_validation_enabled=True
    # Set via ORCH_AI_OPENROUTER_API_KEY in .env (never hardcoded)
    ai_openrouter_api_key: str = ""
    ai_validation_enabled: bool = False
    ai_validation_interval: int = 60  # seconds between polling cycles

    # Model selection
    ai_claude_model: str = "anthropic/claude-sonnet-4-5"
    ai_claude_fallback: str = "anthropic/claude-haiku-4-5-20251001"
    ai_grok_model: str = "x-ai/grok-4.1-fast"
    ai_grok_fallback: str = "x-ai/grok-3-mini-fast"

    # Scoring weights (must sum to 1.0 — validated in ai_validator/config.py)
    ai_weight_freqai: float = 0.50
    ai_weight_claude: float = 0.30
    ai_weight_grok: float = 0.20

    # Cost controls (server-side enforcement)
    ai_max_daily_cost_usd: float = 5.00
    ai_max_validations_per_hour: int = 30

    # Notifications
    ai_telegram_notify_disagree: bool = True
    telegram_token: str = ""      # Telegram bot token (from @BotFather)
    telegram_chat_id: str = ""    # Telegram chat/group ID for alerts

    # Hyperopt AI integration
    ai_hyperopt_enabled: bool = True
    ai_hyperopt_auto_post_analyze: bool = True

    model_config = {"env_file": ".env", "env_prefix": "ORCH_"}


settings = Settings()
