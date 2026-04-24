FROM python:3.11-slim

WORKDIR /app

# Install system deps for asyncpg + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini .

# Create non-root user (docker socket access via group_add in compose)
RUN useradd -r -u 1000 -d /app orchestrator && \
    chown -R orchestrator /app

USER orchestrator

# Run Alembic migrations (must succeed in production).
# Single worker: heartbeat + kill switch + daily-loss-breaker are stateful
# singletons in the lifespan; multi-workers would double-fire each of them.
# DB-query slowness is mitigated via per-bot sessions in heartbeat.
# --timeout-graceful-shutdown matches docker-compose stop_grace_period so
# in-flight kill/forceexit requests get to complete before SIGKILL.
CMD ["sh", "-c", "alembic upgrade head && uvicorn src.main:app --host 0.0.0.0 --port 8888 --timeout-graceful-shutdown 25 --timeout-keep-alive 30"]
