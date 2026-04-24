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
    secret_key: str  # JWT signing secret (separate from encryption_key)
    # Encryption key for exchange credentials at rest. MUST be separate from
    # secret_key so rotating one does not invalidate the other. If unset,
    # derived from secret_key for backward-compatibility with existing DBs.
    encryption_key: str = ""
    access_token_expire_minutes: int = 120  # 2 hours — short window reduces blast radius if JWT leaks
    refresh_token_expire_minutes: int = 1440  # 24 hours — refresh flow re-issues access tokens
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Heartbeat settings
    heartbeat_interval_seconds: int = 3
    heartbeat_max_failures: int = 3  # 3 failures = HARD KILL

    # Docker settings (for multi-bot management)
    docker_socket: str = "unix:///var/run/docker.sock"
    # FT image pinned by digest — prevents auto-update on OOM restart from
    # breaking live bots. Override via ORCH_FT_DOCKER_IMAGE to upgrade
    # deliberately (requires manual validation of each FT release).
    ft_docker_image: str = "freqtradeorg/freqtrade@sha256:e4c7d501d9bb03cb885b4b5ee4b2a15c8e15da0b8c602a7f8c0aded7e1f77fe1"
    ft_base_port: int = 8080  # First bot gets 8080, second 8081, etc.

    # ── Safety thresholds (managed via Settings page, DB-backed) ─────
    # These are FALLBACK defaults. Runtime values come from OrchSettings
    # DB table, editable via /settings UI. Code reads via get_safety_settings().
    safety_max_leverage_default: int = 10
    safety_portfolio_exposure_pct_default: int = 70       # max % of total balance
    safety_daily_loss_threshold_pct_default: int = 7      # hard stop if cumulative daily loss crosses this
    safety_daily_loss_action_default: str = "soft_kill_all"  # soft_kill_all | hard_kill_all
    safety_require_typed_go_live_default: bool = True
    safety_forbid_unlimited_stake_live_default: bool = True

    # Resource limits
    ft_bot_memory_limit_mb: int = 800

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
