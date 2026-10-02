import hashlib
import os
import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
import pypdf
import pptx
import docx


@dataclass
class RawExtractedItem:
    """
    Extracted textual item from a source document page, slide, or clause.
    """
    unit_index: int  # 1-indexed page or slide or section
    unit_type: str   # "page" | "slide" | "section"
    heading: Optional[str]
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_empty: bool = False
    warning: Optional[str] = None


@dataclass
class DocumentParseResult:
    """
    Complete parse result for an authoritative source file.
    """
    filepath: str
    filename: str
    file_type: str
    file_size_bytes: int
    checksum_sha256: str
    doc_type: str  # "brochure" | "ordinance" | "coursework_ppt"
    title: str
    academic_session: Optional[str]
    total_units: int  # total pages or slides
    empty_units: List[int] = field(default_factory=list)
    items: List[RawExtractedItem] = field(default_factory=list)
    extraction_warnings: List[str] = field(default_factory=list)


@dataclass
class ProcessedChunk:
    """
    A chunk ready for vector embedding and database indexing.
    """
    chunk_index: int
    doc_type: str
    document_title: str
    source_filename: str
    academic_session: Optional[str]
    page_number: Optional[int]
    slide_number: Optional[int]
    section_heading: Optional[str]
    chunk_text: str
    token_count: int
    checksum_sha256: str


class DocumentParser:
    """
    Unified extraction parser for Ph.D. Admission authoritative documents:
    - PDF (Brochure)
    - DOCX (Ordinance)
    - PPTX (Course Work Orientation)
    """

    @staticmethod
    def compute_sha256(filepath: str) -> str:
        sha = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                sha.update(chunk)
        return sha.hexdigest()

    @staticmethod
    def classify_document(filename: str) -> Tuple[str, str, Optional[str]]:
        """
        Classifies filename into (doc_type, title, academic_session).
        """
        lower = filename.lower()
        if "brochure" in lower or lower.endswith(".pdf"):
            return (
                "brochure",
                "Ph.D. Admission Brochure",
                "2026-27" if "26" in lower else None,
            )
        elif "ordinance" in lower or lower.endswith(".docx"):
            return (
                "ordinance",
                "Ph.D. Ordinance",
                "2024-25" if "2024" in lower or "24" in lower else None,
            )
        elif "coursework" in lower or "orientation" in lower or lower.endswith(".pptx"):
            return (
                "coursework_ppt",
                "Ph.D. Course Work Orientation",
                "2026-27" if "26" in lower else None,
            )
        return ("unknown", filename, None)

    def parse_pdf(self, filepath: str) -> DocumentParseResult:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        size = os.path.getsize(filepath)
        checksum = self.compute_sha256(filepath)
        filename = os.path.basename(filepath)
        doc_type, title, session = self.classify_document(filename)

        reader = pypdf.PdfReader(filepath)
        total_pages = len(reader.pages)
        empty_pages = []
        items: List[RawExtractedItem] = []
        warnings: List[str] = []

        for i, page in enumerate(reader.pages):
            page_num = i + 1
            extracted = page.extract_text() or ""
            cleaned = re.sub(r"[ \t]+", " ", extracted).replace("\x00", "").strip()

            if not cleaned:
                empty_pages.append(page_num)
                items.append(
                    RawExtractedItem(
                        unit_index=page_num,
                        unit_type="page",
                        heading=None,
                        text="",
                        is_empty=True,
                        warning=f"Page {page_num} yielded no extractable text.",
                    )
                )
                continue

            # Identify probable heading from first non-empty lines
            lines = [l.strip() for l in cleaned.splitlines() if l.strip()]
            heading = lines[0] if lines else None
            if heading and len(heading) > 100:
                heading = heading[:97] + "..."

            items.append(
                RawExtractedItem(
                    unit_index=page_num,
                    unit_type="page",
                    heading=heading,
                    text=cleaned,
                    is_empty=False,
                )
            )

        if empty_pages:
            warnings.append(f"Found {len(empty_pages)} empty pages in PDF: {empty_pages}")

        return DocumentParseResult(
            filepath=filepath,
            filename=filename,
            file_type="pdf",
            file_size_bytes=size,
            checksum_sha256=checksum,
            doc_type=doc_type,
            title=title,
            academic_session=session,
            total_units=total_pages,
            empty_units=empty_pages,
            items=items,
            extraction_warnings=warnings,
        )

    def parse_pptx(self, filepath: str) -> DocumentParseResult:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        size = os.path.getsize(filepath)
        checksum = self.compute_sha256(filepath)
        filename = os.path.basename(filepath)
        doc_type, title, session = self.classify_document(filename)

        prs = pptx.Presentation(filepath)
        total_slides = len(prs.slides)
        empty_slides = []
        items: List[RawExtractedItem] = []
        warnings: List[str] = []

        for idx, slide in enumerate(prs.slides):
            slide_num = idx + 1
            extracted_blocks = []
            slide_title = None

            if slide.shapes.title and slide.shapes.title.has_text_frame:
                slide_title = slide.shapes.title.text.strip()

            for shape in slide.shapes:
                if shape.has_text_frame:
                    text_parts = [
                        p.text.strip()
                        for p in shape.text_frame.paragraphs
                        if p.text.strip()
                    ]
                    if text_parts:
                        extracted_blocks.append("\n".join(text_parts))

            joined_text = "\n\n".join(extracted_blocks).strip()
            cleaned = re.sub(r"[ \t]+", " ", joined_text).strip()

            if not cleaned:
                empty_slides.append(slide_num)
                items.append(
                    RawExtractedItem(
                        unit_index=slide_num,
                        unit_type="slide",
                        heading=slide_title,
                        text="",
                        is_empty=True,
                        warning=f"Slide {slide_num} yielded no text content.",
                    )
                )
                continue

            if not slide_title and extracted_blocks:
                first_line = extracted_blocks[0].splitlines()[0].strip()
                slide_title = first_line[:100]

            items.append(
                RawExtractedItem(
                    unit_index=slide_num,
                    unit_type="slide",
                    heading=slide_title,
                    text=cleaned,
                    is_empty=False,
                )
            )

        if empty_slides:
            warnings.append(f"Found {len(empty_slides)} empty slides in PPTX: {empty_slides}")

        return DocumentParseResult(
            filepath=filepath,
            filename=filename,
            file_type="pptx",
            file_size_bytes=size,
            checksum_sha256=checksum,
            doc_type=doc_type,
            title=title,
            academic_session=session,
            total_units=total_slides,
            empty_units=empty_slides,
            items=items,
            extraction_warnings=warnings,
        )

    def parse_docx(self, filepath: str) -> DocumentParseResult:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        size = os.path.getsize(filepath)
        checksum = self.compute_sha256(filepath)
        filename = os.path.basename(filepath)
        doc_type, title, session = self.classify_document(filename)

        doc = docx.Document(filepath)
        items: List[RawExtractedItem] = []
        warnings: List[str] = []

        # In CSJMU Ph.D. Ordinance DOCX, the text is organized in tables and paragraphs.
        # We group clauses and sections to preserve statutory context.
        current_section = "General Provisions"
        unit_counter = 1

        # First collect all paragraphs and table contents in reading order
        elements_text = []

        # Iterate paragraphs
        for p in doc.paragraphs:
            txt = p.text.strip()
            if txt:
                elements_text.append(("p", txt))

        # Iterate tables and extract row clauses
        for t in doc.tables:
            for row in t.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                # remove adjacent duplicate text from merged cells
                deduped = []
                for c in cells:
                    if not deduped or deduped[-1] != c:
                        deduped.append(c)
                if deduped:
                    row_txt = " | ".join(deduped)
                    elements_text.append(("table_row", row_txt))

        # Now group into coherent clauses / sections
        buffer: List[str] = []
        current_heading = "Preamble & General Rules"

        clause_regex = re.compile(r"^(\d+\.?\s+[A-Z\s,:-]{4,}|\d+\.\d{2})")

        for elem_type, txt in elements_text:
            cleaned = re.sub(r"[ \t]+", " ", txt).strip()
            if not cleaned:
                continue

            # Check if this starts a major section or numbered clause
            match = clause_regex.match(cleaned)
            is_major_heading = bool(re.match(r"^\d+\.\s+[A-Z\s,:-]{3,}", cleaned))

            if is_major_heading:
                if buffer:
                    combined = "\n".join(buffer).strip()
                    if combined:
                        items.append(
                            RawExtractedItem(
                                unit_index=unit_counter,
                                unit_type="section",
                                heading=current_heading,
                                text=combined,
                            )
                        )
                        unit_counter += 1
                    buffer = []
                current_heading = cleaned[:100]
                buffer.append(cleaned)
            else:
                buffer.append(cleaned)
                # If buffer grows beyond 1500 chars, flush chunk to keep context manageable
                if len("\n".join(buffer)) > 1500:
                    combined = "\n".join(buffer).strip()
                    items.append(
                        RawExtractedItem(
                            unit_index=unit_counter,
                            unit_type="section",
                            heading=current_heading,
                            text=combined,
                        )
                    )
                    unit_counter += 1
                    buffer = []

        if buffer:
            combined = "\n".join(buffer).strip()
            if combined:
                items.append(
                    RawExtractedItem(
                        unit_index=unit_counter,
                        unit_type="section",
                        heading=current_heading,
                        text=combined,
                    )
                )

        return DocumentParseResult(
            filepath=filepath,
            filename=filename,
            file_type="docx",
            file_size_bytes=size,
            checksum_sha256=checksum,
            doc_type=doc_type,
            title=title,
            academic_session=session,
            total_units=len(items),
            empty_units=[],
            items=items,
            extraction_warnings=warnings,
        )

    def parse_file(self, filepath: str) -> DocumentParseResult:
        """
        Auto-routes to the appropriate parser by file extension.
        """
        lower = filepath.lower()
        if lower.endswith(".pdf"):
            return self.parse_pdf(filepath)
        elif lower.endswith(".pptx"):
            return self.parse_pptx(filepath)
        elif lower.endswith(".docx"):
            return self.parse_docx(filepath)
        else:
            raise ValueError(f"Unsupported file format: {filepath}")

    def chunk_document(
        self,
        parse_result: DocumentParseResult,
        max_chunk_chars: int = 900,
        overlap_chars: int = 150,
    ) -> List[ProcessedChunk]:
        """
        Splits extracted items into cohesive chunks for RAG embedding and citation.
        Preserves page number, slide number, and clause heading in every chunk.
        """
        chunks: List[ProcessedChunk] = []
        chunk_idx = 0

        for item in parse_result.items:
            if item.is_empty or not item.text.strip():
                continue

            page_no = item.unit_index if item.unit_type == "page" else None
            slide_no = item.unit_index if item.unit_type == "slide" else None
            heading = (item.heading or "General Information").replace("\x00", "")

            text = item.text.replace("\x00", "").strip()

            # If text is small enough, keep as single chunk
            if len(text) <= max_chunk_chars:
                token_est = len(text.split())
                chunk_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
                chunks.append(
                    ProcessedChunk(
                        chunk_index=chunk_idx,
                        doc_type=parse_result.doc_type,
                        document_title=parse_result.title,
                        source_filename=parse_result.filename,
                        academic_session=parse_result.academic_session,
                        page_number=page_no,
                        slide_number=slide_no,
                        section_heading=heading,
                        chunk_text=text,
                        token_count=token_est,
                        checksum_sha256=chunk_hash,
                    )
                )
                chunk_idx += 1
            else:
                # Break down gracefully with overlap, respecting paragraph/clause lines
                paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
                current_batch: List[str] = []
                current_len = 0

                for para in paragraphs:
                    if current_len + len(para) > max_chunk_chars and current_batch:
                        chunk_body = "\n".join(current_batch).strip()
                        token_est = len(chunk_body.split())
                        chunk_hash = hashlib.sha256(chunk_body.encode("utf-8")).hexdigest()
                        chunks.append(
                            ProcessedChunk(
                                chunk_index=chunk_idx,
                                doc_type=parse_result.doc_type,
                                document_title=parse_result.title,
                                source_filename=parse_result.filename,
                                academic_session=parse_result.academic_session,
                                page_number=page_no,
                                slide_number=slide_no,
                                section_heading=heading,
                                chunk_text=chunk_body,
                                token_count=token_est,
                                checksum_sha256=chunk_hash,
                            )
                        )
                        chunk_idx += 1

                        # Keep last paragraph for overlap if within overlap budget
                        if len(current_batch[-1]) <= overlap_chars:
                            current_batch = [current_batch[-1], para]
                            current_len = len(current_batch[0]) + len(para)
                        else:
                            current_batch = [para]
                            current_len = len(para)
                    else:
                        current_batch.append(para)
                        current_len += len(para)

                if current_batch:
                    chunk_body = "\n".join(current_batch).strip()
                    token_est = len(chunk_body.split())
                    chunk_hash = hashlib.sha256(chunk_body.encode("utf-8")).hexdigest()
                    chunks.append(
                        ProcessedChunk(
                            chunk_index=chunk_idx,
                            doc_type=parse_result.doc_type,
                            document_title=parse_result.title,
                            source_filename=parse_result.filename,
                            academic_session=parse_result.academic_session,
                            page_number=page_no,
                            slide_number=slide_no,
                            section_heading=heading,
                            chunk_text=chunk_body,
                            token_count=token_est,
                            checksum_sha256=chunk_hash,
                        )
                    )
                    chunk_idx += 1

        return chunks
