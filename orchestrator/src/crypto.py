"""
Encryption utilities for sensitive data (API keys, secrets).
Uses Fernet symmetric encryption.

Key hierarchy:
  - ORCH_ENCRYPTION_KEY: the encryption key (preferred)
  - ORCH_SECRET_KEY: JWT signing key; used as fallback for decrypt-only when
    ENCRYPTION_KEY is unset (backward compatibility with existing DBs encrypted
    under the old shared-key scheme).

Having two independent keys means we can rotate one without invalidating the
other — e.g. rotate JWT secret after suspected session leak without breaking
every exchange credential in the DB.
"""
import base64
import hashlib

from cryptography.fernet import Fernet

from .config import settings


def _derive_fernet(material: str) -> Fernet:
    key_bytes = hashlib.sha256(material.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def _get_fernet() -> Fernet:
    """Fernet for encryption — prefers ENCRYPTION_KEY, falls back to SECRET_KEY."""
    material = settings.encryption_key or settings.secret_key
    return _derive_fernet(material)


def _get_legacy_fernet() -> Fernet | None:
    """Fernet derived from the old shared key — used as a decrypt fallback for
    DB rows that predate the split. Returns None if the keys are identical."""
    if not settings.encryption_key or settings.encryption_key == settings.secret_key:
        return None
    return _derive_fernet(settings.secret_key)


def encrypt(plaintext: str | None) -> str | None:
    """Encrypt a string. Returns None if input is None or empty."""
    if not plaintext:
        return None
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str | None) -> str | None:
    """Decrypt a string. Returns None if input is None or empty.
    Tries the current key, then falls back to legacy (SECRET_KEY) key so
    existing DB rows stay readable during the key-separation migration."""
    if not ciphertext:
        return None
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        legacy = _get_legacy_fernet()
        if legacy is not None:
            try:
                return legacy.decrypt(ciphertext.encode()).decode()
            except Exception:
                pass
        return None  # corrupted / legacy-plaintext data — explicit None
