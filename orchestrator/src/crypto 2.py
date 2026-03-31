"""
Encryption utilities for sensitive data (API keys, secrets).
Uses Fernet symmetric encryption derived from ORCH_SECRET_KEY.
"""
import base64
import hashlib

from cryptography.fernet import Fernet

from .config import settings


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the orchestrator secret_key."""
    key_bytes = hashlib.sha256(settings.secret_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt(plaintext: str | None) -> str | None:
    """Encrypt a string. Returns None if input is None or empty."""
    if not plaintext:
        return None
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str | None) -> str | None:
    """Decrypt a string. Returns None if input is None or empty."""
    if not ciphertext:
        return None
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        return None  # non-blocking — return None for corrupted/legacy plaintext data
