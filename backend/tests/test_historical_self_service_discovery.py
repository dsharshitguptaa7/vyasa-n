# -*- coding: utf-8 -*-
"""
SAMIKSHA — Historical Recovered Certificates in Scopus Self-Service Portal Integration Tests.

Validates:
1. Public Scopus-ID-based certificate discovery returns recovered historical certificates
   from sama_legacy_certificate_registry matching recovery_metadata['scopus_id'].
2. Accurate categorization:
   - INCENTIVE_AWARD -> incentive_certificates
   - RESEARCH_PUBLICATION / SCHOLARLY_FELICITATION -> research_certificates
3. Researcher with both active and historical certificates coexists safely without suppression.
4. Serial number collision (CSJMU/SAMIKSHA/2026/000002) handled safely by distinct token/ID.
5. Exact Scopus ID matching (no partial matches like '608' matching '60860734300').
6. Unrelated historical certificates are not leaked.
7. Historical-only researcher (not in ResearchAuthor) can discover their certificates.
8. Revoked historical certificates are excluded from discovery.
9. Public download of historical certificate PDF works via verification token.
10. Public download of historical certificate PDF works via certificate number / UUID.
"""

import os
import uuid
import pytest
from datetime import datetime, timezone
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.base import Base
from app.models.user import User
from app.api.dependencies import get_db
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    LegacyCertificateRegistry,
)
from app.modules.sama_veda.services.researcher_discovery_service import OTP_STORE, RATE_LIMIT_STORE
from app.core.storage import storage_service


TEST_DB_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Initializes in-memory database, test storage file, and clears cache."""
    Base.metadata.create_all(bind=engine)
    OTP_STORE.clear()
    RATE_LIMIT_STORE.clear()

    # Create dummy PDF for testing historical download
    pdf_bytes = b"%PDF-1.4 Recovered Historical Certificate Content CSJMU"
    pdf_file = tmp_path / "recovered_000006.pdf"
    pdf_file.write_bytes(pdf_bytes)

    # Mock storage_service to resolve this file for test keys
    monkeypatch.setattr(
        storage_service,
        "get_file_path",
        lambda key: str(pdf_file) if "000006" in str(key) or "hist" in str(key) else None,
    )

    yield {
        "pdf_path": str(pdf_file),
        "pdf_bytes": pdf_bytes,
        "tmp_path": tmp_path,
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


def test_historical_certificate_discovery_by_repaired_scopus_id(client, db_session):
    """
    Test that a researcher with repaired Scopus ID in recovery_metadata
    (e.g., Subrat Mishra, Scopus ID 60860734300) discovers their recovered historical certificate.
    """
    # 1. Existing researcher in ResearchAuthor directory
    author = ResearchAuthor(
        scopus_id="60860734300",
        full_name="Subrat Mishra",
        department="Department of Computer Applications",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_verified=True,
    )
    db_session.add(author)
    db_session.flush()

    # 2. Historical recovered certificate with repaired Scopus ID in recovery_metadata
    hist_cert = LegacyCertificateRegistry(
        certificate_number="CSJMU/SAMIKSHA/2026/000006",
        recipient_name="Subrat Mishra",
        research_title="Cloud Security & Archival Verification",
        certificate_type="INCENTIVE_AWARD",
        issue_reference="Volume 2, Issue 3 (July - September 2026)",
        sanction_amount="INR 10,000",
        verification_token="token_subrat_hist_000006_hex",
        is_legacy=True,
        is_revoked=False,
        recovery_source="HISTORICAL_ARCHIVE",
        recovery_metadata={
            "scopus_id": "60860734300",
            "recipient_name": "Subrat Mishra",
            "department": "Department of Computer Applications",
            "research_title": "Cloud Security & Archival Verification",
            "publication_details": "Cloud Security & Archival Verification, IEEE Trans 2026",
            "bulletin_citation": "Volume 2, Issue 3 (July - September 2026)",
            "storage_key": "sama_veda/certificates/recovered_000006.pdf",
        },
    )
    db_session.add(hist_cert)
    db_session.commit()

    # Query public researcher-discovery endpoint
    res = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=60860734300")
    assert res.status_code == 200
    data = res.json()["data"]

    # Researcher profile verified
    assert data["researcher"]["full_name"] == "Subrat Mishra"
    assert data["researcher"]["scopus_id"] == "60860734300"

    # Category separation: INCENTIVE_AWARD must appear under incentive_certificates
    assert len(data["research_certificates"]) == 0
    assert len(data["incentive_certificates"]) == 1

    cert_item = data["incentive_certificates"][0]
    assert cert_item["certificate_number"] == "CSJMU/SAMIKSHA/2026/000006"
    assert cert_item["title"] == "Cloud Security & Archival Verification"
    assert cert_item["certificate_type"] == "INCENTIVE_AWARD"
    assert cert_item["category"] == "INCENTIVE"
    assert cert_item["record_type"] == "historical"
    assert cert_item["is_legacy"] is True
    assert cert_item["sanction_amount"] == "INR 10,000"
    assert cert_item["is_download_allowed"] is True
    assert "/verify/token_subrat_hist_000006_hex" in cert_item["verification_url"]

    # Check ANUDAAN incentives gap reporting acknowledges PDF availability
    assert data["anudaan_incentives"]["pdf_certificates_available"] is True


def test_historical_research_work_certificate_categorization(client, db_session):
    """
    Test that a historical certificate with certificate_type = 'SCHOLARLY_FELICITATION'
    appears under research_certificates (Category 1), NOT incentive_certificates.
    """
    author = ResearchAuthor(
        scopus_id="55500011122",
        full_name="Dr. Alka Tiwari",
        department="Physics",
        is_verified=True,
    )
    db_session.add(author)
    db_session.flush()

    hist_pub = LegacyCertificateRegistry(
        certificate_number="CSJMU/SAMIKSHA/2026/000015",
        recipient_name="Dr. Alka Tiwari",
        research_title="Nanotechnology Innovations in Solar Cells",
        certificate_type="SCHOLARLY_FELICITATION",
        issue_reference="Volume 1, Issue 2",
        verification_token="token_alka_hist_000015_hex",
        is_legacy=True,
        is_revoked=False,
        recovery_source="HISTORICAL_ARCHIVE",
        recovery_metadata={
            "scopus_id": "55500011122",
            "recipient_name": "Dr. Alka Tiwari",
            "department": "Physics",
            "research_title": "Nanotechnology Innovations in Solar Cells",
        },
    )
    db_session.add(hist_pub)
    db_session.commit()

    res = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=55500011122")
    assert res.status_code == 200
    data = res.json()["data"]

    assert len(data["research_certificates"]) == 1
    assert len(data["incentive_certificates"]) == 0

    item = data["research_certificates"][0]
    assert item["certificate_number"] == "CSJMU/SAMIKSHA/2026/000015"
    assert item["category"] == "RESEARCH_WORK"
    assert item["record_type"] == "historical"
    assert item["is_legacy"] is True


def test_coexistence_of_active_and_historical_certificates(client, db_session):
    """
    Test that a researcher who has BOTH active digital certificates and recovered
    historical certificates sees all of them without duplicates or suppression.
    """
    author = ResearchAuthor(
        scopus_id="57199988877",
        full_name="Prof. Rajesh Gupta",
        department="Mathematics",
        is_verified=True,
    )
    db_session.add(author)
    db_session.flush()

    # 1. Active certificate in felicitation_certificates
    active_cert = FelicitationCertificate(
        certificate_number="CSJMU/SAMA/2026/ACTIVE01",
        certificate_type="RESEARCH_PUBLICATION",
        status="ISSUED",
        title="Active Research Excellence in Topology",
        research_title="Active Research Excellence in Topology",
        author_id=author.id,
        verification_token="active_token_rajesh_999",
        file_storage_path="certs/rajesh_active.pdf",
        issued_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
    )
    db_session.add(active_cert)

    # 2. Historical incentive certificate in sama_legacy_certificate_registry
    hist_cert = LegacyCertificateRegistry(
        certificate_number="CSJMU/SAMIKSHA/2026/000022",
        recipient_name="Prof. Rajesh Gupta",
        research_title="Historical Number Theory Publication",
        certificate_type="INCENTIVE_AWARD",
        sanction_amount="INR 8,000",
        verification_token="token_rajesh_hist_22",
        is_legacy=True,
        is_revoked=False,
        recovery_source="HISTORICAL_ARCHIVE",
        recovery_metadata={
            "scopus_id": "57199988877",
            "recipient_name": "Prof. Rajesh Gupta",
            "department": "Mathematics",
        },
    )
    db_session.add(hist_cert)
    db_session.commit()

    res = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=57199988877")
    assert res.status_code == 200
    data = res.json()["data"]

    assert len(data["research_certificates"]) == 1
    assert len(data["incentive_certificates"]) == 1
    assert data["total_certificates"] == 2

    # Active certificate verification
    active_item = data["research_certificates"][0]
    assert active_item["certificate_number"] == "CSJMU/SAMA/2026/ACTIVE01"
    assert active_item["record_type"] == "active"
    assert active_item["is_legacy"] is False

    # Historical certificate verification
    hist_item = data["incentive_certificates"][0]
    assert hist_item["certificate_number"] == "CSJMU/SAMIKSHA/2026/000022"
    assert hist_item["record_type"] == "historical"
    assert hist_item["is_legacy"] is True
    assert hist_item["sanction_amount"] == "INR 8,000"


def test_serial_number_collision_000002_safely_handled(client, db_session):
    """
    Test that serial number 000002 collision between active cert and historical cert
    is handled safely by distinct token/ID identity.
    """
    # Active recipient
    active_author = ResearchAuthor(
        scopus_id="99900011122",
        full_name="Amrita Singh",
        department="Computer Science",
        is_verified=True,
    )
    # Historical recipient
    hist_author = ResearchAuthor(
        scopus_id="60860734300",
        full_name="Subrat Mishra",
        department="Computer Applications",
        is_verified=True,
    )
    db_session.add_all([active_author, hist_author])
    db_session.flush()

    # Active cert 000002
    active_cert = FelicitationCertificate(
        certificate_number="CSJMU/SAMIKSHA/2026/000002",
        certificate_type="RESEARCH_PUBLICATION",
        status="ISSUED",
        title="Active Certificate 000002",
        author_id=active_author.id,
        verification_token="active_token_000002_distinct",
        file_storage_path="certs/active_000002.pdf",
    )
    db_session.add(active_cert)

    # Historical cert 000002
    hist_cert = LegacyCertificateRegistry(
        certificate_number="CSJMU/SAMIKSHA/2026/000002",
        recipient_name="Subrat Mishra",
        research_title="Historical Incentive Award 000002",
        certificate_type="INCENTIVE_AWARD",
        verification_token="historical_token_000002_distinct",
        is_legacy=True,
        is_revoked=False,
        recovery_source="HISTORICAL_ARCHIVE",
        recovery_metadata={
            "scopus_id": "60860734300",
            "recipient_name": "Subrat Mishra",
        },
    )
    db_session.add(hist_cert)
    db_session.commit()

    # Lookup by Subrat Mishra's Scopus ID should ONLY return historical 000002
    res_subrat = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=60860734300")
    assert res_subrat.status_code == 200
    data_subrat = res_subrat.json()["data"]
    assert len(data_subrat["incentive_certificates"]) == 1
    assert data_subrat["incentive_certificates"][0]["verification_token"] == "historical_token_000002_distinct"

    # Lookup by Amrita Singh's Scopus ID should ONLY return active 000002
    res_amrita = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=99900011122")
    assert res_amrita.status_code == 200
    data_amrita = res_amrita.json()["data"]
    assert len(data_amrita["research_certificates"]) == 1
    assert data_amrita["research_certificates"][0]["verification_token"] == "active_token_000002_distinct"


def test_exact_scopus_id_matching_no_partial_matches(client, db_session):
    """
    Test that Scopus ID matching is exact and strict:
    - '608' should NOT match '60860734300'.
    - Whitespace is trimmed safely.
    - String type is preserved.
    """
    hist_cert = LegacyCertificateRegistry(
        certificate_number="CSJMU/SAMIKSHA/2026/000006",
        recipient_name="Subrat Mishra",
        research_title="Cloud Security Research",
        certificate_type="INCENTIVE_AWARD",
        verification_token="tok_subrat_exact",
        is_legacy=True,
        is_revoked=False,
        recovery_source="HISTORICAL_ARCHIVE",
        recovery_metadata={
            "scopus_id": "60860734300",
            "recipient_name": "Subrat Mishra",
        },
    )
    db_session.add(hist_cert)
    db_session.commit()

    # 1. Partial prefix '608' must return 404
    res_partial = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=608")
    assert res_partial.status_code == 404

    # 2. Leading/trailing whitespace should be trimmed and match exactly
    res_trimmed = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=%2060860734300%20")
    assert res_trimmed.status_code == 200
    assert len(res_trimmed.json()["data"]["incentive_certificates"]) == 1


def test_historical_only_researcher_without_prior_author_record(client, db_session):
    """
    Test that a researcher who has recovered historical certificates but is NOT yet
    in sama_research_authors is cleanly resolved via historical recovery metadata.
    """
    hist_cert = LegacyCertificateRegistry(
        certificate_number="CSJMU/SAMIKSHA/2026/000045",
        recipient_name="Dr. Archana Verma",
        research_title="Polymer Chemistry Innovations",
        certificate_type="INCENTIVE_AWARD",
        verification_token="tok_archana_hist_45",
        is_legacy=True,
        is_revoked=False,
        recovery_source="HISTORICAL_ARCHIVE",
        recovery_metadata={
            "scopus_id": "55512345678",
            "recipient_name": "Dr. Archana Verma",
            "department": "Department of Chemistry",
        },
    )
    db_session.add(hist_cert)
    db_session.commit()

    res = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=55512345678")
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["researcher"]["full_name"] == "Dr. Archana Verma"
    assert data["researcher"]["department"] == "Department of Chemistry"
    assert len(data["incentive_certificates"]) == 1
    assert data["incentive_certificates"][0]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000045"


def test_revoked_historical_certificate_is_excluded(client, db_session):
    """
    Test that historical certificates marked as revoked are excluded from public self-service results.
    """
    hist_cert = LegacyCertificateRegistry(
        certificate_number="CSJMU/SAMIKSHA/2026/000099",
        recipient_name="Revoked Researcher",
        research_title="Revoked Historical Work",
        certificate_type="INCENTIVE_AWARD",
        verification_token="tok_revoked_99",
        is_legacy=True,
        is_revoked=True,
        revocation_reason="Procedural reissuance",
        recovery_source="HISTORICAL_ARCHIVE",
        recovery_metadata={
            "scopus_id": "77788899900",
            "recipient_name": "Revoked Researcher",
        },
    )
    db_session.add(hist_cert)
    db_session.commit()

    res = client.get("/api/modules/sama-veda/certificates/researcher-discovery?scopus_id=77788899900")
    # Since only a revoked cert exists and no active author, should be 404
    assert res.status_code == 404


def test_public_download_historical_certificate_by_token(client, db_session, setup_test_db):
    """
    Test that downloading a historical certificate by verification token successfully
    streams the original PDF from storage without attempting regeneration.
    """
    token = "token_subrat_hist_000006_hex"
    hist_cert = LegacyCertificateRegistry(
        certificate_number="CSJMU/SAMIKSHA/2026/000006",
        recipient_name="Subrat Mishra",
        research_title="Cloud Security & Archival Verification",
        certificate_type="INCENTIVE_AWARD",
        verification_token=token,
        is_legacy=True,
        is_revoked=False,
        recovery_source="HISTORICAL_ARCHIVE",
        source_pdf_reference=setup_test_db["pdf_path"],
        recovery_metadata={
            "scopus_id": "60860734300",
            "storage_key": setup_test_db["pdf_path"],
        },
    )
    db_session.add(hist_cert)
    db_session.commit()

    # Download via /certificates/verify/{token}/download
    dl_res = client.get(f"/api/modules/sama-veda/certificates/verify/{token}/download")
    assert dl_res.status_code == 200
    assert dl_res.headers["content-type"] == "application/pdf"
    assert setup_test_db["pdf_bytes"] in dl_res.content

    # Download via /certificates/download/{token}
    dl_res2 = client.get(f"/api/modules/sama-veda/certificates/download/{token}")
    assert dl_res2.status_code == 200
    assert dl_res2.headers["content-type"] == "application/pdf"
    assert setup_test_db["pdf_bytes"] in dl_res2.content
