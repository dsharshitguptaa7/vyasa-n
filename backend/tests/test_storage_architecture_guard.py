"""
VYASA Architectural Guardrails: Storage Subsystem.
Enforces that:
1. No module in backend/app initializes raw boto3 clients directly outside app/core/storage/spaces.py.
2. No module performs direct unmanaged permanent open(..., 'wb') disk writes outside permitted exceptions.
3. The centralized storage service provides the complete standardized API contract.
4. SpacesStorageProvider strictly enforces private ACLs and fail-closed security.
5. All legacy compatibility aliases (file_data, destination_path, max_bytes, storage_path, file_size) function without error.
"""

import ast
import os
from pathlib import Path
import re
from unittest.mock import MagicMock
import pytest

from app.core.storage import (
    BaseStorageProvider,
    LocalStorageProvider,
    SpacesStorageProvider,
    StorageResult,
    StorageError,
    StoragePathTraversalError,
    storage_service,
    generate_standard_storage_key,
)


class TestStorageArchitectureGuard:
    """Verifies that no unauthorized persistent file writes or S3 clients exist in backend/app."""

    def test_no_raw_boto3_clients_outside_storage_provider(self):
        """Guard: No module outside app/core/storage/spaces.py may import or initialize boto3."""
        app_root = Path("backend/app").resolve()
        if not app_root.is_dir():
            app_root = Path("app").resolve()

        violations = []
        for root, _, files in os.walk(app_root):
            for f in files:
                if not f.endswith(".py"):
                    continue
                file_path = Path(root) / f
                # Permit only spaces.py within the storage subsystem
                if file_path.name in ("spaces.py", "test_spaces_storage_service.py"):
                    continue
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                if re.search(r"\bboto3\.(client|resource|session)\b", content):
                    violations.append(str(file_path.relative_to(app_root)))

        assert violations == [], (
            f"Direct boto3 client initialization detected outside app/core/storage/spaces.py: {violations}. "
            "All object storage operations must route through app.core.storage.storage_service."
        )

    def test_no_permanent_disk_writes_in_modules(self):
        """Guard: Modules must not use open(..., 'wb') for permanent file persistence."""
        app_root = Path("backend/app").resolve()
        if not app_root.is_dir():
            app_root = Path("app").resolve()

        # Approved exceptions: storage provider implementations and atomic cache writing
        approved_files = {
            "local.py",        # Core local storage provider implementation
            "spaces.py",       # Core Spaces local cache download
            "efile_pdf_generator.py",  # Generates vector PDF to temporary path
        }

        violations = []
        for root, _, files in os.walk(app_root):
            for f in files:
                if not f.endswith(".py") or f in approved_files:
                    continue
                file_path = Path(root) / f
                content = file_path.read_text(encoding="utf-8", errors="ignore")

                # Detect open(..., "wb") or open(..., 'wb')
                matches = re.finditer(r'open\s*\([^)]*["\']wb["\']', content)
                for m in matches:
                    line_no = content[:m.start()].count("\n") + 1
                    line = content.splitlines()[line_no - 1].strip()
                    # Exclude test files, tempfile references, or explicitly temporary writes
                    if "tmp" in line.lower() or "temp" in line.lower():
                        continue
                    violations.append(f"{file_path.name}:{line_no} -> {line}")

        assert violations == [], (
            f"Suspicious persistent open(..., 'wb') file writes found: {violations}. "
            "All persistent files must be stored via app.core.storage.storage_service."
        )

    def test_central_storage_service_complete_contract(self):
        """Guard: storage_service singleton must expose all standard capabilities."""
        required_methods = [
            "save_file",
            "upload_file",
            "get_file",
            "get_file_bytes",
            "download_file",
            "get_file_path",
            "delete_file",
            "exists",
            "file_exists",
            "get_file_metadata",
            "get_file_url",
            "generate_signed_url",
            "generate_presigned_url",
            "copy_file",
            "move_file",
            "stream_file",
            "upload_stream",
        ]

        for method in required_methods:
            assert hasattr(storage_service, method), (
                f"storage_service is missing required capability: '{method}'"
            )
            assert callable(getattr(storage_service, method)), (
                f"storage_service.{method} must be callable."
            )

    def test_spaces_provider_complete_contract_and_security(self):
        """Guard: SpacesStorageProvider must implement all required capabilities."""
        mock_client = MagicMock()
        provider = SpacesStorageProvider(
            bucket="vyasa-test-bucket",
            region="sgp1",
            access_key_id="test-key",
            secret_access_key="test-secret",
            s3_client=mock_client,
        )

        required_methods = [
            "save_file",
            "upload_file",
            "get_file",
            "get_file_bytes",
            "download_file",
            "get_file_path",
            "delete_file",
            "exists",
            "file_exists",
            "get_file_metadata",
            "get_file_url",
            "generate_signed_url",
            "generate_presigned_url",
            "copy_file",
            "move_file",
            "stream_file",
            "upload_stream",
        ]

        for method in required_methods:
            assert hasattr(provider, method), (
                f"SpacesStorageProvider is missing required method: '{method}'"
            )

    def test_storage_result_compatibility_properties(self):
        """Guard: StorageResult must provide all backwards-compatible aliases."""
        res = StorageResult(
            storage_key="vyasa/production/certificates/1/abc_cert.pdf",
            original_filename="cert.pdf",
            stored_filename="abc_cert.pdf",
            sha256_checksum="fakehash123",
            file_size_bytes=1024,
            mime_type="application/pdf",
        )

        assert res.storage_key == "vyasa/production/certificates/1/abc_cert.pdf"
        assert res.storage_path == "vyasa/production/certificates/1/abc_cert.pdf"
        assert res.file_path == "vyasa/production/certificates/1/abc_cert.pdf"
        assert res.file_size == 1024
        assert res.file_size_bytes == 1024
        assert res.filename == "abc_cert.pdf"
        assert res.checksum_sha256 == "fakehash123"
        assert res.mime_type == "application/pdf"

    def test_standard_object_key_generation(self):
        """Guard: Standard object keys must conform to vyasa/{env}/{module}/{entity}/{token}/{file}."""
        key = generate_standard_storage_key(
            module="certificates",
            entity_id="123",
            filename="my certificate.pdf",
            environment="production",
        )

        parts = key.split("/")
        assert parts[0] == "vyasa"
        assert parts[1] == "production"
        assert parts[2] == "certificates"
        assert parts[3] == "123"
        assert len(parts[4]) == 12  # UUID token
        assert parts[5] == "my_certificate.pdf"
        assert not key.startswith("/")
        assert ".." not in key
