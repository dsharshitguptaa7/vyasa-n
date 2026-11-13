"""
Database-Free Model and Migration Integrity Tests for ANUDAAN (Yajur Veda).
Tests all 10 Anudaan database entities, constraints, relationships, encryption,
and migration integrity completely in-memory with zero external database dependencies.
"""
import importlib
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
import uuid
import pytest
from sqlalchemy import CheckConstraint, Index, UniqueConstraint

from app.models.base import Base
from app.modules.yajur_veda.models import (
    AnudaanApplicantCategory,
    AnudaanApplicationStatus,
    AnudaanDocumentType,
    AnudaanPublicationStatus,
    AnudaanIndexingType,
    AnudaanQuartile,
    AnudaanAuthorRole,
    AnudaanBankAccountType,
    AnudaanBankOwnershipStatus,
    AnudaanDocumentCategory,
    AnudaanVerificationType,
    AnudaanVerificationStatus,
    normalize_doi,
    encrypt_banking_field,
    decrypt_banking_field,
    extract_last4,
    mask_account_number,
    AnudaanApplication,
    AnudaanPerson,
    AnudaanPublication,
    AnudaanBankAccount,
    AnudaanBankAccountHolder,
    AnudaanPublicationAuthor,
    AnudaanDocument,
    AnudaanDeclaration,
    AnudaanAnnualLimitPolicy,
    AnudaanVerification,
    AnudaanDisbursement,
    AnudaanGalleryItem,
    AnudaanGalleryImage,
    AnudaanPublicConfig,
    AnudaanSanctionEntry,
    AnudaanFelicitationCycle,
)


EXPECTED_ANUDAAN_TABLES = [
    "yajur_anudaan_applications",
    "yajur_anudaan_people",
    "yajur_anudaan_publications",
    "yajur_anudaan_bank_accounts",
    "yajur_anudaan_bank_account_holders",
    "yajur_anudaan_publication_authors",
    "yajur_anudaan_documents",
    "yajur_anudaan_declarations",
    "yajur_anudaan_annual_limit_policies",
    "yajur_anudaan_verifications",
    "yajur_anudaan_disbursements",
    "yajur_anudaan_gallery_items",
    "yajur_anudaan_gallery_images",
    "yajur_anudaan_public_config",
    "yajur_anudaan_sanction_entries",
    "yajur_anudaan_felicitation_cycles",
]


# =============================================================================
# 1. Table Registration & Metadata Inspection Tests
# =============================================================================

@pytest.mark.parametrize("table_name", EXPECTED_ANUDAAN_TABLES)
def test_anudaan_tables_registered_in_metadata(table_name):
    """Verifies that all ANUDAAN tables are registered in Base.metadata."""
    assert table_name in Base.metadata.tables, f"Table '{table_name}' was not found in Base.metadata"


def test_anudaan_table_count():
    """Verifies exactly 16 tables exist under yajur_anudaan_ prefix."""
    registered = [t for t in Base.metadata.tables.keys() if t.startswith("yajur_anudaan_")]
    assert len(registered) == 16
    assert set(registered) == set(EXPECTED_ANUDAAN_TABLES)


# =============================================================================
# 2. AnudaanApplication Model & Defaults Tests
# =============================================================================

def test_anudaan_application_schema():
    """Verifies application columns, default status, and relationship definitions."""
    table = AnudaanApplication.__table__
    assert table.c.id.primary_key is True
    assert table.c.application_number.nullable is False
    assert table.c.applicant_category.nullable is False
    assert table.c.full_name.nullable is False
    assert table.c.institutional_id.nullable is False
    assert table.c.designation.nullable is False
    assert table.c.department_name.nullable is False
    assert table.c.status.server_default.arg == "SUBMITTED"

    app = AnudaanApplication(
        application_number="ANU-2026-00001",
        applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
        full_name="Prof. Rajesh Sharma",
        institutional_id="EMP-CSJMU-1042",
        designation="Professor",
        department_name="Department of Computer Science",
        mobile_number="9876543210",
    )
    assert app.application_number == "ANU-2026-00001"
    assert app.applicant_category == AnudaanApplicantCategory.FACULTY_CAMPUS
    assert hasattr(app, "publications")
    assert hasattr(app, "documents")
    assert hasattr(app, "declarations")
    assert hasattr(app, "verifications")


# =============================================================================
# 3. Dynamic Multi-Publication Intake Tests
# =============================================================================

def test_multiple_publications_per_application():
    """Verifies applications support dynamically adding N publications without 12 cap."""
    app = AnudaanApplication(
        application_number="ANU-2026-00002",
        applicant_category=AnudaanApplicantCategory.SCHOLAR_CAMPUS,
        full_name="Ananya Mishra",
        institutional_id="PHD-CSJMU-2024-08",
        designation="Research Scholar",
        department_name="Institute of Biosciences",
        supervisor_name="Dr. Alok Verma",
        mobile_number="9876543211",
    )

    # Attach 15 publications dynamically
    for i in range(1, 16):
        pub = AnudaanPublication(
            publication_date=date(2026, 2, i),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_status=AnudaanPublicationStatus.PUBLISHED,
            indexing_type=AnudaanIndexingType.SCOPUS,
            paper_title=f"Advanced Biomolecular Analysis Part {i}",
            journal_name="Journal of Biological Chemistry",
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
        )
        app.publications.append(pub)

    assert len(app.publications) == 15
    assert app.publications[14].paper_title == "Advanced Biomolecular Analysis Part 15"


# =============================================================================
# 4. Distinct Identities: Applicant, First Author, Corresponding Author
# =============================================================================

def test_distinct_applicant_and_author_identities():
    """Verifies Applicant, First Author, and Corresponding Author are distinct entities."""
    applicant_name = "Prof. Arun Gupta"
    first_author_person = AnudaanPerson(
        full_name="Dr. Sneha Verma",
        scopus_author_id="57200112233",
        employee_or_registration_id="PDF-2026-01",
    )
    corresponding_author_person = AnudaanPerson(
        full_name="Prof. Vikramaditya Singh",
        scopus_author_id="57100998877",
        employee_or_registration_id="EMP-CSJMU-098",
    )

    pub = AnudaanPublication(
        publication_date=date(2026, 3, 1),
        document_type=AnudaanDocumentType.ARTICLE,
        publication_status=AnudaanPublicationStatus.PUBLISHED,
        indexing_type=AnudaanIndexingType.SCOPUS_AND_WOS,
        paper_title="Computational Modeling of Fluid Dynamics",
        journal_name="Physics of Fluids",
        publication_year=2026,
        applicant_declared_quartile=AnudaanQuartile.Q1,
    )

    # First Author assignment
    first_author_link = AnudaanPublicationAuthor(
        person=first_author_person,
        author_role=AnudaanAuthorRole.FIRST,
        author_order=1,
        is_csjmu_affiliated=True,
    )
    # Corresponding Author assignment
    corr_author_link = AnudaanPublicationAuthor(
        person=corresponding_author_person,
        author_role=AnudaanAuthorRole.CORRESPONDING,
        author_order=2,
        is_nominated_corresponding_author=True,
        is_csjmu_affiliated=True,
    )

    pub.authors.append(first_author_link)
    pub.authors.append(corr_author_link)

    assert applicant_name != first_author_person.full_name
    assert first_author_person.full_name != corresponding_author_person.full_name
    assert pub.authors[0].person.full_name == "Dr. Sneha Verma"
    assert pub.authors[1].person.full_name == "Prof. Vikramaditya Singh"


# =============================================================================
# 5. Author Role Constraints: One First Author & Single Nominated Corresp.
# =============================================================================

def test_publication_author_partial_unique_indexes():
    """Verifies partial unique indexes for single 1st author & single nominated corresponding author."""
    table = AnudaanPublicationAuthor.__table__
    indexes = {idx.name: idx for idx in table.indexes}

    # 1. First author partial index
    assert "uq_anudaan_pub_first_author" in indexes
    first_idx = indexes["uq_anudaan_pub_first_author"]
    assert first_idx.unique is True
    assert "FIRST" in str(first_idx.dialect_options["postgresql"]["where"])

    # 2. Nominated corresponding author partial index
    assert "uq_anudaan_pub_nominated_corr_author" in indexes
    corr_idx = indexes["uq_anudaan_pub_nominated_corr_author"]
    assert corr_idx.unique is True
    assert "is_nominated_corresponding_author" in str(corr_idx.dialect_options["postgresql"]["where"])


def test_co_author_non_payable_check_constraint():
    """Verifies that co-authors cannot have a bank account attached."""
    table = AnudaanPublicationAuthor.__table__
    check_constraints = [c for c in table.constraints if isinstance(c, CheckConstraint)]
    constraint_names = {c.name for c in check_constraints}
    assert "ck_anudaan_coauthor_no_bank" in constraint_names


# =============================================================================
# 6. Multiple Corresponding Authors with Single Nominated Author
# =============================================================================

def test_multiple_corresponding_authors_single_nomination():
    """Verifies publication can flag multiple corresponding authors with only one nominated."""
    p1 = AnudaanPerson(full_name="Dr. First Corresp")
    p2 = AnudaanPerson(full_name="Dr. Second Corresp")

    author1 = AnudaanPublicationAuthor(
        person=p1,
        author_role=AnudaanAuthorRole.CORRESPONDING,
        has_multiple_corresponding_authors=True,
        is_nominated_corresponding_author=True,
    )
    author2 = AnudaanPublicationAuthor(
        person=p2,
        author_role=AnudaanAuthorRole.CORRESPONDING,
        has_multiple_corresponding_authors=True,
        is_nominated_corresponding_author=False,  # Not nominated for payment
    )

    assert author1.has_multiple_corresponding_authors is True
    assert author2.has_multiple_corresponding_authors is True
    assert author1.is_nominated_corresponding_author is True
    assert author2.is_nominated_corresponding_author is False


# =============================================================================
# 7. Bank Details Reuse Mechanism & Ownership Ledger
# =============================================================================

def test_independent_bank_reuse_selection():
    """Verifies separate bank reuse choices for first author and corresponding author."""
    auth_first = AnudaanPublicationAuthor(
        author_role=AnudaanAuthorRole.FIRST,
        bank_reuse_selected=True,  # Reusing previously validated bank account
    )
    auth_corr = AnudaanPublicationAuthor(
        author_role=AnudaanAuthorRole.CORRESPONDING,
        bank_reuse_selected=False,  # Entering new bank details
    )
    assert auth_first.bank_reuse_selected is True
    assert auth_corr.bank_reuse_selected is False


def test_bank_account_explicit_ownership_association():
    """Verifies bank accounts are linked to owners only via verified AnudaanBankAccountHolder."""
    table = AnudaanBankAccountHolder.__table__
    unique_constraints = [c for c in table.constraints if isinstance(c, UniqueConstraint)]
    assert any(c.name == "uq_anudaan_person_bank_account" for c in unique_constraints)

    person = AnudaanPerson(full_name="Prof. Vinod Mishra")
    bank = AnudaanBankAccount(
        account_holder_name="Prof. Vinod Mishra",
        bank_name="State Bank of India",
        ifsc_code="SBIN0001234",
        branch_name="CSJMU Campus Branch",
    )
    bank.set_account_number("123456789012")

    holder_link = AnudaanBankAccountHolder(
        person=person,
        bank_account=bank,
        ownership_verification_status=AnudaanBankOwnershipStatus.VERIFIED,
    )
    assert holder_link.person.full_name == "Prof. Vinod Mishra"
    assert holder_link.ownership_verification_status == AnudaanBankOwnershipStatus.VERIFIED


# =============================================================================
# 8. Banking Encryption, Masking & No Plaintext Storage
# =============================================================================

def test_bank_account_encryption_and_masking():
    """Verifies AES encryption on account numbers and PAN with separate last4 storage."""
    bank = AnudaanBankAccount(
        account_holder_name="Dr. Meera Nambiar",
        bank_name="Bank of Baroda",
        ifsc_code="BARB0CSJMUX",
        branch_name="Kanpur Main",
        account_type=AnudaanBankAccountType.SAVINGS,
    )
    plain_acc = "98765432109876"
    plain_pan = "ABCDE1234F"

    bank.set_account_number(plain_acc)
    bank.set_pan(plain_pan)

    # 1. Plaintext must NOT appear in encrypted attributes
    assert plain_acc not in bank.account_number_encrypted
    assert plain_pan not in bank.pan_number_encrypted
    assert bank.account_number_last4 == "9876"

    # 2. Masking helper
    masked = mask_account_number(bank.account_number_last4)
    assert masked == "••••••••9876"

    # 3. Authorized decryption
    assert bank.get_decrypted_account_number() == plain_acc
    assert bank.get_decrypted_pan() == plain_pan


def test_bank_account_check_constraints():
    """Verifies IFSC length 11 and last4 length 4 check constraints."""
    table = AnudaanBankAccount.__table__
    constraint_names = {c.name for c in table.constraints if isinstance(c, CheckConstraint)}
    assert "ck_anudaan_ifsc_length" in constraint_names
    assert "ck_anudaan_last4_length" in constraint_names


# =============================================================================
# 9. Declarations & Snapshots
# =============================================================================

def test_anudaan_declaration_snapshot():
    """Verifies declaration records preserve legal text and version snapshot."""
    text_snapshot = "I hereby declare that this publication is original and CSJMU affiliated."
    decl = AnudaanDeclaration(
        declaration_type="ORIGINALITY_AND_AFFILIATION",
        accepted=True,
        accepted_at=datetime.now(timezone.utc),
        accepted_by_identifier="Prof. Rajesh Sharma",
        declaration_version="1.1",
        declaration_text_snapshot=text_snapshot,
    )
    assert decl.accepted is True
    assert decl.declaration_version == "1.1"
    assert decl.declaration_text_snapshot == text_snapshot


# =============================================================================
# 10. Annual Limit Policy Configurability (Unconfirmed Policy Invariant)
# =============================================================================

def test_annual_limit_policy_configurability():
    """Verifies annual policy limits default to inactive pending official university notification."""
    table = AnudaanAnnualLimitPolicy.__table__
    assert table.c.is_active.default.arg is False
    assert table.c.is_active.nullable is False

    policy = AnudaanAnnualLimitPolicy(
        academic_or_calendar_year="2026",
        quartile=AnudaanQuartile.Q1,
        maximum_claims=6,
        counting_basis="CALENDAR_YEAR",
        effective_from=date(2026, 1, 1),
        is_active=False,
    )
    assert policy.maximum_claims == 6
    assert policy.is_active is False  # Inactive by default per unconfirmed policy decision
    assert policy.academic_or_calendar_year == "2026"


# =============================================================================
# 11. JCI = 1.0 Unresolved Boundary
# =============================================================================

def test_jci_value_preservation_without_auto_coercion():
    """Verifies JCI = 1.0 is preserved as decimal without automatically assigning Q3 or Q4."""
    pub = AnudaanPublication(
        publication_date=date(2026, 1, 15),
        document_type=AnudaanDocumentType.ARTICLE,
        publication_status=AnudaanPublicationStatus.PUBLISHED,
        indexing_type=AnudaanIndexingType.WEB_OF_SCIENCE,
        paper_title="Complex Systems Analysis",
        journal_name="Applied Mathematics Journal",
        publication_year=2026,
        applicant_declared_quartile=AnudaanQuartile.UNASSIGNED,
        jci_value=Decimal("1.000"),
    )
    assert pub.jci_value == Decimal("1.000")
    # Verified quartile remains None until human/adjudicated review
    assert pub.verified_quartile is None


# =============================================================================
# 12. DOI Normalization & Duplicate Lookup
# =============================================================================

def test_doi_normalization_utility():
    """Verifies DOI normalization strips URL prefixes, protocols, and casing."""
    assert normalize_doi("https://doi.org/10.1016/j.jbusres.2025.115123") == "10.1016/j.jbusres.2025.115123"
    assert normalize_doi("HTTP://DX.DOI.ORG/10.1016/j.jbusres.2025.115123") == "10.1016/j.jbusres.2025.115123"
    assert normalize_doi("doi: 10.1016/j.jbusres.2025.115123") == "10.1016/j.jbusres.2025.115123"
    assert normalize_doi("  10.1016/J.JBUSRES.2025.115123  ") == "10.1016/j.jbusres.2025.115123"
    assert normalize_doi(None) is None


def test_publication_set_doi_synchronization():
    """Verifies AnudaanPublication.set_doi() populates normalized_doi."""
    pub = AnudaanPublication(
        publication_date=date(2026, 1, 10),
        document_type=AnudaanDocumentType.ARTICLE,
        publication_status=AnudaanPublicationStatus.PUBLISHED,
        indexing_type=AnudaanIndexingType.SCOPUS,
        paper_title="Machine Learning in Healthcare",
        journal_name="Computers in Biology and Medicine",
        publication_year=2026,
        applicant_declared_quartile=AnudaanQuartile.Q1,
    )
    pub.set_doi("https://doi.org/10.1016/j.cbm.2026.109999")
    assert pub.doi == "https://doi.org/10.1016/j.cbm.2026.109999"
    assert pub.normalized_doi == "10.1016/j.cbm.2026.109999"


# =============================================================================
# 13. Document Metadata & 10MB File Size Constraint
# =============================================================================

def test_document_size_ceiling_constraint():
    """Verifies that documents have a strict 10MB check constraint."""
    table = AnudaanDocument.__table__
    constraint_names = {c.name for c in table.constraints if isinstance(c, CheckConstraint)}
    assert "ck_anudaan_doc_size_limit" in constraint_names


# =============================================================================
# 14. Verification History Preservation
# =============================================================================

def test_verification_history_ledger():
    """Verifies multi-step verification records can be accumulated without overwriting."""
    app = AnudaanApplication(
        application_number="ANU-2026-00003",
        applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
        full_name="Dr. Kavita Srivastava",
        institutional_id="EMP-CSJMU-205",
        designation="Associate Professor",
        department_name="Department of Chemistry",
        mobile_number="9876543212",
    )

    verif1 = AnudaanVerification(
        verification_type=AnudaanVerificationType.AFFILIATION_CHECK,
        verification_status=AnudaanVerificationStatus.VERIFIED,
        verification_source="DEAN_MANUAL",
        remarks="CSJMU affiliation explicitly verified on author byline.",
    )
    verif2 = AnudaanVerification(
        verification_type=AnudaanVerificationType.QUARTILE_VERIFICATION,
        verification_status=AnudaanVerificationStatus.VERIFIED,
        verification_source="CLARIVATE_JCR_2025",
        remarks="Verified Q1 tier in Clarivate JCR 2025 index.",
    )

    app.verifications.append(verif1)
    app.verifications.append(verif2)

    assert len(app.verifications) == 2
    assert app.verifications[0].verification_type == AnudaanVerificationType.AFFILIATION_CHECK
    assert app.verifications[1].verification_type == AnudaanVerificationType.QUARTILE_VERIFICATION


# =============================================================================
# 15. Alembic Migration Script Contract & Revision Graph
# =============================================================================

def test_anudaan_alembic_migration_metadata():
    """Verifies the Alembic migration script revision, down_revision, and structure."""
    migration_path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "8b29c54e1019_anudaan_database_architecture.py"
    assert migration_path.exists(), f"Migration file {migration_path} does not exist"

    spec = importlib.util.spec_from_file_location("anudaan_migration", str(migration_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert getattr(module, "revision", None) == "8b29c54e1019"
    assert getattr(module, "down_revision", None) == "8b29c54e1018"
    assert hasattr(module, "upgrade") and callable(module.upgrade)
    assert hasattr(module, "downgrade") and callable(module.downgrade)


# =============================================================================
# 16. AnudaanSanctionEntry Model & Migration 8b29c54e1022 Tests
# =============================================================================

def test_anudaan_sanction_entry_schema():
    """Verifies AnudaanSanctionEntry columns, non-negative amount constraint, and indexes."""
    table = AnudaanSanctionEntry.__table__
    assert table.c.id.primary_key is True
    assert table.c.researcher_name.nullable is False
    assert table.c.department_name.nullable is True
    assert table.c.project_title.nullable is True
    assert table.c.felicitation_cycle_id.nullable is True
    assert table.c.publication_title.nullable is False
    assert table.c.publication_doi.nullable is True
    assert table.c.quartile.nullable is False
    assert table.c.sanctioned_amount.nullable is False
    assert table.c.academic_year.nullable is False
    assert table.c.sanction_date.nullable is False
    assert table.c.is_published.nullable is False

    # Check non-negative constraint
    ck_names = [ck.name for ck in table.constraints if hasattr(ck, "name")]
    assert "ck_anudaan_sanction_amount_non_negative" in ck_names


def test_anudaan_felicitation_cycle_schema():
    """Verifies AnudaanFelicitationCycle columns, volume/issue constraints, and status."""
    table = AnudaanFelicitationCycle.__table__
    assert table.c.id.primary_key is True
    assert table.c.volume_number.nullable is False
    assert table.c.issue_number.nullable is False
    assert table.c.display_title.nullable is True
    assert table.c.status.nullable is False
    assert table.c.felicitation_date.nullable is True
    assert table.c.academic_year.nullable is True
    assert table.c.description.nullable is True
    assert table.c.is_published.nullable is False
    assert table.c.is_archived.nullable is False

    ck_names = [ck.name for ck in table.constraints if hasattr(ck, "name")]
    assert "ck_anudaan_cycle_vol_issue_pos" in ck_names
    assert "ck_anudaan_cycle_status" in ck_names

    uq_names = [uq.name for uq in table.constraints if hasattr(uq, "name") and isinstance(uq, UniqueConstraint)]
    assert "uq_anudaan_cycle_volume_issue" in uq_names


def test_anudaan_sanction_migration_metadata():
    """Verifies the Alembic migration scripts 8b29c54e1022 and 8b29c54e1023."""
    migration_path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "8b29c54e1022_anudaan_sanction_register.py"
    assert migration_path.exists(), f"Migration file {migration_path} does not exist"

    spec = importlib.util.spec_from_file_location("sanction_migration", str(migration_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert getattr(module, "revision", None) == "8b29c54e1022"

    cycle_migration_path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "8b29c54e1023_anudaan_felicitation_cycles.py"
    assert cycle_migration_path.exists(), f"Migration file {cycle_migration_path} does not exist"

    spec2 = importlib.util.spec_from_file_location("cycle_migration", str(cycle_migration_path))
    module2 = importlib.util.module_from_spec(spec2)
    spec2.loader.exec_module(module2)

    assert getattr(module2, "revision", None) == "8b29c54e1023"
    assert getattr(module2, "down_revision", None) == "8b29c54e1022"
    assert getattr(module, "down_revision", None) == "8b29c54e1021"

