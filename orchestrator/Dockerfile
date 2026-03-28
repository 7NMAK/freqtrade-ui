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

# Create non-root user with docker group (GID 999 matches host docker group)
RUN groupadd -g 999 docker && \
    useradd -r -u 1000 -g docker -d /app orchestrator && \
    chown -R orchestrator:docker /app

USER orchestrator

# Run DB migrations (if any exist) then start server
# Tables are also created by app lifespan (create_all) as dev fallback
CMD ["sh", "-c", "alembic upgrade head 2>/dev/null || echo 'No migrations yet — app will create tables'; uvicorn src.main:app --host 0.0.0.0 --port 8888"]
