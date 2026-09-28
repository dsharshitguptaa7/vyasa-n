import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt

from app.core.config import settings

HASH_ALGORITHM = "sha256"
ITERATIONS = 100_000


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """
    PBKDF2-HMAC-SHA256 password hashing foundation.
    Returns format: pbkdf2_sha256$<iterations>$<salt>$<hex_digest>
    """
    if not salt:
        salt = secrets.token_hex(16)

    derived = hashlib.pbkdf2_hmac(
        HASH_ALGORITHM,
        password.encode("utf-8"),
        salt.encode("utf-8"),
        ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${derived}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Constant-time password verification against stored PBKDF2 hash.
    """
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = parts[2]
        expected_digest = parts[3]

        derived = hashlib.pbkdf2_hmac(
            HASH_ALGORITHM,
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        ).hex()
        return hmac.compare_digest(derived, expected_digest)
    except Exception:
        return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Encode JWT access token for VYASA Core identity sessions.
    Guarantees standard canonical claims: iss, iat, exp.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": settings.SERVICE_NAME,
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(
    token: str,
    verify_issuer: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT access token, returning payload dict or None.
    Validates cryptographic signature, expiration, and issuer.
    """
    try:
        kwargs: Dict[str, Any] = {
            "algorithms": [settings.ALGORITHM],
        }
        if verify_issuer:
            kwargs["issuer"] = settings.SERVICE_NAME
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            **kwargs,
        )
        return payload
    except jwt.PyJWTError:
        return None
