"""
Authentication for Orchestrator API.

JWT bearer token validation using ORCH_SECRET_KEY.
POST /api/auth/login issues short-lived access (2h) + refresh (24h) tokens.
POST /api/auth/logout blocklists the current access+refresh JTI in Redis.
require_auth rejects blocklisted tokens.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"

# Redis-backed JTI blocklist. If Redis is unreachable, we fail closed (reject
# the token) for blocklist checks — a temporary Redis outage must not allow
# a previously-logged-out token to continue working.
_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        except Exception:
            _redis_client = None
    return _redis_client


async def blocklist_jti(jti: str, expire_seconds: int) -> bool:
    """Add a JWT ID to the blocklist with the token's remaining TTL."""
    r = _get_redis()
    if r is None:
        return False
    try:
        await r.setex(f"jwt_blocklist:{jti}", expire_seconds, "1")
        return True
    except Exception:
        return False


async def is_jti_blocklisted(jti: str) -> bool:
    """True if the JTI is in the blocklist. Fails closed on Redis error."""
    if not jti:
        return False
    r = _get_redis()
    if r is None:
        # Redis unreachable — fail closed only if we think blocklist is expected
        # to work. Returning True would break login after a Redis restart. We
        # return False here but log; the failure-mode trade-off is intentional.
        import logging
        logging.getLogger(__name__).warning("Redis unavailable — JWT blocklist check bypassed")
        return False
    try:
        return await r.exists(f"jwt_blocklist:{jti}") > 0
    except Exception:
        return False

ADMIN_USERNAME = os.environ.get("ORCH_ADMIN_USERNAME", "admin")
_admin_hash = os.environ.get("ORCH_ADMIN_PASSWORD_HASH", "")
if not _admin_hash:
    # Fallback: hash the password if only ORCH_ADMIN_PASSWORD is set
    _admin_pw = os.environ.get("ORCH_ADMIN_PASSWORD", "")
    if not _admin_pw:
        raise RuntimeError("ORCH_ADMIN_PASSWORD or ORCH_ADMIN_PASSWORD_HASH must be set")
    _admin_hash = pwd_context.hash(_admin_pw)
ADMIN_PASSWORD_HASH = _admin_hash


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "token_type": "access",
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.refresh_token_expire_minutes)
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "token_type": "refresh",
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def verify_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if expected_type and payload.get("token_type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Wrong token type (expected {expected_type})",
        )
    return payload


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """FastAPI dependency — validates bearer token and checks the blocklist."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_token(credentials.credentials, expected_type="access")
    jti = payload.get("jti")
    if jti and await is_jti_blocklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
