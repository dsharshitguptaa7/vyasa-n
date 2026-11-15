"""
VYASA-n / SAMIKSHA – Institutional Branding & Certificate Logo Rendering Tests
Verifies deterministic asset resolution, CWD independence, Pillow decode verification,
fail-closed integrity enforcement, and zero path leakage for production certificate generation.
"""
import io
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.modules.sama_veda.services.certificate_pdf_service import (
    CertificatePDFEngine,
    InstitutionalAssetResolutionError,
    _validate_image_file,
    _find_file_case_insensitive,
)


def test_logo_asset_presence_and_integrity():
    """Verify that official CSJMU emblem and NAAC badge exist and are valid PNG images."""
    engine = CertificatePDFEngine()
    
    csjmu_path = engine.resolve_csjmu_logo(mandatory=True)
    assert csjmu_path is not None and csjmu_path.is_file()
    assert os.access(csjmu_path, os.R_OK)
    
    is_valid, dims, fmt = _validate_image_file(csjmu_path)
    assert is_valid is True
    assert fmt == "PNG"
    assert dims == (1164, 1258)

    naac_path = engine.resolve_naac_logo(mandatory=True)
    assert naac_path is not None and naac_path.is_file()
    assert os.access(naac_path, os.R_OK)

    is_valid, dims, fmt = _validate_image_file(naac_path)
    assert is_valid is True
    assert fmt == "PNG"
    assert dims == (674, 429)


def test_candidate_roots_include_package_and_container_paths():
    """Verify candidate search roots include package hierarchy and Docker container paths."""
    engine = CertificatePDFEngine()
    candidate_roots = [str(r).replace("\\", "/") for r in engine._get_candidate_roots()]

    # Must contain backend/app/assets or backend/assets
    assert any("app/assets" in r or "backend/assets" in r for r in candidate_roots)
    # Must contain container paths
    assert any("/app/assets" in r for r in candidate_roots)


def test_cwd_independence():
    """Verify that CertificatePDFEngine resolves branding assets regardless of current working directory."""
    original_cwd = os.getcwd()
    with tempfile.TemporaryDirectory() as empty_dir:
        try:
            os.chdir(empty_dir)
            engine = CertificatePDFEngine()
            csjmu_path = engine.resolve_csjmu_logo(mandatory=True)
            naac_path = engine.resolve_naac_logo(mandatory=True)
            assert csjmu_path.is_file()
            assert naac_path.is_file()
        finally:
            os.chdir(original_cwd)


def test_case_insensitive_resolution():
    """Verify case-insensitive filesystem resolution utility."""
    engine = CertificatePDFEngine()
    csjmu_path = engine.resolve_csjmu_logo(mandatory=True)
    # Find the 'assets' ancestor directory
    assets_root = next(p for p in csjmu_path.parents if p.name == "assets")

    # Test resolving with varied casing: BRANDING / CsJmU / CSJMU-LOGO.PNG
    resolved = _find_file_case_insensitive(assets_root, ["BRANDING", "CsJmU", "CSJMU-LOGO.PNG"])
    assert resolved is not None
    assert resolved.is_file()
    assert resolved.name.lower() == "csjmu-logo.png"


def test_asset_diagnostics_healthy_status():
    """Verify get_asset_diagnostics returns full structured health report."""
    engine = CertificatePDFEngine()
    diag = engine.get_asset_diagnostics()

    assert diag["status"] == "HEALTHY"
    assert diag["csjmu_emblem"]["resolved"] is True
    assert diag["csjmu_emblem"]["dimensions"] == [1164, 1258]
    assert diag["csjmu_emblem"]["format"] == "PNG"
    assert diag["naac_badge"]["resolved"] is True
    assert diag["naac_badge"]["dimensions"] == [674, 429]
    assert diag["naac_badge"]["format"] == "PNG"
    assert diag["candidate_roots_count"] > 0


def test_fail_closed_when_csjmu_emblem_missing():
    """Verify that rendering fails closed (raises error, no silent fallback) if CSJMU emblem is missing."""
    engine = CertificatePDFEngine()
    with patch.object(
        engine,
        "resolve_csjmu_logo",
        side_effect=InstitutionalAssetResolutionError("CSJMU_EMBLEM", "CSJMU emblem asset unavailable"),
    ):
        with pytest.raises(InstitutionalAssetResolutionError) as exc_info:
            engine.render_certificate_pdf(
                certificate_number="CSJMU/TEST/001",
                verification_token="tok-test",
                verification_url="https://csjmu.ac.in/verify",
                authors=[{"author_name_snapshot": "Dr. Researcher"}],
            )
        assert exc_info.value.asset_name == "CSJMU_EMBLEM"


def test_fail_closed_when_naac_badge_missing():
    """Verify that rendering fails closed (raises error, no silent fallback) if NAAC badge is missing."""
    engine = CertificatePDFEngine()
    with patch.object(
        engine,
        "resolve_naac_logo",
        side_effect=InstitutionalAssetResolutionError("NAAC_BADGE", "NAAC badge asset unavailable"),
    ):
        with pytest.raises(InstitutionalAssetResolutionError) as exc_info:
            engine.render_certificate_pdf(
                certificate_number="CSJMU/TEST/002",
                verification_token="tok-test-2",
                verification_url="https://csjmu.ac.in/verify",
                authors=[{"author_name_snapshot": "Dr. Researcher"}],
            )
        assert exc_info.value.asset_name == "NAAC_BADGE"


def test_render_both_templates_with_official_branding():
    """Verify successful vector PDF rendering of Research Publication and Incentive Award certificates."""
    engine = CertificatePDFEngine()

    # 1. Research Publication Certificate
    res_bytes, res_sha = engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/RES-TEST",
        verification_token="tok-res-test",
        verification_url="https://samiksha.csjmu.ac.in/verify/tok-res-test",
        certificate_type="RESEARCH_PUBLICATION",
        authors=[{"author_name_snapshot": "Prof. Harshit Gupta", "department_snapshot": "Computer Science"}],
        research_title="Quantum Computing in High-Throughput Genomic Assembly",
        bulletin_volume=3,
        bulletin_issue=1,
    )
    assert isinstance(res_bytes, bytes)
    assert len(res_bytes) > 20000
    assert len(res_sha) == 64

    # 2. Incentive Award Certificate
    inc_bytes, inc_sha = engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/INC-TEST",
        verification_token="tok-inc-test",
        verification_url="https://samiksha.csjmu.ac.in/verify/tok-inc-test",
        certificate_type="INCENTIVE_AWARD",
        authors=[{"author_name_snapshot": "Dr. Harshit Gupta", "department_snapshot": "Biotechnology"}],
        research_title="CRISPR Targeted Epigenetic Editing",
        bulletin_volume=3,
        bulletin_issue=1,
        incentive_details={"incentive_amount": 75000, "sanction_order_ref": "CSJMU/R&D/INC/2026/101"},
    )
    assert isinstance(inc_bytes, bytes)
    assert len(inc_bytes) > 20000
    assert len(inc_sha) == 64


def test_api_exception_handler_zero_path_leakage():
    """Verify that an InstitutionalAssetResolutionError returned via API never leaks filesystem paths."""
    client = TestClient(app, raise_server_exceptions=False)

    # Trigger a dummy endpoint or use mock route to raise InstitutionalAssetResolutionError
    @app.get("/test/institutional-asset-error-trigger")
    def _test_trigger():
        raise InstitutionalAssetResolutionError(
            asset_name="CSJMU_EMBLEM",
            message="Internal /app/backend/assets/branding/csjmu/csjmu-logo.png not found on host",
            diagnostics={"roots_checked": ["/secret/path/1", "/secret/path/2"]},
        )

    response = client.get("/test/institutional-asset-error-trigger")
    assert response.status_code == 500
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "INSTITUTIONAL_ASSET_UNAVAILABLE"
    # Ensure internal paths are NEVER in the public message
    assert "/secret/path" not in body["message"]
    assert "csjmu-logo.png" not in body["message"]
    assert "Internal" not in body["message"]
    assert "Mandatory official university branding assets are temporarily unavailable" in body["message"]
