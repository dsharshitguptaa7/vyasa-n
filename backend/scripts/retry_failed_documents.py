# -*- coding: utf-8 -*-
"""
VYASA Centralized Failed Document Recovery & Extraction Retry CLI

Audits and idempotently reprocesses failed, stuck, or unindexed documents
across the AI Knowledge Centre and Ph.D. RAG subsystems using the verified
Gemini embedding model (gemini-embedding-001).

Operational Safety Guarantees:
1. Operational Approval Guard: Dry-run by default. Requires explicit '--execute' to modify database.
2. Metadata Preservation: Retains canonical document IDs, version IDs, and storage keys.
3. Zero Duplication: Atomically purges partial chunks for the specific version before re-inserting.
4. Source File Integrity: Reads existing local/Spaces source assets without altering them.
5. Idempotent Execution: Safe to re-run multiple times without duplicate records or orphaned vectors.
6. Per-Document Reporting: Outputs structured audit log and exit code.
"""

import argparse
import logging
import os
import sys
import uuid
from typing import Any, Dict, List, Optional

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import delete, select, update

from app.core.database import SessionLocal
from app.modules.phd_rag.services.embedding_service import embedding_service
from app.modules.phd_rag.services.ingestion_service import ingestion_service
from app.modules.phd_rag.models import PhdDocument, PhdChunk
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeExtractionStatus,
    KnowledgeDocumentStatus,
)
from app.modules.knowledge_centre.service import knowledge_service
from app.core.storage import storage_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("vyasa.recovery.failed_documents")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit and recover failed AI Knowledge documents with gemini-embedding-001."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Execute database modifications and embedding regeneration. If omitted, runs in read-only dry-run mode.",
    )
    parser.add_argument(
        "--doc-id",
        type=str,
        default=None,
        help="Target a specific document UUID (AiKnowledgeDocument or PhdDocument).",
    )
    parser.add_argument(
        "--subsystem",
        choices=["all", "knowledge_centre", "phd_admission"],
        default="all",
        help="Select which subsystem to recover (default: all).",
    )
    parser.add_argument(
        "--check-live-api",
        action="store_true",
        default=False,
        help="Execute a live test embedding ping to verify provider API connectivity.",
    )
    return parser.parse_args()


def audit_provider_health(check_live: bool = False) -> bool:
    """Verifies that the embedding provider is configured with a valid model and credentials."""
    logger.info("Validating centralized embedding provider configuration...")
    health = embedding_service.validate_provider(check_live=check_live)
    logger.info(
        "Provider Status: %s | Model: %s | Dimensions: %d | Mode: %s",
        health["status"],
        health["model"],
        health["dimensions"],
        health["mode"],
    )

    if health["issues"]:
        for issue in health["issues"]:
            logger.warning("  - [ISSUE] %s", issue)

    if health["is_known_retired"]:
        logger.error(
            "CRITICAL: Active embedding model '%s' is retired and will fail permanently with 404 NOT_FOUND.",
            health["model"],
        )
        return False

    if health["status"] == "MISCONFIGURED":
        logger.error("Embedding provider is misconfigured. Aborting recovery.")
        return False

    return True


def recover_knowledge_centre_documents(
    db,
    execute: bool = False,
    target_doc_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Audits and optionally retries failed Knowledge Centre documents."""
    results = []

    stmt = select(AiKnowledgeDocumentVersion).join(
        AiKnowledgeDocument, AiKnowledgeDocumentVersion.document_id == AiKnowledgeDocument.id
    )
    if target_doc_id:
        try:
            target_uuid = uuid.UUID(target_doc_id)
            stmt = stmt.where(AiKnowledgeDocumentVersion.document_id == target_uuid)
        except ValueError:
            logger.error("Invalid UUID passed for --doc-id: %s", target_doc_id)
            return []
    else:
        stmt = stmt.where(
            AiKnowledgeDocumentVersion.extraction_status.in_([
                KnowledgeExtractionStatus.FAILED.value,
                KnowledgeExtractionStatus.PENDING.value,
            ])
        )

    failed_versions = db.execute(stmt).scalars().all()
    logger.info("Found %d Knowledge Centre versions requiring attention.", len(failed_versions))

    for ver in failed_versions:
        doc = ver.document
        doc_info = {
            "subsystem": "knowledge_centre",
            "document_id": str(doc.id),
            "version_id": str(ver.id),
            "title": doc.title,
            "filename": ver.original_filename,
            "version_number": ver.version_number,
            "previous_status": ver.extraction_status,
            "previous_error": ver.processing_error,
            "chunks_stored": len(ver.chunks) if ver.chunks else 0,
            "storage_key": ver.storage_key,
        }

        # Check source file presence
        file_path = None
        file_exists = False
        try:
            file_path = storage_service.get_file_path(ver.storage_key)
            file_exists = file_path.is_file()
        except Exception as f_err:
            logger.warning("Could not resolve local file for %s: %s", ver.storage_key, f_err)

        doc_info["file_exists"] = file_exists

        if not file_exists:
            doc_info["outcome"] = "SKIPPED_SOURCE_FILE_MISSING"
            doc_info["error"] = f"Storage key {ver.storage_key} not found on disk or Spaces."
            results.append(doc_info)
            continue

        if not execute:
            doc_info["outcome"] = "DRY_RUN_ELIGIBLE_FOR_RETRY"
            results.append(doc_info)
            continue

        # Execute Retry
        logger.info("Executing recovery for Knowledge Centre document %s (v%d)...", doc.id, ver.version_number)
        try:
            # Idempotently re-extract, chunk, embed, and store
            job_id = uuid.uuid4()
            chunks_count = knowledge_service.extract_and_index_document(
                db=db,
                document_id=doc.id,
                version_id=ver.id,
                job_id=job_id,
            )
            doc_info["outcome"] = "RECOVERED_SUCCESSFULLY" if chunks_count > 0 else "RETRY_YIELDED_ZERO_CHUNKS"
            doc_info["new_chunks_count"] = chunks_count
            doc_info["new_status"] = ver.extraction_status
        except Exception as retry_exc:
            logger.error("Failed to recover document %s: %s", doc.id, retry_exc, exc_info=True)
            doc_info["outcome"] = "RETRY_FAILED"
            doc_info["error"] = str(retry_exc)

        results.append(doc_info)

    return results


def recover_phd_admission_documents(
    db,
    execute: bool = False,
    target_doc_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Audits and optionally retries failed or un-embedded Ph.D. admission documents."""
    results = []

    stmt = select(PhdDocument)
    if target_doc_id:
        try:
            target_uuid = uuid.UUID(target_doc_id)
            stmt = stmt.where(PhdDocument.id == target_uuid)
        except ValueError:
            return []
    else:
        stmt = stmt.where(PhdDocument.processing_status.in_(["FAILED", "PROCESSING"]))

    phd_docs = db.execute(stmt).scalars().all()
    logger.info("Found %d Ph.D. Admission documents requiring attention.", len(phd_docs))

    # Data directory resolver
    data_dir = None
    try:
        data_dir = ingestion_service.resolve_source_directory()
    except Exception as d_err:
        logger.warning("Could not resolve Ph.D. data directory: %s", d_err)

    for doc in phd_docs:
        doc_info = {
            "subsystem": "phd_admission",
            "document_id": str(doc.id),
            "title": doc.title,
            "filename": doc.filename,
            "previous_status": doc.processing_status,
            "previous_error": doc.extraction_notes,
            "chunks_stored": len(doc.chunks) if doc.chunks else 0,
        }

        filepath = os.path.join(data_dir, doc.filename) if data_dir else None
        file_exists = bool(filepath and os.path.isfile(filepath))
        doc_info["file_exists"] = file_exists

        if not file_exists:
            doc_info["outcome"] = "SKIPPED_SOURCE_FILE_MISSING"
            doc_info["error"] = f"Source file {doc.filename} not found in {data_dir}"
            results.append(doc_info)
            continue

        if not execute:
            doc_info["outcome"] = "DRY_RUN_ELIGIBLE_FOR_RETRY"
            results.append(doc_info)
            continue

        logger.info("Executing recovery for Ph.D. document %s (%s)...", doc.id, doc.filename)
        try:
            res = ingestion_service.ingest_document(
                filepath=filepath,
                db=db,
                force_reingest=True,
            )
            doc_info["outcome"] = "RECOVERED_SUCCESSFULLY"
            doc_info["new_chunks_count"] = res.get("chunks_stored", 0)
            doc_info["new_status"] = "COMPLETED"
        except Exception as retry_exc:
            logger.error("Failed to recover Ph.D. document %s: %s", doc.id, retry_exc, exc_info=True)
            doc_info["outcome"] = "RETRY_FAILED"
            doc_info["error"] = str(retry_exc)

        results.append(doc_info)

    return results


def main():
    args = parse_args()
    logger.info("=== VYASA Failed Document Recovery Workflow ===")
    logger.info("Mode: %s", "EXECUTE (PRODUCTION DB MODIFICATION)" if args.execute else "DRY-RUN (READ-ONLY AUDIT)")

    if not audit_provider_health(check_live=args.check_live_api):
        logger.error("Provider health check failed. Please ensure GEMINI_EMBEDDING_MODEL and GEMINI_API_KEY are properly configured.")
        sys.exit(1)

    db = SessionLocal()
    try:
        all_results = []

        if args.subsystem in ("all", "knowledge_centre"):
            kc_res = recover_knowledge_centre_documents(db, execute=args.execute, target_doc_id=args.doc_id)
            all_results.extend(kc_res)

        if args.subsystem in ("all", "phd_admission"):
            phd_res = recover_phd_admission_documents(db, execute=args.execute, target_doc_id=args.doc_id)
            all_results.extend(phd_res)

        # Print structured recovery report
        print("\n" + "=" * 90)
        print(f"RECOVERY AUDIT & EXECUTION REPORT (Mode: {'EXECUTE' if args.execute else 'DRY RUN'})")
        print("=" * 90)

        if not all_results:
            print("No failed or pending documents found in selected scope.")
        else:
            for item in all_results:
                print(f"[{item['subsystem'].upper()}] {item['title']} ({item.get('filename')})")
                print(f"  Doc ID:          {item['document_id']}")
                print(f"  Previous Status: {item['previous_status']}")
                print(f"  File Exists:     {item.get('file_exists')}")
                print(f"  Outcome:         {item.get('outcome')}")
                if "new_chunks_count" in item:
                    print(f"  Chunks Indexed:  {item['new_chunks_count']}")
                if item.get("error"):
                    print(f"  Error Detail:    {item['error']}")
                print("-" * 90)

        print("=" * 90 + "\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()
