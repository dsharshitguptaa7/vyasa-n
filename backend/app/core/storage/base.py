"""
Provider-independent Secure Storage Interfaces and Exceptions for VYASA-n.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
import os
from pathlib import Path
import re
from typing import BinaryIO, Dict, Optional, Set, Tuple, Union


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
    """Raised when a requested storage key does not exist on disk or in remote storage."""
    pass


# Known file signatures (magic bytes) for validation
MAGIC_SIGNATURES: Dict[str, bytes] = {
    "application/pdf": b"%PDF",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
}

# Standard default limits
DEFAULT_MAX_UPLOAD_BYTES: int = 25 * 1024 * 1024  # 25 MB
DEFAULT_ALLOWED_MIME_TYPES: Set[str] = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}


def sanitize_filename(filename: str) -> str:
    """
    Sanitize arbitrary user-supplied filename:
    - Strips directory components and path separators.
    - Replaces whitespace with underscores.
    - Strips non-alphanumeric characters (except '.', '-', '_').
    - Limits length to 120 chars.
    """
    base = os.path.basename(filename).strip()
    if not base:
        base = "unnamed_file"
    base = re.sub(r"\s+", "_", base)
    base = re.sub(r"[^a-zA-Z0-9_.-]", "", base)
    while base.startswith("."):
        base = base[1:]
    if not base:
        base = "unnamed_file"
    return base[:120]


def verify_magic_bytes(content: bytes, declared_mime_type: str) -> None:
    """
    Inspect magic bytes to verify file matches its declared MIME type.
    Prevents executable masquerading (e.g. .exe or .sh renamed to .pdf).
    """
    norm_mime = (declared_mime_type or "").strip().lower()
    if norm_mime in MAGIC_SIGNATURES:
        expected = MAGIC_SIGNATURES[norm_mime]
        if not content.startswith(expected):
            raise StorageInvalidFileTypeError(
                f"File signature mismatch: declared '{declared_mime_type}' but does not begin with expected magic bytes."
            )
    elif norm_mime == "image/webp":
        if len(content) < 12 or content[:4] != b"RIFF" or content[8:12] != b"WEBP":
            raise StorageInvalidFileTypeError(
                "File signature mismatch: declared 'image/webp' but does not contain valid RIFF/WEBP header."
            )


def infer_mime_type(content: bytes, filename: Optional[str] = None, declared_mime_type: Optional[str] = None) -> str:
    """
    Infer effective MIME type from content magic bytes or filename when
    unspecified or generically labeled as application/octet-stream.
    """
    norm_mime = (declared_mime_type or "").strip().lower()
    if norm_mime and norm_mime != "application/octet-stream":
        return norm_mime

    # Check magic signatures
    if content.startswith(b"%PDF"):
        return "application/pdf"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"

    # Fallback to filename extension
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        ext_map = {
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
        }
        if ext in ext_map:
            return ext_map[ext]

    return "application/octet-stream"


def normalize_save_file_args(
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
) -> Tuple[bytes, str, str, Set[str], str, int]:
    """
    Normalizes and validates save_file inputs across all providers.
    Supports both canonical arguments and caller keyword aliases (file, sub_dir, allowed_types).
    """
    raw_content = content if content is not None else file
    if raw_content is None:
        raise StorageError("No file content provided to save_file.")

    if hasattr(raw_content, "read"):
        content_bytes = raw_content.read()
    elif isinstance(raw_content, bytes):
        content_bytes = raw_content
    else:
        raise StorageError(f"Unsupported content type: {type(raw_content)}")

    file_size = len(content_bytes)

    size_limit = max_size_bytes or DEFAULT_MAX_UPLOAD_BYTES
    if file_size > size_limit:
        raise StorageSizeLimitError(
            f"File size ({file_size} bytes) exceeds maximum permitted limit ({size_limit} bytes)."
        )
    if file_size == 0:
        raise StorageError("Cannot store an empty 0-byte file.")

    actual_filename = filename or "unnamed_file"
    actual_subfolder = subfolder if subfolder is not None else (sub_dir or "")

    raw_allowed = allowed_mime_types if allowed_mime_types is not None else allowed_types
    if raw_allowed is not None:
        actual_allowed = set(raw_allowed)
    else:
        actual_allowed = DEFAULT_ALLOWED_MIME_TYPES

    declared = mime_type or content_type
    effective_mime = infer_mime_type(content_bytes, actual_filename, declared)

    if effective_mime not in actual_allowed:
        raise StorageInvalidFileTypeError(
            f"MIME type '{effective_mime}' is not permitted. Allowed: {sorted(actual_allowed)}"
        )

    verify_magic_bytes(content_bytes, effective_mime)

    return content_bytes, actual_filename, str(actual_subfolder), actual_allowed, effective_mime, file_size


@dataclass(frozen=True)
class StorageResult:
    """Immutable metadata descriptor returned after successfully persisting a file."""
    storage_key: str
    original_filename: str
    stored_filename: str
    sha256_checksum: str
    file_size_bytes: int
    mime_type: str
    absolute_path: Optional[Path] = None

    @property
    def filename(self) -> str:
        """Compatibility alias for stored_filename expected by API endpoints."""
        return self.stored_filename

    @property
    def checksum_sha256(self) -> str:
        """Compatibility alias for sha256_checksum expected by API endpoints."""
        return self.sha256_checksum


class BaseStorageProvider(ABC):
    """
    Abstract contract for pluggable file storage backends (Local filesystem, DigitalOcean Spaces, S3).
    """

    @abstractmethod
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
        Validate, checksum, and securely persist file bytes to storage.
        Supports both canonical parameter names and caller aliases.
        """
        pass

    @abstractmethod
    def get_file_bytes(self, storage_key: str) -> bytes:
        """Read the entire binary content for a storage key."""
        pass

    @abstractmethod
    def get_file_path(self, storage_key: str) -> Path:
        """
        Resolve or fetch the file to a local filesystem path for streaming via FileResponse.
        For remote providers, caches or downloads to a local temporary path.
        """
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """Safely remove a file associated with a storage key."""
        pass

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Check if a file exists for the given storage key."""
        pass
