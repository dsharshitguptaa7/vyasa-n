"""
Provider-independent Secure Storage Interfaces and Exceptions for VYASA-n.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Optional, Set, Union


class StorageError(Exception):
    """Base exception for all storage subsystem errors."""
    pass


class StoragePathTraversalError(StorageError):
    """Raised when an attempt to escape the permitted storage root is detected."""
    pass


class StorageInvalidFileTypeError(StorageError):
    """Raised when an uploaded file fails MIME type or magic-byte signature validation."""
    pass


class StorageSizeLimitError(StorageError):
    """Raised when an upload exceeds the allowed byte size threshold."""
    pass


class StorageFileNotFoundError(StorageError):
    """Raised when a requested storage key does not exist on disk."""
    pass


@dataclass(frozen=True)
class StorageResult:
    """Immutable metadata descriptor returned after successfully persisting a file."""
    storage_key: str
    original_filename: str
    stored_filename: str
    sha256_checksum: str
    file_size_bytes: int
    mime_type: str
    absolute_path: Path


class BaseStorageProvider(ABC):
    """
    Abstract contract for pluggable file storage backends (Local filesystem, S3, MinIO).
    """

    @abstractmethod
    def save_file(
        self,
        content: Union[bytes, BinaryIO],
        filename: str,
        subfolder: str,
        *,
        allowed_mime_types: Optional[Set[str]] = None,
        max_size_bytes: Optional[int] = None,
    ) -> StorageResult:
        """
        Validate, checksum, and securely persist file bytes to storage.
        """
        pass

    @abstractmethod
    def get_file_bytes(self, storage_key: str) -> bytes:
        """
        Read the entire binary content for a storage key.
        """
        pass

    @abstractmethod
    def get_file_path(self, storage_key: str) -> Path:
        """
        Resolve the absolute filesystem path for a storage key.
        """
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """
        Safely remove a file associated with a storage key.
        """
        pass

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        """
        Check if a file exists for the given storage key.
        """
        pass
