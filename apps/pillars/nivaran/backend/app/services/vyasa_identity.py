"""
VYASA Core Identity Integration Client for NIVARAN.

Responsibilities:
- Submit VYASA Bearer tokens to the authoritative VYASA Core verification contract:
  POST {VYASA_CORE_URL}/api/auth/verify
- Parse and validate the response payload:
  {
    "valid": true,
    "user": {
      "id": "<UUID>",
      "email": "...",
      "first_name": "...",
      "last_name": "...",
      "roles": [...]
    }
  }
- Return a typed VerifiedVyasaIdentity model.
- Handle connection errors, timeouts, and HTTP errors gracefully.
"""

import logging
import uuid
from typing import List, Optional
import httpx
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger("nivaran.services.vyasa_identity")


class VerifiedVyasaIdentity(BaseModel):
    """Strongly-typed verified identity payload received from VYASA Core contract."""
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    roles: List[str] = Field(default_factory=list)


class VyasaApplicantProfile(BaseModel):
    """Strongly-typed applicant profile payload received from VYASA Core contract."""
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    is_active: bool = True
    is_verified: bool = False
    phd_registration_number: Optional[str] = None
    department: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    subject_name: Optional[str] = None


class VyasaIdentityServiceError(Exception):
    """Raised when VYASA Core verification endpoint is unreachable or encounters communication error."""
    pass


class VyasaIdentityClient:
    """HTTP Client for validating tokens against VYASA Core's /api/auth/verify contract."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        self.base_url = (base_url or settings.VYASA_CORE_URL).rstrip("/")
        self.timeout = timeout if timeout is not None else settings.VYASA_IDENTITY_VERIFY_TIMEOUT_SECONDS
        self._transport = transport

    def verify_token(self, token: str) -> Optional[VerifiedVyasaIdentity]:
        """
        Verify a VYASA access token against VYASA Core.
        Returns VerifiedVyasaIdentity if token is valid and user is active in VYASA Core.
        Returns None if token is invalid, expired, or user is inactive.
        Raises VyasaIdentityServiceError if communication fails.
        """
        clean_token = token.strip()
        if clean_token.startswith("Bearer "):
            clean_token = clean_token.split("Bearer ", 1)[1].strip()

        if not clean_token:
            return None

        url = f"{self.base_url}/api/auth/verify"
        payload = {"token": clean_token}

        logger.info(
            "VYASA VERIFY START: url=%s token_length=%d token_segments=%d",
            url,
            len(clean_token),
            len(clean_token.split(".")),
        )

        try:
            client_kwargs = {"timeout": self.timeout}
            if self._transport is not None:
                client_kwargs["transport"] = self._transport

            with httpx.Client(**client_kwargs) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.error("Failed to connect to VYASA Core identity service at %s: %s", url, str(exc))
            raise VyasaIdentityServiceError(f"VYASA Core identity service unreachable: {str(exc)}") from exc
        except httpx.HTTPStatusError as exc:
            logger.error("VYASA Core identity verification returned HTTP %s: %s", exc.response.status_code, exc.response.text)
            if exc.response.status_code >= 500:
                raise VyasaIdentityServiceError(f"VYASA Core identity service error: HTTP {exc.response.status_code}") from exc
            return None
        except Exception as exc:
            logger.error("Unexpected error during VYASA Core identity verification: %s", str(exc))
            raise VyasaIdentityServiceError(f"Unexpected error communicating with VYASA Core: {str(exc)}") from exc

        if not isinstance(data, dict):
            logger.warning("VYASA VERIFY FAILED: Response body is not a JSON object")
            return None

        is_valid = data.get("valid")
        has_user = "user" in data and isinstance(data["user"], dict)
        logger.info("VYASA VERIFY RESPONSE: valid=%s has_user=%s", is_valid, has_user)

        if is_valid is True and has_user:
            try:
                identity = VerifiedVyasaIdentity.model_validate(data["user"])
                logger.info(
                    "VYASA VERIFY SUCCESS: verified_user_id=%s verified_roles=%s verified_email=%s",
                    identity.id,
                    identity.roles,
                    identity.email,
                )
                return identity
            except Exception as exc:
                logger.error("Failed to parse verified user payload from VYASA Core: %s", str(exc))
                return None

        logger.warning(
            "VYASA VERIFY FAILED: Token deemed invalid by VYASA Core (valid=%s, has_user=%s)",
            is_valid,
            has_user,
        )
        return None

    def get_applicant_profile(self, token: str) -> Optional[VyasaApplicantProfile]:
        """
        Fetch the applicant's authoritative profile from VYASA Core:
        GET {VYASA_CORE_URL}/api/applicant/profile
        using Bearer authentication.
        """
        clean_token = token.strip()
        if clean_token.startswith("Bearer "):
            clean_token = clean_token.split("Bearer ", 1)[1].strip()

        if not clean_token:
            return None

        url = f"{self.base_url}/api/applicant/profile"
        headers = {"Authorization": f"Bearer {clean_token}"}

        try:
            client_kwargs = {"timeout": self.timeout}
            if self._transport is not None:
                client_kwargs["transport"] = self._transport

            with httpx.Client(**client_kwargs) as client:
                response = client.get(url, headers=headers)
                if response.status_code in (401, 403, 404):
                    logger.warning("VYASA Core applicant profile returned HTTP %s for token", response.status_code)
                    return None
                response.raise_for_status()
                data = response.json()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.error("Failed to connect to VYASA Core applicant profile service at %s: %s", url, str(exc))
            raise VyasaIdentityServiceError(f"VYASA Core identity service unreachable: {str(exc)}") from exc
        except httpx.HTTPStatusError as exc:
            logger.error("VYASA Core applicant profile returned HTTP %s: %s", exc.response.status_code, exc.response.text)
            if exc.response.status_code >= 500:
                raise VyasaIdentityServiceError(f"VYASA Core identity service error: HTTP {exc.response.status_code}") from exc
            return None
        except Exception as exc:
            logger.error("Unexpected error during VYASA Core applicant profile retrieval: %s", str(exc))
            raise VyasaIdentityServiceError(f"Unexpected error communicating with VYASA Core: {str(exc)}") from exc

        if not isinstance(data, dict):
            return None

        try:
            return VyasaApplicantProfile.model_validate(data)
        except Exception as exc:
            logger.error("Failed to parse applicant profile payload from VYASA Core: %s", str(exc))
            return None


vyasa_identity_client = VyasaIdentityClient()
