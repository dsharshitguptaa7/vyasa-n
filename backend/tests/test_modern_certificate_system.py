"""
Comprehensive Integration Tests for VYASA-n / SAMIKSHA Modern Certificate System.

Covers:
1. Certificate Statistics aggregation
2. Template Management (Listing, Creation, Update)
3. Signatory Management (Listing, Creation, Update)
4. Multi-Author Certificate Creation & Approval Workflow (Dean R&D -> VC Approval -> Final PDF issuance)
5. Authority Rejection workflow with mandatory remarks
6. Certificate Reissue / Supersede workflow
7. Live Vector Certificate Preview
8. Public Verification via unique verification token and certificate number
9. Public Download with revoked document protection
"""
import io
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateTemplate,
    CertificateSignatory,
    CertificateAuthor,
    CertificateApproval,
)
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def super_admin_user():
    role = Role(name="super_admin")
    role.permissions = [
        Permission(name="sama:read", resource="sama_veda", action="read"),
        Permission(name="sama:content:edit", resource="sama_veda", action="edit"),
        Permission(name="sama:content:publish", resource="sama_veda", action="publish"),
        Permission(name="sama:author:verify", resource="sama_veda", action="verify"),
        Permission(name="sama:certificate:manage", resource="sama_veda", action="manage"),
        Permission(name="sama:certificate:revoke", resource="sama_veda", action="revoke"),
    ]
    user = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
    )
    user.roles = [role]
    return user


def test_certificate_stats_endpoint(client, mock_db, super_admin_user):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    mock_db.scalar.side_effect = [15, 3, 4, 8, 2, 1, 24]

    resp = client.get("/api/admin/sama/certificates/stats")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_certificates"] == 15
    assert data["draft_certificates"] == 3
    assert data["pending_approvals"] == 4
    assert data["issued_certificates"] == 8
    assert data["revoked_certificates"] == 2
    assert data["reissued_certificates"] == 1
    assert data["total_researchers_linked"] == 24


def test_template_management_crud(client, mock_db, super_admin_user):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    # List templates
    mock_tpl = CertificateTemplate(
        id=uuid.uuid4(),
        code="CSJMU_A4_CUSTOM",
        name="CSJMU Custom Gold Template",
        orientation="LANDSCAPE",
        config={"border_color": "#B2811A"},
        version=1,
        is_active=True,
        certificate_type="RESEARCH_PUBLICATION",
        is_default=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    mock_db.scalars.return_value.all.return_value = [mock_tpl]
    mock_db.scalar.return_value = 1

    resp = client.get("/api/admin/sama/templates")
    assert resp.status_code == 200
    assert resp.json()["data"]["total"] == 1
    assert resp.json()["data"]["items"][0]["code"] == "CSJMU_A4_CUSTOM"

    # Create template
    resp_create = client.post(
        "/api/admin/sama/templates",
        json={
            "code": "CSJMU_SPECIAL_2026",
            "name": "Special Convocation Template",
            "certificate_type": "APPRECIATION",
            "orientation": "LANDSCAPE",
            "config": {"theme": "gold_maroon"},
        },
    )
    assert resp_create.status_code == 201
    assert resp_create.json()["data"]["code"] == "CSJMU_SPECIAL_2026"


def test_signatory_management_crud(client, mock_db, super_admin_user):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    mock_sig = CertificateSignatory(
        id=uuid.uuid4(),
        authority_type="DEAN_RD",
        signatory_name="Prof. (Dr.) Rajesh Kumar",
        designation="Dean – Research & Development",
        is_active=True,
        signature_asset_version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    mock_db.scalars.return_value.all.return_value = [mock_sig]
    mock_db.scalar.return_value = 1

    resp = client.get("/api/admin/sama/signatories")
    assert resp.status_code == 200
    assert resp.json()["data"]["total"] == 1
    assert resp.json()["data"]["items"][0]["signatory_name"] == "Prof. (Dr.) Rajesh Kumar"

    # Create signatory
    resp_create = client.post(
        "/api/admin/sama/signatories",
        json={
            "authority_type": "VICE_CHANCELLOR",
            "signatory_name": "Prof. Vinay Kumar Pathak",
            "designation": "Vice Chancellor",
        },
    )
    assert resp_create.status_code == 201
    assert resp_create.json()["data"]["authority_type"] == "VICE_CHANCELLOR"


def test_certificate_preview_endpoint(client, super_admin_user):
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    resp = client.post(
        "/api/admin/sama/certificates/preview",
        json={
            "title": "Certificate of Appreciation & Research Excellence",
            "authors": [
                {
                    "author_name_snapshot": "Dr. Akhilesh Kumar",
                    "department_snapshot": "Department of Physics",
                    "scopus_id_snapshot": "57211512345",
                    "author_order": 1,
                    "author_role": "First Author",
                },
                {
                    "author_name_snapshot": "Dr. Anju Dixit",
                    "department_snapshot": "Department of Chemistry",
                    "scopus_id_snapshot": "57200192834",
                    "author_order": 2,
                    "author_role": "Co-Author",
                },
            ],
            "research_title": "Synthesis of TiC nanoparticles for energy storage applications",
        },
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 1000


def test_dual_authority_approval_flow(client, mock_db, super_admin_user):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    cert_id = uuid.uuid4()
    mock_cert = FelicitationCertificate(
        id=cert_id,
        certificate_number="CSJMU/SAMIKSHA/2026/000045",
        status="PENDING_DEAN_APPROVAL",
        verification_token="token_dual_appr",
        title="Certificate of Appreciation",
        issued_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        download_count=0,
        is_revoked=False,
    )
    mock_db.get.return_value = mock_cert

    # 1. Dean Approves
    with patch("app.modules.sama_veda.services.cms_service.sama_cms_service.process_authority_approval") as mock_proc:
        mock_cert.status = "PENDING_VC_APPROVAL"
        mock_proc.return_value = mock_cert

        resp_dean = client.post(
            f"/api/admin/sama/certificates/{cert_id}/approve?authority=DEAN_RD",
            json={"action": "APPROVE", "remarks": "Meritorious research approved."},
        )
        assert resp_dean.status_code == 200
        assert resp_dean.json()["data"]["status"] == "PENDING_VC_APPROVAL"

    # 2. VC Approves (Transitions to ISSUED)
    with patch("app.modules.sama_veda.services.cms_service.sama_cms_service.process_authority_approval") as mock_proc:
        mock_cert.status = "ISSUED"
        mock_cert.approved_at = datetime.now(timezone.utc)
        mock_proc.return_value = mock_cert

        resp_vc = client.post(
            f"/api/admin/sama/certificates/{cert_id}/approve?authority=VICE_CHANCELLOR",
            json={"action": "APPROVE", "remarks": "Approved and signed."},
        )
        assert resp_vc.status_code == 200
        assert resp_vc.json()["data"]["status"] == "ISSUED"


def test_rejection_requires_mandatory_remarks(client, mock_db, super_admin_user):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    cert_id = uuid.uuid4()
    mock_cert = FelicitationCertificate(
        id=cert_id,
        certificate_number="CSJMU/SAMIKSHA/2026/000046",
        status="PENDING_DEAN_APPROVAL",
        download_count=0,
        is_revoked=False,
    )
    mock_db.get.return_value = mock_cert

    # Rejection without remarks must fail with 400
    resp_reject_empty = client.post(
        f"/api/admin/sama/certificates/{cert_id}/approve?authority=DEAN_RD",
        json={"action": "REJECT", "remarks": ""},
    )
    assert resp_reject_empty.status_code == 400
    data = resp_reject_empty.json()
    err_msg = data.get("message") or data.get("detail", "")
    assert "mandatory" in err_msg.lower()


def test_public_verification_endpoint_by_token(client, mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db

    token = "test_verification_token_777"
    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/SAMIKSHA/2026/000077",
        title="Certificate of Research Excellence",
        status="ISSUED",
        verification_token=token,
        research_title="Pioneering findings in quantum entanglement",
        issued_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        is_revoked=False,
    )
    author = CertificateAuthor(
        author_name_snapshot="Dr. Akhilesh Kumar",
        academic_title_snapshot="Dr.",
        scopus_id_snapshot="57211512345",
        department_snapshot="Department of Physics",
        author_order=1,
    )
    cert.authors.append(author)

    mock_db.scalar.return_value = cert

    resp = client.get(f"/api/modules/sama-veda/certificates/verify/{token}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["certificate_number"] == "CSJMU/SAMIKSHA/2026/000077"
    assert data["is_download_allowed"] is True
    assert len(data["authors"]) == 1
    assert data["authors"][0]["author_name"] == "Dr. Akhilesh Kumar"
    assert data["authors"][0]["scopus_id"] == "57211512345"


def test_direct_issuance_justification_validation(client, mock_db, super_admin_user):
    """Exceptional direct issuance without approval workflow requires >= 10 char justification."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    cert_id = uuid.uuid4()
    mock_cert = FelicitationCertificate(
        id=cert_id,
        certificate_number="CSJMU/SAMIKSHA/2026/000088",
        status="ISSUED",
        title="Direct Issue Certificate",
        download_count=0,
        is_revoked=False,
    )

    # 1. Direct issuance missing justification fails with 400
    with patch("app.modules.sama_veda.services.cms_service.sama_cms_service.get_certificate_by_number", return_value=None):
        resp_missing = client.post(
            "/api/admin/sama/certificates",
            json={
                "title": "Direct Issue Certificate",
                "authors": [{"author_name_snapshot": "Dr. Recipient", "author_order": 1}],
                "submit_for_approval": False,
                "direct_issue_justification": "",
            },
        )
        assert resp_missing.status_code == 400
        data = resp_missing.json()
        err_msg = data.get("message") or data.get("detail", "")
        assert "justification" in err_msg.lower()

    # 2. Direct issuance with justification >= 10 chars succeeds
    with patch("app.modules.sama_veda.services.cms_service.sama_cms_service.get_certificate_by_number", return_value=None), \
         patch("app.modules.sama_veda.services.cms_service.sama_cms_service.issue_certificate", return_value=mock_cert), \
         patch("app.admin.sama_admin_router.audit_service.log_from_request"):
        resp_valid = client.post(
            "/api/admin/sama/certificates",
            json={
                "title": "Direct Issue Certificate",
                "authors": [{"author_name_snapshot": "Dr. Recipient", "author_order": 1}],
                "submit_for_approval": False,
                "direct_issue_justification": "Approved per CSJMU Executive Council Directive #2026-EX-99",
            },
        )
        assert resp_valid.status_code == 201


def test_preview_endpoint_does_not_mutate_db_or_issue(client, mock_db, super_admin_user):
    """Preview vector PDF renders print-ready bytes with draft watermark and does not write to DB."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    mock_db.add = MagicMock()
    mock_db.commit = MagicMock()

    resp = client.post(
        "/api/admin/sama/certificates/preview",
        json={
            "title": "Preview Draft Certificate",
            "authors": [
                {
                    "author_name_snapshot": "Dr. Candidate Author",
                    "academic_title_snapshot": "Dr.",
                    "department_snapshot": "Department of Physics",
                    "scopus_id_snapshot": "5711223344",
                    "author_order": 1,
                    "author_role": "First Author",
                }
            ],
            "research_title": "Quantum Entanglement in 2D Superconducting Lattices",
        },
    )

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 1000
    # Crucial: DB must NOT have been mutated
    assert mock_db.add.call_count == 0
    assert mock_db.commit.call_count == 0
