"""anudaan_database_architecture

Revision ID: 8b29c54e1019
Revises: 8b29c54e1018
Create Date: 2026-11-08 14:40:00.000000+00:00

Establishes the foundational database architecture for the ANUDAAN module
(Research Publication Incentive Management System) under 2nd Pillar – Yajur Veda:
1. Creates PostgreSQL Enums for applicant categories, application stages,
   document types, publication statuses, indexing types, quartiles, author roles,
   bank account types, ownership verification statuses, and verification steps.
2. Creates yajur_anudaan_applications (Root researcher submissions).
3. Creates yajur_anudaan_people (Normalized researcher/author identity ledger).
4. Creates yajur_anudaan_publications (Dynamic N publications per application).
5. Creates yajur_anudaan_bank_accounts (Encrypted bank details repository).
6. Creates yajur_anudaan_bank_account_holders (Explicit person-to-account verification).
7. Creates yajur_anudaan_publication_authors (Author attribution with single 1st author & single nominated corresponding author partial unique constraints).
8. Creates yajur_anudaan_documents (Document storage reference ledger with 10MB limit).
9. Creates yajur_anudaan_declarations (Legal/authenticity agreement snapshots).
10. Creates yajur_anudaan_annual_limit_policies (Configurable annual quartile caps).
11. Creates yajur_anudaan_verifications (Preserved multi-step verification audit ledger).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1019'
down_revision: Union[str, None] = '8b29c54e1018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Create Enums idempotently in PostgreSQL
    # -------------------------------------------------------------------------
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_applicant_category') THEN
                CREATE TYPE anudaan_applicant_category AS ENUM ('FACULTY_CAMPUS', 'SCHOLAR_CAMPUS', 'POSTDOC_CAMPUS');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_application_status') THEN
                CREATE TYPE anudaan_application_status AS ENUM (
                    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION',
                    'ACCEPTED', 'REJECTED', 'APPROVED_FOR_RELEASE', 'RELEASED',
                    'PROCESSING', 'CREDITED'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_document_type') THEN
                CREATE TYPE anudaan_document_type AS ENUM ('ARTICLE', 'REVIEW');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_publication_status') THEN
                CREATE TYPE anudaan_publication_status AS ENUM ('PUBLISHED', 'ACCEPTED', 'IN_PRESS', 'PREPRINT');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_indexing_type') THEN
                CREATE TYPE anudaan_indexing_type AS ENUM ('SCOPUS', 'WEB_OF_SCIENCE', 'SCOPUS_AND_WOS');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_quartile') THEN
                CREATE TYPE anudaan_quartile AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'UNASSIGNED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_author_role') THEN
                CREATE TYPE anudaan_author_role AS ENUM ('FIRST', 'CORRESPONDING', 'CO_AUTHOR');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_bank_account_type') THEN
                CREATE TYPE anudaan_bank_account_type AS ENUM ('SAVINGS', 'CURRENT');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_bank_ownership_status') THEN
                CREATE TYPE anudaan_bank_ownership_status AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_document_category') THEN
                CREATE TYPE anudaan_document_category AS ENUM ('PUBLISHED_PAPER', 'CANCELLED_CHEQUE', 'PASSBOOK', 'OTHER');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_verification_type') THEN
                CREATE TYPE anudaan_verification_type AS ENUM (
                    'AFFILIATION_CHECK', 'QUARTILE_VERIFICATION', 'BANK_ACCOUNT_VERIFICATION',
                    'SCOPUS_VALIDATION', 'DEAN_APPROVAL', 'MANUAL_CHECK'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anudaan_verification_status') THEN
                CREATE TYPE anudaan_verification_status AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED');
            END IF;
        END $$;
    """)

    applicant_cat_enum = postgresql.ENUM('FACULTY_CAMPUS', 'SCHOLAR_CAMPUS', 'POSTDOC_CAMPUS', name='anudaan_applicant_category', create_type=False)
    app_status_enum = postgresql.ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION', 'ACCEPTED', 'REJECTED', 'APPROVED_FOR_RELEASE', 'RELEASED', 'PROCESSING', 'CREDITED', name='anudaan_application_status', create_type=False)
    doc_type_enum = postgresql.ENUM('ARTICLE', 'REVIEW', name='anudaan_document_type', create_type=False)
    pub_status_enum = postgresql.ENUM('PUBLISHED', 'ACCEPTED', 'IN_PRESS', 'PREPRINT', name='anudaan_publication_status', create_type=False)
    idx_type_enum = postgresql.ENUM('SCOPUS', 'WEB_OF_SCIENCE', 'SCOPUS_AND_WOS', name='anudaan_indexing_type', create_type=False)
    quartile_enum = postgresql.ENUM('Q1', 'Q2', 'Q3', 'Q4', 'UNASSIGNED', name='anudaan_quartile', create_type=False)
    author_role_enum = postgresql.ENUM('FIRST', 'CORRESPONDING', 'CO_AUTHOR', name='anudaan_author_role', create_type=False)
    bank_type_enum = postgresql.ENUM('SAVINGS', 'CURRENT', name='anudaan_bank_account_type', create_type=False)
    ownership_status_enum = postgresql.ENUM('UNVERIFIED', 'VERIFIED', 'REJECTED', name='anudaan_bank_ownership_status', create_type=False)
    doc_cat_enum = postgresql.ENUM('PUBLISHED_PAPER', 'CANCELLED_CHEQUE', 'PASSBOOK', 'OTHER', name='anudaan_document_category', create_type=False)
    verif_type_enum = postgresql.ENUM('AFFILIATION_CHECK', 'QUARTILE_VERIFICATION', 'BANK_ACCOUNT_VERIFICATION', 'SCOPUS_VALIDATION', 'DEAN_APPROVAL', 'MANUAL_CHECK', name='anudaan_verification_type', create_type=False)
    verif_status_enum = postgresql.ENUM('PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED', name='anudaan_verification_status', create_type=False)

    # -------------------------------------------------------------------------
    # 2. Table: yajur_anudaan_applications
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_applications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_number', sa.String(32), nullable=False),
        sa.Column('applicant_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('applicant_category', applicant_cat_enum, nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('institutional_id', sa.String(100), nullable=False),
        sa.Column('designation', sa.String(150), nullable=False),
        sa.Column('department_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('department_name', sa.String(255), nullable=False),
        sa.Column('supervisor_name', sa.String(255), nullable=True),
        sa.Column('mobile_number', sa.String(20), nullable=False),
        sa.Column('scopus_author_id', sa.String(50), nullable=True),
        sa.Column('scopus_profile_url', sa.String(500), nullable=True),
        sa.Column('status', app_status_enum, nullable=False, server_default='SUBMITTED'),
        sa.Column('form_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_anudaan_app_number', 'yajur_anudaan_applications', ['application_number'], unique=True)
    op.create_index('ix_anudaan_app_status', 'yajur_anudaan_applications', ['status'])
    op.create_index('ix_anudaan_app_applicant_user', 'yajur_anudaan_applications', ['applicant_user_id'])
    op.create_index('ix_anudaan_app_scopus', 'yajur_anudaan_applications', ['scopus_author_id'])
    op.create_index('ix_anudaan_app_submitted_at', 'yajur_anudaan_applications', ['submitted_at'])

    # -------------------------------------------------------------------------
    # 3. Table: yajur_anudaan_people
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_people',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('scopus_author_id', sa.String(50), nullable=True),
        sa.Column('scopus_profile_url', sa.String(500), nullable=True),
        sa.Column('mobile_number', sa.String(20), nullable=True),
        sa.Column('employee_or_registration_id', sa.String(100), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_anudaan_person_name', 'yajur_anudaan_people', ['full_name'])
    op.create_index('ix_anudaan_person_scopus', 'yajur_anudaan_people', ['scopus_author_id'])
    op.create_index('ix_anudaan_person_inst_id', 'yajur_anudaan_people', ['employee_or_registration_id'])
    op.create_index('ix_anudaan_person_user', 'yajur_anudaan_people', ['user_id'])

    # -------------------------------------------------------------------------
    # 4. Table: yajur_anudaan_publications
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_publications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_applications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('publication_date', sa.Date(), nullable=False),
        sa.Column('document_type', doc_type_enum, nullable=False),
        sa.Column('publication_status', pub_status_enum, nullable=False, server_default='PUBLISHED'),
        sa.Column('indexing_type', idx_type_enum, nullable=False),
        sa.Column('has_csjmu_affiliation', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('doi', sa.String(255), nullable=True),
        sa.Column('normalized_doi', sa.String(255), nullable=True),
        sa.Column('paper_title', sa.Text(), nullable=False),
        sa.Column('journal_name', sa.String(500), nullable=False),
        sa.Column('issn', sa.String(50), nullable=True),
        sa.Column('e_issn', sa.String(50), nullable=True),
        sa.Column('publication_year', sa.Integer(), nullable=False),
        sa.Column('volume', sa.String(50), nullable=True),
        sa.Column('issue', sa.String(50), nullable=True),
        sa.Column('page_details', sa.String(100), nullable=True),
        sa.Column('applicant_declared_quartile', quartile_enum, nullable=False),
        sa.Column('verified_quartile', quartile_enum, nullable=True),
        sa.Column('jci_value', sa.Numeric(6, 3), nullable=True),
        sa.Column('quartile_verification_source', sa.String(100), nullable=True),
        sa.Column('quartile_verification_remarks', sa.Text(), nullable=True),
        sa.Column('quartile_verified_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('quartile_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paper_document_storage_key', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('publication_year >= 2020', name='ck_anudaan_pub_year'),
        sa.CheckConstraint('jci_value IS NULL OR jci_value >= 0', name='ck_anudaan_pub_jci_non_negative'),
    )
    op.create_index('ix_anudaan_pub_app', 'yajur_anudaan_publications', ['application_id'])
    op.create_index('ix_anudaan_pub_norm_doi', 'yajur_anudaan_publications', ['normalized_doi'])
    op.create_index('ix_anudaan_pub_date', 'yajur_anudaan_publications', ['publication_date'])
    op.create_index('ix_anudaan_pub_quartile', 'yajur_anudaan_publications', ['applicant_declared_quartile'])
    op.create_index('ix_anudaan_pub_verified_quartile', 'yajur_anudaan_publications', ['verified_quartile'])

    # -------------------------------------------------------------------------
    # 5. Table: yajur_anudaan_bank_accounts
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_bank_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('account_holder_name', sa.String(255), nullable=False),
        sa.Column('bank_name', sa.String(255), nullable=False),
        sa.Column('account_number_encrypted', sa.Text(), nullable=False),
        sa.Column('account_number_last4', sa.String(4), nullable=False),
        sa.Column('ifsc_code', sa.String(11), nullable=False),
        sa.Column('branch_name', sa.String(255), nullable=False),
        sa.Column('account_type', bank_type_enum, nullable=False, server_default='SAVINGS'),
        sa.Column('pan_number_encrypted', sa.Text(), nullable=True),
        sa.Column('bank_mobile_number', sa.String(20), nullable=True),
        sa.Column('proof_document_storage_key', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('length(ifsc_code) = 11', name='ck_anudaan_ifsc_length'),
        sa.CheckConstraint('length(account_number_last4) = 4', name='ck_anudaan_last4_length'),
    )
    op.create_index('ix_anudaan_bank_holder_name', 'yajur_anudaan_bank_accounts', ['account_holder_name'])
    op.create_index('ix_anudaan_bank_ifsc', 'yajur_anudaan_bank_accounts', ['ifsc_code'])
    op.create_index('ix_anudaan_bank_last4', 'yajur_anudaan_bank_accounts', ['account_number_last4'])

    # -------------------------------------------------------------------------
    # 6. Table: yajur_anudaan_bank_account_holders
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_bank_account_holders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('person_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_people.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bank_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_bank_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ownership_verification_status', ownership_status_enum, nullable=False, server_default='UNVERIFIED'),
        sa.Column('ownership_verified_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('ownership_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('person_id', 'bank_account_id', name='uq_anudaan_person_bank_account'),
    )
    op.create_index('ix_anudaan_holder_person', 'yajur_anudaan_bank_account_holders', ['person_id'])
    op.create_index('ix_anudaan_holder_bank', 'yajur_anudaan_bank_account_holders', ['bank_account_id'])
    op.create_index('ix_anudaan_holder_status', 'yajur_anudaan_bank_account_holders', ['ownership_verification_status'])

    # -------------------------------------------------------------------------
    # 7. Table: yajur_anudaan_publication_authors
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_publication_authors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('publication_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_publications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('person_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_people.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('author_role', author_role_enum, nullable=False),
        sa.Column('author_order', sa.Integer(), nullable=True),
        sa.Column('is_csjmu_affiliated', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('has_multiple_corresponding_authors', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_nominated_corresponding_author', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('bank_reuse_selected', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('bank_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_bank_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('author_order IS NULL OR author_order > 0', name='ck_anudaan_author_order_positive'),
        sa.CheckConstraint("author_role != 'CO_AUTHOR' OR bank_account_id IS NULL", name='ck_anudaan_coauthor_no_bank'),
    )
    op.create_index('ix_anudaan_author_pub', 'yajur_anudaan_publication_authors', ['publication_id'])
    op.create_index('ix_anudaan_author_person', 'yajur_anudaan_publication_authors', ['person_id'])
    op.create_index('ix_anudaan_author_bank', 'yajur_anudaan_publication_authors', ['bank_account_id'])

    # Partial unique index 1: Only one FIRST author assignment per publication
    op.create_index(
        'uq_anudaan_pub_first_author',
        'yajur_anudaan_publication_authors',
        ['publication_id'],
        unique=True,
        postgresql_where=sa.text("author_role = 'FIRST'"),
    )
    # Partial unique index 2: Only one nominated corresponding author per publication
    op.create_index(
        'uq_anudaan_pub_nominated_corr_author',
        'yajur_anudaan_publication_authors',
        ['publication_id'],
        unique=True,
        postgresql_where=sa.text("is_nominated_corresponding_author = true"),
    )

    # -------------------------------------------------------------------------
    # 8. Table: yajur_anudaan_documents
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_applications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('publication_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_publications.id', ondelete='CASCADE'), nullable=True),
        sa.Column('person_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_people.id', ondelete='SET NULL'), nullable=True),
        sa.Column('document_type', doc_cat_enum, nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('storage_key', sa.String(500), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('uploaded_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('file_size_bytes > 0 AND file_size_bytes <= 10485760', name='ck_anudaan_doc_size_limit'),
    )
    op.create_index('ix_anudaan_doc_app', 'yajur_anudaan_documents', ['application_id'])
    op.create_index('ix_anudaan_doc_pub', 'yajur_anudaan_documents', ['publication_id'])
    op.create_index('ix_anudaan_doc_person', 'yajur_anudaan_documents', ['person_id'])
    op.create_index('ix_anudaan_doc_type', 'yajur_anudaan_documents', ['document_type'])

    # -------------------------------------------------------------------------
    # 9. Table: yajur_anudaan_declarations
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_declarations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_applications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('declaration_type', sa.String(100), nullable=False),
        sa.Column('accepted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('accepted_by_identifier', sa.String(255), nullable=True),
        sa.Column('declaration_version', sa.String(20), nullable=False, server_default='1.0'),
        sa.Column('declaration_text_snapshot', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_anudaan_decl_app', 'yajur_anudaan_declarations', ['application_id'])
    op.create_index('ix_anudaan_decl_type', 'yajur_anudaan_declarations', ['declaration_type'])

    # -------------------------------------------------------------------------
    # 10. Table: yajur_anudaan_annual_limit_policies
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_annual_limit_policies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('academic_or_calendar_year', sa.String(20), nullable=False),
        sa.Column('quartile', quartile_enum, nullable=False),
        sa.Column('maximum_claims', sa.Integer(), nullable=False),
        sa.Column('counting_basis', sa.String(50), nullable=True),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('effective_until', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('policy_reference', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('academic_or_calendar_year', 'quartile', name='uq_anudaan_policy_year_quartile'),
        sa.CheckConstraint('maximum_claims >= 0', name='ck_anudaan_policy_max_claims_non_negative'),
    )
    op.create_index('ix_anudaan_policy_year', 'yajur_anudaan_annual_limit_policies', ['academic_or_calendar_year'])
    op.create_index('ix_anudaan_policy_active', 'yajur_anudaan_annual_limit_policies', ['is_active'])

    # -------------------------------------------------------------------------
    # 11. Table: yajur_anudaan_verifications
    # -------------------------------------------------------------------------
    op.create_table(
        'yajur_anudaan_verifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_applications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('publication_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('yajur_anudaan_publications.id', ondelete='CASCADE'), nullable=True),
        sa.Column('verification_type', verif_type_enum, nullable=False),
        sa.Column('verification_status', verif_status_enum, nullable=False, server_default='PENDING'),
        sa.Column('verification_source', sa.String(100), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('verified_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_anudaan_verif_app', 'yajur_anudaan_verifications', ['application_id'])
    op.create_index('ix_anudaan_verif_pub', 'yajur_anudaan_verifications', ['publication_id'])
    op.create_index('ix_anudaan_verif_type', 'yajur_anudaan_verifications', ['verification_type'])
    op.create_index('ix_anudaan_verif_status', 'yajur_anudaan_verifications', ['verification_status'])
    op.create_index('ix_anudaan_verif_created_at', 'yajur_anudaan_verifications', ['created_at'])


def downgrade() -> None:
    # Drop tables in reverse topological dependency order
    op.drop_table('yajur_anudaan_verifications')
    op.drop_table('yajur_anudaan_annual_limit_policies')
    op.drop_table('yajur_anudaan_declarations')
    op.drop_table('yajur_anudaan_documents')
    op.drop_table('yajur_anudaan_publication_authors')
    op.drop_table('yajur_anudaan_bank_account_holders')
    op.drop_table('yajur_anudaan_bank_accounts')
    op.drop_table('yajur_anudaan_publications')
    op.drop_table('yajur_anudaan_people')
    op.drop_table('yajur_anudaan_applications')

    # Drop custom enum types idempotently
    op.execute("""
        DROP TYPE IF EXISTS anudaan_verification_status;
        DROP TYPE IF EXISTS anudaan_verification_type;
        DROP TYPE IF EXISTS anudaan_document_category;
        DROP TYPE IF EXISTS anudaan_bank_ownership_status;
        DROP TYPE IF EXISTS anudaan_bank_account_type;
        DROP TYPE IF EXISTS anudaan_author_role;
        DROP TYPE IF EXISTS anudaan_quartile;
        DROP TYPE IF EXISTS anudaan_indexing_type;
        DROP TYPE IF EXISTS anudaan_publication_status;
        DROP TYPE IF EXISTS anudaan_document_type;
        DROP TYPE IF EXISTS anudaan_application_status;
        DROP TYPE IF EXISTS anudaan_applicant_category;
    """)
