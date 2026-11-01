"""
Production-Ready DigitalOcean Spaces Storage Test Suite for VYASA-n.
Verifies:
1. Provider selection and configuration validation (fail-closed, no silent fallback).
2. The corrected save_file() contract across canonical args and router aliases.
3. Upload, download, existence checks, deletion, and presigned URLs.
4. Security enforcement: private ACL, path traversal prevention, magic bytes, size limits.
5. Network/cloud failure handling without credential leakage.
6. API upload and download endpoints operating with SpacesStorageProvider.
"""

from datetime import datetime, timezone
import hashlib
import io
import os
from pathlib import Path
from unittest.mock import MagicMock, patch
import uuid

from botocore.exceptions import ClientError, EndpointConnectionError
import pytest
from starlette.testclient import TestClient

from app.core.config import Settings
from app.core.storage import (
    BaseStorageProvider,
    LocalStorageProvider,
    SpacesStorageProvider,
    StorageResult,
    StorageError,
    StoragePathTraversalError,
    StorageInvalidFileTypeError,
    StorageSizeLimitError,
    StorageFileNotFoundError,
    create_storage_provider,
    get_storage_provider,
    storage_service,
)
from app.main import app
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.api.dependencies import get_db, get_current_user
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.certificate import FelicitationCertificate


SAMPLE_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
SAMPLE_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
FAKE_EXE_BYTES = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"


def make_mock_s3_client():
    """Constructs a mock S3 client simulating DigitalOcean Spaces."""
    client = MagicMock()
    # Default successful put_object
    client.put_object.return_value = {"ETag": '"mock-etag"'}
    # Default successful head_object
    client.head_object.return_value = {"ContentLength": len(SAMPLE_PDF_BYTES)}
    # Default successful get_object
    body_mock = MagicMock()
    body_mock.read.return_value = SAMPLE_PDF_BYTES
    client.get_object.return_value = {"Body": body_mock}
    # Default successful delete_object
    client.delete_object.return_value = {}
    # Default presigned URL
    client.generate_presigned_url.return_value = "https://sgp1.digitaloceanspaces.com/vyasa-n-documents/file.pdf?AWSAccessKeyId=KEY"
    return client


# ============================================================================
# 1. Provider Selection and Configuration Validation Tests
# ============================================================================

def test_default_storage_provider_is_local():
    """Default provider is LocalStorageProvider when unconfigured."""
    provider = create_storage_provider("local")
    assert isinstance(provider, LocalStorageProvider)


def test_spaces_provider_creation_with_valid_config(tmp_path):
    """SpacesStorageProvider instantiates cleanly with explicit valid parameters."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="DO_ACCESS_KEY_SAMPLE",
        secret_access_key="DO_SECRET_KEY_SAMPLE",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )
    assert isinstance(provider, BaseStorageProvider)
    assert isinstance(provider, SpacesStorageProvider)
    assert provider.bucket == "vyasa-n-documents"
    assert provider.region == "sgp1"
    assert provider.endpoint_url == "https://sgp1.digitaloceanspaces.com"


def test_spaces_settings_validation_fails_closed_when_misconfigured():
    """Settings model validator strictly requires SPACES_* variables when STORAGE_PROVIDER is spaces."""
    with pytest.raises(Exception) as exc_info:
        Settings(
            DATABASE_URL="postgresql://localhost/test",
            STORAGE_PROVIDER="spaces",
            SPACES_BUCKET=None,
            SPACES_ACCESS_KEY_ID=None,
            SPACES_SECRET_ACCESS_KEY=None,
        )
    assert "Storage configuration error" in str(exc_info.value)
    assert "SPACES_BUCKET" in str(exc_info.value)


def test_spaces_provider_fails_closed_without_silent_fallback_to_local():
    """SpacesStorageProvider constructor fails closed if credentials are missing and no client injected."""
    with pytest.raises(StorageError) as exc_info:
        SpacesStorageProvider(
            bucket=None,
            access_key_id=None,
            secret_access_key=None,
            s3_client=None,
        )
    assert "Missing required setting(s)" in str(exc_info.value)


def test_unknown_storage_provider_raises_error():
    """Factory rejects unrecognized storage provider names."""
    with pytest.raises(StorageError) as exc_info:
        create_storage_provider("unsupported_cloud")
    assert "Unsupported storage provider" in str(exc_info.value)


# ============================================================================
# 2. Corrected save_file() Contract and Aliases
# ============================================================================

def test_save_file_contract_with_canonical_args_local(tmp_path):
    """LocalStorageProvider accepts canonical keyword arguments."""
    provider = LocalStorageProvider(base_dir=tmp_path)
    result = provider.save_file(
        content=SAMPLE_PDF_BYTES,
        filename="bulletin_vol1.pdf",
        subfolder="sama_veda/bulletins",
        allowed_mime_types={"application/pdf"},
        mime_type="application/pdf",
    )
    assert isinstance(result, StorageResult)
    assert result.original_filename == "bulletin_vol1.pdf"
    assert result.stored_filename == result.filename  # Compatibility alias
    assert result.sha256_checksum == result.checksum_sha256  # Compatibility alias
    assert result.file_size_bytes == len(SAMPLE_PDF_BYTES)
    assert result.mime_type == "application/pdf"


def test_save_file_contract_with_caller_aliases_local(tmp_path):
    """LocalStorageProvider accepts router caller aliases (file, sub_dir, allowed_types)."""
    provider = LocalStorageProvider(base_dir=tmp_path)
    # This was the exact call pattern that previously raised TypeError: unexpected keyword argument 'file'
    result = provider.save_file(
        file=io.BytesIO(SAMPLE_PDF_BYTES),
        filename="certificate.pdf",
        sub_dir="sama_veda/certificates",
        allowed_types=["application/pdf"],
    )
    assert isinstance(result, StorageResult)
    assert result.original_filename == "certificate.pdf"
    assert result.filename == result.stored_filename
    assert result.checksum_sha256 == result.sha256_checksum
    assert result.storage_key.startswith("sama_veda/certificates/")


def test_save_file_contract_with_caller_aliases_spaces(tmp_path):
    """SpacesStorageProvider accepts caller aliases and returns compatibility properties."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    result = provider.save_file(
        file=io.BytesIO(SAMPLE_PDF_BYTES),
        filename="bulletin.pdf",
        sub_dir="sama_veda/bulletins",
        allowed_types=["application/pdf"],
    )

    assert result.filename == result.stored_filename
    assert result.checksum_sha256 == result.sha256_checksum
    assert result.storage_key.startswith("sama_veda/bulletins/")
    mock_s3.put_object.assert_called_once()
    call_kwargs = mock_s3.put_object.call_args.kwargs
    assert call_kwargs["Bucket"] == "vyasa-n-documents"
    assert call_kwargs["Key"] == result.storage_key
    assert call_kwargs["ACL"] == "private"
    assert call_kwargs["ContentType"] == "application/pdf"


# ============================================================================
# 3. Spaces Upload, Download, Deletion, and Existence CRUD Tests
# ============================================================================

def test_spaces_upload_enforces_private_acl_and_metadata(tmp_path):
    """Spaces upload sets private ACL, SHA-256 metadata, and safe server-generated key."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    expected_hash = hashlib.sha256(SAMPLE_PDF_BYTES).hexdigest()
    result = provider.save_file(
        content=SAMPLE_PDF_BYTES,
        filename="Report 2026! @final.pdf",
        subfolder="sama_veda/bulletins",
    )

    assert result.sha256_checksum == expected_hash
    assert result.mime_type == "application/pdf"
    assert "Report_2026_final.pdf" in result.stored_filename

    call_kwargs = mock_s3.put_object.call_args.kwargs
    assert call_kwargs["ACL"] == "private"
    assert call_kwargs["Metadata"]["sha256"] == expected_hash


def test_spaces_get_file_bytes(tmp_path):
    """Spaces get_file_bytes reads payload from Spaces object Body."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    data = provider.get_file_bytes("sama_veda/bulletins/bulletin1.pdf")
    assert data == SAMPLE_PDF_BYTES
    mock_s3.get_object.assert_called_with(
        Bucket="vyasa-n-documents",
        Key="sama_veda/bulletins/bulletin1.pdf",
    )


def test_spaces_get_file_path_caches_locally_for_file_response(tmp_path):
    """Spaces get_file_path downloads to local cache and returns real Path for FileResponse streaming."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    storage_key = "sama_veda/bulletins/cached_sample.pdf"
    local_path = provider.get_file_path(storage_key)

    assert isinstance(local_path, Path)
    assert local_path.is_file()
    assert local_path.read_bytes() == SAMPLE_PDF_BYTES

    # Second call should read from local cache without hitting s3 get_object again
    mock_s3.get_object.reset_mock()
    second_path = provider.get_file_path(storage_key)
    assert second_path == local_path
    mock_s3.get_object.assert_not_called()


def test_spaces_exists_positive_and_negative(tmp_path):
    """Spaces exists returns True on object found and False on 404."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    assert provider.exists("sama_veda/bulletins/existing.pdf") is True

    # Simulate 404
    mock_s3.head_object.side_effect = ClientError(
        {"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject"
    )
    assert provider.exists("sama_veda/bulletins/nonexistent.pdf") is False


def test_spaces_delete_file_positive_and_cleans_cache(tmp_path):
    """Spaces delete_file calls S3 delete_object and purges local cached copy."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    storage_key = "sama_veda/bulletins/to_delete.pdf"
    cached_file = provider.get_file_path(storage_key)
    assert cached_file.is_file()

    deleted = provider.delete_file(storage_key)
    assert deleted is True
    mock_s3.delete_object.assert_called_with(
        Bucket="vyasa-n-documents",
        Key=storage_key,
    )
    assert not cached_file.exists()


def test_spaces_delete_file_returns_false_for_nonexistent(tmp_path):
    """Spaces delete_file returns False if the object does not exist in Spaces."""
    mock_s3 = make_mock_s3_client()
    mock_s3.head_object.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}}, "HeadObject"
    )
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    assert provider.delete_file("sama_veda/bulletins/missing.pdf") is False
    mock_s3.delete_object.assert_not_called()


def test_spaces_generate_presigned_url(tmp_path):
    """Spaces generate_presigned_url delegates to boto3 client with proper parameters."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    url = provider.generate_presigned_url("sama_veda/bulletins/v1.pdf", expires_in_seconds=600)
    assert "https://sgp1.digitaloceanspaces.com" in url
    mock_s3.generate_presigned_url.assert_called_with(
        ClientMethod="get_object",
        Params={"Bucket": "vyasa-n-documents", "Key": "sama_veda/bulletins/v1.pdf"},
        ExpiresIn=600,
    )


# ============================================================================
# 4. Security Enforcement & File Validation Tests
# ============================================================================

@pytest.mark.parametrize(
    "bad_key",
    [
        "../secrets.txt",
        "..\\secrets.txt",
        "sama_veda/../../root.txt",
        "/etc/passwd",
        "C:\\boot.ini",
        "sub\0folder/file.pdf",
    ],
)
def test_spaces_rejects_path_traversal(tmp_path, bad_key):
    """Spaces provider rejects path traversal in subfolder and storage_key."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    with pytest.raises(StoragePathTraversalError):
        provider.save_file(
            content=SAMPLE_PDF_BYTES,
            filename="test.pdf",
            subfolder=bad_key,
        )

    with pytest.raises(StoragePathTraversalError):
        provider.get_file_bytes(bad_key)

    with pytest.raises(StoragePathTraversalError):
        provider.get_file_path(bad_key)


def test_spaces_rejects_empty_file(tmp_path):
    """Spaces provider rejects empty 0-byte upload with StorageError."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    with pytest.raises(StorageError) as exc_info:
        provider.save_file(
            content=b"",
            filename="empty.pdf",
            subfolder="sama_veda/bulletins",
        )
    assert "empty" in str(exc_info.value).lower()


def test_spaces_rejects_oversized_file(tmp_path):
    """Spaces provider rejects uploads exceeding configured byte limit with StorageSizeLimitError."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    with pytest.raises(StorageSizeLimitError):
        provider.save_file(
            content=SAMPLE_PDF_BYTES,
            filename="large.pdf",
            subfolder="sama_veda/bulletins",
            max_size_bytes=10,  # 10 bytes limit
        )


def test_spaces_rejects_disguised_executable(tmp_path):
    """Spaces provider validates magic bytes and rejects executable masquerading as PDF."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    with pytest.raises(StorageInvalidFileTypeError):
        provider.save_file(
            content=FAKE_EXE_BYTES,
            filename="malware.pdf",
            subfolder="sama_veda/bulletins",
            mime_type="application/pdf",
        )


def test_spaces_rejects_disallowed_mime_type(tmp_path):
    """Spaces provider rejects MIME types not in allowed list."""
    mock_s3 = make_mock_s3_client()
    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    with pytest.raises(StorageInvalidFileTypeError):
        provider.save_file(
            content=SAMPLE_PNG_BYTES,
            filename="graphic.png",
            subfolder="sama_veda/bulletins",
            allowed_mime_types={"application/pdf"},
        )


# ============================================================================
# 5. Network and Cloud Provider Failure Tests
# ============================================================================

def test_spaces_put_object_network_error_raises_storage_error(tmp_path):
    """Spaces upload network connection timeout raises safe StorageError without leaking credentials."""
    mock_s3 = make_mock_s3_client()
    mock_s3.put_object.side_effect = EndpointConnectionError(endpoint_url="https://sgp1.digitaloceanspaces.com")

    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="SECRET_ACCESS_KEY_VALUE_1234",
        secret_access_key="SUPER_CONFIDENTIAL_KEY_5678",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    with pytest.raises(StorageError) as exc_info:
        provider.save_file(
            content=SAMPLE_PDF_BYTES,
            filename="bulletin.pdf",
            subfolder="sama_veda/bulletins",
        )
    err_msg = str(exc_info.value)
    assert "SECRET_ACCESS_KEY_VALUE_1234" not in err_msg
    assert "SUPER_CONFIDENTIAL_KEY_5678" not in err_msg


def test_spaces_get_object_404_raises_storage_file_not_found(tmp_path):
    """Spaces get_object 404 raises StorageFileNotFoundError."""
    mock_s3 = make_mock_s3_client()
    mock_s3.get_object.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Object does not exist"}}, "GetObject"
    )

    provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    with pytest.raises(StorageFileNotFoundError):
        provider.get_file_bytes("sama_veda/bulletins/missing.pdf")

    with pytest.raises(StorageFileNotFoundError):
        provider.get_file_path("sama_veda/bulletins/missing.pdf")


# ============================================================================
# 6. Shared Storage Service API Endpoint Integration Tests
# ============================================================================

def make_mock_user(role_name: str, permissions: list[str]) -> User:
    role = Role(name=role_name)
    role.permissions = [Permission(name=p, resource="sama_veda", action=p.split(":")[-1]) for p in permissions]
    user = User(
        id=uuid.uuid4(),
        email=f"{role_name}@csjmu.ac.in",
        first_name="Test",
        last_name=role_name.capitalize(),
        is_active=True,
    )
    user.roles = [role]
    return user


@pytest.fixture
def super_admin_user():
    return make_mock_user(
        "super_admin",
        [
            "sama:read",
            "sama:content:edit",
            "sama:certificate:manage",
        ],
    )


@pytest.fixture
def viewer_user():
    return make_mock_user("viewer", ["sama:read"])


def test_api_bulletin_upload_with_spaces_storage(tmp_path, super_admin_user):
    """POST /api/admin/sama/bulletins/upload persists to Spaces via storage_service proxy."""
    mock_s3 = make_mock_s3_client()
    spaces_provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    # Plug Spaces provider into global proxy
    storage_service.set_provider(spaces_provider)

    try:
        app.dependency_overrides[get_db] = lambda: MagicMock()
        app.dependency_overrides[get_current_user] = lambda: super_admin_user

        client = TestClient(app)
        files = {"file": ("Volume_3_Issue_2.pdf", io.BytesIO(SAMPLE_PDF_BYTES), "application/pdf")}
        resp = client.post("/api/admin/sama/bulletins/upload", files=files)

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["storage_key"].startswith("sama_veda/bulletins/")
        assert "Volume_3_Issue_2.pdf" in data["filename"]
        assert data["file_size_bytes"] == len(SAMPLE_PDF_BYTES)
        assert data["checksum_sha256"] == hashlib.sha256(SAMPLE_PDF_BYTES).hexdigest()

        # Verified S3 put_object called with private ACL
        mock_s3.put_object.assert_called_once()
        call_kwargs = mock_s3.put_object.call_args.kwargs
        assert call_kwargs["Bucket"] == "vyasa-n-documents"
        assert call_kwargs["ACL"] == "private"
    finally:
        storage_service.reset_provider()
        app.dependency_overrides.clear()


def test_api_certificate_upload_with_spaces_storage(tmp_path, super_admin_user):
    """POST /api/admin/sama/certificates/upload persists to Spaces via storage_service proxy."""
    mock_s3 = make_mock_s3_client()
    spaces_provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    storage_service.set_provider(spaces_provider)

    try:
        app.dependency_overrides[get_db] = lambda: MagicMock()
        app.dependency_overrides[get_current_user] = lambda: super_admin_user

        client = TestClient(app)
        files = {"file": ("merit_certificate.pdf", io.BytesIO(SAMPLE_PDF_BYTES), "application/pdf")}
        resp = client.post("/api/admin/sama/certificates/upload", files=files)

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["storage_key"].startswith("sama_veda/certificates/")
        assert "merit_certificate.pdf" in data["filename"]
        mock_s3.put_object.assert_called_once()
    finally:
        storage_service.reset_provider()
        app.dependency_overrides.clear()


def test_api_upload_unauthorized_access(tmp_path, viewer_user):
    """Upload endpoint enforces permission checks and rejects unauthorized users."""
    client = TestClient(app)
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = lambda: viewer_user

    try:
        files = {"file": ("test.pdf", io.BytesIO(SAMPLE_PDF_BYTES), "application/pdf")}
        resp = client.post("/api/admin/sama/bulletins/upload", files=files)
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_api_download_bulletin_streams_from_spaces(tmp_path):
    """GET /api/sama/bulletins/{id}/download resolves Spaces cached file and streams PDF."""
    mock_s3 = make_mock_s3_client()
    spaces_provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    storage_service.set_provider(spaces_provider)

    bulletin_id = uuid.uuid4()
    mock_bulletin = ResearchBulletin(
        id=bulletin_id,
        volume_number="3",
        issue_number="1",
        title="Institutional Research Bulletin",
        file_path="sama_veda/bulletins/remote_bulletin.pdf",
        status="published",
        is_active=True,
    )

    mock_db = MagicMock()
    mock_db.get.return_value = mock_bulletin

    try:
        app.dependency_overrides[get_db] = lambda: mock_db
        client = TestClient(app)

        resp = client.get(f"/api/modules/sama-veda/bulletins/{bulletin_id}/download")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content == SAMPLE_PDF_BYTES
    finally:
        storage_service.reset_provider()
        app.dependency_overrides.clear()


def test_api_admin_stream_certificate_from_spaces(tmp_path, super_admin_user):
    """GET /api/admin/sama/certificates/{id}/file streams certificate PDF from Spaces to authorized admin."""
    mock_s3 = make_mock_s3_client()
    spaces_provider = SpacesStorageProvider(
        bucket="vyasa-n-documents",
        region="sgp1",
        endpoint_url="https://sgp1.digitaloceanspaces.com",
        access_key_id="KEY",
        secret_access_key="SECRET",
        s3_client=mock_s3,
        cache_dir=tmp_path,
    )

    storage_service.set_provider(spaces_provider)

    cert_id = uuid.uuid4()
    mock_cert = FelicitationCertificate(
        id=cert_id,
        certificate_number="CSJMU/2026/SAMA/001",
        bulletin_id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        file_storage_path="sama_veda/certificates/remote_cert.pdf",
        is_revoked=False,
        download_count=0,
    )

    mock_db = MagicMock()

    try:
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: super_admin_user

        with patch("app.admin.sama_admin_router.sama_cms_service.get_certificate_by_id", return_value=mock_cert):
            client = TestClient(app)
            resp = client.get(f"/api/admin/sama/certificates/{cert_id}/download")
            assert resp.status_code == 200
            assert resp.headers["content-type"] == "application/pdf"
            assert resp.content == SAMPLE_PDF_BYTES
            assert mock_cert.download_count == 1
    finally:
        storage_service.reset_provider()
        app.dependency_overrides.clear()
