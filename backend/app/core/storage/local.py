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
import os
from pathlib import Path
import shutil
from typing import Any, BinaryIO, Dict, Iterator, Optional, Set, Union
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
    MAGIC_SIGNATURES,
    DEFAULT_MAX_UPLOAD_BYTES,
    DEFAULT_ALLOWED_MIME_TYPES,
    sanitize_filename,
    verify_magic_bytes,
    normalize_save_file_args,
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
            # Rejects null bytes, drive colons, double-dots, or absolute paths
            if (
                clean_subfolder.startswith("/")
                or "\0" in clean_subfolder
                or ":" in clean_subfolder
                or ".." in clean_subfolder
            ):
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
        # Strip redundant leading storage root prefixes if present from legacy paths
        if clean_key.startswith("backend/storage/"):
            clean_key = clean_key[len("backend/storage/"):]
        elif clean_key.startswith("storage/"):
            clean_key = clean_key[len("storage/"):]

        if (
            clean_key.startswith("/")
            or "\0" in clean_key
            or ":" in clean_key
            or ".." in clean_key
        ):
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
        Persist a file into local storage with strict validation.
        Accepts both canonical parameter names and caller aliases.
        """
        content_bytes, actual_filename, actual_subfolder, _, effective_mime, file_size = (
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

        # Calculate SHA-256
        sha256 = hashlib.sha256(content_bytes).hexdigest()

        # Sanitize filename and create unique server-controlled stored name
        safe_base = sanitize_filename(actual_filename)
        unique_prefix = uuid.uuid4().hex[:12]
        stored_filename = f"{unique_prefix}_{safe_base}"

        # Resolve destination directory
        target_dir = self._resolve_safe_subfolder(actual_subfolder)
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
            original_filename=actual_filename,
            stored_filename=stored_filename,
            sha256_checksum=sha256,
            file_size_bytes=file_size,
            mime_type=effective_mime,
            absolute_path=final_path,
            bucket="local",
            storage_provider="local",
            metadata={
                "sha256": sha256,
                "original_filename": safe_base,
            },
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

    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 300) -> str:
        """
        Generate a download path for local development.
        Verifies key validity and returns a local API stream URL.
        """
        resolved = self._resolve_safe_path_from_key(storage_key)
        if not resolved.is_file():
            raise StorageFileNotFoundError(f"File not found for storage key '{storage_key}'.")
        clean_key = str(storage_key).strip().replace("\\", "/")
        return f"/api/v1/storage/download?key={clean_key}"

    def get_file_metadata(self, storage_key: str) -> Dict[str, Any]:
        """
        Retrieve file metadata for local file (size, MIME type, SHA-256 checksum, last modified).
        """
        path = self.get_file_path(storage_key)
        st = path.stat()
        content = path.read_bytes()
        sha256 = hashlib.sha256(content).hexdigest()
        from app.core.storage.base import infer_mime_type
        effective_mime = infer_mime_type(content, path.name)
        return {
            "storage_key": storage_key,
            "file_size_bytes": st.st_size,
            "mime_type": effective_mime,
            "sha256_checksum": sha256,
            "original_filename": path.name,
            "last_modified": st.st_mtime,
            "etag": f'"{sha256[:16]}"',
            "bucket": "local",
            "provider": "local",
        }

    def get_file_url(self, storage_key: str, public: bool = False, expires_in_seconds: int = 3600) -> str:
        """
        Retrieve URL for a local file (download route).
        """
        clean_key = str(storage_key).strip().replace("\\", "/")
        if public:
            return f"/api/v1/storage/public?key={clean_key}"
        return f"/api/v1/storage/download?key={clean_key}"

    def copy_file(self, source_key: str, destination_key: str) -> str:
        """
        Copy a file locally from source_key to destination_key.
        """
        src_path = self.get_file_path(source_key)
        dest_path = self._resolve_safe_path_from_key(destination_key)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_path, dest_path)
        return destination_key

    def move_file(self, source_key: str, destination_key: str) -> str:
        """
        Move a file locally from source_key to destination_key.
        """
        src_path = self.get_file_path(source_key)
        dest_path = self._resolve_safe_path_from_key(destination_key)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src_path), str(dest_path))
        return destination_key

    def stream_file(self, storage_key: str, chunk_size: int = 65536) -> Iterator[bytes]:
        """
        Stream binary content for a local storage key in chunks.
        """
        path = self.get_file_path(storage_key)
        with open(path, "rb") as f:
            while chunk := f.read(chunk_size):
                yield chunk
