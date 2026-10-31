"""
VYASA Core Secure Storage Subsystem
Provides provider-independent storage interface, local filesystem implementation,
and singleton access for documents, research bulletins, certificates, and media assets.
"""

from app.core.storage.base import (
    BaseStorageProvider,
    StorageResult,
    StorageError,
    StoragePathTraversalError,
    StorageInvalidFileTypeError,
    StorageSizeLimitError,
    StorageFileNotFoundError,
)
from app.core.storage.local import LocalStorageProvider

# Default singleton instance
storage_service = LocalStorageProvider()

__all__ = [
    "BaseStorageProvider",
    "LocalStorageProvider",
    "StorageResult",
    "StorageError",
    "StoragePathTraversalError",
    "StorageInvalidFileTypeError",
    "StorageSizeLimitError",
    "StorageFileNotFoundError",
    "storage_service",
]
