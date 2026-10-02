import logging
import os
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, delete

from app.models.base import Base
from app.core.database import engine
from app.modules.phd_rag.models import PhdDocument, PhdChunk
from app.modules.phd_rag.services.document_parser import DocumentParser, DocumentParseResult
from app.modules.phd_rag.services.embedding_service import embedding_service, EmbeddingService

logger = logging.getLogger("vyasa.phd_rag.ingestion")

# Primary and fallback data directories
DATA_DIRECTORIES = [
    os.path.abspath("data/phd-admission"),
    os.path.abspath("backend/data/phd-admission"),
    os.path.abspath("../data/phd-admission"),
]


class PhdIngestionService:
    """
    Ingestion pipeline manager for Ph.D. Admission authoritative documents.
    Handles auditing, checksum validation, chunking, embedding generation,
    and idempotent database persistence.
    """

    def __init__(
        self,
        parser: Optional[DocumentParser] = None,
        embedder: Optional[EmbeddingService] = None,
    ):
        self.parser = parser or DocumentParser()
        self.embedder = embedder or embedding_service

    @staticmethod
    def ensure_tables():
        """Ensure phd_admission tables are created if not present."""
        try:
            Base.metadata.create_all(bind=engine, tables=[
                PhdDocument.__table__,
                PhdChunk.__table__,
            ])
        except Exception as e:
            logger.warning("Could not auto-create phd tables via metadata: %s", e)

    @classmethod
    def resolve_source_directory(cls) -> str:
        for d in DATA_DIRECTORIES:
            if os.path.isdir(d):
                return d
        raise FileNotFoundError(f"Ph.D. admission data directory not found in {DATA_DIRECTORIES}")

    def audit_directory(self, dir_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Inspects authoritative files in the directory without altering them.
        Returns detailed inventory metrics.
        """
        target_dir = dir_path or self.resolve_source_directory()
        if not os.path.isdir(target_dir):
            raise FileNotFoundError(f"Source directory not found: {target_dir}")

        inventory = []
        for filename in sorted(os.listdir(target_dir)):
            filepath = os.path.join(target_dir, filename)
            if not os.path.isfile(filepath):
                continue

            lower = filename.lower()
            if not (lower.endswith(".pdf") or lower.endswith(".docx") or lower.endswith(".pptx")):
                continue

            try:
                parse_res = self.parser.parse_file(filepath)
                chunks = self.parser.chunk_document(parse_res)
                inventory.append({
                    "filename": parse_res.filename,
                    "filepath": parse_res.filepath,
                    "file_type": parse_res.file_type,
                    "file_size_bytes": parse_res.file_size_bytes,
                    "checksum_sha256": parse_res.checksum_sha256,
                    "doc_type": parse_res.doc_type,
                    "title": parse_res.title,
                    "academic_session": parse_res.academic_session,
                    "total_units": parse_res.total_units,
                    "empty_units": parse_res.empty_units,
                    "chunk_count": len(chunks),
                    "warnings": parse_res.extraction_warnings,
                    "status": "VALID",
                })
            except Exception as e:
                logger.error("Failed to parse %s: %s", filename, e)
                inventory.append({
                    "filename": filename,
                    "filepath": filepath,
                    "file_type": os.path.splitext(filename)[1],
                    "file_size_bytes": os.path.getsize(filepath),
                    "checksum_sha256": self.parser.compute_sha256(filepath),
                    "doc_type": "unknown",
                    "title": filename,
                    "academic_session": None,
                    "total_units": 0,
                    "empty_units": [],
                    "chunk_count": 0,
                    "warnings": [str(e)],
                    "status": "ERROR",
                })

        return inventory

    def ingest_document(
        self,
        filepath: str,
        db: Session,
        force_reingest: bool = False,
    ) -> Dict[str, Any]:
        """
        Ingests a single authoritative source file idempotently.
        """
        self.ensure_tables()
        parse_res = self.parser.parse_file(filepath)
        filename = parse_res.filename
        checksum = parse_res.checksum_sha256

        # Check existing document record
        existing_doc = db.execute(
            select(PhdDocument).where(PhdDocument.filename == filename)
        ).scalar_one_or_none()

        if existing_doc and existing_doc.checksum_sha256 == checksum and not force_reingest:
            existing_chunks_count = len(existing_doc.chunks)
            if existing_chunks_count > 0:
                logger.info("Document '%s' already ingested with matching checksum. Skipping.", filename)
                return {
                    "document_id": str(existing_doc.id),
                    "filename": filename,
                    "status": "SKIPPED_ALREADY_INGESTED",
                    "chunks_stored": existing_chunks_count,
                    "checksum": checksum,
                }

        # If existing record needs updating or re-ingesting, delete old record & chunks
        if existing_doc:
            logger.info("Re-ingesting '%s' (checksum changed or forced).", filename)
            db.delete(existing_doc)
            db.flush()

        # Create new document record
        doc_record = PhdDocument(
            id=uuid.uuid4(),
            filename=filename,
            title=parse_res.title,
            doc_type=parse_res.doc_type,
            academic_session=parse_res.academic_session,
            file_size_bytes=parse_res.file_size_bytes,
            checksum_sha256=checksum,
            total_pages_or_slides=parse_res.total_units,
            processing_status="PROCESSING",
            extraction_notes="; ".join(parse_res.extraction_warnings) if parse_res.extraction_warnings else None,
            is_active=True,
        )
        db.add(doc_record)
        db.flush()

        # Chunk document
        chunks = self.parser.chunk_document(parse_res)
        logger.info("Generated %d chunks for '%s'. Generating embeddings...", len(chunks), filename)

        # Batch embed chunk texts
        chunk_texts = [c.chunk_text for c in chunks]
        embeddings = self.embedder.embed_batch(chunk_texts)

        # Store chunks in database
        chunk_entities = []
        for i, c in enumerate(chunks):
            chunk_rec = PhdChunk(
                id=uuid.uuid4(),
                document_id=doc_record.id,
                chunk_index=c.chunk_index,
                doc_type=c.doc_type,
                document_title=c.document_title,
                source_filename=c.source_filename,
                academic_session=c.academic_session,
                page_number=c.page_number,
                slide_number=c.slide_number,
                section_heading=c.section_heading,
                chunk_text=c.chunk_text,
                token_count=c.token_count,
                checksum_sha256=c.checksum_sha256,
                embedding=embeddings[i] if i < len(embeddings) else None,
            )
            chunk_entities.append(chunk_rec)

        db.add_all(chunk_entities)
        doc_record.processing_status = "COMPLETED"
        db.commit()

        logger.info("Successfully ingested '%s' (%d chunks).", filename, len(chunk_entities))
        return {
            "document_id": str(doc_record.id),
            "filename": filename,
            "status": "SUCCESS",
            "chunks_stored": len(chunk_entities),
            "checksum": checksum,
            "doc_type": doc_record.doc_type,
            "academic_session": doc_record.academic_session,
        }

    def ingest_all(
        self,
        db: Session,
        dir_path: Optional[str] = None,
        force_reingest: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Ingest all authoritative documents located in the source directory.
        """
        target_dir = dir_path or self.resolve_source_directory()
        results = []
        for filename in sorted(os.listdir(target_dir)):
            filepath = os.path.join(target_dir, filename)
            if not os.path.isfile(filepath):
                continue
            lower = filename.lower()
            if not (lower.endswith(".pdf") or lower.endswith(".docx") or lower.endswith(".pptx")):
                continue

            try:
                res = self.ingest_document(filepath, db, force_reingest=force_reingest)
                results.append(res)
            except Exception as e:
                logger.error("Failed to ingest '%s': %s", filename, e, exc_info=True)
                results.append({
                    "filename": filename,
                    "status": "FAILED",
                    "error": str(e),
                })

        return results


# Singleton instance
ingestion_service = PhdIngestionService()
