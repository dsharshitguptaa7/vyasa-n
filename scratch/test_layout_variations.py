import io
from pathlib import Path
from dotenv import load_dotenv

load_dotenv("backend/.env")
from app.modules.sama_veda.services.certificate_pdf_service import certificate_pdf_engine
from pypdf import PdfReader

test_cases = [
    (
        "single_author_short_title",
        [{"author_name_snapshot": "Dr. Single Author", "department_snapshot": "Physics"}],
        "Short Title",
    ),
    (
        "single_author_long_title",
        [
            {
                "author_name_snapshot": "Dr. Single Author",
                "department_snapshot": "Physics",
                "scopus_id_snapshot": "57211512345",
            }
        ],
        "Investigation of Multiferroic and Magnetoelectric Coupling in Bismuth Ferrite Nanocomposites Fabricated via Microwave-Assisted Sol-Gel Hydrothermal Synthesis for Next-Generation Spintronic and Energy Storage Devices",
    ),
    (
        "3_authors_medium_title",
        [{"author_name_snapshot": f"Dr. Author {i+1}", "department_snapshot": f"Dept {i+1}"} for i in range(3)],
        "Advancements in Artificial Intelligence for Healthcare and Clinical Diagnostics",
    ),
    (
        "5_authors_long_title",
        [{"author_name_snapshot": f"Researcher {i+1}", "scopus_id_snapshot": f"998877{i}"} for i in range(5)],
        "Comprehensive Genome-Wide Association Study of Abiotic Stress Tolerance in Bread Wheat (Triticum aestivum L.) Under Drought and Heat Conditions Across Diverse Agro-Climatic Zones in North India",
    ),
    (
        "8_authors_medium_title",
        [{"author_name_snapshot": f"Collab Author {i+1}"} for i in range(8)],
        "Multi-Center Evaluation of Machine Learning Models for Early Sepsis Detection",
    ),
    (
        "14_authors_title",
        [{"author_name_snapshot": f"Large Team Member {i+1}", "scopus_id_snapshot": f"123{i}"} for i in range(14)],
        "Global Collaborative Consortium on High-Energy Particle Physics and Dark Matter Searches at CERN LHC",
    ),
]

for name, authors, title in test_cases:
    pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
        certificate_number=f"CSJMU/TEST/{name.upper()}",
        verification_token="tok-123",
        verification_url="https://verify.csjmu.ac.in/tok-123",
        authors=authors,
        research_title=title,
        bulletin_volume=4,
        bulletin_issue=2,
        bulletin_period="July - Dec 2026",
    )
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 1, f"{name} produced more than 1 page!"
    print(f'Test case "{name}": SUCCESS (1 page, size={len(pdf_bytes)}, sha={sha[:12]}...)')
