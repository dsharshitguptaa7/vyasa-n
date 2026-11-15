import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / '.env')

from app.modules.sama_veda.services.certificate_pdf_service import certificate_pdf_engine

def render_sample():
    # 1. Render single author with genuine designation & department
    pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/000101",
        verification_token="token1234567890abcdef",
        verification_url="https://vyasa.csjmu.ac.in/verify/token1234567890abcdef",
        title="Certificate of Appreciation & Research Excellence",
        certificate_type="RESEARCH_PUBLICATION",
        presentation_statement="This certificate is proudly conferred upon",
        authors=[
            {
                "author_name_snapshot": "Dr. Harshit Gupta",
                "department_snapshot": "Department of Physics",
                "designation_snapshot": "Associate Professor",
                "scopus_id_snapshot": "57200192834",
            }
        ],
        research_contribution_statement="in recognition of scholarly research publication titled:",
        research_title="Exploring the dielectric, supercapacitor and photocatalytic capabilities of sol-gel synthesized TiC nanoparticles",
        bulletin_title="Volume 2 • Issue 3",
        bulletin_volume=2,
        bulletin_issue=3,
        bulletin_period="July - September 2026",
        congratulatory_statement="The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.",
        dean_name="Prof. Namita Tiwari",
        dean_designation="Dean, Research & Development",
        vc_name="Prof. Vinay Kumar Pathak",
        vc_designation="Vice Chancellor",
    )

    out_pdf = Path("c:/Projects/VYASA/scratch/sample_verified_research_cert.pdf")
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    out_pdf.write_bytes(pdf_bytes)
    print(f"Wrote {out_pdf} (SHA-256: {sha})")

if __name__ == '__main__':
    render_sample()
