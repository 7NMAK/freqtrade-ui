"""
Authentication for Orchestrator API.

Simple bearer token validation using ORCH_SECRET_KEY.
JWT tokens are issued by POST /api/auth/login and validated on every request.
"""
import os
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
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """FastAPI dependency — validates bearer token on every request."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_token(credentials.credentials)
