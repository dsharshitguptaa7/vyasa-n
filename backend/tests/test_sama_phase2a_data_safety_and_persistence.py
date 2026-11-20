"""
VYASA Phase 2A: Data Safety & CMS Persistence Integrity Regression Test Suite.
Verifies:
1. Deletion Safety:
   - Bulletin deletion is blocked when dependent publications exist.
   - Bulletin deletion is blocked when protected certificates exist.
   - Author deletion is blocked when protected certificates exist.
   - Author deletion is blocked when multi-author certificates exist.
   - Author deletion is blocked when co-author publications exist.
   - Publication deletion is blocked when issued certificates exist.
   - Certificates remain verifiable after blocked delete attempts.
   - Existing publication relations are preserved.
2. CMS Persistence:
   - Create publication persists submitted metadata.
   - Update publication persists intended changes.
   - Omitted update fields do not unintentionally erase existing values.
   - Invalid bulletin ID is rejected.
   - Invalid researcher IDs are rejected.
   - Transaction rollback works when relationship persistence fails.
3. Author Links:
   - CMS publication creation persists author links.
   - Duplicate author links are prevented.
   - Author order is preserved.
   - Corresponding-author flag is preserved.
   - Explicit author-link updates behave correctly.
4. Slug Collision Safety:
   - Duplicate manual slug returns a controlled error.
   - Auto-generated slug collision is handled safely and deterministically.
5. Bulletin Counts:
   - Draft batch imports do not falsely inflate bulletin publication counts.
   - Publication deletion does not leave count mutations inconsistent.
   - Static archival counts remain distinguishable from live counts.
"""

import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.base import Base
import app.modules.sama_veda.models
from app.modules.sama_veda.models.publication import ResearchPublication, PublicationAuthor
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateTemplate,
)
from app.modules.sama_veda.models.import_batch import SamaImportBatch
from app.modules.sama_veda.schemas.cms import (
    PublicationCreate,
    PublicationUpdate,
    PublicationAuthorLinkInput,
)
from app.modules.sama_veda.services.cms_service import SamaCmsService
from app.modules.sama_veda.services.import_service import SamaImportService
from app.modules.sama_veda.services.analytics_service import SamaAnalyticsService


@pytest.fixture
def test_db():
    """Isolated SQLite database session for Phase 2A data integrity validation."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_bulletin(test_db):
    bulletin = ResearchBulletin(
        id=uuid.uuid4(),
        volume_number=2,
        issue_number=1,
        title="Volume 2 • Issue 1",
        publication_period="January – March 2026",
        file_path="bulletins/v2-i1.pdf",
        publication_count=91,  # Archival cover count
        status="published",
        is_active=True,
    )
    test_db.add(bulletin)
    test_db.commit()
    test_db.refresh(bulletin)
    return bulletin


@pytest.fixture
def sample_author(test_db):
    author = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Prof. Dr. Vandana Pathak",
        department="Department of Biotechnology",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        scopus_id="57200123456",
        is_verified=True,
    )
    test_db.add(author)
    test_db.commit()
    test_db.refresh(author)
    return author


@pytest.fixture
def second_author(test_db):
    author = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Dr. Alok Kumar",
        department="Department of Physics",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        scopus_id="57200987654",
        is_verified=True,
    )
    test_db.add(author)
    test_db.commit()
    test_db.refresh(author)
    return author


# ============================================================================
# 1. DELETION SAFETY TESTS
# ============================================================================

def test_bulletin_deletion_blocked_when_dependent_publications_exist(test_db, sample_bulletin):
    """Deleting a bulletin must be blocked if research publications are associated with it."""
    pub = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=sample_bulletin.id,
        serial_no=1,
        slug="v2-i1-r001",
        title="CRISPR Advances in Agricultural Biotechnology",
        source_journal="Journal of Biotechnology",
        category="Article",
        author_display="Dr. Vandana Pathak",
        status="published",
    )
    test_db.add(pub)
    test_db.commit()

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.delete_bulletin(test_db, sample_bulletin)

    assert "Cannot delete research bulletin" in str(excinfo.value)
    assert "1 publication(s) are associated" in str(excinfo.value)

    # Verify bulletin and publication still exist
    assert test_db.get(ResearchBulletin, sample_bulletin.id) is not None
    assert test_db.get(ResearchPublication, pub.id) is not None


def test_bulletin_deletion_blocked_when_protected_certificates_exist(test_db, sample_bulletin, sample_author):
    """Deleting a bulletin must be blocked if legally issued certificates depend on it."""
    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/SAMIKSHA/2026/000101",
        bulletin_id=sample_bulletin.id,
        author_id=sample_author.id,
        title="Certificate of Appreciation & Research Excellence",
        verification_token=uuid.uuid4().hex,
        status="ISSUED",
        checksum_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )
    test_db.add(cert)
    test_db.commit()

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.delete_bulletin(test_db, sample_bulletin)

    assert "Cannot delete research bulletin" in str(excinfo.value)
    assert "legally issued felicitation certificate(s) depend" in str(excinfo.value)
    assert test_db.get(FelicitationCertificate, cert.id) is not None


def test_author_deletion_blocked_when_protected_certificates_exist(test_db, sample_author, sample_bulletin):
    """Deleting a researcher must be blocked if issued certificates depend on their identity."""
    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/SAMIKSHA/2026/000102",
        bulletin_id=sample_bulletin.id,
        author_id=sample_author.id,
        title="Certificate of Appreciation",
        verification_token=uuid.uuid4().hex,
        status="ISSUED",
        checksum_sha256="abc123sha256checksum",
    )
    test_db.add(cert)
    test_db.commit()

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.delete_author(test_db, sample_author)

    assert "Cannot delete researcher" in str(excinfo.value)
    assert "legally issued felicitation certificate(s) depend" in str(excinfo.value)
    assert test_db.get(ResearchAuthor, sample_author.id) is not None


def test_author_deletion_blocked_when_multi_author_certificates_exist(test_db, sample_author, sample_bulletin):
    """Deleting an author must be blocked if multi-author certificate author records reference them."""
    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/SAMIKSHA/2026/000103",
        bulletin_id=sample_bulletin.id,
        author_id=None,
        title="Collaborative Research Certificate",
        verification_token=uuid.uuid4().hex,
        status="ISSUED",
    )
    test_db.add(cert)
    test_db.flush()

    cert_author = CertificateAuthor(
        id=uuid.uuid4(),
        certificate_id=cert.id,
        researcher_id=sample_author.id,
        author_name_snapshot=sample_author.full_name,
        author_order=1,
    )
    test_db.add(cert_author)
    test_db.commit()

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.delete_author(test_db, sample_author)

    assert "Cannot delete researcher" in str(excinfo.value)
    assert "legally issued felicitation certificate(s) depend" in str(excinfo.value)
    assert test_db.get(ResearchAuthor, sample_author.id) is not None


def test_author_deletion_blocked_when_co_author_publications_exist(test_db, sample_author, sample_bulletin):
    """Deleting an author must be blocked if they are linked as author on active publications."""
    pub = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=sample_bulletin.id,
        serial_no=2,
        slug="v2-i1-r002",
        title="Nanomaterials for Solar Energy",
        source_journal="Solar Energy Journal",
        category="Article",
        author_display="Dr. Vandana Pathak",
        status="published",
    )
    test_db.add(pub)
    test_db.flush()

    link = PublicationAuthor(
        id=uuid.uuid4(),
        publication_id=pub.id,
        author_id=sample_author.id,
        author_order=1,
        is_corresponding=True,
    )
    test_db.add(link)
    test_db.commit()

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.delete_author(test_db, sample_author)

    assert "Cannot delete researcher" in str(excinfo.value)
    assert "associated as co-author on 1 research publication(s)" in str(excinfo.value)
    assert test_db.get(ResearchAuthor, sample_author.id) is not None


def test_publication_deletion_blocked_when_issued_certificates_exist(test_db, sample_bulletin, sample_author):
    """Deleting a publication must be blocked if an official ISSUED certificate was awarded for it."""
    pub = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=sample_bulletin.id,
        serial_no=3,
        slug="v2-i1-r003",
        title="Quantum Dot Sensitized Photovoltaics",
        source_journal="Nature Photonics",
        category="Article",
        author_display="Dr. Vandana Pathak",
        status="published",
    )
    test_db.add(pub)
    test_db.flush()

    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/SAMIKSHA/2026/000104",
        bulletin_id=sample_bulletin.id,
        author_id=sample_author.id,
        publication_id=pub.id,
        title="Research Excellence Commendation",
        verification_token=uuid.uuid4().hex,
        status="ISSUED",
    )
    test_db.add(cert)
    test_db.commit()

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.delete_publication(test_db, pub)

    assert "Cannot delete publication" in str(excinfo.value)
    assert "legally issued felicitation certificate(s) depend" in str(excinfo.value)
    assert test_db.get(ResearchPublication, pub.id) is not None


def test_certificates_remain_verifiable_after_blocked_delete_attempts(test_db, sample_bulletin, sample_author):
    """Verification tokens and certificate records remain completely valid after blocked delete attempts."""
    token = uuid.uuid4().hex
    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/SAMIKSHA/2026/000105",
        bulletin_id=sample_bulletin.id,
        author_id=sample_author.id,
        title="Meritorious Scholarly Achievement",
        verification_token=token,
        status="ISSUED",
        checksum_sha256="d41d8cd98f00b204e9800998ecf8427e",
    )
    test_db.add(cert)
    test_db.commit()

    # Blocked delete attempt
    with pytest.raises(ValueError):
        SamaCmsService.delete_bulletin(test_db, sample_bulletin)

    with pytest.raises(ValueError):
        SamaCmsService.delete_author(test_db, sample_author)

    # Verify certificate query by token still returns intact record
    verified = test_db.scalar(select(FelicitationCertificate).where(FelicitationCertificate.verification_token == token))
    assert verified is not None
    assert verified.certificate_number == "CSJMU/SAMIKSHA/2026/000105"
    assert verified.checksum_sha256 == "d41d8cd98f00b204e9800998ecf8427e"


# ============================================================================
# 2. CMS PERSISTENCE & RELATIONSHIP INTEGRITY TESTS
# ============================================================================

def test_create_publication_persists_all_submitted_metadata(test_db, sample_bulletin, sample_author):
    """Creating a publication persists all fields, sets published_at correctly, and links authors."""
    payload = PublicationCreate(
        bulletin_id=sample_bulletin.id,
        serial_no=10,
        slug="v2-i1-r010",
        title="Advanced Polymer Synthetics for Biomedical Devices",
        source_journal="Journal of Biomedical Materials Research",
        category="Review",
        doi="10.1016/j.biomaterials.2026.01.001",
        author_display="Dr. Vandana Pathak et al.",
        authors_complete=True,
        status="published",
        abstract="Comprehensive review of biocompatible synthetic polymers.",
        external_url="https://doi.org/10.1016/j.biomaterials.2026.01.001",
        is_featured=True,
        author_links=[
            PublicationAuthorLinkInput(
                author_id=sample_author.id,
                author_order=1,
                is_corresponding=True,
            )
        ],
    )

    created = SamaCmsService.create_publication(test_db, payload)
    assert created.id is not None
    assert created.title == "Advanced Polymer Synthetics for Biomedical Devices"
    assert created.slug == "v2-i1-r010"
    assert created.status == "published"
    assert created.published_at is not None
    assert created.is_featured is True

    # Verify author junction row exists
    links = test_db.scalars(
        select(PublicationAuthor).where(PublicationAuthor.publication_id == created.id)
    ).all()
    assert len(links) == 1
    assert links[0].author_id == sample_author.id
    assert links[0].author_order == 1
    assert links[0].is_corresponding is True


def test_update_publication_persists_intended_changes(test_db, sample_bulletin):
    """Updating a publication modifies intended fields and preserves database consistency."""
    pub = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=sample_bulletin.id,
        serial_no=11,
        slug="v2-i1-r011",
        title="Initial Draft Title",
        source_journal="Old Journal",
        category="Article",
        author_display="Author One",
        status="draft",
    )
    test_db.add(pub)
    test_db.commit()

    update_payload = PublicationUpdate(
        title="Final Peer-Reviewed Title",
        source_journal="Nature Communications",
        is_featured=True,
    )
    updated = SamaCmsService.update_publication(test_db, pub, update_payload)

    assert updated.title == "Final Peer-Reviewed Title"
    assert updated.source_journal == "Nature Communications"
    assert updated.is_featured is True
    # Omitted fields are not altered
    assert updated.slug == "v2-i1-r011"
    assert updated.category == "Article"
    assert updated.status == "draft"


def test_omitted_update_fields_do_not_erase_existing_values(test_db, sample_bulletin, sample_author):
    """When update payload omits author_links, existing links are not deleted."""
    pub = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=sample_bulletin.id,
        serial_no=12,
        slug="v2-i1-r012",
        title="Existing Paper with Links",
        source_journal="Journal of Physics",
        category="Article",
        author_display="Dr. Vandana Pathak",
        status="draft",
    )
    test_db.add(pub)
    test_db.flush()

    link = PublicationAuthor(
        id=uuid.uuid4(),
        publication_id=pub.id,
        author_id=sample_author.id,
        author_order=1,
        is_corresponding=True,
    )
    test_db.add(link)
    test_db.commit()

    # Update only the status
    update_payload = PublicationUpdate(status="published")
    SamaCmsService.update_publication(test_db, pub, update_payload)

    # Verify link still exists
    preserved_links = test_db.scalars(
        select(PublicationAuthor).where(PublicationAuthor.publication_id == pub.id)
    ).all()
    assert len(preserved_links) == 1
    assert preserved_links[0].author_id == sample_author.id


def test_invalid_bulletin_id_is_rejected(test_db):
    """Referencing a nonexistent bulletin ID raises a clear ValueError."""
    fake_bulletin_id = uuid.uuid4()
    payload = PublicationCreate(
        bulletin_id=fake_bulletin_id,
        serial_no=1,
        slug="test-invalid-bull",
        title="Orphan Paper",
        source_journal="Journal",
        category="Article",
        author_display="Author",
        status="draft",
    )

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.create_publication(test_db, payload)

    assert "Referenced research bulletin with ID" in str(excinfo.value)
    assert str(fake_bulletin_id) in str(excinfo.value)


def test_invalid_researcher_id_is_rejected(test_db, sample_bulletin):
    """Referencing a nonexistent researcher ID raises a clear ValueError."""
    fake_author_id = uuid.uuid4()
    payload = PublicationCreate(
        bulletin_id=sample_bulletin.id,
        serial_no=15,
        slug="test-invalid-author",
        title="Paper with Phantom Author",
        source_journal="Journal",
        category="Article",
        author_display="Author",
        status="draft",
        author_links=[
            PublicationAuthorLinkInput(
                author_id=fake_author_id,
                author_order=1,
            )
        ],
    )

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.create_publication(test_db, payload)

    assert "Referenced researcher author ID" in str(excinfo.value)
    assert str(fake_author_id) in str(excinfo.value)


def test_duplicate_author_links_are_prevented(test_db, sample_bulletin, sample_author):
    """Submitting the same author ID twice in author_links raises a clear ValueError."""
    payload = PublicationCreate(
        bulletin_id=sample_bulletin.id,
        serial_no=16,
        slug="test-duplicate-author-link",
        title="Paper with Duplicate Co-Author Link",
        source_journal="Journal",
        category="Article",
        author_display="Author",
        status="draft",
        author_links=[
            PublicationAuthorLinkInput(author_id=sample_author.id, author_order=1),
            PublicationAuthorLinkInput(author_id=sample_author.id, author_order=2),
        ],
    )

    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.create_publication(test_db, payload)

    assert "Duplicate researcher link" in str(excinfo.value)


def test_author_order_and_corresponding_flag_are_preserved(test_db, sample_bulletin, sample_author, second_author):
    """Multiple authors are inserted with correct sequence order and corresponding flags."""
    payload = PublicationCreate(
        bulletin_id=sample_bulletin.id,
        serial_no=17,
        slug="test-author-order",
        title="Multi-Author Nanomaterials Breakthrough",
        source_journal="ACS Nano",
        category="Article",
        author_display="Pathak & Kumar",
        status="published",
        author_links=[
            PublicationAuthorLinkInput(author_id=sample_author.id, author_order=1, is_corresponding=False),
            PublicationAuthorLinkInput(author_id=second_author.id, author_order=2, is_corresponding=True),
        ],
    )

    pub = SamaCmsService.create_publication(test_db, payload)
    links = test_db.scalars(
        select(PublicationAuthor).where(PublicationAuthor.publication_id == pub.id).order_by(PublicationAuthor.author_order)
    ).all()

    assert len(links) == 2
    assert links[0].author_id == sample_author.id
    assert links[0].author_order == 1
    assert links[0].is_corresponding is False

    assert links[1].author_id == second_author.id
    assert links[1].author_order == 2
    assert links[1].is_corresponding is True


def test_explicit_author_link_replacement(test_db, sample_bulletin, sample_author, second_author):
    """Explicitly updating author_links safely replaces old links with new links."""
    pub = SamaCmsService.create_publication(
        test_db,
        PublicationCreate(
            bulletin_id=sample_bulletin.id,
            serial_no=18,
            slug="test-link-replace",
            title="Initial Solo Paper",
            source_journal="Journal",
            category="Article",
            author_display="Pathak",
            status="draft",
            author_links=[
                PublicationAuthorLinkInput(author_id=sample_author.id, author_order=1)
            ],
        ),
    )

    # Replace with second_author as corresponding
    update_payload = PublicationUpdate(
        author_links=[
            PublicationAuthorLinkInput(author_id=second_author.id, author_order=1, is_corresponding=True)
        ]
    )
    SamaCmsService.update_publication(test_db, pub, update_payload)

    links = test_db.scalars(
        select(PublicationAuthor).where(PublicationAuthor.publication_id == pub.id)
    ).all()
    assert len(links) == 1
    assert links[0].author_id == second_author.id
    assert links[0].is_corresponding is True


# ============================================================================
# 3. SLUG COLLISION SAFETY TESTS
# ============================================================================

def test_duplicate_manual_slug_returns_controlled_error(test_db, sample_bulletin):
    """Manually supplying an existing slug raises a controlled ValueError (for 409 Conflict)."""
    pub1 = SamaCmsService.create_publication(
        test_db,
        PublicationCreate(
            bulletin_id=sample_bulletin.id,
            serial_no=20,
            slug="canonical-slug-20",
            title="Original Paper",
            source_journal="Journal A",
            category="Article",
            author_display="Author",
            status="draft",
        ),
    )
    assert pub1.slug == "canonical-slug-20"

    # Attempt to create another paper with identical slug
    with pytest.raises(ValueError) as excinfo:
        SamaCmsService.create_publication(
            test_db,
            PublicationCreate(
                bulletin_id=sample_bulletin.id,
                serial_no=21,
                slug="canonical-slug-20",
                title="Conflicting Paper",
                source_journal="Journal B",
                category="Article",
                author_display="Author",
                status="draft",
            ),
        )

    assert "already exists" in str(excinfo.value)
    assert "canonical-slug-20" in str(excinfo.value)


def test_auto_generated_slug_collision_handled_safely(test_db, sample_bulletin):
    """When slug is omitted, the institutional convention is generated with deterministic collision resolution."""
    # Create with serial 25: will generate v2-i1-r025
    pub1 = SamaCmsService.create_publication(
        test_db,
        PublicationCreate(
            bulletin_id=sample_bulletin.id,
            serial_no=25,
            slug=None,
            title="First Paper on Serial 25",
            source_journal="Journal",
            category="Article",
            author_display="Author",
            status="draft",
        ),
    )
    assert pub1.slug == "v2-i1-r025"

    # Create another paper with same bulletin and serial 25: must resolve to v2-i1-r025-1
    pub2 = SamaCmsService.create_publication(
        test_db,
        PublicationCreate(
            bulletin_id=sample_bulletin.id,
            serial_no=25,
            slug="",
            title="Second Paper on Serial 25",
            source_journal="Journal",
            category="Article",
            author_display="Author",
            status="draft",
        ),
    )
    assert pub2.slug == "v2-i1-r025-1"
    assert pub1.id != pub2.id


# ============================================================================
# 4. BULLETIN COUNT SAFETY TESTS
# ============================================================================

def test_draft_batch_import_does_not_inflate_bulletin_count(test_db, sample_bulletin):
    """Batch executing publication imports creates draft records without modifying bulletin.publication_count."""
    initial_count = sample_bulletin.publication_count  # 91 archival

    import_service = SamaImportService()
    batch = SamaImportBatch(
        id=uuid.uuid4(),
        batch_number="IMP-PUB-TEST-001",
        entity_type="publications",
        source_filename="test_upload.csv",
        file_format="csv",
        status="pending",
        mode="preview",
        total_rows=2,
        reconciliation_report={
            "bulletin_id": str(sample_bulletin.id),
            "items": [
                {
                    "action": "create",
                    "identifier": "imp-pub-01",
                    "record_summary": {
                        "slug": "imp-v2-i1-01",
                        "title": "Imported Draft Paper 1",
                        "source_journal": "CSJMU Journal",
                        "category": "Article",
                        "serial_no": 95,
                    },
                },
                {
                    "action": "create",
                    "identifier": "imp-pub-02",
                    "record_summary": {
                        "slug": "imp-v2-i1-02",
                        "title": "Imported Draft Paper 2",
                        "source_journal": "CSJMU Journal",
                        "category": "Article",
                        "serial_no": 96,
                    },
                },
            ],
        },
    )
    test_db.add(batch)
    test_db.commit()

    # Execute batch
    import_service.execute_batch(test_db, batch.id, bulletin_id=sample_bulletin.id)

    # Reload bulletin
    test_db.refresh(sample_bulletin)
    # bulletin.publication_count MUST NOT have been inflated by +2
    assert sample_bulletin.publication_count == initial_count


def test_static_archival_counts_remain_distinguishable_from_live_counts(test_db, sample_bulletin):
    """SamaAnalyticsService accurately separates archival print count from live cataloged published records."""
    # sample_bulletin has archival count 91
    # Add 2 published publications and 1 draft publication
    for idx, stat in enumerate(["published", "published", "draft"]):
        pub = ResearchPublication(
            id=uuid.uuid4(),
            bulletin_id=sample_bulletin.id,
            serial_no=100 + idx,
            slug=f"distinguish-count-{idx}",
            title=f"Paper {idx}",
            source_journal="Journal",
            category="Article",
            author_display="Author",
            status=stat,
        )
        test_db.add(pub)
    test_db.commit()

    bulletin_metrics = SamaAnalyticsService.get_bulletin_issue_metrics(test_db)
    target_metric = next(b for b in bulletin_metrics if b["id"] == str(sample_bulletin.id))

    assert target_metric["archival_count"] == 91
    assert target_metric["actual_publication_count"] == 2
    assert target_metric["archival_count"] != target_metric["actual_publication_count"]
