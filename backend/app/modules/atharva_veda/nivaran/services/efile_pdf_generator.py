import io
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# Visual Identity Palette
COLOR_PRIMARY = colors.HexColor("#5B1021")       # CSJMU Maroon
COLOR_PRIMARY_DARK = colors.HexColor("#3B0714")  # Deep Maroon
COLOR_NAVY = colors.HexColor("#1E293B")          # Slate Navy
COLOR_BG = colors.HexColor("#F8FAFC")            # Soft Slate Background
COLOR_TEXT = colors.HexColor("#0F172A")          # Dark Body
COLOR_MUTED = colors.HexColor("#64748B")         # Secondary Slate
COLOR_BORDER = colors.HexColor("#CBD5E1")        # Border Slate
COLOR_GOLD = colors.HexColor("#B45309")          # Accent Amber Gold


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render total page count
    along with running header and footer on all content pages.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(COLOR_MUTED)

        # Running Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 11 * 72 - 36, "VYASA ECOSYSTEM — NIVARAN-AI OFFICIAL E-FILE DOSSIER")
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(0.5)
            self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)

        # Running Footer (all pages)
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.5)
        self.line(54, 45, 8.5 * 72 - 54, 45)

        self.drawString(
            54,
            32,
            "CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR • ATHARVA VEDA / NIVARAN-AI",
        )
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(8.5 * 72 - 54, 32, page_str)
        self.restoreState()


def create_efile_pdf(snapshot: Dict[str, Any], output_path: str) -> int:
    """
    Generates the official institutional E-File PDF dossier.
    Returns the total page count.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom Typography Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=COLOR_PRIMARY,
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=COLOR_MUTED,
        alignment=1,
    )
    section_h1 = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=COLOR_PRIMARY_DARK,
        spaceBefore=10,
        spaceAfter=6,
    )
    label_style = ParagraphStyle(
        "LabelStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=COLOR_MUTED,
    )
    val_style = ParagraphStyle(
        "ValStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=COLOR_TEXT,
    )
    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=COLOR_TEXT,
    )

    story = []

    # 1. Header Banner
    story.append(Spacer(1, 10))
    story.append(Paragraph("CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR", title_style))
    story.append(Spacer(1, 4))
    story.append(
        Paragraph("VYASA ECOSYSTEM • ATHARVA VEDA / NIVARAN-AI DIGITAL E-FILE DOSSIER", subtitle_style)
    )
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY, spaceBefore=4, spaceAfter=14))

    # 2. Executive Metadata Box
    grv = snapshot.get("grievance", {})
    applicant = snapshot.get("applicant", {})
    efile_meta = snapshot.get("efile_metadata", {})

    meta_data = [
        [
            Paragraph("<b>E-File Number:</b>", label_style),
            Paragraph(efile_meta.get("e_file_number", "PENDING"), val_style),
            Paragraph("<b>Tracking ID:</b>", label_style),
            Paragraph(grv.get("grievance_id", "N/A"), val_style),
        ],
        [
            Paragraph("<b>Scholar Name:</b>", label_style),
            Paragraph(applicant.get("full_name", "N/A"), val_style),
            Paragraph("<b>PhD Registration No:</b>", label_style),
            Paragraph(applicant.get("registration_number") or "N/A", val_style),
        ],
        [
            Paragraph("<b>Academic Subject:</b>", label_style),
            Paragraph(grv.get("subject_name", "N/A"), val_style),
            Paragraph("<b>Category:</b>", label_style),
            Paragraph(grv.get("category_name", "N/A"), val_style),
        ],
        [
            Paragraph("<b>Priority:</b>", label_style),
            Paragraph(grv.get("priority", "N/A"), val_style),
            Paragraph("<b>Case Status:</b>", label_style),
            Paragraph(f"<b>{grv.get('status', 'CLOSED')}</b>", val_style),
        ],
        [
            Paragraph("<b>Submission Date:</b>", label_style),
            Paragraph(str(grv.get("created_at") or "N/A")[:19], val_style),
            Paragraph("<b>Final Closure Date:</b>", label_style),
            Paragraph(str(grv.get("closed_at") or "N/A")[:19], val_style),
        ],
    ]

    meta_table = Table(meta_data, colWidths=[110, 142, 120, 132])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG),
            ("BOX", (0, 0), (-1, -1), 1, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 16))

    # 3. Original Grievance Section
    story.append(Paragraph("1. GRIEVANCE NARRATIVE & SUBMISSION", section_h1))
    story.append(
        Paragraph(f"<b>Title:</b> {grv.get('title', 'N/A')}", body_style)
    )
    story.append(Spacer(1, 6))
    desc_p = Paragraph(f"<b>Factual Narrative:</b><br/>{grv.get('description', 'N/A')}", body_style)
    story.append(desc_p)
    story.append(Spacer(1, 14))

    # 4. Institutional Resolution Section
    res = snapshot.get("resolution", {})
    story.append(Paragraph("2. OFFICIAL INSTITUTIONAL RESOLUTION", section_h1))
    res_data = [
        [Paragraph("<b>Resolved By:</b>", label_style), Paragraph(res.get("resolved_by_name", "Authority"), val_style)],
        [Paragraph("<b>Resolved At:</b>", label_style), Paragraph(str(res.get("resolved_at") or "N/A")[:19], val_style)],
        [
            Paragraph("<b>Resolution Findings:</b>", label_style),
            Paragraph(res.get("resolution_summary") or "Resolution verified.", val_style),
        ],
    ]
    res_table = Table(res_data, colWidths=[120, 384])
    res_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG),
            ("BOX", (0, 0), (-1, -1), 1, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(res_table)
    story.append(Spacer(1, 14))

    # 5. Applicant Feedback Section
    fb = snapshot.get("feedback")
    story.append(Paragraph("3. APPLICANT RESOLUTION FEEDBACK", section_h1))
    if fb:
        fb_data = [
            [
                Paragraph("<b>Overall Quality:</b>", label_style),
                Paragraph(f"{fb.get('rating', 'N/A')} / 5", val_style),
                Paragraph("<b>Timeliness:</b>", label_style),
                Paragraph(f"{fb.get('timeliness_rating', 'N/A')} / 5", val_style),
            ],
            [
                Paragraph("<b>Fairness / Process:</b>", label_style),
                Paragraph(f"{fb.get('fairness_rating', 'N/A')} / 5", val_style),
                Paragraph("<b>Submitted At:</b>", label_style),
                Paragraph(str(fb.get("created_at") or "N/A")[:19], val_style),
            ],
            [
                Paragraph("<b>Applicant Remarks:</b>", label_style),
                Paragraph(fb.get("feedback_text") or "No additional remarks.", val_style),
                Paragraph("", label_style),
                Paragraph("", val_style),
            ],
        ]
        fb_table = Table(fb_data, colWidths=[110, 142, 120, 132])
        fb_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG),
                ("BOX", (0, 0), (-1, -1), 1, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("SPAN", (1, 2), (3, 2)),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        story.append(fb_table)
    else:
        story.append(Paragraph("<i>No applicant feedback recorded.</i>", body_style))
    story.append(Spacer(1, 14))

    # 6. Manager Final Closure Section
    closure = snapshot.get("closure", {})
    story.append(Paragraph("4. MANAGER FINAL CLOSURE & RATIFICATION", section_h1))
    closure_data = [
        [Paragraph("<b>Closed By Authority:</b>", label_style), Paragraph(closure.get("closed_by_name", "Manager"), val_style)],
        [Paragraph("<b>Closure Timestamp:</b>", label_style), Paragraph(str(closure.get("closed_at") or "N/A")[:19], val_style)],
        [Paragraph("<b>Manager Remarks:</b>", label_style), Paragraph(closure.get("closure_remarks") or "Final closure verified.", val_style)],
    ]
    cl_table = Table(closure_data, colWidths=[130, 374])
    cl_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG),
            ("BOX", (0, 0), (-1, -1), 1, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(cl_table)
    story.append(Spacer(1, 14))

    # 7. Action History Timeline
    history = snapshot.get("history", [])
    if history:
        story.append(Paragraph("5. PROCEDURAL ACTION HISTORY & AUDIT TRAIL", section_h1))
        hist_rows = [
            [
                Paragraph("<b>Timestamp</b>", label_style),
                Paragraph("<b>Transition</b>", label_style),
                Paragraph("<b>Actor</b>", label_style),
                Paragraph("<b>Remarks</b>", label_style),
            ]
        ]
        for h in history:
            hist_rows.append([
                Paragraph(str(h.get("created_at") or "")[:19], val_style),
                Paragraph(f"{h.get('from_status') or '—'} → {h.get('to_status')}", val_style),
                Paragraph(h.get("actor_type") or "USER", val_style),
                Paragraph(h.get("remarks") or "—", val_style),
            ])
        hist_table = Table(hist_rows, colWidths=[90, 110, 80, 224])
        hist_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_BG),
                ("BOX", (0, 0), (-1, -1), 1, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(hist_table)
        story.append(Spacer(1, 14))

    # 8. Cryptographic Integrity Seal Notice
    story.append(Spacer(1, 10))
    seal_box = [
        [
            Paragraph(
                "<b>OFFICIAL CRYPTOGRAPHIC PRESERVATION SEAL</b><br/>"
                "This document represents the immutable, sealed electronic case record (E-File) compiled "
                "under the authority of Chhatrapati Shahu Ji Maharaj University, Kanpur. "
                "Any alteration of this record renders the SHA-256 integrity seal invalid.",
                ParagraphStyle("SealText", parent=body_style, fontSize=8, leading=11, alignment=1),
            )
        ]
    ]
    seal_table = Table(seal_box, colWidths=[504])
    seal_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
            ("BOX", (0, 0), (-1, -1), 1, COLOR_GOLD),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ])
    )
    story.append(seal_table)

    # Build PDF using NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)

    # Count pages
    from reportlab.pdfgen import canvas as test_c
    return len(NumberedCanvas._saved_page_states) if hasattr(NumberedCanvas, "_saved_page_states") else 1
