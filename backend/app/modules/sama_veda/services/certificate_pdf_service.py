"""
VYASA-n / SAMIKSHA – Institutional Digital Certificate PDF Engine
Generates print-ready, high-resolution vector PDF certificates for Chhatrapati Shahu Ji Maharaj University (CSJMU).

Features:
- Landscape A4 institutional format (297mm x 210mm)
- Warm ivory background with antique-gold double borders and ornamental corner brackets
- CSJMU official emblem and vector NAAC A++ accreditation badge
- Central academic medallion / seal
- Dynamic multi-author typography engine (1, 2, 3, 4, 5+ authors with auto-scaling)
- Dual authorized signatories (Dean - R&D, Vice Chancellor)
- Live QR code pointing to SAMIKSHA verification URL
- SHA-256 tamper-evident integrity calculation
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
from reportlab.graphics.shapes import Drawing, Circle, Rect, String as DString, Group, Line as DLine
from reportlab.graphics.barcode.qr import QrCodeWidget


# Institutional Color Palette
COLOR_IVORY = colors.HexColor("#FAF7F0")
COLOR_GOLD = colors.HexColor("#B2811A")
COLOR_GOLD_LIGHT = colors.HexColor("#D4AF37")
COLOR_GOLD_ANTIQUE = colors.HexColor("#8C6510")
COLOR_MAROON = colors.HexColor("#6B1D2F")
COLOR_MAROON_DEEP = colors.HexColor("#4A101D")
COLOR_NAVY_DARK = colors.HexColor("#061325")
COLOR_CHARCOAL = colors.HexColor("#1E293B")
COLOR_MUTED = colors.HexColor("#475569")
COLOR_LIGHT_GRAY = colors.HexColor("#E2E8F0")


class CertificatePDFEngine:
    """
    Programmatic PDF rendering engine for CSJMU SAMIKSHA Felicitation Certificates.
    """

    def __init__(self, assets_dir: Optional[str] = None):
        # Resolve assets directory
        if assets_dir:
            self.assets_dir = Path(assets_dir)
        else:
            base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
            self.assets_dir = base_dir / "assets"
        self.csjmu_logo_path = self.assets_dir / "branding" / "csjmu" / "csjmu-logo.png"

    def render_certificate_pdf(
        self,
        *,
        certificate_number: str,
        verification_token: str,
        verification_url: str,
        title: str = "CERTIFICATE OF APPRECIATION & RESEARCH EXCELLENCE",
        presentation_statement: str = "This certificate is proudly conferred upon",
        authors: List[Dict[str, Any]],
        research_contribution_statement: str = "in recognition of meritorious scholarly contribution published in the research article titled:",
        research_title: Optional[str] = None,
        publication_details: Optional[Dict[str, Any]] = None,
        congratulatory_statement: str = "The university commends the exemplary commitment to advancing research frontiers and intellectual pursuit.",
        issue_date: Optional[datetime] = None,
        dean_name: str = "Prof. (Dr.) Rajesh Kumar",
        dean_designation: str = "Dean – Research & Development",
        dean_signature_path: Optional[str] = None,
        vc_name: str = "Prof. Vinay Kumar Pathak",
        vc_designation: str = "Vice Chancellor",
        vc_signature_path: Optional[str] = None,
        template_config: Optional[Dict[str, Any]] = None,
        is_preview: bool = False,
    ) -> Tuple[bytes, str]:
        """
        Renders complete vector PDF certificate and returns (pdf_bytes, sha256_checksum).
        """
        buffer = io.BytesIO()
        width, height = landscape(A4)  # 841.89 x 595.28 pt

        c = canvas.Canvas(buffer, pagesize=(width, height))
        c.setTitle(f"CSJMU Research Certificate - {certificate_number}")
        c.setAuthor("Chhatrapati Shahu Ji Maharaj University, Kanpur")
        c.setSubject("Research Appreciation & Felicitation Certificate")
        c.setCreator("VYASA-n / SAMIKSHA Institutional Engine")

        # 1. Warm Ivory Background
        c.setFillColor(COLOR_IVORY)
        c.rect(0, 0, width, height, stroke=0, fill=1)

        # 2. Antique Gold Double Borders & Corner Ornaments
        self._draw_ornamental_borders(c, width, height)

        # 3. Official University Header
        header_bottom = self._draw_header(c, width, height)

        # 4. Certificate Title
        title_bottom = self._draw_certificate_title(c, width, header_bottom, title)

        # 5. Presentation Statement
        statement_bottom = self._draw_presentation_statement(
            c, width, title_bottom, presentation_statement
        )

        # 6. Dynamic Authors / Recipients Section
        authors_bottom = self._draw_authors_section(c, width, statement_bottom, authors)

        # 7. Research Contribution Statement & Research Paper Title
        research_bottom = self._draw_research_section(
            c, width, authors_bottom, research_contribution_statement, research_title, publication_details
        )

        # 8. Congratulatory Closing Statement
        congrat_bottom = self._draw_congratulatory_statement(
            c, width, research_bottom, congratulatory_statement
        )

        # 9. Central Academic Seal / Medallion
        self._draw_central_academic_seal(c, width / 2.0, 95)

        # 10. Dual Authority Signatures
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

        # 11. Security QR Code, Certificate Number, and Verification Footprint
        effective_date = issue_date or datetime.now()
        date_str = effective_date.strftime("%B %d, %Y")
        self._draw_security_footer(
            c,
            width,
            height,
            certificate_number=certificate_number,
            date_str=date_str,
            verification_url=verification_url,
            is_preview=is_preview,
        )

        # 12. Draft Preview Watermark (if in preview mode)
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

    def _draw_ornamental_borders(self, c: canvas.Canvas, width: float, height: float):
        """Draws double antique gold borders, fine maroon accent hairlines, and corner ornaments."""
        # Outer Gold Border
        outer_margin = 18
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(2.5)
        c.rect(outer_margin, outer_margin, width - 2 * outer_margin, height - 2 * outer_margin)

        # Inner Thin Gold Border
        inner_margin = 24
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(1.0)
        c.rect(inner_margin, inner_margin, width - 2 * inner_margin, height - 2 * inner_margin)

        # Fine Maroon Accent Line
        maroon_margin = 27
        c.setStrokeColor(COLOR_MAROON)
        c.setLineWidth(0.6)
        c.rect(maroon_margin, maroon_margin, width - 2 * maroon_margin, height - 2 * maroon_margin)

        # Corner Rosettes / Brackets (at all 4 corners)
        corners = [
            (outer_margin, outer_margin),
            (width - outer_margin, outer_margin),
            (outer_margin, height - outer_margin),
            (width - outer_margin, height - outer_margin),
        ]
        c.setFillColor(COLOR_GOLD_ANTIQUE)
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(1)
        for cx, cy in corners:
            # Draw decorative corner diamond
            p = c.beginPath()
            p.moveTo(cx - 6, cy)
            p.lineTo(cx, cy + 6)
            p.lineTo(cx + 6, cy)
            p.lineTo(cx, cy - 6)
            p.close()
            c.drawPath(p, fill=1, stroke=1)

    def _draw_header(self, c: canvas.Canvas, width: float, height: float) -> float:
        """Draws official CSJMU emblem on left, university typography in center, NAAC badge on right."""
        top_y = height - 42

        # 1. Official CSJMU Emblem on Left
        logo_w, logo_h = 58, 62
        logo_x = 45
        logo_y = top_y - logo_h + 8

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

        # 2. Official NAAC Accreditation Badge on Right
        badge_w = 64
        badge_x = width - 45 - badge_w
        badge_y = top_y - logo_h + 8
        self._draw_naac_badge(c, badge_x + badge_w / 2, badge_y + logo_h / 2)

        # 3. Center University Identity Typography
        center_x = width / 2.0

        # University Primary Name
        c.setFont("Times-Bold", 19)
        c.setFillColor(COLOR_MAROON)
        c.drawCentredString(center_x, top_y - 2, "CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR")

        # Location & Foundation
        c.setFont("Times-Roman", 9.5)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(center_x, top_y - 17, "Kanpur, Uttar Pradesh, India • Established 1966 • Uttar Pradesh State University (Formerly Kanpur University, Kanpur)")

        # Research & Development Governance Header
        c.setFont("Helvetica-Bold", 9.0)
        c.setFillColor(COLOR_GOLD_ANTIQUE)
        c.drawCentredString(center_x, top_y - 32, "RESEARCH & DEVELOPMENT CELL • SAMIKSHA SCHOLARLY FELICITATION")

        # Ornamental Underline
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(1.2)
        c.line(center_x - 170, top_y - 40, center_x + 170, top_y - 40)
        c.setFillColor(COLOR_MAROON)
        c.circle(center_x, top_y - 40, 2.5, fill=1, stroke=0)

        return top_y - 50

    def _draw_fallback_emblem(self, c: canvas.Canvas, cx: float, cy: float):
        """Draws vector fallback university seal when raster asset is inaccessible."""
        c.setStrokeColor(COLOR_GOLD)
        c.setFillColor(COLOR_MAROON)
        c.setLineWidth(1.5)
        c.circle(cx, cy, 26, fill=1, stroke=1)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.white)
        c.drawCentredString(cx, cy - 3, "CSJMU")

    def _draw_naac_badge(self, c: canvas.Canvas, cx: float, cy: float):
        """Renders vector official NAAC A++ Grade accreditation badge."""
        # Outer Gold Beaded Circle
        c.setStrokeColor(COLOR_GOLD)
        c.setFillColor(COLOR_IVORY)
        c.setLineWidth(1.8)
        c.circle(cx, cy, 26, fill=1, stroke=1)

        # Inner Maroon Circle
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setFillColor(COLOR_MAROON_DEEP)
        c.setLineWidth(1.0)
        c.circle(cx, cy, 22.5, fill=1, stroke=1)

        # Text inside NAAC badge
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
        self, c: canvas.Canvas, width: float, start_y: float, title: str
    ) -> float:
        """Draws prominent certificate heading."""
        center_x = width / 2.0
        y = start_y - 14

        c.setFont("Times-Bold", 21)
        c.setFillColor(COLOR_NAVY_DARK)
        c.drawCentredString(center_x, y, title.upper())

        # Decorative Flourish under Title
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(1.0)
        c.line(center_x - 130, y - 6, center_x + 130, y - 6)

        c.setFillColor(COLOR_GOLD)
        c.rect(center_x - 3, y - 8, 6, 4, fill=1, stroke=0)

        return y - 18

    def _draw_presentation_statement(
        self, c: canvas.Canvas, width: float, start_y: float, statement: str
    ) -> float:
        """Draws introductory conferment statement."""
        center_x = width / 2.0
        y = start_y - 4
        c.setFont("Times-Italic", 11.5)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(center_x, y, statement)
        return y - 10

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
            # Fallback placeholder
            y = start_y - 16
            c.setFont("Times-Bold", 19)
            c.setFillColor(COLOR_MAROON)
            c.drawCentredString(center_x, y, "Distinguished University Researcher")
            return y - 12

        elif count == 1:
            # Single Author: Large, majestic centered typography
            auth = authors[0]
            name = auth.get("author_name_snapshot") or auth.get("name") or "Distinguished Researcher"
            dept = auth.get("department_snapshot") or auth.get("department") or ""
            scopus = auth.get("scopus_id_snapshot") or auth.get("scopus_id") or ""

            y = start_y - 18
            c.setFont("Times-Bold", 20)
            c.setFillColor(COLOR_MAROON)
            c.drawCentredString(center_x, y, name)

            # Metadata line: Department + Scopus ID
            meta_parts = []
            if dept:
                meta_parts.append(dept)
            if scopus:
                meta_parts.append(f"Scopus ID: {scopus}")

            if meta_parts:
                y -= 13
                c.setFont("Times-Roman", 10.0)
                c.setFillColor(COLOR_CHARCOAL)
                c.drawCentredString(center_x, y, " • ".join(meta_parts))

            return y - 10

        elif count in (2, 3):
            # 2-3 Authors: Elegantly formatted multi-line author list with Scopus IDs
            y = start_y - 12
            for i, auth in enumerate(authors):
                name = auth.get("author_name_snapshot") or auth.get("name") or f"Researcher {i+1}"
                scopus = auth.get("scopus_id_snapshot") or auth.get("scopus_id") or ""
                dept = auth.get("department_snapshot") or auth.get("department") or ""

                line = name
                if scopus:
                    line += f"  (Scopus ID: {scopus})"
                if dept and len(authors) == 2:
                    line += f" — {dept}"

                c.setFont("Times-Bold", 14.5 if count == 2 else 13.5)
                c.setFillColor(COLOR_MAROON)
                c.drawCentredString(center_x, y, line)
                y -= 16

            return y - 2

        elif count in (4, 5):
            # 4-5 Authors: 2-column balanced grid
            y = start_y - 10
            col_left = center_x - 170
            col_right = center_x + 170
            half = math.ceil(count / 2)

            for i in range(half):
                # Left Column
                auth_l = authors[i]
                name_l = auth_l.get("author_name_snapshot") or auth_l.get("name") or ""
                scopus_l = auth_l.get("scopus_id_snapshot") or auth_l.get("scopus_id") or ""
                disp_l = f"• {name_l}" + (f" (Scopus: {scopus_l})" if scopus_l else "")

                c.setFont("Times-Bold", 11.5)
                c.setFillColor(COLOR_MAROON)
                c.drawString(col_left - 130, y, disp_l)

                # Right Column (if exists)
                if i + half < count:
                    auth_r = authors[i + half]
                    name_r = auth_r.get("author_name_snapshot") or auth_r.get("name") or ""
                    scopus_r = auth_r.get("scopus_id_snapshot") or auth_r.get("scopus_id") or ""
                    disp_r = f"• {name_r}" + (f" (Scopus: {scopus_r})" if scopus_r else "")
                    c.drawString(col_right - 130, y, disp_r)

                y -= 14

            return y - 2

        else:
            # 6+ Authors: 3-column compact grid, ensuring full inclusion without 'et al.'
            y = start_y - 8
            num_cols = 3
            col_width = (width - 120) / num_cols
            margin_left = 60

            rows = math.ceil(count / num_cols)
            font_size = 9.5 if count <= 12 else 8.5
            c.setFont("Times-Bold", font_size)
            c.setFillColor(COLOR_MAROON)

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

            return y - 2

    def _draw_research_section(
        self,
        c: canvas.Canvas,
        width: float,
        start_y: float,
        contribution_statement: str,
        research_title: Optional[str],
        publication_details: Optional[Dict[str, Any]],
    ) -> float:
        """Draws research contribution statement, wrapped publication title, and journal citations."""
        center_x = width / 2.0
        y = start_y - 8

        # Contribution Statement
        c.setFont("Times-Italic", 10.5)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(center_x, y, contribution_statement)
        y -= 14

        # Research Paper Title (Wrapped in quotation marks)
        if research_title:
            cleaned_title = f'“{research_title.strip("“”\' ")}”'
            lines = self._wrap_text(c, cleaned_title, "Times-BoldItalic", 13.0, width - 180)

            c.setFont("Times-BoldItalic", 13.0)
            c.setFillColor(COLOR_NAVY_DARK)
            for line in lines[:3]:  # Max 3 lines
                c.drawCentredString(center_x, y, line)
                y -= 15
        else:
            y -= 4

        # Journal / Indexing Citation Details
        details_str = self._format_citation_line(publication_details)
        if details_str:
            c.setFont("Times-Roman", 9.5)
            c.setFillColor(COLOR_GOLD_ANTIQUE)
            c.drawCentredString(center_x, y, details_str)
            y -= 12

        return y

    def _draw_congratulatory_statement(
        self, c: canvas.Canvas, width: float, start_y: float, statement: str
    ) -> float:
        """Draws commendation closing text."""
        center_x = width / 2.0
        y = start_y - 6
        c.setFont("Times-Italic", 9.5)
        c.setFillColor(COLOR_MUTED)
        lines = self._wrap_text(c, statement, "Times-Italic", 9.5, width - 220)
        for line in lines[:2]:
            c.drawCentredString(center_x, y, line)
            y -= 12
        return y

    def _draw_central_academic_seal(self, c: canvas.Canvas, cx: float, cy: float):
        """Draws central vector medallion with stars, laurels, and CSJMU research motto."""
        # Outer Gold Circle
        c.setStrokeColor(COLOR_GOLD)
        c.setFillColor(COLOR_IVORY)
        c.setLineWidth(1.6)
        c.circle(cx, cy, 32, fill=1, stroke=1)

        # Concentric Beaded Circle
        c.setStrokeColor(COLOR_GOLD_LIGHT)
        c.setLineWidth(0.8)
        c.circle(cx, cy, 28, fill=0, stroke=1)

        # Inner Maroon Core
        c.setStrokeColor(COLOR_GOLD)
        c.setFillColor(COLOR_MAROON)
        c.setLineWidth(1.2)
        c.circle(cx, cy, 23, fill=1, stroke=1)

        # Seal Center Motif
        c.setFont("Times-Bold", 8.0)
        c.setFillColor(COLOR_GOLD_LIGHT)
        c.drawCentredString(cx, cy + 6, "CSJMU")

        c.setFont("Helvetica-Bold", 5.5)
        c.setFillColor(colors.white)
        c.drawCentredString(cx, cy - 2, "SEAL OF")
        c.drawCentredString(cx, cy - 8, "EXCELLENCE")

        # Ribbon under Seal
        p = c.beginPath()
        p.moveTo(cx - 28, cy - 26)
        p.lineTo(cx + 28, cy - 26)
        p.lineTo(cx + 22, cy - 34)
        p.lineTo(cx - 22, cy - 34)
        p.close()
        c.setFillColor(COLOR_GOLD_ANTIQUE)
        c.setStrokeColor(COLOR_GOLD)
        c.drawPath(p, fill=1, stroke=1)

        c.setFont("Helvetica-Bold", 4.5)
        c.setFillColor(colors.white)
        c.drawCentredString(cx, cy - 31, "VERITAS ET SCIENTIA")

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
        sig_y = 100
        line_y = 80

        # Authority 1: Dean - R&D (Left)
        left_x = 135
        # Signature Asset or Stylized Script
        if dean_sig_path and os.path.exists(dean_sig_path):
            try:
                c.drawImage(
                    dean_sig_path,
                    left_x - 50,
                    sig_y - 12,
                    width=100,
                    height=30,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except Exception:
                self._draw_stylized_signature(c, left_x, sig_y, dean_name)
        else:
            self._draw_stylized_signature(c, left_x, sig_y, dean_name)

        # Signature Line
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(1.0)
        c.line(left_x - 70, line_y, left_x + 70, line_y)

        # Signatory Name & Designation
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(COLOR_NAVY_DARK)
        c.drawCentredString(left_x, line_y - 12, dean_name)

        c.setFont("Times-Roman", 9.0)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(left_x, line_y - 23, dean_designation)

        # Authority 2: Vice Chancellor (Right)
        right_x = width - 135
        if vc_sig_path and os.path.exists(vc_sig_path):
            try:
                c.drawImage(
                    vc_sig_path,
                    right_x - 50,
                    sig_y - 12,
                    width=100,
                    height=30,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except Exception:
                self._draw_stylized_signature(c, right_x, sig_y, vc_name)
        else:
            self._draw_stylized_signature(c, right_x, sig_y, vc_name)

        # Signature Line
        c.setStrokeColor(COLOR_GOLD)
        c.setLineWidth(1.0)
        c.line(right_x - 70, line_y, right_x + 70, line_y)

        # Signatory Name & Designation
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(COLOR_NAVY_DARK)
        c.drawCentredString(right_x, line_y - 12, vc_name)

        c.setFont("Times-Roman", 9.0)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(right_x, line_y - 23, vc_designation)

    def _draw_stylized_signature(self, c: canvas.Canvas, cx: float, cy: float, name: str):
        """Renders formal script facsimile signature for official digital verification."""
        c.setFont("Times-BoldItalic", 13.5)
        c.setFillColor(COLOR_MAROON_DEEP)
        c.drawCentredString(cx, cy - 2, name)

    def _draw_security_footer(
        self,
        c: canvas.Canvas,
        width: float,
        height: float,
        *,
        certificate_number: str,
        date_str: str,
        verification_url: str,
        is_preview: bool = False,
    ):
        """Renders live QR code, unique certificate number, date, and verification microtext."""
        footer_y = 35

        # 1. Left: Certificate Number & Date
        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(COLOR_CHARCOAL)
        display_cert_no = f"{certificate_number}  [PREVIEW DRAFT]" if is_preview else certificate_number
        c.drawString(45, footer_y + 8, f"CERTIFICATE NO:  {display_cert_no}")

        c.setFont("Helvetica", 7.5)
        c.setFillColor(COLOR_MUTED)
        c.drawString(45, footer_y - 3, f"DATE OF ISSUANCE:  {date_str}")
        c.drawString(45, footer_y - 13, "Chhatrapati Shahu Ji Maharaj University, Kalyanpur, Kanpur - 208024")

        # 2. Right: Live QR Code & Verification Instructions
        qr_size = 44
        qr_x = width - 45 - qr_size
        qr_y = footer_y - 14

        # Draw QR Code using ReportLab built-in QrCodeWidget
        try:
            qr = QrCodeWidget(verification_url)
            d = Drawing(qr_size, qr_size)
            d.add(qr)
            # Scale QR code to box
            qr.barWidth = qr_size / 29.0
            qr.barHeight = qr_size / 29.0
            d.drawOn(c, qr_x, qr_y)
        except Exception:
            # Fallback if barcode fails
            c.setStrokeColor(COLOR_GOLD)
            c.setFillColor(COLOR_IVORY)
            c.rect(qr_x, qr_y, qr_size, qr_size, fill=1, stroke=1)
            c.setFont("Helvetica-Bold", 6)
            c.setFillColor(COLOR_MAROON)
            c.drawCentredString(qr_x + qr_size / 2, qr_y + qr_size / 2, "QR CODE")

        # Text beside QR Code
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(COLOR_NAVY_DARK)
        if is_preview:
            c.drawRightString(qr_x - 8, footer_y + 6, "PREVIEW PLACEHOLDER • NOT ISSUED")
        else:
            c.drawRightString(qr_x - 8, footer_y + 6, "SAMIKSHA SECURE VERIFICATION")

        c.setFont("Helvetica", 6.5)
        c.setFillColor(COLOR_MUTED)
        if is_preview:
            c.drawRightString(qr_x - 8, footer_y - 4, "Preview verification placeholder • Live verification active upon issue")
            c.drawRightString(qr_x - 8, footer_y - 13, "Tamper-evident cryptographic SHA-256 protected draft")
        else:
            c.drawRightString(qr_x - 8, footer_y - 4, "Scan with any camera or visit official SAMIKSHA portal")
            c.drawRightString(qr_x - 8, footer_y - 13, "Tamper-evident cryptographic SHA-256 protected document")

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

    def _format_citation_line(self, pub_details: Optional[Dict[str, Any]]) -> str:
        """Formats journal citation line: Journal, Volume, Issue, DOI, Scopus Indexed."""
        if not pub_details:
            return ""

        parts = []
        journal = pub_details.get("journal") or pub_details.get("source_journal")
        if journal:
            parts.append(f"Published in: {journal}")

        volume = pub_details.get("volume")
        issue = pub_details.get("issue")
        if volume and issue:
            parts.append(f"Vol. {volume}, Iss. {issue}")
        elif volume:
            parts.append(f"Vol. {volume}")

        year = pub_details.get("year")
        if year:
            parts.append(f"({year})")

        doi = pub_details.get("doi")
        if doi:
            parts.append(f"DOI: {doi}")

        indexing = pub_details.get("indexing") or "Scopus Indexed"
        if indexing:
            parts.append(f"[{indexing}]")

        return " • ".join(parts)


# Global singleton instance
certificate_pdf_engine = CertificatePDFEngine()
