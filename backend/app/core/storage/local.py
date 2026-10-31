"""
Secure Local Filesystem Storage Provider for VYASA-n.
Implements:
1. Provider-independent storage interface.
2. Strict path traversal prevention (fail-closed directory boundary).
3. Filename sanitization and unique server-generated prefixing.
4. Magic byte signature verification for PDF, PNG, JPEG, and WebP.
5. Byte-size limits and SHA-256 integrity checksum calculation.
6. Atomic file writing to prevent partial/corrupted uploads.
"""

import hashlib
import io
import os
from pathlib import Path
import re
from typing import BinaryIO, Dict, Optional, Set, Union
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
)

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
    # Replace whitespace
    base = re.sub(r"\s+", "_", base)
    # Remove dangerous characters
    base = re.sub(r"[^a-zA-Z0-9_.-]", "", base)
    # Prevent hidden unix dotfiles
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
    norm_mime = declared_mime_type.strip().lower()
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


class LocalStorageProvider(BaseStorageProvider):
    """
    Concrete storage implementation persisting files under a designated root folder.
    All operations are confined strictly within the configured root directory.
    """

    def __init__(self, base_dir: Optional[Union[str, Path]] = None):
        if base_dir:
            self._base_dir = Path(base_dir).resolve()
        else:
            self._base_dir = Path(settings.STORAGE_BASE_DIR).resolve()
        # Ensure base directory exists
        self._base_dir.mkdir(parents=True, exist_ok=True)

    @property
    def base_dir(self) -> Path:
        return self._base_dir

    def _resolve_safe_subfolder(self, subfolder: str) -> Path:
        """
        Validate and resolve a relative subfolder path.
        Fails closed on any attempt to escape root via '../', absolute paths, or special symbols.
        """
        if not subfolder or not str(subfolder).strip():
            target = self._base_dir
        else:
            clean_subfolder = str(subfolder).strip().replace("\\", "/")
            # Rejects null bytes, drive colons, or double-dots
            if "\0" in clean_subfolder or ":" in clean_subfolder or ".." in clean_subfolder:
                raise StoragePathTraversalError(
                    f"Path traversal detected in subfolder specification: '{subfolder}'"
                )
            target = (self._base_dir / clean_subfolder).resolve()

        # Strict containment check
        try:
            target.relative_to(self._base_dir)
        except ValueError as exc:
            raise StoragePathTraversalError(
                f"Subfolder '{subfolder}' escapes the permitted storage root."
            ) from exc

        return target

    def _resolve_safe_path_from_key(self, storage_key: str) -> Path:
        """
        Resolve a storage key back to an absolute filesystem path.
        Strictly enforces that the resolved path is inside the storage root.
        """
        if not storage_key or not str(storage_key).strip():
            raise StorageError("Storage key cannot be empty.")

        clean_key = str(storage_key).strip().replace("\\", "/")
        if "\0" in clean_key or ":" in clean_key or ".." in clean_key or clean_key.startswith("/"):
            raise StoragePathTraversalError(
                f"Path traversal detected in storage key: '{storage_key}'"
            )

        resolved = (self._base_dir / clean_key).resolve()
        try:
            resolved.relative_to(self._base_dir)
        except ValueError as exc:
            raise StoragePathTraversalError(
                f"Storage key '{storage_key}' escapes the permitted storage root."
            ) from exc

        return resolved

    def save_file(
        self,
        content: Union[bytes, BinaryIO],
        filename: str,
        subfolder: str,
        *,
        allowed_mime_types: Optional[Set[str]] = None,
        max_size_bytes: Optional[int] = None,
        mime_type: Optional[str] = None,
    ) -> StorageResult:
        """
        Persist a file into storage with strict validation.
        """
        # Read content to bytes
        if isinstance(content, (io.BytesIO, BinaryIO)):
            content_bytes = content.read()
        elif isinstance(content, bytes):
            content_bytes = content
        else:
            raise StorageError(f"Unsupported content type: {type(content)}")

        file_size = len(content_bytes)

        # Enforce size limits
        size_limit = max_size_bytes or DEFAULT_MAX_UPLOAD_BYTES
        if file_size > size_limit:
            raise StorageSizeLimitError(
                f"File size ({file_size} bytes) exceeds maximum permitted limit ({size_limit} bytes)."
            )

        if file_size == 0:
            raise StorageError("Cannot store an empty 0-byte file.")

        # Resolve MIME type
        effective_mime = (mime_type or "application/octet-stream").strip().lower()
        allowed = allowed_mime_types or DEFAULT_ALLOWED_MIME_TYPES

        if effective_mime not in allowed:
            raise StorageInvalidFileTypeError(
                f"MIME type '{effective_mime}' is not permitted. Allowed: {sorted(allowed)}"
            )

        # Verify magic byte signature
        verify_magic_bytes(content_bytes, effective_mime)

        # Calculate SHA-256
        sha256 = hashlib.sha256(content_bytes).hexdigest()

        # Sanitize filename and create unique server-controlled stored name
        safe_base = sanitize_filename(filename)
        unique_prefix = uuid.uuid4().hex[:12]
        stored_filename = f"{unique_prefix}_{safe_base}"

        # Resolve destination directory
        target_dir = self._resolve_safe_subfolder(subfolder)
        target_dir.mkdir(parents=True, exist_ok=True)

        final_path = target_dir / stored_filename
        temp_path = target_dir / f".tmp_{uuid.uuid4().hex}_{stored_filename}"

        # Atomic write
        try:
            with open(temp_path, "wb") as f:
                f.write(content_bytes)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, final_path)
        except Exception as exc:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise StorageError(f"Failed to write file to storage: {exc}") from exc

        # Construct relative storage key (forward slashes)
        rel_path = final_path.relative_to(self._base_dir).as_posix()

        return StorageResult(
            storage_key=rel_path,
            original_filename=filename,
            stored_filename=stored_filename,
            sha256_checksum=sha256,
            file_size_bytes=file_size,
            mime_type=effective_mime,
            absolute_path=final_path,
        )

    def get_file_bytes(self, storage_key: str) -> bytes:
        file_path = self.get_file_path(storage_key)
        try:
            with open(file_path, "rb") as f:
                return f.read()
        except OSError as exc:
            raise StorageError(f"Failed to read file for key '{storage_key}': {exc}") from exc

    def get_file_path(self, storage_key: str) -> Path:
        resolved = self._resolve_safe_path_from_key(storage_key)
        if not resolved.is_file():
            raise StorageFileNotFoundError(f"File not found for storage key '{storage_key}'.")
        return resolved

    def delete_file(self, storage_key: str) -> bool:
        try:
            resolved = self._resolve_safe_path_from_key(storage_key)
            if resolved.is_file():
                resolved.unlink()
                return True
            return False
        except (StorageFileNotFoundError, StoragePathTraversalError):
            return False
        except OSError as exc:
            raise StorageError(f"Failed to delete file for key '{storage_key}': {exc}") from exc

    def exists(self, storage_key: str) -> bool:
        try:
            resolved = self._resolve_safe_path_from_key(storage_key)
            return resolved.is_file()
        except (StoragePathTraversalError, StorageError):
            return False
