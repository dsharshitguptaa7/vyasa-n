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


def draw_scholarly_watermark(c: canvas.Canvas, cx: float, cy: float):
    """
    Draws a subtle, high-prestige academic research watermark in the central background.
    Includes laurel branches, open knowledge monograph, and radiating academic excellence motif.
    Low opacity (0.05) ensures complete legibility while filling empty space with elegance.
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
            # Approximate arc points
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
    # Left page curve
    p_bk.moveTo(cx, bk_y + 4)
    p_bk.curveTo(cx - 16, bk_y + 10, cx - 28, bk_y + 6, bk_x, bk_y + book_h * 0.8)
    p_bk.lineTo(bk_x, bk_y + book_h)
    p_bk.curveTo(cx - 28, bk_y + book_h * 0.85, cx - 16, bk_y + book_h * 0.9, cx, bk_y + book_h)
    # Right page curve
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


def wrap_text(c: canvas.Canvas, text: str, font_name: str, font_size: float, max_width: float) -> List[str]:
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


def draw_fitted_text(c: canvas.Canvas, text: str, x: float, y: float, max_w: float, font_name: str = "Helvetica-Bold", base_size: float = 8.5):
    """Draws text scaled down if necessary to strictly guarantee it never exceeds max_w."""
    sw = c.stringWidth(text, font_name, base_size)
    if sw <= max_w:
        c.setFont(font_name, base_size)
        c.drawString(x, y, text)
        return

    scale = max_w / sw
    fitted_size = max(6.5, base_size * scale)
    sw2 = c.stringWidth(text, font_name, fitted_size)
    if sw2 <= max_w:
        c.setFont(font_name, fitted_size)
        c.drawString(x, y, text)
        return

    # Truncate with ellipsis if still overflowing at minimum font size
    trunc = text
    while len(trunc) > 3 and c.stringWidth(trunc + "…", font_name, fitted_size) > max_w:
        trunc = trunc[:-1]
    c.setFont(font_name, fitted_size)
    c.drawString(x, y, trunc + "…")


def render_balanced_certificate(
    out_pdf_path: str,
    *,
    certificate_number: str = "CSJMU/SAMIKSHA/2026/000002",
    recipient_name: str = "Dr. Harshit Gupta",
    department: str = "Department of Research",
    research_title: str = "XYZ",
    bulletin_volume: Optional[int] = 2,
    bulletin_issue: Optional[int] = 3,
    bulletin_period: Optional[str] = "January – June 2026",
    date_str: str = "November 14, 2026",
    verification_token: str = "tok-csjmu-res-2026-000002",
    verification_url: str = "https://samiksha.csjmu.ac.in/verify/tok-csjmu-res-2026-000002",
    certificate_type: str = "RESEARCH_PUBLICATION",
    incentive_amount: Optional[int] = None,
    sanction_ref: Optional[str] = None,
):
    width, height = landscape(A4)  # 841.89 x 595.28 pt
    c = canvas.Canvas(out_pdf_path, pagesize=(width, height))
    center_x = width / 2.0

    # 1. Warm Ivory Background
    c.setFillColor(COLOR_IVORY)
    c.rect(0, 0, width, height, stroke=0, fill=1)

    # 2. Multi-Tier Gold Borders & Corner Ornaments
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

    # 4. Subtle Left Margin Research Books Motif
    draw_research_books_watermark(c, 34, 165)

    # 5. Subtle Academic Research Watermark in Central Background (fills vertical space elegantly)
    draw_scholarly_watermark(c, center_x, 225)

    # 6. Official University Header
    top_y = height - 36  # ~559.28 pt

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

    # Gold Pill Badge
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

    # 7. Certificate Title (Two Lines with Harmonious Spacing)
    title_line1_y = pill_y - 28  # ~481 pt
    title_line2_y = title_line1_y - 22  # ~459 pt
    c.setFont("Times-Bold", 20.0)
    c.setFillColor(COLOR_NAVY_TITLE)
    if certificate_type == "INCENTIVE_AWARD":
        c.drawCentredString(center_x, title_line1_y, "CERTIFICATE OF RESEARCH PUBLICATION")
        c.drawCentredString(center_x, title_line2_y, "INCENTIVE AWARD")
    else:
        c.drawCentredString(center_x, title_line1_y, "CERTIFICATE OF APPRECIATION &")
        c.drawCentredString(center_x, title_line2_y, "RESEARCH EXCELLENCE")

    # 8. Presentation Statement
    pres_y = title_line2_y - 28  # ~431 pt
    c.setFont("Times-Italic", 11.5)
    c.setFillColor(COLOR_MUTED)
    pres_stmt = "This certificate is proudly awarded to" if certificate_type == "INCENTIVE_AWARD" else "This certificate is proudly conferred upon"
    c.drawCentredString(center_x, pres_y, pres_stmt)

    # 9. Recipient Name & Department
    recip_y = pres_y - 28  # ~403 pt
    c.setFont("Times-Bold", 24.0)
    c.setFillColor(COLOR_BURGUNDY_BRIGHT)
    c.drawCentredString(center_x, recip_y, recipient_name)

    dept_y = recip_y - 16  # ~387 pt
    c.setFont("Helvetica-Bold", 10.0)
    c.setFillColor(COLOR_CHARCOAL)
    c.drawCentredString(center_x, dept_y, department)

    # 10. Research Recognition Statement
    recog_y = dept_y - 28  # ~359 pt
    c.setFont("Times-Italic", 10.0)
    c.setFillColor(COLOR_MUTED)
    recog_stmt = "in recognition of distinguished research productivity and publication incentive for:" if certificate_type == "INCENTIVE_AWARD" else "in recognition of scholarly research publication titled:"
    c.drawCentredString(center_x, recog_y, recog_stmt)

    # 11. Research Paper Title (Wrapped)
    paper_title_y = recog_y - 20  # ~339 pt
    clean_title = f'“{research_title.strip("“”\' ")}”'
    title_lines = wrap_text(c, clean_title, "Times-BoldItalic", 13.5, width - 200)

    c.setFont("Times-BoldItalic", 13.5)
    c.setFillColor(COLOR_NAVY_TITLE)
    curr_paper_y = paper_title_y
    for line in title_lines[:3]:
        c.drawCentredString(center_x, curr_paper_y, line)
        curr_paper_y -= 17

    # 12. Commendation Line
    comm_y = curr_paper_y - 6  # ~298 pt
    c.setFont("Times-Italic", 9.0)
    c.setFillColor(COLOR_MUTED)
    c.drawCentredString(center_x, comm_y, "The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.")

    # 13. Centered Dual-Column Metadata Box (Grid Layout)
    # Using 480 pt width divided into two 240 pt equal columns with vertical divider
    box_w = 480.0
    box_h = 44.0
    box_x = center_x - box_w / 2.0  # 420.95 - 240 = 180.95 pt
    box_y = comm_y - 56.0  # ~242 pt down to ~198 pt

    c.setFillColor(COLOR_BOX_BG)
    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(1.0)
    c.roundRect(box_x, box_y, box_w, box_h, 6, fill=1, stroke=1)

    # Vertical divider at center_x
    c.setStrokeColor(COLOR_GOLD_LIGHT)
    c.setLineWidth(0.8)
    c.line(center_x, box_y + 5, center_x, box_y + box_h - 5)

    # Left Column: box_x to center_x (width = 240 pt)
    col1_start_x = box_x + 14.0
    icon_sz = 18.0
    text1_x = col1_start_x + icon_sz + 10.0  # box_x + 42.0 pt
    col1_max_w = (center_x - 14.0) - text1_x  # 240 - 42 - 14 = 184 pt!

    # Right Column: center_x to box_x + box_w (width = 240 pt)
    col2_start_x = center_x + 14.0
    text2_x = col2_start_x + icon_sz + 10.0  # center_x + 42.0 pt
    col2_max_w = (box_x + box_w - 14.0) - text2_x  # 240 - 42 - 14 = 184 pt!

    if certificate_type == "INCENTIVE_AWARD":
        # Left: Incentive Award Amount
        draw_book_icon(c, col1_start_x, box_y + 13, size=icon_sz)
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(COLOR_MUTED)
        c.drawString(text1_x, box_y + 26, "SANCTIONED INCENTIVE AWARD")

        c.setFillColor(COLOR_NAVY_TITLE)
        amt_str = f"INR {incentive_amount:,}" if incentive_amount else "Approved Incentive"
        if sanction_ref:
            amt_str += f"  •  Ref: {sanction_ref}"
        draw_fitted_text(c, amt_str, text1_x, box_y + 11, col1_max_w, font_name="Helvetica-Bold", base_size=8.5)

        # Right: Bulletin Citation
        draw_calendar_icon(c, col2_start_x, box_y + 13, size=icon_sz)
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(COLOR_MUTED)
        c.drawString(text2_x, box_y + 26, "RESEARCH BULLETIN CITATION")

        c.setFillColor(COLOR_NAVY_TITLE)
        b_str = f"Volume {bulletin_volume}, Issue {bulletin_issue}" if bulletin_volume and bulletin_issue else "CSJMU Research Bulletin"
        if bulletin_period:
            b_str += f" ({bulletin_period})"
        draw_fitted_text(c, b_str, text2_x, box_y + 11, col2_max_w, font_name="Helvetica-Bold", base_size=8.5)

    else:
        # Left: Research Bulletin Volume/Issue
        draw_book_icon(c, col1_start_x, box_y + 13, size=icon_sz)
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(COLOR_MUTED)
        c.drawString(text1_x, box_y + 26, "RESEARCH BULLETIN")

        c.setFillColor(COLOR_NAVY_TITLE)
        b_str = f"Volume {bulletin_volume}, Issue {bulletin_issue}" if bulletin_volume and bulletin_issue else "CSJMU Research Bulletin"
        if bulletin_period:
            b_str += f" ({bulletin_period})"
        draw_fitted_text(c, b_str, text1_x, box_y + 11, col1_max_w, font_name="Helvetica-Bold", base_size=8.5)

        # Right: Date of Issuance
        draw_calendar_icon(c, col2_start_x, box_y + 13, size=icon_sz)
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(COLOR_MUTED)
        c.drawString(text2_x, box_y + 26, "DATE OF ISSUANCE")

        c.setFillColor(COLOR_NAVY_TITLE)
        draw_fitted_text(c, date_str, text2_x, box_y + 11, col2_max_w, font_name="Helvetica-Bold", base_size=8.5)

    # 14. Central Academic Seal Medallion (Elevated to y = 100 pt)
    seal_cx = center_x
    seal_cy = 100
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

    # 15. Signing Authorities (Elevated to sig_line_y = 98 pt)
    sig_line_y = 98

    # Authority 1: Dean R&D
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

    # Authority 2: Vice Chancellor
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

    # 16. Elevated Dedicated QR Code Panel
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
    print(f"Generated balanced certificate: {out_pdf_path}")


out_dir = r"C:\Users\harsh\.gemini\antigravity\brain\e90803ef-432d-4cee-be21-9af6a6b6ad21"
research_pdf = os.path.join(out_dir, "modern_research_work_certificate.pdf")
incentive_pdf = os.path.join(out_dir, "modern_incentive_award_certificate.pdf")

render_balanced_certificate(
    research_pdf,
    certificate_number="CSJMU/SAMIKSHA/2026/000002",
    recipient_name="Dr. Harshit Gupta",
    department="Department of Research",
    research_title="XYZ",
    bulletin_volume=2,
    bulletin_issue=3,
    bulletin_period="January – June 2026",
    date_str="November 14, 2026",
    verification_token="tok-csjmu-res-2026-000002",
    verification_url="https://samiksha.csjmu.ac.in/verify/tok-csjmu-res-2026-000002",
    certificate_type="RESEARCH_PUBLICATION",
)

render_balanced_certificate(
    incentive_pdf,
    certificate_number="CSJMU/SAMIKSHA/2026/INC-000002",
    recipient_name="Dr. Harshit Gupta",
    department="Department of Research",
    research_title="CRISPR-Cas12 Targeted Epigenetic Editing for Enhanced Plant Resilience",
    bulletin_volume=2,
    bulletin_issue=3,
    bulletin_period="July – December 2026",
    date_str="November 14, 2026",
    verification_token="tok-csjmu-inc-2026-000002",
    verification_url="https://samiksha.csjmu.ac.in/verify/tok-csjmu-inc-2026-000002",
    certificate_type="INCENTIVE_AWARD",
    incentive_amount=50000,
    sanction_ref="CSJMU/R&D/INC-2026/089",
)
