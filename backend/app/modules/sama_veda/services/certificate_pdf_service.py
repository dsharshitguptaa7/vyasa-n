"""
VYASA-n / SAMIKSHA – Institutional Digital Certificate PDF Engine
Generates print-ready, high-resolution vector PDF certificates for Chhatrapati Shahu Ji Maharaj University (CSJMU).

Features:
- Landscape A4 institutional format (297mm x 210mm)
- Warm ivory background (#FDFBF7) with multi-tier gold borders and corner ornaments
- Solid bottom burgundy ribbon bar with Certificate Number, separator, and SHA-256 seal
- Left-margin classical stacked research monographs vector engraving motif
- Central background subtle academic research watermark (laurel wreath & open monograph)
- Official CSJMU emblem and NAAC A++ accreditation badge
- SAMIKSHA gold rounded pill badge in header
- Two-line navy bold certificate title with harmonic vertical spacing
- Single/multi-author dynamic scaling with prestigious burgundy recipient typography
- Centered dual-column metadata container with strict width constraints and vertical divider
- Central academic seal / medallion (Veritas et Scientia)
- Dual authorized signatories (Dean R&D, Vice Chancellor) with verified digital signatures
- Elevated bottom-right dedicated QR code panel with "Scan to Verify" burgundy button
- Live QR code pointing to official SAMIKSHA verification URL
- Cryptographic SHA-256 tamper-evident checksum calculation
"""
import hashlib
import io
import math
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget


# Institutional Modern Color Palette
COLOR_IVORY = colors.HexColor("#FDFBF7")
COLOR_BURGUNDY = colors.HexColor("#6B1D2F")
COLOR_BURGUNDY_DARK = colors.HexColor("#4A101D")
COLOR_BURGUNDY_BRIGHT = colors.HexColor("#800020")
COLOR_GOLD = colors.HexColor("#B2811A")
COLOR_GOLD_LIGHT = colors.HexColor("#D4AF37")
COLOR_GOLD_ANTIQUE = colors.HexColor("#8C6510")
COLOR_GOLD_BORDER = colors.HexColor("#E2D4B7")
COLOR_GOLD_PILL_BG = colors.HexColor("#F9F0D9")
COLOR_BOX_BG = colors.HexColor("#FCFAF5")
COLOR_NAVY_TITLE = colors.HexColor("#061325")
COLOR_CHARCOAL = colors.HexColor("#1E293B")
COLOR_MUTED = colors.HexColor("#64748B")
COLOR_LIGHT_GRAY = colors.HexColor("#E2E8F0")

# Backward-compatibility aliases
COLOR_MAROON = COLOR_BURGUNDY
COLOR_MAROON_DEEP = COLOR_BURGUNDY_DARK
COLOR_NAVY_DARK = COLOR_NAVY_TITLE


class CertificatePDFEngine:
    """
    Programmatic PDF rendering engine for CSJMU SAMIKSHA Felicitation Certificates.
    """

    def __init__(self, assets_dir: Optional[str] = None):
        # Resolve assets directory by walking up directory hierarchy
        if assets_dir:
            self.assets_dir = Path(assets_dir)
        else:
            root_assets = next(
                (p / "assets" for p in Path(__file__).resolve().parents if (p / "assets").is_dir()),
                None
            )
            self.assets_dir = root_assets if root_assets else Path("assets")
        self.csjmu_logo_path = self.assets_dir / "branding" / "csjmu" / "csjmu-logo.png"
        self.naac_logo_path = self.assets_dir / "branding" / "naac-A-Plus-Plus.png"

    def _resolve_signature_path(self, sig_ref: Optional[Any]) -> Optional[Path]:
        """
        Resolves signature asset storage key or filesystem path to an absolute Path.
        Uses storage_service.get_file_path abstraction for relative keys.
        """
        if not sig_ref:
            return None
        try:
            from app.core.storage import storage_service, StorageFileNotFoundError
            try:
                resolved = storage_service.get_file_path(str(sig_ref))
                if resolved and resolved.is_file():
                    return resolved
            except (StorageFileNotFoundError, Exception):
                pass
            p = Path(sig_ref)
            if p.is_file():
                return p
            # Check relative to backend/storage
            backend_storage = Path(__file__).resolve().parents[4] / "storage" / str(sig_ref)
            if backend_storage.is_file():
                return backend_storage
        except Exception:
            pass
        return None

    def render_certificate_pdf(
        self,
        *,
        certificate_number: str,
        verification_token: str,
        verification_url: str,
        title: Optional[str] = None,
        certificate_type: str = "RESEARCH_PUBLICATION",
        presentation_statement: Optional[str] = None,
        authors: List[Dict[str, Any]],
        research_contribution_statement: Optional[str] = None,
        research_title: Optional[str] = None,
        publication_details: Optional[Dict[str, Any]] = None,
        bulletin_title: Optional[str] = None,
        bulletin_volume: Optional[int] = None,
        bulletin_issue: Optional[int] = None,
        bulletin_period: Optional[str] = None,
        incentive_details: Optional[Dict[str, Any]] = None,
        congratulatory_statement: Optional[str] = None,
        issue_date: Optional[datetime] = None,
        dean_name: str = "Prof. Namita Tiwari",
        dean_designation: str = "Dean, Research & Development",
        dean_signature_path: Optional[str] = None,
        vc_name: str = "Prof. Vinay Kumar Pathak",
        vc_designation: str = "Vice Chancellor",
        vc_signature_path: Optional[str] = None,
        template_config: Optional[Dict[str, Any]] = None,
        is_preview: bool = False,
    ) -> Tuple[bytes, str]:
        """
        Renders complete vector PDF certificate and returns (pdf_bytes, sha256_checksum).
        Supports both Research Work and Incentive Certificate categories.
        """
        buffer = io.BytesIO()
        width, height = landscape(A4)  # 841.89 x 595.28 pt

        c = canvas.Canvas(buffer, pagesize=(width, height))
        c.setTitle(f"CSJMU Research Certificate - {certificate_number}")
        c.setAuthor("Chhatrapati Shahu Ji Maharaj University, Kanpur")
        c.setSubject(
            "Research Publication Incentive Certificate"
            if certificate_type == "INCENTIVE_AWARD"
            else "Research Appreciation & Felicitation Certificate"
        )
        c.setCreator("VYASA-n / SAMIKSHA Institutional Engine")

        # Normalize title and presentation statement based on category
        if not title:
            if certificate_type == "INCENTIVE_AWARD":
                title = "CERTIFICATE OF RESEARCH PUBLICATION INCENTIVE AWARD"
            else:
                title = "CERTIFICATE OF APPRECIATION & RESEARCH EXCELLENCE"

        if not presentation_statement:
            if certificate_type == "INCENTIVE_AWARD":
                presentation_statement = "This certificate is proudly awarded to"
            else:
                presentation_statement = "This certificate is proudly conferred upon"

        effective_date = issue_date or datetime.now()
        date_str = effective_date.strftime("%B %d, %Y")

        # 1. Warm Ivory Background
        c.setFillColor(COLOR_IVORY)
        c.rect(0, 0, width, height, stroke=0, fill=1)

        # 2. Multi-Tier Gold Borders, Corner Accents & Bottom Solid Burgundy Ribbon Bar
        self._draw_ornamental_borders(
            c, width, height, certificate_number=certificate_number, is_preview=is_preview
        )

        # 3. Subtle Left Margin Research Books Watermark Motif
        self._draw_research_books_watermark(c, 34, 165)

        # 4. Subtle Academic Research Watermark in Central Background (improves vertical balance)
        self._draw_scholarly_watermark(c, width / 2.0, 225.0)

        # 5. Official University Header
        header_bottom = self._draw_header(
            c, width, height, template_config=template_config, certificate_type=certificate_type
        )

        # 6. Certificate Title (Harmoniously spaced)
        title_bottom = self._draw_certificate_title(
            c, width, header_bottom, title, certificate_type=certificate_type
        )

        # 7. Presentation Statement
        statement_bottom = self._draw_presentation_statement(
            c, width, title_bottom, presentation_statement
        )

        # 8. Dynamic Authors / Recipients Section
        authors_bottom = self._draw_authors_section(c, width, statement_bottom, authors)

        # 9. Research or Incentive Details Section + Centered Dual-Column Metadata Container
        content_bottom = self._draw_body_content(
            c,
            width,
            authors_bottom,
            certificate_type=certificate_type,
            contribution_statement=research_contribution_statement,
            research_title=research_title,
            publication_details=publication_details,
            incentive_details=incentive_details,
            bulletin_title=bulletin_title,
            bulletin_volume=bulletin_volume,
            bulletin_issue=bulletin_issue,
            bulletin_period=bulletin_period,
            date_str=date_str,
        )

        # 10. Central Academic Seal / Medallion (Elevated to y = 100 pt)
        self._draw_central_academic_seal(c, width / 2.0, 100.0)

        # 11. Dual Authority Signatures (Elevated to line y = 98 pt)
        self._draw_signatories(
            c,
            width,
            dean_name=dean_name,
            dean_designation=dean_designation,
            dean_sig_path=dean_signature_path,
            vc_name=vc_name,
            vc_designation=vc_designation,
            vc_sig_path=vc_signature_path,
        )

        # 12. Elevated Dedicated Bottom-Right QR Code Panel
        self._draw_security_footer(
            c,
            width,
            height,
            verification_token=verification_token,
            verification_url=verification_url,
            is_preview=is_preview,
        )

        # 13. Draft Preview Watermark (if in preview mode)
        if is_preview:
            self._draw_draft_watermark(c, width, height)

        c.showPage()
        c.save()

        pdf_bytes = buffer.getvalue()
        sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()
        return pdf_bytes, sha256_hash

    # =========================================================================
    # Internal Drawing Helpers
    # =========================================================================

    def _draw_book_icon(self, c: canvas.Canvas, x: float, y: float, size: float = 18):
        """Draws an elegant vector open book icon."""
        c.saveState()
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(1.2)
        p = c.beginPath()
        p.moveTo(x + size / 2, y + 2)
        p.curveTo(x + size / 4, y + 4, x + 2, y + 2, x, y + size * 0.7)
        p.lineTo(x, y + size)
        p.curveTo(x + 2, y + size * 0.8, x + size / 4, y + size * 0.8, x + size / 2, y + size * 0.9)
        p.close()
        c.drawPath(p, fill=0, stroke=1)

        p2 = c.beginPath()
        p2.moveTo(x + size / 2, y + 2)
        p2.curveTo(x + size * 0.75, y + 4, x + size - 2, y + 2, x + size, y + size * 0.7)
        p2.lineTo(x + size, y + size)
        p2.curveTo(x + size - 2, y + size * 0.8, x + size * 0.75, y + size * 0.8, x + size / 2, y + size * 0.9)
        p2.close()
        c.drawPath(p2, fill=0, stroke=1)

        c.line(x + size / 2, y + 2, x + size / 2, y + size * 0.9)
        c.restoreState()

    def _draw_calendar_icon(self, c: canvas.Canvas, x: float, y: float, size: float = 18):
        """Draws an elegant vector calendar icon."""
        c.saveState()
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(1.2)
        c.roundRect(x, y, size, size * 0.88, 2, fill=0, stroke=1)
        c.setFillColor(COLOR_GOLD)
        c.rect(x, y + size * 0.62, size, size * 0.26, fill=1, stroke=0)
        c.line(x + 3.5, y + size * 0.82, x + 3.5, y + size)
        c.line(x + size - 3.5, y + size * 0.82, x + size - 3.5, y + size)
        c.setFillColor(COLOR_GOLD)
        for row in range(2):
            for col in range(3):
                dot_x = x + 3 + col * 4.2
                dot_y = y + 2.5 + row * 4
                c.circle(dot_x + 1, dot_y + 1, 0.9, fill=1, stroke=0)
        c.restoreState()

    def _draw_research_books_watermark(self, c: canvas.Canvas, x: float, y: float):
        """Draws classical vector stacked research monographs on the left margin."""
        c.saveState()
        line_color = colors.Color(0.68, 0.50, 0.16, alpha=0.35)
        fill_color = colors.Color(0.88, 0.80, 0.55, alpha=0.12)

        c.setStrokeColor(line_color)
        c.setFillColor(fill_color)
        c.setLineWidth(0.75)

        # Bottom Book
        b1_w, b1_h = 105, 20
        b1_x, b1_y = x, y
        c.roundRect(b1_x, b1_y, b1_w, b1_h, 3, fill=1, stroke=1)
        c.line(b1_x + 12, b1_y, b1_x + 12, b1_y + b1_h)
        c.line(b1_x + 14, b1_y, b1_x + 14, b1_y + b1_h)
        for i in range(1, 4):
            c.line(b1_x + 22, b1_y + i * 5, b1_x + b1_w - 4, b1_y + i * 5)

        # Middle Book
        b2_w, b2_h = 92, 18
        b2_x, b2_y = x + 4, y + 21
        c.roundRect(b2_x, b2_y, b2_w, b2_h, 3, fill=1, stroke=1)
        c.line(b2_x + 12, b2_y, b2_x + 12, b2_y + b2_h)
        c.line(b2_x + 14, b2_y, b2_x + 14, b2_y + b2_h)
        for i in range(1, 4):
            c.line(b2_x + 22, b2_y + i * 4.5, b2_x + b2_w - 4, b2_y + i * 4.5)

        # Bookmark ribbon hanging down
        p_rib = c.beginPath()
        p_rib.moveTo(b2_x + 38, b2_y)
        p_rib.lineTo(b2_x + 40, b1_y - 6)
        p_rib.lineTo(b2_x + 43, b1_y - 2)
        p_rib.lineTo(b2_x + 46, b1_y - 6)
        p_rib.lineTo(b2_x + 44, b2_y)
        p_rib.close()
        c.setFillColor(colors.Color(0.60, 0.15, 0.20, alpha=0.35))
        c.drawPath(p_rib, fill=1, stroke=0)

        # Top Book
        b3_w, b3_h = 82, 16
        b3_x, b3_y = x + 8, y + 40
        c.setFillColor(fill_color)
        c.roundRect(b3_x, b3_y, b3_w, b3_h, 3, fill=1, stroke=1)
        c.line(b3_x + 11, b3_y, b3_x + 11, b3_y + b3_h)
        c.line(b3_x + 13, b3_y, b3_x + 13, b3_y + b3_h)
        for i in range(1, 3):
            c.line(b3_x + 20, b3_y + i * 5, b3_x + b3_w - 4, b3_y + i * 5)

        c.restoreState()

    def _draw_scholarly_watermark(self, c: canvas.Canvas, cx: float, cy: float):
        """
        Draws a subtle, high-prestige academic research watermark in the central background.
        Includes laurel branches, open knowledge monograph, and radiant academic excellence motif.
        Low opacity (0.065 stroke, 0.03 fill) ensures complete legibility while filling empty space with elegance.
        """
        c.saveState()
        wm_color = colors.Color(0.70, 0.52, 0.18, alpha=0.065)
        c.setStrokeColor(wm_color)
        c.setFillColor(colors.Color(0.70, 0.52, 0.18, alpha=0.03))
        c.setLineWidth(0.8)

        # 1. Subtle Concentric Guilloche Rings
        c.circle(cx, cy, 100, fill=0, stroke=1)
        c.setLineWidth(0.5)
        c.circle(cx, cy, 92, fill=0, stroke=1)

        # 2. Symmetrical Research Laurel Wreath
        for side in (-1, 1):
            p_laurel = c.beginPath()
            p_laurel.moveTo(cx + side * 15, cy - 75)
            p_laurel.curveTo(
                cx + side * 85, cy - 50,
                cx + side * 95, cy + 30,
                cx + side * 40, cy + 85
            )
            c.drawPath(p_laurel, fill=0, stroke=1)

            # Laurel leaves along the stem
            for t in [0.2, 0.35, 0.5, 0.65, 0.8, 0.92]:
                leaf_x = cx + side * (25 + 65 * math.sin(t * math.pi * 0.85))
                leaf_y = cy - 75 + 160 * t
                angle = side * (35 - 70 * t)

                c.saveState()
                c.translate(leaf_x, leaf_y)
                c.rotate(angle)
                p_leaf = c.beginPath()
                p_leaf.moveTo(0, 0)
                p_leaf.curveTo(side * 8, 5, side * 12, 14, 0, 20)
                p_leaf.curveTo(-side * 4, 14, -side * 4, 5, 0, 0)
                p_leaf.close()
                c.drawPath(p_leaf, fill=1, stroke=1)
                c.restoreState()

        # 3. Central Open Knowledge Monograph Watermark
        book_w = 64
        book_h = 32
        bk_x = cx - book_w / 2
        bk_y = cy - book_h / 2

        p_bk = c.beginPath()
        p_bk.moveTo(cx, bk_y + 4)
        p_bk.curveTo(cx - 16, bk_y + 10, cx - 28, bk_y + 6, bk_x, bk_y + book_h * 0.8)
        p_bk.lineTo(bk_x, bk_y + book_h)
        p_bk.curveTo(cx - 28, bk_y + book_h * 0.85, cx - 16, bk_y + book_h * 0.9, cx, bk_y + book_h)
        p_bk.curveTo(cx + 16, bk_y + book_h * 0.9, cx + 28, bk_y + book_h * 0.85, bk_x + book_w, bk_y + book_h)
        p_bk.lineTo(bk_x + book_w, bk_y + book_h * 0.8)
        p_bk.curveTo(cx + 28, bk_y + 6, cx + 16, bk_y + 10, cx, bk_y + 4)
        p_bk.close()
        c.drawPath(p_bk, fill=1, stroke=1)
        c.line(cx, bk_y + 4, cx, bk_y + book_h)

        # 4. Subtle Rays of Academic Enlightenment
        c.setLineWidth(0.4)
        for deg in range(0, 360, 30):
            rad = math.radians(deg)
            r1 = 104
            r2 = 114
            c.line(cx + r1 * math.cos(rad), cy + r1 * math.sin(rad), cx + r2 * math.cos(rad), cy + r2 * math.sin(rad))

        c.restoreState()

    def _draw_ornamental_borders(
        self,
        c: canvas.Canvas,
        width: float,
        height: float,
        certificate_number: str = "",
        is_preview: bool = False,
    ):
        """Draws multi-tier gold borders, corner ornaments, and solid burgundy bottom ribbon bar."""
        # 1. Outer Thin Gold Border
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(1.2)
        c.rect(16, 16, width - 32, height - 32, stroke=1, fill=0)

        # 2. Main Gold Border
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(1.8)
        c.rect(22, 22, width - 44, height - 44, stroke=1, fill=0)

        # 3. Inner Fine Hairline Border
        c.setStrokeColor(COLOR_GOLD_BORDER)
        c.setLineWidth(0.6)
        c.rect(25, 25, width - 50, height - 50, stroke=1, fill=0)

        # 4. Corner Diamonds / Rosettes (at all 4 corners)
        corners = [
            (22, 22),
            (width - 22, 22),
            (22, height - 22),
            (width - 22, height - 22),
        ]
        c.setFillColor(COLOR_GOLD_ANTIQUE)
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(0.8)
        for cx, cy in corners:
            p = c.beginPath()
            p.moveTo(cx - 5, cy)
            p.lineTo(cx, cy + 5)
            p.lineTo(cx + 5, cy)
            p.lineTo(cx, cy - 5)
            p.close()
            c.drawPath(p, fill=1, stroke=1)

        # 5. Bottom Solid Burgundy Ribbon Bar
        ribbon_y = 22
        ribbon_h = 22
        c.setFillColor(COLOR_BURGUNDY)
        c.rect(22, ribbon_y, width - 44, ribbon_h, fill=1, stroke=0)

        display_cert_no = f"{certificate_number}  [PREVIEW DRAFT]" if is_preview else certificate_number
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(colors.white)
        c.drawString(42, ribbon_y + 7.5, f"Certificate No.: {display_cert_no}")

        center_x = width / 2.0
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.5))
        c.drawCentredString(center_x, ribbon_y + 7.5, "|")

        c.setFont("Helvetica-Bold", 7.2)
        c.setFillColor(colors.white)
        c.drawRightString(width - 42, ribbon_y + 7.5, "🛡  Tamper-evident • Cryptographically Verified (SHA-256)")

    def _draw_header(
        self,
        c: canvas.Canvas,
        width: float,
        height: float,
        template_config: Optional[Dict[str, Any]] = None,
        certificate_type: str = "RESEARCH_PUBLICATION",
    ) -> float:
        """Draws official CSJMU emblem on left, university typography in center, NAAC logo on right."""
        top_y = height - 36
        show_emblem = template_config.get("show_university_emblem", True) if template_config else True
        show_naac = template_config.get("show_naac_badge", True) if template_config else True
        accreditation_text = (
            template_config.get("accreditation_text")
            if template_config and template_config.get("accreditation_text")
            else "Kanpur, Uttar Pradesh, India • Established 1966 • Accredited A++ by NAAC"
        )

        # 1. Official CSJMU Emblem on Left
        logo_w, logo_h = 54, 58
        logo_x = 46
        logo_y = top_y - logo_h + 4

        if show_emblem:
            if self.csjmu_logo_path.exists():
                try:
                    c.drawImage(
                        str(self.csjmu_logo_path),
                        logo_x,
                        logo_y,
                        width=logo_w,
                        height=logo_h,
                        preserveAspectRatio=True,
                        mask="auto",
                    )
                except Exception:
                    self._draw_fallback_emblem(c, logo_x + logo_w / 2, logo_y + logo_h / 2)
            else:
                self._draw_fallback_emblem(c, logo_x + logo_w / 2, logo_y + logo_h / 2)

        # 2. Official NAAC Accreditation Logo on Right
        naac_w, naac_h = 72, 48
        naac_x = width - 46 - naac_w
        naac_y = top_y - naac_h + 4

        if show_naac:
            if self.naac_logo_path.exists():
                try:
                    c.drawImage(
                        str(self.naac_logo_path),
                        naac_x,
                        naac_y,
                        width=naac_w,
                        height=naac_h,
                        preserveAspectRatio=True,
                        mask="auto",
                    )
                except Exception:
                    self._draw_naac_badge(c, naac_x + naac_w / 2, naac_y + naac_h / 2)
            else:
                self._draw_naac_badge(c, naac_x + naac_w / 2, naac_y + naac_h / 2)

        # 3. Center University Identity Typography
        center_x = width / 2.0

        c.setFont("Times-Bold", 16.5)
        c.setFillColor(COLOR_BURGUNDY)
        c.drawCentredString(center_x, top_y - 2, "CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR")

        c.setFont("Helvetica", 8.5)
        c.setFillColor(COLOR_CHARCOAL)
        c.drawCentredString(center_x, top_y - 16, accreditation_text)

        c.setFont("Helvetica-Bold", 9.0)
        c.setFillColor(COLOR_BURGUNDY)
        c.drawCentredString(center_x, top_y - 30, "RESEARCH & DEVELOPMENT CELL")

        # 4. Gold Rounded Pill Badge
        pill_w = 264
        pill_h = 17
        pill_x = center_x - pill_w / 2
        pill_y = top_y - 50
        c.setFillColor(COLOR_GOLD_PILL_BG)
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(0.8)
        c.roundRect(pill_x, pill_y, pill_w, pill_h, 8.5, fill=1, stroke=1)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(COLOR_BURGUNDY_DARK)
        badge_label = (
            "SAMIKSHA – SCHOLARLY FELICITATION"
            if certificate_type == "RESEARCH_PUBLICATION"
            else "SAMIKSHA – INCENTIVE SCHEME AWARD"
        )
        c.drawCentredString(center_x, pill_y + 4.5, badge_label)

        return pill_y - 12

    def _draw_fallback_emblem(self, c: canvas.Canvas, cx: float, cy: float):
        """Draws vector fallback university seal when raster asset is inaccessible."""
        c.setStrokeColor(COLOR_GOLD)
        c.setFillColor(COLOR_BURGUNDY)
        c.setLineWidth(1.5)
        c.circle(cx, cy, 26, fill=1, stroke=1)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.white)
        c.drawCentredString(cx, cy - 3, "CSJMU")

    def _draw_naac_badge(self, c: canvas.Canvas, cx: float, cy: float):
        """Renders vector official NAAC A++ Grade accreditation badge."""
        c.setStrokeColor(COLOR_GOLD)
        c.setFillColor(COLOR_IVORY)
        c.setLineWidth(1.8)
        c.circle(cx, cy, 26, fill=1, stroke=1)

        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setFillColor(COLOR_BURGUNDY_DARK)
        c.setLineWidth(1.0)
        c.circle(cx, cy, 22.5, fill=1, stroke=1)

        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(COLOR_GOLD_LIGHT)
        c.drawCentredString(cx, cy + 10, "NAAC")

        c.setFont("Times-Bold", 11)
        c.setFillColor(colors.white)
        c.drawCentredString(cx, cy - 1, "A++")

        c.setFont("Helvetica-Bold", 5.5)
        c.setFillColor(COLOR_GOLD_LIGHT)
        c.drawCentredString(cx, cy - 9, "GRADE")

        c.setFont("Helvetica", 4.5)
        c.setFillColor(colors.HexColor("#CBD5E1"))
        c.drawCentredString(cx, cy - 16, "ACCREDITED")

    def _draw_certificate_title(
        self,
        c: canvas.Canvas,
        width: float,
        start_y: float,
        title: str,
        certificate_type: str = "RESEARCH_PUBLICATION",
    ) -> float:
        """Draws prominent two-line certificate heading with generous academic dignity."""
        center_x = width / 2.0
        line1_y = start_y - 16
        line2_y = line1_y - 22
        c.setFont("Times-Bold", 20.0)
        c.setFillColor(COLOR_NAVY_TITLE)

        if certificate_type == "INCENTIVE_AWARD":
            c.drawCentredString(center_x, line1_y, "CERTIFICATE OF RESEARCH PUBLICATION")
            c.drawCentredString(center_x, line2_y, "INCENTIVE AWARD")
        else:
            c.drawCentredString(center_x, line1_y, "CERTIFICATE OF APPRECIATION &")
            c.drawCentredString(center_x, line2_y, "RESEARCH EXCELLENCE")

        return line2_y - 20

    def _draw_presentation_statement(
        self, c: canvas.Canvas, width: float, start_y: float, statement: str
    ) -> float:
        """Draws introductory conferment statement."""
        center_x = width / 2.0
        y = start_y - 8
        c.setFont("Times-Italic", 11.5)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(center_x, y, statement)
        return y - 14

    def _draw_authors_section(
        self, c: canvas.Canvas, width: float, start_y: float, authors: List[Dict[str, Any]]
    ) -> float:
        """
        Dynamically formats recipient names accommodating 1, 2, 3, 4, 5, or large collaborative teams.
        Auto-scales typography and line height to preserve single-page perfection.
        """
        center_x = width / 2.0
        count = len(authors) if authors else 1

        if count == 0:
            y = start_y - 14
            c.setFont("Times-Bold", 24.0)
            c.setFillColor(COLOR_BURGUNDY_BRIGHT)
            c.drawCentredString(center_x, y, "Distinguished University Researcher")
            return y - 16

        elif count == 1:
            # Single Author: Large, majestic centered typography with rich crimson/burgundy
            auth = authors[0]
            name = auth.get("author_name_snapshot") or auth.get("name") or "Distinguished Researcher"
            dept = auth.get("department_snapshot") or auth.get("department") or ""
            scopus = auth.get("scopus_id_snapshot") or auth.get("scopus_id") or ""

            y = start_y - 14
            c.setFont("Times-Bold", 24.0)
            c.setFillColor(COLOR_BURGUNDY_BRIGHT)
            c.drawCentredString(center_x, y, name)

            meta_parts = []
            if dept:
                meta_parts.append(dept)
            if scopus:
                meta_parts.append(f"Scopus ID: {scopus}")

            y -= 16
            if meta_parts:
                c.setFont("Helvetica-Bold", 10.0)
                c.setFillColor(COLOR_CHARCOAL)
                c.drawCentredString(center_x, y, " • ".join(meta_parts))

            return y - 14

        elif count in (2, 3):
            # 2-3 Authors: Elegantly formatted multi-line author list with Scopus IDs
            y = start_y - 10
            for i, auth in enumerate(authors):
                name = auth.get("author_name_snapshot") or auth.get("name") or f"Researcher {i+1}"
                scopus = auth.get("scopus_id_snapshot") or auth.get("scopus_id") or ""
                dept = auth.get("department_snapshot") or auth.get("department") or ""

                line = name
                if scopus:
                    line += f"  (Scopus ID: {scopus})"
                if dept and len(authors) == 2:
                    line += f" — {dept}"

                c.setFont("Times-Bold", 14.5 if count == 2 else 13.0)
                c.setFillColor(COLOR_BURGUNDY_BRIGHT)
                c.drawCentredString(center_x, y, line)
                y -= 16

            return y - 6

        elif count in (4, 5):
            # 4-5 Authors: 2-column balanced grid
            y = start_y - 8
            col_left = center_x - 170
            col_right = center_x + 170
            half = math.ceil(count / 2)

            for i in range(half):
                auth_l = authors[i]
                name_l = auth_l.get("author_name_snapshot") or auth_l.get("name") or ""
                scopus_l = auth_l.get("scopus_id_snapshot") or auth_l.get("scopus_id") or ""
                disp_l = f"• {name_l}" + (f" (Scopus: {scopus_l})" if scopus_l else "")

                c.setFont("Times-Bold", 11.0)
                c.setFillColor(COLOR_BURGUNDY_BRIGHT)
                c.drawString(col_left - 130, y, disp_l)

                if i + half < count:
                    auth_r = authors[i + half]
                    name_r = auth_r.get("author_name_snapshot") or auth_r.get("name") or ""
                    scopus_r = auth_r.get("scopus_id_snapshot") or auth_r.get("scopus_id") or ""
                    disp_r = f"• {name_r}" + (f" (Scopus: {scopus_r})" if scopus_r else "")
                    c.drawString(col_right - 130, y, disp_r)

                y -= 14

            return y - 6

        else:
            # 6+ Authors: 3-column compact grid, ensuring full inclusion without 'et al.'
            y = start_y - 6
            num_cols = 3
            col_width = (width - 120) / num_cols
            margin_left = 60

            rows = math.ceil(count / num_cols)
            font_size = 9.0 if count <= 12 else 8.0
            c.setFont("Times-Bold", font_size)
            c.setFillColor(COLOR_BURGUNDY_BRIGHT)

            for r in range(rows):
                for col in range(num_cols):
                    idx = r * num_cols + col
                    if idx < count:
                        auth = authors[idx]
                        name = auth.get("author_name_snapshot") or auth.get("name") or ""
                        scopus = auth.get("scopus_id_snapshot") or auth.get("scopus_id") or ""
                        text = f"• {name}" + (f" ({scopus})" if scopus else "")
                        c.drawString(margin_left + col * col_width, y, text[:36])
                y -= 12

            return y - 6

    def _draw_body_content(
        self,
        c: canvas.Canvas,
        width: float,
        start_y: float,
        *,
        certificate_type: str,
        contribution_statement: Optional[str],
        research_title: Optional[str],
        publication_details: Optional[Dict[str, Any]],
        incentive_details: Optional[Dict[str, Any]],
        bulletin_title: Optional[str],
        bulletin_volume: Optional[int],
        bulletin_issue: Optional[int],
        bulletin_period: Optional[str],
        date_str: str = "",
    ) -> float:
        """
        Draws research/incentive statements, publication title, commendation, and
        the redesigned two-column metadata container with strict width constraints.
        """
        center_x = width / 2.0
        y = start_y - 6

        # 1. Contribution / Award Statement
        if not contribution_statement:
            if certificate_type == "INCENTIVE_AWARD":
                contribution_statement = (
                    "in recognition of distinguished research productivity and publication incentive for:"
                )
            else:
                contribution_statement = "in recognition of scholarly research publication titled:"

        c.setFont("Times-Italic", 10.0)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(center_x, y, contribution_statement)
        y -= 18

        # 2. Research Paper Title (Wrapped in quotation marks)
        if research_title:
            cleaned_title = f'“{research_title.strip("“”\' ")}”'
            lines = self._wrap_text(c, cleaned_title, "Times-BoldItalic", 13.5, width - 200)

            c.setFont("Times-BoldItalic", 13.5)
            c.setFillColor(COLOR_NAVY_TITLE)
            for line in lines[:3]:  # Max 3 lines
                c.drawCentredString(center_x, y, line)
                y -= 17
        else:
            y -= 4

        # 3. Commendation Line
        y -= 6
        c.setFont("Times-Italic", 9.0)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(
            center_x,
            y,
            "The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.",
        )
        y -= 22

        # 4. Redesigned Centered Dual-Column Metadata Box
        # Equal-width 240 pt columns (480 pt total) with strict bounds and vertical divider
        box_w = 480.0
        box_h = 44.0
        box_x = center_x - box_w / 2.0  # = 180.95 pt to 660.95 pt

        # Draw rounded card container
        c.setFillColor(COLOR_BOX_BG)
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(1.0)
        c.roundRect(box_x, y - box_h, box_w, box_h, 6, fill=1, stroke=1)

        # Center vertical divider line
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(0.8)
        c.line(center_x, y - box_h + 5, center_x, y - 5)

        # Column Layout Constraints
        icon_sz = 18.0
        col1_start_x = box_x + 14.0
        text1_x = col1_start_x + icon_sz + 10.0  # = box_x + 42.0 pt
        col1_max_w = (center_x - 14.0) - text1_x  # = 184 pt available width!

        col2_start_x = center_x + 14.0
        text2_x = col2_start_x + icon_sz + 10.0  # = center_x + 42.0 pt
        col2_max_w = (box_x + box_w - 14.0) - text2_x  # = 184 pt available width!

        # Bulletin edition string resolution
        bulletin_edition = self._format_bulletin_citation(
            bulletin_title=bulletin_title,
            volume=bulletin_volume,
            issue=bulletin_issue,
            period=bulletin_period,
        ) or "Volume 2, Issue 3"

        box_base_y = y - box_h

        if certificate_type == "INCENTIVE_AWARD":
            inc_data = incentive_details or publication_details or {}
            raw_amount = inc_data.get("incentive_amount") or inc_data.get("approved_amount")
            sanction_ref = (
                inc_data.get("sanction_order_ref")
                or inc_data.get("sanction_order")
                or inc_data.get("scheme_name")
            )
            if raw_amount:
                try:
                    formatted_amt = f"INR {int(float(raw_amount)):,}"
                except (ValueError, TypeError):
                    formatted_amt = f"INR {raw_amount}"
            else:
                formatted_amt = "Approved Grant"

            # Column 1 (Left): Sanctioned Incentive Award
            self._draw_book_icon(c, col1_start_x, box_base_y + 13, size=icon_sz)
            c.setFont("Helvetica-Bold", 7.0)
            c.setFillColor(COLOR_MUTED)
            c.drawString(text1_x, box_base_y + 26, "SANCTIONED INCENTIVE AWARD")

            c.setFillColor(COLOR_NAVY_TITLE)
            award_line = formatted_amt
            if sanction_ref:
                award_line += f"  •  Ref: {sanction_ref}"
            self._draw_fitted_text(c, award_line, text1_x, box_base_y + 11, col1_max_w, font_name="Helvetica-Bold", base_size=8.5)

            # Column 2 (Right): Research Bulletin Citation
            self._draw_calendar_icon(c, col2_start_x, box_base_y + 13, size=icon_sz)
            c.setFont("Helvetica-Bold", 7.0)
            c.setFillColor(COLOR_MUTED)
            c.drawString(text2_x, box_base_y + 26, "RESEARCH BULLETIN CITATION")

            c.setFillColor(COLOR_NAVY_TITLE)
            self._draw_fitted_text(c, bulletin_edition, text2_x, box_base_y + 11, col2_max_w, font_name="Helvetica-Bold", base_size=8.5)

        else:
            # Column 1 (Left): Research Bulletin Volume/Issue
            self._draw_book_icon(c, col1_start_x, box_base_y + 13, size=icon_sz)
            c.setFont("Helvetica-Bold", 7.0)
            c.setFillColor(COLOR_MUTED)
            c.drawString(text1_x, box_base_y + 26, "RESEARCH BULLETIN")

            c.setFillColor(COLOR_NAVY_TITLE)
            self._draw_fitted_text(c, bulletin_edition, text1_x, box_base_y + 11, col1_max_w, font_name="Helvetica-Bold", base_size=8.5)

            # Column 2 (Right): Date of Issuance
            self._draw_calendar_icon(c, col2_start_x, box_base_y + 13, size=icon_sz)
            c.setFont("Helvetica-Bold", 7.0)
            c.setFillColor(COLOR_MUTED)
            c.drawString(text2_x, box_base_y + 26, "DATE OF ISSUANCE")

            c.setFillColor(COLOR_NAVY_TITLE)
            self._draw_fitted_text(c, date_str, text2_x, box_base_y + 11, col2_max_w, font_name="Helvetica-Bold", base_size=8.5)

        return box_base_y

    def _draw_fitted_text(
        self,
        c: canvas.Canvas,
        text: str,
        x: float,
        y: float,
        max_w: float,
        font_name: str = "Helvetica-Bold",
        base_size: float = 8.5,
    ):
        """
        Draws text auto-scaled or truncated to strictly guarantee it never exceeds max_w
        and never crosses the column divider or container boundary.
        """
        sw = c.stringWidth(text, font_name, base_size)
        if sw <= max_w:
            c.setFont(font_name, base_size)
            c.drawString(x, y, text)
            return

        # Proportional scale down to minimum readable size (6.5 pt)
        scale = max_w / sw
        fitted_size = max(6.5, base_size * scale)
        sw2 = c.stringWidth(text, font_name, fitted_size)
        if sw2 <= max_w:
            c.setFont(font_name, fitted_size)
            c.drawString(x, y, text)
            return

        # Truncate with ellipsis if text still exceeds at 6.5 pt
        trunc = text
        while len(trunc) > 3 and c.stringWidth(trunc + "…", font_name, fitted_size) > max_w:
            trunc = trunc[:-1]
        c.setFont(font_name, fitted_size)
        c.drawString(x, y, trunc + "…")

    def _format_bulletin_citation(
        self,
        *,
        bulletin_title: Optional[str] = None,
        volume: Optional[int] = None,
        issue: Optional[int] = None,
        period: Optional[str] = None,
    ) -> str:
        """Formats the official CSJMU Research Bulletin Volume and Issue citation."""
        if volume is not None and issue is not None:
            base = f"Volume {volume}, Issue {issue}"
            if period:
                base += f" ({period})"
            return base
        elif bulletin_title:
            return bulletin_title
        return ""

    def _draw_central_academic_seal(self, c: canvas.Canvas, cx: float, cy: float = 100.0):
        """Draws central vector medallion with stars, laurels, and CSJMU research motto."""
        # Outer Gold Circle
        c.setStrokeColor(COLOR_GOLD)
        c.setFillColor(COLOR_IVORY)
        c.setLineWidth(1.4)
        c.circle(cx, cy, 22, fill=1, stroke=1)

        # Concentric Beaded Circle
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(0.7)
        c.circle(cx, cy, 19, fill=0, stroke=1)

        # Inner Maroon Core
        c.setStrokeColor(COLOR_GOLD)
        c.setFillColor(COLOR_BURGUNDY)
        c.setLineWidth(1.0)
        c.circle(cx, cy, 16, fill=1, stroke=0)

        # Seal Center Motif
        c.setFont("Times-Bold", 5.5)
        c.setFillColor(COLOR_GOLD_LIGHT)
        c.drawCentredString(cx, cy + 4, "CSJMU")

        c.setFont("Helvetica-Bold", 3.8)
        c.setFillColor(colors.white)
        c.drawCentredString(cx, cy - 2, "SEAL OF")
        c.drawCentredString(cx, cy - 7, "EXCELLENCE")

        # Ribbon under Seal
        p = c.beginPath()
        p.moveTo(cx - 18, cy - 16)
        p.lineTo(cx + 18, cy - 16)
        p.lineTo(cx + 14, cy - 22)
        p.lineTo(cx - 14, cy - 22)
        p.close()
        c.setFillColor(COLOR_GOLD)
        c.drawPath(p, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 3.2)
        c.setFillColor(colors.white)
        c.drawCentredString(cx, cy - 20, "VERITAS ET SCIENTIA")

    def _draw_signatories(
        self,
        c: canvas.Canvas,
        width: float,
        *,
        dean_name: str,
        dean_designation: str,
        dean_sig_path: Optional[str],
        vc_name: str,
        vc_designation: str,
        vc_sig_path: Optional[str],
    ):
        """Draws dual authorized signing authorities (Dean R&D on left, Vice Chancellor on right)."""
        sig_line_y = 98.0

        # Authority 1: Dean - R&D (Left)
        left_x = 155.0
        resolved_dean_sig = self._resolve_signature_path(dean_sig_path)
        if resolved_dean_sig:
            try:
                c.drawImage(
                    str(resolved_dean_sig),
                    left_x - 38,
                    sig_line_y + 4,
                    width=76,
                    height=28,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except Exception:
                pass

        # Signature Line
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(0.8)
        c.line(left_x - 65, sig_line_y, left_x + 65, sig_line_y)

        # Signatory Name & Designation
        c.setFont("Times-Bold", 9.5)
        c.setFillColor(COLOR_NAVY_TITLE)
        c.drawCentredString(left_x, sig_line_y - 12, dean_name)

        c.setFont("Helvetica", 8.0)
        c.setFillColor(COLOR_CHARCOAL)
        c.drawCentredString(left_x, sig_line_y - 22, dean_designation)

        # Authority 2: Vice Chancellor (Right)
        right_x = 585.0
        resolved_vc_sig = self._resolve_signature_path(vc_sig_path)
        if resolved_vc_sig:
            try:
                c.drawImage(
                    str(resolved_vc_sig),
                    right_x - 42,
                    sig_line_y + 4,
                    width=84,
                    height=28,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except Exception:
                pass

        # Signature Line
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(0.8)
        c.line(right_x - 65, sig_line_y, right_x + 65, sig_line_y)

        # Signatory Name & Designation
        c.setFont("Times-Bold", 9.5)
        c.setFillColor(COLOR_NAVY_TITLE)
        c.drawCentredString(right_x, sig_line_y - 12, vc_name)

        c.setFont("Helvetica", 8.0)
        c.setFillColor(COLOR_CHARCOAL)
        c.drawCentredString(right_x, sig_line_y - 22, vc_designation)

    def _draw_security_footer(
        self,
        c: canvas.Canvas,
        width: float,
        height: float,
        *,
        verification_token: str,
        verification_url: str,
        is_preview: bool = False,
    ):
        """Renders dedicated bottom-right QR panel with white card, live QR code, burgundy pill button, and microtext."""
        qr_card_x = width - 24 - 72
        qr_card_y = 52
        qr_card_w = 68
        qr_card_h = 76

        # Pure white card with subtle gold border
        c.setFillColor(colors.white)
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(0.75)
        c.roundRect(qr_card_x, qr_card_y, qr_card_w, qr_card_h, 4, fill=1, stroke=1)

        # High-contrast live QR Code
        qr_size = 48
        qr_x = qr_card_x + (qr_card_w - qr_size) / 2
        qr_y = qr_card_y + 24

        try:
            qr = QrCodeWidget(verification_url)
            bounds = qr.getBounds()
            w = bounds[2] - bounds[0]
            h = bounds[3] - bounds[1]
            if w > 0 and h > 0:
                scale = qr_size / max(w, h)
                d = Drawing(qr_size, qr_size, transform=[scale, 0, 0, scale, -bounds[0] * scale, -bounds[1] * scale])
                d.add(qr)
                d.drawOn(c, qr_x, qr_y)
            else:
                d = Drawing(qr_size, qr_size)
                qr.barWidth = 1.2
                qr.barHeight = 1.2
                d.add(qr)
                d.drawOn(c, qr_x, qr_y)
        except Exception:
            c.setStrokeColor(COLOR_GOLD)
            c.setFillColor(COLOR_IVORY)
            c.rect(qr_x, qr_y, qr_size, qr_size, fill=1, stroke=1)
            c.setFont("Helvetica-Bold", 6.5)
            c.setFillColor(COLOR_BURGUNDY)
            c.drawCentredString(qr_x + qr_size / 2, qr_y + qr_size / 2, "QR CODE")

        # Burgundy "Scan to Verify" Pill Button
        pill_w = 56
        pill_h = 11.5
        pill_x = qr_card_x + (qr_card_w - pill_w) / 2
        pill_y = qr_card_y + 11
        c.setFillColor(COLOR_BURGUNDY)
        c.roundRect(pill_x, pill_y, pill_w, pill_h, 3, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 6.0)
        c.setFillColor(colors.white)
        c.drawCentredString(qr_card_x + qr_card_w / 2, pill_y + 3.2, "Scan to Verify")

        # Microtext below pill
        c.setFont("Helvetica-Bold", 5.2)
        c.setFillColor(COLOR_NAVY_TITLE)
        c.drawCentredString(qr_card_x + qr_card_w / 2, qr_card_y + 5.5, "Official SAMIKSHA")

        c.setFont("Helvetica", 4.8)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(qr_card_x + qr_card_w / 2, qr_card_y + 1.2, "Certificate Verification")

    def _draw_draft_watermark(self, c: canvas.Canvas, width: float, height: float):
        """Draws a prominent diagonal DRAFT PREVIEW watermark across the certificate canvas."""
        c.saveState()
        c.translate(width / 2.0, height / 2.0)
        c.rotate(32)
        c.setFillColor(colors.Color(0.72, 0.12, 0.12, alpha=0.14))
        c.setFont("Helvetica-Bold", 54)
        c.drawCentredString(0, 22, "DRAFT PREVIEW")
        c.setFont("Helvetica-Bold", 20)
        c.setFillColor(colors.Color(0.2, 0.2, 0.2, alpha=0.16))
        c.drawCentredString(0, -14, "NOT AN OFFICIAL ISSUED CERTIFICATE")
        c.setFont("Helvetica", 13)
        c.drawCentredString(0, -38, "Temporary vector preview • Approvals and official registration pending")
        c.restoreState()

    def _wrap_text(
        self, c: canvas.Canvas, text: str, font_name: str, font_size: float, max_width: float
    ) -> List[str]:
        """Greedy word wrapping based on exact font string width."""
        words = text.split()
        if not words:
            return []

        lines = []
        current_line = []

        for word in words:
            test_line = " ".join(current_line + [word])
            line_w = c.stringWidth(test_line, font_name, font_size)
            if line_w <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                    current_line = [word]
                else:
                    lines.append(word)
                    current_line = []

        if current_line:
            lines.append(" ".join(current_line))

        return lines


# Global singleton instance
certificate_pdf_engine = CertificatePDFEngine()
