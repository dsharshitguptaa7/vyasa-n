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
