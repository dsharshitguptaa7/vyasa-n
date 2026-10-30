"""
Database-Free Unit Tests for Central Secure Storage Service.
Verifies:
1. Provider interface contract.
2. Safe local file writing, unique server prefixing, and sanitization.
3. Checksum generation (SHA-256).
4. Magic byte signature verification for PDF, PNG, JPEG, and WebP.
5. Rejection of executable masquerading.
6. Size limit enforcement.
7. Path traversal prevention (.., colons, null bytes, absolute paths).
8. Atomic writes and zero leftover temporary files.
9. File existence, reading, and deletion.
"""

import hashlib
import io
import pytest

from app.core.storage import (
    LocalStorageProvider,
    StorageResult,
    StoragePathTraversalError,
    StorageInvalidFileTypeError,
    StorageSizeLimitError,
    StorageFileNotFoundError,
)
from app.core.storage.local import sanitize_filename


SAMPLE_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
SAMPLE_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
SAMPLE_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01"
SAMPLE_WEBP_BYTES = b"RIFF\x24\x00\x00\x00WEBPVP8 \x18\x00\x00\x00"


def test_sanitize_filename():
    assert sanitize_filename("my report.pdf") == "my_report.pdf"
    assert sanitize_filename("../../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\boot.ini") == "boot.ini"
    assert sanitize_filename("C:\\Windows\\System32\\cmd.exe") == "cmd.exe"
    assert sanitize_filename("bulletin & volume #2 (march).pdf") == "bulletin__volume_2_march.pdf"
    assert sanitize_filename(".hidden_file.pdf") == "hidden_file.pdf"
    assert sanitize_filename("") == "unnamed_file"


def test_save_and_retrieve_pdf_file(tmp_path):
    provider = LocalStorageProvider(base_dir=tmp_path)
    expected_hash = hashlib.sha256(SAMPLE_PDF_BYTES).hexdigest()

    result = provider.save_file(
        content=SAMPLE_PDF_BYTES,
        filename="Volume_2_Issue_1.pdf",
        subfolder="sama_veda/bulletins",
        mime_type="application/pdf",
    )

    assert isinstance(result, StorageResult)
    assert result.original_filename == "Volume_2_Issue_1.pdf"
    assert "Volume_2_Issue_1.pdf" in result.stored_filename
    assert result.sha256_checksum == expected_hash
    assert result.file_size_bytes == len(SAMPLE_PDF_BYTES)
    assert result.mime_type == "application/pdf"
    assert result.storage_key.startswith("sama_veda/bulletins/")
    assert result.absolute_path.is_file()

    # Verify retrieval
    read_bytes = provider.get_file_bytes(result.storage_key)
    assert read_bytes == SAMPLE_PDF_BYTES
    assert provider.exists(result.storage_key) is True


def test_magic_byte_verification_for_valid_image_types(tmp_path):
    provider = LocalStorageProvider(base_dir=tmp_path)

    # PNG
    png_res = provider.save_file(
        content=SAMPLE_PNG_BYTES,
        filename="cover.png",
        subfolder="sama_veda/covers",
        mime_type="image/png",
    )
    assert png_res.mime_type == "image/png"

    # JPEG
    jpeg_res = provider.save_file(
        content=SAMPLE_JPEG_BYTES,
        filename="author.jpg",
        subfolder="sama_veda/authors",
        mime_type="image/jpeg",
    )
    assert jpeg_res.mime_type == "image/jpeg"

    # WebP
    webp_res = provider.save_file(
        content=SAMPLE_WEBP_BYTES,
        filename="spotlight.webp",
        subfolder="sama_veda/spotlights",
        mime_type="image/webp",
    )
    assert webp_res.mime_type == "image/webp"


def test_reject_executable_masquerading_as_pdf(tmp_path):
    """Verifies that executable content masquerading with .pdf extension is rejected."""
    provider = LocalStorageProvider(base_dir=tmp_path)
    malicious_script = b"#!/bin/bash\nrm -rf /\n"

    with pytest.raises(StorageInvalidFileTypeError) as exc:
        provider.save_file(
            content=malicious_script,
            filename="trojan.pdf",
            subfolder="sama_veda/certificates",
            mime_type="application/pdf",
        )
    assert "File signature mismatch" in str(exc.value)


def test_reject_disallowed_mime_type(tmp_path):
    provider = LocalStorageProvider(base_dir=tmp_path)
    content = b"<html><body>Hello</body></html>"

    with pytest.raises(StorageInvalidFileTypeError) as exc:
        provider.save_file(
            content=content,
            filename="page.html",
            subfolder="sama_veda/test",
            mime_type="text/html",
        )
    assert "is not permitted" in str(exc.value)


def test_reject_oversized_file(tmp_path):
    provider = LocalStorageProvider(base_dir=tmp_path)
    oversized = SAMPLE_PDF_BYTES + (b"0" * 2000)

    with pytest.raises(StorageSizeLimitError) as exc:
        provider.save_file(
            content=oversized,
            filename="large.pdf",
            subfolder="sama_veda/bulletins",
            mime_type="application/pdf",
            max_size_bytes=100,  # Strict small limit for test
        )
    assert "exceeds maximum permitted limit" in str(exc.value)


@pytest.mark.parametrize(
    "traversal_key",
    [
        "../secrets.txt",
        "..\\secrets.txt",
        "sama_veda/../../outside.txt",
        "/etc/shadow",
        "C:\\Windows\\System32\\cmd.exe",
        "sub\0folder/file.pdf",
    ],
)
def test_path_traversal_subfolder_rejection(tmp_path, traversal_key):
    provider = LocalStorageProvider(base_dir=tmp_path)

    with pytest.raises(StoragePathTraversalError):
        provider.save_file(
            content=SAMPLE_PDF_BYTES,
            filename="test.pdf",
            subfolder=traversal_key,
            mime_type="application/pdf",
        )


@pytest.mark.parametrize(
    "traversal_key",
    [
        "../secrets.txt",
        "..\\secrets.txt",
        "sama_veda/../../outside.txt",
        "/etc/shadow",
        "C:\\Windows\\System32\\cmd.exe",
    ],
)
def test_path_traversal_lookup_rejection(tmp_path, traversal_key):
    provider = LocalStorageProvider(base_dir=tmp_path)

    with pytest.raises(StoragePathTraversalError):
        provider.get_file_path(traversal_key)

    with pytest.raises(StoragePathTraversalError):
        provider.get_file_bytes(traversal_key)


def test_file_deletion_and_not_found(tmp_path):
    provider = LocalStorageProvider(base_dir=tmp_path)

    result = provider.save_file(
        content=SAMPLE_PDF_BYTES,
        filename="cert.pdf",
        subfolder="sama_veda/certificates",
        mime_type="application/pdf",
    )

    assert provider.exists(result.storage_key) is True
    assert provider.delete_file(result.storage_key) is True
    assert provider.exists(result.storage_key) is False

    # Deleting non-existent file returns False safely
    assert provider.delete_file(result.storage_key) is False

    with pytest.raises(StorageFileNotFoundError):
        provider.get_file_bytes(result.storage_key)


def test_atomic_write_no_leftover_tmp(tmp_path):
    provider = LocalStorageProvider(base_dir=tmp_path)

    result = provider.save_file(
        content=SAMPLE_PDF_BYTES,
        filename="atomic.pdf",
        subfolder="sama_veda/bulletins",
        mime_type="application/pdf",
    )

    parent_dir = result.absolute_path.parent
    tmp_files = list(parent_dir.glob(".tmp_*"))
    assert len(tmp_files) == 0, f"Found leftover temp files: {tmp_files}"
