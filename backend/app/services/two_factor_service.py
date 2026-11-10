import base64
import hashlib
import io
import logging
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from cryptography.fernet import Fernet, MultiFernet, InvalidToken
import pyotp
import qrcode
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.two_factor import (
    UserTwoFactorAuth,
    TwoFactorRecoveryCode,
    AuthenticationChallenge,
    TwoFactorAttempt,
)
from app.models.user import User
from app.models.audit import AuditLog
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority

logger = logging.getLogger(__name__)


class TwoFactorService:
    @staticmethod
    def is_2fa_mandatory_for_user(user: User, db: Session) -> bool:
        """
        Evaluate whether TOTP 2FA is mandatory for the specified user identity.
        Mandatory for:
        - Any user appointed as an active institutional authority in Nivaran (Atharva Veda).
        - Any user possessing the generic platform 'authority' role.
        - Any user possessing the central 'super_admin' role.
        Applicants without authority appointments are exempt.
        """
        role_names = [r.name.lower() for r in user.roles] if user.roles else []
        if "super_admin" in role_names or "authority" in role_names:
            return True

        # Check for active NivaranAuthority appointment
        has_active_authority = db.scalar(
            select(func.count(NivaranAuthority.id)).where(
                NivaranAuthority.vyasa_user_id == user.id,
                NivaranAuthority.is_active.is_(True),
            )
        )
        if has_active_authority and has_active_authority > 0:
            return True

        return False

    @staticmethod
    def _derive_fernet_from_string(secret_str: str) -> Fernet:
        """Derive a Fernet instance from an arbitrary secret string using SHA-256."""
        derived_key = base64.urlsafe_b64encode(hashlib.sha256(secret_str.encode("utf-8")).digest())
        return Fernet(derived_key)

    @classmethod
    def _parse_fernet_key(cls, raw_key: str) -> Optional[Fernet]:
        """
        Parse raw key string into a Fernet instance.
        If valid 32-byte URL-safe base64, constructs Fernet directly.
        Otherwise falls back to deterministic SHA-256 derivation.
        """
        clean_key = (raw_key or "").strip()
        if not clean_key:
            return None
        try:
            raw_bytes = base64.urlsafe_b64decode(clean_key.encode("utf-8"))
            if len(raw_bytes) == 32:
                return Fernet(clean_key.encode("utf-8"))
        except Exception:
            pass
        return cls._derive_fernet_from_string(clean_key)

    @classmethod
    def get_development_fallback_fernet(cls) -> Fernet:
        """
        Explicit deterministic development fallback Fernet key.
        Derived from settings.SECRET_KEY or the documented governance development secret.
        """
        dev_source = getattr(settings, "SECRET_KEY", None) or "vyasa-core-development-secret-key-csjmu-governance"
        return cls._derive_fernet_from_string(dev_source)

    @classmethod
    def _get_fernet_instances(cls) -> List[Fernet]:
        """
        Build ordered list of Fernet instances:
        1. Primary key (configured TOTP_ENCRYPTION_KEY or development fallback)
        2. Configured fallback keys (from comma-separated TOTP_ENCRYPTION_KEY or TOTP_FALLBACK_ENCRYPTION_KEYS)
        3. Deterministic dev fallback (in non-production mode, to guarantee local backward compatibility)
        Never logs or exposes key material.
        """
        is_production = (getattr(settings, "NODE_ENV", "development") or "development").strip().lower() in ("production", "prod")
        raw_key = (getattr(settings, "TOTP_ENCRYPTION_KEY", "") or "").strip()

        # Support comma-separated keys in TOTP_ENCRYPTION_KEY (primary first)
        key_tokens = [k.strip() for k in raw_key.split(",") if k.strip()] if raw_key else []
        primary_token = key_tokens[0] if key_tokens else ""

        instances: List[Fernet] = []

        if is_production:
            if not primary_token:
                raise RuntimeError(
                    "Production configuration error: TOTP_ENCRYPTION_KEY is strictly required in production mode."
                )
            if (
                primary_token == "vyasa-core-development-secret-key-csjmu-governance"
                or "development" in primary_token.lower()
                or "default" in primary_token.lower()
            ):
                raise RuntimeError(
                    "Production configuration error: TOTP_ENCRYPTION_KEY must not use a known development secret."
                )
            try:
                raw_bytes = base64.urlsafe_b64decode(primary_token.encode("utf-8"))
                if len(raw_bytes) != 32:
                    raise ValueError("Key must decode to 32 bytes")
                primary_fernet = Fernet(primary_token.encode("utf-8"))
                instances.append(primary_fernet)
            except Exception:
                raise RuntimeError(
                    "Production configuration error: TOTP_ENCRYPTION_KEY is not a valid 32-byte URL-safe base64 Fernet key."
                )
        else:
            # Development / testing mode
            if primary_token:
                dev_fernet = cls._parse_fernet_key(primary_token)
                if dev_fernet:
                    instances.append(dev_fernet)
            else:
                instances.append(cls.get_development_fallback_fernet())

        # Additional fallback keys from comma-separated tokens in TOTP_ENCRYPTION_KEY
        fallback_tokens: List[str] = []
        if len(key_tokens) > 1:
            fallback_tokens.extend(key_tokens[1:])

        # Configured fallback keys from TOTP_FALLBACK_ENCRYPTION_KEYS
        raw_fallbacks = (getattr(settings, "TOTP_FALLBACK_ENCRYPTION_KEYS", "") or "").strip()
        if raw_fallbacks:
            fallback_tokens.extend([fb.strip() for fb in raw_fallbacks.split(",") if fb.strip()])

        for token in fallback_tokens:
            fb_inst = cls._parse_fernet_key(token)
            if fb_inst:
                instances.append(fb_inst)

        # In non-production mode, append deterministic dev fallback to ensure historical dev ciphertexts decrypt
        if not is_production:
            instances.append(cls.get_development_fallback_fernet())

        # Deduplicate instances while strictly preserving priority order
        deduped: List[Fernet] = []
        seen_keys = set()
        for inst in instances:
            key_id = inst._signing_key + inst._encryption_key
            if key_id not in seen_keys:
                seen_keys.add(key_id)
                deduped.append(inst)

        return deduped

    @classmethod
    def _get_fernet(cls) -> Union[Fernet, MultiFernet]:
        """
        Derive Fernet or MultiFernet instance containing primary and fallback keys.
        Primary key encrypts; MultiFernet transparently attempts decryption across all keys in order.
        """
        instances = cls._get_fernet_instances()
        if len(instances) == 1:
            return instances[0]
        return MultiFernet(instances)

    @classmethod
    def get_key_fingerprint(cls) -> Dict[str, Any]:
        """
        Safe diagnostic metadata for running instances.
        Never prints or logs raw key bytes or secrets.
        """
        instances = cls._get_fernet_instances()
        primary = instances[0]
        primary_fp = hashlib.sha256(primary._signing_key + primary._encryption_key).hexdigest()[:16]
        return {
            "primary_key_fingerprint": f"sha256:{primary_fp}",
            "total_keys_configured": len(instances),
            "fallback_keys_count": len(instances) - 1,
            "is_multi_key_ready": len(instances) > 1,
        }

    @classmethod
    def verify_key_health(cls) -> bool:
        """
        Verify that primary encryption key is functional by performing an in-memory
        encrypt/decrypt round-trip on a synthetic test secret. Never persists test data.
        """
        test_secret = "JBSWY3DPEHPK3PXP"
        try:
            enc = cls.encrypt_secret(test_secret)
            dec = cls.decrypt_secret(enc)
            return dec == test_secret
        except Exception as exc:
            logger.error("TOTP encryption health check failed: %s", type(exc).__name__)
            return False

    @classmethod
    def encrypt_secret(cls, secret: str) -> str:
        """Encrypt TOTP base32 secret at rest using primary Fernet key."""
        fernet = cls._get_fernet()
        return fernet.encrypt(secret.encode("utf-8")).decode("utf-8")

    @classmethod
    def decrypt_secret(cls, encrypted_secret: str, fernet: Optional[Any] = None) -> str:
        """
        Decrypt TOTP base32 secret from storage.
        Tries primary and configured fallback keys in sequence via MultiFernet.
        Explicitly handles and sanitizes InvalidToken, logging a safe diagnostic
        without exposing secrets, ciphertext, or keys.
        """
        if not encrypted_secret or not isinstance(encrypted_secret, str):
            logger.error("Failed to decrypt TOTP secret: empty or invalid ciphertext payload.")
            raise InvalidToken("Invalid secret payload")

        fernet_instance = fernet or cls._get_fernet()
        try:
            return fernet_instance.decrypt(encrypted_secret.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            logger.error(
                "Failed to decrypt TOTP secret: cryptographic token invalid or key signature mismatch."
            )
            raise exc
        except Exception as exc:
            logger.error(
                "Failed to decrypt TOTP secret due to unexpected error: %s",
                type(exc).__name__,
            )
            raise InvalidToken("Decryption failed") from exc

    @classmethod
    def reencrypt_secret(
        cls,
        encrypted_secret: str,
        target_fernet: Optional[Fernet] = None,
        candidate_fernets: Optional[List[Fernet]] = None,
    ) -> Tuple[str, bool]:
        """
        Controlled re-encryption utility for safe key rotation and migration:
        - If the ciphertext is already decryptable under target_fernet (primary), returns (encrypted_secret, False).
        - Otherwise attempts candidate keys (or cls._get_fernet_instances()).
        - When a candidate succeeds, re-encrypts under target_fernet, verifies round-trip decryption,
          and returns (new_ciphertext, True).
        - If no candidate succeeds, raises InvalidToken.
        Never exposes raw keys or plaintext in logs or reports.
        """
        all_instances = cls._get_fernet_instances()
        target = target_fernet or all_instances[0]

        # 1. Check if already decryptable under target key
        try:
            target.decrypt(encrypted_secret.encode("utf-8"))
            return encrypted_secret, False
        except InvalidToken:
            pass

        # 2. Iterate candidates
        candidates = candidate_fernets or all_instances[1:]
        if not candidates:
            candidates = [cls.get_development_fallback_fernet()]

        for cand in candidates:
            try:
                decrypted = cand.decrypt(encrypted_secret.encode("utf-8")).decode("utf-8")
                new_encrypted = target.encrypt(decrypted.encode("utf-8")).decode("utf-8")
                verify_dec = target.decrypt(new_encrypted.encode("utf-8")).decode("utf-8")
                if verify_dec != decrypted:
                    raise RuntimeError("Re-encryption round-trip verification failed.")
                return new_encrypted, True
            except InvalidToken:
                continue

        raise InvalidToken("Unable to decrypt ciphertext with any candidate key.")

    @staticmethod
    def generate_totp_secret() -> str:
        """Generate cryptographically secure RFC 6238 Base32 secret."""
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(secret: str, account_name: str) -> str:
        """Generate standard otpauth:// URI compatible with Google Authenticator and standard TOTP apps."""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(
            name=account_name,
            issuer_name=settings.TOTP_ISSUER,
        )

    @staticmethod
    def generate_qr_code_base64(provisioning_uri: str) -> str:
        """Render standard QR code PNG and encode as data:image/png;base64."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(provisioning_uri)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{img_str}"

    @classmethod
    def get_matched_totp_timestep(cls, secret: str, code: str, valid_window: int = 1) -> Optional[int]:
        """
        Verify code against RFC 6238 time-steps and return the matching time-step integer,
        or None if the code is invalid.
        """
        clean_code = code.strip()
        if not clean_code.isdigit() or len(clean_code) != 6:
            return None

        totp = pyotp.TOTP(secret)
        current_ts = int(datetime.now(timezone.utc).timestamp() // 30)

        # Candidate offsets: current interval (0), past (-1..-w), future (+1..+w)
        candidates = [current_ts]
        for offset in range(1, valid_window + 1):
            candidates.append(current_ts - offset)
            candidates.append(current_ts + offset)

        for ts in candidates:
            if totp.at(ts * 30) == clean_code:
                return ts

        return None

    @classmethod
    def verify_totp_code(cls, secret: str, code: str, valid_window: int = 1) -> bool:
        """
        Verify a 6-digit TOTP code with standard clock skew window (valid_window=1, allowing +-30s).
        """
        return cls.get_matched_totp_timestep(secret, code, valid_window=valid_window) is not None

    @staticmethod
    def hash_code(code: str) -> str:
        """Compute SHA-256 hash of an OTP code for safe replay comparison."""
        return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()

    @classmethod
    def is_code_replayed(
        cls,
        two_factor: UserTwoFactorAuth,
        code: str,
        secret: Optional[str] = None,
    ) -> bool:
        """
        Replay protection: Rejects an OTP code if:
        1. Monotonic RFC 6238 time-step: code corresponds to a time-step <= two_factor.last_verified_timestep.
        2. Fingerprint check: code hash matches the accepted code hash within the active 90-second window.
        """
        if not two_factor:
            return False

        # 1. Monotonic RFC 6238 time-step comparison
        if two_factor.last_verified_timestep is not None and secret:
            matched_ts = cls.get_matched_totp_timestep(secret, code, valid_window=1)
            if matched_ts is not None and matched_ts <= two_factor.last_verified_timestep:
                return True

        # 2. Hash comparison within active 90-second validity window
        if two_factor.last_verified_code_hash and two_factor.last_verified_at:
            submitted_hash = cls.hash_code(code)
            if submitted_hash == two_factor.last_verified_code_hash:
                now = datetime.now(timezone.utc)
                time_since_last = (now - two_factor.last_verified_at).total_seconds()
                if time_since_last < 90.0:
                    return True

        return False

    # ============================================================
    # RECOVERY CODES
    # ============================================================

    @staticmethod
    def normalize_recovery_code(code: str) -> str:
        """Normalize code by stripping hyphens, spaces, and converting to uppercase."""
        return code.replace("-", "").replace(" ", "").strip().upper()

    @classmethod
    def hash_recovery_code(cls, raw_code: str) -> str:
        """Hash normalized recovery code with SHA-256 for secure storage."""
        normalized = cls.normalize_recovery_code(raw_code)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    @classmethod
    def generate_recovery_codes(cls, count: int = 10) -> List[str]:
        """Generate secure alphanumeric recovery codes formatted as XXXX-XXXX."""
        alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        codes: List[str] = []
        for _ in range(count):
            part1 = "".join(secrets.choice(alphabet) for _ in range(4))
            part2 = "".join(secrets.choice(alphabet) for _ in range(4))
            codes.append(f"{part1}-{part2}")
        return codes

    @classmethod
    def store_recovery_codes(
        cls,
        db: Session,
        user_id: uuid.UUID,
        raw_codes: List[str],
    ) -> None:
        """Store hashed recovery codes in database, invalidating prior unused codes."""
        now = datetime.now(timezone.utc)
        old_codes = db.scalars(
            select(TwoFactorRecoveryCode).where(
                TwoFactorRecoveryCode.user_id == user_id,
                TwoFactorRecoveryCode.used_at.is_(None),
            )
        ).all()
        for oc in old_codes:
            oc.used_at = now
            db.add(oc)

        for rc in raw_codes:
            code_obj = TwoFactorRecoveryCode(
                id=uuid.uuid4(),
                user_id=user_id,
                code_hash=cls.hash_recovery_code(rc),
                created_at=now,
            )
            db.add(code_obj)
        db.flush()

    @classmethod
    def verify_and_consume_recovery_code(
        cls,
        db: Session,
        user_id: uuid.UUID,
        raw_code: str,
    ) -> bool:
        """
        Verify that recovery code exists, is unused, and mark it consumed atomically.
        """
        code_hash = cls.hash_recovery_code(raw_code)
        now = datetime.now(timezone.utc)

        recovery_entry = db.scalar(
            select(TwoFactorRecoveryCode).where(
                TwoFactorRecoveryCode.user_id == user_id,
                TwoFactorRecoveryCode.code_hash == code_hash,
                TwoFactorRecoveryCode.used_at.is_(None),
            ).with_for_update()
        )

        if recovery_entry is None:
            return False

        recovery_entry.used_at = now
        db.add(recovery_entry)
        db.flush()
        return True

    @staticmethod
    def count_remaining_recovery_codes(db: Session, user_id: uuid.UUID) -> int:
        """Count unused recovery codes for the given user."""
        return db.scalar(
            select(func.count(TwoFactorRecoveryCode.id)).where(
                TwoFactorRecoveryCode.user_id == user_id,
                TwoFactorRecoveryCode.used_at.is_(None),
            )
        ) or 0

    # ============================================================
    # AUTHENTICATION CHALLENGES
    # ============================================================

    @staticmethod
    def create_challenge(
        db: Session,
        user_id: uuid.UUID,
        purpose: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuthenticationChallenge:
        """Create a short-lived (5 min), single-use authentication challenge."""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.TWO_FACTOR_CHALLENGE_EXPIRE_MINUTES)

        challenge = AuthenticationChallenge(
            id=uuid.uuid4(),
            user_id=user_id,
            purpose=purpose,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=now,
        )
        db.add(challenge)
        db.flush()
        return challenge

    @staticmethod
    def get_valid_challenge(
        db: Session,
        challenge_id: uuid.UUID,
        purpose: Optional[str] = None,
        for_update: bool = False,
    ) -> Optional[AuthenticationChallenge]:
        """Retrieve challenge ensuring it has not expired and has not been consumed."""
        now = datetime.now(timezone.utc)
        query = select(AuthenticationChallenge).where(
            AuthenticationChallenge.id == challenge_id,
            AuthenticationChallenge.consumed_at.is_(None),
            AuthenticationChallenge.expires_at > now,
        )
        if purpose:
            query = query.where(AuthenticationChallenge.purpose == purpose)

        if for_update:
            query = query.with_for_update()

        return db.scalar(query)

    @staticmethod
    def consume_challenge(
        db: Session,
        challenge: AuthenticationChallenge,
    ) -> None:
        """Mark challenge consumed atomically."""
        challenge.consumed_at = datetime.now(timezone.utc)
        db.add(challenge)
        db.flush()

    # ============================================================
    # RATE LIMITING & ATTEMPT TRACKING
    # ============================================================

    @staticmethod
    def record_attempt(
        db: Session,
        user_identifier: str,
        success: bool,
        ip_address: Optional[str] = None,
    ) -> None:
        """Record an authentication or 2FA attempt."""
        attempt = TwoFactorAttempt(
            id=uuid.uuid4(),
            user_identifier=user_identifier.lower().strip(),
            ip_address=ip_address,
            success=success,
            attempted_at=datetime.now(timezone.utc),
        )
        db.add(attempt)
        db.flush()

    @staticmethod
    def is_rate_limited(db: Session, user_identifier: str) -> bool:
        """
        Check if failed attempts since the most recent successful verification
        within the rolling lockout window exceed the maximum threshold.
        Executes as an atomic single query with scalar subquery.
        """
        norm_identifier = user_identifier.lower().strip()
        lockout_cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.FAILED_LOGIN_LOCKOUT_MINUTES)

        success_subquery = (
            select(func.max(TwoFactorAttempt.attempted_at))
            .where(
                TwoFactorAttempt.user_identifier == norm_identifier,
                TwoFactorAttempt.success.is_(True),
            )
            .scalar_subquery()
        )

        query = (
            select(func.count(TwoFactorAttempt.id))
            .where(
                TwoFactorAttempt.user_identifier == norm_identifier,
                TwoFactorAttempt.success.is_(False),
                TwoFactorAttempt.attempted_at >= lockout_cutoff,
                or_(
                    success_subquery.is_(None),
                    TwoFactorAttempt.attempted_at > success_subquery,
                ),
            )
        )
        failed_count = db.scalar(query) or 0
        return failed_count >= settings.MAX_FAILED_LOGIN_ATTEMPTS
