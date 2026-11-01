"""
Secure DigitalOcean Spaces (S3-Compatible) Storage Provider for VYASA-n.
Implements:
1. Provider-independent storage interface (BaseStorageProvider).
2. Strict path traversal prevention on object keys and local cache paths.
3. Private-by-default bucket object persistence with ACL='private'.
4. Magic byte signature verification and size limit validation.
5. Atomic caching for local file streaming via FileResponse.
6. Checksum calculation (SHA-256) and server-generated unique keys.
"""

import hashlib
import logging
import os
from pathlib import Path
import tempfile
from typing import Any, BinaryIO, Optional, Set, Union
import uuid

from app.core.config import settings
from app.core.storage.base import (
    BaseStorageProvider,
    StorageResult,
    StorageError,
    StoragePathTraversalError,
    StorageInvalidFileTypeError,
    StorageSizeLimitError,
    StorageFileNotFoundError,
    sanitize_filename,
    normalize_save_file_args,
)

logger = logging.getLogger(__name__)


class SpacesStorageProvider(BaseStorageProvider):
    """
    Concrete storage implementation persisting files to DigitalOcean Spaces via S3 API.
    Enforces private object ACLs, server-side prefixing, and atomic local file caching for streaming.
    """

    def __init__(
        self,
        bucket: Optional[str] = None,
        region: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        s3_client: Optional[Any] = None,
        cache_dir: Optional[Union[str, Path]] = None,
    ):
        self.region = (region or getattr(settings, "SPACES_REGION", "sgp1") or "sgp1").strip()
        self.bucket = (bucket or getattr(settings, "SPACES_BUCKET", None) or "").strip()
        default_endpoint = f"https://{self.region}.digitaloceanspaces.com"
        self.endpoint_url = (endpoint_url or getattr(settings, "SPACES_ENDPOINT_URL", None) or default_endpoint).strip()
        self.access_key_id = (access_key_id or getattr(settings, "SPACES_ACCESS_KEY_ID", None) or "").strip()
        self.secret_access_key = (secret_access_key or getattr(settings, "SPACES_SECRET_ACCESS_KEY", None) or "").strip()

        # If s3_client is not directly injected, require complete credentials
        if s3_client is None:
            missing = []
            if not self.bucket:
                missing.append("SPACES_BUCKET")
            if not self.access_key_id:
                missing.append("SPACES_ACCESS_KEY_ID")
            if not self.secret_access_key:
                missing.append("SPACES_SECRET_ACCESS_KEY")
            if missing:
                raise StorageError(
                    f"DigitalOcean Spaces configuration error: Missing required setting(s): {', '.join(missing)}. "
                    "Cannot initialize SpacesStorageProvider without bucket and credentials."
                )

        self._s3_client = s3_client

        if cache_dir:
            self._cache_dir = Path(cache_dir).resolve()
        else:
            self._cache_dir = Path(tempfile.gettempdir()) / "vyasa_spaces_cache"
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    @property
    def cache_dir(self) -> Path:
        return self._cache_dir

    @property
    def s3_client(self) -> Any:
        if self._s3_client is None:
            try:
                import boto3
                import botocore.config

                boto_config = botocore.config.Config(
                    signature_version="s3v4",
                    retries={"max_attempts": 3, "mode": "standard"},
                    connect_timeout=10,
                    read_timeout=30,
                )
                session = boto3.session.Session()
                self._s3_client = session.client(
                    service_name="s3",
                    region_name=self.region,
                    endpoint_url=self.endpoint_url,
                    aws_access_key_id=self.access_key_id,
                    aws_secret_access_key=self.secret_access_key,
                    config=boto_config,
                )
            except Exception as exc:
                logger.error("Failed to initialize boto3 S3 client for Spaces: %s", exc)
                raise StorageError(f"Failed to initialize cloud storage client: {exc}") from exc
        return self._s3_client

    def _validate_storage_key(self, storage_key: str) -> str:
        """
        Validate storage key against path traversal attacks.
        Disallows absolute paths, null bytes, double-dots, or drive specifiers.
        """
        if not storage_key or not str(storage_key).strip():
            raise StorageError("Storage key cannot be empty.")

        clean_key = str(storage_key).strip().replace("\\", "/")
        if (
            clean_key.startswith("/")
            or "\0" in clean_key
            or ":" in clean_key
            or ".." in clean_key
        ):
            raise StoragePathTraversalError(
                f"Path traversal detected in storage key: '{storage_key}'"
            )

        return clean_key

    def _sanitize_subfolder(self, subfolder: str) -> str:
        """
        Sanitizes a subfolder name for S3 object key prefixing.
        Fails closed on path traversal.
        """
        if not subfolder or not str(subfolder).strip():
            return ""

        clean = str(subfolder).strip().replace("\\", "/")
        if clean.startswith("/") or "\0" in clean or ":" in clean or ".." in clean:
            raise StoragePathTraversalError(
                f"Path traversal detected in subfolder specification: '{subfolder}'"
            )

        if clean.endswith("/"):
            clean = clean.rstrip("/")

        return clean

    @staticmethod
    def _is_not_found_error(exc: Exception) -> bool:
        """Check if an AWS / Spaces client exception indicates a 404 / NoSuchKey."""
        response = getattr(exc, "response", None)
        if isinstance(response, dict):
            code = response.get("Error", {}).get("Code", "")
            status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if code in ("404", "NoSuchKey", "NotFound") or status == 404:
                return True
        err_msg = str(exc)
        return "404" in err_msg or "NoSuchKey" in err_msg or "NotFound" in err_msg

    def save_file(
        self,
        content: Optional[Union[bytes, BinaryIO]] = None,
        filename: Optional[str] = None,
        subfolder: Optional[str] = None,
        *,
        file: Optional[Union[bytes, BinaryIO]] = None,
        sub_dir: Optional[str] = None,
        allowed_mime_types: Optional[Union[Set[str], list]] = None,
        allowed_types: Optional[Union[Set[str], list]] = None,
        max_size_bytes: Optional[int] = None,
        mime_type: Optional[str] = None,
        content_type: Optional[str] = None,
        **kwargs,
    ) -> StorageResult:
        """
        Validate, checksum, and securely persist file bytes to DigitalOcean Spaces bucket.
        Enforces private ACL, verified MIME type, and safe random server-prefixed object keys.
        """
        content_bytes, actual_filename, raw_subfolder, _, effective_mime, file_size = (
            normalize_save_file_args(
                content=content,
                filename=filename,
                subfolder=subfolder,
                file=file,
                sub_dir=sub_dir,
                allowed_mime_types=allowed_mime_types,
                allowed_types=allowed_types,
                max_size_bytes=max_size_bytes,
                mime_type=mime_type,
                content_type=content_type,
            )
        )

        clean_subfolder = self._sanitize_subfolder(raw_subfolder)
        sha256 = hashlib.sha256(content_bytes).hexdigest()

        safe_base = sanitize_filename(actual_filename)
        unique_prefix = uuid.uuid4().hex[:12]
        stored_filename = f"{unique_prefix}_{safe_base}"

        if clean_subfolder:
            storage_key = f"{clean_subfolder}/{stored_filename}"
        else:
            storage_key = stored_filename

        try:
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=storage_key,
                Body=content_bytes,
                ContentType=effective_mime,
                ACL="private",
                Metadata={
                    "sha256": sha256,
                    "original_filename": safe_base,
                },
            )
        except Exception as exc:
            logger.error("Failed to upload file to Spaces key '%s': %s", storage_key, exc)
            raise StorageError(f"Cloud storage upload failed for key '{storage_key}': {exc}") from exc

        return StorageResult(
            storage_key=storage_key,
            original_filename=actual_filename,
            stored_filename=stored_filename,
            sha256_checksum=sha256,
            file_size_bytes=file_size,
            mime_type=effective_mime,
            absolute_path=None,
        )

    def get_file_bytes(self, storage_key: str) -> bytes:
        """
        Retrieve binary payload directly from DigitalOcean Spaces.
        """
        clean_key = self._validate_storage_key(storage_key)
        try:
            response = self.s3_client.get_object(Bucket=self.bucket, Key=clean_key)
            return response["Body"].read()
        except Exception as exc:
            if self._is_not_found_error(exc):
                raise StorageFileNotFoundError(f"File not found in storage for key '{clean_key}'.") from exc
            logger.error("Failed to retrieve file from Spaces for key '%s': %s", clean_key, exc)
            raise StorageError(f"Cloud storage read failed for key '{clean_key}': {exc}") from exc

    def get_file_path(self, storage_key: str) -> Path:
        """
        Resolve object to a local cached filesystem path for streaming via FileResponse.
        Atomically caches downloaded content to avoid partial reads.
        """
        clean_key = self._validate_storage_key(storage_key)
        cache_path = (self._cache_dir / clean_key.replace("/", os.sep)).resolve()

        # Strict containment check against cache directory
        try:
            cache_path.relative_to(self._cache_dir)
        except ValueError as exc:
            raise StoragePathTraversalError(
                f"Storage key '{storage_key}' escapes the local cache boundary."
            ) from exc

        if not cache_path.is_file():
            content_bytes = self.get_file_bytes(clean_key)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            temp_cache_path = cache_path.parent / f".tmp_{uuid.uuid4().hex}_{cache_path.name}"
            try:
                with open(temp_cache_path, "wb") as f:
                    f.write(content_bytes)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(temp_cache_path, cache_path)
            except Exception as exc:
                if temp_cache_path.exists():
                    try:
                        temp_cache_path.unlink()
                    except OSError:
                        pass
                raise StorageError(f"Failed to cache cloud file locally: {exc}") from exc

        return cache_path

    def delete_file(self, storage_key: str) -> bool:
        """
        Safely remove an object from DigitalOcean Spaces and remove any local cache copy.
        """
        clean_key = self._validate_storage_key(storage_key)
        if not self.exists(clean_key):
            return False

        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=clean_key)

            # Evict from local cache if present
            cache_path = (self._cache_dir / clean_key.replace("/", os.sep)).resolve()
            if cache_path.is_file():
                try:
                    cache_path.unlink()
                except OSError:
                    pass

            return True
        except Exception as exc:
            logger.error("Failed to delete file from Spaces for key '%s': %s", clean_key, exc)
            raise StorageError(f"Cloud storage delete failed for key '{clean_key}': {exc}") from exc

    def exists(self, storage_key: str) -> bool:
        """
        Check if an object exists in the Spaces bucket.
        """
        try:
            clean_key = self._validate_storage_key(storage_key)
            self.s3_client.head_object(Bucket=self.bucket, Key=clean_key)
            return True
        except StoragePathTraversalError:
            return False
        except Exception as exc:
            if self._is_not_found_error(exc):
                return False
            logger.error("Failed to check file existence in Spaces for key '%s': %s", storage_key, exc)
            raise StorageError(f"Cloud storage existence check failed for key '{storage_key}': {exc}") from exc

    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 300) -> str:
        """
        Generate a secure time-limited presigned GET URL for an authorized client.
        """
        clean_key = self._validate_storage_key(storage_key)
        try:
            return self.s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket, "Key": clean_key},
                ExpiresIn=expires_in_seconds,
            )
        except Exception as exc:
            logger.error("Failed to generate presigned URL for key '%s': %s", clean_key, exc)
            raise StorageError(f"Failed to generate presigned URL: {exc}") from exc
