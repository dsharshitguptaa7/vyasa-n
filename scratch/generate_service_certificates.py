import os
import sys
from datetime import datetime
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
sys.path.insert(0, str(Path(r"C:\Projects\VYASA\backend")))

from app.modules.sama_veda.services.certificate_pdf_service import certificate_pdf_engine

ARTIFACT_DIR = Path(r"C:\Users\harsh\.gemini\antigravity\brain\e90803ef-432d-4cee-be21-9af6a6b6ad21")

dean_sig = r"sama_veda/signatures/4b6d1a399321_signature_3d1cf972-6e9b-48cf-8308-22322574f94e_1794595937.png"
vc_sig = r"sama_veda/signatures/84718e7f0a8e_signature_3c90e01f-4866-4eaf-94da-d32a0c18a42d_1794595893.png"

# 1. Research Work Certificate
research_bytes, r_sha = certificate_pdf_engine.render_certificate_pdf(
    certificate_number="CSJMU/SAMIKSHA/2026/000002",
    verification_token="tok-csjmu-res-2026-000002",
    verification_url="https://samiksha.csjmu.ac.in/verify/tok-csjmu-res-2026-000002",
    title="CERTIFICATE OF APPRECIATION & RESEARCH EXCELLENCE",
    certificate_type="RESEARCH_PUBLICATION",
    authors=[{
        "author_name_snapshot": "Dr. Harshit Gupta",
        "department_snapshot": "Department of Research",
    }],
    research_title="XYZ",
    bulletin_volume=2,
    bulletin_issue=3,
    issue_date=datetime(2026, 11, 14),
    dean_name="Prof. Namita Tiwari",
    dean_designation="Dean, Research & Development",
    dean_signature_path=dean_sig,
    vc_name="Prof. Vinay Kumar Pathak",
    vc_designation="Vice Chancellor",
    vc_signature_path=vc_sig,
)

research_pdf_path = ARTIFACT_DIR / "modern_research_work_certificate.pdf"
research_pdf_path.write_bytes(research_bytes)
print(f"Generated: {research_pdf_path} (SHA: {r_sha[:16]}...)")

# 2. Incentive Award Certificate
incentive_bytes, i_sha = certificate_pdf_engine.render_certificate_pdf(
    certificate_number="CSJMU/SAMIKSHA/2026/INC-000002",
    verification_token="tok-csjmu-inc-2026-000002",
    verification_url="https://samiksha.csjmu.ac.in/verify/tok-csjmu-inc-2026-000002",
    title="CERTIFICATE OF RESEARCH PUBLICATION INCENTIVE AWARD",
    certificate_type="INCENTIVE_AWARD",
    authors=[{
        "author_name_snapshot": "Dr. Harshit Gupta",
        "department_snapshot": "Department of Research",
    }],
    research_title="CRISPR-Cas12 Targeted Epigenetic Editing for Enhanced Plant Resilience",
    bulletin_volume=2,
    bulletin_issue=3,
    incentive_details={
        "incentive_amount": 50000,
        "sanction_order_ref": "CSJMU/R&D/INC-2026/089",
    },
    issue_date=datetime(2026, 11, 14),
    dean_name="Prof. Namita Tiwari",
    dean_designation="Dean, Research & Development",
    dean_signature_path=dean_sig,
    vc_name="Prof. Vinay Kumar Pathak",
    vc_designation="Vice Chancellor",
    vc_signature_path=vc_sig,
)

incentive_pdf_path = ARTIFACT_DIR / "modern_incentive_award_certificate.pdf"
incentive_pdf_path.write_bytes(incentive_bytes)
print(f"Generated: {incentive_pdf_path} (SHA: {i_sha[:16]}...)")
