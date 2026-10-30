"""
Database-Free Model and Migration Integrity Tests for Sama Veda.

Verifies:
1. All 8 Sama Veda database tables are registered in Base.metadata.
2. Table constraints, foreign keys, indexes, and cascades.
3. Bidirectional ORM relationship mappings.
4. Provisional author identity representation (supporting unresolved Scopus anomalies).
5. Alembic migration script revision graph and upgrade/downgrade contract.

Runs completely in-memory with zero external network or database connections.
"""
import importlib
from pathlib import Path
import uuid
from decimal import Decimal
import pytest
from sqlalchemy import UniqueConstraint, ForeignKeyConstraint, Index

from app.models.base import Base
from app.modules.sama_veda.models import (
    ResearchBulletin,
    ResearchAuthor,
    ResearchPublication,
    PublicationAuthor,
    FelicitationCertificate,
    CertificateVerificationEvent,
    CamAiProject,
    FellowshipScheme,
    ResearcherSpotlight,
)


# =========================================================================
# 1. Metadata & Table Registration Tests
# =========================================================================

EXPECTED_SAMA_TABLES = [
    "sama_research_bulletins",
    "sama_research_authors",
    "sama_research_publications",
    "sama_publication_authors",
    "sama_felicitation_certificates",
    "sama_certificate_verification_events",
    "sama_cam_ai_projects",
    "sama_fellowship_schemes",
    "sama_researcher_spotlights",
    "sama_import_batches",
]


@pytest.mark.parametrize("table_name", EXPECTED_SAMA_TABLES)
def test_sama_veda_tables_registered_in_metadata(table_name):
    """Verifies that all 10 physical tables are discovered and registered in Base.metadata."""
    assert table_name in Base.metadata.tables, f"Table '{table_name}' was not found in Base.metadata"


def test_sama_veda_table_count():
    """Verifies exactly 10 physical tables are created for Sama Veda."""
    registered_sama = [t for t in Base.metadata.tables.keys() if t.startswith("sama_")]
    assert len(registered_sama) == 10
    assert set(registered_sama) == set(EXPECTED_SAMA_TABLES)


# =========================================================================
# 2. Model Instantiation & Column Default Metadata Tests
# =========================================================================

def test_research_bulletin_defaults():
    # Verify column defaults on table schema
    table = ResearchBulletin.__table__
    assert callable(table.c.id.default.arg)
    assert getattr(table.c.id.default.arg, "__name__", "") == "uuid4"
    assert table.c.file_size_bytes.default.arg == 0
    assert table.c.publication_count.default.arg == 0
    assert table.c.is_active.default.arg is True

    # Verify instantiation with explicit attributes
    b_id = uuid.uuid4()
    bulletin = ResearchBulletin(
        id=b_id,
        volume_number=2,
        issue_number=1,
        title="Volume 2 • Issue 1",
        publication_period="January – March 2026",
        file_path="storage/sama_veda/bulletins/March_bulletin.pdf",
        file_size_bytes=1024,
        publication_count=50,
        is_active=True,
    )
    assert bulletin.id == b_id
    assert bulletin.volume_number == 2
    assert bulletin.issue_number == 1
    assert bulletin.file_size_bytes == 1024
    assert bulletin.publication_count == 50
    assert bulletin.is_active is True
    assert "Volume 2 • Issue 1" in repr(bulletin)


def test_research_author_provisional_identity():
    """Verifies author model supports provisional status without inventing verification."""
    # Verify table column defaults
    table = ResearchAuthor.__table__
    assert callable(table.c.id.default.arg)
    assert getattr(table.c.id.default.arg, "__name__", "") == "uuid4"
    assert table.c.institutional_affiliation.default.arg == "Chhatrapati Shahu Ji Maharaj University, Kanpur"
    assert table.c.is_verified.default.arg is False

    # Verified author instantiation
    a_id = uuid.uuid4()
    author_verified = ResearchAuthor(
        id=a_id,
        scopus_id="59650228300",
        full_name="Chandra Shekhar Kumar",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_verified=True,
    )
    assert author_verified.id == a_id
    assert author_verified.is_verified is True
    assert author_verified.verification_notes is None
    assert author_verified.institutional_affiliation == "Chhatrapati Shahu Ji Maharaj University, Kanpur"

    # Provisional author (unresolved duplicate in legacy dataset)
    p_id = uuid.uuid4()
    author_provisional = ResearchAuthor(
        id=p_id,
        scopus_id="PROVISIONAL_59996081300_MANSI",
        full_name="Mansi Bajpai",
        is_verified=False,
        verification_notes="Duplicate Scopus ID 59996081300 in legacy Volume 2 Issue 2 JSON; pending R&D Cell verification",
    )
    assert author_provisional.id == p_id
    assert author_provisional.is_verified is False
    assert "Duplicate Scopus ID" in author_provisional.verification_notes
    assert "Mansi Bajpai" in repr(author_provisional)


def test_research_publication_defaults():
    table = ResearchPublication.__table__
    assert callable(table.c.id.default.arg)
    assert getattr(table.c.id.default.arg, "__name__", "") == "uuid4"
    assert table.c.authors_complete.default.arg is True

    pub_id = uuid.uuid4()
    bulletin_id = uuid.uuid4()
    pub = ResearchPublication(
        id=pub_id,
        bulletin_id=bulletin_id,
        serial_no=1,
        slug="v2-i1-r001",
        title="Sample Paper Title",
        source_journal="Journal of Research",
        category="Article",
        author_display="Author One, Author Two et al",
        authors_complete=True,
    )
    assert pub.id == pub_id
    assert pub.bulletin_id == bulletin_id
    assert pub.serial_no == 1
    assert pub.slug == "v2-i1-r001"
    assert pub.authors_complete is True
    assert "v2-i1-r001" in repr(pub)


def test_publication_author_junction():
    table = PublicationAuthor.__table__
    assert callable(table.c.id.default.arg)
    assert getattr(table.c.id.default.arg, "__name__", "") == "uuid4"
    assert table.c.author_order.default.arg == 1
    assert table.c.is_corresponding.default.arg is False

    link_id = uuid.uuid4()
    pub_id = uuid.uuid4()
    auth_id = uuid.uuid4()
    link = PublicationAuthor(
        id=link_id,
        publication_id=pub_id,
        author_id=auth_id,
        author_order=2,
        is_corresponding=True,
    )
    assert link.id == link_id
    assert link.publication_id == pub_id
    assert link.author_id == auth_id
    assert link.author_order == 2
    assert link.is_corresponding is True
    assert str(pub_id) in repr(link)


def test_felicitation_certificate_defaults():
    table = FelicitationCertificate.__table__
    assert callable(table.c.id.default.arg)
    assert getattr(table.c.id.default.arg, "__name__", "") == "uuid4"
    assert table.c.download_count.default.arg == 0

    c_id = uuid.uuid4()
    b_id = uuid.uuid4()
    a_id = uuid.uuid4()
    cert = FelicitationCertificate(
        id=c_id,
        certificate_number="CSJMU/RD/2026/V2-I1/048",
        bulletin_id=b_id,
        author_id=a_id,
        file_storage_path="storage/sama_veda/certificates/march/48-48.pdf",
        download_count=0,
    )
    assert cert.id == c_id
    assert cert.certificate_number == "CSJMU/RD/2026/V2-I1/048"
    assert cert.download_count == 0
    assert "CSJMU/RD/2026/V2-I1/048" in repr(cert)


def test_certificate_verification_event_defaults():
    table = CertificateVerificationEvent.__table__
    assert callable(table.c.id.default.arg)
    assert getattr(table.c.id.default.arg, "__name__", "") == "uuid4"

    e_id = uuid.uuid4()
    cert_id = uuid.uuid4()
    event = CertificateVerificationEvent(
        id=e_id,
        certificate_id=cert_id,
        verification_source="SCOPUS_ID",
        ip_address="127.0.0.1",
        user_agent="Mozilla/5.0 Test",
    )
    assert event.id == e_id
    assert event.certificate_id == cert_id
    assert event.verification_source == "SCOPUS_ID"
    assert "SCOPUS_ID" in repr(event)


def test_cam_ai_project_defaults():
    table = CamAiProject.__table__
    assert callable(table.c.id.default.arg)
    assert getattr(table.c.id.default.arg, "__name__", "") == "uuid4"
    assert table.c.status.default.arg == "Ongoing"

    p_id = uuid.uuid4()
    project = CamAiProject(
        id=p_id,
        legacy_project_id=1,
        category="Major",
        domain="AI in Healthcare",
        title="Rebuilding Voices with AI",
        funding_amount_inr=Decimal("11000000.00"),
        funding_display="₹1,10,00,000",
        status="Ongoing",
        principal_investigators=[{"name": "Dr. Shilpa Deshpande Kaistha", "department": "Biotechnology"}],
        co_investigators=[{"name": "Dr. Ajeet Kumar Srivastav", "department": "UIET"}],
    )
    assert project.id == p_id
    assert project.legacy_project_id == 1
    assert project.funding_amount_inr == Decimal("11000000.00")
    assert project.status == "Ongoing"
    assert len(project.principal_investigators) == 1
    assert len(project.co_investigators) == 1
    assert "AI in Healthcare" in repr(project)


def test_fellowship_scheme_defaults():
    table = FellowshipScheme.__table__
    assert callable(table.c.id.default.arg)
    assert getattr(table.c.id.default.arg, "__name__", "") == "uuid4"
    assert table.c.active_scholars_count.default.arg == 0

    s_id = uuid.uuid4()
    scheme = FellowshipScheme(
        id=s_id,
        scheme_code="JRF",
        scheme_name="Junior Research Fellowship",
        active_scholars_count=45,
    )
    assert scheme.id == s_id
    assert scheme.scheme_code == "JRF"
    assert scheme.active_scholars_count == 45
    assert "JRF" in repr(scheme)


# =========================================================================
# 3. Foreign Key & Constraint Metadata Tests
# =========================================================================

def test_bulletin_unique_constraint():
    table = Base.metadata.tables["sama_research_bulletins"]
    uq_names = [c.name for c in table.constraints if isinstance(c, UniqueConstraint)]
    assert "uq_sama_bulletin_volume_issue" in uq_names
    uq = next(c for c in table.constraints if c.name == "uq_sama_bulletin_volume_issue")
    col_names = [col.name for col in uq.columns]
    assert set(col_names) == {"volume_number", "issue_number"}


def test_publication_author_unique_constraint():
    table = Base.metadata.tables["sama_publication_authors"]
    uq_names = [c.name for c in table.constraints if isinstance(c, UniqueConstraint)]
    assert "uq_sama_pub_author" in uq_names
    uq = next(c for c in table.constraints if c.name == "uq_sama_pub_author")
    col_names = [col.name for col in uq.columns]
    assert set(col_names) == {"publication_id", "author_id"}


def test_publication_foreign_keys():
    table = Base.metadata.tables["sama_research_publications"]
    fks = list(table.foreign_keys)
    assert len(fks) == 1
    fk = fks[0]
    assert fk.target_fullname == "sama_research_bulletins.id"
    assert fk.ondelete == "CASCADE"


def test_certificate_foreign_keys():
    table = Base.metadata.tables["sama_felicitation_certificates"]
    fk_targets = {fk.target_fullname: fk.ondelete for fk in table.foreign_keys}
    assert "sama_research_bulletins.id" in fk_targets
    assert fk_targets["sama_research_bulletins.id"] == "CASCADE"
    assert "sama_research_authors.id" in fk_targets
    assert fk_targets["sama_research_authors.id"] == "CASCADE"
    assert "sama_research_publications.id" in fk_targets
    assert fk_targets["sama_research_publications.id"] == "SET NULL"


def test_author_user_foreign_key():
    table = Base.metadata.tables["sama_research_authors"]
    fk_targets = {fk.target_fullname: fk.ondelete for fk in table.foreign_keys}
    assert "users.id" in fk_targets
    assert fk_targets["users.id"] == "SET NULL"


def test_author_verified_scopus_partial_index():
    table = Base.metadata.tables["sama_research_authors"]
    idx = next((i for i in table.indexes if i.name == "uq_sama_author_verified_scopus"), None)
    assert idx is not None
    assert idx.unique is True
    assert "is_verified = true" in str(idx.dialect_options["postgresql"]["where"])


# =========================================================================
# 4. Bidirectional Relationship Wiring Tests
# =========================================================================

def test_bulletin_to_publications_relationship():
    bulletin = ResearchBulletin(
        volume_number=2,
        issue_number=1,
        title="Vol 2 Issue 1",
        publication_period="Jan-Mar 2026",
        file_path="test.pdf",
    )
    pub1 = ResearchPublication(
        serial_no=1,
        slug="v2-i1-r001",
        title="Title 1",
        source_journal="Journal 1",
        category="Article",
        author_display="Display 1",
    )
    pub2 = ResearchPublication(
        serial_no=2,
        slug="v2-i1-r002",
        title="Title 2",
        source_journal="Journal 2",
        category="Review",
        author_display="Display 2",
    )
    bulletin.publications.append(pub1)
    bulletin.publications.append(pub2)

    assert len(bulletin.publications) == 2
    assert pub1.bulletin is bulletin
    assert pub2.bulletin is bulletin


def test_publication_author_m2m_relationship():
    pub = ResearchPublication(
        serial_no=1,
        slug="v2-i1-r001",
        title="Title 1",
        source_journal="Journal 1",
        category="Article",
        author_display="Display 1",
    )
    author = ResearchAuthor(
        scopus_id="59650228300",
        full_name="Chandra Shekhar Kumar",
    )
    link = PublicationAuthor(
        publication=pub,
        author=author,
        author_order=1,
    )

    assert link.publication is pub
    assert link.author is author
    assert len(pub.author_links) == 1
    assert len(author.publication_links) == 1
    assert pub.author_links[0].author.full_name == "Chandra Shekhar Kumar"


def test_certificate_to_verification_events_relationship():
    cert = FelicitationCertificate(
        certificate_number="CSJMU/RD/2026/V2-I1/048",
        file_storage_path="48-48.pdf",
    )
    event1 = CertificateVerificationEvent(verification_source="SCOPUS_ID")
    event2 = CertificateVerificationEvent(verification_source="QR_CODE")
    cert.verification_events.append(event1)
    cert.verification_events.append(event2)

    assert len(cert.verification_events) == 2
    assert event1.certificate is cert
    assert event2.certificate is cert


# =========================================================================
# 5. Alembic Migration Script Contract Tests
# =========================================================================

def test_alembic_migration_revision_contract():
    """Verifies Alembic migration file syntax, revision IDs, and upgrade/downgrade callables."""
    migration_path = Path(__file__).resolve().parent.parent / "alembic" / "versions" / "8b29c54e1014_sama_veda_core.py"
    assert migration_path.is_file(), f"Migration file not found at {migration_path}"
    spec = importlib.util.spec_from_file_location(
        "migration_8b29c54e1014",
        str(migration_path),
    )
    assert spec is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    assert mod.revision == "8b29c54e1014"
    assert mod.down_revision == "8b29c54e1013"
    assert callable(getattr(mod, "upgrade", None))
    assert callable(getattr(mod, "downgrade", None))


def test_alembic_cms_lifecycle_migration_contract():
    """Verifies Phase C Alembic migration 8b29c54e1015 syntax and revision chain."""
    migration_path = Path(__file__).resolve().parent.parent / "alembic" / "versions" / "8b29c54e1015_sama_veda_cms_lifecycle.py"
    assert migration_path.is_file(), f"Migration file not found at {migration_path}"
    spec = importlib.util.spec_from_file_location(
        "migration_8b29c54e1015",
        str(migration_path),
    )
    assert spec is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    assert mod.revision == "8b29c54e1015"
    assert mod.down_revision == "8b29c54e1014"
    assert callable(getattr(mod, "upgrade", None))
    assert callable(getattr(mod, "downgrade", None))


def test_spotlight_model_attributes_and_defaults():
    table = ResearcherSpotlight.__table__
    assert "author_id" in table.c
    assert "headline" in table.c
    assert "summary" in table.c
    assert "media_type" in table.c
    assert "media_url" in table.c
    assert "video_embed_url" in table.c
    assert "display_order" in table.c
    assert "is_active" in table.c

    spotlight = ResearcherSpotlight(
        headline="Breakthrough in Quantum Computing",
        summary="Dr. Sharma and team publish pioneering findings.",
        media_type="photo",
        media_url="storage/spotlights/quantum.jpg",
        display_order=1,
        is_active=True,
    )
    assert spotlight.headline == "Breakthrough in Quantum Computing"
    assert spotlight.is_active is True


def test_publication_and_bulletin_lifecycle_columns():
    pub_table = ResearchPublication.__table__
    assert "status" in pub_table.c
    assert "abstract" in pub_table.c
    assert "external_url" in pub_table.c
    assert "is_featured" in pub_table.c
    assert "published_at" in pub_table.c
    assert "archived_at" in pub_table.c

    bulletin_table = ResearchBulletin.__table__
    assert "status" in bulletin_table.c
    assert "archived_at" in bulletin_table.c

    cert_table = FelicitationCertificate.__table__
    assert "is_revoked" in cert_table.c
    assert "revoked_at" in cert_table.c
    assert "revocation_reason" in cert_table.c

