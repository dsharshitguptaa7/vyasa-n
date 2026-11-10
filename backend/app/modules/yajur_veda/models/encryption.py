"""
ANUDAAN (Yajur Veda) Bank Details Encryption & Masking Module
Provides application-level AES encryption for sensitive banking information (account numbers, PAN)
using Cryptography's Fernet implementation, matching VYASA-n security conventions.

Invariants:
- Never store plaintext account numbers or PANs in database tables.
- Encrypt before database write; decrypt only when explicitly needed by authorized Accounts actors.
- Never log plain account numbers or encryption keys.
- Store account_number_last4 separately for safe display and user interface masking.
"""
import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet

from app.core.config import settings


def _get_bank_fernet() -> Fernet:
    """
    Resolve or derive a 32-byte URL-safe base64 Fernet key using application secrets.
    Fails closed in production if key configuration is missing or insecure.
    """
    is_production = (settings.NODE_ENV or "development").strip().lower() in ("production", "prod")
    raw_key = (getattr(settings, "BANK_ENCRYPTION_KEY", None) or settings.TOTP_ENCRYPTION_KEY or "").strip()

    if is_production:
        if not raw_key:
            raise RuntimeError(
                "Production configuration error: Bank encryption key is strictly required in production mode."
            )
        if (
            raw_key == "vyasa-core-development-secret-key-csjmu-governance"
            or "development" in raw_key.lower()
            or "default" in raw_key.lower()
        ):
            raise RuntimeError(
                "Production configuration error: Bank encryption key must not use a known development secret."
            )
        try:
            raw_bytes = base64.urlsafe_b64decode(raw_key.encode("utf-8"))
            if len(raw_bytes) != 32:
                raise ValueError("Key must decode to 32 bytes")
            return Fernet(raw_key.encode("utf-8"))
        except Exception:
            raise RuntimeError(
                "Production configuration error: Bank encryption key is not a valid 32-byte URL-safe base64 Fernet key."
            )

    # Local development & test mode: safely derive key from settings.SECRET_KEY or fallback
    if raw_key:
        try:
            raw_bytes = base64.urlsafe_b64decode(raw_key.encode("utf-8"))
            if len(raw_bytes) == 32:
                return Fernet(raw_key.encode("utf-8"))
        except Exception:
            pass
        derived_key = base64.urlsafe_b64encode(hashlib.sha256(raw_key.encode("utf-8")).digest())
        return Fernet(derived_key)

    dev_source = (settings.SECRET_KEY or "vyasa-anudaan-development-banking-secret-csjmu").encode("utf-8")
    derived_dev_key = base64.urlsafe_b64encode(hashlib.sha256(dev_source).digest())
    return Fernet(derived_dev_key)


def encrypt_banking_field(plaintext: Optional[str]) -> Optional[str]:
    """
    Encrypts a sensitive banking field (e.g. account number or PAN) using Fernet.
    Returns URL-safe base64 string or None.
    """
    if plaintext is None:
        return None
    cleaned = plaintext.strip()
    if not cleaned:
        return None
    fernet = _get_bank_fernet()
    return fernet.encrypt(cleaned.encode("utf-8")).decode("utf-8")


def decrypt_banking_field(ciphertext: Optional[str]) -> Optional[str]:
    """
    Decrypts a Fernet-encrypted banking ciphertext back to plaintext string.
    Returns decrypted string or None.
    """
    if ciphertext is None:
        return None
    cleaned = ciphertext.strip()
    if not cleaned:
        return None
    fernet = _get_bank_fernet()
    return fernet.decrypt(cleaned.encode("utf-8")).decode("utf-8")


def extract_last4(account_number: Optional[str]) -> str:
    """
    Extracts the last 4 digits of an account number for display masking.
    Falls back to safe trailing characters if fewer than 4 digits.
    """
    if not account_number:
        return "0000"
    cleaned = "".join(ch for ch in str(account_number) if ch.isalnum())
    return cleaned[-4:] if len(cleaned) >= 4 else cleaned.rjust(4, "X")


def mask_account_number(last4: str) -> str:
    """
    Generates standard masked display string: e.g. '••••••••1234'.
    """
    return f"••••••••{last4}"
