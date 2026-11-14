import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-12345678901234567890")

# Ensure backend app in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.modules.sama_veda.services.certificate_pdf_service import certificate_pdf_engine

service = certificate_pdf_engine
output_dir = r"C:\Users\harsh\.gemini\antigravity\brain\e90803ef-432d-4cee-be21-9af6a6b6ad21"

# 1. Generate Research Work Certificate
research_authors = [
    {
        "author_name": "Dr. Ramesh Chandra Verma",
        "academic_title": "Associate Professor",
        "scopus_id": "57218492000",
        "department": "Department of Computer Science & Engineering",
        "affiliation": "Chhatrapati Shahu Ji Maharaj University, Kanpur",
        "author_role": "CORRESPONDING_AUTHOR",
        "author_order": 1,
    },
    {
        "author_name": "Prof. Alok Kumar Gupta",
        "academic_title": "Professor",
        "scopus_id": "57199482110",
        "department": "Department of Physics & Materials Science",
        "affiliation": "Chhatrapati Shahu Ji Maharaj University, Kanpur",
        "author_role": "CO_AUTHOR",
        "author_order": 2,
    },
]

research_pdf_bytes, research_sha256 = service.render_certificate_pdf(
    certificate_number="CSJMU/SAMA/2026/00142",
    authors=research_authors,
    research_title="Advancements in Deep Reinforcement Learning for Autonomous Quantum Control Systems",
    verification_token="tok-csjmu-res-2026-00142",
    verification_url="https://samiksha.csjmu.ac.in/verify/tok-csjmu-res-2026-00142",
    certificate_type="RESEARCH_PUBLICATION",
    bulletin_title="CSJMU Research Bulletin – Official Biannual Journal",
    bulletin_volume=3,
    bulletin_issue=1,
    bulletin_period="January – June 2026",
    is_preview=False,
)

research_pdf_path = os.path.join(output_dir, "sample_research_certificate.pdf")
with open(research_pdf_path, "wb") as f:
    f.write(research_pdf_bytes)
print(f"Generated Research PDF: {research_pdf_path} ({len(research_pdf_bytes)} bytes, SHA: {research_sha256[:12]}...)")

# 2. Generate Incentive Award Certificate
incentive_authors = [
    {
        "author_name": "Prof. (Dr.) Sunita Sharma",
        "academic_title": "Professor & Head",
        "scopus_id": "56291847100",
        "department": "Department of Biotechnology & Bioinformatics",
        "affiliation": "Chhatrapati Shahu Ji Maharaj University, Kanpur",
        "author_role": "FIRST_AUTHOR",
        "author_order": 1,
    }
]

incentive_details = {
    "incentive_amount": 50000,
    "sanction_order_ref": "CSJMU/R&D/INC-2026/089",
    "award_statement": "In recognition of distinguished Q1 high-impact indexed scholarly publication in Nature Biotechnology."
}

incentive_pdf_bytes, incentive_sha256 = service.render_certificate_pdf(
    certificate_number="CSJMU/SAMA/2026/INC-00045",
    authors=incentive_authors,
    research_title="CRISPR-Cas12 Targeted Epigenetic Editing for Enhanced Drought Resistance in Crop Plants",
    verification_token="tok-csjmu-inc-2026-00045",
    verification_url="https://samiksha.csjmu.ac.in/verify/tok-csjmu-inc-2026-00045",
    certificate_type="INCENTIVE_AWARD",
    bulletin_title="CSJMU Research Bulletin – Official Biannual Journal",
    bulletin_volume=3,
    bulletin_issue=1,
    bulletin_period="January – June 2026",
    incentive_details=incentive_details,
    is_preview=False,
)

incentive_pdf_path = os.path.join(output_dir, "sample_incentive_certificate.pdf")
with open(incentive_pdf_path, "wb") as f:
    f.write(incentive_pdf_bytes)
print(f"Generated Incentive PDF: {incentive_pdf_path} ({len(incentive_pdf_bytes)} bytes, SHA: {incentive_sha256[:12]}...)")
