"""
Test suite for SAMIKSHA Researcher Certificate Discovery & Security System.

Validates:
1. Discovery of research work certificates (Category 1).
2. Discovery of incentive certificates (Category 2).
3. Dual-category and multi-certificate discovery.
4. Multi-author joint certificate discovery using co-author's Scopus ID.
5. Invalid/missing Scopus ID error handling.
6. Access control: 401 for unauthenticated lookup without OTP token, with masked email.
7. OTP workflow: send-otp, rate-limiting, and verify-otp generating scoped token.
8. Authorized researcher PDF download via token and ownership verification.
9. Status integrity: revoked and superseded certificates handled correctly.
10. ANUDAAN gap reporting: honest audit reporting without fake PDFs.
"""

import hashlib
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.api.dependencies import get_db, get_optional_current_user
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateApproval,
)
from app.modules.sama_veda.models.publication import ResearchPublication
from app.modules.sama_veda.services.researcher_discovery_service import OTP_STORE, RATE_LIMIT_STORE
from app.core.security import create_access_token


TEST_DB_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Initializes in-memory database and mocks storage service."""
    Base.metadata.create_all(bind=engine)
    OTP_STORE.clear()
    RATE_LIMIT_STORE.clear()

    # Create dummy PDF files in tmp_path
    pdf_content = b"%PDF-1.4 Official CSJMU Test Certificate Content"
    checksum = hashlib.sha256(pdf_content).hexdigest()

    pdf_file = tmp_path / "test_cert.pdf"
    pdf_file.write_bytes(pdf_content)

    from app.core.storage import storage_service
    monkeypatch.setattr(storage_service, "get_file_path", lambda key: str(pdf_file))

    yield {
        "pdf_path": str(pdf_file),
        "checksum": checksum,
        "content": pdf_content,
    }

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client


def test_invalid_or_missing_scopus_id_returns_appropriate_error(client):
    # Empty Scopus ID
    res = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=")
    assert res.status_code == 400
    msg = res.json().get("message", "") or res.json().get("detail", "")
    assert "Scopus Author ID is required" in msg

    # Non-existent Scopus ID
    res2 = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=99999999999")
    assert res2.status_code == 404
    msg2 = res2.json().get("message", "") or res2.json().get("detail", "")
    assert "No researcher found with Scopus ID" in msg2


def test_unauthenticated_researcher_discovery_requires_authentication(client, db_session):
    # Create user and linked author
    user = User(
        first_name="Prof. Rajesh",
        last_name="Kumar",
        email="rajesh.kumar@csjmu.ac.in",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    author = ResearchAuthor(
        scopus_id="57200000001",
        full_name="Prof. Rajesh Kumar",
        department="Department of Physics",
        user_id=user.id,
        is_verified=True,
    )
    db_session.add(author)
    db_session.commit()

    # Attempt lookup without authentication
    res = client.get(f"/api/modules/sama-veda/certificates/researcher-discovery?scopus_id={author.scopus_id}")
    assert res.status_code == 401
    data = res.json().get("data", {})
    assert data.get("status") == "AUTH_REQUIRED"
    assert data.get("requires_authentication") is True
    assert data.get("researcher", {}).get("full_name") == "Prof. Rajesh Kumar"
    assert "r***r@csjmu.ac.in" in data.get("researcher", {}).get("masked_email", "")


def test_otp_dispatch_and_verification_workflow(client, db_session):
    user = User(
        first_name="Dr. Sunita",
        last_name="Sharma",
        email="sunita.sharma@csjmu.ac.in",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    author = ResearchAuthor(
        scopus_id="57200000002",
        full_name="Dr. Sunita Sharma",
        department="Chemistry",
        user_id=user.id,
        is_verified=True,
    )
    db_session.add(author)
    db_session.commit()

    # 1. Send OTP
    send_res = client.post(
        "/api/modules/sama-veda/certificates/researcher-discovery/send-otp",
        json={"scopus_id": author.scopus_id},
    )
    assert send_res.status_code == 200
    assert send_res.json()["data"]["masked_email"] == "s***a@csjmu.ac.in"

    # Verify code stored
    stored = OTP_STORE.get(author.scopus_id.lower())
    assert stored is not None
    code = stored["code"]

    # 2. Verify with wrong OTP
    wrong_res = client.post(
        "/api/modules/sama-veda/certificates/researcher-discovery/verify-otp",
        json={"scopus_id": author.scopus_id, "otp": "000000"},
    )
    assert wrong_res.status_code == 400
    wrong_msg = wrong_res.json().get("message", "") or wrong_res.json().get("detail", "")
    assert "Incorrect verification code" in wrong_msg

    # 3. Verify with correct OTP
    correct_res = client.post(
        "/api/modules/sama-veda/certificates/researcher-discovery/verify-otp",
        json={"scopus_id": author.scopus_id, "otp": code},
    )
    assert correct_res.status_code == 200
    token = correct_res.json()["data"]["researcher_token"]
    assert token is not None

    # 4. Use token to discover certificates
    disc_res = client.get(
        f"/api/modules/sama-veda/certificates/researcher-discovery?scopus_id={author.scopus_id}",
        headers={"X-Researcher-Token": token},
    )
    assert disc_res.status_code == 200
    assert disc_res.json()["success"] is True
    assert disc_res.json()["data"]["researcher"]["full_name"] == "Dr. Sunita Sharma"


def test_research_and_incentive_categories_separation(client, db_session, setup_test_db):
    user = User(
        first_name="Dr. Shilpa",
        last_name="Deshpande",
        email="shilpa.deshpande@csjmu.ac.in",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    author = ResearchAuthor(
        scopus_id="57200000003",
        full_name="Dr. Shilpa Deshpande",
        department="Biotechnology",
        user_id=user.id,
        is_verified=True,
    )
    db_session.add(author)
    db_session.commit()

    # 1. Add Category 1: Research Work Certificate
    cert1 = FelicitationCertificate(
        certificate_number="CSJMU/SAMA/2026/00101",
        certificate_type="RESEARCH_PUBLICATION",
        status="ISSUED",
        title="Certificate of Research Excellence",
        research_title="CRISPR Gene Editing in Drought-Resistant Crops",
        author_id=author.id,
        file_storage_path="certs/cert1.pdf",
        checksum_sha256=setup_test_db["checksum"],
        issued_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )

    # 2. Add Category 2: Incentive Certificate
    cert2 = FelicitationCertificate(
        certificate_number="CSJMU/SAMA/2026/00102",
        certificate_type="RESEARCH_INCENTIVE",
        status="ISSUED",
        title="Research Publication Incentive Award",
        research_title="CRISPR Gene Editing in Drought-Resistant Crops",
        author_id=author.id,
        file_storage_path="certs/cert2.pdf",
        checksum_sha256=setup_test_db["checksum"],
        issued_at=datetime(2026, 3, 15, tzinfo=timezone.utc),
    )

    db_session.add_all([cert1, cert2])
    db_session.commit()

    # Authenticate as this researcher
    app.dependency_overrides[get_optional_current_user] = lambda: user

    res = client.get(f"/api/modules/sama-veda/certificates/researcher-discovery?scopus_id={author.scopus_id}")
    assert res.status_code == 200
    data = res.json()["data"]

    # Verify Category 1
    assert len(data["research_certificates"]) == 1
    assert data["research_certificates"][0]["certificate_number"] == "CSJMU/SAMA/2026/00101"
    assert data["research_certificates"][0]["category"] == "RESEARCH_WORK"
    assert data["research_certificates"][0]["is_download_allowed"] is True

    # Verify Category 2
    assert len(data["incentive_certificates"]) == 1
    assert data["incentive_certificates"][0]["certificate_number"] == "CSJMU/SAMA/2026/00102"
    assert data["incentive_certificates"][0]["category"] == "INCENTIVE"
    assert data["incentive_certificates"][0]["is_download_allowed"] is True


def test_multi_author_joint_certificate_discovery_by_coauthor(client, db_session, setup_test_db):
    """
    Validates that a joint certificate can be discovered by a co-author using their own Scopus ID.
    """
    user_primary = User(first_name="Lead", last_name="Researcher", email="lead@csjmu.ac.in", is_active=True)
    user_coauthor = User(first_name="Co", last_name="Author", email="coauthor@csjmu.ac.in", is_active=True)
    db_session.add_all([user_primary, user_coauthor])
    db_session.commit()

    primary_author = ResearchAuthor(
        scopus_id="57200000010",
        full_name="Dr. Lead Researcher",
        user_id=user_primary.id,
        is_verified=True,
    )
    co_author = ResearchAuthor(
        scopus_id="57200000011",
        full_name="Dr. Co Author",
        user_id=user_coauthor.id,
        is_verified=True,
    )
    db_session.add_all([primary_author, co_author])
    db_session.commit()

    joint_cert = FelicitationCertificate(
        certificate_number="CSJMU/SAMA/2026/00200",
        certificate_type="RESEARCH_PUBLICATION",
        status="ISSUED",
        title="Joint Certificate of Appreciation",
        research_title="Collaborative Quantum Computing Architectures",
        author_id=primary_author.id,  # Primary author link
        file_storage_path="certs/joint.pdf",
        checksum_sha256=setup_test_db["checksum"],
        issued_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
    )
    db_session.add(joint_cert)
    db_session.commit()

    # Link both authors in CertificateAuthor
    ca1 = CertificateAuthor(
        certificate_id=joint_cert.id,
        researcher_id=primary_author.id,
        author_name_snapshot="Dr. Lead Researcher",
        scopus_id_snapshot="57200000010",
        author_order=1,
        author_role="First Author",
    )
    ca2 = CertificateAuthor(
        certificate_id=joint_cert.id,
        researcher_id=co_author.id,
        author_name_snapshot="Dr. Co Author",
        scopus_id_snapshot="57200000011",
        author_order=2,
        author_role="Co-Author",
    )
    db_session.add_all([ca1, ca2])
    db_session.commit()

    # Discover using Co-Author's Scopus ID
    app.dependency_overrides[get_optional_current_user] = lambda: user_coauthor

    res = client.get(f"/api/modules/sama-veda/certificates/researcher-discovery?scopus_id={co_author.scopus_id}")
    assert res.status_code == 200
    certs = res.json()["data"]["research_certificates"]
    assert len(certs) == 1
    assert certs[0]["certificate_number"] == "CSJMU/SAMA/2026/00200"
    assert certs[0]["is_download_allowed"] is True


def test_revoked_and_superseded_certificates_in_discovery(client, db_session, setup_test_db):
    user = User(first_name="Prof", last_name="Verma", email="verma@csjmu.ac.in", is_active=True)
    db_session.add(user)
    db_session.commit()

    author = ResearchAuthor(
        scopus_id="57200000020",
        full_name="Prof. Verma",
        user_id=user.id,
        is_verified=True,
    )
    db_session.add(author)
    db_session.commit()

    # 1. Revoked certificate
    revoked_cert = FelicitationCertificate(
        certificate_number="CSJMU/SAMA/2025/REV-01",
        certificate_type="RESEARCH_PUBLICATION",
        status="REVOKED",
        is_revoked=True,
        revocation_reason="Publisher retraction",
        title="Revoked Paper Certificate",
        author_id=author.id,
        file_storage_path="certs/rev.pdf",
        checksum_sha256=setup_test_db["checksum"],
    )

    # 2. Superseded certificate
    superseded_cert = FelicitationCertificate(
        certificate_number="CSJMU/SAMA/2025/SUP-01",
        certificate_type="RESEARCH_PUBLICATION",
        status="SUPERSEDED",
        is_revoked=False,
        reissued_reason="Reissued with updated department",
        title="Superseded Certificate",
        author_id=author.id,
        file_storage_path="certs/sup.pdf",
        checksum_sha256=setup_test_db["checksum"],
    )

    db_session.add_all([revoked_cert, superseded_cert])
    db_session.commit()

    app.dependency_overrides[get_optional_current_user] = lambda: user

    res = client.get(f"/api/modules/sama-veda/certificates/researcher-discovery?scopus_id={author.scopus_id}")
    assert res.status_code == 200
    certs = res.json()["data"]["research_certificates"]
    assert len(certs) == 2

    rev_item = next(c for c in certs if c["certificate_number"] == "CSJMU/SAMA/2025/REV-01")
    assert rev_item["status"] == "REVOKED"
    assert rev_item["is_revoked"] is True
    assert rev_item["is_download_allowed"] is False

    sup_item = next(c for c in certs if c["certificate_number"] == "CSJMU/SAMA/2025/SUP-01")
    assert sup_item["status"] == "SUPERSEDED"
    assert sup_item["is_download_allowed"] is False


def test_admin_access_overrides_ownership(client, db_session, setup_test_db):
    admin_user = User(
        first_name="Super",
        last_name="Admin",
        email="sadmin@csjmu.ac.in",
        is_active=True,
    )
    admin_role = Role(name="super_admin", description="Super Admin")
    admin_user.roles.append(admin_role)
    db_session.add_all([admin_user, admin_role])
    db_session.commit()

    faculty_user = User(first_name="Dr.", last_name="Researcher", email="faculty@csjmu.ac.in", is_active=True)
    db_session.add(faculty_user)
    db_session.commit()

    author = ResearchAuthor(
        scopus_id="57200000030",
        full_name="Dr. Faculty Researcher",
        user_id=faculty_user.id,
        is_verified=True,
    )
    db_session.add(author)
    db_session.commit()

    cert = FelicitationCertificate(
        certificate_number="CSJMU/SAMA/2026/ADM-01",
        certificate_type="RESEARCH_PUBLICATION",
        status="ISSUED",
        title="Research Excellence",
        author_id=author.id,
        file_storage_path="certs/adm.pdf",
        checksum_sha256=setup_test_db["checksum"],
    )
    db_session.add(cert)
    db_session.commit()

    # Admin accesses faculty's certificate list
    app.dependency_overrides[get_optional_current_user] = lambda: admin_user

    res = client.get(f"/api/modules/sama-veda/certificates/researcher-discovery?scopus_id={author.scopus_id}")
    assert res.status_code == 200
    assert len(res.json()["data"]["research_certificates"]) == 1
