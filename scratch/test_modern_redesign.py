import hashlib
import io
import math
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget

# Palette
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

assets_dir = Path(r"C:\Projects\VYASA\assets")
csjmu_logo_path = assets_dir / "branding" / "csjmu" / "csjmu-logo.png"
naac_logo_path = assets_dir / "branding" / "naac-A-Plus-Plus.png"
dean_sig_path = Path(r"C:\Projects\VYASA\backend\storage\sama_veda\signatures\4b6d1a399321_signature_3d1cf972-6e9b-48cf-8308-22322574f94e_1794595937.png")
vc_sig_path = Path(r"C:\Projects\VYASA\backend\storage\sama_veda\signatures\84718e7f0a8e_signature_3c90e01f-4866-4eaf-94da-d32a0c18a42d_1794595893.png")

def draw_book_icon(c: canvas.Canvas, x: float, y: float, size: float = 18):
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

def draw_calendar_icon(c: canvas.Canvas, x: float, y: float, size: float = 18):
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

def draw_research_books_watermark(c: canvas.Canvas, x: float, y: float):
    """Draws classical vector stacked research monographs on the left margin."""
    c.saveState()
    line_color = colors.Color(0.68, 0.50, 0.16, alpha=0.35)
    fill_color = colors.Color(0.88, 0.80, 0.55, alpha=0.12)
    
    c.setStrokeColor(line_color)
    c.setFillColor(fill_color)
    c.setLineWidth(0.75)

    b1_w, b1_h = 105, 20
    b1_x, b1_y = x, y
    c.roundRect(b1_x, b1_y, b1_w, b1_h, 3, fill=1, stroke=1)
    c.line(b1_x + 12, b1_y, b1_x + 12, b1_y + b1_h)
    c.line(b1_x + 14, b1_y, b1_x + 14, b1_y + b1_h)
    for i in range(1, 4):
        c.line(b1_x + 22, b1_y + i * 5, b1_x + b1_w - 4, b1_y + i * 5)

    b2_w, b2_h = 92, 18
    b2_x, b2_y = x + 4, y + 21
    c.roundRect(b2_x, b2_y, b2_w, b2_h, 3, fill=1, stroke=1)
    c.line(b2_x + 12, b2_y, b2_x + 12, b2_y + b2_h)
    c.line(b2_x + 14, b2_y, b2_x + 14, b2_y + b2_h)
    for i in range(1, 4):
        c.line(b2_x + 22, b2_y + i * 4.5, b2_x + b2_w - 4, b2_y + i * 4.5)

    p_rib = c.beginPath()
    p_rib.moveTo(b2_x + 38, b2_y)
    p_rib.lineTo(b2_x + 40, b1_y - 6)
    p_rib.lineTo(b2_x + 43, b1_y - 2)
    p_rib.lineTo(b2_x + 46, b1_y - 6)
    p_rib.lineTo(b2_x + 44, b2_y)
    p_rib.close()
    c.setFillColor(colors.Color(0.60, 0.15, 0.20, alpha=0.35))
    c.drawPath(p_rib, fill=1, stroke=0)

    b3_w, b3_h = 82, 16
    b3_x, b3_y = x + 8, y + 40
    c.setFillColor(fill_color)
    c.roundRect(b3_x, b3_y, b3_w, b3_h, 3, fill=1, stroke=1)
    c.line(b3_x + 11, b3_y, b3_x + 11, b3_y + b3_h)
    for i in range(1, 3):
        c.line(b3_x + 20, b3_y + i * 5, b3_x + b3_w - 4, b3_y + i * 5)

    c.restoreState()

def render_modern_certificate(
    out_pdf_path: str,
    *,
    certificate_number: str = "CSJMU/SAMIKSHA/2026/000002",
    recipient_name: str = "Dr. Harshit Gupta",
    department: str = "Department of Research",
    research_title: str = "XYZ",
    bulletin_edition: str = "Volume 2, Issue 3",
    date_str: str = "November 14, 2026",
    verification_token: str = "tok-modern-cert-000002",
    verification_url: str = "https://samiksha.csjmu.ac.in/verify/tok-modern-cert-000002",
    certificate_type: str = "RESEARCH_PUBLICATION",
    incentive_amount: Optional[int] = None,
    sanction_ref: Optional[str] = None,
):
    width, height = landscape(A4)
    c = canvas.Canvas(out_pdf_path, pagesize=(width, height))
    center_x = width / 2.0

    # 1. Warm Ivory Background
    c.setFillColor(COLOR_IVORY)
    c.rect(0, 0, width, height, stroke=0, fill=1)

    # 2. Border System
    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(1.2)
    c.rect(16, 16, width - 32, height - 32, stroke=1, fill=0)

    c.setStrokeColor(COLOR_GOLD)
    c.setLineWidth(1.8)
    c.rect(22, 22, width - 44, height - 44, stroke=1, fill=0)

    c.setStrokeColor(COLOR_GOLD_BORDER)
    c.setLineWidth(0.6)
    c.rect(25, 25, width - 50, height - 50, stroke=1, fill=0)

    corners = [(22, 22), (width - 22, 22), (22, height - 22), (width - 22, height - 22)]
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

    # 3. Bottom Solid Burgundy Ribbon Bar
    ribbon_y = 22
    ribbon_h = 22
    c.setFillColor(COLOR_BURGUNDY)
    c.rect(22, ribbon_y, width - 44, ribbon_h, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(colors.white)
    c.drawString(42, ribbon_y + 7.5, f"Certificate No.: {certificate_number}")

    c.setFillColor(colors.Color(1, 1, 1, alpha=0.5))
    c.drawCentredString(center_x, ribbon_y + 7.5, "|")

    c.setFont("Helvetica-Bold", 7.2)
    c.setFillColor(colors.white)
    c.drawRightString(width - 42, ribbon_y + 7.5, "🛡  Tamper-evident • Cryptographically Verified (SHA-256)")

    # 4. Subtle Research Stacked Books Motif on Left
    draw_research_books_watermark(c, 34, 155)

    # 5. Header Area
    top_y = height - 38

    logo_w, logo_h = 54, 58
    if csjmu_logo_path.exists():
        c.drawImage(str(csjmu_logo_path), 46, top_y - logo_h + 4, width=logo_w, height=logo_h, preserveAspectRatio=True, mask="auto")

    naac_w, naac_h = 72, 48
    if naac_logo_path.exists():
        c.drawImage(str(naac_logo_path), width - 46 - naac_w, top_y - naac_h + 4, width=naac_w, height=naac_h, preserveAspectRatio=True, mask="auto")

    c.setFont("Times-Bold", 16.5)
    c.setFillColor(COLOR_BURGUNDY)
    c.drawCentredString(center_x, top_y - 2, "CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR")

    c.setFont("Helvetica", 8.5)
    c.setFillColor(COLOR_CHARCOAL)
    c.drawCentredString(center_x, top_y - 16, "Kanpur, Uttar Pradesh, India • Established 1966 • Accredited A++ by NAAC")

    c.setFont("Helvetica-Bold", 9.0)
    c.setFillColor(COLOR_BURGUNDY)
    c.drawCentredString(center_x, top_y - 30, "RESEARCH & DEVELOPMENT CELL")

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
    badge_label = "SAMIKSHA – SCHOLARLY FELICITATION" if certificate_type == "RESEARCH_PUBLICATION" else "SAMIKSHA – INCENTIVE SCHEME AWARD"
    c.drawCentredString(center_x, pill_y + 4.5, badge_label)

    # 6. Certificate Title
    title_y = pill_y - 26
    c.setFont("Times-Bold", 20.0)
    c.setFillColor(COLOR_NAVY_TITLE)
    if certificate_type == "INCENTIVE_AWARD":
        c.drawCentredString(center_x, title_y, "CERTIFICATE OF RESEARCH PUBLICATION")
        c.drawCentredString(center_x, title_y - 22, "INCENTIVE AWARD")
        pres_y = title_y - 44
    else:
        c.drawCentredString(center_x, title_y, "CERTIFICATE OF APPRECIATION &")
        c.drawCentredString(center_x, title_y - 22, "RESEARCH EXCELLENCE")
        pres_y = title_y - 44

    # 7. Presentation Statement
    c.setFont("Times-Italic", 11.0)
    c.setFillColor(COLOR_MUTED)
    pres_stmt = "This certificate is proudly awarded to" if certificate_type == "INCENTIVE_AWARD" else "This certificate is proudly conferred upon"
    c.drawCentredString(center_x, pres_y, pres_stmt)

    # 8. Recipient Name & Department
    recip_y = pres_y - 24
    c.setFont("Times-Bold", 23.0)
    c.setFillColor(COLOR_BURGUNDY_BRIGHT)
    c.drawCentredString(center_x, recip_y, recipient_name)

    c.setFont("Helvetica-Bold", 10.0)
    c.setFillColor(COLOR_CHARCOAL)
    c.drawCentredString(center_x, recip_y - 14, department)

    # 9. Research Recognition Statement & Title
    recog_y = recip_y - 32
    c.setFont("Times-Italic", 9.5)
    c.setFillColor(COLOR_MUTED)
    recog_stmt = "in recognition of distinguished research productivity and publication incentive for:" if certificate_type == "INCENTIVE_AWARD" else "in recognition of scholarly research publication titled:"
    c.drawCentredString(center_x, recog_y, recog_stmt)

    title_y = recog_y - 17
    c.setFont("Times-BoldItalic", 13.5)
    c.setFillColor(COLOR_NAVY_TITLE)
    clean_title = f'“{research_title.strip("“”\' ")}”'
    c.drawCentredString(center_x, title_y, clean_title)

    comm_y = title_y - 15
    c.setFont("Times-Italic", 8.5)
    c.setFillColor(COLOR_MUTED)
    c.drawCentredString(center_x, comm_y, "The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.")

    # 10. Middle Dual-Column Metadata Box
    box_w = 360
    box_h = 40
    box_x = center_x - box_w / 2
    box_y = comm_y - 46

    c.setFillColor(COLOR_BOX_BG)
    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(1.0)
    c.roundRect(box_x, box_y, box_w, box_h, 6, fill=1, stroke=1)

    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(0.8)
    c.line(center_x, box_y + 5, center_x, box_y + box_h - 5)

    if certificate_type == "INCENTIVE_AWARD":
        draw_book_icon(c, box_x + 18, box_y + 11, size=18)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(COLOR_MUTED)
        c.drawString(box_x + 44, box_y + 23, "Sanctioned Incentive Award")
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(COLOR_NAVY_TITLE)
        amt_str = f"INR {incentive_amount:,}" if incentive_amount else "Approved Grant"
        if sanction_ref:
            amt_str += f"  •  Ref: {sanction_ref}"
        c.drawString(box_x + 44, box_y + 10, amt_str)

        draw_calendar_icon(c, center_x + 18, box_y + 11, size=18)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(COLOR_MUTED)
        c.drawString(center_x + 44, box_y + 23, "Research Bulletin Citation")
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(COLOR_NAVY_TITLE)
        c.drawString(center_x + 44, box_y + 10, bulletin_edition)
    else:
        draw_book_icon(c, box_x + 24, box_y + 11, size=18)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(COLOR_MUTED)
        c.drawString(box_x + 50, box_y + 23, "Research Bulletin")
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(COLOR_NAVY_TITLE)
        c.drawString(box_x + 50, box_y + 10, bulletin_edition)

        draw_calendar_icon(c, center_x + 24, box_y + 11, size=18)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(COLOR_MUTED)
        c.drawString(center_x + 50, box_y + 23, "Date of Issuance")
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(COLOR_NAVY_TITLE)
        c.drawString(center_x + 50, box_y + 10, date_str)

    # 11. Central Academic Seal Medallion
    seal_cx = center_x
    seal_cy = 76
    c.setStrokeColor(COLOR_GOLD)
    c.setFillColor(COLOR_IVORY)
    c.setLineWidth(1.4)
    c.circle(seal_cx, seal_cy, 22, fill=1, stroke=1)
    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(0.7)
    c.circle(seal_cx, seal_cy, 19, fill=0, stroke=1)
    c.setFillColor(COLOR_BURGUNDY)
    c.circle(seal_cx, seal_cy, 16, fill=1, stroke=0)
    c.setFont("Times-Bold", 5.5)
    c.setFillColor(COLOR_GOLD_LIGHT)
    c.drawCentredString(seal_cx, seal_cy + 4, "CSJMU")
    c.setFont("Helvetica-Bold", 3.8)
    c.setFillColor(colors.white)
    c.drawCentredString(seal_cx, seal_cy - 2, "SEAL OF")
    c.drawCentredString(seal_cx, seal_cy - 7, "EXCELLENCE")

    p_rib = c.beginPath()
    p_rib.moveTo(seal_cx - 18, seal_cy - 16)
    p_rib.lineTo(seal_cx + 18, seal_cy - 16)
    p_rib.lineTo(seal_cx + 14, seal_cy - 22)
    p_rib.lineTo(seal_cx - 14, seal_cy - 22)
    p_rib.close()
    c.setFillColor(COLOR_GOLD)
    c.drawPath(p_rib, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 3.2)
    c.setFillColor(colors.white)
    c.drawCentredString(seal_cx, seal_cy - 20, "VERITAS ET SCIENTIA")

    # 12. Signing Authorities
    sig_line_y = 74

    left_x = 155
    if dean_sig_path.exists():
        c.drawImage(str(dean_sig_path), left_x - 38, sig_line_y + 4, width=76, height=28, preserveAspectRatio=True, mask="auto")
    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(0.8)
    c.line(left_x - 65, sig_line_y, left_x + 65, sig_line_y)
    c.setFont("Times-Bold", 9.5)
    c.setFillColor(COLOR_NAVY_TITLE)
    c.drawCentredString(left_x, sig_line_y - 12, "Prof. Namita Tiwari")
    c.setFont("Helvetica", 8.0)
    c.setFillColor(COLOR_CHARCOAL)
    c.drawCentredString(left_x, sig_line_y - 22, "Dean, Research & Development")

    right_x = 585
    if vc_sig_path.exists():
        c.drawImage(str(vc_sig_path), right_x - 42, sig_line_y + 4, width=84, height=28, preserveAspectRatio=True, mask="auto")
    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(0.8)
    c.line(right_x - 65, sig_line_y, right_x + 65, sig_line_y)
    c.setFont("Times-Bold", 9.5)
    c.setFillColor(COLOR_NAVY_TITLE)
    c.drawCentredString(right_x, sig_line_y - 12, "Prof. Vinay Kumar Pathak")
    c.setFont("Helvetica", 8.0)
    c.setFillColor(COLOR_CHARCOAL)
    c.drawCentredString(right_x, sig_line_y - 22, "Vice Chancellor")

    # 13. Dedicated QR Code Panel
    qr_card_x = width - 24 - 72
    qr_card_y = 52
    qr_card_w = 68
    qr_card_h = 76

    c.setFillColor(colors.white)
    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(0.75)
    c.roundRect(qr_card_x, qr_card_y, qr_card_w, qr_card_h, 4, fill=1, stroke=1)

    qr_size = 48
    qr_x = qr_card_x + (qr_card_w - qr_size) / 2
    qr_y = qr_card_y + 24
    qr = QrCodeWidget(verification_url)
    bounds = qr.getBounds()
    w = bounds[2] - bounds[0]
    h = bounds[3] - bounds[1]
    scale = qr_size / max(w, h)
    d = Drawing(qr_size, qr_size, transform=[scale, 0, 0, scale, -bounds[0] * scale, -bounds[1] * scale])
    d.add(qr)
    d.drawOn(c, qr_x, qr_y)

    pill_w = 56
    pill_h = 11.5
    pill_x = qr_card_x + (qr_card_w - pill_w) / 2
    pill_y = qr_card_y + 11
    c.setFillColor(COLOR_BURGUNDY)
    c.roundRect(pill_x, pill_y, pill_w, pill_h, 3, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 6.0)
    c.setFillColor(colors.white)
    c.drawCentredString(qr_card_x + qr_card_w / 2, pill_y + 3.2, "Scan to Verify")

    c.setFont("Helvetica-Bold", 5.2)
    c.setFillColor(COLOR_NAVY_TITLE)
    c.drawCentredString(qr_card_x + qr_card_w / 2, qr_card_y + 5.5, "Official SAMIKSHA")
    c.setFont("Helvetica", 4.8)
    c.setFillColor(COLOR_MUTED)
    c.drawCentredString(qr_card_x + qr_card_w / 2, qr_card_y + 1.2, "Certificate Verification")

    c.showPage()
    c.save()
    print(f"Generated Modern PDF: {out_pdf_path}")

out_dir = r"C:\Users\harsh\.gemini\antigravity\brain\e90803ef-432d-4cee-be21-9af6a6b6ad21"
research_pdf = os.path.join(out_dir, "modern_research_work_certificate.pdf")
incentive_pdf = os.path.join(out_dir, "modern_incentive_award_certificate.pdf")

render_modern_certificate(
    research_pdf,
    certificate_number="CSJMU/SAMIKSHA/2026/000002",
    recipient_name="Dr. Harshit Gupta",
    department="Department of Research",
    research_title="XYZ",
    bulletin_edition="Volume 2, Issue 3",
    date_str="November 14, 2026",
    verification_token="tok-csjmu-res-2026-000002",
    verification_url="https://samiksha.csjmu.ac.in/verify/tok-csjmu-res-2026-000002",
    certificate_type="RESEARCH_PUBLICATION",
)

render_modern_certificate(
    incentive_pdf,
    certificate_number="CSJMU/SAMIKSHA/2026/INC-000002",
    recipient_name="Dr. Harshit Gupta",
    department="Department of Research",
    research_title="CRISPR-Cas12 Targeted Epigenetic Editing for Enhanced Plant Resilience",
    bulletin_edition="Volume 2, Issue 3",
    date_str="November 14, 2026",
    verification_token="tok-csjmu-inc-2026-000002",
    verification_url="https://samiksha.csjmu.ac.in/verify/tok-csjmu-inc-2026-000002",
    certificate_type="INCENTIVE_AWARD",
    incentive_amount=50000,
    sanction_ref="CSJMU/R&D/INC-2026/089",
)
