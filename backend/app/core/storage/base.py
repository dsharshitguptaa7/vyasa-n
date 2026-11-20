"""
Provider-independent Secure Storage Interfaces and Exceptions for VYASA-n.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
import io
import os
from pathlib import Path
import re
from typing import Any, BinaryIO, Dict, List, Optional, Set, Tuple, Union
import uuid
import zipfile


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
DEFAULT_KNOWLEDGE_MAX_UPLOAD_BYTES: int = 100 * 1024 * 1024  # 100 MB for Knowledge Centre

# Standard allowed MIME types
DEFAULT_ALLOWED_MIME_TYPES: Set[str] = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
}

# Knowledge Centre specific allowed MIME types
MIME_DOCX: str = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MIME_PPTX: str = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
MIME_PDF: str = "application/pdf"
MIME_TXT: str = "text/plain"

KNOWLEDGE_ALLOWED_MIME_TYPES: Set[str] = {
    MIME_PDF,
    MIME_DOCX,
    MIME_PPTX,
    MIME_TXT,
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
    Prevents executable masquerading (e.g. .exe or .sh renamed to .pdf or .docx).
    Validates PDF, PNG, JPEG, WebP, OpenXML DOCX, OpenXML PPTX, and safe UTF-8 TXT.
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
    elif norm_mime == MIME_DOCX:
        if not content.startswith(b"PK\x03\x04"):
            raise StorageInvalidFileTypeError(
                "File signature mismatch: declared DOCX but does not begin with ZIP magic bytes (PK\\x03\\x04)."
            )
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                names = zf.namelist()
                has_content_types = "[Content_Types].xml" in names
                has_word_dir = any(n.startswith("word/") for n in names)
                if not (has_content_types and has_word_dir):
                    raise StorageInvalidFileTypeError(
                        "File signature mismatch: declared DOCX but ZIP structure lacks [Content_Types].xml or word/ parts."
                    )
        except zipfile.BadZipFile as exc:
            raise StorageInvalidFileTypeError(
                f"File signature mismatch: declared DOCX but archive is corrupt or invalid: {exc}"
            ) from exc
    elif norm_mime == MIME_PPTX:
        if not content.startswith(b"PK\x03\x04"):
            raise StorageInvalidFileTypeError(
                "File signature mismatch: declared PPTX but does not begin with ZIP magic bytes (PK\\x03\\x04)."
            )
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                names = zf.namelist()
                has_content_types = "[Content_Types].xml" in names
                has_ppt_dir = any(n.startswith("ppt/") for n in names)
                if not (has_content_types and has_ppt_dir):
                    raise StorageInvalidFileTypeError(
                        "File signature mismatch: declared PPTX but ZIP structure lacks [Content_Types].xml or ppt/ parts."
                    )
        except zipfile.BadZipFile as exc:
            raise StorageInvalidFileTypeError(
                f"File signature mismatch: declared PPTX but archive is corrupt or invalid: {exc}"
            ) from exc
    elif norm_mime == MIME_TXT:
        if b"\x00" in content:
            raise StorageInvalidFileTypeError(
                "File signature mismatch: declared 'text/plain' but contains null bytes (binary content)."
            )
        try:
            content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise StorageInvalidFileTypeError(
                f"File signature mismatch: declared 'text/plain' but content is not valid UTF-8 text: {exc}"
            ) from exc


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

    # Check ZIP container (DOCX / PPTX)
    if content.startswith(b"PK\x03\x04"):
        if filename:
            ext = os.path.splitext(filename)[1].lower()
            if ext == ".docx":
                return MIME_DOCX
            if ext == ".pptx":
                return MIME_PPTX
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                names = zf.namelist()
                if any(n.startswith("word/") for n in names):
                    return MIME_DOCX
                if any(n.startswith("ppt/") for n in names):
                    return MIME_PPTX
        except Exception:
            pass

    # Fallback to filename extension
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        ext_map = {
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".docx": MIME_DOCX,
            ".pptx": MIME_PPTX,
            ".txt": MIME_TXT,
        }
        if ext in ext_map:
            return ext_map[ext]

    # Check if safe text
    if content and b"\x00" not in content[:1024]:
        try:
            content[:1024].decode("utf-8")
            if filename and filename.lower().endswith(".txt"):
                return MIME_TXT
        except UnicodeDecodeError:
            pass

    return "application/octet-stream"


def normalize_save_file_args(
    content: Optional[Union[bytes, BinaryIO]] = None,
    filename: Optional[str] = None,
    subfolder: Optional[str] = None,
    *,
    file: Optional[Union[bytes, BinaryIO]] = None,
    file_data: Optional[Union[bytes, BinaryIO]] = None,
    destination_path: Optional[str] = None,
    file_name: Optional[str] = None,
    sub_dir: Optional[str] = None,
    allowed_mime_types: Optional[Union[Set[str], list]] = None,
    allowed_types: Optional[Union[Set[str], list]] = None,
    max_size_bytes: Optional[int] = None,
    max_bytes: Optional[int] = None,
    mime_type: Optional[str] = None,
    content_type: Optional[str] = None,
    **kwargs,
) -> Tuple[bytes, str, str, Set[str], str, int]:
    """
    Normalizes and validates save_file inputs across all providers.
    Supports both canonical arguments and caller keyword aliases (file, file_data, sub_dir,
    destination_path, allowed_types, max_bytes, file_name).
    """
    raw_content = (
        content
        if content is not None
        else (
            file
            if file is not None
            else (
                file_data
                if file_data is not None
                else kwargs.get("file_data", kwargs.get("data", kwargs.get("content")))
            )
        )
    )
    if raw_content is None:
        raise StorageError("No file content provided to save_file.")

    # Extract filename and content_type from UploadFile or file object if available
    inferred_filename = filename or file_name or getattr(raw_content, "filename", None) or kwargs.get("file_name")
    inferred_content_type = mime_type or content_type or getattr(raw_content, "content_type", None)

    # Read bytes from file-like object or FastAPI UploadFile
    if hasattr(raw_content, "file") and hasattr(raw_content.file, "read"):
        # FastAPI UploadFile object
        try:
            if hasattr(raw_content.file, "seek"):
                raw_content.file.seek(0)
            content_bytes = raw_content.file.read()
        except Exception as exc:
            raise StorageError(f"Failed to read UploadFile stream: {exc}") from exc
    elif hasattr(raw_content, "read"):
        try:
            if hasattr(raw_content, "seek"):
                raw_content.seek(0)
            content_bytes = raw_content.read()
        except Exception as exc:
            raise StorageError(f"Failed to read file-like stream: {exc}") from exc
    elif isinstance(raw_content, (bytes, bytearray)):
        content_bytes = bytes(raw_content)
    else:
        raise StorageError(f"Unsupported content type: {type(raw_content)}")

    file_size = len(content_bytes)

    effective_max_size = max_size_bytes or max_bytes or kwargs.get("max_bytes") or DEFAULT_MAX_UPLOAD_BYTES
    if file_size > effective_max_size:
        raise StorageSizeLimitError(
            f"File size ({file_size} bytes) exceeds maximum permitted limit ({effective_max_size} bytes)."
        )
    if file_size == 0:
        raise StorageError("Cannot store an empty 0-byte file.")

    # Handle destination_path alias (e.g. 'anudaan/applications/123/paper_abc.pdf')
    actual_destination = destination_path or kwargs.get("destination_path")
    if actual_destination and not subfolder and not sub_dir:
        dest_clean = str(actual_destination).replace("\\", "/").strip("/")
        if "/" in dest_clean:
            dest_dir, dest_file = dest_clean.rsplit("/", 1)
            actual_subfolder = dest_dir
            actual_filename = inferred_filename or dest_file
        else:
            actual_subfolder = ""
            actual_filename = inferred_filename or dest_clean
    else:
        actual_subfolder = subfolder if subfolder is not None else (sub_dir or kwargs.get("sub_dir") or "")
        actual_filename = inferred_filename or "unnamed_file"

    raw_allowed = allowed_mime_types if allowed_mime_types is not None else (allowed_types or kwargs.get("allowed_types"))
    if raw_allowed is not None:
        actual_allowed = set(raw_allowed)
    else:
        actual_allowed = DEFAULT_ALLOWED_MIME_TYPES

    declared = inferred_content_type
    effective_mime = infer_mime_type(content_bytes, actual_filename, declared)

    if effective_mime not in actual_allowed:
        raise StorageInvalidFileTypeError(
            f"MIME type '{effective_mime}' is not permitted. Allowed: {sorted(actual_allowed)}"
        )

    verify_magic_bytes(content_bytes, effective_mime)

    return content_bytes, actual_filename, str(actual_subfolder), actual_allowed, effective_mime, file_size


def generate_standard_storage_key(
    module: str,
    entity_id: Optional[Union[str, uuid.UUID]] = None,
    filename: Optional[str] = None,
    subfolder: Optional[str] = None,
    environment: Optional[str] = None,
) -> str:
    """
    Generate a predictable, collision-resistant, secure object key according to standard:
    vyasa/{environment}/{module}/{entity_id}/{uuid}/{filename}
    """
    env = (environment or os.getenv("NODE_ENV", "production") or "production").strip().lower()
    clean_mod = sanitize_filename(module or "common").lower()
    token = uuid.uuid4().hex[:12]
    clean_file = sanitize_filename(filename or "document.bin")

    parts = ["vyasa", env, clean_mod]
    if subfolder and str(subfolder).strip():
        sub_parts = [sanitize_filename(p) for p in str(subfolder).replace("\\", "/").strip("/").split("/") if p]
        parts.extend(sub_parts)
    elif entity_id is not None and str(entity_id).strip():
        parts.append(str(entity_id).strip())

    parts.append(token)
    parts.append(clean_file)
    return "/".join(parts)


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
    bucket: Optional[str] = None
    storage_provider: str = "spaces"
    metadata: Optional[Dict[str, Any]] = None

    @property
    def filename(self) -> str:
        """Compatibility alias for stored_filename expected by API endpoints."""
        return self.stored_filename

    @property
    def checksum_sha256(self) -> str:
        """Compatibility alias for sha256_checksum expected by API endpoints."""
        return self.sha256_checksum

    @property
    def storage_path(self) -> str:
        """Compatibility alias for storage_key expected by certain routers/services."""
        return self.storage_key

    @property
    def file_path(self) -> str:
        """Compatibility alias for storage_key expected by legacy callers."""
        return self.storage_key

    @property
    def file_size(self) -> int:
        """Compatibility alias for file_size_bytes expected by certain routers/services."""
        return self.file_size_bytes


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

    def upload_file(self, *args, **kwargs) -> StorageResult:
        """Standard alias for save_file across all callers."""
        return self.save_file(*args, **kwargs)

    @abstractmethod
    def get_file_bytes(self, storage_key: str) -> bytes:
        """Read the entire binary content for a storage key."""
        pass

    def get_file(self, storage_key: str) -> bytes:
        """Standard alias for get_file_bytes."""
        return self.get_file_bytes(storage_key)

    @abstractmethod
    def get_file_path(self, storage_key: str) -> Path:
        """
        Resolve or fetch the file to a local filesystem path for streaming via FileResponse.
        For remote providers, caches or downloads to a local temporary path.
        """
        pass

    def download_file(self, storage_key: str) -> Path:
        """Standard alias for get_file_path."""
        return self.get_file_path(storage_key)

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """Safely remove a file associated with a storage key."""
        pass

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Check if a file exists for the given storage key."""
        pass

    def file_exists(self, storage_key: str) -> bool:
        """Standard alias for exists."""
        return self.exists(storage_key)

    @abstractmethod
    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 300) -> str:
        """
        Generate a secure time-limited download URL for an authorized client.
        For cloud providers (Spaces/S3), returns an authenticated pre-signed URL.
        For local providers, returns a relative API download route.
        """
        pass

    def generate_signed_url(self, storage_key: str, expires_in_seconds: int = 300) -> str:
        """Standard alias for generate_presigned_url."""
        return self.generate_presigned_url(storage_key, expires_in_seconds=expires_in_seconds)

    @abstractmethod
    def get_file_metadata(self, storage_key: str) -> Dict[str, Any]:
        """Retrieve metadata for an object (size, MIME type, checksum, last modified, provider)."""
        pass

    @abstractmethod
    def get_file_url(self, storage_key: str, public: bool = False, expires_in_seconds: int = 3600) -> str:
        """Retrieve URL for an object (CDN/public or signed URL)."""
        pass

    @abstractmethod
    def copy_file(self, source_key: str, destination_key: str) -> str:
        """Copy an object from source_key to destination_key within storage."""
        pass

    @abstractmethod
    def move_file(self, source_key: str, destination_key: str) -> str:
        """Move an object from source_key to destination_key within storage."""
        pass

    @abstractmethod
    def stream_file(self, storage_key: str, chunk_size: int = 65536):
        """Stream binary content for a storage key in chunks."""
        pass

    def upload_stream(
        self,
        stream: BinaryIO,
        filename: str,
        subfolder: str = "",
        **kwargs,
    ) -> StorageResult:
        """Upload from a binary stream or file-like object."""
        return self.save_file(content=stream, filename=filename, subfolder=subfolder, **kwargs)
