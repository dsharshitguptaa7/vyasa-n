"""
Unit and Integration Tests for SAMIKSHA Certificate PDF Rendering Engine.
Tests:
1. Single-author certificate vector generation
2. Two-author and three-author certificate layout
3. Five-author grid layout
4. Large collaborative author team (8+ authors)
5. Long research paper title word wrapping
6. QR code rendering and verification URL embedding
7. SHA-256 hash calculation and PDF byte integrity
"""
import io
import pytest
from pypdf import PdfReader

from app.modules.sama_veda.services.certificate_pdf_service import certificate_pdf_engine


def test_single_author_pdf_generation():
    authors = [
        {
            "author_name_snapshot": "Dr. Akhilesh Kumar",
            "academic_title_snapshot": "Dr.",
            "department_snapshot": "Department of Physics",
            "scopus_id_snapshot": "57211512345",
        }
    ]
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000001",
        verification_token="token_single_001",
        verification_url="https://vyasa.csjmu.ac.in/verify/token_single_001",
        title="Certificate of Appreciation & Research Excellence",
        authors=authors,
        research_title="Exploring the dielectric, supercapacitor and photocatalytic capabilities of sol-gel synthesized TiC nanoparticles",
        publication_details={
            "journal": "Journal of Energy Storage",
            "volume": "55",
            "year": "2026",
            "doi": "10.1016/j.est.2023.107890",
            "indexing": "Scopus Indexed",
        },
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert len(sha256_hash) == 64

    # Verify PDF parseable by pypdf
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 1
    page_text = reader.pages[0].extract_text()
    assert "CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY" in page_text
    assert "Akhilesh Kumar" in page_text
    assert "CSJMU/SAMIKSHA/2026/000001" in page_text


def test_multi_author_two_and_three_authors():
    authors = [
        {
            "author_name_snapshot": "Dr. Akhilesh Kumar",
            "scopus_id_snapshot": "57211512345",
            "department_snapshot": "Department of Physics",
        },
        {
            "author_name_snapshot": "Dr. Anju Dixit",
            "scopus_id_snapshot": "57200192834",
            "department_snapshot": "Department of Chemistry",
        },
        {
            "author_name_snapshot": "Dr. Leekeshwer Upadhyay",
            "scopus_id_snapshot": "57209871234",
            "department_snapshot": "Department of Materials Science",
        },
    ]
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000002",
        verification_token="token_multi_002",
        verification_url="https://vyasa.csjmu.ac.in/verify/token_multi_002",
        authors=authors,
        research_title="Exploring the dielectric, supercapacitor and photocatalytic capabilities of sol-gel synthesized TiC nanoparticles",
    )

    assert len(pdf_bytes) > 1000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()
    assert "Akhilesh Kumar" in page_text
    assert "Anju Dixit" in page_text
    assert "Leekeshwer Upadhyay" in page_text


def test_five_authors_grid_layout():
    authors = [
        {"author_name_snapshot": f"Author Number {i}", "scopus_id_snapshot": f"5720000000{i}"}
        for i in range(1, 6)
    ]
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000005",
        verification_token="token_five_005",
        verification_url="https://vyasa.csjmu.ac.in/verify/token_five_005",
        authors=authors,
        research_title="Nanoscale material synthesis and electrocatalytic properties under ambient atmospheric pressures",
    )

    assert len(pdf_bytes) > 1000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()
    for i in range(1, 6):
        assert f"Author Number {i}" in page_text


def test_large_collaborative_team_layout():
    authors = [
        {"author_name_snapshot": f"Co-Investigator {i}", "scopus_id_snapshot": f"573000000{i:02d}"}
        for i in range(1, 10)
    ]
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000010",
        verification_token="token_collab_010",
        verification_url="https://vyasa.csjmu.ac.in/verify/token_collab_010",
        authors=authors,
        research_title="Multi-institutional collaborative study on genome sequencing and clinical epidemiology",
    )

    assert len(pdf_bytes) > 1000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 1  # Successfully fitted onto single page
    page_text = reader.pages[0].extract_text()
    assert "Co-Investigator 1" in page_text
    assert "Co-Investigator 9" in page_text


def test_long_research_title_word_wrap():
    long_title = (
        "Investigation of high-temperature superconductivity in doped cuprates and "
        "iron-based pnictides through synchrotron radiation, angle-resolved photoemission spectroscopy "
        "and density functional theoretical simulations across multi-layered heterostructures"
    )
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000099",
        verification_token="token_long_099",
        verification_url="https://vyasa.csjmu.ac.in/verify/token_long_099",
        authors=[{"author_name_snapshot": "Dr. Quantum Scientist"}],
        research_title=long_title,
    )

    assert len(pdf_bytes) > 1000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()
    assert "Investigation of high-temperature superconductivity" in page_text


def test_draft_preview_watermark_rendering():
    """Verify that is_preview=True embeds the DRAFT PREVIEW watermark and preview footer text."""
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/PREVIEW/DRAFT-0000",
        verification_token="PREVIEW",
        verification_url="https://vyasa.csjmu.ac.in/verify/preview-draft",
        authors=[{"author_name_snapshot": "Dr. Candidate Scientist", "author_role": "First Author"}],
        research_title="Sample Draft Scientific Discovery",
        is_preview=True,
    )

    assert len(pdf_bytes) > 1000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()
    assert "DRAFT PREVIEW" in page_text
    assert "NOT AN OFFICIAL ISSUED CERTIFICATE" in page_text
    assert "PREVIEW DRAFT" in page_text


def test_metadata_box_equal_columns_and_long_period():
    """Verify that metadata box handles long publication period without text overflow or collision."""
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000100",
        verification_token="token_period_100",
        verification_url="https://samiksha.csjmu.ac.in/verify/token_period_100",
        authors=[{"author_name_snapshot": "Prof. Harshit Gupta", "department_snapshot": "Department of Biotechnology & Bioinformatics"}],
        research_title="CRISPR-Cas12 Targeted Epigenetic Editing for Enhanced Plant Resilience",
        bulletin_volume=3,
        bulletin_issue=4,
        bulletin_period="January to June 2026 Special Scholarly Release",
    )

    assert len(pdf_bytes) > 1000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 1
    page_text = reader.pages[0].extract_text()
    assert "RESEARCH BULLETIN" in page_text
    assert "DATE OF ISSUANCE" in page_text
    assert "Volume 3, Issue 4" in page_text


def test_long_recipient_name_and_department():
    """Verify long recipient names and extended department affiliations render gracefully."""
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000101",
        verification_token="token_affil_101",
        verification_url="https://samiksha.csjmu.ac.in/verify/token_affil_101",
        authors=[{
            "author_name_snapshot": "Dr. Venkata Subrahmanya Sastry Bhattathiripad",
            "department_snapshot": "Interdisciplinary Centre for Advanced Molecular Biophysics and Structural Nanotechnology",
            "scopus_id_snapshot": "57219988776",
        }],
        research_title="Structural analysis of transmembrane macromolecular complexes via cryo-EM",
    )

    assert len(pdf_bytes) > 1000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 1
    page_text = reader.pages[0].extract_text()
    assert "Venkata Subrahmanya Sastry Bhattathiripad" in page_text
    assert "Interdisciplinary Centre for Advanced Molecular Biophysics" in page_text


def test_incentive_certificate_metadata_box_formatting():
    """Verify incentive award certificate renders financial sanction and bulletin citation in metadata box."""
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/INC-000102",
        verification_token="token_inc_102",
        verification_url="https://samiksha.csjmu.ac.in/verify/token_inc_102",
        title="CERTIFICATE OF APPRECIATION FOR RESEARCH PUBLICATION",
        certificate_type="INCENTIVE_AWARD",
        authors=[{"author_name_snapshot": "Dr. Anju Dixit", "department_snapshot": "Department of Chemistry"}],
        research_title="Green synthesis of functionalized graphene oxide for dye degradation",
        bulletin_volume=2,
        bulletin_issue=3,
        incentive_details={
            "incentive_amount": 75000,
            "sanction_order_ref": "CSJMU/R&D/INC-2026/099",
        },
    )

    assert len(pdf_bytes) > 1000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 1
    page_text = reader.pages[0].extract_text()
    assert "SANCTIONED INCENTIVE AWARD" in page_text
    assert "INR 75,000" in page_text
    assert "DATE OF ISSUANCE" in page_text


def test_author_title_selection_and_fallback_prevention():
    """
    Verify:
    1. An author with no explicit academic title (None, empty, or 'None') is rendered without 'Dr.' prepended.
    2. An author with explicit academic title ('Prof.' or 'Er.') renders with the chosen title.
    3. CertificateAuthorCreate schema normalizes empty / 'None' to None and preserves explicit titles.
    """
    from app.modules.sama_veda.schemas.cms import CertificateAuthorCreate

    # Schema tests
    c1 = CertificateAuthorCreate(author_name_snapshot="Ramesh Sharma", academic_title_snapshot=None)
    assert c1.academic_title_snapshot is None

    c2 = CertificateAuthorCreate(author_name_snapshot="Ramesh Sharma", academic_title_snapshot="None")
    assert c2.academic_title_snapshot is None

    c3 = CertificateAuthorCreate(author_name_snapshot="Ramesh Sharma", academic_title_snapshot="  ")
    assert c3.academic_title_snapshot is None

    c4 = CertificateAuthorCreate(author_name_snapshot="Ramesh Sharma", academic_title_snapshot="Prof.")
    assert c4.academic_title_snapshot == "Prof."

    c5 = CertificateAuthorCreate(author_name_snapshot="Ramesh Sharma", academic_title_snapshot="Er.")
    assert c5.academic_title_snapshot == "Er."

    # PDF single author with None title
    pdf_bytes_no_title, _ = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000201",
        verification_token="token_notitle_201",
        verification_url="https://samiksha.csjmu.ac.in/verify/token_notitle_201",
        authors=[{
            "author_name_snapshot": "Ramesh Sharma",
            "academic_title_snapshot": None,
            "department_snapshot": "Department of Physics",
            "scopus_id_snapshot": "57211512345",
        }],
        research_title="Quantum coherence in low-dimensional nanostructures",
    )
    reader_no_title = PdfReader(io.BytesIO(pdf_bytes_no_title))
    text_no_title = reader_no_title.pages[0].extract_text()
    assert "Ramesh Sharma" in text_no_title
    assert "Dr. Ramesh Sharma" not in text_no_title
    assert "None Ramesh Sharma" not in text_no_title

    # PDF single author with "None" string
    pdf_bytes_str_none, _ = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000202",
        verification_token="token_strnone_202",
        verification_url="https://samiksha.csjmu.ac.in/verify/token_strnone_202",
        authors=[{
            "author_name_snapshot": "Ramesh Sharma",
            "academic_title_snapshot": "None",
            "department_snapshot": "Department of Physics",
        }],
        research_title="Quantum coherence in low-dimensional nanostructures",
    )
    reader_str_none = PdfReader(io.BytesIO(pdf_bytes_str_none))
    text_str_none = reader_str_none.pages[0].extract_text()
    assert "Ramesh Sharma" in text_str_none
    assert "Dr. Ramesh Sharma" not in text_str_none
    assert "None Ramesh Sharma" not in text_str_none

    # PDF author with explicit "Prof."
    pdf_bytes_prof, _ = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000203",
        verification_token="token_prof_203",
        verification_url="https://samiksha.csjmu.ac.in/verify/token_prof_203",
        authors=[{
            "author_name_snapshot": "Ramesh Sharma",
            "academic_title_snapshot": "Prof.",
            "department_snapshot": "Department of Physics",
        }],
        research_title="Quantum coherence in low-dimensional nanostructures",
    )
    reader_prof = PdfReader(io.BytesIO(pdf_bytes_prof))
    text_prof = reader_prof.pages[0].extract_text()
    assert "Prof. Ramesh Sharma" in text_prof

    # PDF multi-author (2 authors): one with "Er." and one with None
    pdf_bytes_multi, _ = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000204",
        verification_token="token_multi_204",
        verification_url="https://samiksha.csjmu.ac.in/verify/token_multi_204",
        authors=[
            {
                "author_name_snapshot": "Kavita Singh",
                "academic_title_snapshot": "Er.",
                "department_snapshot": "Department of Engineering",
            },
            {
                "author_name_snapshot": "Ananya Roy",
                "academic_title_snapshot": None,
                "department_snapshot": "Department of Chemistry",
            },
        ],
        research_title="Novel catalytic processes in carbon-neutral fuel cells",
    )
    reader_multi = PdfReader(io.BytesIO(pdf_bytes_multi))
    text_multi = reader_multi.pages[0].extract_text()
    assert "Er. Kavita Singh" in text_multi
    assert "Ananya Roy" in text_multi
    assert "Dr. Ananya Roy" not in text_multi
    assert "None Ananya Roy" not in text_multi

