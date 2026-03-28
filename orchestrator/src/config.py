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
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60

    # Heartbeat settings
    heartbeat_interval_seconds: int = 3
    heartbeat_max_failures: int = 3  # 3 failures = HARD KILL

    # Docker settings (for multi-bot management)
    docker_socket: str = "unix:///var/run/docker.sock"
    ft_docker_image: str = "freqtradeorg/freqtrade:stable_freqai"
    ft_base_port: int = 8080  # First bot gets 8080, second 8081, etc.

    # FreqTrade default credentials (per bot, overridable)
    ft_default_username: str = "freqtrade"
    ft_default_password: str = "freqtrade"

    model_config = {"env_file": ".env", "env_prefix": "ORCH_"}


settings = Settings()
