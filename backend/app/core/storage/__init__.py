"""
VYASA Core Secure Storage Subsystem
Provides provider-independent storage interfaces, local filesystem implementation,
DigitalOcean Spaces (S3-compatible) implementation, and singleton access for documents,
research bulletins, certificates, and media assets.
"""

from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.storage.base import (
    BaseStorageProvider,
    StorageResult,
    StorageError,
    StoragePathTraversalError,
    StorageInvalidFileTypeError,
    StorageSizeLimitError,
    StorageFileNotFoundError,
    MAGIC_SIGNATURES,
    DEFAULT_MAX_UPLOAD_BYTES,
    DEFAULT_KNOWLEDGE_MAX_UPLOAD_BYTES,
    DEFAULT_ALLOWED_MIME_TYPES,
    KNOWLEDGE_ALLOWED_MIME_TYPES,
    MIME_DOCX,
    MIME_PPTX,
    MIME_PDF,
    MIME_TXT,
    sanitize_filename,
    verify_magic_bytes,
    infer_mime_type,
    normalize_save_file_args,
    generate_standard_storage_key,
)
from app.core.storage.local import LocalStorageProvider
from app.core.storage.spaces import SpacesStorageProvider


def create_storage_provider(
    provider_name: Optional[str] = None,
    **kwargs,
) -> BaseStorageProvider:
    """
    Factory creating a concrete storage provider instance based on provider name
    or project settings. Fails closed if the specified provider is unknown or misconfigured.
    """
    target = (provider_name or getattr(settings, "STORAGE_PROVIDER", "local") or "local").strip().lower()

    if target in ("spaces", "s3"):
        return SpacesStorageProvider(
            bucket=kwargs.get("bucket", getattr(settings, "SPACES_BUCKET", None)),
            region=kwargs.get("region", getattr(settings, "SPACES_REGION", "sgp1")),
            endpoint_url=kwargs.get("endpoint_url", getattr(settings, "SPACES_ENDPOINT_URL", None)),
            access_key_id=kwargs.get("access_key_id", getattr(settings, "SPACES_ACCESS_KEY_ID", None)),
            secret_access_key=kwargs.get("secret_access_key", getattr(settings, "SPACES_SECRET_ACCESS_KEY", None)),
            s3_client=kwargs.get("s3_client"),
            cache_dir=kwargs.get("cache_dir"),
        )
    elif target == "local":
        return LocalStorageProvider(
            base_dir=kwargs.get("base_dir", getattr(settings, "STORAGE_BASE_DIR", "storage"))
        )
    else:
        raise StorageError(
            f"Unsupported storage provider '{target}'. Permitted values: 'local', 'spaces'."
        )


class StorageServiceProxy(BaseStorageProvider):
    """
    Thread-safe / pluggable proxy delegating storage operations to the configured active provider.
    Maintains full backward compatibility with direct storage_service imports while
    supporting runtime provider switching and mock overrides in test environments.
    """

    def __init__(self):
        self._provider: Optional[BaseStorageProvider] = None

    def get_provider(self) -> BaseStorageProvider:
        if self._provider is None:
            self._provider = create_storage_provider()
        return self._provider

    def set_provider(self, provider: Optional[BaseStorageProvider]) -> None:
        self._provider = provider

    def reset_provider(self) -> None:
        self._provider = None

    def save_file(self, *args, **kwargs) -> StorageResult:
        return self.get_provider().save_file(*args, **kwargs)

    def upload_file(self, *args, **kwargs) -> StorageResult:
        return self.get_provider().upload_file(*args, **kwargs)

    def get_file_bytes(self, storage_key: str) -> bytes:
        return self.get_provider().get_file_bytes(storage_key)

    def get_file(self, storage_key: str) -> bytes:
        return self.get_provider().get_file(storage_key)

    def get_file_path(self, storage_key: str) -> Path:
        return self.get_provider().get_file_path(storage_key)

    def download_file(self, storage_key: str) -> Path:
        return self.get_provider().download_file(storage_key)

    def delete_file(self, storage_key: str) -> bool:
        return self.get_provider().delete_file(storage_key)

    def exists(self, storage_key: str) -> bool:
        return self.get_provider().exists(storage_key)

    def file_exists(self, storage_key: str) -> bool:
        return self.get_provider().file_exists(storage_key)

    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 300) -> str:
        return self.get_provider().generate_presigned_url(storage_key, expires_in_seconds=expires_in_seconds)

    def generate_signed_url(self, storage_key: str, expires_in_seconds: int = 300) -> str:
        return self.get_provider().generate_signed_url(storage_key, expires_in_seconds=expires_in_seconds)

    def get_file_metadata(self, storage_key: str):
        return self.get_provider().get_file_metadata(storage_key)

    def get_file_url(self, storage_key: str, public: bool = False, expires_in_seconds: int = 3600) -> str:
        return self.get_provider().get_file_url(storage_key, public=public, expires_in_seconds=expires_in_seconds)

    def copy_file(self, source_key: str, destination_key: str) -> str:
        return self.get_provider().copy_file(source_key, destination_key)

    def move_file(self, source_key: str, destination_key: str) -> str:
        return self.get_provider().move_file(source_key, destination_key)

    def stream_file(self, storage_key: str, chunk_size: int = 65536):
        return self.get_provider().stream_file(storage_key, chunk_size=chunk_size)

    def upload_stream(self, stream, filename: str, subfolder: str = "", **kwargs) -> StorageResult:
        return self.get_provider().upload_stream(stream, filename=filename, subfolder=subfolder, **kwargs)


# Global singleton proxy
storage_service: StorageServiceProxy = StorageServiceProxy()


def get_storage_provider() -> BaseStorageProvider:
    """Returns the current active storage provider instance."""
    return storage_service.get_provider()


__all__ = [
    "BaseStorageProvider",
    "LocalStorageProvider",
    "SpacesStorageProvider",
    "StorageResult",
    "StorageError",
    "StoragePathTraversalError",
    "StorageInvalidFileTypeError",
    "StorageSizeLimitError",
    "StorageFileNotFoundError",
    "MAGIC_SIGNATURES",
    "DEFAULT_MAX_UPLOAD_BYTES",
    "DEFAULT_KNOWLEDGE_MAX_UPLOAD_BYTES",
    "DEFAULT_ALLOWED_MIME_TYPES",
    "KNOWLEDGE_ALLOWED_MIME_TYPES",
    "MIME_DOCX",
    "MIME_PPTX",
    "MIME_PDF",
    "MIME_TXT",
    "sanitize_filename",
    "verify_magic_bytes",
    "infer_mime_type",
    "normalize_save_file_args",
    "generate_standard_storage_key",
    "create_storage_provider",
    "get_storage_provider",
    "storage_service",
]
