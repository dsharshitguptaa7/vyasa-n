import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.dependencies import get_db, get_current_user
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateTemplate,
    CertificateSignatory,
)

@pytest.fixture(scope="module")
def sqlite_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session(sqlite_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sqlite_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

@pytest.fixture
def test_admin_user(db_session):
    admin_role = db_session.query(Role).filter_by(name="super_admin").first()
    if not admin_role:
        admin_role = Role(name="super_admin", description="Super Admin")
        db_session.add(admin_role)
        db_session.flush()

    user = db_session.query(User).filter_by(email="test_sadmin@csjmu.ac.in").first()
    if not user:
        user = User(
            email="test_sadmin@csjmu.ac.in",
            password_hash="mock",
            first_name="Test",
            last_name="Super Admin",
            is_active=True,
        )
        user.roles.append(admin_role)
        db_session.add(user)
        db_session.commit()
    return user

@pytest.fixture
def sample_data(db_session, test_admin_user):
    # Template
    tpl = db_session.query(CertificateTemplate).filter_by(code="DEFAULT_CSJMU_A4").first()
    if not tpl:
        tpl = CertificateTemplate(
            code="DEFAULT_CSJMU_A4",
            name="CSJMU Default Template",
            orientation="LANDSCAPE",
            is_active=True,
            is_default=True,
            config={},
        )
        db_session.add(tpl)

    # Signatory
    sig = db_session.query(CertificateSignatory).filter_by(authority_type="DEAN_RD").first()
    if not sig:
        sig = CertificateSignatory(
            authority_type="DEAN_RD",
            signatory_name="Prof. (Dr.) Rajesh Kumar",
            designation="Dean – Research & Development",
            is_active=True,
        )
        db_session.add(sig)

    # Certificate
    cert = db_session.query(FelicitationCertificate).filter_by(certificate_number="CSJMU/SAMIKSHA/2026/000001").first()
    if not cert:
        cert_id = uuid.uuid4()
        cert = FelicitationCertificate(
            id=cert_id,
            certificate_number="CSJMU/SAMIKSHA/2026/000001",
            status="ISSUED",
            title="Certificate of Appreciation & Research Excellence",
            research_title="Fungi to the rescue: heavy metal mycoremediation",
            verification_token="token-full-test-12345",
            is_revoked=False,
            template=tpl,
        )
        db_session.add(cert)
        db_session.flush()

        author = CertificateAuthor(
            certificate_id=cert_id,
            author_name_snapshot="Dr. Exemplary Scholar",
            scopus_id_snapshot="57211223344",
            department_snapshot="Department of Biotechnology",
            author_role="First Author",
            author_order=1,
        )
        db_session.add(author)

    db_session.commit()
    return cert

@pytest.fixture
def client(db_session, test_admin_user):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_current_user():
        return test_admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()

def test_01_dashboard_stats(client, sample_data):
    """Workflow 2: Load dashboard statistics."""
    resp = client.get("/api/admin/sama/certificates/stats")
    assert resp.status_code == 200
    assert "application/json" in resp.headers.get("content-type", "")
    data = resp.json()
    assert data["success"] is True
    stats = data["data"]
    assert stats["total_certificates"] >= 1
    assert "issued_certificates" in stats
    assert "revoked_certificates" in stats
    assert "pending_approvals" in stats
    assert "draft_certificates" in stats

def test_02_load_issued_ledger(client, sample_data):
    """Workflow 3: Load Issued Ledger."""
    resp = client.get("/api/admin/sama/certificates?skip=0&limit=12")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["total"] >= 1
    assert len(data["data"]["items"]) >= 1

def test_03_load_approval_queue(client, sample_data):
    """Workflow 4: Load Approval Queue."""
    resp = client.get("/api/admin/sama/certificates?status=PENDING_DEAN_APPROVAL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "items" in data["data"]

def test_04_load_templates(client, sample_data):
    """Workflow 5: Load Templates."""
    resp = client.get("/api/admin/sama/templates?limit=50")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["total"] >= 1

def test_05_load_signing_authorities(client, sample_data):
    """Workflow 6: Load Signing Authorities."""
    resp = client.get("/api/admin/sama/signatories?limit=50")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["total"] >= 1

def test_06_search_by_certificate_number(client, sample_data):
    """Workflow 7: Search certificates by certificate number."""
    resp = client.get("/api/admin/sama/certificates?search=CSJMU/SAMIKSHA")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["total"] >= 1
    assert any("CSJMU/SAMIKSHA" in c["certificate_number"] for c in data["data"]["items"])

def test_07_search_by_author_name(client, sample_data):
    """Workflow 8: Search certificates by author name."""
    resp = client.get("/api/admin/sama/certificates?search=Scholar")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["total"] >= 1

def test_08_search_by_scopus_id(client, sample_data):
    """Workflow 9: Search certificates by Scopus ID."""
    resp = client.get("/api/admin/sama/certificates?search=57211223344")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["total"] >= 1

def test_09_search_by_publication_title(client, sample_data):
    """Workflow 10: Search certificates by publication title."""
    resp = client.get("/api/admin/sama/certificates?search=mycoremediation")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"]["total"] >= 1

def test_10_open_certificate_details(client, sample_data):
    """Workflow 11: Open existing certificate details."""
    resp = client.get(f"/api/admin/sama/certificates/{sample_data.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    cert = data["data"]
    assert cert["id"] == str(sample_data.id)
    assert cert["certificate_number"] == sample_data.certificate_number

def test_11_generate_certificate_preview(client, sample_data):
    """Workflow 12: Generate certificate preview."""
    payload = {
        "title": "Certificate of Appreciation & Research Excellence",
        "presentation_statement": "This certificate is proudly conferred upon",
        "research_contribution_statement": "in recognition of scholarly research publication in:",
        "research_title": "Automated End-to-End Verification Test Paper",
        "congratulatory_statement": "The university acknowledges meritorious contribution.",
        "authors": [
            {
                "author_name_snapshot": "Dr. Test Author",
                "academic_title_snapshot": "Dr.",
                "department_snapshot": "Department of Computer Science",
                "author_role": "First Author",
                "author_order": 1,
            }
        ],
    }
    resp = client.post("/api/admin/sama/certificates/preview", json=payload)
    assert resp.status_code == 200
    assert resp.headers.get("content-type") == "application/pdf"
    assert resp.content.startswith(b"%PDF")

def test_12_public_qr_verification_token(client, sample_data):
    """Workflow 13: Verify existing QR verification by token."""
    resp = client.get(f"/api/modules/sama-veda/certificates/verify/{sample_data.verification_token}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["certificate_number"] == sample_data.certificate_number

def test_13_public_verification_cert_number(client, sample_data):
    """Workflow 14: Verify existing certificate-number verification."""
    resp = client.get(f"/api/modules/sama-veda/certificates/verify/{sample_data.certificate_number}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["certificate_number"] == sample_data.certificate_number

def test_14_not_found_404(client):
    """Test: API returning 404 for nonexistent certificate."""
    non_existent_id = uuid.uuid4()
    resp = client.get(f"/api/admin/sama/certificates/{non_existent_id}")
    assert resp.status_code == 404
    assert "application/json" in resp.headers.get("content-type", "")

def test_15_valid_empty_search_json(client):
    """Test: API returning valid empty JSON for non-matching search."""
    resp = client.get("/api/admin/sama/certificates?search=NONEXISTENT_QUERY_XYZZY_9999")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["total"] == 0
    assert data["data"]["items"] == []
